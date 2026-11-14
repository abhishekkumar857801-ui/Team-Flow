import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api, errorMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Avatar, Badge, useToast } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

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
          <p className="muted">Invite people with the join code: they can enter it on the web or in the mobile app.</p>
        </div>
        <button className="btn" onClick={exportCsv}><Icon name="download" size={16} />Export tasks CSV</button>
      </div>

      <div className="dash-grid">
        <section className="card full">
          <div className="card-title">
            <div className="row">
              <h2><span className="title-icon"><Icon name="key" size={17} /></span>Join code</h2>
              <span className="code">{team.joinCode}</span>
              <button className="btn sm" onClick={() => navigator.clipboard?.writeText(team.joinCode).then(() => toast('Copied'))}>Copy</button>
            </div>
            {isManager && (
              <button className="btn sm" onClick={() => act(() => api.post(`/teams/${team._id}/join-code`), 'New join code generated')}>
                Regenerate
              </button>
            )}
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
