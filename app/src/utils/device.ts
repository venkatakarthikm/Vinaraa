import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const DEVICE_ID_KEY = 'vinaraa_device_id';

function generateId() {
  return 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function getDeviceInfo() {
  let { value: deviceId } = await Preferences.get({ key: DEVICE_ID_KEY });
  if (!deviceId) {
    deviceId = generateId();
    await Preferences.set({ key: DEVICE_ID_KEY, value: deviceId });
  }

  return {
    deviceId,
    platform: Capacitor.getPlatform() === 'android' ? 'android' : (Capacitor.getPlatform() === 'ios' ? 'ios' : 'web'),
    appVersion: '1.0.0', // Optional, can be fetched if we had App plugin, but we have @capacitor/app, wait!
  };
}
