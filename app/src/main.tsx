import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Import fonts so they work offline
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@fontsource/noto-sans-telugu/400.css';
import '@fontsource/noto-sans-telugu/600.css';

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
