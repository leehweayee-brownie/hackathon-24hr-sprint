import type { NextConfig } from 'next';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const wsUrl = apiUrl.replace(/^http/, 'ws');
const storageOrigins = (process.env.NEXT_PUBLIC_STORAGE_ORIGINS ?? 'http://localhost:9000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .join(' ');

const csp = [
  "default-src 'self'",
  `connect-src 'self' ${apiUrl} ${wsUrl} ${storageOrigins} blob: data:`,
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com data:',
  `img-src 'self' data: blob: ${storageOrigins} ${apiUrl}`,
  `frame-src 'self' blob: ${storageOrigins} ${apiUrl}`,
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@vp/shared', '@vp/rules'],
  reactStrictMode: true,
  outputFileTracingRoot: require('node:path').join(__dirname, '../../'),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

export default nextConfig;
