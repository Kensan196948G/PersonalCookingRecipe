// バックエンドAPIとの型定義
export interface Recipe {
  id: number;
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  cookingTime: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  userId: number;
  // 旧版から統合する追加フィールド
  thumbnailUrl?: string;
  videoUrl?: string;
  videoId?: string;
  channelName?: string;
  channelId?: string;
  publishedAt?: string;
  duration?: string;
  viewCount?: number;
  likeCount?: number;
}

export interface RecipeCreateInput {
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  cookingTime: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  imageUrl?: string;
}

export interface RecipeUpdateInput {
  title?: string;
  description?: string;
  ingredients?: string[];
  instructions?: string[];
  cookingTime?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  imageUrl?: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserCreateInput {
  email: string;
  name: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

// API レスポンス型
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// ページネーション型
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// フィルタリング型
export interface RecipeFilters {
  search?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  cookingTimeMax?: number;
  servingsMin?: number;
  servingsMax?: number;
  // 旧版から統合する検索フィルター
  query?: string;
  channel?: string;
  cookingTime?: {
    min: number;
    max: number;
  };
  publishedAfter?: string;
  publishedBefore?: string;
}

// 外部サービス統合型
export interface YouTubeVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  channelTitle: string;
}

export interface NotionPage {
  id: string;
  title: string;
  url: string;
  lastEditedTime: string;
}

export interface ExternalIntegration {
  youtube?: YouTubeVideo[];
  notion?: NotionPage[];
}

// 旧版から統合する追加型定義
export interface Channel {
  id: string;
  name: string;
  displayName: string;
  thumbnailUrl: string;
  subscriberCount: number;
  videoCount: number;
  description: string;
  isActive: boolean;
  lastChecked: string;
  apiQuota: {
    daily: number;
    remaining: number;
    resetTime: string;
  };
}

export interface SystemStatus {
  isOnline: boolean;
  lastUpdate: string;
  activeChannels: number;
  totalRecipes: number;
  pendingTasks: number;
  apiStatus: {
    youtube: 'connected' | 'error' | 'quota_exceeded';
    notion: 'connected' | 'error' | 'unauthorized';
    tasty: 'connected' | 'error' | 'rate_limited';
  };
  errors: SystemError[];
}

export interface SystemError {
  id: string;
  type: 'api_error' | 'network_error' | 'system_error';
  message: string;
  timestamp: string;
  resolved: boolean;
  channel?: string;
}