import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Channel } from '@/types';
import { channelApi } from '@/utils/api';

export const useChannels = () => {
  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['channels'],
    queryFn: channelApi.getChannels,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
    queryFn: () => channelApi.getChannel(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    channel: data?.data,
    error,
    isLoading,
  };
};

export const useChannelActions = () => {
  const queryClient = useQueryClient();

  const updateChannelMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Channel> }) =>
      channelApi.updateChannel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['systemStatus'] });
    },
  });

  const toggleChannelMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      channelApi.toggleChannel(id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['systemStatus'] });
    },
  });

  const syncChannelMutation = useMutation({
    mutationFn: (id: string) => channelApi.syncChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  return {
    updateChannel: updateChannelMutation.mutate,
    isUpdating: updateChannelMutation.isPending,
    toggleChannel: toggleChannelMutation.mutate,
    isToggling: toggleChannelMutation.isPending,
    syncChannel: syncChannelMutation.mutate,
    isSyncing: syncChannelMutation.isPending,
  };
};

// Alias for backward compatibility
export const useChannelApi = useChannels;