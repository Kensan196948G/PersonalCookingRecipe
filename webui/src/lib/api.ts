/**
 * PersonalCookingRecipe WebUI APIクライアント
 * FastAPIバックエンドとの通信ライブラリ
 * 
 * Author: Recipe-DevUI Agent
 * Date: 2025-08-08
 */

import { 
  APIResponse, 
  Recipe, 
  RecipeFilters, 
  SystemStatus, 
  DashboardSummary, 
  ChannelStats, 
  LogEntry, 
  SystemConfig 
} from '@/types/api';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-api-domain.com/api'
  : 'http://localhost:8000/api';

class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public response: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

class APIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new APIError(
          data.message || 'API request failed',
          response.status,
          data
        );
      }

      return data;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      // ネットワークエラーなど
      throw new APIError(
        'Network error or server unavailable',
        0,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  // ヘルスチェック
  async getHealth(): Promise<APIResponse<SystemStatus>> {
    return this.request<SystemStatus>('/health');
  }

  // ダッシュボードデータ
  async getDashboardData(): Promise<APIResponse<{
    summary: DashboardSummary;
    systemStatus: SystemStatus;
    channelStats: ChannelStats[];
  }>> {
    return this.request('/dashboard');
  }

  // レシピ取得
  async getRecipes(filters: RecipeFilters = {}): Promise<APIResponse<Recipe[]>> {
    const searchParams = new URLSearchParams();
    
    if (filters.channel) searchParams.set('channel', filters.channel);
    if (filters.search_query) searchParams.set('search', filters.search_query);
    if (filters.limit) searchParams.set('limit', filters.limit.toString());
    if (filters.offset) searchParams.set('offset', filters.offset.toString());
    
    const query = searchParams.toString();
    const endpoint = query ? `/recipes?${query}` : '/recipes';
    
    return this.request<Recipe[]>(endpoint);
  }

  // レシピ詳細取得
  async getRecipe(recipeId: string): Promise<APIResponse<Recipe>> {
    return this.request<Recipe>(`/recipes/${recipeId}`);
  }

  // チャンネル統計
  async getChannelStats(): Promise<APIResponse<ChannelStats[]>> {
    return this.request<ChannelStats[]>('/channels/stats');
  }

  // ログ取得
  async getLogs(
    level?: string,
    component?: string,
    limit: number = 100
  ): Promise<APIResponse<LogEntry[]>> {
    const searchParams = new URLSearchParams();
    
    if (level) searchParams.set('level', level);
    if (component) searchParams.set('component', component);
    searchParams.set('limit', limit.toString());
    
    const query = searchParams.toString();
    const endpoint = query ? `/logs?${query}` : '/logs';
    
    return this.request<LogEntry[]>(endpoint);
  }

  // システム設定取得
  async getSystemConfig(): Promise<APIResponse<SystemConfig>> {
    return this.request<SystemConfig>('/config');
  }

  // システム設定更新
  async updateSystemConfig(config: SystemConfig): Promise<APIResponse<{ result: string }>> {
    return this.request<{ result: string }>('/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }
}

// WebSocketクライアント
class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000; // 1秒から開始

  constructor(private channel: string) {}

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // 既に接続済み
    }

    const wsURL = process.env.NODE_ENV === 'production'
      ? `wss://your-api-domain.com/ws/${this.channel}`
      : `ws://localhost:8000/ws/${this.channel}`;

    this.ws = new WebSocket(wsURL);

    this.ws.onopen = () => {
      console.log(`✅ WebSocket connected to ${this.channel}`);
      this.reconnectAttempts = 0;
      this.reconnectInterval = 1000;
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.emit(message.type, message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log(`❌ WebSocket disconnected from ${this.channel}`);
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);

    // 指数バックオフ
    this.reconnectInterval = Math.min(this.reconnectInterval * 2, 30000);
  }

  on(eventType: string, callback: (data: any) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
  }

  off(eventType: string, callback: (data: any) => void) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(eventType: string, data: any) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }
}

// シングルトンAPIクライアント
export const apiClient = new APIClient();

// WebSocketクライアント作成ヘルパー
export const createWebSocketClient = (channel: string) => new WebSocketClient(channel);

// ユーティリティ関数
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}秒`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}分`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}時間${minutes > 0 ? `${minutes}分` : ''}`;
  }
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};