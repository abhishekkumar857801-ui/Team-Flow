import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useSocketEvents } from '../lib/socket.js';
import { formatDate, relativeDue, timeAgo } from '../lib/format.js';
import { Avatar, Badge, Spinner, useToast } from '../components/ui.jsx';
import Icon, { Ring } from '../components/Icon.jsx';

const RISK_COLOR = { critical: '#e11d48', high: '#f97316', medium: '#0ea5e9', low: '#16a34a', done: '#16a34a' };

function useDebounced(fn, ms) {
  const t = useRef();
  return useCallback(() => {
    clearTimeout(t.current);
    t.current = setTimeout(fn, ms);
  }, [fn, ms]);
}

// One number for the hero: 100 = healthy team, lower = more risk.
function teamHealth(summary, projects) {
  if (!projects.length && !summary.openTasks) return 100;
  const avgRisk = projects.length ? projects.reduce((s, p) => s + p.riskScore, 0) / projects.length : 0;
  const penalty = avgRisk * 0.6 + summary.overloadedMembers * 8 + summary.overdueTasks * 4;
  return Math.max(0, Math.round(100 - penalty));
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function DashboardPage() {
  const { teamId } = useParams();
  const { team, isManager } = useOutletContext();
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([
        api.get(`/teams/${teamId}/dashboard`),
        api.get(`/teams/${teamId}/activity`, { params: { limit: 25 } }),
      ]);
      setData(d.data);
      setActivity(a.data.activity);
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [teamId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000); // deadlines move even when nobody edits
    return () => clearInterval(id);
  }, [load]);

  const refresh = useDebounced(load, 250);
  useSocketEvents(
    {
      'task:created': refresh,
      'task:updated': refresh,
      'task:deleted': refresh,
      'tasks:refresh': refresh,
      'project:changed': refresh,
      'team:updated': refresh,
    },
    teamId
  );

  const applySuggestion = async (s) => {
    try {
      await api.patch(`/tasks/${s.task._id}`, { assignee: s.to._id });
      toast(`Moved "${s.task.title}" to ${s.to.name}`);
      load();
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  if (!data) return error ? <div className="error-box">{error}</div> : <Spinner />;
  const { summary, members, projects, atRiskTasks, suggestions } = data;
  const health = teamHealth(summary, projects);
  const healthLabel = health >= 75 ? 'Healthy' : health >= 50 ? 'Needs attention' : 'At risk';

  const stats = [
    { label: 'Open tasks', value: summary.openTasks, icon: 'board', tint: 'primary' },
    { label: 'Completed', value: summary.completedTasks, icon: 'checkCircle', tint: 'success' },
    { label: 'Overdue', value: summary.overdueTasks, icon: 'clock', tint: summary.overdueTasks ? 'danger' : 'info', alert: summary.overdueTasks > 0 },
    { label: 'Overloaded people', value: summary.overloadedMembers, icon: 'flame', tint: summary.overloadedMembers ? 'danger' : 'success', alert: summary.overloadedMembers > 0 },
    { label: 'Projects at risk', value: summary.projectsAtRisk, icon: 'alert', tint: summary.projectsAtRisk ? 'warn' : 'success', alert: summary.projectsAtRisk > 0 },
    { label: 'Avg team load', value: `${summary.teamLoadPercent}%`, icon: 'gauge', tint: 'info' },
  ];

  return (
    <>
      <section className="hero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="eyebrow">{team.name}</div>
          <h1>{greeting()}, {user.name.split(' ')[0]}</h1>
          <p>
            {summary.overloadedMembers || summary.projectsAtRisk
              ? `${summary.overloadedMembers} teammate(s) overloaded and ${summary.projectsAtRisk} project(s) at risk. Here's where to act first.`
              : 'Everything is on track. Nice work keeping the team balanced!'}
          </p>
        </div>
        <div className="hero-health">
          <Ring value={health} size={72} stroke={8} color="var(--yellow)" sub="health" />
          <div>
            <div className="label">Team health</div>
            <div className="value">{healthLabel}</div>
            <div className="small" style={{ opacity: 0.8 }}>Updated {timeAgo(data.generatedAt)}</div>
          </div>
        </div>
      </section>

      <div className="stats">
        {stats.map((s) => (
          <div key={s.label} className={`card stat ${s.alert ? 'alert' : ''}`}>
            <span className={`stat-icon tint-${s.tint}`}><Icon name={s.icon} size={22} /></span>
            <div>
              <div className="value">{s.value}</div>
              <div className="label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <section className="card">
          <div className="card-title">
            <h2><span className="title-icon"><Icon name="users" size={17} /></span>Team workload</h2>
            <span className="muted small">Line = 100% of weekly capacity</span>
          </div>
          {members.map((m) => (
            <div className="load-row" key={m.user._id}>
              <div className="row">
                <Avatar user={m.user} size="lg" />
                <div className="grow">
                  <div className="truncate" style={{ fontWeight: 650 }}>{m.user.name}</div>
                  <div className="muted small">{m.openTasks} open · {m.remainingHours}h left · {m.weeklyCapacity}h/wk</div>
                </div>
              </div>
              <div className="bar" title={`${m.loadPercent}% of capacity`}>
                <span className={`fill-${m.status}`} style={{ width: `${Math.min(m.loadPercent, 200) / 2}%` }} />
                <i className="cap" style={{ left: '50%' }} />
              </div>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <span className="load-pct">{m.loadPercent}%</span>
                <Badge tone={m.status}>{m.status}</Badge>
              </div>
            </div>
          ))}
          {suggestions.map((s) => (
            <div className="suggestion" key={s.task._id}>
              <span className="title-icon"><Icon name="sparkles" size={17} /></span>
              <div className="grow">
                <div>Move <b>{s.task.title}</b> from {s.from.name} → <b>{s.to.name}</b></div>
                <div className="muted small">{s.reason}</div>
              </div>
              {isManager && <button className="btn primary sm" onClick={() => applySuggestion(s)}>Apply</button>}
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card-title">
            <h2><span className="title-icon"><Icon name="target" size={17} /></span>Project deadline risk</h2>
          </div>
          {projects.length === 0 && <div className="empty"><Icon name="folder" size={32} />No active projects yet.</div>}
          {projects.map((p) => (
            <div key={p.project._id} className="risk-card">
              <Ring
                value={p.riskLevel === 'done' ? 100 : p.riskScore}
                size={62}
                color={RISK_COLOR[p.riskLevel]}
                label={p.riskLevel === 'done' ? '✓' : p.riskScore}
                sub={p.riskLevel === 'done' ? 'done' : 'risk'}
              />
              <div className="grow">
                <div className="row between">
                  <div className="row truncate">
                    <span className="color-dot" style={{ background: p.project.color }} />
                    <b className="truncate">{p.project.name}</b>
                  </div>
                  <Badge tone={p.riskLevel}>{p.riskLevel === 'done' ? 'complete' : p.riskLevel}</Badge>
                </div>
                <div className="progress"><span style={{ width: `${p.completion}%` }} /></div>
                <div className="meter">
                  <span><b>{p.completion}%</b> done</span>
                  <span><Icon name="calendar" size={12} /> {formatDate(p.project.deadline)} ({p.daysLeft > 0 ? `${p.daysLeft}d left` : 'passed'})</span>
                  {p.forecastFinish && <span>Forecast <b>{formatDate(p.forecastFinish)}</b></span>}
                  <span><b>{p.remainingHours}h</b> left</span>
                </div>
                {p.reasons.length > 0 && <ul>{p.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
              </div>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card-title">
            <h2><span className="title-icon tint-danger"><Icon name="alert" size={17} /></span>Needs attention</h2>
            <Badge tone={atRiskTasks.length ? 'danger' : 'success'}>{atRiskTasks.length} tasks</Badge>
          </div>
          {atRiskTasks.length === 0 && <div className="empty"><Icon name="checkCircle" size={32} />Nothing at risk right now 🎉</div>}
          {atRiskTasks.map(({ task, reason }) => {
            const due = relativeDue(task.dueDate);
            return (
              <div className="list-item" key={task._id}>
                <Avatar user={task.assignee} />
                <div className="grow">
                  <div className="truncate" style={{ fontWeight: 600 }}>{task.title}</div>
                  <div className="small muted">{task.project?.name} · <span className={`tone-${due.tone}`}>{due.text}</span></div>
                </div>
                <Badge tone={reason === 'Overdue' ? 'danger' : 'warn'}>{reason}</Badge>
              </div>
            );
          })}
        </section>

        <section className="card">
          <div className="card-title">
            <h2><span className="title-icon tint-success"><Icon name="activity" size={17} /></span>Live activity</h2>
            <span className="muted small">web + mobile</span>
          </div>
          <div className="feed">
            {activity.length === 0 && <div className="empty">No activity yet.</div>}
            {activity.map((a) => (
              <div className="list-item" key={a._id}>
                <Avatar user={a.actor} />
                <div className="grow">
                  <div>{a.message}</div>
                  <div className="small muted row">
                    <span className={`platform ${a.platform}`}>
                      <Icon name={a.platform === 'mobile' ? 'phone' : 'monitor'} size={10} stroke={2.5} />{a.platform}
                    </span>
                    {timeAgo(a.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
