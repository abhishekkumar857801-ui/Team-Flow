import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api, errorMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Avatar, Badge, useToast } from '../components/ui.jsx';
import { timeAgo } from '../lib/format.js';
import Icon from '../components/Icon.jsx';

// LAN HTTP can lack navigator.clipboard. Keep the fallback inside the click
// handler so browsers can associate it with the user's copy action.
function copyFromSelection(code) {
  const previousFocus = document.activeElement;
  const field = document.createElement('textarea');
  field.value = code;
  field.readOnly = true;
  field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(field);
  try {
    field.select();
    field.setSelectionRange(0, code.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}

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

  const copyCode = async (code) => {
    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(code);
        copied = true;
      } catch {
        // Try the selection-based copy when clipboard permission is denied.
      }
    }
    if (!copied) copied = copyFromSelection(code);
    toast(copied ? 'Invite code copied' : 'Clipboard access was blocked. Try Copy code again or check browser permissions.',
      copied ? { icon: 'checkCircle' } : { icon: 'alert' });
  };

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post(`/teams/${team._id}/invites`, { label });
      setLabel('');
      await copyCode(data.invite.code);
      await load();
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
        {invites && invites.length === 0 && <span className="muted small">No invite codes yet.</span>}
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
                <button className="btn sm" type="button" onClick={() => copyCode(inv.code)}>Copy code</button>
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

  const [photoBusy, setPhotoBusy] = useState(false);
  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('That photo is larger than 5 MB. Choose a smaller one.');
    setPhotoBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const { data } = await api.post('/auth/me/avatar', body);
      setUser(data.user);
      toast('Profile photo updated');
      reloadTeam();
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setPhotoBusy(false);
    }
  };
  const removePhoto = () =>
    act(async () => {
      const { data } = await api.delete('/auth/me/avatar');
      setUser(data.user);
    }, 'Profile photo removed');

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
          <h1>Members</h1>
          <p className="muted">{team.name} · {isManager ? 'Manage members and invite codes.' : 'People in this team.'}</p>
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
          <div className="card-title"><h2>Your profile</h2></div>
          <div className="profile-photo">
            <Avatar user={user} size="xl" />
            <div className="stack" style={{ gap: 8 }}>
              <div><b>{user.name}</b><div className="muted small">{user.email}</div></div>
              <div className="row wrap">
                <label className="btn sm">
                  <Icon name="camera" size={15} />{photoBusy ? 'Uploading…' : user.avatarUrl ? 'Change photo' : 'Add photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden disabled={photoBusy} onChange={uploadPhoto} />
                </label>
                {user.avatarUrl && <button className="btn sm ghost" onClick={removePhoto} disabled={photoBusy}>Remove</button>}
              </div>
              <span className="muted small">JPG, PNG or WEBP, up to 5 MB.</span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-title"><h2><span className="title-icon tint-info"><Icon name="clock" size={17} /></span>My availability</h2></div>
          <p className="muted small">Hours per week you can work on this team.</p>
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
