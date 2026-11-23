/**
 * TeamFlow Workload & Deadline Risk engine.
 *
 * Pure functions (no database access) so the logic is easy to unit test and
 * easy to explain in the viva. The controller loads data and calls analyzeTeam().
 *
 * 1. Member workload
 *    Each open task contributes:  remainingHours x priorityWeight x urgencyWeight
 *    remainingHours = estimateHours x (1 - progress/100)
 *    loadPercent    = total / member.weeklyCapacity x 100
 *    >= 100% overloaded, >= 75% busy, < 30% available, otherwise balanced.
 *
 * 2. Project deadline risk
 *    velocity       = hours of work finished per day over the last 14 days
 *                     (falls back to a capacity estimate when there is no history)
 *    projectedDays  = remainingHours / velocity
 *    paceRatio      = projectedDays / daysLeft    (> 1 means it will be late)
 *    score          = paceRatio x 70 + overdue x 8 + unassigned x 3 + overloadedAssignees x 10
 *    level: >= 75 critical, >= 50 high, >= 25 medium, else low.
 *
 * 3. Rebalance suggestions
 *    For each overloaded member, propose moving one lower-priority task to the
 *    least-loaded teammate who would stay under 85% after taking it.
 */

const DAY = 24 * 60 * 60 * 1000;
const VELOCITY_WINDOW_DAYS = 14;

export const PRIORITY_WEIGHT = { low: 0.8, medium: 1, high: 1.3, critical: 1.6 };
const PRIORITY_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const idOf = (x) => String(x?._id ?? x ?? '');

export const isOpen = (t) => t.status !== 'done';

export function remainingHours(task) {
  const est = Number(task.estimateHours) || 0;
  return est * (1 - clamp(Number(task.progress) || 0, 0, 100) / 100);
}

export function urgencyWeight(dueDate, now = Date.now()) {
  if (!dueDate) return 0.6; // undated work still counts, lightly
  const days = (new Date(dueDate).getTime() - now) / DAY;
  if (days < 0) return 1.5; // overdue
  if (days <= 2) return 1.3;
  if (days <= 7) return 1.0;
  if (days <= 14) return 0.6;
  return 0.3; // far-future work is spread across later weeks
}

export function taskLoad(task, now = Date.now()) {
  return remainingHours(task) * (PRIORITY_WEIGHT[task.priority] ?? 1) * urgencyWeight(task.dueDate, now);
}

function memberStatus(loadPercent) {
  if (loadPercent >= 100) return 'overloaded';
  if (loadPercent >= 75) return 'busy';
  if (loadPercent < 30) return 'available';
  return 'balanced';
}

export function analyzeMembers(members, tasks, now = Date.now()) {
  return members.map((m) => {
    const user = m.user;
    const uid = idOf(user);
    const mine = tasks.filter((t) => idOf(t.assignee) === uid);
    const open = mine.filter(isOpen);
    const load = open.reduce((sum, t) => sum + taskLoad(t, now), 0);
    const capacity = Number(user.weeklyCapacity) || 20;
    const loadPercent = round((load / capacity) * 100, 0);
    const overdue = open.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now).length;
    const dueSoon = open.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate).getTime() - now;
      return d >= 0 && d <= 3 * DAY;
    }).length;
    const completedThisWeek = mine.filter((t) => t.completedAt && now - new Date(t.completedAt).getTime() <= 7 * DAY).length;

    return {
      user: { _id: uid, name: user.name, email: user.email, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl },
      role: m.role,
      weeklyCapacity: capacity,
      openTasks: open.length,
      remainingHours: round(open.reduce((s, t) => s + remainingHours(t), 0)),
      weightedLoad: round(load),
      loadPercent,
      status: memberStatus(loadPercent),
      overdue,
      dueSoon,
      completedThisWeek,
    };
  });
}

export function analyzeProject(project, tasks, memberStats, now = Date.now()) {
  const pid = idOf(project);
  const ptasks = tasks.filter((t) => idOf(t.project) === pid);
  const open = ptasks.filter(isOpen);
  const totalHours = ptasks.reduce((s, t) => s + (Number(t.estimateHours) || 0), 0);
  const remaining = open.reduce((s, t) => s + remainingHours(t), 0);
  const completion = totalHours > 0 ? round(((totalHours - remaining) / totalHours) * 100, 0) : 0;

  const windowStart = now - VELOCITY_WINDOW_DAYS * DAY;
  const recentlyDone = ptasks.filter((t) => t.completedAt && new Date(t.completedAt).getTime() >= windowStart);
  const observedVelocity = recentlyDone.reduce((s, t) => s + (Number(t.estimateHours) || 0), 0) / VELOCITY_WINDOW_DAYS;

  // Fallback: assume assignees spend half their capacity on this project.
  const assigneeIds = new Set(open.map((t) => idOf(t.assignee)).filter(Boolean));
  const capacityPerDay = memberStats
    .filter((m) => assigneeIds.has(m.user._id))
    .reduce((s, m) => s + m.weeklyCapacity / 7, 0) * 0.5;

  const useHistory = recentlyDone.length >= 2 && observedVelocity > 0;
  const velocity = Math.max(useHistory ? observedVelocity : capacityPerDay, 0.25);

  const daysLeft = (new Date(project.deadline).getTime() - now) / DAY;
  const projectedDays = remaining / velocity;
  const overdue = open.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now).length;
  const unassigned = open.filter((t) => !t.assignee).length;
  const overloadedAssignees = memberStats.filter((m) => assigneeIds.has(m.user._id) && m.status === 'overloaded').length;

  let score;
  let paceRatio = 0;
  const reasons = [];

  if (open.length === 0) {
    score = 0;
    if (ptasks.length) reasons.push('All tasks are complete');
    else reasons.push('No tasks yet: add tasks to get a forecast');
  } else if (daysLeft <= 0) {
    score = 100;
    reasons.push(`Deadline passed with ${open.length} task(s) still open`);
  } else {
    paceRatio = projectedDays / daysLeft;
    score = paceRatio * 70 + overdue * 8 + unassigned * 3 + overloadedAssignees * 10;
    if (paceRatio > 1) reasons.push(`At current pace needs ~${round(projectedDays)} days but only ${round(daysLeft)} left`);
    else if (paceRatio > 0.75) reasons.push(`Tight schedule: ${round(projectedDays)} days of work for ${round(daysLeft)} days left`);
    if (overdue) reasons.push(`${overdue} overdue task(s)`);
    if (unassigned) reasons.push(`${unassigned} open task(s) have no owner`);
    if (overloadedAssignees) reasons.push(`${overloadedAssignees} assignee(s) are overloaded`);
    if (!useHistory) reasons.push('Forecast based on team capacity (not enough completed work yet)');
  }
  score = round(clamp(score, 0, 100), 0);

  const level = open.length === 0 ? 'done' : score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
  const forecastFinish = open.length ? new Date(now + projectedDays * DAY) : null;

  return {
    project: { _id: pid, name: project.name, deadline: project.deadline, status: project.status, color: project.color },
    totalTasks: ptasks.length,
    openTasks: open.length,
    completion,
    remainingHours: round(remaining),
    velocityPerDay: round(velocity, 2),
    velocityBasis: useHistory ? 'history' : 'capacity',
    daysLeft: round(daysLeft),
    projectedDays: round(projectedDays),
    forecastFinish,
    paceRatio: round(paceRatio, 2),
    overdue,
    unassigned,
    riskScore: score,
    riskLevel: level,
    reasons,
  };
}

export function findAtRiskTasks(tasks, memberStats, now = Date.now()) {
  const overloaded = new Set(memberStats.filter((m) => m.status === 'overloaded').map((m) => m.user._id));
  const out = [];
  for (const t of tasks.filter(isOpen)) {
    const due = t.dueDate ? new Date(t.dueDate).getTime() - now : null;
    let reason = null;
    if (due !== null && due < 0) reason = 'Overdue';
    else if (due !== null && due <= 2 * DAY && t.status === 'todo') reason = 'Due within 2 days and not started';
    else if (due !== null && due <= 7 * DAY && overloaded.has(idOf(t.assignee))) reason = 'Owner is overloaded';
    else if (!t.assignee && due !== null && due <= 7 * DAY) reason = 'Due this week with no owner';
    if (reason) out.push({ task: t, reason });
  }
  return out.sort((a, b) => new Date(a.task.dueDate || 8.64e15) - new Date(b.task.dueDate || 8.64e15));
}

export function suggestRebalance(tasks, memberStats, now = Date.now()) {
  const stats = memberStats.map((m) => ({ ...m, projected: m.loadPercent }));
  const suggestions = [];

  for (const from of stats.filter((m) => m.status === 'overloaded')) {
    const movable = tasks
      .filter((t) => isOpen(t) && t.status !== 'review' && idOf(t.assignee) === from.user._id)
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || taskLoad(b, now) - taskLoad(a, now));

    for (const task of movable) {
      const load = taskLoad(task, now);
      const target = stats
        .filter((m) => m.user._id !== from.user._id)
        .map((m) => ({ m, after: m.projected + (load / m.weeklyCapacity) * 100 }))
        .filter((x) => x.after < 85)
        .sort((a, b) => a.after - b.after)[0];
      if (!target) continue;

      target.m.projected = target.after;
      from.projected -= (load / from.weeklyCapacity) * 100;
      suggestions.push({
        task: { _id: idOf(task), title: task.title, priority: task.priority, dueDate: task.dueDate, project: idOf(task.project) },
        from: from.user,
        to: target.m.user,
        reason: `${from.user.name} is at ${from.loadPercent}% load; ${target.m.user.name} would go to ${round(target.after, 0)}%`,
      });
      break; // one suggestion per overloaded member keeps it actionable
    }
  }
  return suggestions;
}

export function analyzeTeam({ members, projects, tasks, now = Date.now() }) {
  const memberStats = analyzeMembers(members, tasks, now);
  const projectStats = projects.map((p) => analyzeProject(p, tasks, memberStats, now));
  const atRisk = findAtRiskTasks(tasks, memberStats, now);
  const open = tasks.filter(isOpen);

  return {
    generatedAt: new Date(now),
    summary: {
      members: members.length,
      projects: projects.length,
      openTasks: open.length,
      completedTasks: tasks.length - open.length,
      overdueTasks: open.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now).length,
      overloadedMembers: memberStats.filter((m) => m.status === 'overloaded').length,
      projectsAtRisk: projectStats.filter((p) => ['high', 'critical'].includes(p.riskLevel)).length,
      teamLoadPercent: memberStats.length
        ? round(memberStats.reduce((s, m) => s + m.loadPercent, 0) / memberStats.length, 0)
        : 0,
    },
    members: memberStats.sort((a, b) => b.loadPercent - a.loadPercent),
    projects: projectStats.sort((a, b) => b.riskScore - a.riskScore),
    atRiskTasks: atRisk,
    suggestions: suggestRebalance(tasks, memberStats, now),
  };
}
