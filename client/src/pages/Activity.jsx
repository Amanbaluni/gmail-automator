import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ACTIVITY_TYPES, Badge, Empty, ListSkeleton, PageHeader, fmtFull, useToast } from '../ui.jsx';

export default function Activity() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const { toast } = useToast();
  useEffect(() => { setData(null); api(`/activity?page=${page}`).then(setData).catch((e) => toast(e.message, 'error')); }, [page]);

  return (
    <>
      <PageHeader title="Activity log">A record of everything MailPilot did on your behalf. Entries are removed after 90 days.</PageHeader>
      {!data ? <ListSkeleton rows={6} /> : data.items.length === 0 ? (
        <div className="card"><Empty icon="activity" title="No activity yet">When your rules and auto-responder take action, you’ll see it here.</Empty></div>
      ) : (
        <div className="card table-wrap"><table>
          <thead><tr><th>When</th><th>Type</th><th>What happened</th></tr></thead>
          <tbody>{data.items.map((a) => {
            const [label, tone] = ACTIVITY_TYPES[a.type] || [a.type, ''];
            return <tr key={a._id}><td className="nowrap muted small">{fmtFull(a.createdAt)}</td><td><Badge tone={tone}>{label}</Badge></td><td>{a.message}</td></tr>;
          })}</tbody>
        </table></div>
      )}
      {data && data.pages > 1 && (
        <div className="row between">
          <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</button>
          <span className="muted small">Page {data.page} of {data.pages}</span>
          <button className="btn" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Older</button>
        </div>
      )}
    </>
  );
}
