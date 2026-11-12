import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import RecipientInput, { EMAIL_RE, splitList } from '../components/RecipientInput.jsx';
import { PageHeader, Spinner, fmtFull, useConfirm, useToast } from '../ui.jsx';

const DRAFT_KEY = 'mailpilot-compose-draft';
const BLANK = { to: '', cc: '', bcc: '', subject: '', body: '' };

const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const quickTimes = () => {
  const now = new Date();
  const inHour = new Date(now.getTime() + 3600e3); inHour.setSeconds(0, 0);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);
  const monday = new Date(now); monday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7)); monday.setHours(9, 0, 0, 0);
  return [['In 1 hour', inHour], ['Tomorrow, 9:00 am', tomorrow], ['Monday, 9:00 am', monday]];
};
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null; } catch { return null; } };
const writeDraft = (d) => { try { d ? localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) : localStorage.removeItem(DRAFT_KEY); } catch { /* storage unavailable */ } };

const SENT_COPY = {
  checking: ['Message sent. Checking for delivery problems…', 'Gmail has accepted your message. This usually takes under a minute.'],
  delivered: ['Message sent', 'Gmail reported no delivery problems.'],
  unknown: ['Message sent', 'Gmail accepted it, but we couldn’t check for delivery problems. Look in your Sent folder to confirm.'],
};

export default function Compose() {
  const { state } = useLocation();
  const nav = useNavigate();
  const { toast } = useToast();
  const confirm = useConfirm();
  const replying = !!state?.threadId;

  const [f, setF] = useState(() => {
    if (state?.to || state?.subject) return { ...BLANK, to: state.to || '', subject: state.subject || '' };
    return { ...BLANK, ...(readDraft() || {}) };
  });
  const [showCc, setShowCc] = useState(() => !!(f.cc || f.bcc));
  const [templates, setTemplates] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [signature, setSignature] = useState(null);
  const [schedule, setSchedule] = useState(false);
  const [sendAt, setSendAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [sent, setSent] = useState(null); // { id, to, subject, state, reason, values }
  const formRef = useRef(null);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: typeof v === 'string' ? v : v.target.value }));

  useEffect(() => {
    api('/templates').then(setTemplates).catch(() => {});
    api('/mail/contacts').then(setContacts).catch(() => {});
    api('/settings').then((s) => setSignature(s.signature || '')).catch(() => setSignature(''));
  }, []);

  // Start new messages with the user's signature
  useEffect(() => {
    if (signature && !replying && !f.body) setF((p) => (p.body ? p : { ...p, body: `\n\n-- \n${signature}` }));
  }, [signature]);

  // Autosave the draft locally (never for replies)
  useEffect(() => {
    if (replying || sent) return undefined;
    const t = setTimeout(() => {
      const hasContent = f.to || f.subject || (f.body && f.body.trim() !== `-- \n${signature}`.trim());
      writeDraft(hasContent ? f : null);
    }, 600);
    return () => clearTimeout(t);
  }, [f, replying, sent, signature]);

  // After sending, poll Gmail for a bounce notice
  useEffect(() => {
    if (!sent || sent.state !== 'checking') return undefined;
    let cancelled = false;
    const at = [5000, 15000, 35000, 70000]; // check again at these moments after sending
    const timers = at.map((ms, i) => setTimeout(async () => {
      if (cancelled) return;
      try {
        const r = await api(`/mail/send-status/${sent.id}`);
        if (cancelled) return;
        if (r.state === 'failed') setSent((s) => s && { ...s, state: 'failed', reason: r.reason });
        else if (r.state === 'delivered' || r.state === 'unknown') setSent((s) => s && { ...s, state: r.state });
        else if (i === at.length - 1) setSent((s) => s && { ...s, state: 'delivered' });
      } catch { if (i === at.length - 1) setSent((s) => s && { ...s, state: 'unknown' }); }
    }, ms));
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [sent?.id, sent?.state]);

  const applyTemplate = async (id) => {
    const t = templates.find((x) => x._id === id);
    if (!t) return;
    const hasText = f.body.trim() && f.body.trim() !== `-- \n${signature}`.trim();
    if (hasText && !(await confirm({ title: 'Replace your message?', message: `Inserting “${t.name}” will replace what you've written so far.`, confirmLabel: 'Replace message' }))) return;
    setF((p) => ({ ...p, subject: p.subject || t.subject, body: signature ? `${t.body}\n\n-- \n${signature}` : t.body }));
  };

  const submit = useCallback(async (e) => {
    e?.preventDefault();
    if (busy) return;
    const all = [...splitList(f.to), ...splitList(f.cc), ...splitList(f.bcc)];
    if (!splitList(f.to).length) return toast('Add at least one recipient.', 'error');
    const bad = all.find((x) => !EMAIL_RE.test(x));
    if (bad) return toast(`“${bad}” doesn't look like a valid email address.`, 'error');
    if (schedule && !sendAt) return toast('Choose when the email should be sent.', 'error');
    if (!f.subject.trim() && !(await confirm({ title: 'Send without a subject?', message: 'This message has no subject line.', confirmLabel: schedule ? 'Schedule anyway' : 'Send anyway' }))) return;

    setBusy(true);
    try {
      if (schedule) {
        await api('/scheduled', { method: 'POST', body: { ...f, sendAt: new Date(sendAt).toISOString() } });
        writeDraft(null);
        toast(`Email scheduled for ${fmtFull(sendAt)}.`, 'success');
        nav('/scheduled');
      } else {
        const r = await api('/mail/send', { method: 'POST', body: { ...f, threadId: state?.threadId, inReplyTo: state?.inReplyTo } });
        writeDraft(null);
        setContacts((prev) => {
          const have = new Set(prev.map((c) => c.email.toLowerCase()));
          return [...all.filter((a) => !have.has(a.toLowerCase())).map((email) => ({ email, name: '', sent: 1 })), ...prev];
        });
        setSent({ id: r.id, to: f.to, subject: f.subject, state: 'checking', values: f });
      }
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }, [f, busy, schedule, sendAt, state, signature]);

  // Ctrl/Cmd + Enter sends
  const onKeyDown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit(e); };

  const reset = () => { setSent(null); setF({ ...BLANK, body: signature ? `\n\n-- \n${signature}` : '' }); setShowCc(false); };
  const edit = () => { setF(sent.values); setSent(null); };

  const min = toLocalInput(new Date(Date.now() + 60000));

  if (sent) {
    const copy = SENT_COPY[sent.state];
    return (
      <div className="compose">
        <PageHeader title={replying ? 'Reply' : 'Compose'} />
        <div className={`send-status ${sent.state === 'failed' ? 'failed' : sent.state === 'checking' ? '' : 'ok'}`} role="status">
          <span className="ss-icon">{sent.state === 'checking' ? <Spinner inline /> : <Icon name={sent.state === 'failed' ? 'alert' : 'check'} size={16} strokeWidth={2.2} />}</span>
          <div>
            {sent.state === 'failed' ? (
              <>
                <b>This email couldn’t be delivered</b>
                <div className="muted small">Gmail reported: {(sent.reason || 'the recipient’s mail server rejected the message').replace(/[.\s]+$/, '')}. Check the address for typos, then edit and send again.</div>
              </>
            ) : (
              <>
                <b>{copy[0]}</b>
                <div className="muted small">To {sent.to}. {copy[1]}</div>
              </>
            )}
            <div className="row wrap" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
              {sent.state === 'failed' && <button className="btn btn-primary btn-sm" onClick={edit}>Edit and resend</button>}
              <button className="btn btn-sm" onClick={reset}>{sent.state === 'failed' ? 'Start a new message' : 'Write another'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => nav('/inbox')}>Back to inbox</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="compose">
      <PageHeader title={replying ? 'Reply' : 'Compose'} actions={replying && <span className="badge info"><Icon name="reply" size={12} />Replying in thread</span>}>
        {!replying && 'Start typing a name or address and your contacts appear as suggestions.'}
      </PageHeader>
      <form ref={formRef} className="card form" onSubmit={submit} onKeyDown={onKeyDown} noValidate>
        <div className="compose-row">
          <span className="label">To</span>
          <div>
            <RecipientInput label="To" value={f.to} onChange={set('to')} contacts={contacts} placeholder="Name or email address" autoFocus={!f.to} onInvalidChange={setInvalid} />
            {!showCc && <button type="button" className="link small" style={{ marginTop: 6 }} onClick={() => setShowCc(true)}>Add Cc or Bcc</button>}
          </div>
        </div>
        {showCc && (
          <>
            <div className="compose-row"><span className="label">Cc</span><RecipientInput label="Cc" value={f.cc} onChange={set('cc')} contacts={contacts} /></div>
            <div className="compose-row"><span className="label">Bcc</span><RecipientInput label="Bcc" value={f.bcc} onChange={set('bcc')} contacts={contacts} /></div>
          </>
        )}
        <div className="compose-row">
          <span className="label">Subject</span>
          <input aria-label="Subject" value={f.subject} onChange={set('subject')} maxLength={300} />
        </div>
        {templates.length > 0 && (
          <div className="compose-row">
            <span className="label">Template</span>
            <select aria-label="Insert a template" value="" onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">Insert a saved reply…</option>
              {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <textarea aria-label="Message" rows={14} value={f.body} onChange={set('body')} placeholder="Write your message…" style={{ marginTop: '0.35rem' }} />

        <hr className="divider" />
        <label className="check"><input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} />Schedule for later</label>
        {schedule && (
          <div style={{ marginBottom: '0.75rem' }}>
            <input type="datetime-local" aria-label="Send date and time" value={sendAt} min={min} onChange={(e) => setSendAt(e.target.value)} style={{ maxWidth: 260 }} />
            <div className="quick-times">
              {quickTimes().map(([n, d]) => <button type="button" key={n} className="btn btn-sm" onClick={() => setSendAt(toLocalInput(d))}>{n}</button>)}
            </div>
          </div>
        )}

        <div className="compose-actions">
          <button className="btn btn-primary" disabled={busy || invalid}>
            {busy ? <><Spinner inline />{schedule ? 'Scheduling…' : 'Sending…'}</> : <><Icon name={schedule ? 'clock' : 'send'} size={15} />{schedule ? 'Schedule email' : 'Send'}</>}
          </button>
          {!replying && (f.to || f.subject) && <button type="button" className="btn btn-ghost" onClick={() => { setF({ ...BLANK }); writeDraft(null); setShowCc(false); }}>Discard draft</button>}
          <span className="hint" style={{ marginLeft: 'auto' }}>{invalid ? 'Fix the highlighted address to continue' : 'Ctrl + Enter to send'}</span>
        </div>
      </form>
    </div>
  );
}
