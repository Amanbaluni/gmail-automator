const { Schema, model } = require('mongoose');

module.exports = model(
  'Template',
  new Schema(
    {
      user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      name: { type: String, required: true },
      subject: { type: String, default: '' },
      body: { type: String, required: true },
    },
    { timestamps: true }
  )
);
