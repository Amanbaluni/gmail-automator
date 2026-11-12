const router = require('express').Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { SCOPES, oauthClient, google } = require('../lib/google');
const { encrypt } = require('../lib/crypto');
const { requireAuth } = require('../middleware/auth');
const { wrap } = require('../lib/util');

const secure = process.env.NODE_ENV === 'production';

router.get('/google', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, { httpOnly: true, sameSite: 'lax', secure, maxAge: 10 * 60 * 1000 });
  const url = oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // always returns a refresh token
    scope: SCOPES,
    state,
    include_granted_scopes: true,
  });
  res.redirect(url);
});

router.get('/google/callback', wrap(async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect('/login?error=denied');
  if (!code || !state || state !== req.cookies?.oauth_state) return res.redirect('/login?error=state');
  res.clearCookie('oauth_state');

  const client = oauthClient();
  const { tokens } = await client.getToken(String(code));
  if (!(tokens.scope || '').includes('gmail.modify')) return res.redirect('/login?error=scopes');
  client.setCredentials(tokens);

  const { data: p } = await google.oauth2({ version: 'v2', auth: client }).userinfo.get();
  const allowed = (process.env.ALLOWED_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes((p.email || '').toLowerCase())) return res.redirect('/login?error=not_allowed');

  let user = await User.findOne({ googleId: p.id });
  if (!user && !tokens.refresh_token) return res.redirect('/login?error=no_refresh');
  if (!user) {
    user = new User({ googleId: p.id, refreshToken: encrypt(tokens.refresh_token) });
  } else if (tokens.refresh_token) {
    user.refreshToken = encrypt(tokens.refresh_token);
  }
  user.email = p.email;
  user.name = p.name;
  user.picture = p.picture;
  await user.save();

  const token = jwt.sign({ uid: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure, maxAge: 7 * 24 * 3600 * 1000 });
  res.redirect('/dashboard');
}));

router.get('/me', requireAuth, (req, res) => {
  const { id, email, name, picture } = req.user;
  res.json({ id, email, name, picture });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

module.exports = router;
