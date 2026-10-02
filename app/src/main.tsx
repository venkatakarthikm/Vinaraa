import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Import Anek variable fonts for Indic & Latin scripts (works offline in APK)
import '@fontsource-variable/anek-latin';
import '@fontsource-variable/anek-devanagari';
import '@fontsource-variable/anek-telugu';
import '@fontsource-variable/anek-tamil';
import '@fontsource-variable/anek-kannada';
import '@fontsource-variable/anek-malayalam';
import '@fontsource-variable/anek-bangla';
import '@fontsource-variable/anek-gujarati';
import '@fontsource-variable/anek-gurmukhi';
import '@fontsource-variable/anek-odia';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

requestAnimationFrame(() => {
  import('@/native/player').then(({ VinaraaPlayer }) => {
    VinaraaPlayer.appReady().catch(() => {});
  });
});
