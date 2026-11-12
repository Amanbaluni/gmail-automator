const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (e) {
    console.error('DB error:', e.message);
    res.status(500).json({ error: 'We\'re having trouble reaching our database. Please try again in a moment.' });
  }
});

// Basic CSRF defence: state-changing calls must carry a custom header (browsers block it cross-site)
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'XMLHttpRequest') return res.status(403).json({ error: 'This request couldn\'t be verified. Refresh the page and try again.' });
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/mail', require('./routes/mail'));
app.use('/api/rules', require('./routes/rules'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/scheduled', require('./routes/scheduled'));
app.use('/api/cleaner', require('./routes/cleaner'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/cron', require('./routes/cron'));
app.use('/api', require('./routes/overview'));

app.use('/api', (req, res) => res.status(404).json({ error: 'We couldn\'t find what you were looking for.' }));

app.use((err, req, res, next) => {
  const msg = String(err.message || '');
  if (/invalid_grant/i.test(msg)) {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Your Google connection has expired or was revoked. Please sign in again.' });
  }
  const status = err.status || (Number.isInteger(err.code) && err.code >= 400 && err.code < 600 ? err.code : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && !err.code ? 'Something went wrong on our side. Please try again.' : msg });
});

module.exports = app;
