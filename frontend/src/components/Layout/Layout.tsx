import React, { ReactNode, useMemo } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Header from './Header';

// Footerを動的インポート (初期ロード時には不要)
const Footer = dynamic(() => import('./Footer'), {
  loading: () => <div className="h-16" />,
});

interface LayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  className?: string;
}

export const Layout: React.FC<LayoutProps> = React.memo(({
  children,
  title = 'Personal Recipe - あなただけのレシピコレクション',
  description = 'あなただけの特別なレシピコレクション。料理の記録、共有、発見を通じて、より豊かな食生活をお手伝いします。',
  showHeader = true,
  showFooter = true,
  className = '',
}) => {
  const containerClassName = useMemo(
    () => `min-h-screen flex flex-col bg-gray-50 ${className}`,
    [className]
  );
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta charSet="utf-8" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:site_name" content="Personal Recipe" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* Google Fonts - Preload & Display swap */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />

        {/* Preload critical assets */}
        <link rel="dns-prefetch" href="https://i.ytimg.com" />
        <link rel="dns-prefetch" href="https://img.youtube.com" />
      </Head>

      <div className={containerClassName}>
        {showHeader && <Header />}

        <main className="flex-1">
          {children}
        </main>

        {showFooter && <Footer />}
      </div>
    </>
  );
});

Layout.displayName = 'Layout';

export default Layout;