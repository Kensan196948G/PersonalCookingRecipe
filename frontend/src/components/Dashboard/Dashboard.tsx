import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Recipe, SearchFilters } from '@/types/recipe';
import { SearchBar } from '@/components/Search/SearchBar';
import { RecipeGrid } from './RecipeGrid';
import { useRecipeSearch, useFavoriteRecipes } from '@/hooks/useRecipes';
import { useSystemStatus } from '@/hooks/useSystem';
import { 
  RefreshCw, 
  Plus, 
  TrendingUp, 
  Clock, 
  Heart, 
  Menu,
  ChefHat,
  Users,
  PlaySquare
} from 'lucide-react';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`recipe-tabpanel-${index}`}
      aria-labelledby={`recipe-tab-${index}`}
    >
      {value === index && <div>{children}</div>}
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const router = useRouter();
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

  const handleTabChange = (newValue: number) => {
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
    router.push(`/recipe/${recipe.id}`);
  };

  const handleFiltersChange = (newFilters: SearchFilters) => {
    updateFilters(newFilters);
  };

  const handleRefresh = () => {
    refreshStatus();
    window.location.reload();
  };

  const favoriteRecipes = recipes.filter(recipe => favorites.includes(recipe.id));

  const tabs = [
    { icon: ChefHat, label: 'All Recipes', count: null },
    { icon: TrendingUp, label: 'Trending', count: null },
    { icon: Clock, label: 'Recent', count: null },
    { icon: Heart, label: 'Favorites', count: favorites.length },
  ];

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Recipe Monitor
          </h1>
          <p className="text-xl text-gray-600">
            3チャンネル統合レシピ監視システム
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* System Status Indicator */}
          <div className="flex items-center gap-2">
            <div 
              className={`w-3 h-3 rounded-full ${
                status?.isOnline ? 'bg-green-500' : 'bg-red-500'
              }`}
              title={status?.isOnline ? 'System Online' : 'System Offline'}
            />
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <ChefHat className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {status?.totalRecipes || 0}
              </div>
              <div className="text-sm text-gray-600">
                Total Recipes
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {status?.activeChannels || 0}
              </div>
              <div className="text-sm text-gray-600">
                Active Channels
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <Heart className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {favorites.length}
              </div>
              <div className="text-sm text-gray-600">
                Favorites
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <PlaySquare className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {status?.pendingTasks || 0}
              </div>
              <div className="text-sm text-gray-600">
                Pending Tasks
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* Recipe Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-8">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab, index) => (
              <button
                key={index}
                onClick={() => handleTabChange(index)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === index
                    ? 'text-orange-600 border-orange-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
                {tab.count !== null && (
                  <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                    activeTab === index
                      ? 'bg-orange-100 text-orange-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
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
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => router.push('/recipe/add')}
        className="fixed bottom-6 right-6 bg-orange-600 text-white p-4 rounded-full shadow-lg hover:bg-orange-700 transition-colors focus:outline-none focus:ring-4 focus:ring-orange-500 focus:ring-opacity-50"
        aria-label="add recipe"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
};