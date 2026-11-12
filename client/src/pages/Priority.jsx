import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import MessageView from '../components/MessageView.jsx';
import { Badge, Empty, ListSkeleton, Notice, PageHeader, useToast, fmtDate, addrOf, plural } from '../ui.jsx';

const LEVELS = [
  ['high', 'High priority', 'danger'],
  ['medium', 'Medium priority', 'warn'],
  ['low', 'Low priority', ''],
];
const RANGES = [[3, '3 days'], [7, '7 days'], [30, '30 days']];
const lines = (a) => (a || []).join(', ');

export default function Priority() {
  const [days, setDays] = useState(7);
  const [level, setLevel] = useState('all');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [prefs, setPrefs] = useState(null);
  const [tuning, setTuning] = useState(false);
  const [draft, setDraft] = useState({ vip: '', muted: '', keywords: '' });
  const [open, setOpen] = useState(null);
  const [seen, setSeen] = useState(() => new Set());
  const [savingPrefs, setSavingPrefs] = useState(false);
  const { toast } = useToast();
  const nav = useNavigate();

  const load = useCallback(async () => {
    setItems(null); setError('');
    try {
      const [d, s] = await Promise.all([api(`/mail/priority?days=${days}`), api('/settings')]);
      setItems(d.items); setPrefs(s.priority); setSeen(new Set());
      setDraft({ vip: lines(s.priority.vip), muted: lines(s.priority.muted), keywords: lines(s.priority.keywords) });
    } catch (e) { setError(e.message); setItems([]); }
  }, [days]);
  useEffect(() => { setOpen(null); load(); }, [load]);

  const savePrefs = async (next) => {
    setSavingPrefs(true);
    try {
      await api('/settings', { method: 'PUT', body: { priority: next } });
      toast('Priority preferences saved.', 'success');
      await load();
    } catch (e) { toast(e.message, 'error'); } finally { setSavingPrefs(false); }
  };

  const toggleList = (m, list) => {
    const email = m.fromEmail.toLowerCase();
    const cur = prefs[list];
    const nextList = cur.includes(email) ? cur.filter((x) => x !== email) : [...cur, email];
    const other = list === 'vip' ? 'muted' : 'vip';
    savePrefs({ ...prefs, [list]: nextList, [other]: prefs[other].filter((x) => x !== email) });
  };

  const markRead = async (m, quiet) => {
    try {
      await api(`/mail/messages/${m.id}/action`, { method: 'POST', body: { action: 'read' } });
      setSeen((s) => new Set(s).add(m.id));
      if (!quiet) toast('Marked as read.', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  const openMsg = async (m) => {
    setOpen({ ...m, loading: true });
    try {
      const full = await api(`/mail/messages/${m.id}`);
      setOpen({ ...full, unread: false });
      if (!seen.has(m.id)) markRead(m, true);
    } catch (e) { toast(e.message, 'error'); setOpen(null); }
  };

  const act = async (m, action) => {
    try {
      await api(`/mail/messages/${m.id}/action`, { method: 'POST', body: { action } });
      if (action === 'star' || action === 'unstar') { setOpen((o) => o && { ...o, starred: action === 'star' }); return; }
      if (action === 'unread') { setSeen((s) => { const n = new Set(s); n.delete(m.id); return n; }); setOpen((o) => o && { ...o, unread: true }); return; }
      if (action === 'read') { setSeen((s) => new Set(s).add(m.id)); setOpen((o) => o && { ...o, unread: false }); return; }
      setItems((p) => p.filter((x) => x.id !== m.id)); setOpen(null);
      toast({ archive: 'Message archived.', trash: 'Moved to trash.', spam: 'Reported as spam.' }[action] || 'Done.', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  const reply = (m) => nav('/compose', { state: { to: addrOf(m.replyTo || m.from), subject: /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`, threadId: m.threadId, inReplyTo: m.messageId } });

  const groups = useMemo(() => {
    const g = { high: [], medium: [], low: [] };
    (items || []).forEach((m) => g[m.priority.level].push(m));
    return g;
  }, [items]);

  const visible = LEVELS.filter(([k]) => level === 'all' || level === k);
  const total = items?.length || 0;

  return (
    <>
      <PageHeader title="Priority" actions={<>
        <button className="btn" onClick={() => setTuning((t) => !t)} aria-expanded={tuning}><Icon name="filter" size={15} />Tune ranking</button>
        <button className="btn" onClick={load} disabled={!items}><Icon name="refresh" size={15} />Refresh</button>
      </>}>
        Your unread mail, ranked by who sent it and what it says. Only message headers and short previews are analysed, never the full text.
      </PageHeader>

      {tuning && prefs && (
        <form className="card form" onSubmit={(e) => { e.preventDefault(); savePrefs({ vip: draft.vip, muted: draft.muted, keywords: draft.keywords }); }}>
          <div className="card-head"><h3>Tune ranking</h3></div>
          <label className="field"><span>VIP senders</span>
            <textarea rows={2} value={draft.vip} onChange={(e) => setDraft({ ...draft, vip: e.target.value })} placeholder="boss@company.com, partner@example.com" />
            <span className="hint">Mail from these addresses always ranks near the top. Separate addresses with commas.</span></label>
          <label className="field"><span>Muted senders</span>
            <textarea rows={2} value={draft.muted} onChange={(e) => setDraft({ ...draft, muted: e.target.value })} placeholder="updates@shop.com" />
            <span className="hint">Mail from these addresses is ranked lowest.</span></label>
          <label className="field"><span>Priority keywords</span>
            <input value={draft.keywords} onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} placeholder="project atlas, renewal, offer letter" />
            <span className="hint">Mail whose subject or preview contains any of these words is ranked higher.</span></label>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={savingPrefs}>{savingPrefs ? 'Saving…' : 'Save and re-rank'}</button>
            <button type="button" className="btn" onClick={() => setTuning(false)}>Close</button>
          </div>
        </form>
      )}

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Time range">
          {RANGES.map(([d, n]) => <button key={d} className={days === d ? 'active' : ''} aria-pressed={days === d} onClick={() => setDays(d)}>{n}</button>)}
        </div>
        <div className="segmented" role="group" aria-label="Priority level">
          {[['all', 'All'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']].map(([k, n]) => (
            <button key={k} className={level === k ? 'active' : ''} aria-pressed={level === k} onClick={() => setLevel(k)}>{n}</button>
          ))}
        </div>
        {items && <span className="muted small">{plural(total, 'unread message')} from the last {days} days</span>}
      </div>

      {error && <Notice tone="danger" title="We couldn't load your priority list">{error}</Notice>}
      {!items && <ListSkeleton rows={7} />}
      {items && !error && total === 0 && (
        <div className="card"><Empty title="You're all caught up" icon="checkCircle">There's no unread mail in this time range. Try a longer range to look further back.</Empty></div>
      )}

      <div className={open ? 'split' : ''}>
        <div>
          {items && visible.map(([key, title, tone]) => groups[key].length > 0 && (
            <section key={key}>
              <div className="prio-group-title">{title}<Badge tone={tone}>{groups[key].length}</Badge></div>
              <div className="card flush">
                {groups[key].map((m) => {
                  const isVip = prefs?.vip.includes(m.fromEmail.toLowerCase());
                  const isSeen = seen.has(m.id);
                  return (
                    <div key={m.id} className={`prio ${open?.id === m.id ? 'selected' : ''}`} onClick={() => openMsg(m)}
                      role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openMsg(m))}>
                      <div className={`score ${m.priority.level}`} title={`Priority score ${m.priority.score} out of 100`} style={isSeen ? { opacity: 0.45 } : undefined}>{m.priority.score}</div>
                      <div className="prio-main">
                        <div className="prio-top"><b>{m.fromName}</b>{isVip && <Badge tone="info">VIP</Badge>}{isSeen && <Badge>Read</Badge>}<span className="date">{fmtDate(m.date)}</span></div>
                        <div className="prio-subject">{m.subject}</div>
                        <div className="prio-snippet">{m.snippet}</div>
                        <div className="reasons">
                          {m.priority.reasons.map((r) => <span key={r.label} className={`reason ${r.weight > 0 ? 'up' : 'down'}`}>{r.weight > 0 ? '+ ' : '– '}{r.label}</span>)}
                        </div>
                      </div>
                      <div className="prio-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Mark as read" aria-label="Mark as read" onClick={() => markRead(m)} disabled={isSeen}><Icon name="check" size={15} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" title={isVip ? 'Remove from VIP senders' : 'Always treat this sender as VIP'} aria-label={isVip ? 'Remove from VIP senders' : 'Add sender to VIP list'} onClick={() => toggleList(m, 'vip')}><Icon name="star" size={15} style={isVip ? { fill: 'currentColor', color: '#d99a00' } : undefined} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Mute this sender" aria-label="Mute this sender" onClick={() => toggleList(m, 'muted')}><Icon name="eyeOff" size={15} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        {open && <MessageView msg={open} onClose={() => setOpen(null)} onAction={act} onReply={reply} />}
      </div>
    </>
  );
}
