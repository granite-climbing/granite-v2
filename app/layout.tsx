import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://granite.kr"),
  title: {
    default: "Granite",
    template: "%s · Granite",
  },
  description:
    "국내 자연 볼더링 스팟을 탐색하고 Route 정보를 확인하는 모바일 웹앱",
  openGraph: {
    title: "Granite",
    description: "국내 자연 볼더링 스팟 탐색",
    url: "https://granite.kr",
    siteName: "Granite",
    locale: "ko_KR",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

/**
 * Root layout is intentionally bare. Two sibling route groups handle the
 * actual page chrome:
 *   - app/(site)/layout.tsx — public mobile-first 360px container + Footer
 *   - app/admin/layout.tsx  — admin shell (full desktop width, no Footer)
 *
 * Keeping the root free of any container is what lets /admin/* render at full
 * desktop width without inheriting the public mobile frame (ADR 0001).
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  return (
    <html lang="ko">
      <body>
        {children}
        {kakaoKey ? (
          <Script
            src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&libraries=services&autoload=false`}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
