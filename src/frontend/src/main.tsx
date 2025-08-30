import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Performance monitoring
if (import.meta.env.DEV) {
  // Log render performance in development
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      console.log(`Performance: ${entry.name} - ${entry.duration.toFixed(2)}ms`);
    });
  });
  
  observer.observe({ type: 'measure', buffered: true });
}

// Render the app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);