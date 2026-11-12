const router = require('express').Router();
const mongoose = require('mongoose');
const Rule = require('../models/Rule');
const Template = require('../models/Template');
const { requireAuth } = require('../middleware/auth');
const { wrap, httpError } = require('../lib/util');
const { gmailFor } = require('../lib/google');
const { listSummaries } = require('../lib/gmail');
const { matches } = require('../lib/automation');

router.use(requireAuth);

const s = (v, n = 200) => String(v ?? '').trim().slice(0, n);

async function clean(body, userId) {
  const c = body.conditions || {}, a = body.actions || {};
  const r = {
    name: s(body.name, 80),
    enabled: body.enabled !== false,
    conditions: { from: s(c.from), to: s(c.to), subject: s(c.subject), contains: s(c.contains), excludes: s(c.excludes) },
    actions: { label: s(a.label, 50), markRead: !!a.markRead, star: !!a.star, archive: !!a.archive, trash: !!a.trash, autoReplyTemplate: null },
  };
  if (a.autoReplyTemplate) {
    if (!mongoose.isValidObjectId(a.autoReplyTemplate) || !(await Template.exists({ _id: a.autoReplyTemplate, user: userId })))
      throw httpError(400, 'That template no longer exists.');
    r.actions.autoReplyTemplate = a.autoReplyTemplate;
  }
  if (!r.name) throw httpError(400, 'Give the rule a name.');
  if (!Object.values(r.conditions).some(Boolean)) throw httpError(400, 'Add at least one condition so the rule knows which emails to match.');
  const x = r.actions;
  if (!(x.label || x.markRead || x.star || x.archive || x.trash || x.autoReplyTemplate)) throw httpError(400, 'Choose at least one thing for the rule to do.');
  return r;
}

// Dry run: shows which recent inbox mail a rule would match, without changing anything
router.post('/preview', wrap(async (req, res) => {
  const c = req.body.conditions || {};
  const conditions = { from: s(c.from), to: s(c.to), subject: s(c.subject), contains: s(c.contains), excludes: s(c.excludes) };
  if (!Object.values(conditions).some(Boolean)) throw httpError(400, 'Add at least one condition to test.');
  const { messages } = await listSummaries(gmailFor(req.user), { q: 'in:inbox newer_than:14d', max: 50 });
  const hits = messages.filter((m) => matches({ conditions }, m));
  res.json({
    checked: messages.length,
    matched: hits.length,
    samples: hits.slice(0, 5).map((m) => ({ id: m.id, from: m.from, subject: m.subject, date: m.date })),
  });
}));

router.get('/', wrap(async (req, res) => {
  res.json(await Rule.find({ user: req.user._id }).sort({ createdAt: -1 }));
}));

router.post('/', wrap(async (req, res) => {
  if ((await Rule.countDocuments({ user: req.user._id })) >= 50) throw httpError(400, 'You\'ve reached the limit of 50 rules. Delete one to add another.');
  res.status(201).json(await Rule.create({ ...(await clean(req.body, req.user._id)), user: req.user._id }));
}));

router.put('/:id', wrap(async (req, res) => {
  const rule = await Rule.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, await clean(req.body, req.user._id), { new: true });
  if (!rule) throw httpError(404, 'That rule no longer exists.');
  res.json(rule);
}));

router.patch('/:id/toggle', wrap(async (req, res) => {
  const rule = await Rule.findOne({ _id: req.params.id, user: req.user._id });
  if (!rule) throw httpError(404, 'That rule no longer exists.');
  rule.enabled = !rule.enabled;
  await rule.save();
  res.json(rule);
}));

router.delete('/:id', wrap(async (req, res) => {
  await Rule.deleteOne({ _id: req.params.id, user: req.user._id });
  res.json({ ok: true });
}));

module.exports = router;
