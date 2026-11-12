const { listSummaries, senderEmail } = require('./gmail');

const AUTOMATED = /(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce|notifications?@)/i;
const TTL = 10 * 60 * 1000;
const cache = new Map(); // userId -> { at, list }

// Splits a header such as: Jane Doe <jane@x.com>, "Lee, Sam" <sam@y.com>, bob@z.com
function parseAddresses(str) {
  const out = [];
  const re = /(?:"([^"]*)"|([^<>",;]*?))\s*<([^<>\s]+@[^<>\s]+)>|([^\s,;<>"]+@[^\s,;<>"]+)/g;
  let m;
  while ((m = re.exec(String(str || '')))) {
    const email = (m[3] || m[4] || '').trim().toLowerCase();
    const name = (m[1] || m[2] || '').trim();
    if (email) out.push({ email, name: name && name.toLowerCase() !== email ? name : '' });
  }
  return out;
}

/**
 * Builds an address book from the user's own mailbox: people they have written to (weighted higher)
 * and people who wrote to them. Nothing is stored; results are cached in memory for a few minutes.
 */
async function getContacts(gmail, user, { fresh = false } = {}) {
  const hit = cache.get(user.id);
  if (!fresh && hit && Date.now() - hit.at < TTL) return hit.list;

  const me = user.email.toLowerCase();
  const [sent, inbox] = await Promise.all([
    listSummaries(gmail, { labelIds: ['SENT'], max: 60 }).catch(() => ({ messages: [] })),
    listSummaries(gmail, { labelIds: ['INBOX'], max: 60 }).catch(() => ({ messages: [] })),
  ]);

  const map = new Map();
  const touch = (a, kind, date) => {
    if (!a.email || a.email === me || AUTOMATED.test(a.email)) return;
    const c = map.get(a.email) || { email: a.email, name: '', sent: 0, received: 0, last: 0 };
    if (a.name && (!c.name || date >= c.last)) c.name = a.name;
    c[kind]++;
    c.last = Math.max(c.last, date);
    map.set(a.email, c);
  };
  for (const m of sent.messages) [...parseAddresses(m.to), ...parseAddresses(m.cc)].forEach((a) => touch(a, 'sent', m.date));
  for (const m of inbox.messages) {
    if (m.unsubscribe) continue; // newsletters are not people
    parseAddresses(m.from).forEach((a) => touch(a, 'received', m.date));
  }

  const list = [...map.values()]
    .sort((a, b) => b.sent * 3 + b.received - (a.sent * 3 + a.received) || b.last - a.last)
    .slice(0, 400);
  cache.set(user.id, { at: Date.now(), list });
  return list;
}

module.exports = { getContacts, parseAddresses, senderEmail };
