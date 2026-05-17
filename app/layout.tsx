import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://granite.kr"),
  title: {
    default: "Granite",
    template: "%s · Granite"
  },
  description: "국내 자연 볼더링 스팟을 탐색하고 Route 정보를 확인하는 모바일 웹앱",
  openGraph: {
    title: "Granite",
    description: "국내 자연 볼더링 스팟 탐색",
    url: "https://granite.kr",
    siteName: "Granite",
    locale: "ko_KR",
    type: "website"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <div className="mx-auto min-h-screen w-full max-w-[360px] bg-white shadow-card">
          {children}
        </div>
      </body>
    </html>
  );
}
