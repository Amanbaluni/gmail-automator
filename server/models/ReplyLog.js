const { Schema, model } = require('mongoose');

// Remembers when we last auto-replied to each sender so the cooldown can be enforced.
// `at` is used (instead of createdAt) so the configurable cooldown can exceed the old fixed 4 days.
const R = new Schema({
  user: { type: Schema.Types.ObjectId, required: true },
  sender: { type: String, required: true },
  at: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});
R.index({ user: 1, sender: 1 }, { unique: true });

module.exports = model('ReplyLog', R);
