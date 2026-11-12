const { mapLimit } = require('./util');

const META = ['From', 'To', 'Cc', 'Subject', 'Date', 'Message-Id', 'Reply-To', 'List-Unsubscribe', 'Precedence', 'Auto-Submitted'];

const hv = (m, name) => {
  const h = (m.payload?.headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
};

const summarize = (m) => ({
  id: m.id,
  threadId: m.threadId,
  from: hv(m, 'From'),
  to: hv(m, 'To'),
  cc: hv(m, 'Cc'),
  subject: hv(m, 'Subject') || '(no subject)',
  messageId: hv(m, 'Message-Id'),
  replyTo: hv(m, 'Reply-To'),
  precedence: hv(m, 'Precedence'),
  autoSubmitted: hv(m, 'Auto-Submitted'),
  unsubscribe: hv(m, 'List-Unsubscribe'),
  date: Number(m.internalDate) || 0,
  snippet: m.snippet || '',
  labelIds: m.labelIds || [],
  unread: (m.labelIds || []).includes('UNREAD'),
  starred: (m.labelIds || []).includes('STARRED'),
});

async function listSummaries(gmail, { q, labelIds, pageToken, max = 20 }) {
  const r = await gmail.users.messages.list({ userId: 'me', q: q || undefined, labelIds, pageToken, maxResults: max });
  const ids = (r.data.messages || []).map((m) => m.id);
  const msgs = await mapLimit(ids, 8, (id) =>
    gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: META }).then((x) => x.data)
  );
  return { messages: msgs.map(summarize), nextPageToken: r.data.nextPageToken || null };
}

const decode = (d) => Buffer.from(d || '', 'base64url').toString('utf8');

function extractBody(payload) {
  let html = '', text = '';
  const attachments = [];
  (function walk(p) {
    if (!p) return;
    if (p.filename && p.body?.attachmentId) attachments.push({ filename: p.filename, size: p.body.size, mimeType: p.mimeType });
    else if (p.mimeType === 'text/html' && p.body?.data && !html) html = decode(p.body.data);
    else if (p.mimeType === 'text/plain' && p.body?.data && !text) text = decode(p.body.data);
    (p.parts || []).forEach(walk);
  })(payload);
  return { html, text, attachments };
}

const oneLine = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim(); // blocks header injection
const encHeader = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`);

function buildRaw({ from, to, cc, bcc, subject, text, inReplyTo }) {
  const h = [];
  if (from) h.push(`From: ${oneLine(from)}`);
  h.push(`To: ${oneLine(to)}`);
  if (cc) h.push(`Cc: ${oneLine(cc)}`);
  if (bcc) h.push(`Bcc: ${oneLine(bcc)}`);
  h.push(`Subject: ${encHeader(oneLine(subject))}`);
  if (inReplyTo) {
    h.push(`In-Reply-To: ${oneLine(inReplyTo)}`);
    h.push(`References: ${oneLine(inReplyTo)}`);
  }
  h.push('MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64');
  const body = Buffer.from(text || '', 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
  return Buffer.from(h.join('\r\n') + '\r\n\r\n' + body).toString('base64url');
}

// Sends a message and only reports success once Gmail confirms it is in the Sent mailbox.
// (The send call can return before the message is actually queued for delivery, so we verify.)
async function sendMail(gmail, opts) {
  const r = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: buildRaw(opts), threadId: opts.threadId || undefined },
  });
  const sent = r.data || {};
  if (!sent.id) throw new Error('Gmail did not confirm that the message was sent.');
  let labels = sent.labelIds || [];
  if (!labels.includes('SENT')) {
    const check = await gmail.users.messages.get({ userId: 'me', id: sent.id, format: 'minimal' });
    labels = check.data.labelIds || [];
  }
  if (!labels.includes('SENT')) throw new Error('Gmail accepted the message but did not place it in Sent. Check your Gmail outbox before trying again.');
  return { id: sent.id, threadId: sent.threadId };
}

const BOUNCE_SENDER = 'from:(mailer-daemon OR postmaster)';

// Looks for a bounce (delivery failure notice) that refers to a message we sent.
// "delivered" here means no failure notice arrived, which is the strongest signal Gmail exposes.
async function checkDelivery(gmail, id) {
  let sent;
  try {
    sent = (await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['To', 'Cc', 'Bcc', 'Subject'] })).data;
  } catch (e) {
    if (e.code === 404) return { state: 'unknown' };
    throw e;
  }
  const sentAt = Number(sent.internalDate) || Date.now();
  const ageMs = Date.now() - sentAt;
  const recipients = [hv(sent, 'To'), hv(sent, 'Cc'), hv(sent, 'Bcc')]
    .flatMap((v) => v.split(/[,;]/)).map((v) => senderEmail(v).toLowerCase()).filter(Boolean);
  const subject = hv(sent, 'Subject').toLowerCase();

  const list = await gmail.users.messages.list({
    userId: 'me', q: `${BOUNCE_SENDER} after:${Math.floor(sentAt / 1000) - 5}`, maxResults: 5,
  });
  for (const ref of list.data.messages || []) {
    const b = (await gmail.users.messages.get({ userId: 'me', id: ref.id, format: 'metadata', metadataHeaders: ['Subject'] })).data;
    const hay = `${hv(b, 'Subject')} ${b.snippet || ''}`.toLowerCase();
    if (recipients.some((r) => hay.includes(r)) || (subject && hay.includes(subject))) {
      return { state: 'failed', reason: String(b.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 240) };
    }
  }
  return { state: ageMs < 45000 ? 'checking' : 'delivered' };
}

// Returns async (labelName) => labelId, creating labels on demand
async function labelResolver(gmail) {
  const r = await gmail.users.labels.list({ userId: 'me' });
  const map = {};
  (r.data.labels || []).forEach((l) => (map[l.name.toLowerCase()] = l.id));
  return async (name) => {
    const k = name.toLowerCase();
    if (map[k]) return map[k];
    const c = await gmail.users.labels.create({
      userId: 'me',
      requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
    });
    map[k] = c.data.id;
    return c.data.id;
  };
}

const senderEmail = (from) => {
  const m = /<([^>]+)>/.exec(from || '');
  return (m ? m[1] : from || '').trim();
};
const senderName = (from) => {
  const n = (from || '').split('<')[0].replace(/["']/g, '').trim();
  return n || senderEmail(from);
};

module.exports = { listSummaries, summarize, extractBody, buildRaw, sendMail, checkDelivery, labelResolver, senderEmail, senderName, hv, META };
