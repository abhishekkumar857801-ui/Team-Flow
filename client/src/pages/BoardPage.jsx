import { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useSocketEvents } from '../lib/socket.js';
import { STATUSES, relativeDue } from '../lib/format.js';
import { Avatar, Badge, Spinner, useToast } from '../components/ui.jsx';
import TaskModal from '../components/TaskModal.jsx';
import Icon from '../components/Icon.jsx';

const isOverdue = (t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date();

const COLUMN_COLOR = { todo: '#94a3b8', in_progress: '#2563eb', review: '#f97316', done: '#16a34a' };

export default function BoardPage() {
  const { teamId } = useParams();
  const { team, projects, isManager } = useOutletContext();
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const projectId = params.get('project') || '';
  const assignee = params.get('assignee') || '';
  const view = params.get('view') || ''; // '', 'overdue' or 'done' (from the sidebar)
  const [tasks, setTasks] = useState(null);
  const [editing, setEditing] = useState(null); // task | 'new'
  const [dragId, setDragId] = useState(null);
  const [dropCol, setDropCol] = useState(null);

  const load = useCallback(() => {
    const q = {};
    if (projectId) q.project = projectId;
    if (assignee) q.assignee = assignee;
    return api.get(`/teams/${teamId}/tasks`, { params: q }).then((r) => setTasks(r.data.tasks));
  }, [teamId, projectId, assignee]);

  useEffect(() => {
    load().catch((e) => toast(errorMessage(e)));
  }, [load, toast]);

  // Live updates: merge pushed tasks instead of refetching everything.
  const matches = (t) =>
    (!projectId || t.project?._id === projectId) &&
    (!assignee || (assignee === 'me' ? t.assignee?._id === user._id : assignee === 'none' ? !t.assignee : t.assignee?._id === assignee));
  const upsert = (t) =>
    setTasks((list) => {
      if (!list) return list;
      const rest = list.filter((x) => x._id !== t._id);
      return matches(t) ? [...rest, t] : rest;
    });
  useSocketEvents(
    {
      'task:created': upsert,
      'task:updated': upsert,
      'task:deleted': (t) => setTasks((list) => list?.filter((x) => x._id !== String(t._id))),
      'tasks:refresh': () => load(),
    },
    teamId
  );

  const setFilter = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const moveTo = async (taskId, status) => {
    const task = tasks.find((t) => t._id === taskId);
    if (!task || task.status === status) return;
    const prev = tasks;
    setTasks(tasks.map((t) => (t._id === taskId ? { ...t, status } : t))); // optimistic
    try {
      const { data } = await api.patch(`/tasks/${taskId}`, { status });
      upsert(data.task);
    } catch (e) {
      setTasks(prev);
      toast(errorMessage(e));
    }
  };

  if (!tasks) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{team.name}</div>
          <h1>Task board</h1>
          <p className="muted">Drag cards between columns. Changes sync to every phone and browser instantly.</p>
        </div>
        <div className="toolbar">
          <select value={projectId} onChange={(e) => setFilter('project', e.target.value)} style={{ width: 'auto' }}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <select value={assignee} onChange={(e) => setFilter('assignee', e.target.value)} style={{ width: 'auto' }}>
            <option value="">Everyone</option>
            <option value="me">My tasks</option>
            <option value="none">Unassigned</option>
            {team.members.filter((m) => m.user).map((m) => <option key={m.user._id} value={m.user._id}>{m.user.name}</option>)}
          </select>
          {isManager && (
            <button className="btn primary" onClick={() => setEditing('new')} disabled={!projects.length}
              title={projects.length ? '' : 'Create a project first'}><Icon name="plus" size={16} />New task</button>
          )}
        </div>
      </div>

      {!projects.length && (
        <div className="card empty">
          {isManager ? 'Create a project first, then add tasks to it.' : 'No projects yet. Your owner or manager will add them.'}
        </div>
      )}
      {view && (
        <div className="row" style={{ marginBottom: 14 }}>
          <Badge tone="primary">{view === 'overdue' ? 'Showing overdue tasks' : 'Showing completed tasks'}</Badge>
          <button className="btn sm ghost" onClick={() => setFilter('view', '')}>Show all</button>
        </div>
      )}

      <div className="board">
        {STATUSES.map((col) => {
          const items = tasks
            .filter((t) => t.status === col.key)
            .filter((t) => (view === 'done' ? t.status === 'done' : view === 'overdue' ? isOverdue(t) : true))
            .sort((a, b) => new Date(a.dueDate || 8.64e15) - new Date(b.dueDate || 8.64e15));
          return (
            <div
              key={col.key}
              className={`column ${dropCol === col.key ? 'drop' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDropCol(col.key); }}
              onDragLeave={() => setDropCol(null)}
              onDrop={(e) => { e.preventDefault(); setDropCol(null); moveTo(e.dataTransfer.getData('text/plain'), col.key); }}
            >
              <div className="column-head">
                <span className="row"><span className="dot" style={{ background: COLUMN_COLOR[col.key] }} />{col.label}</span>
                <Badge tone="muted">{items.length}</Badge>
              </div>
              {items.length === 0 && <div className="empty small" style={{ padding: 24 }}>Drop tasks here</div>}
              {items.map((t) => {
                const due = relativeDue(t.dueDate);
                return (
                  <div
                    key={t._id}
                    className={`task-card ${dragId === t._id ? 'dragging' : ''}`}
                    style={{ '--accent': t.project?.color }}
                    draggable={isManager || t.assignee?._id === user._id}
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', t._id); setDragId(t._id); }}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => setEditing(t)}
                  >
                    <div className="row between">
                      <span className="row small muted truncate"><span className="color-dot" style={{ background: t.project?.color }} />{t.project?.name}</span>
                      <Badge tone={t.priority}>{t.priority}</Badge>
                    </div>
                    <div className="title">{t.title}</div>
                    <div className="task-meta">
                      <span className={`row tone-${t.status === 'done' ? 'muted' : due.tone}`} style={{ gap: 4 }}>
                        <Icon name={t.status === 'done' ? 'checkCircle' : 'calendar'} size={13} />
                        {t.status === 'done' ? 'Completed' : due.text}
                      </span>
                      <span className="chips">
                        {t.attachments?.length > 0 && <span><Icon name="paperclip" size={12} />{t.attachments.length}</span>}
                        <span><Icon name="clock" size={12} />{t.estimateHours}h</span>
                        <Avatar user={t.assignee} />
                      </span>
                    </div>
                    {t.progress > 0 && t.status !== 'done' && <div className="progress"><span style={{ width: `${t.progress}%` }} /></div>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {editing && (
        <TaskModal
          task={editing === 'new' ? null : editing}
          team={team}
          projects={projects}
          defaultProject={projectId}
          isManager={isManager}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}
