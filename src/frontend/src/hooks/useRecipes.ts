import { useState, useEffect } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Recipe, SearchFilters, PaginatedResponse } from '@/types/recipe';
import { recipeApi } from '@/utils/api';

export const useRecipes = (filters?: SearchFilters) => {
  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['recipes', filters],
    queryFn: () => recipeApi.getRecipes(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
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
      recipeApi.getRecipesPaginated({ ...filters, page: pageParam }),
    getNextPageParam: (lastPage) => 
      lastPage.data?.hasNext ? lastPage.data.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
  });

  const recipes = data?.pages.flatMap(page => page.data?.items || []) || [];

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
    queryFn: () => recipeApi.getRecipe(id),
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

  const { recipes, isLoading, error } = useRecipes(filters);

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
  };
};

export const useFavoriteRecipes = () => {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('favoriteRecipes');
    if (saved) {
      setFavorites(JSON.parse(saved));
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

  return {
    favorites,
    toggleFavorite,
    isFavorite,
  };
};