import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { ACTIVITY_TYPES, Badge, ListSkeleton, PageHeader, plural, timeAgo, useToast } from '../ui.jsx';

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

  if (!s) return <><PageHeader title="Dashboard" /><div className="sweep" style={{ minHeight: 84 }} /><div className="counters">{[0, 1, 2, 3].map((i) => <div key={i} className="counter"><div className="skeleton" style={{ width: '50%', height: 38 }} /><div className="skeleton" style={{ width: '40%' }} /></div>)}</div><ListSkeleton rows={3} /></>;
  const max = Math.max(1, ...s.days.map((d) => d.count));
  const week = s.days.reduce((n, d) => n + d.count, 0);
  const on = s.automationEnabled;

  return (
    <>
      <PageHeader title="Dashboard">Your mailbox and what automation has done lately.</PageHeader>

      <div className="sweep">
        <div className="sweep-state">
          <span className={`led ${on ? 'on' : 'paused'}`} />
          <div>
            <b>{on ? 'Automation is running' : 'Automation is paused'}</b>
            <span>{on ? `Last checked ${s.lastRunAt ? timeAgo(s.lastRunAt).toLowerCase() : 'never'}. Rules and auto-replies apply to new mail.` : 'Rules and the auto-responder won’t run until you turn it back on.'}</span>
          </div>
        </div>
        <div className="sweep-controls">
          {on ? (
            <>
              <select aria-label="How far back to check" value={hours} onChange={(e) => setHours(e.target.value)}>
                <option value={1}>Last hour</option><option value={24}>Last 24 hours</option>
                <option value={72}>Last 3 days</option><option value={168}>Last 7 days</option>
              </select>
              <button className="btn btn-primary" onClick={run} disabled={running}><Icon name="zap" size={15} />{running ? 'Checking…' : 'Check now'}</button>
            </>
          ) : <Link className="btn btn-primary" to="/settings">Turn on</Link>}
        </div>
      </div>

      <div className="counters">
        <Link to="/inbox" className="counter"><b>{s.inbox?.total?.toLocaleString() ?? '–'}</b><span>In inbox</span></Link>
        <Link to="/priority" className={`counter${s.inbox?.unread ? ' alert' : ''}`}><b>{s.inbox?.unread?.toLocaleString() ?? '–'}</b><span>Unread <em>· rank them</em></span></Link>
        <Link to="/rules" className="counter"><b>{s.rulesActive}<small>/ {s.rulesTotal}</small></b><span>Rules active</span></Link>
        <Link to="/scheduled" className="counter"><b>{s.scheduled}</b><span>Waiting to send</span></Link>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3>Automated actions</h3><span className="muted small">{plural(week, 'action')} in 7 days</span></div>
          <div className="bars" role="img" aria-label={`Actions per day: ${s.days.map((d) => d.count).join(', ')}`}>
            {s.days.map((d, i) => (
              <div key={d.date} className="bar-col" title={`${d.date}: ${plural(d.count, 'action')}`}>
                <span className="bar-val">{d.count || ''}</span>
                <div className={`bar${d.count ? '' : ' zero'}${i === s.days.length - 1 && d.count ? ' today' : ''}`} style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }} />
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
