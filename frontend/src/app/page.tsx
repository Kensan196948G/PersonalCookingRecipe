import React from 'react';
import Layout from '@/components/Layout/Layout';
import Link from 'next/link';
import { ChefHatIcon, SearchIcon, StarIcon, UserGroupIcon } from 'lucide-react';

export default function HomePage() {
  return (
    <Layout>
      {/* ヒーローセクション */}
      <section className="relative bg-gradient-to-br from-primary-50 to-secondary-50 py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <ChefHatIcon className="h-20 w-20 text-primary-600" />
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              あなただけの
              <span className="text-primary-600 block">レシピコレクション</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              料理の記録、共有、発見を通じて、より豊かな食生活をお手伝いします。
              YouTube、Notion、Gmailとの統合で、レシピ管理がより便利に。
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/recipes"
                className="btn-primary text-lg px-8 py-3"
              >
                レシピを探す
              </Link>
              <Link
                href="/register"
                className="btn-outline text-lg px-8 py-3"
              >
                無料で始める
              </Link>
            </div>
          </div>
        </div>
        
        {/* 装飾的な要素 */}
        <div className="absolute top-10 left-10 opacity-10">
          <div className="w-32 h-32 bg-primary-300 rounded-full"></div>
        </div>
        <div className="absolute bottom-10 right-10 opacity-10">
          <div className="w-24 h-24 bg-secondary-300 rounded-full"></div>
        </div>
      </section>

      {/* 機能セクション */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              充実した機能
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              レシピ管理に必要なすべての機能を、シンプルで使いやすいインターフェースで提供します。
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* レシピ管理 */}
            <div className="card hover-shadow">
              <div className="card-body text-center p-8">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ChefHatIcon className="h-8 w-8 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  レシピ管理
                </h3>
                <p className="text-gray-600">
                  材料、手順、調理時間、難易度などを詳細に記録。
                  写真付きで分かりやすく保存できます。
                </p>
              </div>
            </div>

            {/* 検索・フィルター */}
            <div className="card hover-shadow">
              <div className="card-body text-center p-8">
                <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <SearchIcon className="h-8 w-8 text-secondary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  高度な検索
                </h3>
                <p className="text-gray-600">
                  材料名、調理時間、難易度、タグで絞り込み。
                  欲しいレシピが素早く見つかります。
                </p>
              </div>
            </div>

            {/* 外部連携 */}
            <div className="card hover-shadow">
              <div className="card-body text-center p-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <UserGroupIcon className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  外部サービス連携
                </h3>
                <p className="text-gray-600">
                  YouTube動画、Notionページ、Gmailでの共有。
                  既存のワークフローと連携できます。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 統合サービス紹介 */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              外部サービスとの統合
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              普段使っているサービスと連携して、より便利にレシピを管理できます。
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* YouTube統合 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="h-8 w-8 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  YouTube連携
                </h3>
                <p className="text-gray-600 mb-6">
                  関連する料理動画を自動検索して、レシピと一緒に保存。
                  作り方の動画で理解が深まります。
                </p>
                <div className="space-y-2 text-sm text-gray-500">
                  <div className="flex items-center justify-center">
                    <StarIcon className="h-4 w-4 mr-1" />
                    <span>関連動画の自動検索</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <StarIcon className="h-4 w-4 mr-1" />
                    <span>お気に入り動画の保存</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notion統合 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="h-8 w-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4.3 3C3.9 3 3.6 3.3 3.6 3.7v16.6c0 .4.3.7.7.7h15.4c.4 0 .7-.3.7-.7V3.7c0-.4-.3-.7-.7-.7H4.3zm9.1 1.4c1.3 0 2.6.1 3.8.3.8.1 1.4.8 1.5 1.7.1 1.1.2 2.3.2 3.5 0 1.3-.1 2.4-.2 3.5-.1.9-.7 1.6-1.5 1.7-1.2.2-2.5.3-3.8.3-1.3 0-2.6-.1-3.8-.3-.8-.1-1.4-.8-1.5-1.7-.1-1.1-.2-2.3-.2-3.5 0-1.3.1-2.4.2-3.5.1-.9.7-1.6 1.5-1.7 1.2-.2 2.5-.3 3.8-.3z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Notion連携
                </h3>
                <p className="text-gray-600 mb-6">
                  Notionページからレシピをインポート。
                  既存のメモやレシピデータベースを活用できます。
                </p>
                <div className="space-y-2 text-sm text-gray-500">
                  <div className="flex items-center justify-center">
                    <StarIcon className="h-4 w-4 mr-1" />
                    <span>ページ自動インポート</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <StarIcon className="h-4 w-4 mr-1" />
                    <span>双方向同期</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Gmail統合 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="h-8 w-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-.9.732-1.636 1.636-1.636h.364L12 11.64l9.636-7.819h.364c.904 0 1.636.732 1.636 1.636z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Gmail連携
                </h3>
                <p className="text-gray-600 mb-6">
                  お気に入りのレシピを家族や友人に簡単にメール送信。
                  買い物リストも一緒に共有できます。
                </p>
                <div className="space-y-2 text-sm text-gray-500">
                  <div className="flex items-center justify-center">
                    <StarIcon className="h-4 w-4 mr-1" />
                    <span>レシピの簡単共有</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <StarIcon className="h-4 w-4 mr-1" />
                    <span>買い物リスト送信</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA セクション */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            今すぐ始めてみませんか？
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            無料でアカウントを作成して、あなただけのレシピコレクションを始めましょう。
          </p>
          <Link
            href="/register"
            className="inline-flex items-center px-8 py-3 text-lg font-medium text-primary-600 bg-white rounded-lg hover:bg-gray-50 transition-colors duration-200"
          >
            無料で始める
          </Link>
        </div>
      </section>
    </Layout>
  );
}