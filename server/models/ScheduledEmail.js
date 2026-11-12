const { Schema, model } = require('mongoose');

const S = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    to: { type: String, required: true },
    cc: String,
    bcc: String,
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    sendAt: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'sending', 'sent', 'failed'], default: 'pending' },
    error: String,
    gmailId: String,
    sentAt: Date,
  },
  { timestamps: true }
);
S.index({ status: 1, sendAt: 1 });

module.exports = model('ScheduledEmail', S);
