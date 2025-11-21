// Recipe関連の型定義

export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

export interface Instruction {
  description: string;
  time?: number; // 分単位
}

export interface Author {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
  prepTime: number; // 準備時間（分）
  cookTime: number; // 調理時間（分）
  servings: number; // 人数
  difficulty: '初心者' | '中級者' | '上級者';
  ingredients: Ingredient[];
  instructions: Instruction[];
  tags: string[];
  author: Author;
  createdAt: string;
  updatedAt: string;
  
  // エンゲージメント関連
  viewCount: number;
  likeCount: number;
  isLiked?: boolean; // 現在のユーザーがいいねしているかどうか
  rating: number; // 平均評価（1-5）
  reviewCount: number;
  
  // 公開設定
  isPublic: boolean;
  isPublished: boolean;
}

export interface CreateRecipeDto {
  title: string;
  description: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: '初心者' | '中級者' | '上級者';
  ingredients: Ingredient[];
  instructions: Instruction[];
  tags: string[];
  isPublic?: boolean;
  isPublished?: boolean;
  
  // ファイルアップロード用（FormData として送信）
  image?: File;
  video?: File;
}

export interface UpdateRecipeDto extends Partial<CreateRecipeDto> {
  id: string;
}

export interface RecipeListResponse {
  recipes: Recipe[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface RecipeSearchParams {
  query?: string;
  tags?: string[];
  difficulty?: string[];
  cookTimeMin?: number;
  cookTimeMax?: number;
  prepTimeMin?: number;
  prepTimeMax?: number;
  servings?: number;
  ingredients?: string[];
  authorId?: string;
  sortBy?: 'newest' | 'oldest' | 'popular' | 'rating' | 'cookTime' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface RecipeStats {
  totalRecipes: number;
  totalViews: number;
  totalLikes: number;
  averageRating: number;
}

// レビュー関連
export interface Review {
  id: string;
  recipeId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  rating: number; // 1-5
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewDto {
  recipeId: string;
  rating: number;
  comment: string;
}

// 食材・カテゴリー関連
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  recipeCount: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  recipeCount: number;
}

export interface IngredientSuggestion {
  name: string;
  category: string;
  commonUnits: string[];
}

// ユーザーのレシピ管理関連
export interface UserRecipeCollection {
  id: string;
  name: string;
  description?: string;
  recipeIds: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionDto {
  name: string;
  description?: string;
  isPublic?: boolean;
}

// 栄養情報（オプション機能）
export interface NutritionInfo {
  calories: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  fiber: number; // g
  sugar: number; // g
  sodium: number; // mg
}

// 拡張レシピ型（栄養情報付き）
export interface RecipeWithNutrition extends Recipe {
  nutrition?: NutritionInfo;
}

// API レスポンス型
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: any;
}

// フォーム用の型
export interface RecipeFormData {
  title: string;
  description: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: '初心者' | '中級者' | '上級者';
  ingredients: Ingredient[];
  instructions: Instruction[];
  tags: string[];
  isPublic: boolean;
  isPublished: boolean;
}

// Validation schemas用の型
export interface RecipeValidationErrors {
  title?: string;
  description?: string;
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  difficulty?: string;
  ingredients?: string;
  instructions?: string;
  tags?: string;
  image?: string;
  video?: string;
}

// Hook用の型
export interface UseRecipeReturn {
  recipe: Recipe | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  update: (data: UpdateRecipeDto) => Promise<void>;
  delete: () => Promise<void>;
  like: () => Promise<void>;
  unlike: () => Promise<void>;
}

export interface UseRecipeListReturn {
  recipes: Recipe[];
  total: number;
  isLoading: boolean;
  error: string | null;
  hasNext: boolean;
  hasPrevious: boolean;
  page: number;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  search: (params: RecipeSearchParams) => Promise<void>;
}

// Constants
export const DIFFICULTY_LEVELS = ['初心者', '中級者', '上級者'] as const;
export const SORT_OPTIONS = [
  { value: 'newest', label: '新しい順' },
  { value: 'oldest', label: '古い順' },
  { value: 'popular', label: '人気順' },
  { value: 'rating', label: '評価順' },
  { value: 'cookTime', label: '調理時間順' },
  { value: 'title', label: '名前順' },
] as const;

export const COMMON_UNITS = [
  'g', 'kg', 'ml', 'L', 'cc',
  '個', '本', '枚', '切れ', '片',
  '大さじ', '小さじ', 'カップ',
  '少々', '適量', 'お好みで'
] as const;

export const POPULAR_TAGS = [
  '和食', '洋食', '中華', 'イタリアン', 'フレンチ',
  '簡単', '時短', 'ヘルシー', '低カロリー',
  '主菜', '副菜', 'スープ', 'デザート', 'おつまみ',
  '朝食', '昼食', '夕食', 'おやつ',
  '肉料理', '魚料理', '野菜料理', 'パスタ', 'ご飯もの',
  'お弁当', '作り置き', '冷凍保存可'
] as const;