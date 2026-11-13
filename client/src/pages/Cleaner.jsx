import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { Empty, ListSkeleton, PageHeader, plural, useConfirm, useToast } from '../ui.jsx';

const PRESETS = [
  ['Promotions', 'category:promotions in:inbox'],
  ['Social', 'category:social in:inbox'],
  ['Updates', 'category:updates in:inbox'],
  ['Old and read', 'older_than:30d is:read in:inbox'],
  ['Large mail', 'larger:5M in:inbox'],
];

export default function Cleaner() {
  const [q, setQ] = useState(PRESETS[0][1]);
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const { toast } = useToast();
  const confirm = useConfirm();

  const scan = async (query = q) => {
    setLoading(true);
    try { setRows(await api(`/cleaner/senders?q=${encodeURIComponent(query)}`)); }
    catch (err) { toast(err.message, 'error'); } finally { setLoading(false); }
  };
  useEffect(() => { scan(PRESETS[0][1]); }, []);

  const pick = (query) => { setQ(query); scan(query); };

  const bulk = async (row, action) => {
    const verb = { archive: 'Archive', read: 'Mark as read', trash: 'Move to trash' }[action];
    if (action !== 'read' && !(await confirm({
      title: `${verb} everything from ${row.name}?`,
      message: `This applies to all inbox mail from ${row.email} (up to 500 messages), not only the ${row.count} found in this scan.`,
      confirmLabel: verb, danger: action === 'trash',
    }))) return;
    setBusy(row.email + action);
    try {
      const r = await api('/cleaner/bulk', { method: 'POST', body: { from: row.email, action } });
      toast(`${plural(r.affected, 'email')} from ${row.name} ${action === 'read' ? 'marked as read' : action === 'archive' ? 'archived' : 'moved to trash'}.`, 'success');
      setRows((p) => p.filter((x) => x.email !== row.email));
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(''); }
  };

  return (
    <>
      <PageHeader title="Cleaner">See which senders fill your inbox, then archive, mark as read or delete their mail in one click.</PageHeader>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="What to scan">
          {PRESETS.map(([n, query]) => <button key={n} className={q === query ? 'active' : ''} aria-pressed={q === query} onClick={() => pick(query)} disabled={loading}>{n}</button>)}
        </div>
        <button className="link small" onClick={() => setAdvanced((a) => !a)}>{advanced ? 'Hide custom search' : 'Custom search'}</button>
      </div>
      {advanced && (
        <form className="toolbar" onSubmit={(e) => { e.preventDefault(); scan(); }}>
          <div className="search"><Icon name="search" size={15} /><input aria-label="Gmail search query" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Any Gmail search, e.g. from:news older_than:7d" /></div>
          <button className="btn btn-primary" disabled={loading}>Scan</button>
        </form>
      )}

      {loading || !rows ? <ListSkeleton rows={5} /> : rows.length === 0 ? (
        <div className="card"><Empty icon="checkCircle" title="Nothing to clean here">No senders were found for this search. Try another category above.</Empty></div>
      ) : (
        <>
          <p className="muted small">Based on the {plural(rows.reduce((n, r) => n + r.count, 0), 'most recent email')} matching this search, grouped by sender.</p>
          <div className="card table-wrap"><table>
            <thead><tr><th>Sender</th><th>Emails</th><th>Latest subject</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.email}>
                <td><b>{r.name}</b><div className="muted small">{r.email}</div></td>
                <td className="num" data-label="Emails">{r.count}{r.unread ? <span className="muted small"> · {r.unread} unread</span> : null}</td>
                <td className="clip" data-label="Latest subject">{r.sample}</td>
                <td className="actions">
                  <button className="btn btn-sm" disabled={!!busy} onClick={() => bulk(r, 'archive')}>Archive</button>{' '}
                  <button className="btn btn-sm" disabled={!!busy} onClick={() => bulk(r, 'read')}>Mark read</button>{' '}
                  <button className="btn btn-sm btn-outline-danger" disabled={!!busy} onClick={() => bulk(r, 'trash')}>Delete</button>
                  {r.unsubscribe && <>{' '}<a className="btn btn-sm" href={r.unsubscribe} target="_blank" rel="noreferrer noopener">Unsubscribe</a></>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        </>
      )}
    </>
  );
}
