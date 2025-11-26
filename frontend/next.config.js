const HOST_IP = process.env.HOST_IP || process.env.FRONTEND_HOST || '127.0.0.1';
const API_HOST = process.env.API_HOST || HOST_IP;
const BACKEND_PORT = process.env.BACKEND_PORT || process.env.API_PORT || 5000;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || `http://${API_HOST}:${BACKEND_PORT}`;

const imageDomains = ['localhost', '127.0.0.1', 'i.ytimg.com', 'img.youtube.com'];
if (API_HOST && !imageDomains.includes(API_HOST)) {
  imageDomains.push(API_HOST);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 画像最適化 (AVIF/WebP対応)
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Webpack最適化
  webpack: (config, { dev, isServer }) => {
    // 本番環境でのコードスプリッティング最適化
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Next.js chunk
            framework: {
              name: 'framework',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
              priority: 40,
              enforce: true,
            },
            // Vendorライブラリ
            lib: {
              test: /[\\/]node_modules[\\/]/,
              name: (module) => {
                const packageName = module.context.match(
                  /[\\/]node_modules[\\/](.*?)([\\/]|$)/
                )?.[1];
                return `npm.${packageName?.replace('@', '')}`;
              },
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
            // 共通コンポーネント
            commons: {
              name: 'commons',
              minChunks: 2,
              priority: 20,
              reuseExistingChunk: true,
            },
          },
        },
        // モジュールID最適化
        moduleIds: 'deterministic',
      };

      // Tree shaking最適化
      config.optimization.usedExports = true;
    }

    return config;
  },

  // API Rewrites
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_BASE_URL}/api/:path*`,
      },
    ];
  },

  // React Strict Mode
  reactStrictMode: true,

  // 圧縮有効化
  compress: true,

  // パフォーマンス最適化
  poweredByHeader: false,

  // Production Source Maps無効化
  productionBrowserSourceMaps: false,

  // モダンブラウザ最適化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Experimental features
  experimental: {
    optimizePackageImports: ['lucide-react', '@heroicons/react', 'date-fns'],
    optimizeCss: true,
  },

  // セキュリティとパフォーマンス向上のためのヘッダー
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // TypeScript設定
  typescript: {
    ignoreBuildErrors: true,
  },

  // ESLint設定
  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;