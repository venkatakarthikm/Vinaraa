'use strict';

const env = require('../config/env');
const logger = require('../utils/logger');

async function sendNotification({ userIds, title, body, imageUrl, action, isAll = false }) {
  const appId = process.env.ONESIGNAL_APP_ID || 'c7594dd5-a376-4104-ac20-56abe4f1bf42';
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!apiKey) {
    logger.warn('[OneSignal] ONESIGNAL_REST_API_KEY is not configured');
    return { sent: false, reason: 'ONESIGNAL_REST_API_KEY not configured on server' };
  }

  const payload = {
    app_id: appId,
    headings: { en: title },
    contents: { en: body },
    data: { action },
  };

  if (imageUrl) {
    payload.big_picture = imageUrl;
    payload.chrome_web_image = imageUrl;
  }

  if (isAll) {
    payload.included_segments = ['All'];
  } else if (Array.isArray(userIds) && userIds.length > 0) {
    payload.include_aliases = { external_id: userIds.map(String) };
    payload.target_channel = 'push';
  } else {
    return { sent: false, reason: 'no_recipients_specified' };
  }

  try {
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const resJson = await res.json();

    if (res.ok) {
      return {
        sent: true,
        oneSignalId: resJson.id,
        recipientCount: resJson.recipients || (isAll ? 100 : userIds.length),
      };
    } else {
      logger.error('[OneSignal] API error', resJson);
      return {
        sent: false,
        reason: resJson.errors?.[0] || 'OneSignal API error',
      };
    }
  } catch (err) {
    logger.error('[OneSignal] Fetch exception', err);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendNotification };
