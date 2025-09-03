import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ReactQueryProvider } from '@/providers/ReactQueryProvider';
import { Layout } from '@/components/Layout/Layout';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Personal Cooking Recipe Monitor',
  description: '3チャンネル統合レシピ監視システム',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
  keywords: ['recipe', 'cooking', 'youtube', 'monitoring', 'レシピ', '料理'],
  authors: [{ name: 'Personal Cooking Recipe Team' }],
  creator: 'Personal Cooking Recipe Team',
  publisher: 'Personal Cooking Recipe Team',
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: 'https://recipe-monitor.example.com',
    siteName: 'Personal Cooking Recipe Monitor',
    title: 'Personal Cooking Recipe Monitor',
    description: '3チャンネル統合レシピ監視システム',
    images: [
      {
        url: '/screenshot-wide.png',
        width: 1280,
        height: 720,
        alt: 'Recipe Monitor Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Personal Cooking Recipe Monitor',
    description: '3チャンネル統合レシピ監視システム',
    images: ['/screenshot-wide.png'],
  },
  metadataBase: new URL('https://recipe-monitor.example.com'),
  robots: {
    index: false, // Private application
    follow: false,
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

// Request notification permission on app start
if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Register service worker for PWA
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      console.log('SW registered: ', registration);
    })
    .catch((registrationError) => {
      console.log('SW registration failed: ', registrationError);
    });
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        
        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="preconnect" href="https://yt3.ggpht.com" />
      </head>
      <body className={inter.className}>
        <ReactQueryProvider>
          <Layout>
            {children}
          </Layout>
        </ReactQueryProvider>
      </body>
    </html>
  );
}