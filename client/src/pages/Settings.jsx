import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../theme.jsx';
import { Icon } from '../icons.jsx';
import { ListSkeleton, PageHeader, Toggle, useConfirm, useToast } from '../ui.jsx';

export default function Settings() {
  const { setUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [s, setS] = useState(null);
  const [signature, setSignature] = useState('');
  const [savingSig, setSavingSig] = useState(false);
  const { toast } = useToast();
  const confirm = useConfirm();
  useEffect(() => { api('/settings').then((d) => { setS(d); setSignature(d.signature || ''); }).catch((e) => toast(e.message, 'error')); }, []);

  const toggle = async (v) => {
    try { setS(await api('/settings', { method: 'PUT', body: { automationEnabled: v } })); toast(v ? 'Automation is on.' : 'Automation is paused.', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  };

  const saveSignature = async (e) => {
    e.preventDefault();
    setSavingSig(true);
    try { setS(await api('/settings', { method: 'PUT', body: { signature } })); toast('Signature saved.', 'success'); }
    catch (err) { toast(err.message, 'error'); } finally { setSavingSig(false); }
  };

  const destroy = async () => {
    if (!(await confirm({
      title: 'Disconnect and delete your data?',
      message: 'This revokes MailPilot’s access to your Google account and permanently deletes your rules, templates, scheduled emails and activity log. Your Gmail messages are not affected. This can’t be undone.',
      confirmLabel: 'Delete my data', danger: true,
    }))) return;
    try { await api('/settings/account', { method: 'DELETE' }); setUser(null); }
    catch (e) { toast(e.message, 'error'); }
  };

  if (!s) return <><PageHeader title="Settings" /><ListSkeleton rows={3} /></>;
  return (
    <>
      <PageHeader title="Settings">Manage how MailPilot looks, writes and runs for your account.</PageHeader>

      <div className="card">
        <div className="card-head"><h3>Appearance</h3></div>
        <div className="row between wrap tight">
          <div><b>Theme</b><div className="muted small">Choose how MailPilot looks on this device.</div></div>
          <div className="segmented" role="group" aria-label="Theme">
            <button className={theme === 'light' ? 'active' : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Icon name="sun" size={14} style={{ verticalAlign: -2 }} /> Light</button>
            <button className={theme === 'dark' ? 'active' : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Icon name="moon" size={14} style={{ verticalAlign: -2 }} /> Dark</button>
          </div>
        </div>
      </div>

      <form className="card form" onSubmit={saveSignature}>
        <div className="card-head"><h3>Email signature</h3></div>
        <label className="field"><span className="label">Added to the end of new messages you write in MailPilot</span>
          <textarea rows={4} value={signature} onChange={(e) => setSignature(e.target.value)} maxLength={1000} placeholder={'Jane Doe\nProduct Manager, Acme Inc.'} /></label>
        <div className="form-actions"><button className="btn btn-primary" disabled={savingSig || signature === (s.signature || '')}>{savingSig ? 'Saving…' : 'Save signature'}</button></div>
      </form>

      <div className="card">
        <div className="card-head"><h3>Automation</h3></div>
        <Toggle checked={s.automationEnabled} onChange={toggle} label={s.automationEnabled ? 'Rules and auto-responder are running' : 'Paused. No rules or automatic replies will run'} />
        <p className="muted small" style={{ margin: '0.6rem 0 0' }}>Pausing doesn’t affect emails you’ve already scheduled.</p>
      </div>

      <div className="card">
        <div className="card-head"><h3>Account</h3></div>
        <p style={{ marginBottom: '0.25rem' }}>Signed in as <b>{s.email}</b></p>
        <p className="muted small" style={{ margin: 0 }}>You can review or remove MailPilot’s access at any time in your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer noopener">Google Account permissions</a>.</p>
      </div>

      <div className="card danger">
        <div className="card-head"><h3>Delete account data</h3></div>
        <p className="muted">Disconnect Gmail and erase everything MailPilot has stored about you.</p>
        <button className="btn btn-danger" onClick={destroy}>Disconnect and delete my data</button>
      </div>
    </>
  );
}
