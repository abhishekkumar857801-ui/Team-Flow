import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { errorMessage } from '../lib/api.js';
import Icon, { Logo } from '../components/Icon.jsx';

const FEATURES = [
  { icon: 'gauge', title: 'Workload radar', text: 'See who is overloaded before burnout happens.' },
  { icon: 'target', title: 'Deadline forecasts', text: 'Know which projects will slip, and why.' },
  { icon: 'phone', title: 'Web + mobile, live', text: 'Update on your phone, see it on the web instantly.' },
];

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
          <h1>Ship team projects on time, without burning anyone out.</h1>
          <p className="lead">Assign tasks, track deadlines and spot risk early, for student teams, clubs and small businesses.</p>
        </div>
        <div className="feature-list">
          {FEATURES.map((f) => (
            <div className="feature" key={f.title}>
              <span className="ficon"><Icon name={f.icon} /></span>
              <div><b>{f.title}</b><span>{f.text}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section className="auth-side">
        <form className="card auth-card stack" onSubmit={submit}>
          <div>
            <h1>{isLogin ? 'Welcome back 👋' : 'Create your account'}</h1>
            <p className="muted">
              {isLogin ? 'Sign in with the same account you use on the mobile app.' : 'One account works on web and mobile.'}
            </p>
          </div>
          {error && <div className="error-box"><Icon name="alert" size={16} />{error}</div>}
          {!isLogin && (
            <label className="field">Full name
              <input value={form.name} onChange={set('name')} required minLength={2} autoComplete="name" placeholder="Asha Rao" />
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
