const router = require('express').Router();
const Template = require('../models/Template');
const Rule = require('../models/Rule');
const { requireAuth } = require('../middleware/auth');
const { wrap, httpError } = require('../lib/util');

router.use(requireAuth);
const s = (v, n) => String(v ?? '').trim().slice(0, n);

const clean = (b) => {
  const t = { name: s(b.name, 80), subject: s(b.subject, 200), body: s(b.body, 20000) };
  if (!t.name || !t.body) throw httpError(400, 'Give the template a name and a message.');
  return t;
};

router.get('/', wrap(async (req, res) => res.json(await Template.find({ user: req.user._id }).sort({ createdAt: -1 }))));

router.post('/', wrap(async (req, res) => {
  if ((await Template.countDocuments({ user: req.user._id })) >= 50) throw httpError(400, 'You\'ve reached the limit of 50 templates. Delete one to add another.');
  res.status(201).json(await Template.create({ ...clean(req.body), user: req.user._id }));
}));

router.put('/:id', wrap(async (req, res) => {
  const t = await Template.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, clean(req.body), { new: true });
  if (!t) throw httpError(404, 'That template no longer exists.');
  res.json(t);
}));

router.delete('/:id', wrap(async (req, res) => {
  await Template.deleteOne({ _id: req.params.id, user: req.user._id });
  await Rule.updateMany({ user: req.user._id, 'actions.autoReplyTemplate': req.params.id }, { $set: { 'actions.autoReplyTemplate': null } });
  res.json({ ok: true });
}));

module.exports = router;
