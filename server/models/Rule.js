const { Schema, model } = require('mongoose');

const Rule = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    conditions: { from: String, to: String, subject: String, contains: String, excludes: String },
    actions: {
      label: String,
      markRead: Boolean,
      star: Boolean,
      archive: Boolean,
      trash: Boolean,
      autoReplyTemplate: { type: Schema.Types.ObjectId, ref: 'Template', default: null },
    },
    matchCount: { type: Number, default: 0 },
    lastMatchedAt: Date,
  },
  { timestamps: true }
);

module.exports = model('Rule', Rule);
