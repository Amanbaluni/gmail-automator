const { senderEmail, senderName } = require('./gmail');

// Everything here works from headers and the short Gmail snippet only; message bodies are never read.
const WEIGHTS = {
  vip: 40,
  known: 24,
  starred: 8,
  important: 10,
  direct: 8,
  question: 7,
  conversation: 8,
  urgent: 22,
  action: 14,
  money: 12,
  meeting: 10,
  security: 14,
  fresh: 10,
  today: 5,
  promo: -22,
  automated: -22,
  category: -22,
  bulk: -6,
  stale: -5,
};

const RULES = [
  ['urgent', 'Mentions a deadline or urgent request', /\b(urgent|asap|immediately|deadline|due (?:today|tomorrow|by)|overdue|expires?(?: soon| today)?|time[- ]sensitive|final (?:notice|reminder)|last chance to respond)\b/i],
  ['action', 'Asks you to take action', /\b(action required|please (?:confirm|review|approve|reply|respond|sign)|needs? your (?:approval|attention|response|input)|awaiting your|rsvp|follow[- ]up)\b/i],
  ['money', 'Related to payment or billing', /\b(invoice|payment (?:due|failed|received)|overdue|refund|receipt for|billing|contract|tax\b)/i],
  ['meeting', 'About a meeting or interview', /\b(interview|meeting|appointment|schedule[d]?|calendar invite|reschedul\w*|call (?:at|on|tomorrow|today))\b/i],
  ['security', 'Security or account notice', /\b(security alert|suspicious|unusual (?:sign|activity)|verify your|password reset|new sign[- ]in|two[- ]factor|2fa|verification code)\b/i],
];
const PROMO = /\b(newsletter|weekly digest|daily digest|\d{1,2}% off|big sale|flash sale|limited[- ]time|coupon|promo(?:tion)?|deals? of|unsubscribe|webinar|free shipping|black friday)\b/i;
const AUTOMATED_SENDER = /(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce|notifications?@|newsletter@|marketing@|news@)/i;

const matchAny = (hay, list) => list.some((x) => x && hay.includes(x.toLowerCase()));

function scoreMessage(m, ctx) {
  const from = senderEmail(m.from).toLowerCase();
  const subj = (m.subject || '').toLowerCase();
  const text = `${m.subject} ${m.snippet}`;
  const reasons = [];
  let score = 25;
  const add = (key, label) => { score += WEIGHTS[key]; reasons.push({ label, weight: WEIGHTS[key] }); };

  if (ctx.muted.has(from)) return { score: 0, level: 'low', reasons: [{ label: 'Sender is muted', weight: -100 }] };

  if (ctx.vip.has(from)) add('vip', 'VIP sender');
  else if (ctx.known.has(from)) add('known', 'You have written to this person before');

  const automated = !!m.unsubscribe || /bulk|list|junk/i.test(m.precedence) || AUTOMATED_SENDER.test(from) ||
    (m.autoSubmitted && m.autoSubmitted.toLowerCase() !== 'no');
  const category = (m.labelIds || []).find((l) => /^CATEGORY_(PROMOTIONS|SOCIAL|FORUMS)$/.test(l));
  if (category) add('category', 'Gmail filed it as promotions or social');
  if (automated && !ctx.vip.has(from)) add('automated', 'Automated or bulk sender');
  if (PROMO.test(text) && !ctx.vip.has(from)) add('promo', 'Looks promotional');

  if ((m.labelIds || []).includes('STARRED')) add('starred', 'You starred this conversation');
  if ((m.labelIds || []).includes('IMPORTANT') && !category) add('important', 'Gmail marked it important');

  const me = ctx.me;
  const toList = String(m.to || '').toLowerCase();
  if (me && toList.includes(me) && toList.split(',').length <= 3) add('direct', 'Sent directly to you');
  else if (toList.split(',').length > 6) { score += WEIGHTS.bulk; reasons.push({ label: 'Sent to a large group', weight: WEIGHTS.bulk }); }

  for (const [key, label, re] of RULES) if (re.test(text)) add(key, label);
  if (ctx.keywords.length && matchAny(text.toLowerCase(), ctx.keywords)) add('urgent', 'Contains one of your priority keywords');
  if (/\?/.test(m.subject) || /\?/.test(m.snippet)) add('question', 'Asks a question');
  if (/^(re|fwd?):/i.test(subj) && !automated) add('conversation', 'Part of an ongoing conversation');

  const age = Date.now() - m.date;
  if (age < 2 * 3600e3) add('fresh', 'Arrived in the last 2 hours');
  else if (age < 24 * 3600e3) add('today', 'Arrived today');
  else if (age > 7 * 86400e3) add('stale', 'Over a week old');

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 65 ? 'high' : score >= 40 ? 'medium' : 'low';
  reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  return { score, level, reasons: reasons.slice(0, 4) };
}

function rankMessages(messages, { user, contacts }) {
  const pr = user.priority || {};
  const norm = (a) => new Set((a || []).map((x) => String(x).trim().toLowerCase()).filter(Boolean));
  const ctx = {
    me: user.email.toLowerCase(),
    vip: norm(pr.vip),
    muted: norm(pr.muted),
    keywords: (pr.keywords || []).map((k) => String(k).trim().toLowerCase()).filter(Boolean),
    known: new Set(contacts.filter((c) => c.sent > 0).map((c) => c.email)),
  };
  return messages
    .map((m) => ({ ...m, fromName: senderName(m.from), fromEmail: senderEmail(m.from), priority: scoreMessage(m, ctx) }))
    .sort((a, b) => b.priority.score - a.priority.score || b.date - a.date);
}

module.exports = { rankMessages, scoreMessage };
