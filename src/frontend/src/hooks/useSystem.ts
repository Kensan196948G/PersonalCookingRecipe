import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SystemStatus, Statistics, ApiConfig, MonitoringConfig } from '@/types';
import { systemApi } from '@/utils/api';

export const useSystemStatus = () => {
  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['systemStatus'],
    queryFn: systemApi.getStatus,
    refetchInterval: 30 * 1000, // 30 seconds
    staleTime: 10 * 1000, // 10 seconds
  });

  return {
    status: data?.data,
    error,
    isLoading,
    refetch,
  };
};

export const useStatistics = (timeRange?: string) => {
  const {
    data,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['statistics', timeRange],
    queryFn: () => systemApi.getStatistics(timeRange),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return {
    stats: data?.data,
    error,
    isLoading,
  };
};

export const useApiConfig = () => {
  const queryClient = useQueryClient();

  const {
    data,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['apiConfig'],
    queryFn: systemApi.getApiConfig,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const updateConfigMutation = useMutation({
    mutationFn: (config: Partial<ApiConfig>) => 
      systemApi.updateApiConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiConfig'] });
      queryClient.invalidateQueries({ queryKey: ['systemStatus'] });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: (service: 'youtube' | 'notion' | 'tasty') => 
      systemApi.testConnection(service),
  });

  return {
    config: data?.data,
    error,
    isLoading,
    updateConfig: updateConfigMutation.mutate,
    isUpdating: updateConfigMutation.isPending,
    updateError: updateConfigMutation.error,
    testConnection: testConnectionMutation.mutate,
    isTesting: testConnectionMutation.isPending,
    testResult: testConnectionMutation.data,
  };
};

export const useMonitoringConfig = () => {
  const queryClient = useQueryClient();

  const {
    data,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['monitoringConfig'],
    queryFn: systemApi.getMonitoringConfig,
    staleTime: 10 * 60 * 1000,
  });

  const updateConfigMutation = useMutation({
    mutationFn: (config: Partial<MonitoringConfig>) => 
      systemApi.updateMonitoringConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoringConfig'] });
    },
  });

  return {
    config: data?.data,
    error,
    isLoading,
    updateConfig: updateConfigMutation.mutate,
    isUpdating: updateConfigMutation.isPending,
  };
};

export const useSystemLogs = (limit = 100) => {
  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['systemLogs', limit],
    queryFn: () => systemApi.getLogs(limit),
    refetchInterval: 60 * 1000, // 1 minute
    staleTime: 30 * 1000, // 30 seconds
  });

  return {
    logs: data?.data || [],
    error,
    isLoading,
    refetch,
  };
};

export const useSystemActions = () => {
  const queryClient = useQueryClient();

  const restartServiceMutation = useMutation({
    mutationFn: (service: string) => systemApi.restartService(service),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemStatus'] });
    },
  });

  const clearErrorsMutation = useMutation({
    mutationFn: systemApi.clearErrors,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemStatus'] });
    },
  });

  const syncChannelsMutation = useMutation({
    mutationFn: systemApi.syncChannels,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemStatus'] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  return {
    restartService: restartServiceMutation.mutate,
    isRestarting: restartServiceMutation.isPending,
    clearErrors: clearErrorsMutation.mutate,
    isClearing: clearErrorsMutation.isPending,
    syncChannels: syncChannelsMutation.mutate,
    isSyncing: syncChannelsMutation.isPending,
  };
};