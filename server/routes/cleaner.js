const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { gmailFor } = require('../lib/google');
const { listSummaries, senderEmail, senderName } = require('../lib/gmail');
const { wrap, httpError } = require('../lib/util');
const ActivityLog = require('../models/ActivityLog');

router.use(requireAuth);

// Group recent matching mail by sender (default: promotions tab)
router.get('/senders', wrap(async (req, res) => {
  const q = String(req.query.q || 'category:promotions in:inbox').slice(0, 300);
  const gmail = gmailFor(req.user);
  const { messages } = await listSummaries(gmail, { q, max: 100 });
  const map = new Map();
  for (const m of messages) {
    const email = senderEmail(m.from).toLowerCase();
    if (!email) continue;
    const g = map.get(email) || { email, name: senderName(m.from), count: 0, unread: 0, sample: m.subject, unsubscribe: '' };
    g.count++;
    if (m.unread) g.unread++;
    if (!g.unsubscribe && m.unsubscribe) g.unsubscribe = (/<(https?:[^>]+)>/.exec(m.unsubscribe) || [])[1] || '';
    map.set(email, g);
  }
  res.json([...map.values()].sort((a, b) => b.count - a.count));
}));

const BULK = {
  archive: { add: [], remove: ['INBOX'] },
  read: { add: [], remove: ['UNREAD'] },
  trash: { add: ['TRASH'], remove: ['INBOX'] },
};

router.post('/bulk', wrap(async (req, res) => {
  const { from, action } = req.body;
  const a = BULK[action];
  if (!a) throw httpError(400, 'That action isn\'t supported.');
  if (!/^[^\s"'<>(){}]+@[^\s"'<>(){}]+$/.test(String(from || ''))) throw httpError(400, 'That sender address isn\'t valid.');
  const gmail = gmailFor(req.user);
  const ids = [];
  let pageToken;
  do {
    const r = await gmail.users.messages.list({ userId: 'me', q: `from:${from} in:inbox`, maxResults: 200, pageToken });
    (r.data.messages || []).forEach((m) => ids.push(m.id));
    pageToken = r.data.nextPageToken;
  } while (pageToken && ids.length < 500);
  if (ids.length) {
    await gmail.users.messages.batchModify({ userId: 'me', requestBody: { ids, addLabelIds: a.add, removeLabelIds: a.remove } });
  }
  await ActivityLog.create({ user: req.user._id, type: 'cleaner', message: `Cleaner: ${{ archive: 'archived', read: 'marked as read', trash: 'moved to trash' }[action]} ${ids.length} ${ids.length === 1 ? 'email' : 'emails'} from ${from}.` });
  res.json({ affected: ids.length });
}));

module.exports = router;
