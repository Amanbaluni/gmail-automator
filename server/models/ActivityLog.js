const { Schema, model } = require('mongoose');

const A = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['rule', 'autoreply', 'scheduled', 'send', 'cleaner', 'system', 'priority', 'error'], required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 }, // auto-delete after 90 days
});
A.index({ user: 1, createdAt: -1 });

module.exports = model('ActivityLog', A);
