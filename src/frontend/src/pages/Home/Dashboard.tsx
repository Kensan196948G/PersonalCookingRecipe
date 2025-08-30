import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tab,
  Tabs,
  Grid,
  Card,
  CardContent,
  IconButton,
  Badge,
  Fab,
  Tooltip,
} from '@mui/material';
import {
  Restaurant as RecipeIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  TrendingUp as TrendingIcon,
  AccessTime as RecentIcon,
  Favorite as FavoriteIcon,
  PlaylistPlay as PlaylistIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '@/components/Dashboard/SearchBar';
import { RecipeGrid } from '@/components/Dashboard/RecipeGrid';
import { useRecipeSearch, useFavoriteRecipes } from '@/hooks/useRecipes';
import { useSystemStatus } from '@/hooks/useSystem';
import { Recipe, SearchFilters } from '@/types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`recipe-tabpanel-${index}`}
      aria-labelledby={`recipe-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  
  const {
    recipes,
    filters,
    isLoading,
    error,
    updateFilters,
    resetFilters,
  } = useRecipeSearch();
  
  const { favorites } = useFavoriteRecipes();
  const { status, refetch: refreshStatus } = useSystemStatus();

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    
    // Reset filters and apply tab-specific filters
    resetFilters();
    
    switch (newValue) {
      case 1: // Trending
        updateFilters({
          query: '',
          tags: ['popular'],
        });
        break;
      case 2: // Recent
        updateFilters({
          query: '',
          publishedAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        break;
      case 3: // Favorites
        // Favorites will be handled separately
        break;
      default: // All Recipes
        break;
    }
  };

  const handleRecipeClick = (recipe: Recipe) => {
    navigate(`/recipe/${recipe.id}`);
  };

  const handleFiltersChange = (newFilters: SearchFilters) => {
    updateFilters(newFilters);
  };

  const handleRefresh = () => {
    refreshStatus();
    // Force refetch of recipes
    window.location.reload();
  };

  const favoriteRecipes = recipes.filter(recipe => favorites.includes(recipe.id));

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h3" component="h1" gutterBottom>
            Recipe Monitor
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            3チャンネル統合レシピ監視システム
          </Typography>
        </Box>
        
        <Box display="flex" alignItems="center" gap={2}>
          {/* System Status Indicator */}
          <Tooltip 
            title={status?.isOnline ? 'System Online' : 'System Offline'}
          >
            <Badge
              color={status?.isOnline ? 'success' : 'error'}
              variant="dot"
            >
              <IconButton onClick={handleRefresh}>
                <RefreshIcon />
              </IconButton>
            </Badge>
          </Tooltip>
        </Box>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={2} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <RecipeIcon color="primary" />
                <Box>
                  <Typography variant="h6">
                    {status?.totalRecipes || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total Recipes
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <TrendingIcon color="success" />
                <Box>
                  <Typography variant="h6">
                    {status?.activeChannels || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Active Channels
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <FavoriteIcon color="error" />
                <Box>
                  <Typography variant="h6">
                    {favorites.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Favorites
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <PlaylistIcon color="info" />
                <Box>
                  <Typography variant="h6">
                    {status?.pendingTasks || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Pending Tasks
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search Bar */}
      <SearchBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* Recipe Tabs and Content */}
      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab 
            icon={<RecipeIcon />} 
            label="All Recipes" 
            iconPosition="start"
          />
          <Tab 
            icon={<TrendingIcon />} 
            label="Trending" 
            iconPosition="start"
          />
          <Tab 
            icon={<RecentIcon />} 
            label="Recent" 
            iconPosition="start"
          />
          <Tab 
            icon={<FavoriteIcon />} 
            label={`Favorites (${favorites.length})`}
            iconPosition="start"
          />
        </Tabs>

        <Box sx={{ p: 3 }}>
          <TabPanel value={activeTab} index={0}>
            <RecipeGrid
              recipes={recipes}
              loading={isLoading}
              error={error}
              onRecipeClick={handleRecipeClick}
              onRetry={handleRefresh}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <RecipeGrid
              recipes={recipes}
              loading={isLoading}
              error={error}
              onRecipeClick={handleRecipeClick}
              onRetry={handleRefresh}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <RecipeGrid
              recipes={recipes}
              loading={isLoading}
              error={error}
              onRecipeClick={handleRecipeClick}
              onRetry={handleRefresh}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={3}>
            <RecipeGrid
              recipes={favoriteRecipes}
              loading={false}
              error={null}
              onRecipeClick={handleRecipeClick}
              showChannel={true}
            />
          </TabPanel>
        </Box>
      </Paper>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add recipe"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
        }}
        onClick={() => navigate('/recipe/add')}
      >
        <AddIcon />
      </Fab>
    </Container>
  );
};