import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { Badge, Empty, ListSkeleton, PageHeader, fmtFull, useConfirm, useToast } from '../ui.jsx';

const STATUS = { pending: ['Scheduled', 'info'], sending: ['Sending', 'info'], sent: ['Sent', 'ok'], failed: ['Failed', 'danger'] };

export default function Scheduled() {
  const [items, setItems] = useState(null);
  const { toast } = useToast();
  const confirm = useConfirm();
  const load = () => api('/scheduled').then(setItems).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); }, []);

  const cancel = async (m) => {
    if (!(await confirm({ title: 'Cancel this email?', message: `“${m.subject}” to ${m.to} won’t be sent.`, confirmLabel: 'Cancel email', cancelLabel: 'Keep it', danger: true }))) return;
    try { await api(`/scheduled/${m._id}`, { method: 'DELETE' }); toast('Scheduled email cancelled.', 'success'); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <>
      <PageHeader title="Scheduled" actions={<Link className="btn btn-primary" to="/compose"><Icon name="compose" size={15} />New email</Link>}>
        Emails you’ve scheduled go out within a few minutes of the time you chose.
      </PageHeader>
      {!items ? <ListSkeleton rows={4} /> : items.length === 0 ? (
        <div className="card"><Empty icon="clock" title="Nothing scheduled" action={<Link className="btn btn-primary" to="/compose">Write an email</Link>}>
          Choose “Schedule for later” when writing an email and it will show up here.</Empty></div>
      ) : (
        <div className="card table-wrap"><table>
          <thead><tr><th>To</th><th>Subject</th><th>Send time</th><th>Status</th><th /></tr></thead>
          <tbody>{items.map((m) => {
            const [label, tone] = STATUS[m.status] || [m.status, ''];
            return (
              <tr key={m._id}>
                <td>{m.to}</td>
                <td className="clip">{m.subject}</td>
                <td className="nowrap" data-label="Send time">{fmtFull(m.status === 'sent' && m.sentAt ? m.sentAt : m.sendAt)}</td>
                <td><Badge tone={tone} dot>{label}</Badge>{m.status === 'failed' && m.error && <div className="small muted" style={{ maxWidth: 260 }}>{m.error}</div>}</td>
                <td className="actions">{m.status === 'pending' && <button className="btn btn-sm" onClick={() => cancel(m)}>Cancel</button>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </>
  );
}
