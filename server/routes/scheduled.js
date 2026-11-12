const router = require('express').Router();
const ScheduledEmail = require('../models/ScheduledEmail');
const { requireAuth } = require('../middleware/auth');
const { wrap, httpError, parseRecipients } = require('../lib/util');

router.use(requireAuth);

router.get('/', wrap(async (req, res) => {
  res.json(await ScheduledEmail.find({ user: req.user._id }).sort({ sendAt: -1 }).limit(100));
}));

router.post('/', wrap(async (req, res) => {
  const { to, cc, bcc, subject, body, sendAt } = req.body;
  parseRecipients(to, { required: true });
  parseRecipients(cc);
  parseRecipients(bcc);
  const when = new Date(sendAt);
  if (isNaN(when) || when.getTime() < Date.now() + 30000) throw httpError(400, 'Choose a send time at least one minute from now.');
  if (when.getTime() > Date.now() + 365 * 86400000) throw httpError(400, 'Emails can be scheduled up to one year ahead.');
  if ((await ScheduledEmail.countDocuments({ user: req.user._id, status: 'pending' })) >= 100) throw httpError(400, 'You have 100 emails waiting to send. Cancel one or wait for some to go out.');
  const doc = await ScheduledEmail.create({
    user: req.user._id, to, cc, bcc,
    subject: String(subject || '(no subject)').slice(0, 300),
    body: String(body || '').slice(0, 100000),
    sendAt: when,
  });
  res.status(201).json(doc);
}));

router.delete('/:id', wrap(async (req, res) => {
  const r = await ScheduledEmail.deleteOne({ _id: req.params.id, user: req.user._id, status: 'pending' });
  if (!r.deletedCount) throw httpError(404, 'Only emails that haven\'t been sent yet can be cancelled.');
  res.json({ ok: true });
}));

module.exports = router;
