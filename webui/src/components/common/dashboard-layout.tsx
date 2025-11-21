/**
 * PersonalCookingRecipe WebUI ダッシュボードレイアウト
 * サイドナビゲーション付きメインレイアウトコンポーネント
 * 
 * Author: Recipe-DevUI Agent
 * Date: 2025-08-08
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  HomeIcon,
  ChefHatIcon,
  SettingsIcon,
  FileTextIcon,
  ActivityIcon,
  MenuIcon,
  XIcon,
  BellIcon,
} from 'lucide-react';

const navigation = [
  {
    name: 'ダッシュボード',
    href: '/',
    icon: HomeIcon,
    description: 'システム概要と統計',
  },
  {
    name: 'レシピ管理',
    href: '/recipes',
    icon: ChefHatIcon,
    description: 'レシピ一覧・検索・詳細',
  },
  {
    name: 'システム監視',
    href: '/monitoring',
    icon: ActivityIcon,
    description: 'パフォーマンス・ログ監視',
  },
  {
    name: 'ログ管理',
    href: '/logs',
    icon: FileTextIcon,
    description: 'システムログ・エラー管理',
  },
  {
    name: 'システム設定',
    href: '/settings',
    icon: SettingsIcon,
    description: 'チャンネル・通知設定',
  },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* モバイル用サイドバーオーバーレイ */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="modal-backdrop" />
        </div>
      )}

      {/* サイドバー */}
      <div className={clsx(
        'fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* ロゴヘッダー */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <ChefHatIcon className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="ml-3">
                <h1 className="text-sm font-semibold text-gray-900">
                  PersonalCookingRecipe
                </h1>
                <p className="text-xs text-gray-500">
                  レシピ監視システム
                </p>
              </div>
            </div>
            <button
              type="button"
              className="lg:hidden p-2 text-gray-400 hover:text-gray-600"
              onClick={() => setSidebarOpen(false)}
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          {/* ナビゲーション */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={clsx(
                    'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon
                    className={clsx(
                      'mr-3 h-5 w-5 flex-shrink-0 transition-colors duration-200',
                      isActive
                        ? 'text-primary-600'
                        : 'text-gray-400 group-hover:text-gray-600'
                    )}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className={clsx(
                      'text-xs mt-0.5',
                      isActive ? 'text-primary-600' : 'text-gray-500'
                    )}>
                      {item.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* システム状態フッター */}
          <div className="p-4 border-t border-gray-200">
            <SystemStatusFooter />
          </div>
        </div>
      </div>

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* トップバー */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                type="button"
                className="lg:hidden p-2 text-gray-400 hover:text-gray-600"
                onClick={() => setSidebarOpen(true)}
              >
                <MenuIcon className="w-5 h-5" />
              </button>
              
              {/* パンくずナビゲーション */}
              <nav className="flex ml-4 lg:ml-0" aria-label="パンくず">
                <ol className="flex items-center space-x-2 text-sm text-gray-500">
                  <li>
                    <Link href="/" className="hover:text-gray-700">
                      ホーム
                    </Link>
                  </li>
                  {pathname !== '/' && (
                    <>
                      <span>/</span>
                      <li className="text-gray-900 font-medium">
                        {navigation.find(item => item.href === pathname)?.name || 'ページ'}
                      </li>
                    </>
                  )}
                </ol>
              </nav>
            </div>

            {/* 右側のアクション */}
            <div className="flex items-center space-x-4">
              {/* 通知ボタン */}
              <button
                type="button"
                className="p-2 text-gray-400 hover:text-gray-600 relative"
              >
                <BellIcon className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-error-500 rounded-full"></span>
              </button>
              
              {/* リフレッシュボタン */}
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={() => window.location.reload()}
              >
                更新
              </button>
            </div>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// システム状態フッターコンポーネント
function SystemStatusFooter() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">システム状態</span>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-green-700 font-medium">正常</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">今日の処理数</span>
        <span className="font-medium text-gray-900">24件</span>
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">API接続</span>
        <span className="text-green-700 font-medium">4/4 正常</span>
      </div>
    </div>
  );
}