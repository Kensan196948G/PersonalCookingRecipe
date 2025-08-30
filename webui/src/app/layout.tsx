/**
 * PersonalCookingRecipe WebUI ルートレイアウト
 * Next.js 14 App Router ルートレイアウト
 * 
 * Author: Recipe-DevUI Agent
 * Date: 2025-08-08
 */

import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: {
    template: '%s | PersonalCookingRecipe',
    default: 'PersonalCookingRecipe - 3チャンネル統合レシピ監視システム',
  },
  description: 'macOS環境でYouTube（SAM THE COOKING GUY、Tasty Recipes、Joshua Weissman）から肉料理レシピを自動収集し、Claude AIで解析・翻訳してNotionデータベースに登録する完全自動化システム',
  keywords: ['レシピ', 'YouTube', 'Claude AI', 'Notion', 'macOS', '自動化'],
  authors: [{ name: 'Recipe-DevUI Agent' }],
  creator: 'Recipe-DevUI Agent',
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    title: 'PersonalCookingRecipe',
    description: '3チャンネル統合レシピ監視システム',
    siteName: 'PersonalCookingRecipe',
  },
  twitter: {
    card: 'summary',
    title: 'PersonalCookingRecipe',
    description: '3チャンネル統合レシピ監視システム',
  },
  robots: {
    index: false, // プライベートシステムのため
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* プリフェッチDNSリンク */}
        <link rel="dns-prefetch" href="//localhost:8000" />
        
        {/* セキュリティヘッダー */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
        
        {/* ビューポート設定 */}
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        
        {/* ファビコン */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        
        {/* マニフェスト */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* テーマカラー */}
        <meta name="theme-color" content="#e05d55" />
      </head>
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}