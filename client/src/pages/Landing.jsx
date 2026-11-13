import React, { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { BrandMark, GoogleG } from '../icons.jsx';
import { ThemeToggle } from '../theme.jsx';
import { Notice } from '../ui.jsx';

const ERRORS = {
  denied: 'Sign-in was cancelled. You can try again whenever you’re ready.',
  state: 'Your sign-in session timed out. Please try again.',
  scopes: 'MailPilot needs all of the requested Gmail permissions to organise and send mail. Please try again and allow them.',
  not_allowed: 'This Google account doesn’t have access to this site. Contact the site owner to be added.',
  no_refresh: 'Google didn’t grant lasting access. Remove MailPilot at myaccount.google.com/permissions, then sign in again.',
};

// Sample mail for the hero. `from` is arrival order; `to` is the rank after scoring.
const SAMPLE = [
  { who: 'ShopNow', subject: '40% off ends tonight', score: 12, level: 'low', why: ['– Promotion', '– Bulk sender'], from: 0 },
  { who: 'Maya Chen', subject: 'Contract needs your signature by Friday', score: 92, level: 'high', why: ['+ Deadline', '+ You’ve written to her'], from: 1 },
  { who: 'Weekly Digest', subject: '12 stories you missed', score: 8, level: 'low', why: ['– Newsletter'], from: 2 },
  { who: 'Priya Nair', subject: 'Can we move Thursday’s meeting?', score: 81, level: 'high', why: ['+ Meeting', '+ Question'], from: 3 },
  { who: 'Stripe', subject: 'Your October receipt', score: 34, level: 'medium', why: ['+ Billing', '– No-reply'], from: 4 },
  { who: 'Dad', subject: 'Call me when you’re free', score: 67, level: 'medium', why: ['+ Known sender'], from: 5 },
];
const RANKED = [...SAMPLE].sort((a, b) => b.score - a.score);
const rankOf = (m) => RANKED.indexOf(m);

function Sorter() {
  const [sorted, setSorted] = useState(false);
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) { setSorted(true); return undefined; }
    const t = setTimeout(() => setSorted(true), 1100);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`sorter${sorted ? ' sorted' : ''}`} role="img" aria-label="Six unread emails reordered by priority score, highest first">
      <div className="sorter-head"><span>Unread, {SAMPLE.length} messages</span><span className="state">{sorted ? 'Ranked by priority' : 'Arrival order'}</span></div>
      <div className="sorter-body" aria-hidden="true">
        {SAMPLE.map((m, i) => (
          <div key={m.who} className="sorter-row" style={{ '--from': m.from, '--to': rankOf(m), '--i': i }}>
            <div className={`score ${sorted ? m.level : ''}`}>{m.score}</div>
            <div className="prio-main">
              <div className="prio-top"><b>{m.who}</b></div>
              <div className="prio-subject">{m.subject}</div>
              <div className="reasons">{m.why.map((r) => <span key={r} className={`reason ${r.startsWith('+') ? 'up' : 'down'}`}>{r}</span>)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const STEPS = [
  ['Read the headers', 'New inbox mail is listed. Only headers and Gmail’s short preview are read; message bodies are never stored.'],
  ['Match your rules', 'Each rule checks sender, subject and keywords. Commas mean any of these, and every field you fill in has to match.'],
  ['Act once, then log it', 'Labels, archive, star, trash and replies are applied in one Gmail call per message. Every action lands in your activity log.'],
];

const FEATURES = [
  ['Priority', 'Unread mail scored 0 to 100 from who sent it, what it says and how recent it is. Every score lists its reasons, and you can add VIP senders, muted senders and your own keywords.'],
  ['Rules', 'If the sender, subject or keywords match, label, mark read, star, archive, trash or auto-reply. Test a rule against recent mail before it touches anything.'],
  ['Auto-responder', 'Out-of-office replies from your own templates, limited to one per person per cooldown period. Newsletters, no-reply and automated mail are skipped.'],
  ['Scheduled send', 'Write now, pick the time, and it goes out then. Recipient suggestions come from your own mailbox.'],
  ['Cleaner', 'Groups promotions, social and old mail by sender, then archives, marks read or deletes up to 500 messages per sender. Unsubscribe links are shown when present.'],
  ['Activity log', 'Everything MailPilot did for you, kept for 90 days.'],
];

export default function Landing() {
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
        <div>
          <h1>Your inbox, sorted before you open it.</h1>
          <p className="lead">MailPilot sits on top of Gmail. It ranks what’s unread, files mail by your rules and replies while you’re away.</p>
          {err && <div style={{ marginBottom: '1.25rem' }}><Notice tone="danger" title="We couldn’t sign you in">{err}</Notice></div>}
          <a className="btn btn-primary btn-lg" href="/api/auth/google"><GoogleG />Continue with Google</a>
          <p className="fine">Your Google connection is stored encrypted and you can revoke it at any time. <Link to="/privacy">Privacy policy</Link></p>
        </div>
        <Sorter />
      </section>

      <section className="how" aria-labelledby="how-h">
        <h2 id="how-h">What happens on every check</h2>
        <ol>
          {STEPS.map(([t, d]) => <li key={t}><h3>{t}</h3><p>{d}</p></li>)}
        </ol>
      </section>

      <section className="ledger" aria-labelledby="feat-h">
        <h2 id="feat-h">What’s in the desk</h2>
        <dl>
          {FEATURES.map(([t, d]) => <div className="entry" key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
        </dl>
      </section>

      <footer className="landing-foot">
        <span>MailPilot works with your Gmail account through Google’s official API.</span>
        <Link to="/privacy">Privacy policy</Link>
      </footer>
    </div>
  );
}
