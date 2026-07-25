/**
 * Next.js アプリ設定。
 *
 * モノレポの workspace パッケージをバンドル対象に含め、
 * dist 未ビルドでもソース経由で解決できるようにする。
 */
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @market/shared-types を Next のトランスパイル対象にする
  transpilePackages: ['@market/shared-types'],
};

export default nextConfig;
