import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ReactQueryProvider } from '@/providers/ReactQueryProvider';
import { AuthProvider } from '@/hooks/useAuth';
import Layout from '@/components/Layout/Layout';
import { PWAInstaller } from '@/components/PWAInstaller';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Personal Cooking Recipe Monitor - レシピ管理システム',
    template: '%s | Personal Cooking Recipe Monitor',
  },
  description: '料理レシピの監視・管理・検索ができる統合レシピシステム。YouTube連携でお気に入りのレシピ動画を一元管理。',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
  keywords: [
    'レシピ管理',
    '料理',
    'レシピ検索',
    'YouTube レシピ',
    'クッキングアプリ',
    '食事計画',
    '料理動画',
    'recipe management',
    'cooking',
    'recipe search',
    'meal planning',
  ],
  authors: [{ name: 'Personal Cooking Recipe Team' }],
  creator: 'Personal Cooking Recipe Team',
  publisher: 'Personal Cooking Recipe Team',
  applicationName: 'Personal Cooking Recipe Monitor',
  category: 'productivity',
  classification: 'Food & Recipe Management Application',
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: 'https://recipe-monitor.example.com',
    siteName: 'Personal Cooking Recipe Monitor',
    title: 'Personal Cooking Recipe Monitor - レシピ管理システム',
    description: '料理レシピの監視・管理・検索ができる統合レシピシステム',
    images: [
      {
        url: '/screenshot-wide.png',
        width: 1280,
        height: 720,
        alt: 'Recipe Monitor Dashboard - レシピダッシュボード',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Personal Cooking Recipe Monitor',
    description: '料理レシピの監視・管理・検索ができる統合レシピシステム',
    images: ['/screenshot-wide.png'],
  },
  metadataBase: new URL('https://recipe-monitor.example.com'),
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
  alternates: {
    canonical: 'https://recipe-monitor.example.com',
    languages: {
      'ja-JP': 'https://recipe-monitor.example.com',
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#ea580c',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 構造化データ (JSON-LD) for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Personal Cooking Recipe Monitor',
    applicationCategory: 'LifestyleApplication',
    applicationSubCategory: 'Recipe Management',
    operatingSystem: 'All',
    description: '料理レシピの監視・管理・検索ができる統合レシピシステム。YouTube連携でお気に入りのレシピ動画を一元管理。',
    url: 'https://recipe-monitor.example.com',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
    },
    featureList: [
      'レシピ検索',
      'レシピ管理',
      'YouTube連携',
      '食事計画',
      'お気に入り管理',
    ],
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    availableLanguage: ['Japanese', 'English'],
  };

  return (
    <html lang="ja">
      <head>
        {/* PWA Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Recipe Monitor" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#ea580c" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* DNS Prefetch */}
        <link rel="dns-prefetch" href="https://i.ytimg.com" />
        <link rel="dns-prefetch" href="https://yt3.ggpht.com" />

        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://i.ytimg.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://yt3.ggpht.com" crossOrigin="anonymous" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192.png" />

        {/* 構造化データ (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>
        <PWAInstaller />
        <AuthProvider>
          <ReactQueryProvider>
            <Layout>
              {children}
            </Layout>
          </ReactQueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}