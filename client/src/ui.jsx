import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => ({ toast: useContext(ToastCtx) });

const TOAST_ICON = { success: 'checkCircle', error: 'alert', info: 'info' };

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = useCallback((message, type = 'info') => {
    const id = Math.random();
    setItems((p) => [...p.slice(-3), { id, message, type }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), type === 'error' ? 6000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <Icon name={TOAST_ICON[t.type] || 'info'} size={16} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Confirm dialog (replaces window.confirm) ---------- */
const ConfirmCtx = createContext(() => Promise.resolve(false));
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }) {
  const [dlg, setDlg] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setDlg({ ...opts, resolve })), []);
  const close = (v) => { dlg?.resolve(v); setDlg(null); };
  const okRef = useRef(null);

  useEffect(() => {
    if (!dlg) return undefined;
    okRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dlg]);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {dlg && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-msg">
            <h2 id="dlg-title">{dlg.title}</h2>
            <p id="dlg-msg">{dlg.message}</p>
            <div className="dialog-actions">
              <button className="btn" onClick={() => close(false)}>{dlg.cancelLabel || 'Cancel'}</button>
              <button ref={okRef} className={`btn ${dlg.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
                {dlg.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

/* ---------- Small building blocks ---------- */
export const Spinner = ({ inline }) => <div className={`spinner${inline ? ' inline' : ''}`} role="status" aria-label="Loading" />;

export const ListSkeleton = ({ rows = 6 }) => (
  <div className="card flush" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} style={{ padding: '0.9rem 1rem', borderBottom: '1px solid var(--line)', display: 'grid', gap: 8 }}>
        <div className="skeleton" style={{ width: `${30 + ((i * 17) % 30)}%` }} />
        <div className="skeleton" style={{ width: `${55 + ((i * 13) % 35)}%`, height: 11 }} />
      </div>
    ))}
  </div>
);

export const Empty = ({ title, children, icon = 'inbox', action }) => (
  <div className="empty">
    <div className="empty-icon"><Icon name={icon} size={20} /></div>
    <strong>{title}</strong>
    <p>{children}</p>
    {action && <div style={{ marginTop: '1rem' }}>{action}</div>}
  </div>
);

export const PageHeader = ({ title, children, actions }) => (
  <div className="page-head">
    <div>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
);

export const Notice = ({ tone = 'info', title, children, action }) => (
  <div className={`notice ${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
    <Icon name={tone === 'ok' ? 'checkCircle' : tone === 'info' ? 'info' : 'alert'} size={16} />
    <div className="notice-body">{title && <strong>{title}</strong>}{children}</div>
    {action}
  </div>
);

export const Toggle = ({ checked, onChange, label, disabled }) => (
  <label className="toggle">
    <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    <span className="track" />
    {label && <span>{label}</span>}
  </label>
);

export const Badge = ({ tone, children, dot }) => (
  <span className={`badge ${tone || ''}`}>{dot && <span className="dot" />}{children}</span>
);

/* ---------- Formatting ---------- */
export function fmtDate(ms) {
  const d = new Date(ms);
  if (isNaN(d)) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
export const fmtFull = (v) => (v ? new Date(v).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Never');

export function timeAgo(v) {
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (isNaN(s)) return '';
  if (s < 45) return 'Just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
  return fmtFull(v);
}

export const shortFrom = (f = '') => f.split('<')[0].replace(/["']/g, '').trim() || f.replace(/[<>]/g, '');
export const addrOf = (f = '') => (/<([^>]+)>/.exec(f)?.[1] || f).trim();
export const initials = (s = '') => {
  const parts = s.replace(/<.*>/, '').replace(/[^\p{L}\p{N}\s@.]/gu, ' ').trim().split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[1][0] : '')).toUpperCase();
};
export const Avatar = ({ name, src }) =>
  src ? <img className="avatar" src={src} alt="" referrerPolicy="no-referrer" /> : <span className="avatar" aria-hidden="true">{initials(name)}</span>;

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ---------- Activity log vocabulary ---------- */
export const ACTIVITY_TYPES = {
  rule: ['Rule', 'ok'],
  autoreply: ['Auto-reply', 'info'],
  scheduled: ['Scheduled', 'info'],
  send: ['Sent', 'neutral'],
  cleaner: ['Cleaner', 'warn'],
  system: ['System', 'warn'],
  priority: ['Priority', 'info'],
  error: ['Problem', 'danger'],
};
