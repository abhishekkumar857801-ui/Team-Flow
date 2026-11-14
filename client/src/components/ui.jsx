import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { initials } from '../lib/format.js';
import Icon from './Icon.jsx';

export function Avatar({ user, size }) {
  if (!user) return <span className={`avatar empty ${size || ''}`} title="Unassigned">?</span>;
  return (
    <span className={`avatar ${size || ''}`} style={{ background: user.avatarColor || '#6366f1' }} title={user.name}>
      {initials(user.name)}
    </span>
  );
}

export const Badge = ({ tone, children }) => <span className={`badge ${tone}`}>{children}</span>;

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="card-title">
          <h2>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        {children}
        {footer && <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>{footer}</div>}
      </div>
    </div>
  );
}

export const Spinner = ({ label = 'Loading…' }) => <div className="spinner">{label}</div>;

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((text) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-3), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.text}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
