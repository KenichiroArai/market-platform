import type { ReactNode } from 'react';

export const metadata = {
  title: 'market-platform',
  description: 'Market data and analysis platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, fontFamily: 'Georgia, "Times New Roman", serif' }}>{children}</body>
    </html>
  );
}
