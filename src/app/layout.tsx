import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '私人文档库',
    template: '%s | 私人文档库',
  },
  description: '私人文档管理空间',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {children}
      </body>
    </html>
  );
}
