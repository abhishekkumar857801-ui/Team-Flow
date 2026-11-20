import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api, errorMessage } from '../lib/api.js';
import { formatDate, fromInputDate, relativeDue, toInputDate } from '../lib/format.js';
import { Badge, Modal } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const STATUS_TONE = { planning: 'muted', active: 'info', on_hold: 'warn', completed: 'success' };

function ProjectForm({ team, project, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: project?.name || '',
    description: project?.description || '',
    deadline: toInputDate(project?.deadline),
    status: project?.status || 'active',
    color: project?.color || COLORS[0],
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const payload = { ...form, deadline: fromInputDate(form.deadline) };
    try {
      if (project) await api.patch(`/projects/${project._id}`, payload);
      else await api.post(`/teams/${team._id}/projects`, payload);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal title={project ? 'Edit project' : 'New project'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        {error && <div className="error-box">{error}</div>}
        <label className="field">Name<input autoFocus required minLength={2} value={form.name} onChange={set('name')} /></label>
        <label className="field">Description<textarea value={form.description} onChange={set('description')} /></label>
        <div className="grid-2">
          <label className="field">Deadline<input type="date" required value={form.deadline} onChange={set('deadline')} /></label>
          <label className="field">Status
            <select value={form.status} onChange={set('status')}>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>
        <div className="row">
          {COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setForm({ ...form, color: c })} aria-label={`Color ${c}`}
              style={{ width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
                border: form.color === c ? '3px solid var(--text)' : '2px solid transparent' }} />
          ))}
        </div>
        <button className="btn primary">{project ? 'Save' : 'Create project'}</button>
      </form>
    </Modal>
  );
}

export default function ProjectsPage() {
  const { team, projects, isManager, reloadProjects } = useOutletContext();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(null);

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}" and all ${p.taskCount} of its tasks? This cannot be undone.`)) return;
    try {
      await api.delete(`/projects/${p._id}`);
      reloadProjects();
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{team.name}</div>
          <h1>Projects</h1>
          <p className="muted">{projects.length} project(s) in {team.name}</p>
        </div>
        {isManager && <button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} />New project</button>}
      </div>
      {projects.length === 0 ? (
        <div className="card empty">No projects yet.{isManager ? ' Create the first one.' : ' Ask a manager to create one.'}</div>
      ) : (
        <div className="tile-grid">
          {projects.map((p) => {
            const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
            const due = relativeDue(p.deadline);
            return (
              <div key={p._id} className="card stack project-card">
                <span className="stripe" style={{ background: p.color }} />
                <div className="row between">
                  <h2>{p.name}</h2>
                  <Badge tone={STATUS_TONE[p.status]}>{p.status.replace('_', ' ')}</Badge>
                </div>
                <p className="muted small" style={{ margin: 0 }}>{p.description || 'No description'}</p>
                <div>
                  <div className="row between small"><span>{p.doneCount}/{p.taskCount} tasks</span><b>{pct}%</b></div>
                  <div className="progress"><span style={{ width: `${pct}%`, background: p.color }} /></div>
                </div>
                <div className="small row"><Icon name="calendar" size={14} />{formatDate(p.deadline)} · <span className={`tone-${due.tone}`}>{due.text}</span></div>
                <div className="row">
                  <button className="btn sm" onClick={() => navigate(`../board?project=${p._id}`)}><Icon name="board" size={14} />Open board</button>
                  <button className="btn sm" onClick={() => navigate(`../board?project=${p._id}&chat=1`)}><Icon name="chat" size={14} />Chat</button>
                  {isManager && <button className="btn sm" onClick={() => setEditing(p)}>Edit</button>}
                  {isManager && <button className="btn sm danger" onClick={() => remove(p)}>Delete</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && (
        <ProjectForm
          team={team}
          project={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reloadProjects(); }}
        />
      )}
    </>
  );
}
