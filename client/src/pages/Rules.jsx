import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../icons.jsx';
import { Badge, Empty, ListSkeleton, PageHeader, Toggle, plural, shortFrom, fmtDate, useConfirm, useToast } from '../ui.jsx';

const blank = { name: '', conditions: { from: '', to: '', subject: '', contains: '', excludes: '' }, actions: { label: '', markRead: false, star: false, archive: false, trash: false, autoReplyTemplate: '' } };
const COND_LABEL = { from: 'From', to: 'To', subject: 'Subject', contains: 'Subject or preview', excludes: 'Not containing' };
const ACTION_LABEL = { markRead: 'Mark as read', star: 'Star', archive: 'Archive', trash: 'Move to trash' };

const describe = (r, templates) => {
  const c = Object.entries(r.conditions || {}).filter(([, v]) => v).map(([k, v]) => `${COND_LABEL[k]}: ${v}`);
  const a = [];
  if (r.actions.label) a.push(`Label “${r.actions.label}”`);
  Object.keys(ACTION_LABEL).forEach((k) => r.actions[k] && a.push(ACTION_LABEL[k]));
  if (r.actions.autoReplyTemplate) a.push(`Reply with “${templates.find((t) => t._id === r.actions.autoReplyTemplate)?.name || 'template'}”`);
  return { c: c.join('  ·  '), a: a.join('  ·  ') };
};

export default function Rules() {
  const [rules, setRules] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [testing, setTesting] = useState(false);
  const [filter, setFilter] = useState('');
  const { toast } = useToast();
  const confirm = useConfirm();

  const load = () => api('/rules').then(setRules).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); api('/templates').then(setTemplates).catch(() => {}); }, []);

  const close = () => { setForm(null); setEditId(null); setPreview(null); };
  const normalise = (r) => ({ name: r.name, conditions: { ...blank.conditions, ...r.conditions }, actions: { ...blank.actions, ...r.actions, autoReplyTemplate: r.actions.autoReplyTemplate || '' } });
  const edit = (r) => { setEditId(r._id); setPreview(null); setForm(normalise(r)); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const duplicate = (r) => { setEditId(null); setPreview(null); setForm({ ...normalise(r), name: `${r.name} (copy)` }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const setC = (k) => (e) => { setPreview(null); setForm({ ...form, conditions: { ...form.conditions, [k]: e.target.value } }); };
  const setA = (k, v) => setForm({ ...form, actions: { ...form.actions, [k]: v } });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, actions: { ...form.actions, autoReplyTemplate: form.actions.autoReplyTemplate || null } };
      await api(editId ? `/rules/${editId}` : '/rules', { method: editId ? 'PUT' : 'POST', body });
      toast('Rule saved.', 'success'); close(); load();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    try { setPreview(await api('/rules/preview', { method: 'POST', body: { conditions: form.conditions } })); }
    catch (err) { toast(err.message, 'error'); } finally { setTesting(false); }
  };

  const toggle = (id) => api(`/rules/${id}/toggle`, { method: 'PATCH' }).then(load).catch((e) => toast(e.message, 'error'));
  const del = async (r) => {
    if (!(await confirm({ title: `Delete “${r.name}”?`, message: 'The rule will stop running. Mail it already handled is not affected.', confirmLabel: 'Delete rule', danger: true }))) return;
    try { await api(`/rules/${r._id}`, { method: 'DELETE' }); toast('Rule deleted.', 'success'); load(); } catch (e) { toast(e.message, 'error'); }
  };

  const shown = useMemo(() => (rules || []).filter((r) => !filter || r.name.toLowerCase().includes(filter.toLowerCase())), [rules, filter]);

  return (
    <>
      <PageHeader title="Rules" actions={!form && <button className="btn btn-primary" onClick={() => { setEditId(null); setForm(structuredClone(blank)); }}><Icon name="plus" size={15} />New rule</button>}>
        Rules run on new inbox mail. Within one field, separate alternatives with commas (any can match). Every field you fill in must match.
      </PageHeader>

      {form && (
        <form className="card form" onSubmit={save}>
          <div className="card-head"><h3>{editId ? 'Edit rule' : 'New rule'}</h3></div>
          <label className="field"><span>Rule name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Receipts to Finance label" required maxLength={80} autoFocus /></label>

          <fieldset><legend>When an email matches</legend>
            <div className="grid-2">
              <label className="field"><span>From contains</span><input value={form.conditions.from} onChange={setC('from')} placeholder="newsletter@, substack.com" /></label>
              <label className="field"><span>To contains</span><input value={form.conditions.to} onChange={setC('to')} placeholder="me+billing@example.com" /></label>
              <label className="field"><span>Subject contains</span><input value={form.conditions.subject} onChange={setC('subject')} placeholder="invoice, receipt" /></label>
              <label className="field"><span>Subject or preview contains</span><input value={form.conditions.contains} onChange={setC('contains')} /></label>
            </div>
            <label className="field"><span>Does not contain</span><input value={form.conditions.excludes} onChange={setC('excludes')} placeholder="Words that should stop the rule from matching" /></label>
          </fieldset>

          {preview && (
            <div className="preview-box" role="status">
              <b>{preview.matched === 0 ? 'No matches' : `${plural(preview.matched, 'match', 'matches')}`}</b> in your {preview.checked} most recent inbox emails (last 14 days). Nothing was changed.
              {preview.samples.length > 0 && <ul>{preview.samples.map((m) => <li key={m.id}>{shortFrom(m.from)}: {m.subject} <span className="muted">({fmtDate(m.date)})</span></li>)}</ul>}
            </div>
          )}

          <fieldset><legend>Then</legend>
            <label className="field"><span>Apply label</span><input value={form.actions.label} onChange={(e) => setA('label', e.target.value)} placeholder="Created automatically if it doesn’t exist" maxLength={50} /></label>
            <div className="checks">
              {Object.entries(ACTION_LABEL).map(([k, n]) => (
                <label key={k} className="check"><input type="checkbox" checked={form.actions[k]} onChange={(e) => setA(k, e.target.checked)} />{n}</label>
              ))}
            </div>
            <label className="field"><span>Send an automatic reply</span>
              <select value={form.actions.autoReplyTemplate} onChange={(e) => setA('autoReplyTemplate', e.target.value)}>
                <option value="">Don’t reply</option>
                {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
              <span className="hint">{templates.length ? <>Replies use one of your templates. <Link to="/auto-responder?tab=templates">Manage templates</Link></> : <>You don’t have any templates yet. <Link to="/auto-responder?tab=templates">Create one</Link> to enable automatic replies.</>}</span>
            </label>
          </fieldset>

          <div className="form-actions">
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save rule'}</button>
            <button type="button" className="btn" onClick={test} disabled={testing}>{testing ? 'Testing…' : 'Test against recent mail'}</button>
            <button type="button" className="btn btn-ghost" onClick={close}>Cancel</button>
          </div>
        </form>
      )}

      {!rules ? <ListSkeleton rows={3} /> : rules.length === 0 && !form ? (
        <div className="card"><Empty icon="rules" title="No rules yet" action={<button className="btn btn-primary" onClick={() => setForm(structuredClone(blank))}>Create your first rule</button>}>
          Rules sort your inbox for you: label receipts, archive newsletters or star mail from people who matter.</Empty></div>
      ) : (
        <>
          {rules.length > 5 && <div className="toolbar"><div className="search"><Icon name="search" size={15} /><input aria-label="Filter rules" placeholder="Filter rules by name" value={filter} onChange={(e) => setFilter(e.target.value)} /></div></div>}
          {shown.map((r) => {
            const d = describe(r, templates);
            return (
              <div className={`card rule${r.enabled ? '' : ' off'}`} key={r._id}>
                <div style={{ minWidth: 0 }}>
                  <div className="row tight"><b>{r.name}</b>{!r.enabled && <Badge>Paused</Badge>}</div>
                  <div className="rule-line"><span className="tag">When</span><span>{d.c || '—'}</span></div>
                  <div className="rule-line"><span className="tag">Then</span><span>{d.a}</span></div>
                  <div className="muted small" style={{ marginTop: 6 }}>{r.matchCount ? `Matched ${plural(r.matchCount, 'email')}${r.lastMatchedAt ? `, most recently ${fmtDate(r.lastMatchedAt)}` : ''}` : 'Hasn’t matched any email yet'}</div>
                </div>
                <div className="row tight">
                  <Toggle checked={r.enabled} onChange={() => toggle(r._id)} />
                  <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Edit ${r.name}`} title="Edit" onClick={() => edit(r)}><Icon name="edit" size={15} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Duplicate ${r.name}`} title="Duplicate" onClick={() => duplicate(r)}><Icon name="copy" size={15} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Delete ${r.name}`} title="Delete" onClick={() => del(r)}><Icon name="trash" size={15} /></button>
                </div>
              </div>
            );
          })}
          {shown.length === 0 && rules.length > 0 && <div className="card"><Empty icon="search" title="No matching rules">Nothing matches “{filter}”.</Empty></div>}
        </>
      )}
    </>
  );
}
