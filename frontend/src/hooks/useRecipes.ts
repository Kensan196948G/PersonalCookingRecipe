import { useState, useEffect } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from 'react-query';
import { Recipe, SearchFilters, PaginatedResponse, ApiResponse } from '@/types/recipe';
import { api } from '@/services/api';

export const useRecipes = (filters?: SearchFilters) => {
  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['recipes', filters],
    queryFn: () => api.getRecipes(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    keepPreviousData: true,
  });

  return {
    recipes: data?.data || [],
    error,
    isLoading,
    refetch,
  };
};

export const useInfiniteRecipes = (filters?: SearchFilters) => {
  const {
    data,
    error,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['infiniteRecipes', filters],
    queryFn: ({ pageParam = 1 }) => 
      api.getRecipesPaginated({ ...filters, page: pageParam }),
    getNextPageParam: (lastPage: ApiResponse<PaginatedResponse<Recipe>>) => 
      lastPage.data?.pagination?.hasNext ? lastPage.data.pagination.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    keepPreviousData: true,
  });

  const recipes = data?.pages.flatMap(page => page.data?.data || []) || [];

  return {
    recipes,
    error,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  };
};

export const useRecipe = (id: string) => {
  const {
    data,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => api.getRecipe(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    recipe: data?.data,
    error,
    isLoading,
  };
};

export const useRecipeSearch = () => {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    tags: [],
  });

  const { recipes, isLoading, error, refetch } = useRecipes(filters);

  const updateFilters = (newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters({
      query: '',
      tags: [],
    });
  };

  return {
    recipes,
    filters,
    isLoading,
    error,
    updateFilters,
    resetFilters,
    refetch,
  };
};

export const useFavoriteRecipes = () => {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('favoriteRecipes');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to parse favorite recipes:', error);
        setFavorites([]);
      }
    }
  }, []);

  const toggleFavorite = (recipeId: string) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(recipeId)
        ? prev.filter(id => id !== recipeId)
        : [...prev, recipeId];
      
      localStorage.setItem('favoriteRecipes', JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  const isFavorite = (recipeId: string) => favorites.includes(recipeId);

  const addFavorite = (recipeId: string) => {
    if (!favorites.includes(recipeId)) {
      const newFavorites = [...favorites, recipeId];
      setFavorites(newFavorites);
      localStorage.setItem('favoriteRecipes', JSON.stringify(newFavorites));
    }
  };

  const removeFavorite = (recipeId: string) => {
    const newFavorites = favorites.filter(id => id !== recipeId);
    setFavorites(newFavorites);
    localStorage.setItem('favoriteRecipes', JSON.stringify(newFavorites));
  };

  const clearFavorites = () => {
    setFavorites([]);
    localStorage.removeItem('favoriteRecipes');
  };

  return {
    favorites,
    toggleFavorite,
    isFavorite,
    addFavorite,
    removeFavorite,
    clearFavorites,
  };
};

export const useCreateRecipe = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.createRecipe(recipe),
    onSuccess: () => {
      queryClient.invalidateQueries(['recipes']);
    },
  });
};

export const useUpdateRecipe = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, recipe }: { id: string; recipe: Partial<Recipe> }) =>
      api.updateRecipe(id, recipe),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries(['recipe', id]);
      queryClient.invalidateQueries(['recipes']);
    },
  });
};

export const useDeleteRecipe = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteRecipe(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['recipes']);
    },
  });
};

export const useRecipeStats = () => {
  return useQuery({
    queryKey: ['recipe-stats'],
    queryFn: () => api.getRecipeStats(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const usePopularRecipes = (limit = 10) => {
  return useQuery({
    queryKey: ['popular-recipes', limit],
    queryFn: () => api.getPopularRecipes(limit),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

export const useRecentRecipes = (limit = 10) => {
  return useQuery({
    queryKey: ['recent-recipes', limit],
    queryFn: () => api.getRecentRecipes(limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};