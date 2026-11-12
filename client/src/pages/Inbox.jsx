import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import MessageView from '../components/MessageView.jsx';
import { Empty, ListSkeleton, PageHeader, useToast, fmtDate, shortFrom, addrOf } from '../ui.jsx';

const TABS = [['INBOX', 'Inbox'], ['UNREAD', 'Unread'], ['STARRED', 'Starred'], ['SENT', 'Sent'], ['SPAM', 'Spam'], ['TRASH', 'Trash']];
const DONE = { archive: 'Message archived.', trash: 'Moved to trash.', untrash: 'Restored to your inbox.', spam: 'Reported as spam.' };

export default function Inbox() {
  const [label, setLabel] = useState('INBOX');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const { toast } = useToast();
  const nav = useNavigate();

  const load = useCallback(async (token) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ label });
      if (query) p.set('q', query);
      if (token) p.set('pageToken', token);
      const d = await api(`/mail/messages?${p}`);
      setItems((prev) => (token ? [...prev, ...d.messages] : d.messages));
      setNext(d.nextPageToken);
    } catch (e) { toast(e.message, 'error'); } finally { setLoading(false); }
  }, [label, query]);

  useEffect(() => { setOpen(null); load(); }, [load]);

  const patch = (id, fields) => setItems((p) => p.map((m) => (m.id === id ? { ...m, ...fields } : m)));

  const openMsg = async (m) => {
    setOpen({ ...m, loading: true });
    try {
      const full = await api(`/mail/messages/${m.id}`);
      setOpen(full);
      if (m.unread) {
        api(`/mail/messages/${m.id}/action`, { method: 'POST', body: { action: 'read' } }).catch(() => {});
        patch(m.id, { unread: false });
        setOpen((o) => o && { ...o, unread: false });
      }
    } catch (e) { toast(e.message, 'error'); setOpen(null); }
  };

  const act = async (m, action) => {
    try {
      await api(`/mail/messages/${m.id}/action`, { method: 'POST', body: { action } });
      if (action === 'unread' || action === 'read') { const u = action === 'unread'; patch(m.id, { unread: u }); setOpen((o) => o && { ...o, unread: u }); }
      else if (action === 'star' || action === 'unstar') { patch(m.id, { starred: action === 'star' }); setOpen((o) => o && { ...o, starred: action === 'star' }); }
      else { setItems((p) => p.filter((x) => x.id !== m.id)); setOpen(null); toast(DONE[action] || 'Done.', 'success'); }
    } catch (e) { toast(e.message, 'error'); }
  };

  const reply = (m) => nav('/compose', { state: { to: addrOf(m.replyTo || m.from), subject: /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`, threadId: m.threadId, inReplyTo: m.messageId } });

  return (
    <>
      <PageHeader title="Inbox" actions={<button className="btn" onClick={() => load()} disabled={loading}><Icon name="refresh" size={15} />Refresh</button>}>
        Read and manage your Gmail without leaving MailPilot.
      </PageHeader>

      <div className="tabs" role="tablist">
        {TABS.map(([k, n]) => <button key={k} role="tab" aria-selected={label === k} className={label === k ? 'tab active' : 'tab'} onClick={() => setLabel(k)}>{n}</button>)}
      </div>
      <div className="toolbar">
        <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }}>
          <Icon name="search" size={15} />
          <input aria-label="Search mail" placeholder="Search mail, e.g. from:anna or has:attachment" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setQuery(''); }} />
          <button className="btn">Search</button>
        </form>
      </div>

      <div className={open ? 'split' : ''}>
        <div>
          {loading && items.length === 0 ? <ListSkeleton /> : (
            <div className="card list">
              {items.map((m) => (
                <div key={m.id} className={`msg ${m.unread ? 'unread' : ''} ${open?.id === m.id ? 'selected' : ''}`} onClick={() => openMsg(m)}
                  role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openMsg(m))}>
                  <span className="pip" aria-label={m.unread ? 'Unread' : undefined} />
                  <span className="from">{m.starred && <Icon name="star" size={13} className="star" />}{shortFrom(label === 'SENT' ? m.to : m.from)}</span>
                  <span className="subj"><b>{m.subject}</b> <span className="muted">{m.snippet && `– ${m.snippet}`}</span></span>
                  <span className="date">{fmtDate(m.date)}</span>
                </div>
              ))}
              {!loading && items.length === 0 && <Empty title={query ? 'No results' : 'Nothing here'} icon="inbox">{query ? 'Try different keywords or clear the search.' : 'There are no messages in this view.'}</Empty>}
              {loading && items.length > 0 && <div className="list-foot muted small">Loading…</div>}
              {next && !loading && <div className="list-foot"><button className="btn btn-sm" onClick={() => load(next)}>Load more</button></div>}
            </div>
          )}
        </div>
        {open && <MessageView msg={open} onClose={() => setOpen(null)} onAction={act} onReply={reply} />}
      </div>
    </>
  );
}
