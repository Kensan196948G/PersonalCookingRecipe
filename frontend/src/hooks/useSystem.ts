import { useQuery, useMutation, useQueryClient } from 'react-query';
import React, { useState, useEffect } from 'react';
import { SystemStatus, Channel } from '@/types/recipe';
import { api } from '@/services/api';

export const useSystemStatus = () => {
  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => api.getSystemStatus(),
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    staleTime: 15 * 1000, // Consider stale after 15 seconds
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    status: data?.data,
    error,
    isLoading,
    refetch,
  };
};

export const useChannels = () => {
  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.getChannels(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });

  return {
    channels: data?.data || [],
    error,
    isLoading,
    refetch,
  };
};

export const useChannel = (id: string) => {
  const {
    data,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['channel', id],
    queryFn: () => api.getChannel(id),
    enabled: !!id,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });

  return {
    channel: data?.data,
    error,
    isLoading,
  };
};

export const useUpdateChannel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, channel }: { id: string; channel: Partial<Channel> }) =>
      api.updateChannel(id, channel),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries(['channel', id]);
      queryClient.invalidateQueries(['channels']);
      queryClient.invalidateQueries(['system-status']);
    },
  });
};

export const useToggleChannel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateChannel(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries(['channels']);
      queryClient.invalidateQueries(['system-status']);
    },
  });
};

export const useRefreshChannel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channelId: string) => api.refreshChannel(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries(['channels']);
      queryClient.invalidateQueries(['system-status']);
      queryClient.invalidateQueries(['recipes']);
    },
  });
};

export const useSystemLogs = (limit = 100) => {
  return useQuery({
    queryKey: ['system-logs', limit],
    queryFn: () => api.getSystemLogs(limit),
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute
  });
};

export const useSystemMetrics = () => {
  return useQuery({
    queryKey: ['system-metrics'],
    queryFn: () => api.getSystemMetrics(),
    staleTime: 60 * 1000, // 1 minute
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });
};

export const useHealthCheck = () => {
  return useQuery({
    queryKey: ['health-check'],
    queryFn: () => api.healthCheck(),
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    retry: false, // Don't retry health checks
  });
};

export const useRestartSystem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.restartSystem(),
    onSuccess: () => {
      // Invalidate all queries after restart
      queryClient.invalidateQueries();
    },
  });
};

export const useClearErrors = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (errorIds?: string[]) => api.clearErrors(errorIds),
    onSuccess: () => {
      queryClient.invalidateQueries(['system-status']);
    },
  });
};

// Hook for managing notifications
export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      return permission;
    }
    return 'denied' as NotificationPermission;
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if (permission === 'granted') {
      return new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });
    }
    return null;
  };

  const showErrorNotification = (message: string) => {
    return showNotification('システムエラー', {
      body: message,
      tag: 'system-error',
    });
  };

  const showSuccessNotification = (message: string) => {
    return showNotification('成功', {
      body: message,
      tag: 'success',
    });
  };

  return {
    permission,
    requestPermission,
    showNotification,
    showErrorNotification,
    showSuccessNotification,
    isSupported: 'Notification' in window,
  };
};