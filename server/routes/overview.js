const router = require('express').Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const { gmailFor } = require('../lib/google');
const { runForUser } = require('../lib/automation');
const { wrap } = require('../lib/util');
const Rule = require('../models/Rule');
const ScheduledEmail = require('../models/ScheduledEmail');
const ActivityLog = require('../models/ActivityLog');

router.use(requireAuth);

router.get('/stats', wrap(async (req, res) => {
  const uid = new mongoose.Types.ObjectId(req.user.id);
  const since = new Date(Date.now() - 6 * 86400000);
  since.setUTCHours(0, 0, 0, 0);

  const inboxP = gmailFor(req.user).users.labels
    .get({ userId: 'me', id: 'INBOX' })
    .then((r) => ({ total: r.data.messagesTotal, unread: r.data.messagesUnread }))
    .catch(() => null);

  const [inbox, rulesActive, rulesTotal, scheduled, perDay, recent] = await Promise.all([
    inboxP,
    Rule.countDocuments({ user: uid, enabled: true }),
    Rule.countDocuments({ user: uid }),
    ScheduledEmail.countDocuments({ user: uid, status: 'pending' }),
    ActivityLog.aggregate([
      { $match: { user: uid, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
    ]),
    ActivityLog.find({ user: uid }).sort({ createdAt: -1 }).limit(6),
  ]);

  const counts = Object.fromEntries(perDay.map((d) => [d._id, d.n]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10);
    return { date: d, count: counts[d] || 0 };
  });

  res.json({
    inbox, rulesActive, rulesTotal, scheduled, days, recent,
    automationEnabled: req.user.automationEnabled,
    lastRunAt: req.user.lastRunAt,
  });
}));

router.post('/automation/run', wrap(async (req, res) => {
  const hours = Math.min(168, Math.max(1, Number(req.body.hours) || 24));
  res.json(await runForUser(req.user, { hours }));
}));

router.get('/activity', wrap(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 25;
  const filter = { user: req.user._id };
  const [items, total] = await Promise.all([
    ActivityLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    ActivityLog.countDocuments(filter),
  ]);
  res.json({ items, page, pages: Math.max(1, Math.ceil(total / limit)), total });
}));

module.exports = router;
