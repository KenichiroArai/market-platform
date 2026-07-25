/**
 * アプリ全体のレイアウト。
 * Phase 0 はブランド確認用の最小構成（html/body + 基本タイポグラフィのみ）。
 */
import type { ReactNode } from 'react';

/** ブラウザタブ等に出すメタ情報。 */
export const metadata = {
  title: 'market-platform',
  description: 'Market data and analysis platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      {/* システムフォントに頼らず、表示の第一印象を揃える */}
      <body style={{ margin: 0, fontFamily: 'Georgia, "Times New Roman", serif' }}>{children}</body>
    </html>
  );
}
