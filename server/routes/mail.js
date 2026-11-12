const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { gmailFor } = require('../lib/google');
const { listSummaries, summarize, extractBody, sendMail, checkDelivery } = require('../lib/gmail');
const { getContacts } = require('../lib/contacts');
const { rankMessages } = require('../lib/priority');
const { wrap, httpError, parseRecipients } = require('../lib/util');
const ActivityLog = require('../models/ActivityLog');

router.use(requireAuth);

router.get('/messages', wrap(async (req, res) => {
  const label = String(req.query.label || 'INBOX');
  if (!/^[A-Za-z0-9_\-]+$/.test(label)) throw httpError(400, 'That mailbox isn\'t available.');
  const gmail = gmailFor(req.user);
  const data = await listSummaries(gmail, {
    q: req.query.q ? String(req.query.q).slice(0, 300) : undefined,
    labelIds: label === 'ALL' ? undefined : [label],
    pageToken: req.query.pageToken ? String(req.query.pageToken) : undefined,
    max: 20,
  });
  res.json(data);
}));

router.get('/messages/:id', wrap(async (req, res) => {
  const gmail = gmailFor(req.user);
  const { data } = await gmail.users.messages.get({ userId: 'me', id: req.params.id, format: 'full' });
  res.json({ ...summarize(data), ...extractBody(data.payload) });
}));

const ACTIONS = {
  read: { remove: ['UNREAD'] },
  unread: { add: ['UNREAD'] },
  star: { add: ['STARRED'] },
  unstar: { remove: ['STARRED'] },
  archive: { remove: ['INBOX'] },
  inbox: { add: ['INBOX'] },
  spam: { add: ['SPAM'], remove: ['INBOX'] },
  trash: { add: ['TRASH'], remove: ['INBOX'] },
  untrash: { add: ['INBOX'], remove: ['TRASH'] },
};

router.post('/messages/:id/action', wrap(async (req, res) => {
  const a = ACTIONS[req.body.action];
  if (!a) throw httpError(400, 'That action isn\'t supported.');
  const gmail = gmailFor(req.user);
  await gmail.users.messages.modify({
    userId: 'me', id: req.params.id,
    requestBody: { addLabelIds: a.add || [], removeLabelIds: a.remove || [] },
  });
  res.json({ ok: true });
}));

router.post('/send', wrap(async (req, res) => {
  const { to, cc, bcc, subject, body, threadId, inReplyTo } = req.body;
  parseRecipients(to, { required: true });
  parseRecipients(cc);
  parseRecipients(bcc);
  if (!String(subject || '').trim() && !String(body || '').trim()) throw httpError(400, 'Add a subject or a message before sending.');
  const gmail = gmailFor(req.user);
  const sent = await sendMail(gmail, {
    from: req.user.email, to, cc, bcc,
    subject: String(subject || '(no subject)').slice(0, 300),
    text: String(body || '').slice(0, 100000),
    threadId: threadId || undefined,
    inReplyTo: inReplyTo || undefined,
  });
  await ActivityLog.create({ user: req.user._id, type: 'send', message: `Sent "${String(subject || '(no subject)').slice(0, 60)}" to ${String(to).slice(0, 80)}.` });
  res.json({ ok: true, id: sent.id, threadId: sent.threadId });
}));

// After sending, the client polls this to learn whether Gmail reported a delivery failure.
router.get('/send-status/:id', wrap(async (req, res) => {
  if (!/^[A-Za-z0-9]+$/.test(req.params.id)) throw httpError(400, 'That message ID isn\'t valid.');
  const result = await checkDelivery(gmailFor(req.user), req.params.id);
  if (result.state === 'failed') {
    await ActivityLog.create({ user: req.user._id, type: 'error', message: `An email could not be delivered: ${result.reason || 'the recipient\'s server rejected it'}`.slice(0, 300) });
  }
  res.json(result);
}));

// Address book for the recipient autocomplete (built from the user's own mailbox, cached briefly)
router.get('/contacts', wrap(async (req, res) => {
  const list = await getContacts(gmailFor(req.user), req.user, { fresh: req.query.fresh === '1' });
  res.json(list.map(({ email, name, sent }) => ({ email, name, sent })));
}));

// Unread inbox mail ranked by how likely it needs attention
router.get('/priority', wrap(async (req, res) => {
  const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
  const gmail = gmailFor(req.user);
  const [{ messages }, contacts] = await Promise.all([
    listSummaries(gmail, { q: `in:inbox is:unread newer_than:${days}d`, max: 60 }),
    getContacts(gmail, req.user),
  ]);
  res.json({ items: rankMessages(messages, { user: req.user, contacts }), days });
}));

module.exports = router;
