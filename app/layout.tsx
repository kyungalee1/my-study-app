import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { RegisterServiceWorker } from "./register-sw";
import { IosInstallBanner } from "./ios-install-banner";

export const metadata: Metadata = {
  title: "공부 관리",
  description: "두 아이를 위한 스마트 학습 관리 앱",
  applicationName: "공부 관리",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "공부관리",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#3182F6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full">
        <RegisterServiceWorker />
        <Providers>
          {children}
          <IosInstallBanner />
        </Providers>
      </body>
    </html>
  );
}
