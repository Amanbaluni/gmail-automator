const Rule = require('../models/Rule');
const Template = require('../models/Template');
const ActivityLog = require('../models/ActivityLog');
const ReplyLog = require('../models/ReplyLog');
const ScheduledEmail = require('../models/ScheduledEmail');
const User = require('../models/User');
const { gmailFor } = require('./google');
const { listSummaries, sendMail, labelResolver, senderEmail, senderName } = require('./gmail');

const AUTOMATED_SENDER = /(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce|notifications?@)/i;

// Comma-separated alternatives inside one field = OR. Different fields = AND.
const hit = (hay, needles) =>
  String(needles).split(',').map((s) => s.trim()).filter(Boolean)
    .some((n) => hay.toLowerCase().includes(n.toLowerCase()));

function matches(rule, m) {
  const c = rule.conditions || {};
  const text = `${m.subject} ${m.snippet}`;
  if (c.from && !hit(m.from, c.from)) return false;
  if (c.to && !hit(m.to, c.to)) return false;
  if (c.subject && !hit(m.subject, c.subject)) return false;
  if (c.contains && !hit(text, c.contains)) return false;
  if (c.excludes && hit(`${text} ${m.from}`, c.excludes)) return false;
  return true;
}

const isAutomated = (m) =>
  !!m.unsubscribe ||
  /bulk|list|junk/i.test(m.precedence) ||
  (m.autoSubmitted && m.autoSubmitted.toLowerCase() !== 'no') ||
  AUTOMATED_SENDER.test(senderEmail(m.from));

const fill = (tpl, m) =>
  String(tpl)
    .replace(/{{\s*sender_name\s*}}/gi, senderName(m.from))
    .replace(/{{\s*sender_email\s*}}/gi, senderEmail(m.from))
    .replace(/{{\s*subject\s*}}/gi, m.subject);

const skipped = (list, email) =>
  (list || []).some((x) => {
    const v = String(x).trim().toLowerCase();
    return v && (v.includes('@') ? email === v : email.endsWith(`@${v.replace(/^@/, '')}`));
  });

// Replies at most once per sender within the cooldown, never to bots/newsletters/yourself
async function replyOnce(gmail, user, m, body, opts = {}) {
  const sender = senderEmail(m.from).toLowerCase();
  if (!sender || sender === user.email.toLowerCase() || isAutomated(m)) return false;
  if (opts.onlyDirect && !String(m.to || '').toLowerCase().includes(user.email.toLowerCase())) return false;
  if (skipped(opts.skipSenders, sender)) return false;

  const days = Math.min(30, Math.max(1, Number(opts.cooldownDays) || 4));
  const cutoff = new Date(Date.now() - days * 86400000);
  try {
    // Matches only when the last reply is older than the cooldown; a recent one collides with the unique index.
    await ReplyLog.findOneAndUpdate(
      { user: user._id, sender, at: { $lt: cutoff } },
      { $set: { at: new Date() } },
      { upsert: true }
    );
  } catch (e) {
    if (e.code === 11000) return false;
    throw e;
  }
  try {
    const subject = opts.subject ? fill(opts.subject, m) : /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`;
    await sendMail(gmail, {
      from: user.email,
      to: senderEmail(m.from),
      subject,
      text: fill(body, m),
      threadId: m.threadId,
      inReplyTo: m.messageId,
    });
    return true;
  } catch (e) {
    await ReplyLog.deleteOne({ user: user._id, sender });
    throw e;
  }
}

// Older saves stored the end date as midnight UTC and treated it as inclusive; newer ones store the exact end moment.
const endOf = (d) => (d.getTime() % 86400000 === 0 ? new Date(d.getTime() + 86400000) : d);

async function runForUser(user, { hours } = {}) {
  const started = new Date();
  const rules = await Rule.find({ user: user._id, enabled: true });
  const ar = user.autoResponder || {};
  const arActive =
    !!ar.enabled && !!ar.body &&
    (!ar.startDate || ar.startDate <= started) &&
    (!ar.endDate || endOf(ar.endDate) > started);

  if (!rules.length && !arActive) {
    await User.updateOne({ _id: user._id }, { lastRunAt: started });
    return { scanned: 0, actions: 0 };
  }

  const gmail = gmailFor(user);
  const floor = Date.now() - 7 * 86400000;
  const sinceMs = Math.max(
    floor,
    hours ? Date.now() - hours * 3600000 : user.lastRunAt ? user.lastRunAt.getTime() : Date.now() - 86400000
  );
  const { messages } = await listSummaries(gmail, { q: `in:inbox after:${Math.floor(sinceMs / 1000)}`, max: 100 });

  let resolve;
  const tplCache = new Map();
  const getTpl = async (id) => {
    const k = String(id);
    if (!tplCache.has(k)) tplCache.set(k, await Template.findOne({ _id: id, user: user._id }));
    return tplCache.get(k);
  };
  const logs = [];
  const hitCounts = new Map();
  let actions = 0, failures = 0;

  for (const m of messages) {
    try {
      const add = new Set(), remove = new Set();
      let trash = false;
      const who = senderName(m.from).slice(0, 40);
      for (const rule of rules) {
        if (!matches(rule, m)) continue;
        const a = rule.actions || {};
        const done = [];
        if (a.label) {
          resolve = resolve || (await labelResolver(gmail));
          add.add(await resolve(a.label));
          done.push(`labelled "${a.label}"`);
        }
        if (a.markRead) { remove.add('UNREAD'); done.push('marked as read'); }
        if (a.star) { add.add('STARRED'); done.push('starred'); }
        if (a.archive) { remove.add('INBOX'); done.push('archived'); }
        if (a.trash) { trash = true; done.push('moved to trash'); }
        if (a.autoReplyTemplate) {
          const t = await getTpl(a.autoReplyTemplate);
          if (t && (await replyOnce(gmail, user, m, t.body, { cooldownDays: ar.cooldownDays, skipSenders: ar.skipSenders }))) done.push(`sent the reply "${t.name}"`);
        }
        hitCounts.set(rule._id, (hitCounts.get(rule._id) || 0) + 1);
        actions++;
        logs.push({ user: user._id, type: 'rule', message: `Rule "${rule.name}" matched "${m.subject.slice(0, 60)}" from ${who}: ${done.join(', ') || 'no changes needed'}.` });
      }
      if (trash) { add.add('TRASH'); remove.add('INBOX'); }
      if (add.size || remove.size) {
        await gmail.users.messages.modify({
          userId: 'me', id: m.id,
          requestBody: { addLabelIds: [...add], removeLabelIds: [...remove] },
        });
      }
      if (arActive && !trash && (await replyOnce(gmail, user, m, ar.body, ar))) {
        actions++;
        logs.push({ user: user._id, type: 'autoreply', message: `Sent your out-of-office reply to ${who}.` });
      }
    } catch (e) {
      if (/invalid_grant/i.test(e.message)) throw e;
      failures++;
      logs.push({ user: user._id, type: 'error', message: `Couldn't process "${m.subject.slice(0, 60)}": ${e.message}`.slice(0, 300) });
    }
  }

  if (logs.length) await ActivityLog.insertMany(logs);
  if (hitCounts.size) {
    await Rule.bulkWrite([...hitCounts].map(([id, n]) => ({
      updateOne: { filter: { _id: id }, update: { $inc: { matchCount: n }, $set: { lastMatchedAt: new Date() } } },
    })));
  }
  await User.updateOne({ _id: user._id }, { lastRunAt: started });
  return { scanned: messages.length, actions, failures };
}

async function runScheduled(deadline = Infinity) {
  const due = await ScheduledEmail.find({ status: 'pending', sendAt: { $lte: new Date() } }).sort({ sendAt: 1 }).limit(50);
  let sent = 0;
  for (const job of due) {
    if (Date.now() > deadline) break;
    const claimed = await ScheduledEmail.findOneAndUpdate({ _id: job._id, status: 'pending' }, { status: 'sending' });
    if (!claimed) continue;
    try {
      const user = await User.findById(job.user);
      if (!user) throw new Error('The account that scheduled this email no longer exists');
      const res = await sendMail(gmailFor(user), { from: user.email, to: job.to, cc: job.cc, bcc: job.bcc, subject: job.subject, text: job.body });
      await ScheduledEmail.updateOne({ _id: job._id }, { status: 'sent', sentAt: new Date(), gmailId: res.id });
      await ActivityLog.create({ user: job.user, type: 'scheduled', message: `Scheduled email "${job.subject.slice(0, 60)}" was sent to ${job.to}.` });
      sent++;
    } catch (e) {
      await ScheduledEmail.updateOne({ _id: job._id }, { status: 'failed', error: e.message.slice(0, 300) });
      await ActivityLog.create({ user: job.user, type: 'error', message: `Scheduled email to ${job.to} could not be sent: ${e.message}`.slice(0, 300) });
    }
  }
  return sent;
}

module.exports = { runForUser, runScheduled, matches };
