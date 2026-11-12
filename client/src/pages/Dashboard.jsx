import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { ACTIVITY_TYPES, Badge, ListSkeleton, Notice, PageHeader, plural, timeAgo, fmtFull, useToast } from '../ui.jsx';

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [hours, setHours] = useState(24);
  const [running, setRunning] = useState(false);
  const { toast } = useToast();

  const load = () => api('/stats').then(setS).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); }, []);

  const run = async () => {
    setRunning(true);
    try {
      const r = await api('/automation/run', { method: 'POST', body: { hours: Number(hours) } });
      toast(r.scanned === 0 ? 'No new mail to check in that time range.' : `Checked ${plural(r.scanned, 'email')} and applied ${plural(r.actions, 'action')}.`, 'success');
      load();
    } catch (e) { toast(e.message, 'error'); } finally { setRunning(false); }
  };

  if (!s) return <><PageHeader title="Dashboard" /><div className="stats">{[0, 1, 2, 3].map((i) => <div key={i} className="card stat"><div className="skeleton" style={{ width: '50%' }} /><div className="skeleton" style={{ width: '30%', height: 28, marginTop: 10 }} /></div>)}</div><ListSkeleton rows={3} /></>;
  const max = Math.max(1, ...s.days.map((d) => d.count));
  const week = s.days.reduce((n, d) => n + d.count, 0);

  return (
    <>
      <PageHeader title="Dashboard">A quick look at your mailbox and what your automation has done lately.</PageHeader>

      {!s.automationEnabled && (
        <Notice tone="warn" title="Automation is paused" action={<Link className="btn btn-sm" to="/settings">Turn on</Link>}>
          Rules and the auto-responder won’t run until you turn automation back on.
        </Notice>
      )}

      <div className="stats">
        <Link to="/inbox" className="card stat" style={{ color: 'inherit', textDecoration: 'none' }}><span>Inbox</span><b>{s.inbox?.total?.toLocaleString() ?? '—'}</b></Link>
        <Link to="/priority" className="card stat" style={{ color: 'inherit', textDecoration: 'none' }}><span>Unread · view by priority</span><b>{s.inbox?.unread?.toLocaleString() ?? '—'}</b></Link>
        <Link to="/rules" className="card stat" style={{ color: 'inherit', textDecoration: 'none' }}><span>Active rules</span><b>{s.rulesActive}<small> of {s.rulesTotal}</small></b></Link>
        <Link to="/scheduled" className="card stat" style={{ color: 'inherit', textDecoration: 'none' }}><span>Waiting to send</span><b>{s.scheduled}</b></Link>
      </div>

      <div className="card">
        <div className="card-head"><h3>Check mail now</h3><Badge tone={s.automationEnabled ? 'ok' : 'warn'} dot>{s.automationEnabled ? 'Automation on' : 'Paused'}</Badge></div>
        <p className="muted small" style={{ marginBottom: '0.9rem' }}>
          Applies your rules and auto-responder to recent mail straight away, instead of waiting for the next automatic check. Last checked: {fmtFull(s.lastRunAt)}.
        </p>
        <div className="row wrap tight">
          <select aria-label="How far back to check" value={hours} onChange={(e) => setHours(e.target.value)} style={{ width: 'auto' }}>
            <option value={1}>Last hour</option><option value={24}>Last 24 hours</option>
            <option value={72}>Last 3 days</option><option value={168}>Last 7 days</option>
          </select>
          <button className="btn btn-primary" onClick={run} disabled={running}><Icon name="zap" size={15} />{running ? 'Checking…' : 'Check now'}</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3>Automated actions</h3><span className="muted small">{plural(week, 'action')} in the last 7 days</span></div>
          <div className="bars" role="img" aria-label={`Actions per day: ${s.days.map((d) => d.count).join(', ')}`}>
            {s.days.map((d) => (
              <div key={d.date} className="bar-col" title={`${d.date}: ${plural(d.count, 'action')}`}>
                <span className="bar-val">{d.count || ''}</span>
                <div className={`bar${d.count ? '' : ' zero'}`} style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }} />
                <small>{new Date(d.date + 'T00:00:00Z').toLocaleDateString([], { weekday: 'short', timeZone: 'UTC' })}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Recent activity</h3><Link to="/activity" className="small">View all</Link></div>
          {s.recent.length === 0 ? <p className="muted">Nothing yet. Once you create a rule, its actions will appear here.</p> : (
            <ul className="plain">{s.recent.map((a) => {
              const [label, tone] = ACTIVITY_TYPES[a.type] || [a.type, ''];
              return <li key={a._id}><Badge tone={tone}>{label}</Badge><span className="activity-text">{a.message}</span><span className="activity-time">{timeAgo(a.createdAt)}</span></li>;
            })}</ul>
          )}
        </div>
      </div>
    </>
  );
}
