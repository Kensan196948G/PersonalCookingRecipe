/**
 * PersonalCookingRecipe WebUI プロバイダー
 * React Query、状態管理、テーマプロバイダーの統合
 * 
 * Author: Recipe-DevUI Agent
 * Date: 2025-08-08
 */

'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// React Query設定
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // キャッシュ時間：5分
      staleTime: 5 * 60 * 1000,
      // 失敗したクエリの自動リトライ
      retry: (failureCount, error: any) => {
        // ネットワークエラーは3回まで、その他は1回のみ
        if (error?.status >= 400 && error?.status < 500) {
          return false; // クライアントエラーは再試行しない
        }
        return failureCount < 3;
      },
      // バックグラウンドでのリフェッチを有効
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      // 変更処理の失敗時リトライ（1回のみ）
      retry: 1,
    },
  },
});

// プロバイダー統合
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* React Query開発者ツール（開発環境のみ） */}
      <ReactQueryDevtools 
        initialIsOpen={false} 
        position="bottom-right"
      />
      
      {/* WebSocket接続管理プロバイダー */}
      <WebSocketProvider>
        {/* 通知プロバイダー */}
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </WebSocketProvider>
    </QueryClientProvider>
  );
}

// WebSocket接続管理プロバイダー
function WebSocketProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // WebSocket接続のライフサイクル管理
    const connections = new Map();
    
    const connect = (channel: string) => {
      if (connections.has(channel)) return;
      
      const wsURL = process.env.NODE_ENV === 'production'
        ? `wss://${window.location.host}/ws/${channel}`
        : `ws://localhost:8000/ws/${channel}`;
      
      try {
        const ws = new WebSocket(wsURL);
        connections.set(channel, ws);
        
        ws.onopen = () => {
          console.log(`✅ WebSocket connected: ${channel}`);
        };
        
        ws.onerror = (error) => {
          console.error(`❌ WebSocket error (${channel}):`, error);
        };
        
        ws.onclose = () => {
          console.log(`🔌 WebSocket disconnected: ${channel}`);
          connections.delete(channel);
          
          // 5秒後に再接続を試行
          setTimeout(() => connect(channel), 5000);
        };
        
      } catch (error) {
        console.error(`Failed to create WebSocket for ${channel}:`, error);
      }
    };
    
    // 主要チャンネルに接続
    connect('logs');
    connect('system');
    
    // クリーンアップ
    return () => {
      connections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
      connections.clear();
    };
  }, []);
  
  return <>{children}</>;
}

// 通知プロバイダー
function NotificationProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // ブラウザ通知の許可リクエスト
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          console.log('📢 Browser notifications enabled');
        }
      });
    }
    
    // Service Workerの登録（将来のオフライン対応用）
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
    }
  }, []);
  
  return <>{children}</>;
}