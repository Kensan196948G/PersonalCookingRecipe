/**
 * PersonalCookingRecipe WebUI API型定義
 * FastAPI バックエンドとの型同期
 * 
 * Author: Recipe-DevUI Agent
 * Date: 2025-08-08
 */

export interface APIResponse<T> {
  data: T;
  status: 'success' | 'error';
  message?: string;
  timestamp: string;
  request_id?: string;
}

export interface PaginationMeta {
  total_count: number;
  page_size: number;
  current_page: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

// レシピ関連型
export interface VideoData {
  video_id: string;
  title: string;
  description: string;
  channel_id: string;
  channel_name: string;
  published_at: string;
  duration: string;
  thumbnail_url: string;
  view_count: number;
  like_count: number;
  url: string;
}

export interface Recipe {
  recipe_id: string;
  source_video: VideoData;
  title_ja: string;
  description_ja: string;
  ingredients: string[];
  instructions: string[];
  cooking_time?: string;
  difficulty: number; // 1-5
  tags: string[];
  category: string;
  quality_score: number; // 0.0-1.0
  processed_at: string;
  notion_url?: string;
  notion_page_id?: string;
  channel: 'sam_cooking' | 'tasty' | 'joshua';
}

export interface RecipeFilters {
  channel?: 'sam_cooking' | 'tasty' | 'joshua';
  search_query?: string;
  difficulty?: number;
  min_quality_score?: number;
  date_from?: string;
  date_to?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

// システム状態関連型
export interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_in: number;
  network_out: number;
}

export interface APIStatus {
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'maintenance';
  last_check: string;
  response_time?: number;
  error_message?: string;
}

export interface SystemStatus {
  overall_health: 'healthy' | 'warning' | 'error' | 'maintenance';
  uptime_seconds: number;
  last_updated: string;
  api_status: APIStatus[];
  metrics: SystemMetrics;
  total_recipes: number;
  today_processed: number;
  success_rate: number;
  recent_errors: string[];
}

export interface ChannelStats {
  channel: 'sam_cooking' | 'tasty' | 'joshua';
  channel_name: string;
  total_recipes: number;
  today_added: number;
  avg_quality_score: number;
  last_processed?: string;
  success_rate: number;
  weekly_trend: number[];
}

export interface DashboardSummary {
  total_recipes: number;
  today_processed: number;
  weekly_processed: number;
  avg_processing_time: number;
  high_quality_count: number;
  avg_quality_score: number;
  channel_distribution: Record<string, number>;
  recent_recipes: Recipe[];
  daily_trend: Array<{
    date: string;
    count: number;
  }>;
}

// ログ関連型
export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type LogComponent = 'system' | 'youtube' | 'claude' | 'notion' | 'gmail' | 'api' | 'scheduler' | 'keychain';

export interface LogEntry {
  id?: string;
  timestamp: string;
  level: LogLevel;
  component: LogComponent;
  message: string;
  metadata?: Record<string, any>;
  exception_type?: string;
  stack_trace?: string;
  user_id?: string;
  session_id?: string;
  request_id?: string;
}

// 設定関連型
export interface ChannelConfig {
  channel_id: string;
  channel_name: string;
  enabled: boolean;
  priority: number; // 1-5
  check_interval: number; // seconds
  keywords: string[];
  exclude_keywords: string[];
}

export interface MonitoringConfig {
  enabled: boolean;
  check_interval: number; // seconds
  max_videos_per_run: number;
  quality_threshold: number; // 0.0-1.0
  retry_attempts: number;
  timeout_seconds: number;
}

export interface NotificationConfig {
  email_enabled: boolean;
  macos_notification_enabled: boolean;
  notification_levels: LogLevel[];
  email_recipients: string[];
  daily_summary: boolean;
}

export interface APISettings {
  youtube_quota_limit: number;
  claude_model: string;
  claude_max_tokens: number;
  notion_page_template: string;
  request_timeout: number;
}

export interface SystemConfig {
  channels: ChannelConfig[];
  monitoring: MonitoringConfig;
  notification: NotificationConfig;
  api_settings: APISettings;
  log_level: LogLevel;
  data_retention_days: number;
  backup_enabled: boolean;
  last_updated: string;
  updated_by: string;
}

// WebSocket関連型
export interface WebSocketMessage {
  type: string;
  timestamp: string;
}

export interface LogWebSocketMessage extends WebSocketMessage {
  type: 'new_log';
  data: LogEntry;
}

export interface SystemWebSocketMessage extends WebSocketMessage {
  type: 'health_update' | 'metrics_update';
  data: Record<string, any>;
}

export interface NotificationWebSocketMessage extends WebSocketMessage {
  type: 'notification';
  level: LogLevel;
  title: string;
  message: string;
  data?: Record<string, any>;
}