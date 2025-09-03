import axios, { AxiosResponse } from 'axios';
import { Recipe, SearchFilters, PaginatedResponse, ApiResponse, SystemStatus, Channel } from '@/types/recipe';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Recipe API
export const api = {
  // Recipes
  getRecipes: (filters?: SearchFilters): Promise<ApiResponse<Recipe[]>> =>
    apiClient.get('/recipes', { params: filters }).then(res => res.data),
  
  getRecipesPaginated: (params?: SearchFilters & { page?: number }): Promise<ApiResponse<PaginatedResponse<Recipe>>> =>
    apiClient.get('/recipes/paginated', { params }).then(res => res.data),
  
  getRecipe: (id: string): Promise<ApiResponse<Recipe>> =>
    apiClient.get(`/recipes/${id}`).then(res => res.data),
  
  createRecipe: (recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Recipe>> =>
    apiClient.post('/recipes', recipe).then(res => res.data),
  
  updateRecipe: (id: string, recipe: Partial<Recipe>): Promise<ApiResponse<Recipe>> =>
    apiClient.put(`/recipes/${id}`, recipe).then(res => res.data),
  
  deleteRecipe: (id: string): Promise<ApiResponse<void>> =>
    apiClient.delete(`/recipes/${id}`).then(res => res.data),

  // Recipe stats
  getRecipeStats: (): Promise<ApiResponse<any>> =>
    apiClient.get('/recipes/stats').then(res => res.data),

  getPopularRecipes: (limit: number): Promise<ApiResponse<Recipe[]>> =>
    apiClient.get(`/recipes/popular?limit=${limit}`).then(res => res.data),

  getRecentRecipes: (limit: number): Promise<ApiResponse<Recipe[]>> =>
    apiClient.get(`/recipes/recent?limit=${limit}`).then(res => res.data),

  // System
  getSystemStatus: (): Promise<ApiResponse<SystemStatus>> =>
    apiClient.get('/system/status').then(res => res.data),

  getSystemLogs: (limit: number): Promise<ApiResponse<any[]>> =>
    apiClient.get(`/system/logs?limit=${limit}`).then(res => res.data),

  getSystemMetrics: (): Promise<ApiResponse<any>> =>
    apiClient.get('/system/metrics').then(res => res.data),

  healthCheck: (): Promise<ApiResponse<any>> =>
    apiClient.get('/system/health').then(res => res.data),

  restartSystem: (): Promise<ApiResponse<void>> =>
    apiClient.post('/system/restart').then(res => res.data),

  clearErrors: (errorIds?: string[]): Promise<ApiResponse<void>> =>
    apiClient.post('/system/clear-errors', { errorIds }).then(res => res.data),

  // Channels
  getChannels: (): Promise<ApiResponse<Channel[]>> =>
    apiClient.get('/channels').then(res => res.data),

  getChannel: (id: string): Promise<ApiResponse<Channel>> =>
    apiClient.get(`/channels/${id}`).then(res => res.data),

  updateChannel: (id: string, channel: Partial<Channel>): Promise<ApiResponse<Channel>> =>
    apiClient.put(`/channels/${id}`, channel).then(res => res.data),

  refreshChannel: (id: string): Promise<ApiResponse<void>> =>
    apiClient.post(`/channels/${id}/refresh`).then(res => res.data),

  // Search
  searchRecipes: (query: string, filters?: SearchFilters): Promise<ApiResponse<Recipe[]>> =>
    apiClient.get('/search', { params: { q: query, ...filters } }).then(res => res.data),

  // YouTube integration
  getYouTubeVideo: (videoId: string): Promise<ApiResponse<any>> =>
    apiClient.get(`/youtube/video/${videoId}`).then(res => res.data),

  // Notion integration
  getNotionPages: (): Promise<ApiResponse<any[]>> =>
    apiClient.get('/notion/pages').then(res => res.data),

  importFromNotion: (pageId: string): Promise<ApiResponse<Recipe>> =>
    apiClient.post(`/notion/import/${pageId}`).then(res => res.data),

  // Gmail integration
  sendRecipeEmail: (recipeId: string, email: string): Promise<ApiResponse<void>> =>
    apiClient.post('/gmail/send-recipe', { recipeId, email }).then(res => res.data),
};

export default api;