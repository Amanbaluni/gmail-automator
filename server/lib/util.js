exports.wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

exports.httpError = (status, message) => {
  const e = new Error(message);
  e.status = status;
  return e;
};

exports.mapLimit = async (items, limit, fn) => {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    })
  );
  return out;
};

const EMAIL_RE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
exports.parseRecipients = (str, { required = false } = {}) => {
  const list = String(str || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (required && !list.length) throw exports.httpError(400, 'Add at least one recipient.');
  if (list.length > 50) throw exports.httpError(400, 'That\'s too many recipients. The limit is 50 per field.');
  for (const e of list) if (!EMAIL_RE.test(e)) throw exports.httpError(400, `"${e}" doesn't look like a valid email address.`);
  return list;
};
