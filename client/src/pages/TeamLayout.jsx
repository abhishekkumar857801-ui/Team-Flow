import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { getSocket, useSocketEvents } from '../lib/socket.js';
import { Avatar, Spinner, useToast } from '../components/ui.jsx';
import Icon, { Logo } from '../components/Icon.jsx';

// Collapsible sidebar section (like a dropdown menu): the parent toggles, the
// children are links. It opens automatically when one of its pages is active.
function NavGroup({ icon, label, isActive, items, emptyText }) {
  const location = useLocation();
  const here = location.pathname.split('/').pop() + location.search;
  const inSection = isActive(location.pathname.split('/').pop(), new URLSearchParams(location.search));
  const [open, setOpen] = useState(inSection);
  useEffect(() => { if (inSection) setOpen(true); }, [inSection]);

  return (
    <div className={`nav-group ${open ? 'open' : ''}`}>
      <button type="button" className={`nav-parent ${inSection ? 'active' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name={icon} />{label}<Icon name="chevronDown" size={16} className="chev" />
      </button>
      {open && (
        <div className="nav-sub">
          {items.length === 0 && <span className="empty-sub">{emptyText}</span>}
          {items.map((item) => (
            <Link key={item.to} to={item.to} className={here === item.to ? 'active' : ''}>
              {item.color && <span className="color-dot" style={{ background: item.color }} />}
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamLayout() {
  const { teamId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [team, setTeam] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);

  const reloadTeam = useCallback(
    () => api.get(`/teams/${teamId}`).then((r) => setTeam(r.data.team)).catch((e) => setError(errorMessage(e))),
    [teamId]
  );
  const reloadProjects = useCallback(
    () => api.get(`/teams/${teamId}/projects`).then((r) => setProjects(r.data.projects)).catch(() => {}),
    [teamId]
  );

  useEffect(() => {
    setTeam(null);
    reloadTeam();
    reloadProjects();
  }, [reloadTeam, reloadProjects]);

  useEffect(() => {
    const s = getSocket();
    if (!s) return undefined;
    const on = () => setLive(true);
    const off = () => setLive(false);
    setLive(s.connected);
    s.on('connect', on);
    s.on('disconnect', off);
    return () => {
      s.off('connect', on);
      s.off('disconnect', off);
    };
  }, []);

  useSocketEvents(
    {
      'activity:new': (a) => {
        if (String(a.team) !== teamId || a.actor?._id === user._id) return;
        toast(`${a.platform === 'mobile' ? '📱 From mobile' : '💻 From web'} · ${a.message}`);
      },
      'team:updated': (p) => String(p.teamId) === teamId && reloadTeam(),
      'team:deleted': (p) => String(p.teamId) === teamId && navigate('/'),
      'project:changed': (p) => String(p.teamId) === teamId && reloadProjects(),
      'task:created': reloadProjects,
      'task:updated': reloadProjects,
      'task:deleted': reloadProjects,
    },
    teamId
  );

  if (error) {
    return (
      <div className="main">
        <div className="error-box">{error}</div>
        <p><Link to="/">Back to teams</Link></p>
      </div>
    );
  }
  if (!team) return <Spinner />;

  const myRole = team.myRole;
  const isManager = myRole === 'owner' || myRole === 'manager';

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand"><Logo size={34} />TeamFlow</Link>
        <div className="team-switch">
          <div className="nav-label" style={{ padding: 0 }}>Current team</div>
          <div className="name truncate">{team.name}</div>
          <span className={`live-dot ${live ? 'on' : ''}`}>{live ? 'Live sync on' : 'Connecting…'}</span>
        </div>
        <nav className="nav">
          <div className="nav-label">Workspace</div>
          <NavLink to="dashboard"><Icon name="gauge" />Risk dashboard</NavLink>
          <NavGroup
            icon="board"
            label="Task board"
            isActive={(page, q) => page === 'board' && !q.get('project')}
            items={[
              { to: 'board', label: 'All tasks' },
              { to: 'board?assignee=me', label: 'My tasks' },
              { to: 'board?view=overdue', label: 'Overdue' },
              { to: 'board?view=done', label: 'Completed' },
            ]}
          />
          <NavGroup
            icon="folder"
            label="Projects"
            isActive={(page, q) => page === 'projects' || (page === 'board' && !!q.get('project'))}
            emptyText="No projects yet"
            items={[
              { to: 'projects', label: 'All projects' },
              ...projects.map((p) => ({ to: `board?project=${p._id}`, label: p.name, color: p.color })),
            ]}
          />
          <NavLink to="members"><Icon name="users" />Members</NavLink>
        </nav>
        <div className="sidebar-user">
          <Avatar user={user} />
          <div className="grow">
            <div className="name truncate">{user.name}</div>
            <div className="small" style={{ opacity: 0.7, textTransform: 'capitalize' }}>{myRole}</div>
          </div>
          <button className="btn ghost sm" onClick={logout} title="Sign out" aria-label="Sign out"><Icon name="logout" size={16} /></button>
        </div>
      </aside>
      <main className="main">
        <Outlet context={{ team, projects, myRole, isManager, reloadTeam, reloadProjects }} />
      </main>
    </div>
  );
}
