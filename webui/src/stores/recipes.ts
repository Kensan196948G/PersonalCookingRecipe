/**
 * レシピ状態管理ストア
 * 検索、フィルタリング、詳細表示を管理
 * 
 * Author: Recipe-DevUI Agent
 * Date: 2025-08-08
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Recipe, RecipeFilters } from '@/types/api';

interface RecipesState {
  // データ状態
  recipes: Recipe[];
  selectedRecipe: Recipe | null;
  
  // フィルタ・検索状態
  filters: RecipeFilters;
  searchQuery: string;
  
  // UI状態
  isLoading: boolean;
  error: string | null;
  
  // ページネーション
  currentPage: number;
  totalCount: number;
  hasNextPage: boolean;
  
  // 表示設定（永続化）
  viewMode: 'grid' | 'list';
  itemsPerPage: number;
  sortBy: 'date' | 'quality' | 'channel';
  sortOrder: 'asc' | 'desc';
  
  // アクション
  setRecipes: (recipes: Recipe[]) => void;
  setSelectedRecipe: (recipe: Recipe | null) => void;
  updateFilters: (filters: Partial<RecipeFilters>) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPage: (page: number) => void;
  setPagination: (total: number, hasNext: boolean) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setItemsPerPage: (count: number) => void;
  setSorting: (sortBy: string, order: 'asc' | 'desc') => void;
  clearFilters: () => void;
  reset: () => void;
}

const initialState = {
  recipes: [],
  selectedRecipe: null,
  filters: {},
  searchQuery: '',
  isLoading: false,
  error: null,
  currentPage: 1,
  totalCount: 0,
  hasNextPage: false,
  viewMode: 'grid' as const,
  itemsPerPage: 20,
  sortBy: 'date' as const,
  sortOrder: 'desc' as const,
};

export const useRecipesStore = create<RecipesState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        
        setRecipes: (recipes) => set(
          { recipes, error: null }, 
          false, 
          'setRecipes'
        ),
        
        setSelectedRecipe: (selectedRecipe) => set(
          { selectedRecipe }, 
          false, 
          'setSelectedRecipe'
        ),
        
        updateFilters: (newFilters) => set(
          (state) => ({ 
            filters: { ...state.filters, ...newFilters },
            currentPage: 1, // フィルタ変更時はページをリセット
          }), 
          false, 
          'updateFilters'
        ),
        
        setSearchQuery: (searchQuery) => set(
          { searchQuery, currentPage: 1 }, 
          false, 
          'setSearchQuery'
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
        
        setPage: (currentPage) => set(
          { currentPage }, 
          false, 
          'setPage'
        ),
        
        setPagination: (totalCount, hasNextPage) => set(
          { totalCount, hasNextPage }, 
          false, 
          'setPagination'
        ),
        
        setViewMode: (viewMode) => set(
          { viewMode }, 
          false, 
          'setViewMode'
        ),
        
        setItemsPerPage: (itemsPerPage) => set(
          { itemsPerPage, currentPage: 1 }, 
          false, 
          'setItemsPerPage'
        ),
        
        setSorting: (sortBy, sortOrder) => set(
          { 
            sortBy: sortBy as 'date' | 'quality' | 'channel', 
            sortOrder 
          }, 
          false, 
          'setSorting'
        ),
        
        clearFilters: () => set(
          { 
            filters: {}, 
            searchQuery: '', 
            currentPage: 1 
          }, 
          false, 
          'clearFilters'
        ),
        
        reset: () => set(
          { ...initialState, viewMode: get().viewMode, itemsPerPage: get().itemsPerPage }, 
          false, 
          'reset'
        ),
      }),
      {
        name: 'recipes-store',
        // 永続化するキー（UI設定のみ）
        partialize: (state) => ({
          viewMode: state.viewMode,
          itemsPerPage: state.itemsPerPage,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
        }),
      }
    ),
    {
      name: 'recipes-store',
    }
  )
);

// セレクター（計算プロパティ）
export const useRecipesSelectors = () => {
  const store = useRecipesStore();
  
  return {
    // 現在のフィルタ適用状況
    hasActiveFilters: Object.keys(store.filters).length > 0 || store.searchQuery.length > 0,
    
    // チャンネル別レシピ数
    recipesByChannel: store.recipes.reduce((acc, recipe) => {
      acc[recipe.channel] = (acc[recipe.channel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    
    // 品質統計
    qualityStats: {
      high: store.recipes.filter(r => r.quality_score > 0.8).length,
      medium: store.recipes.filter(r => r.quality_score > 0.6 && r.quality_score <= 0.8).length,
      low: store.recipes.filter(r => r.quality_score <= 0.6).length,
      average: store.recipes.length > 0 
        ? store.recipes.reduce((sum, r) => sum + r.quality_score, 0) / store.recipes.length 
        : 0,
    },
    
    // ページネーション情報
    paginationInfo: {
      current: store.currentPage,
      total: Math.ceil(store.totalCount / store.itemsPerPage),
      showing: store.recipes.length,
      totalCount: store.totalCount,
    },
    
    // 検索・フィルタ情報サマリー
    filterSummary: {
      query: store.searchQuery,
      channel: store.filters.channel,
      difficulty: store.filters.difficulty,
      minQuality: store.filters.min_quality_score,
    },
  };
};