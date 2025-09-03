import React from 'react';
import { Recipe } from '@/types/recipe';
import { RecipeCard } from './RecipeCard';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface RecipeGridProps {
  recipes: Recipe[];
  loading?: boolean;
  error?: any;
  onRecipeClick?: (recipe: Recipe) => void;
  onRetry?: () => void;
  showChannel?: boolean;
  variant?: 'default' | 'compact';
}

export const RecipeGrid: React.FC<RecipeGridProps> = ({
  recipes,
  loading = false,
  error = null,
  onRecipeClick,
  onRetry,
  showChannel = true,
  variant = 'default',
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-sm border border-gray-200 animate-pulse"
          >
            <div className="h-48 bg-gray-200 rounded-t-xl"></div>
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              <div className="flex gap-2">
                <div className="h-6 bg-gray-200 rounded w-16"></div>
                <div className="h-6 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Error Loading Recipes
        </h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          {error.message || 'Something went wrong while loading recipes. Please try again.'}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <ChefHat className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Recipes Found
        </h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          We couldn't find any recipes matching your criteria. Try adjusting your filters or search terms.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className={`grid gap-6 ${
      variant === 'compact' 
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5' 
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
    }`}>
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          onClick={onRecipeClick}
          showChannel={showChannel}
          variant={variant}
        />
      ))}
    </div>
  );
};