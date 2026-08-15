/**
 * アプリ全体のレイアウト。
 *
 * html/body と基本タイポグラフィのみ。
 * ログイン後シェルと認証画面のゲートは (app) / (guest) のネストレイアウトに置く。
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
