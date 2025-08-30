export interface ApiConfig {
  youtube: {
    apiKey: string;
    maxResults: number;
    quotaLimit: number;
  };
  notion: {
    token: string;
    databaseId: string;
    pageSize: number;
  };
  tasty: {
    apiHost: string;
    apiKey: string;
    rateLimit: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface MonitoringConfig {
  checkInterval: number; // minutes
  enableNotifications: boolean;
  notificationChannels: {
    email: boolean;
    desktop: boolean;
    webhook?: string;
  };
  autoRetry: boolean;
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential';
}