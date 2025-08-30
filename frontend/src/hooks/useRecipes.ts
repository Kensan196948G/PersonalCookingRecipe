import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Recipe,
  RecipeCreateInput,
  RecipeUpdateInput,
  RecipeFilters,
  PaginatedResponse,
} from '@/types/api';
import { apiService } from '@/services/api';

// レシピ一覧取得フック
export function useRecipes(filters?: RecipeFilters) {
  return useQuery(
    ['recipes', filters],
    () => apiService.getRecipes(filters),
    {
      staleTime: 5 * 60 * 1000, // 5分間キャッシュ
      cacheTime: 10 * 60 * 1000, // 10分間メモリ保持
    }
  );
}

// 特定レシピ取得フック
export function useRecipe(id: number) {
  return useQuery(
    ['recipe', id],
    () => apiService.getRecipe(id),
    {
      enabled: !!id,
      staleTime: 5 * 60 * 1000,
    }
  );
}

// レシピ作成フック
export function useCreateRecipe() {
  const queryClient = useQueryClient();

  return useMutation(
    (recipeData: RecipeCreateInput) => apiService.createRecipe(recipeData),
    {
      onSuccess: () => {
        // レシピ一覧のキャッシュを無効化
        queryClient.invalidateQueries(['recipes']);
      },
    }
  );
}

// レシピ更新フック
export function useUpdateRecipe() {
  const queryClient = useQueryClient();

  return useMutation(
    ({ id, data }: { id: number; data: RecipeUpdateInput }) =>
      apiService.updateRecipe(id, data),
    {
      onSuccess: (updatedRecipe) => {
        // 特定レシピのキャッシュを更新
        queryClient.setQueryData(['recipe', updatedRecipe.id], updatedRecipe);
        // レシピ一覧のキャッシュを無効化
        queryClient.invalidateQueries(['recipes']);
      },
    }
  );
}

// レシピ削除フック
export function useDeleteRecipe() {
  const queryClient = useQueryClient();

  return useMutation(
    (id: number) => apiService.deleteRecipe(id),
    {
      onSuccess: (_, deletedId) => {
        // 削除されたレシピのキャッシュを削除
        queryClient.removeQueries(['recipe', deletedId]);
        // レシピ一覧のキャッシュを無効化
        queryClient.invalidateQueries(['recipes']);
      },
    }
  );
}

// ユーザーのレシピ取得フック
export function useUserRecipes(userId: number) {
  return useQuery(
    ['userRecipes', userId],
    () => apiService.getUserRecipes(userId),
    {
      enabled: !!userId,
      staleTime: 5 * 60 * 1000,
    }
  );
}

// 外部統合データ取得フック
export function useExternalIntegrations(recipeId: number) {
  return useQuery(
    ['externalIntegrations', recipeId],
    () => apiService.getExternalIntegrations(recipeId),
    {
      enabled: !!recipeId,
      staleTime: 10 * 60 * 1000, // 外部APIは10分キャッシュ
    }
  );
}

// 画像アップロードフック
export function useImageUpload() {
  return useMutation(
    (file: File) => apiService.uploadImage(file),
    {
      onError: (error) => {
        console.error('Image upload failed:', error);
      },
    }
  );
}

// レシピフィルタリングフック
export function useRecipeFilters() {
  const [filters, setFilters] = useState<RecipeFilters>({});

  const updateFilter = <K extends keyof RecipeFilters>(
    key: K,
    value: RecipeFilters[K]
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const clearFilter = <K extends keyof RecipeFilters>(key: K) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  };

  return {
    filters,
    updateFilter,
    clearFilters,
    clearFilter,
    setFilters,
  };
}

// レシピ検索フック
export function useRecipeSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchResults = useQuery(
    ['recipeSearch', debouncedQuery],
    () => apiService.getRecipes({ search: debouncedQuery }),
    {
      enabled: debouncedQuery.length > 2,
      staleTime: 2 * 60 * 1000, // 検索結果は2分キャッシュ
    }
  );

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching: searchResults.isLoading && debouncedQuery.length > 2,
  };
}