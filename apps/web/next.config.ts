import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@market/shared-types'],
};

export default nextConfig;
