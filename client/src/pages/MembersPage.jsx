import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api, errorMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Avatar, Badge, useToast } from '../components/ui.jsx';
import { timeAgo } from '../lib/format.js';
import Icon from '../components/Icon.jsx';

// Single-use invite codes. Every code starts with the same 3 letters from the
// team name (e.g. BIN for "Bindas"); each one lets exactly one person join.
function InvitesCard({ team }) {
  const toast = useToast();
  const [invites, setInvites] = useState(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => api.get(`/teams/${team._id}/invites`).then((r) => setInvites(r.data.invites)).catch((e) => toast(errorMessage(e))),
    [team._id, toast]
  );
  useEffect(() => { load(); }, [load, team.members.length]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post(`/teams/${team._id}/invites`, { label });
      setLabel('');
      await load();
      navigator.clipboard?.writeText(data.invite.code).catch(() => {});
      toast(`New code ${data.invite.code} created and copied`);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (inv) => {
    try {
      await api.delete(`/teams/${team._id}/invites/${inv._id}`);
      load();
    } catch (err) {
      toast(errorMessage(err));
    }
  };

  const unused = invites?.filter((i) => !i.usedBy).length ?? 0;

  return (
    <section className="card full">
      <div className="card-title">
        <h2><span className="title-icon"><Icon name="key" size={17} /></span>Invite codes</h2>
        <Badge tone="primary">{unused} unused</Badge>
      </div>
      <p className="muted small" style={{ marginTop: -6 }}>
        Each code works <b>once</b>. Create one per new member; all of them start with <span className="code" style={{ padding: '1px 6px' }}>{team.invitePrefix}</span>.
        The person enters it under <b>Join with code</b> on the web or in the mobile app.
      </p>
      <form className="row wrap" onSubmit={create} style={{ marginTop: 10 }}>
        <input placeholder="Who is it for? (optional, e.g. Rahul)" maxLength={60} value={label}
          onChange={(e) => setLabel(e.target.value)} style={{ flex: '1 1 220px', width: 'auto' }} />
        <button className="btn primary" disabled={busy}><Icon name="plus" size={16} />{busy ? 'Creating…' : 'New invite code'}</button>
      </form>
      <div className="invite-list">
        {invites && invites.length === 0 && <span className="muted small">No codes yet. Create one for each person you want to add.</span>}
        {invites?.map((inv) => (
          <div key={inv._id} className={`invite-row ${inv.usedBy ? 'used' : ''}`}>
            <span className="code">{inv.code}</span>
            <span className="grow small">
              {inv.label && <b>{inv.label} · </b>}
              {inv.usedBy
                ? <span className="muted">Used by {inv.usedBy.name} {timeAgo(inv.usedAt)}</span>
                : <span className="muted">Created {timeAgo(inv.createdAt)}{inv.createdBy ? ` by ${inv.createdBy.name}` : ''}</span>}
            </span>
            {inv.usedBy ? (
              <Badge tone="success">used</Badge>
            ) : (
              <>
                <Badge tone="info">unused</Badge>
                <button className="btn sm" type="button" onClick={() => navigator.clipboard?.writeText(inv.code).then(() => toast('Copied'))}>Copy</button>
                <button className="btn sm danger" type="button" onClick={() => revoke(inv)}>Revoke</button>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function MembersPage() {
  const { team, myRole, isManager, reloadTeam } = useOutletContext();
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [capacity, setCapacity] = useState(user.weeklyCapacity);

  const act = async (fn, okMsg) => {
    try {
      await fn();
      if (okMsg) toast(okMsg);
      reloadTeam();
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  const saveCapacity = () =>
    act(async () => {
      const { data } = await api.patch('/auth/me', { weeklyCapacity: Number(capacity) });
      setUser(data.user);
    }, 'Weekly capacity updated');

  const exportCsv = async () => {
    try {
      const res = await api.get(`/teams/${team._id}/reports/tasks.csv`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${team.name.replace(/\W+/g, '-').toLowerCase()}-tasks.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  const leave = async () => {
    if (!window.confirm(`Leave ${team.name}? Your open tasks become unassigned.`)) return;
    try {
      await api.delete(`/teams/${team._id}/members/${user._id}`);
      navigate('/');
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  const deleteTeam = async () => {
    if (window.prompt(`Type the team name to permanently delete it and all its projects and tasks:\n${team.name}`) !== team.name) return;
    try {
      await api.delete(`/teams/${team._id}`);
      navigate('/');
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{team.name}</div>
          <h1>Members</h1>
          <p className="muted">{isManager ? 'Give each new member their own one-time invite code.' : 'Ask your owner or a manager for an invite code to add someone.'}</p>
        </div>
        <button className="btn" onClick={exportCsv}><Icon name="download" size={16} />Export tasks CSV</button>
      </div>

      <div className="dash-grid">
        {isManager && <InvitesCard team={team} />}
        <section className="card full">
          <div className="card-title">
            <h2><span className="title-icon tint-success"><Icon name="users" size={17} /></span>Team members</h2>
            <Badge tone="muted">{team.members.length}</Badge>
          </div>
          <div className="table-wrap"><table>
            <thead>
              <tr><th>Member</th><th>Role</th><th>Weekly capacity</th><th /></tr>
            </thead>
            <tbody>
              {team.members.filter((m) => m.user).map((m) => {
                const isMe = m.user._id === user._id;
                return (
                  <tr key={m.user._id}>
                    <td>
                      <div className="row">
                        <Avatar user={m.user} size="lg" />
                        <div>
                          <div style={{ fontWeight: 600 }}>{m.user.name}{isMe && ' (you)'}</div>
                          <div className="muted small">{m.user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {myRole === 'owner' && m.role !== 'owner' ? (
                        <select value={m.role} style={{ width: 'auto' }}
                          onChange={(e) => act(() => api.patch(`/teams/${team._id}/members/${m.user._id}`, { role: e.target.value }), 'Role updated')}>
                          <option value="member">member</option>
                          <option value="manager">manager</option>
                        </select>
                      ) : <Badge tone={m.role === 'owner' ? 'info' : 'muted'}>{m.role}</Badge>}
                    </td>
                    <td>{m.user.weeklyCapacity} h/week</td>
                    <td style={{ textAlign: 'right' }}>
                      {isManager && !isMe && m.role !== 'owner' && (
                        <button className="btn sm danger"
                          onClick={() => window.confirm(`Remove ${m.user.name}?`) && act(() => api.delete(`/teams/${team._id}/members/${m.user._id}`), 'Member removed')}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </section>

        <section className="card">
          <div className="card-title"><h2><span className="title-icon tint-info"><Icon name="clock" size={17} /></span>My availability</h2></div>
          <p className="muted small">How many hours per week you can give this team. The risk dashboard uses this to decide when you are overloaded.</p>
          <div className="row">
            <input type="number" min="1" max="80" value={capacity} onChange={(e) => setCapacity(e.target.value)} style={{ width: 100 }} />
            <span className="muted">hours / week</span>
            <button className="btn primary sm" onClick={saveCapacity}>Save</button>
          </div>
        </section>

        <section className="card">
          <div className="card-title"><h2><span className="title-icon tint-danger"><Icon name="alert" size={17} /></span>Danger zone</h2></div>
          {myRole === 'owner' ? (
            <button className="btn danger" onClick={deleteTeam}>Delete team</button>
          ) : (
            <button className="btn danger" onClick={leave}>Leave team</button>
          )}
        </section>
      </div>
    </>
  );
}
