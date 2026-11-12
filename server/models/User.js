const { Schema, model } = require('mongoose');

const User = new Schema(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: String,
    picture: String,
    refreshToken: { type: String, required: true }, // AES-256-GCM encrypted
    automationEnabled: { type: Boolean, default: true },
    lastRunAt: Date,
    autoResponder: {
      enabled: { type: Boolean, default: false },
      body: { type: String, default: '' },
      startDate: Date,
      endDate: Date,
      subject: { type: String, default: '' },        // optional custom subject, placeholders allowed
      cooldownDays: { type: Number, default: 4 },    // minimum days between replies to the same sender
      onlyDirect: { type: Boolean, default: false }, // only reply when the user is in the To field
      skipSenders: { type: [String], default: [] },  // never auto-reply to these addresses / domains
    },
    signature: { type: String, default: '' },
    priority: {
      vip: { type: [String], default: [] },
      muted: { type: [String], default: [] },
      keywords: { type: [String], default: [] },
    },
  },
  { timestamps: true }
);

module.exports = model('User', User);
