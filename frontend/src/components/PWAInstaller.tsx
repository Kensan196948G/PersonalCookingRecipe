'use client';

import { useEffect } from 'react';

export function PWAInstaller() {
  useEffect(() => {
    // Request notification permission on app start
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Register service worker for PWA
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  return null;
}
