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