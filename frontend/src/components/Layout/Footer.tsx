import React from 'react';
import Link from 'next/link';
import { ChefHatIcon, HeartIcon } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-50 border-t">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* ブランドセクション */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <ChefHatIcon className="h-8 w-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">
                Personal Recipe
              </span>
            </div>
            <p className="text-gray-600 text-sm max-w-md">
              あなただけの特別なレシピコレクション。
              料理の記録、共有、発見を通じて、より豊かな食生活をお手伝いします。
            </p>
            <div className="mt-4 flex items-center text-sm text-gray-500">
              <span>Made with</span>
              <HeartIcon className="h-4 w-4 text-red-500 mx-1" />
              <span>for food lovers</span>
            </div>
          </div>

          {/* ナビゲーションリンク */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
              サービス
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/recipes" className="text-gray-600 hover:text-primary-600 text-sm">
                  レシピ一覧
                </Link>
              </li>
              <li>
                <Link href="/recipes/create" className="text-gray-600 hover:text-primary-600 text-sm">
                  レシピ作成
                </Link>
              </li>
              <li>
                <Link href="/categories" className="text-gray-600 hover:text-primary-600 text-sm">
                  カテゴリー
                </Link>
              </li>
              <li>
                <Link href="/favorites" className="text-gray-600 hover:text-primary-600 text-sm">
                  お気に入り
                </Link>
              </li>
            </ul>
          </div>

          {/* サポートリンク */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
              サポート
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/help" className="text-gray-600 hover:text-primary-600 text-sm">
                  ヘルプ
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-gray-600 hover:text-primary-600 text-sm">
                  よくある質問
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-600 hover:text-primary-600 text-sm">
                  お問い合わせ
                </Link>
              </li>
              <li>
                <Link href="/feedback" className="text-gray-600 hover:text-primary-600 text-sm">
                  フィードバック
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* 統合サービス */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <div className="text-center">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">
              外部サービス統合
            </h4>
            <div className="flex justify-center space-x-6 text-sm text-gray-600">
              <span className="flex items-center">
                <svg className="h-4 w-4 mr-2 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                YouTube
              </span>
              <span className="flex items-center">
                <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.3 3C3.9 3 3.6 3.3 3.6 3.7v16.6c0 .4.3.7.7.7h15.4c.4 0 .7-.3.7-.7V3.7c0-.4-.3-.7-.7-.7H4.3zm9.1 1.4c1.3 0 2.6.1 3.8.3.8.1 1.4.8 1.5 1.7.1 1.1.2 2.3.2 3.5 0 1.3-.1 2.4-.2 3.5-.1.9-.7 1.6-1.5 1.7-1.2.2-2.5.3-3.8.3-1.3 0-2.6-.1-3.8-.3-.8-.1-1.4-.8-1.5-1.7-.1-1.1-.2-2.3-.2-3.5 0-1.3.1-2.4.2-3.5.1-.9.7-1.6 1.5-1.7 1.2-.2 2.5-.3 3.8-.3z"/>
                </svg>
                Notion
              </span>
              <span className="flex items-center">
                <svg className="h-4 w-4 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-.9.732-1.636 1.636-1.636h.364L12 11.64l9.636-7.819h.364c.904 0 1.636.732 1.636 1.636z"/>
                </svg>
                Gmail
              </span>
            </div>
          </div>
        </div>

        {/* コピーライト */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-gray-600">
              <p>&copy; 2024 Personal Recipe. All rights reserved.</p>
            </div>
            <div className="mt-4 md:mt-0 flex space-x-6 text-sm text-gray-600">
              <Link href="/privacy" className="hover:text-primary-600">
                プライバシーポリシー
              </Link>
              <Link href="/terms" className="hover:text-primary-600">
                利用規約
              </Link>
              <Link href="/cookies" className="hover:text-primary-600">
                Cookie設定
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;