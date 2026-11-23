import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { errorMessage } from '../lib/api.js';
import Icon, { Logo } from '../components/Icon.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';


export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="brand"><Logo />TeamFlow</div>
        <div>
          <h1>Plan, assign and track your team's work.</h1>
          <p className="lead">Tasks, deadlines and workload in one place, on the web and on your phone.</p>
        </div>
        <ul className="auth-points">
          <li><Icon name="board" size={18} /><span>Task board</span></li>
          <li><Icon name="gauge" size={18} /><span>Workload and deadline risk</span></li>
          <li><Icon name="video" size={18} /><span>Team chat and video meetings</span></li>
        </ul>
      </section>

      <section className="auth-side">
        <div className="auth-theme"><ThemeToggle className="btn sm" /></div>
        <form className="card auth-card stack" onSubmit={submit}>
          <div>
            <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
            <p className="muted">
              {isLogin ? 'Sign in to your account.' : 'Get started with TeamFlow.'}
            </p>
          </div>
          {error && <div className="error-box"><Icon name="alert" size={16} />{error}</div>}
          {!isLogin && (
            <label className="field">Full name
              <input value={form.name} onChange={set('name')} required minLength={2} autoComplete="name" placeholder="Your name" />
            </label>
          )}
          <label className="field">Email
            <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" placeholder="you@example.com" />
          </label>
          <label className="field">Password
            <input type="password" value={form.password} onChange={set('password')} required minLength={isLogin ? 1 : 6}
              autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder="••••••••" />
          </label>
          <button className="btn primary" disabled={busy} style={{ padding: '12px 16px' }}>
            {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'} {!busy && <Icon name="arrowRight" size={16} />}
          </button>
          <p className="muted small" style={{ textAlign: 'center', margin: 0 }}>
            {isLogin ? <>New here? <Link to="/register">Create an account</Link></> : <>Have an account? <Link to="/login">Sign in</Link></>}
          </p>
        </form>
      </section>
    </div>
  );
}
