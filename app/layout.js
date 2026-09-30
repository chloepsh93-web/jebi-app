import localFont from "next/font/local";
import "./globals.css";
import "./darkmode.css"; /* 밤의 박 — [data-theme="night"] 오버라이드 레이어 (라운드2, 디자인팀) */

/**
 * FOUC 방지 — 첫 페인트 전에 저장된 테마를 적용한다.
 * ThemeToggle.jsx의 applyStoredTheme()과 동일한 로직의 인라인 버전.
 */
const THEME_BOOT_SCRIPT = `(function(){try{var s=localStorage.getItem('jebi:theme')||'system';var night=s==='night'||(s!=='light'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);if(night)document.documentElement.setAttribute('data-theme','night');}catch(e){}})();`;

/** P3-1: CDN 대신 로컬 폰트 (빌드 시점에 번들에 포함되어 오프라인에서도 깜빡임 없음) */
const pretendard = localFont({
  src: "../public/fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920",
});

const notoSerif = localFont({
  src: "../public/fonts/NotoSerifKR-400.woff2",
  variable: "--font-serif",
  display: "swap",
  weight: "400",
});

export const metadata = {
  title: "제비 — 마음을 기억하는 집",
  description: "받은 마음도, 전할 마음도 놓치지 않게",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "제비",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#9A6410",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${notoSerif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
