'use client';

import { useEffect, useState } from 'react';
import {
  IOS_INSTALL_BANNER_KEY,
  isIosDevice,
  isIosInAppBrowser,
  isStandalonePwa,
} from './lib/pwaInstall';

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v10M12 3l4 4M12 3L8 7M5 11v8a2 2 0 002 2h10a2 2 0 002-2v-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IosInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    if (!isIosDevice() || isStandalonePwa()) return;
    try {
      if (localStorage.getItem(IOS_INSTALL_BANNER_KEY) === '1') return;
    } catch {
      /* ignore */
    }
    setInApp(isIosInAppBrowser());
    const timer = window.setTimeout(() => setVisible(true), 800);
    return () => window.clearTimeout(timer);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(IOS_INSTALL_BANNER_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  if (!visible) return null;

  return (
    <div
      className="ios-install-banner animate-slideup"
      role="dialog"
      aria-label="홈 화면에 추가 안내"
    >
      <div className="ios-install-banner__card">
        <button
          type="button"
          className="ios-install-banner__close"
          onClick={dismiss}
          aria-label="닫기"
        >
          ✕
        </button>

        <div className="ios-install-banner__icon" aria-hidden>
          📱
        </div>

        <p className="ios-install-banner__title">앱처럼 쓰려면 홈 화면에 추가하세요</p>

        {inApp ? (
          <p className="ios-install-banner__desc">
            지금은 앱 안 브라우저예요. Safari에서 열어야 홈 화면에 추가할 수 있어요.
            <br />
            <strong>⋯</strong> 메뉴 → <strong>Safari에서 열기</strong>를 눌러 주세요.
          </p>
        ) : (
          <ol className="ios-install-banner__steps">
            <li>
              하단{' '}
              <span className="ios-install-banner__share-icon" aria-hidden>
                <ShareIcon />
              </span>{' '}
              <strong>공유</strong> 버튼을 누르세요
            </li>
            <li>
              아래로 내려 <strong>홈 화면에 추가</strong>를 선택하세요
            </li>
            <li>
              오른쪽 상단 <strong>추가</strong>를 누르면 완료예요
            </li>
          </ol>
        )}

        <button type="button" className="ios-install-banner__btn" onClick={dismiss}>
          확인
        </button>
      </div>
    </div>
  );
}
