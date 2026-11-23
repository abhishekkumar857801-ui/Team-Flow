import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { avatarColor, initials } from '../lib/format.js';
import { fileUrl } from '../lib/api.js';
import Icon from './Icon.jsx';

export function Avatar({ user, size }) {
  if (!user) {
    return (
      <span className={`avatar empty ${size || ''}`} title="Unassigned" aria-label="Unassigned">
        <Icon name="person" size={size === 'lg' ? 18 : 15} />
      </span>
    );
  }
  return (
    <span className={`avatar ${size || ''} ${user.avatarUrl ? 'has-photo' : ''}`} title={user.name} style={{ background: avatarColor(user), color: '#f4ede0' }}>
      {user.avatarUrl ? <img src={fileUrl(user.avatarUrl)} alt="" loading="lazy" /> : initials(user.name)}
    </span>
  );
}

export const Badge = ({ tone, children }) => <span className={`badge ${tone}`}>{children}</span>;

export function Modal({ title, onClose, children, footer }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]'
      )].filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length);
      const first = focusable[0];
      const last = focusable.at(-1);
      const active = document.activeElement;
      if (!first || !dialog.contains(active) || active === dialog || active === (event.shiftKey ? first : last)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="card modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="card-title">
          <h2 id={titleId}>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        {children}
        {footer && <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>{footer}</div>}
      </div>
    </div>
  );
}

export const Spinner = ({ label = 'Loading…' }) => <div className="spinner" role="status">{label}</div>;

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  // toast('Saved') or toast('Rahul moved TF-0042', { icon: 'phone', tone: 'live' })
  const push = useCallback((text, opts = {}) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, icon: opts.icon, tone: opts.tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone ? `is-${t.tone}` : ''}`}>
            {t.icon && <Icon name={t.icon} size={16} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
