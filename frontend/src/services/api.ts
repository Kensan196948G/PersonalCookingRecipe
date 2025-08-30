import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  Recipe,
  RecipeCreateInput,
  RecipeUpdateInput,
  User,
  UserCreateInput,
  LoginInput,
  LoginResponse,
  ApiResponse,
  PaginatedResponse,
  RecipeFilters,
  ExternalIntegration,
} from '@/types/api';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // リクエストインターセプター（認証トークン追加）
    this.client.interceptors.request.use(
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

    // レスポンスインターセプター（エラーハンドリング）
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // トークン無効の場合、ログアウト処理
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // 認証関連
  async login(credentials: LoginInput): Promise<LoginResponse> {
    const response: AxiosResponse<ApiResponse<LoginResponse>> = await this.client.post(
      '/auth/login',
      credentials
    );
    
    // トークンをローカルストレージに保存
    localStorage.setItem('authToken', response.data.data.token);
    
    return response.data.data;
  }

  async register(userData: UserCreateInput): Promise<User> {
    const response: AxiosResponse<ApiResponse<User>> = await this.client.post(
      '/auth/register',
      userData
    );
    return response.data.data;
  }

  async getCurrentUser(): Promise<User> {
    const response: AxiosResponse<ApiResponse<User>> = await this.client.get('/auth/me');
    return response.data.data;
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
    localStorage.removeItem('authToken');
  }

  // レシピ関連
  async getRecipes(filters?: RecipeFilters): Promise<PaginatedResponse<Recipe>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach((item) => params.append(key, item.toString()));
          } else {
            params.append(key, value.toString());
          }
        }
      });
    }

    const response: AxiosResponse<PaginatedResponse<Recipe>> = await this.client.get(
      `/api/recipes?${params.toString()}`
    );
    return response.data;
  }

  async getRecipe(id: number): Promise<Recipe> {
    const response: AxiosResponse<ApiResponse<Recipe>> = await this.client.get(
      `/api/recipes/${id}`
    );
    return response.data.data;
  }

  async createRecipe(recipeData: RecipeCreateInput): Promise<Recipe> {
    const response: AxiosResponse<ApiResponse<Recipe>> = await this.client.post(
      '/api/recipes',
      recipeData
    );
    return response.data.data;
  }

  async updateRecipe(id: number, recipeData: RecipeUpdateInput): Promise<Recipe> {
    const response: AxiosResponse<ApiResponse<Recipe>> = await this.client.put(
      `/api/recipes/${id}`,
      recipeData
    );
    return response.data.data;
  }

  async deleteRecipe(id: number): Promise<void> {
    await this.client.delete(`/api/recipes/${id}`);
  }

  // ユーザーのレシピ取得
  async getUserRecipes(userId: number): Promise<Recipe[]> {
    const response: AxiosResponse<ApiResponse<Recipe[]>> = await this.client.get(
      `/api/users/${userId}/recipes`
    );
    return response.data.data;
  }

  // 外部サービス統合
  async getExternalIntegrations(recipeId: number): Promise<ExternalIntegration> {
    const response: AxiosResponse<ApiResponse<ExternalIntegration>> = await this.client.get(
      `/api/recipes/${recipeId}/external`
    );
    return response.data.data;
  }

  // YouTube検索
  async searchYouTube(query: string): Promise<any> {
    const response: AxiosResponse<ApiResponse<any>> = await this.client.get(
      `/api/youtube/search?q=${encodeURIComponent(query)}`
    );
    return response.data.data;
  }

  // Notion統合
  async getNotionPages(): Promise<any> {
    const response: AxiosResponse<ApiResponse<any>> = await this.client.get('/api/notion/pages');
    return response.data.data;
  }

  // Gmail統合
  async sendRecipeEmail(recipeId: number, to: string): Promise<void> {
    await this.client.post('/api/gmail/send-recipe', { recipeId, to });
  }

  // ファイルアップロード
  async uploadImage(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('image', file);

    const response: AxiosResponse<ApiResponse<{ url: string }>> = await this.client.post(
      '/api/upload/image',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    
    return response.data.data;
  }
}

export const apiService = new ApiService();
export default apiService;