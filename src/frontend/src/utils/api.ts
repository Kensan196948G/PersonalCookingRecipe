import axios, { AxiosResponse } from 'axios';
import { Recipe, SearchFilters, Channel, SystemStatus, Statistics, ApiConfig, MonitoringConfig, ApiResponse, PaginatedResponse } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for authentication
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
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

export const recipeApi = {
  getRecipes: (filters?: SearchFilters): Promise<ApiResponse<Recipe[]>> =>
    apiClient.get('/recipes', { params: filters }),

  getRecipesPaginated: (params?: SearchFilters & { page?: number; pageSize?: number }): Promise<ApiResponse<PaginatedResponse<Recipe>>> =>
    apiClient.get('/recipes/paginated', { params }),

  getRecipe: (id: string): Promise<ApiResponse<Recipe>> =>
    apiClient.get(`/recipes/${id}`),

  searchRecipes: (query: string): Promise<ApiResponse<Recipe[]>> =>
    apiClient.get('/recipes/search', { params: { q: query } }),

  getFavorites: (): Promise<ApiResponse<Recipe[]>> =>
    apiClient.get('/recipes/favorites'),

  addToFavorites: (recipeId: string): Promise<ApiResponse<void>> =>
    apiClient.post(`/recipes/${recipeId}/favorite`),

  removeFromFavorites: (recipeId: string): Promise<ApiResponse<void>> =>
    apiClient.delete(`/recipes/${recipeId}/favorite`),
};

export const channelApi = {
  getChannels: (): Promise<ApiResponse<Channel[]>> =>
    apiClient.get('/channels'),

  getChannel: (id: string): Promise<ApiResponse<Channel>> =>
    apiClient.get(`/channels/${id}`),

  updateChannel: (id: string, data: Partial<Channel>): Promise<ApiResponse<Channel>> =>
    apiClient.put(`/channels/${id}`, data),

  toggleChannel: (id: string, active: boolean): Promise<ApiResponse<void>> =>
    apiClient.patch(`/channels/${id}/toggle`, { active }),

  syncChannel: (id: string): Promise<ApiResponse<void>> =>
    apiClient.post(`/channels/${id}/sync`),
};

export const systemApi = {
  getStatus: (): Promise<ApiResponse<SystemStatus>> =>
    apiClient.get('/system/status'),

  getStatistics: (timeRange?: string): Promise<ApiResponse<Statistics>> =>
    apiClient.get('/system/statistics', { params: { timeRange } }),

  getLogs: (limit?: number): Promise<ApiResponse<any[]>> =>
    apiClient.get('/system/logs', { params: { limit } }),

  getApiConfig: (): Promise<ApiResponse<ApiConfig>> =>
    apiClient.get('/system/config/api'),

  updateApiConfig: (config: Partial<ApiConfig>): Promise<ApiResponse<ApiConfig>> =>
    apiClient.put('/system/config/api', config),

  getMonitoringConfig: (): Promise<ApiResponse<MonitoringConfig>> =>
    apiClient.get('/system/config/monitoring'),

  updateMonitoringConfig: (config: Partial<MonitoringConfig>): Promise<ApiResponse<MonitoringConfig>> =>
    apiClient.put('/system/config/monitoring', config),

  testConnection: (service: string): Promise<ApiResponse<{ connected: boolean; message?: string }>> =>
    apiClient.post(`/system/test/${service}`),

  restartService: (service: string): Promise<ApiResponse<void>> =>
    apiClient.post(`/system/restart/${service}`),

  clearErrors: (): Promise<ApiResponse<void>> =>
    apiClient.post('/system/errors/clear'),

  syncChannels: (): Promise<ApiResponse<void>> =>
    apiClient.post('/system/sync'),

  exportData: (format: 'json' | 'csv'): Promise<AxiosResponse<Blob>> =>
    apiClient.get(`/system/export/${format}`, { responseType: 'blob' }),

  importData: (file: File): Promise<ApiResponse<{ imported: number; errors: number }>> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/system/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};