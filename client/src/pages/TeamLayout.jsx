import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { getSocket, useSocketEvents } from '../lib/socket.js';
import { Avatar, Spinner, useToast } from '../components/ui.jsx';
import Icon, { Logo } from '../components/Icon.jsx';
import CallRoom from '../components/CallRoom.jsx';
import MeetingsPanel from '../components/MeetingsPanel.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

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
  const [liveCalls, setLiveCalls] = useState([]); // live video meetings in this team
  const [callProject, setCallProject] = useState(null); // { _id, name } of the call I'm in
  const [meetingsProject, setMeetingsProject] = useState(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // phone-width navigation drawer
  const location = useLocation();
  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);

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

  useEffect(() => {
    api.get(`/teams/${teamId}/calls`).then((r) => setLiveCalls(r.data.calls)).catch(() => {});
  }, [teamId]);

  const putCall = (call) => setLiveCalls((list) => [...list.filter((c) => c.projectId !== call.projectId), call]);
  const joinCall = useCallback((project) => {
    setMeetingsProject(null);
    setCallProject({ _id: project._id ?? project.projectId, name: project.name ?? project.projectName });
  }, []);
  const closeCall = useCallback(() => setCallProject(null), []);
  const openMeetings = useCallback((project) => setMeetingsProject(project), []);

  useSocketEvents(
    {
      'call:started': ({ call }) => {
        if (call.teamId !== teamId) return;
        putCall(call);
        if (call.startedBy?._id !== user._id) toast(`${call.startedBy?.name} started a meeting in ${call.projectName}`, { icon: 'video', tone: 'alert' });
      },
      'call:updated': ({ call }) => call?.teamId === teamId && putCall(call),
      'call:ended': ({ projectId }) => setLiveCalls((list) => list.filter((c) => c.projectId !== projectId)),
      'activity:new': (a) => {
        if (String(a.team) !== teamId || a.actor?._id === user._id) return;
        toast(a.message, { icon: a.platform === 'mobile' ? 'phone' : 'monitor', tone: 'live' });
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
      <aside className={`sidebar ${menuOpen ? 'menu-open' : ''}`}>
        <div className="sidebar-top">
          <Link to="/" className="brand"><Logo size={34} /><span className="brand-word">TeamFlow</span></Link>
          <div className="team-switch">
            <div className="name truncate">{team.name}</div>
            <span className={`live-dot ${live ? 'on' : ''}`}>{live ? 'Live sync on' : 'Connecting…'}</span>
          </div>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Menu">
            <Icon name={menuOpen ? 'x' : 'menu'} size={22} />
          </button>
        </div>
        <nav className="nav">
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
              ...projects.map((p) => ({ to: `board?project=${p._id}`, label: p.name })),
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
          <ThemeToggle />
          <button className="btn ghost sm" onClick={logout} title="Sign out" aria-label="Sign out"><Icon name="logout" size={16} /></button>
        </div>
      </aside>
      <main className="main">
        {liveCalls
          .filter((c) => c.projectId !== callProject?._id)
          .map((c) => (
            <div key={c.projectId} className="live-banner">
              <span className="live-dot-red" />
              <div className="grow">
                <b>Live meeting · {c.projectName}</b>
                <div className="small">Started by {c.startedBy?.name} · {c.participants.length} in the call</div>
              </div>
              <button className="btn primary sm" onClick={() => joinCall(c)}><Icon name="video" size={14} />Join</button>
            </div>
          ))}
        <Outlet context={{ team, projects, myRole, isManager, reloadTeam, reloadProjects, liveCalls, joinCall, openMeetings }} />
      </main>
      {meetingsProject && (
        <MeetingsPanel
          project={meetingsProject}
          teamId={teamId}
          isManager={isManager}
          onJoinCall={joinCall}
          onClose={() => setMeetingsProject(null)}
        />
      )}
      {callProject && (
        <CallRoom projectId={callProject._id} projectName={callProject.name} isManager={isManager} onClose={closeCall} />
      )}
    </div>
  );
}
