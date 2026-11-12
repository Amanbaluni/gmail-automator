import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon, BrandMark } from '../icons.jsx';
import { ThemeToggle } from '../theme.jsx';
import { Avatar } from '../ui.jsx';

const NAV = [
  { label: 'Mail', items: [
    ['/dashboard', 'Dashboard', 'dashboard'],
    ['/priority', 'Priority', 'priority'],
    ['/inbox', 'Inbox', 'inbox'],
    ['/compose', 'Compose', 'compose'],
    ['/scheduled', 'Scheduled', 'clock'],
  ] },
  { label: 'Automation', items: [
    ['/rules', 'Rules', 'rules'],
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
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  return (
    <div className="app">
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Main navigation">
        <Link to="/dashboard" className="brand"><BrandMark />MailPilot</Link>
        {NAV.map((g) => (
          <nav key={g.label} className="nav-group" aria-label={g.label}>
            <div className="nav-label">{g.label}</div>
            {g.items.map(([to, label, icon]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <Icon name={icon} size={17} />{label}
              </NavLink>
            ))}
          </nav>
        ))}
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon menu-btn" onClick={() => setOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
          <ThemeToggle />
          <div className="user-chip">
            <Avatar name={user.name || user.email} src={user.picture} />
            <span className="user-email">{user.email}</span>
          </div>
          <button className="btn btn-sm" onClick={logout}><Icon name="logout" size={15} />Sign out</button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
