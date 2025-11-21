/**
 * PersonalCookingRecipe WebUI メインページ（ダッシュボード）
 * Next.js 14 App Router ホームページ
 * 
 * Author: Recipe-DevUI Agent
 * Date: 2025-08-08
 */

import { Metadata } from 'next';
import { DashboardLayout } from '@/components/common/dashboard-layout';
import { DashboardOverview } from '@/components/dashboard/dashboard-overview';
import { SystemStatus } from '@/components/dashboard/system-status';
import { ChannelStats } from '@/components/dashboard/channel-stats';
import { RecentRecipes } from '@/components/dashboard/recent-recipes';

export const metadata: Metadata = {
  title: 'ダッシュボード',
  description: 'PersonalCookingRecipe システムの状態とレシピ統計を表示',
};

export default function HomePage() {
  return (
    <DashboardLayout>
      {/* ページヘッダー */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              🍳 PersonalCookingRecipe ダッシュボード
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              3チャンネル統合レシピ監視システムの状態とパフォーマンスを監視
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* 接続状態インジケーター */}
            <div className="flex items-center space-x-2 text-sm">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-gray-600">リアルタイム監視中</span>
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="space-y-8">
        {/* 概要統計 */}
        <DashboardOverview />
        
        {/* システムステータスとチャンネル統計 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SystemStatus />
          <ChannelStats />
        </div>
        
        {/* 最近のレシピ */}
        <RecentRecipes />
      </div>
    </DashboardLayout>
  );
}