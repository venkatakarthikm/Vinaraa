'use strict';

const mongoose = require('mongoose');

const popupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    html: { type: String, required: true },
    enabled: { type: Boolean, default: false },
    audience: {
      mode: { type: String, enum: ['all', 'selected'], default: 'all' },
      userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Popup', popupSchema);
