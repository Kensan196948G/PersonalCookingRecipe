import React from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { recipeService } from '../services/recipeService';
import { categoryService } from '../services/categoryService';
import LoadingSpinner from '../components/LoadingSpinner';
import RecipeCard from '../components/RecipeCard';
import { Plus, BookOpen, Tag, Heart, Star, TrendingUp } from 'lucide-react';
import { toast } from 'react-toastify';

const Dashboard = () => {
  const { data: recipes, isLoading: recipesLoading, refetch: refetchRecipes } = useQuery(
    'dashboard-recipes',
    () => recipeService.getAll({ limit: 6 })
  );

  const { data: categories, isLoading: categoriesLoading } = useQuery(
    'dashboard-categories',
    categoryService.getAll
  );

  const { data: favorites } = useQuery(
    'dashboard-favorites',
    () => recipeService.getAll({ is_favorite: true })
  );

  const handleToggleFavorite = async (id) => {
    try {
      await recipeService.toggleFavorite(id);
      refetchRecipes();
      toast.success('Favorite status updated');
    } catch (error) {
      toast.error('Failed to update favorite status');
    }
  };

  if (recipesLoading || categoriesLoading) {
    return <LoadingSpinner />;
  }

  const stats = {
    totalRecipes: recipes?.length || 0,
    totalCategories: categories?.length || 0,
    favoriteRecipes: favorites?.length || 0,
    averageRating: recipes?.reduce((acc, r) => acc + (r.rating || 0), 0) / (recipes?.length || 1),
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <Link to="/recipes/new" className="btn-primary flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>Add Recipe</span>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Recipes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalRecipes}</p>
            </div>
            <BookOpen className="h-8 w-8 text-primary-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Categories</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCategories}</p>
            </div>
            <Tag className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Favorites</p>
              <p className="text-2xl font-bold text-gray-900">{stats.favoriteRecipes}</p>
            </div>
            <Heart className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Rating</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.averageRating.toFixed(1)}
              </p>
            </div>
            <Star className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Recent Recipes */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Recent Recipes</h2>
          <Link to="/recipes" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            View All →
          </Link>
        </div>

        {recipes && recipes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.slice(0, 6).map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No recipes yet</h3>
            <p className="text-gray-600 mb-4">Start building your recipe collection</p>
            <Link to="/recipes/new" className="btn-primary inline-flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>Add Your First Recipe</span>
            </Link>
          </div>
        )}
      </div>

      {/* Categories Overview */}
      {categories && categories.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Categories</h2>
            <Link to="/categories" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              Manage Categories →
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.slice(0, 8).map((category) => (
              <Link
                key={category.id}
                to={`/recipes?category=${category.id}`}
                className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div
                      className="h-3 w-3 rounded-full mb-2"
                      style={{ backgroundColor: category.color }}
                    />
                    <p className="font-medium text-gray-900">{category.name}</p>
                    <p className="text-sm text-gray-600">{category.recipe_count || 0} recipes</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;