/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['localhost', '127.0.0.1'],
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*', // バックエンドAPIプロキシ
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // カスタムwebpack設定
    return config;
  },
};

module.exports = nextConfig;