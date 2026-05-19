'use client';

import { useEffect } from 'react';

/** 프로덕션에서 서비스 워커 등록 (public/sw.js) */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(err => console.warn('SW registration failed:', err));
  }, []);

  return null;
}
