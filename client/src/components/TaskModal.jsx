import { useState } from 'react';
import { api, errorMessage, fileUrl } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { PRIORITIES, STATUSES, fromInputDate, toInputDate } from '../lib/format.js';
import { Modal } from './ui.jsx';

// Create (task = null) or edit an existing task.
// Owners/managers can edit everything. A member can only change the status and
// progress of a task assigned to them, and attach proof photos.
export default function TaskModal({ task, team, projects, defaultProject, isManager, onClose, onSaved }) {
  const { user } = useAuth();
  const isNew = !task;
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    project: task?.project?._id || defaultProject || projects[0]?._id || '',
    assignee: task?.assignee?._id || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    dueDate: toInputDate(task?.dueDate),
    estimateHours: task?.estimateHours ?? 2,
    progress: task?.progress ?? 0,
  });
  const [attachments, setAttachments] = useState(task?.attachments || []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isMine = !isNew && task.assignee?._id === user._id;
  const canEdit = isManager; // every field
  const canUpdate = isManager || isMine; // status, progress, proof
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const payload = canEdit
      ? {
          ...form,
          assignee: form.assignee || null,
          dueDate: fromInputDate(form.dueDate),
          estimateHours: Number(form.estimateHours),
          progress: Number(form.progress),
        }
      : { status: form.status, progress: Number(form.progress) };
    try {
      if (isNew) await api.post(`/teams/${team._id}/tasks`, payload);
      else await api.patch(`/tasks/${task._id}`, payload);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/tasks/${task._id}`);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    try {
      const { data } = await api.post(`/tasks/${task._id}/attachments`, body);
      setAttachments(data.task.attachments);
    } catch (err) {
      setError(errorMessage(err));
    }
    e.target.value = '';
  };

  return (
    <Modal title={isNew ? 'New task' : 'Task details'} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        {error && <div className="error-box">{error}</div>}
        {!canEdit && (
          <div className="info-note">
            {isMine
              ? 'You can update the status and progress of this task and add proof photos. Only the owner or a manager can change anything else.'
              : 'Only the owner, a manager or the assigned member can update this task.'}
          </div>
        )}
        <label className="field">Title
          <input autoFocus required minLength={2} value={form.title} onChange={set('title')} disabled={!canEdit} />
        </label>
        <label className="field">Description
          <textarea value={form.description} onChange={set('description')} disabled={!canEdit} />
        </label>
        <div className="grid-2">
          <label className="field">Project
            <select value={form.project} onChange={set('project')} required disabled={!canEdit}>
              {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </label>
          <label className="field">Assignee
            <select value={form.assignee} onChange={set('assignee')} disabled={!canEdit}>
              <option value="">Unassigned</option>
              {team.members
                .filter((m) => m.user)
                .map((m) => <option key={m.user._id} value={m.user._id}>{m.user.name}</option>)}
            </select>
          </label>
          <label className="field">Status
            <select value={form.status} onChange={set('status')} disabled={!canUpdate}>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          <label className="field">Priority
            <select value={form.priority} onChange={set('priority')} disabled={!canEdit}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="field">Due date
            <input type="date" value={form.dueDate} onChange={set('dueDate')} disabled={!canEdit} />
          </label>
          <label className="field">Estimate (hours)
            <input type="number" min="0.25" max="200" step="0.25" value={form.estimateHours} onChange={set('estimateHours')} disabled={!canEdit} />
          </label>
        </div>
        <label className="field">Progress: {form.progress}%
          <input type="range" min="0" max="100" step="5" value={form.progress} onChange={set('progress')} disabled={!canUpdate} />
        </label>

        {!isNew && (
          <div className="stack" style={{ gap: 6 }}>
            <span className="muted small" style={{ fontWeight: 600 }}>Attachments (photos taken on mobile appear here)</span>
            <div className="attachments">
              {attachments.length === 0 && <span className="muted small">None yet</span>}
              {attachments.map((a) => (
                <a key={a._id} href={fileUrl(a.url)} target="_blank" rel="noreferrer" title={a.name}>
                  {a.mimeType?.startsWith('image/') ? <img src={fileUrl(a.url)} alt={a.name} /> : <span className="badge muted">📄 {a.name}</span>}
                </a>
              ))}
            </div>
            {canUpdate && <input type="file" accept="image/*,application/pdf" onChange={upload} />}
          </div>
        )}

        <div className="row between">
          {!isNew && isManager ? (
            <button type="button" className="btn danger" onClick={remove}>Delete</button>
          ) : <span />}
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            {canUpdate && <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Create task' : 'Save changes'}</button>}
          </div>
        </div>
      </form>
    </Modal>
  );
}
