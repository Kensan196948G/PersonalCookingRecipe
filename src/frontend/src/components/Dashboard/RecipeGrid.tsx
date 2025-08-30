import React from 'react';
import {
  Box,
  Grid,
  Typography,
  Button,
  Alert,
  Pagination,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Recipe } from '@/types';
import { RecipeCard } from './RecipeCard';
import { RecipeListSkeleton } from '../Common/Loading';

interface RecipeGridProps {
  recipes: Recipe[];
  loading?: boolean;
  error?: Error | null;
  onRecipeClick?: (recipe: Recipe) => void;
  onRetry?: () => void;
  showChannel?: boolean;
  variant?: 'default' | 'compact';
  pagination?: {
    page: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };
}

export const RecipeGrid: React.FC<RecipeGridProps> = ({
  recipes,
  loading = false,
  error,
  onRecipeClick,
  onRetry,
  showChannel = true,
  variant = 'default',
  pagination,
}) => {
  if (loading && recipes.length === 0) {
    return <RecipeListSkeleton count={12} />;
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          onRetry && (
            <Button
              color="inherit"
              size="small"
              onClick={onRetry}
              startIcon={<RefreshIcon />}
            >
              Retry
            </Button>
          )
        }
        sx={{ m: 2 }}
      >
        <Typography variant="subtitle2">Failed to load recipes</Typography>
        {error.message}
      </Alert>
    );
  }

  if (recipes.length === 0) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        sx={{ py: 8, textAlign: 'center' }}
      >
        <Typography variant="h5" color="text.secondary" gutterBottom>
          No recipes found
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Try adjusting your search or filters to find more recipes.
        </Typography>
        {onRetry && (
          <Button
            variant="outlined"
            onClick={onRetry}
            startIcon={<RefreshIcon />}
          >
            Refresh
          </Button>
        )}
      </Box>
    );
  }

  const columns = variant === 'compact' ? {
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 5,
  } : {
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4,
  };

  return (
    <Box>
      <Grid container spacing={3}>
        {recipes.map((recipe) => (
          <Grid item key={recipe.id} {...columns}>
            <RecipeCard
              recipe={recipe}
              onClick={onRecipeClick}
              showChannel={showChannel}
              variant={variant}
            />
          </Grid>
        ))}
      </Grid>

      {/* Pagination */}
      {pagination && pagination.total > pagination.pageSize && (
        <Box display="flex" justifyContent="center" sx={{ mt: 4 }}>
          <Pagination
            count={Math.ceil(pagination.total / pagination.pageSize)}
            page={pagination.page}
            onChange={(_, page) => pagination.onPageChange(page)}
            color="primary"
            size="large"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* Loading overlay for pagination */}
      {loading && recipes.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <RecipeListSkeleton count={4} />
        </Box>
      )}
    </Box>
  );
};