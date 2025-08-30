import React from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Skeleton,
} from '@mui/material';

interface LoadingProps {
  type?: 'circular' | 'skeleton';
  message?: string;
  size?: number;
  rows?: number;
  height?: number;
}

export const Loading: React.FC<LoadingProps> = ({
  type = 'circular',
  message = 'Loading...',
  size = 40,
  rows = 3,
  height = 200,
}) => {
  if (type === 'skeleton') {
    return (
      <Box sx={{ width: '100%', p: 2 }}>
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            height={height / rows}
            sx={{ mb: 1, borderRadius: 1 }}
          />
        ))}
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      sx={{ py: 4 }}
    >
      <CircularProgress size={size} sx={{ mb: 2 }} />
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );
};

export const RecipeCardSkeleton: React.FC = () => (
  <Box sx={{ p: 2 }}>
    <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, mb: 2 }} />
    <Skeleton variant="text" height={28} sx={{ mb: 1 }} />
    <Skeleton variant="text" height={20} width="80%" sx={{ mb: 1 }} />
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Skeleton variant="text" height={20} width="60%" />
      <Skeleton variant="circular" width={24} height={24} />
    </Box>
  </Box>
);

export const RecipeListSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <Box
    display="grid"
    gridTemplateColumns={{
      xs: '1fr',
      sm: 'repeat(2, 1fr)',
      md: 'repeat(3, 1fr)',
      lg: 'repeat(4, 1fr)',
    }}
    gap={2}
    sx={{ p: 2 }}
  >
    {Array.from({ length: count }).map((_, index) => (
      <RecipeCardSkeleton key={index} />
    ))}
  </Box>
);