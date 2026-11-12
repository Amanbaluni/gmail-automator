import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { Badge, Empty, ListSkeleton, Notice, PageHeader, Toggle, fmtFull, useConfirm, useToast } from '../ui.jsx';

const PLACEHOLDERS = [['{{sender_name}}', 'Sender’s name'], ['{{sender_email}}', 'Sender’s address'], ['{{subject}}', 'Original subject']];
const COOLDOWNS = [[1, 'Once a day'], [2, 'Every 2 days'], [4, 'Every 4 days (recommended)'], [7, 'Once a week'], [14, 'Every 2 weeks'], [30, 'Once a month']];

const pad = (n) => String(n).padStart(2, '0');
const toDay = (v) => {
  if (!v) return '';
  if (typeof v === 'string' && /T00:00:00\.000Z$/.test(v)) return v.slice(0, 10); // dates saved by older versions (midnight UTC)
  const d = new Date(v);
  return isNaN(d) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const startIso = (day) => (day ? new Date(`${day}T00:00:00`).toISOString() : '');
const endIso = (day) => (day ? new Date(`${day}T23:59:59.999`).toISOString() : '');
const shortDay = (day) => new Date(`${day}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

function insertAt(el, text, value, set) {
  if (!el) return set(`${value}${text}`);
  const a = el.selectionStart ?? value.length, b = el.selectionEnd ?? value.length;
  set(value.slice(0, a) + text + value.slice(b));
  requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + text.length, a + text.length); });
}

function statusOf(f) {
  if (!f.enabled) return { tone: '', text: 'Off. No automatic replies are being sent.' };
  const today = toDay(new Date());
  if (f.startDate && today < f.startDate) return { tone: 'info', text: `Scheduled to start on ${shortDay(f.startDate)}.` };
  if (f.endDate && today > f.endDate) return { tone: 'warn', text: `Ended on ${shortDay(f.endDate)}. Extend the end date to keep replying.` };
  return { tone: 'ok', text: f.endDate ? `On now, until the end of ${shortDay(f.endDate)}.` : 'On now, with no end date.' };
}

/* ---------------- Out of office ---------------- */
function OutOfOffice({ f, setF, templates, onSaved }) {
  const { toast } = useToast();
  const bodyRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const st = statusOf(f);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/settings', {
        method: 'PUT',
        body: { autoResponder: { ...f, startDate: startIso(f.startDate), endDate: endIso(f.endDate) } },
      });
      toast('Auto-responder saved.', 'success');
      onSaved?.();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  };

  const fromTemplate = (id) => {
    const t = templates.find((x) => x._id === id);
    if (t) setF({ ...f, body: t.body, subject: f.subject || '' });
  };

  return (
    <form className="card form" onSubmit={save}>
      <div className="card-head">
        <Toggle checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label={f.enabled ? 'Auto-responder is on' : 'Auto-responder is off'} />
        <Badge tone={st.tone} dot>{st.text}</Badge>
      </div>

      <div className="grid-2">
        <label className="field"><span>Start date</span>
          <input type="date" value={f.startDate} onChange={set('startDate')} />
          <span className="hint">Leave empty to start straight away.</span></label>
        <label className="field"><span>End date</span>
          <input type="date" value={f.endDate} min={f.startDate || undefined} onChange={set('endDate')} />
          <span className="hint">Replies continue through the end of this day. Leave empty for no end.</span></label>
      </div>

      <label className="field"><span>Subject line <span className="hint">(optional)</span></span>
        <input value={f.subject} onChange={set('subject')} maxLength={200} placeholder="Defaults to “Re:” followed by the original subject" />
        <span className="hint">Keeping the default keeps your reply in the same conversation.</span></label>

      <div className="field">
        <div className="row between tight">
          <label htmlFor="ar-body" className="label">Reply message</label>
          {templates.length > 0 && (
            <select aria-label="Start from a template" style={{ width: 'auto', minWidth: 190 }} value="" onChange={(e) => fromTemplate(e.target.value)}>
              <option value="">Start from a template…</option>
              {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          )}
        </div>
        <textarea id="ar-body" ref={bodyRef} rows={9} value={f.body} onChange={set('body')}
          placeholder={'Hi {{sender_name}},\n\nThanks for your message. I’m away until Monday and will reply when I’m back.\n\nBest regards'} />
        <div className="placeholders">
          <span className="hint">Insert:</span>
          {PLACEHOLDERS.map(([p, n]) => <button type="button" key={p} title={n} onClick={() => insertAt(bodyRef.current, p, f.body, (v) => setF({ ...f, body: v }))}>{p}</button>)}
        </div>
      </div>

      <fieldset>
        <legend>Fine-tuning</legend>
        <label className="field"><span>How often to reply to the same person</span>
          <select value={f.cooldownDays} onChange={(e) => setF({ ...f, cooldownDays: Number(e.target.value) })} style={{ maxWidth: 300 }}>
            {COOLDOWNS.map(([d, n]) => <option key={d} value={d}>{n}</option>)}
          </select></label>
        <label className="check"><input type="checkbox" checked={f.onlyDirect} onChange={set('onlyDirect')} />Only reply to mail sent directly to me (skip Cc and mailing lists)</label>
        <label className="field"><span>Never reply to these senders</span>
          <textarea rows={2} value={f.skipSenders} onChange={set('skipSenders')} placeholder="family@example.com, mycompany.com" />
          <span className="hint">Separate addresses or whole domains with commas. Newsletters and no-reply addresses are always skipped.</span></label>
      </fieldset>

      <div className="form-actions"><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
    </form>
  );
}

/* ---------------- Templates ---------------- */
function Templates({ templates, reload, onUse }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef(null);
  const { toast } = useToast();
  const confirm = useConfirm();

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api(form._id ? `/templates/${form._id}` : '/templates', { method: form._id ? 'PUT' : 'POST', body: form });
      toast('Template saved.', 'success'); setForm(null); reload();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  };
  const del = async (t) => {
    if (!(await confirm({ title: `Delete “${t.name}”?`, message: 'Rules that reply with this template will stop sending that reply.', confirmLabel: 'Delete template', danger: true }))) return;
    try { await api(`/templates/${t._id}`, { method: 'DELETE' }); toast('Template deleted.', 'success'); reload(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <>
      <div className="row between wrap">
        <p className="muted" style={{ margin: 0, maxWidth: '62ch' }}>
          Reusable replies you can use in your out-of-office message, in <Link to="/rules">rules</Link> that reply automatically, and when composing.
        </p>
        {!form && <button className="btn btn-primary" onClick={() => setForm({ name: '', subject: '', body: '' })}><Icon name="plus" size={15} />New template</button>}
      </div>
      <div style={{ height: '1rem' }} />

      {form && (
        <form className="card form" onSubmit={save}>
          <div className="card-head"><h3>{form._id ? 'Edit template' : 'New template'}</h3></div>
          <label className="field"><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={80} placeholder="e.g. Out of office, Thanks for reaching out" autoFocus /></label>
          <label className="field"><span>Subject <span className="hint">(optional, used when composing)</span></span><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={200} /></label>
          <div className="field">
            <label htmlFor="tpl-body" className="label">Message</label>
            <textarea id="tpl-body" ref={bodyRef} rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
            <div className="placeholders"><span className="hint">Insert:</span>
              {PLACEHOLDERS.map(([p, n]) => <button type="button" key={p} title={n} onClick={() => insertAt(bodyRef.current, p, form.body, (v) => setForm({ ...form, body: v }))}>{p}</button>)}
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save template'}</button>
            <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      {templates.length === 0 && !form ? (
        <div className="card"><Empty icon="template" title="No templates yet" action={<button className="btn btn-primary" onClick={() => setForm({ name: '', subject: '', body: '' })}>Create your first template</button>}>
          Save the replies you send most often, then reuse them in a click.</Empty></div>
      ) : templates.map((t) => (
        <div className="card template-card" key={t._id}>
          <div className="row between tight">
            <div><b>{t.name}</b>{t.subject && <div className="muted small">Subject: {t.subject}</div>}</div>
            <div className="row tight">
              <button className="btn btn-sm" onClick={() => onUse(t)}>Use as out-of-office reply</button>
              <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Edit ${t.name}`} onClick={() => setForm(t)}><Icon name="edit" size={15} /></button>
              <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Delete ${t.name}`} onClick={() => del(t)}><Icon name="trash" size={15} /></button>
            </div>
          </div>
          <pre>{t.body}</pre>
        </div>
      ))}
    </>
  );
}

/* ---------------- Page ---------------- */
export default function AutoResponder() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'templates' ? 'templates' : 'away';
  const [f, setF] = useState(null);
  const [templates, setTemplates] = useState(null);
  const { toast } = useToast();

  const loadTemplates = () => api('/templates').then(setTemplates).catch((e) => toast(e.message, 'error'));
  const loadSettings = () => api('/settings').then((s) => {
    const a = s.autoResponder || {};
    setF({
      enabled: !!a.enabled, body: a.body || '', subject: a.subject || '',
      startDate: toDay(a.startDate), endDate: toDay(a.endDate),
      cooldownDays: a.cooldownDays || 4, onlyDirect: !!a.onlyDirect, skipSenders: (a.skipSenders || []).join(', '),
    });
  }).catch((e) => toast(e.message, 'error'));
  useEffect(() => { loadSettings(); loadTemplates(); }, []);

  const go = (t) => setParams(t === 'templates' ? { tab: 'templates' } : {}, { replace: true });
  const useTemplate = (t) => {
    setF((p) => ({ ...p, body: t.body }));
    go('away');
    toast(`“${t.name}” added to your out-of-office message. Save to apply it.`, 'success');
  };

  return (
    <>
      <PageHeader title="Auto-responder">Reply automatically while you're away, and keep your reusable replies in one place.</PageHeader>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'away'} className={`tab${tab === 'away' ? ' active' : ''}`} onClick={() => go('away')}>Out of office</button>
        <button role="tab" aria-selected={tab === 'templates'} className={`tab${tab === 'templates' ? ' active' : ''}`} onClick={() => go('templates')}>Templates{templates ? ` (${templates.length})` : ''}</button>
      </div>
      {!f || !templates ? <ListSkeleton rows={4} /> : tab === 'away' ? (
        <>
          <Notice>Replies go out shortly after new mail arrives. Each sender gets at most one reply per cooldown period, and newsletters, no-reply addresses and automated mail are always skipped.</Notice>
          <OutOfOffice f={f} setF={setF} templates={templates} onSaved={loadSettings} />
        </>
      ) : <Templates templates={templates} reload={loadTemplates} onUse={useTemplate} />}
    </>
  );
}
