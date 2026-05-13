import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "공부 관리",
  description: "두 아이를 위한 스마트 학습 관리 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
