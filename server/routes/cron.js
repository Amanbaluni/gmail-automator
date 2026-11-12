const router = require('express').Router();
const crypto = require('crypto');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { runForUser, runScheduled } = require('../lib/automation');
const { wrap } = require('../lib/util');

const safeEq = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Called by Vercel Cron (daily) and optionally by GitHub Actions / cron-job.org (every 5 min)
router.get('/run', wrap(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEq(req.get('authorization') || '', `Bearer ${secret}`)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const deadline = Date.now() + 50000;
  const scheduledSent = await runScheduled(deadline);
  const users = await User.find({ automationEnabled: true }).sort({ lastRunAt: 1 });
  let processed = 0, errors = 0;
  for (const u of users) {
    if (Date.now() > deadline) break;
    try {
      await runForUser(u);
      processed++;
    } catch (e) {
      errors++;
      if (/invalid_grant/i.test(e.message)) {
        await User.updateOne({ _id: u._id }, { automationEnabled: false });
        await ActivityLog.create({ user: u._id, type: 'system', message: 'Your Google connection expired or was revoked, so automation has been paused. Sign in again and turn it back on in Settings.' });
      } else {
        console.error('cron user failed', u.id, e.message);
      }
    }
  }
  res.json({ scheduledSent, usersProcessed: processed, errors });
}));

module.exports = router;
