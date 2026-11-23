import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useSocketEvents } from '../lib/socket.js';
import { formatDate, timeAgo } from '../lib/format.js';
import { Avatar, Spinner, useToast } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import Ticket from '../components/Ticket.jsx';

function useDebounced(fn, ms) {
  const t = useRef();
  return useCallback(() => {
    clearTimeout(t.current);
    t.current = setTimeout(fn, ms);
  }, [fn, ms]);
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
  const now = new Date();
  const weekday = now.toLocaleDateString([], { weekday: 'long' });
  const today = now.toLocaleDateString([], { day: 'numeric', month: 'short' });
  const metrics = [
    { label: 'Open tasks', value: summary.openTasks, icon: 'board' },
    { label: 'Overdue tasks', value: summary.overdueTasks, icon: 'clock', alert: summary.overdueTasks > 0 },
    { label: 'Projects at risk', value: summary.projectsAtRisk, icon: 'alert', alert: summary.projectsAtRisk > 0 },
    { label: 'People over capacity', value: summary.overloadedMembers, icon: 'users', alert: summary.overloadedMembers > 0 },
  ];
  const byLoad = [...members].sort((a, b) => b.loadPercent - a.loadPercent);
  const byRisk = [...projects].sort((a, b) => (b.riskLevel === 'done' ? -1 : b.riskScore) - (a.riskLevel === 'done' ? -1 : a.riskScore));

  return (
    <>
      <header className="page-head dashboard-head">
        <div>
          <div className="dashboard-date"><Icon name="calendar" size={16} />{weekday}, {today}</div>
          <h1>{greeting()}, {user.name.split(' ')[0]}</h1>
          <p>{team.name}</p>
        </div>
        <div className="row wrap dashboard-actions">
          <Link className="btn" to="../board"><Icon name="board" size={16} />Open board</Link>
          {isManager && <Link className="btn primary" to="../board?new=1"><Icon name="plus" size={16} />New task</Link>}
        </div>
      </header>

      <dl className="dashboard-metrics" aria-label="Team overview">
        {metrics.map(({ label, value, icon, alert }) => (
          <div key={label} className={`dashboard-metric ${alert ? 'has-alert' : ''}`}>
            <dt><Icon name={icon} size={18} />{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="section">
        <div className="section-head">
          <h2>Needs attention</h2>
          {atRiskTasks.length > 3 && (
            <Link className="small strong" to="../board">+{atRiskTasks.length - 3} more on the board</Link>
          )}
        </div>
        {atRiskTasks.length === 0 ? (
          <div className="empty-panel">
            <Icon name="checkCircle" size={22} />
            <div><b>No tasks need attention.</b><br /><span className="muted">Overdue, urgent, and overloaded tasks appear here.</span></div>
          </div>
        ) : (
          <div className="ticket-grid">
            {atRiskTasks.slice(0, 3).map(({ task, reason }) => (
              <Ticket key={task._id} task={task} reason={reason} />
            ))}
          </div>
        )}
      </section>

      <div className="dash-grid">
        <section className="panel">
          <div className="section-head">
            <h2>Who has room this week</h2>
            <span className="muted small">Mark = 100% of weekly hours</span>
          </div>
          {byLoad.length === 0 && <p className="muted">No members yet.</p>}
          {byLoad.map((m) => (
            <div className="load-row" key={m.user._id}>
              <div className="row" style={{ minWidth: 0 }}>
                <Avatar user={m.user} />
                <div className="grow">
                  <div className="truncate strong">{m.user.name}</div>
                  <div className="muted small">{m.openTasks} open · <span className="mono">{m.remainingHours}h</span> left of <span className="mono">{m.weeklyCapacity}h</span></div>
                </div>
              </div>
              <div className={`capacity is-${m.status}`} role="img" aria-label={`${m.loadPercent}% of weekly capacity`}>
                <span className="fill" style={{ width: `${(Math.min(m.loadPercent, 100) / 150) * 100}%` }} />
                {m.loadPercent > 100 && (
                  <span className="over" style={{ left: `${(100 / 150) * 100}%`, width: `${((Math.min(m.loadPercent, 150) - 100) / 150) * 100}%` }} />
                )}
                <i className="mark" />
              </div>
              <span className={`load-pct is-${m.status}`}>{m.loadPercent}%</span>
            </div>
          ))}
          {suggestions.map((s) => (
            <div className="suggestion" key={s.task._id}>
              <Icon name="arrowRight" size={16} />
              <div className="grow">
                <div>Move <b>{s.task.title}</b> from {s.from.name} to <b>{s.to.name}</b></div>
                <div className="muted small">{s.reason}</div>
              </div>
              {isManager && <button className="btn sm primary" onClick={() => applySuggestion(s)}>Move it</button>}
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="section-head"><h2>Project deadlines</h2></div>
          {byRisk.length === 0 && <p className="muted">No active projects.</p>}
          {byRisk.map((p) => {
            const done = p.riskLevel === 'done';
            return (
              <div key={p.project._id} className={`risk-row is-${p.riskLevel}`}>
                <span className="risk-score">{done ? '—' : p.riskScore}</span>
                <div className="grow">
                  <div className="row between">
                    <b className="row truncate" style={{ gap: 8 }}>
                      {p.project.name}
                    </b>
                    <span className={`level is-${p.riskLevel}`}>{done ? 'complete' : p.riskLevel}</span>
                  </div>
                  <div className="meter">
                    <span><span className="mono">{p.completion}%</span> done</span>
                    <span>due <span className="mono">{formatDate(p.project.deadline)}</span>{p.daysLeft > 0 ? ` · ${p.daysLeft}d left` : ' · passed'}</span>
                    {p.forecastFinish && <span>forecast <span className="mono">{formatDate(p.forecastFinish)}</span></span>}
                    <span><span className="mono">{p.remainingHours}h</span> of work left</span>
                  </div>
                  {p.reasons.length > 0 && <ul className="reasons">{p.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
                </div>
              </div>
            );
          })}
        </section>

        <section className="panel full">
          <div className="section-head">
            <h2>Recent activity</h2>
          </div>
          <div className="feed">
            {activity.length === 0 && <p className="muted">No activity yet.</p>}
            {activity.map((a) => (
              <div className="feed-item" key={a._id}>
                <Avatar user={a.actor} />
                <div className="grow">{a.message}</div>
                <span className={`device is-${a.platform}`}>
                  <Icon name={a.platform === 'mobile' ? 'phone' : 'monitor'} size={13} />
                  {a.platform === 'mobile' ? 'Phone' : a.platform === 'web' ? 'Web' : 'API'}
                </span>
                <span className="muted small mono when">{timeAgo(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
