const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { wrap, httpError } = require('../lib/util');

exports.requireAuth = wrap(async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) throw httpError(401, 'Please sign in to continue.');
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw httpError(401, 'Your session has expired. Please sign in again.');
  }
  const user = await User.findById(payload.uid);
  if (!user) throw httpError(401, 'We couldn\'t find your account. Please sign in again.');
  req.user = user;
  next();
});
