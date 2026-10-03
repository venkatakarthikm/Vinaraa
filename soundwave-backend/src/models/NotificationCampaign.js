'use strict';

const mongoose = require('mongoose');

const notificationTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    titleTemplate: { type: String, required: true },
    bodyTemplate: { type: String, required: true },
    imageUrl: String,
    action: {
      type: { type: String, enum: ['open-album', 'play-song', 'open-url'] },
      id: String,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const notificationCampaignSchema = new mongoose.Schema(
  {
    name: String,
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'NotificationTemplate' },
    templateSnapshot: {
      titleTemplate: String,
      bodyTemplate: String,
      imageUrl: String,
      action: mongoose.Schema.Types.Mixed,
    },
    audience: {
      mode: { type: String, enum: ['all', 'selected'], default: 'all' },
      userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    status: { type: String, enum: ['draft', 'queued', 'sending', 'sent', 'failed'], default: 'draft' },
    recipientCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sentAt: Date,
  },
  { timestamps: true }
);

const NotificationTemplate = mongoose.model('NotificationTemplate', notificationTemplateSchema);
const NotificationCampaign = mongoose.model('NotificationCampaign', notificationCampaignSchema);

module.exports = { NotificationTemplate, NotificationCampaign };
