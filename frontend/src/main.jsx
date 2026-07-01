import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Frontend entry point. Keep global providers here so route/page modules can
// stay focused on product behavior instead of application bootstrapping.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
