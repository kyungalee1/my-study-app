import type { MetadataRoute } from 'next';

/** PWA 아이콘은 public/icons/*.png ( /icon URL은 [studentId]와 충돌함 ) */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: '공부 관리',
    short_name: '공부관리',
    description: '두 아이를 위한 스마트 학습 관리 앱',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'ko',
    background_color: '#F2F4F6',
    theme_color: '#3182F6',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
