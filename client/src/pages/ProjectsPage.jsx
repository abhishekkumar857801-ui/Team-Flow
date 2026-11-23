import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api, errorMessage } from '../lib/api.js';
import { formatDate, fromInputDate, relativeDue, toInputDate } from '../lib/format.js';
import { Modal } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';


function ProjectForm({ team, project, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: project?.name || '',
    description: project?.description || '',
    deadline: toInputDate(project?.deadline),
    status: project?.status || 'active',
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
        <button className="btn primary">{project ? 'Save' : 'Create project'}</button>
      </form>
    </Modal>
  );
}

export default function ProjectsPage() {
  const { team, projects, isManager, reloadProjects, openMeetings } = useOutletContext();
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
          <h1>Projects</h1>
          <p className="muted">{team.name} · {projects.length} {projects.length === 1 ? 'project' : 'projects'}</p>
        </div>
        {isManager && <button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} />New project</button>}
      </div>
      {projects.length === 0 ? (
        <div className="empty-panel">
          <Icon name="folder" size={22} />
          <div><b>No projects yet.</b> {isManager ? 'Create your first project.' : 'No projects have been shared with you yet.'}</div>
        </div>
      ) : (
        <div className="tile-grid">
          {projects.map((p) => {
            const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
            const due = relativeDue(p.deadline);
            return (
              <div key={p._id} className="card project-card">
                <div className="project-field">
                  <h2>{p.name}</h2>
                  <span className="project-status">{p.status.replace('_', ' ')}</span>
                </div>
                <div className="stack" style={{ padding: 16, gap: 12 }}>
                <p className="muted small" style={{ margin: 0 }}>{p.description || 'No description yet.'}</p>
                <div>
                  <div className="row between small"><span><span className="mono">{p.doneCount}/{p.taskCount}</span> tickets done</span><span className="mono strong">{pct}%</span></div>
                  <div className="progress"><span style={{ width: `${pct}%` }} /></div>
                </div>
                <div className="small row"><Icon name="calendar" size={14} /><span className="mono">{formatDate(p.deadline)}</span> · <span className={`tone-${due.tone}`}>{due.text}</span></div>
                <div className="row wrap">
                  <button className="btn sm" onClick={() => navigate(`../board?project=${p._id}`)}><Icon name="board" size={14} />Open board</button>
                  <button className="btn sm" onClick={() => navigate(`../board?project=${p._id}&chat=1`)}><Icon name="chat" size={14} />Chat</button>
                  <button className="btn sm" onClick={() => openMeetings(p)}><Icon name="video" size={14} />Meet</button>
                </div>
                {isManager && (
                  <div className="row wrap">
                    <button className="btn sm" onClick={() => setEditing(p)}>Edit</button>
                    <button className="btn sm danger" onClick={() => remove(p)}>Delete</button>
                  </div>
                )}
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
