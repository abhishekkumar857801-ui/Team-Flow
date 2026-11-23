import { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useSocketEvents } from '../lib/socket.js';
import { STATUSES } from '../lib/format.js';
import { Badge, Spinner, useToast } from '../components/ui.jsx';
import TaskModal from '../components/TaskModal.jsx';
import ProjectChat from '../components/ProjectChat.jsx';
import Ticket from '../components/Ticket.jsx';
import Icon from '../components/Icon.jsx';

const isOverdue = (t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date();


export default function BoardPage() {
  const { teamId } = useParams();
  const { team, projects, isManager, liveCalls, openMeetings } = useOutletContext();
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const projectId = params.get('project') || '';
  const assignee = params.get('assignee') || '';
  const view = params.get('view') || ''; // '', 'overdue' or 'done' (from the sidebar)
  const [tasks, setTasks] = useState(null);
  const [editing, setEditing] = useState(null); // task | 'new'
  const newParam = params.get('new') === '1';
  const [dragId, setDragId] = useState(null);
  const [dropCol, setDropCol] = useState(null);
  const [chatOpen, setChatOpen] = useState(params.get('chat') === '1');
  const meetParam = params.get('meet') === '1';
  const currentProject = projects.find((p) => p._id === projectId);
  // Opened from the dashboard's "New task" button.
  useEffect(() => {
    if (newParam && isManager && projects.length) {
      setEditing('new');
      setFilter('new', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newParam, projects.length]);
  // Opened from a project card's "Meet" button: show the meetings panel once.
  useEffect(() => {
    if (meetParam && currentProject) {
      openMeetings(currentProject);
      setFilter('meet', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetParam, currentProject?._id]);

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
          <h1>{currentProject ? currentProject.name : 'Task board'}</h1>
          <p className="muted">{team.name} · Open a ticket to update its status.</p>
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
          {currentProject && (
            <button className="btn" onClick={() => setChatOpen(true)} title={`Chat about ${currentProject.name}`}>
              <Icon name="chat" size={16} />Chat
            </button>
          )}
          {currentProject && (
            <button className="btn" onClick={() => openMeetings(currentProject)} title={`Meetings for ${currentProject.name}`}>
              {liveCalls.some((c) => c.projectId === currentProject._id) ? <span className="live-dot-red" /> : <Icon name="video" size={16} />}
              Meetings
            </button>
          )}
          {isManager && (
            <button className="btn primary" onClick={() => setEditing('new')} disabled={!projects.length}
              title={projects.length ? '' : 'Create a project first'}><Icon name="plus" size={16} />New task</button>
          )}
        </div>
      </div>

      {!projects.length && (
        <div className="card empty">
          {isManager ? 'Create a project first.' : 'No projects yet.'}
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
              className={`column col-${col.key} ${dropCol === col.key ? 'drop' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDropCol(col.key); }}
              onDragLeave={() => setDropCol(null)}
              onDrop={(e) => { e.preventDefault(); setDropCol(null); moveTo(e.dataTransfer.getData('text/plain'), col.key); }}
            >
              <div className="column-head">
                <span>{col.label}</span>
                <span className="mono count">{items.length}</span>
              </div>
              {items.length === 0 && <div className="empty small" style={{ padding: 24 }}>No tasks in this stage</div>}
              {items.map((t) => {
                const canDrag = isManager || t.assignee?._id === user._id;
                return (
                  <Ticket
                    key={t._id}
                    task={t}
                    dragging={dragId === t._id}
                    showProject={!projectId}
                    onClick={() => setEditing(t)}
                    dragProps={{
                      draggable: canDrag,
                      onDragStart: (e) => { e.dataTransfer.setData('text/plain', t._id); setDragId(t._id); },
                      onDragEnd: () => setDragId(null),
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {chatOpen && currentProject && (
        <ProjectChat project={currentProject} teamId={teamId} isManager={isManager} onClose={() => { setChatOpen(false); setFilter('chat', ''); }} />
      )}
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
