import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Import fonts so they work offline
import '@fontsource/sora/700.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/800.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
