import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  
  // パフォーマンス最適化設定
  compress: true,
  poweredByHeader: false,
  
  // 画像最適化
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // 24時間
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // バンドル最適化
  webpack: (config, { dev, isServer }) => {
    // プロダクション用バンドル最適化
    if (!dev) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      };
    }
    
    return config;
  },
  
  // API接続設定（最適化版）
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'production' 
          ? 'http://localhost:5000/api/:path*'  // 本番環境
          : 'http://localhost:5000/api/:path*', // 開発環境
      },
      {
        source: '/ws/:path*',
        destination: process.env.NODE_ENV === 'production'
          ? 'ws://localhost:5000/ws/:path*'
          : 'ws://localhost:5000/ws/:path*',
      },
    ]
  },
  
  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

export default nextConfig