/**
 * ダッシュボード状態管理ストア
 * Zustand使用による軽量状態管理
 * 
 * Author: Recipe-DevUI Agent
 * Date: 2025-08-08
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { DashboardSummary, SystemStatus, ChannelStats } from '@/types/api';

interface DashboardState {
  // データ状態
  summary: DashboardSummary | null;
  systemStatus: SystemStatus | null;
  channelStats: ChannelStats[];
  
  // UI状態
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // WebSocket接続状態
  isConnected: boolean;
  
  // アクション
  setSummary: (summary: DashboardSummary) => void;
  setSystemStatus: (status: SystemStatus) => void;
  setChannelStats: (stats: ChannelStats[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setConnected: (connected: boolean) => void;
  updateLastRefresh: () => void;
  reset: () => void;
}

const initialState = {
  summary: null,
  systemStatus: null,
  channelStats: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  isConnected: false,
};

export const useDashboardStore = create<DashboardState>()(
  devtools(
    (set, get) => ({
      ...initialState,
      
      setSummary: (summary) => set(
        { summary, lastUpdated: new Date() }, 
        false, 
        'setSummary'
      ),
      
      setSystemStatus: (systemStatus) => set(
        { systemStatus, lastUpdated: new Date() }, 
        false, 
        'setSystemStatus'
      ),
      
      setChannelStats: (channelStats) => set(
        { channelStats, lastUpdated: new Date() }, 
        false, 
        'setChannelStats'
      ),
      
      setLoading: (isLoading) => set(
        { isLoading }, 
        false, 
        'setLoading'
      ),
      
      setError: (error) => set(
        { error, isLoading: false }, 
        false, 
        'setError'
      ),
      
      setConnected: (isConnected) => set(
        { isConnected }, 
        false, 
        'setConnected'
      ),
      
      updateLastRefresh: () => set(
        { lastUpdated: new Date() }, 
        false, 
        'updateLastRefresh'
      ),
      
      reset: () => set(
        initialState, 
        false, 
        'reset'
      ),
    }),
    {
      name: 'dashboard-store',
    }
  )
);

// セレクター（計算プロパティ）
export const useDashboardSelectors = () => {
  const store = useDashboardStore();
  
  return {
    // 健康度チェック
    isHealthy: store.systemStatus?.overall_health === 'healthy',
    
    // 今日の統計
    todayStats: {
      processed: store.summary?.today_processed || 0,
      avgQuality: store.summary?.avg_quality_score || 0,
      highQualityCount: store.summary?.high_quality_count || 0,
    },
    
    // チャンネル別統計サマリー
    channelSummary: store.channelStats.reduce((acc, channel) => {
      acc.total += channel.total_recipes;
      acc.todayTotal += channel.today_added;
      return acc;
    }, { total: 0, todayTotal: 0 }),
    
    // 最近のエラー数
    recentErrorCount: store.systemStatus?.recent_errors.length || 0,
    
    // 接続状態アイコン
    connectionIcon: store.isConnected ? '🟢' : '🔴',
    
    // データ新鮮度（分単位）
    dataAgeMinutes: store.lastUpdated 
      ? Math.floor((Date.now() - store.lastUpdated.getTime()) / (1000 * 60))
      : null,
  };
};