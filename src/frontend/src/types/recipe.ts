export interface Recipe {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  videoId: string;
  channelName: string;
  channelId: string;
  publishedAt: string;
  duration: string;
  viewCount: number;
  likeCount: number;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  cookingTime: number; // minutes
  servings: number;
}

export interface Ingredient {
  id: string;
  name: string;
  amount: string;
  unit: string;
  category: string;
  optional?: boolean;
}

export interface RecipeStep {
  id: string;
  stepNumber: number;
  instruction: string;
  imageUrl?: string;
  duration?: number; // minutes
  temperature?: string;
  notes?: string;
}

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

export interface SearchFilters {
  query: string;
  channel?: string;
  difficulty?: string;
  cookingTime?: {
    min: number;
    max: number;
  };
  tags: string[];
  publishedAfter?: string;
  publishedBefore?: string;
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

export interface Statistics {
  totalRecipes: number;
  recipesThisWeek: number;
  recipesThisMonth: number;
  topChannels: Array<{
    channelId: string;
    channelName: string;
    recipeCount: number;
  }>;
  popularTags: Array<{
    tag: string;
    count: number;
  }>;
  avgCookingTime: number;
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
  };
}