import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Avatar, Badge, Modal, Spinner } from '../components/ui.jsx';
import Icon, { Logo } from '../components/Icon.jsx';

// Bright, solid banner colours.
const BANNERS = ['#2563eb', '#ec4899', '#f97316', '#16a34a', '#8b5cf6'];

export default function TeamsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState(null);
  const [dialog, setDialog] = useState(null); // 'create' | 'join'
  const [form, setForm] = useState({ name: '', description: '', joinCode: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/teams').then((r) => setTeams(r.data.teams)).catch((e) => setError(errorMessage(e)));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } =
        dialog === 'create'
          ? await api.post('/teams', { name: form.name, description: form.description })
          : await api.post('/teams/join', { joinCode: form.joinCode });
      navigate(`/teams/${data.team._id}/dashboard`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="main" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-head">
        <div className="brand"><Logo />TeamFlow</div>
        <div className="row">
          <Avatar user={user} />
          <span className="muted">{user.name}</span>
          <button className="btn sm" onClick={logout}>Sign out</button>
        </div>
      </div>

      <div className="page-head">
        <div>
          <div className="eyebrow">Welcome, {user.name.split(' ')[0]}</div>
          <h1>Your teams</h1>
          <p className="muted">Pick a team to open its workspace, or start a new one.</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setDialog('join')}><Icon name="key" size={16} />Join with code</button>
          <button className="btn primary" onClick={() => setDialog('create')}><Icon name="plus" size={16} />New team</button>
        </div>
      </div>

      {!teams ? (
        error ? <div className="error-box">{error}</div> : <Spinner />
      ) : teams.length === 0 ? (
        <div className="card empty"><Icon name="users" size={36} /><h2>No teams yet</h2>Create one, or ask a teammate for their 6-character join code.</div>
      ) : (
        <div className="tile-grid">
          {teams.map((t, i) => (
            <div key={t._id} className="card tile" onClick={() => navigate(`/teams/${t._id}/dashboard`)}>
              <div className="tile-banner" style={{ background: BANNERS[i % BANNERS.length] }}>
                <span className="team-initial">{t.name[0]?.toUpperCase()}</span>
              </div>
              <div className="row between">
                <h2 className="truncate">{t.name}</h2>
                <Badge tone="primary">{t.myRole}</Badge>
              </div>
              <p className="muted small" style={{ minHeight: 36 }}>{t.description || 'No description'}</p>
              <div className="row between" style={{ marginTop: 12 }}>
                <div className="row">
                  <div className="avatar-stack">{t.members.slice(0, 5).map((m) => <Avatar key={m.user?._id} user={m.user} />)}</div>
                  <span className="muted small">{t.members.length} member(s)</span>
                </div>
                <span className="row small" style={{ color: 'var(--primary)', fontWeight: 600 }}>Open <Icon name="arrowRight" size={14} /></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialog && (
        <Modal
          title={dialog === 'create' ? 'Create a team' : 'Join a team'}
          onClose={() => { setDialog(null); setError(''); }}
        >
          <form className="stack" onSubmit={submit}>
            {error && <div className="error-box">{error}</div>}
            {dialog === 'create' ? (
              <>
                <label className="field">Team name
                  <input autoFocus required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </label>
                <label className="field">Description
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </label>
              </>
            ) : (
              <label className="field">Invite code (6 characters, works once)
                <input autoFocus required maxLength={6} placeholder="e.g. BIN7K2" value={form.joinCode}
                  onChange={(e) => setForm({ ...form, joinCode: e.target.value.toUpperCase() })} />
              </label>
            )}
            <button className="btn primary">{dialog === 'create' ? 'Create team' : 'Join team'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
