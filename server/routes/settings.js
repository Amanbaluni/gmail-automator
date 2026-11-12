const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { oauthClient } = require('../lib/google');
const { decrypt } = require('../lib/crypto');
const { wrap, httpError } = require('../lib/util');
const User = require('../models/User');
const Rule = require('../models/Rule');
const Template = require('../models/Template');
const ScheduledEmail = require('../models/ScheduledEmail');
const ActivityLog = require('../models/ActivityLog');
const ReplyLog = require('../models/ReplyLog');

router.use(requireAuth);

const AR_DEFAULTS = { enabled: false, body: '', subject: '', cooldownDays: 4, onlyDirect: false, skipSenders: [] };
const pub = (u) => {
  const ar = u.autoResponder?.toObject ? u.autoResponder.toObject() : u.autoResponder || {};
  const pr = u.priority?.toObject ? u.priority.toObject() : u.priority || {};
  return {
    email: u.email,
    automationEnabled: u.automationEnabled,
    signature: u.signature || '',
    autoResponder: { ...AR_DEFAULTS, ...ar },
    priority: { vip: pr.vip || [], muted: pr.muted || [], keywords: pr.keywords || [] },
  };
};

// "a@b.com, c@d.com" or an array -> unique lowercase list
const list = (v, max, len = 120) => {
  const arr = Array.isArray(v) ? v : String(v || '').split(/[,\n;]/);
  return [...new Set(arr.map((x) => String(x).trim().toLowerCase().slice(0, len)).filter(Boolean))].slice(0, max);
};

router.get('/', (req, res) => res.json(pub(req.user)));

router.put('/', wrap(async (req, res) => {
  const u = req.user;
  if (typeof req.body.automationEnabled === 'boolean') u.automationEnabled = req.body.automationEnabled;
  if (typeof req.body.signature === 'string') u.signature = req.body.signature.slice(0, 1000);

  const pr = req.body.priority;
  if (pr) {
    u.priority = {
      vip: list(pr.vip, 100),
      muted: list(pr.muted, 100),
      keywords: list(pr.keywords, 30, 40),
    };
  }

  const ar = req.body.autoResponder;
  if (ar) {
    const date = (v) => {
      if (!v) return undefined;
      const d = new Date(v);
      if (isNaN(d)) throw httpError(400, 'One of the dates isn\'t valid. Please pick it again.');
      return d;
    };
    const body = String(ar.body || '').slice(0, 5000);
    if (ar.enabled && !body.trim()) throw httpError(400, 'Write the reply message before turning the auto-responder on.');
    const start = date(ar.startDate), end = date(ar.endDate);
    if (start && end && end < start) throw httpError(400, 'The end date must be after the start date.');
    const cooldown = Math.round(Number(ar.cooldownDays));
    u.autoResponder = {
      enabled: !!ar.enabled,
      body,
      startDate: start,
      endDate: end,
      subject: String(ar.subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200),
      cooldownDays: Math.min(30, Math.max(1, Number.isFinite(cooldown) ? cooldown : 4)),
      onlyDirect: !!ar.onlyDirect,
      skipSenders: list(ar.skipSenders, 50),
    };
  }
  await u.save();
  res.json(pub(u));
}));

router.delete('/account', wrap(async (req, res) => {
  const u = req.user;
  try {
    await oauthClient().revokeToken(decrypt(u.refreshToken)); // revoke Google access
  } catch (e) { /* token may already be revoked */ }
  await Promise.all([
    Rule.deleteMany({ user: u._id }), Template.deleteMany({ user: u._id }),
    ScheduledEmail.deleteMany({ user: u._id }), ActivityLog.deleteMany({ user: u._id }),
    ReplyLog.deleteMany({ user: u._id }), User.deleteOne({ _id: u._id }),
  ]);
  res.clearCookie('token');
  res.json({ ok: true });
}));

module.exports = router;
