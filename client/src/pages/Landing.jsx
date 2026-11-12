import React from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon, BrandMark, GoogleG } from '../icons.jsx';
import { ThemeToggle } from '../theme.jsx';
import { Notice } from '../ui.jsx';

const ERRORS = {
  denied: 'Sign-in was cancelled. You can try again whenever you’re ready.',
  state: 'Your sign-in session timed out. Please try again.',
  scopes: 'MailPilot needs all of the requested Gmail permissions to organise and send mail. Please try again and allow them.',
  not_allowed: 'This Google account doesn’t have access to this site. Contact the site owner to be added.',
  no_refresh: 'Google didn’t grant lasting access. Remove MailPilot at myaccount.google.com/permissions, then sign in again.',
};

const FEATURES = [
  ['priority', 'Priority inbox', 'Unread mail ranked by who it’s from and what it says, so the important messages come first.'],
  ['rules', 'Smart rules', 'Label, archive, star or delete mail automatically based on sender, subject or keywords.'],
  ['reply', 'Auto-responder', 'Out-of-office replies with your own templates, sent once per person and never to newsletters.'],
  ['clock', 'Scheduled send', 'Write now and choose exactly when the email goes out.'],
  ['broom', 'Inbox cleaner', 'See who fills your inbox and clear it out in one click.'],
  ['activity', 'Activity log', 'Every automated action is recorded, so you always know what happened.'],
];

export default function Landing({ login }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (!loading && user) return <Navigate to="/dashboard" replace />;
  const err = ERRORS[params.get('error')];
  return (
    <div className="landing">
      <header className="landing-nav">
        <span className="brand"><BrandMark />MailPilot</span>
        <div className="actions">
          <ThemeToggle />
          <a className="btn" href="/api/auth/google">Sign in</a>
        </div>
      </header>
      <section className="hero">
        <h1>Less time in your inbox. More time on what matters.</h1>
        <p>MailPilot works alongside Gmail to sort your mail, surface what’s urgent and reply while you’re away.</p>
        {err && <div style={{ maxWidth: 520, margin: '0 auto 1.25rem', textAlign: 'left' }}><Notice tone="danger" title="We couldn’t sign you in">{err}</Notice></div>}
        <a className="btn btn-primary btn-lg" href="/api/auth/google"><GoogleG />Continue with Google</a>
        <p className="fine">Your Google connection is stored encrypted and you can revoke it at any time. <Link to="/privacy">Privacy policy</Link></p>
      </section>
      <section className="features" aria-label="Features">
        {FEATURES.map(([icon, t, d]) => (
          <div className="card" key={t}>
            <div className="f-icon"><Icon name={icon} size={18} /></div>
            <h3>{t}</h3><p>{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
