import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.music.vinaraa',
  appName: 'Vinaraa',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      backgroundColor: "#0A0A18",
      launchAutoHide: true,
    },
  },
};

export default config;
