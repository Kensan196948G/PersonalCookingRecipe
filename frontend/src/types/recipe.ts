export interface Recipe {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: string; // YouTube format: PT4M13S
  publishedAt: string;
  channelName: string;
  channelId: string;
  videoId: string;
  viewCount: number;
  likeCount: number;
  
  // Recipe specific fields
  ingredients: Ingredient[];
  steps: RecipeStep[];
  cookingTime?: number; // minutes
  prepTime?: number; // minutes
  servings?: number;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  category?: string;
  cuisine?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived';
}

export interface RecipeStep {
  id: string;
  stepNumber: number;
  instruction: string;
  duration?: number; // minutes
  temperature?: string;
  imageUrl?: string;
  notes?: string;
  equipment?: string[];
  techniques?: string[];
}

export interface Ingredient {
  id: string;
  name: string;
  amount: number;
  unit: string;
  notes?: string;
  optional?: boolean;
  category?: 'protein' | 'vegetable' | 'dairy' | 'grain' | 'spice' | 'other';
}

export interface SearchFilters {
  query?: string;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  cookingTime?: {
    min?: number;
    max?: number;
  };
  servings?: {
    min?: number;
    max?: number;
  };
  category?: string;
  cuisine?: string;
  ingredients?: string[];
  publishedAfter?: string;
  publishedBefore?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: 'success' | 'error';
  timestamp: string;
}

// Channel related types
export interface Channel {
  id: string;
  name: string;
  description: string;
  thumbnailUrl?: string;
  subscriberCount?: number;
  videoCount?: number;
  isActive: boolean;
  lastChecked: string;
  keywords: string[];
  language: 'ja' | 'en';
}

// System status types
export interface SystemStatus {
  isOnline: boolean;
  totalRecipes: number;
  activeChannels: number;
  pendingTasks: number;
  lastUpdate: string;
  errors?: SystemError[];
}

export interface SystemError {
  id: string;
  type: 'youtube' | 'notion' | 'gmail' | 'system';
  message: string;
  timestamp: string;
  channel?: string;
  resolved: boolean;
}

// YouTube specific types
export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: string;
  publishedAt: string;
  channelId: string;
  channelName: string;
  viewCount: number;
  likeCount: number;
  tags: string[];
}

// Notion integration types
export interface NotionPage {
  pageId: string;
  title: string;
  content: string;
  lastModified: string;
  properties: Record<string, any>;
}

// User preferences types
export interface UserPreferences {
  language: 'ja' | 'en';
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    desktop: boolean;
  };
  defaultFilters: SearchFilters;
  favoriteChannels: string[];
}

export type RecipeWithChannel = Recipe & {
  channel: Channel;
};