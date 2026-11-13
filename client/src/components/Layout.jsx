import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon, BrandMark } from '../icons.jsx';
import { ThemeToggle } from '../theme.jsx';
import { Avatar } from '../ui.jsx';

// [path, label, icon, key of the live count shown beside it]
const NAV = [
  { label: 'Mail', items: [
    ['/dashboard', 'Dashboard', 'dashboard'],
    ['/priority', 'Priority', 'priority'],
    ['/inbox', 'Inbox', 'inbox', 'unread'],
    ['/compose', 'Compose', 'compose'],
    ['/scheduled', 'Scheduled', 'clock', 'scheduled'],
  ] },
  { label: 'Automation', items: [
    ['/rules', 'Rules', 'rules', 'rulesActive'],
    ['/auto-responder', 'Auto-responder', 'reply'],
    ['/cleaner', 'Cleaner', 'broom'],
  ] },
  { label: 'Account', items: [
    ['/activity', 'Activity log', 'activity'],
    ['/settings', 'Settings', 'settings'],
  ] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState(null);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [open]);

  // Live counts beside the nav items; refreshed on every page change, failures stay silent
  useEffect(() => {
    let live = true;
    api('/stats').then((s) => live && setCounts({ unread: s.inbox?.unread, scheduled: s.scheduled, rulesActive: s.rulesActive, on: s.automationEnabled })).catch(() => {});
    return () => { live = false; };
  }, [loc.pathname]);

  return (
    <div className="app">
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Main navigation">
        <Link to="/dashboard" className="brand"><BrandMark />MailPilot</Link>
        {NAV.map((g) => (
          <nav key={g.label} className="nav-group" aria-label={g.label}>
            <div className="nav-label">{g.label}</div>
            {g.items.map(([to, label, icon, key]) => {
              const n = key && counts?.[key];
              return (
                <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <Icon name={icon} size={17} />{label}
                  {n > 0 && <span className={`nav-count${key === 'unread' ? ' hot' : ''}`} aria-label={`${n} ${key === 'rulesActive' ? 'active' : key}`}>{n > 999 ? '999+' : n}</span>}
                </NavLink>
              );
            })}
          </nav>
        ))}
        <div className="rail-foot">
          {counts && (
            <Link to="/settings" className="rail-status">
              <span className={`led ${counts.on ? 'on' : 'paused'}`} />{counts.on ? 'Automation running' : 'Automation paused'}
            </Link>
          )}
          <div className="rail-user">
            <Avatar name={user.name || user.email} src={user.picture} />
            <span className="user-email" title={user.email}>{user.email}</span>
          </div>
          <div className="rail-actions">
            <button className="btn btn-sm grow" onClick={logout}><Icon name="logout" size={15} />Sign out</button>
            <ThemeToggle className="btn-sm" />
          </div>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="mobilebar">
          <button className="btn btn-icon" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open}><Icon name="menu" /></button>
          <span className="brand"><BrandMark size={24} />MailPilot</span>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
