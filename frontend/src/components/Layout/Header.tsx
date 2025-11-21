'use client';
import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { ChefHatIcon, UserIcon, PlusIcon, SearchIcon } from 'lucide-react';

const Header: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b" role="banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* ロゴとブランド名 */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2" aria-label="Personal Recipe ホーム">
              <ChefHatIcon className="h-8 w-8 text-primary-600" aria-hidden="true" />
              <span className="text-xl font-bold text-gray-900">
                Personal Recipe
              </span>
            </Link>
          </div>

          {/* ナビゲーション */}
          <nav className="hidden md:flex items-center space-x-8" aria-label="メインナビゲーション">
            <Link
              href="/recipes"
              className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              レシピ一覧
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  href="/recipes/create"
                  className="flex items-center space-x-1 text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>新規作成</span>
                </Link>
                <Link
                  href="/my-recipes"
                  className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  マイレシピ
                </Link>
              </>
            )}
          </nav>

          {/* 検索バー */}
          <div className="hidden lg:block flex-1 max-w-xs ml-8 mr-8" role="search">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
              <input
                type="search"
                placeholder="レシピを検索..."
                aria-label="レシピを検索"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* ユーザーメニュー */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="relative group">
                <button
                  className="flex items-center space-x-2 text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  aria-label={`ユーザーメニュー: ${user?.name}`}
                  aria-haspopup="true"
                  aria-expanded="false"
                >
                  <UserIcon className="h-5 w-5" aria-hidden="true" />
                  <span>{user?.name}</span>
                </button>

                {/* ドロップダウンメニュー */}
                <div
                  className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200"
                  role="menu"
                  aria-label="ユーザーメニュー"
                >
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    プロフィール
                  </Link>
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    設定
                  </Link>
                  <hr className="my-1" />
                  <button
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    ログアウト
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  href="/login"
                  className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  ログイン
                </Link>
                <Link
                  href="/register"
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  新規登録
                </Link>
              </div>
            )}

            {/* モバイルメニューボタン */}
            <button
              className="md:hidden"
              aria-label="メニューを開く"
              aria-expanded="false"
              aria-controls="mobile-menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* モバイルメニュー */}
      <div className="md:hidden" id="mobile-menu">
        <nav className="px-2 pt-2 pb-3 space-y-1 sm:px-3" aria-label="モバイルナビゲーション">
          <Link
            href="/recipes"
            className="text-gray-700 hover:text-primary-600 block px-3 py-2 rounded-md text-base font-medium"
          >
            レシピ一覧
          </Link>
          {isAuthenticated && (
            <>
              <Link
                href="/recipes/create"
                className="text-gray-700 hover:text-primary-600 block px-3 py-2 rounded-md text-base font-medium"
              >
                新規作成
              </Link>
              <Link
                href="/my-recipes"
                className="text-gray-700 hover:text-primary-600 block px-3 py-2 rounded-md text-base font-medium"
              >
                マイレシピ
              </Link>
            </>
          )}
        </nav>

        {/* モバイル検索 */}
        <div className="px-4 pb-4" role="search">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              placeholder="レシピを検索..."
              aria-label="レシピを検索"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;