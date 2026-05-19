/** iOS/iPadOS 기기 여부 */
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** 이미 홈 화면에 추가해 standalone으로 실행 중 */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** 카카오·인스타 등 인앱 브라우저 (Safari로 열어야 홈 화면 추가 가능) */
export function isIosInAppBrowser(): boolean {
  if (!isIosDevice()) return false;
  const ua = navigator.userAgent;
  if (/(KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|Snapchat)/i.test(ua)) return true;
  // iOS WebKit이지만 Safari가 아닌 경우 (대부분 인앱)
  const isWebkit = /AppleWebKit/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  return isWebkit && !isSafari;
}

export const IOS_INSTALL_BANNER_KEY = 'study-app-ios-install-banner-dismissed';
