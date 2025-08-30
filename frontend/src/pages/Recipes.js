import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { recipeService } from '../services/recipeService';
import { categoryService } from '../services/categoryService';
import LoadingSpinner from '../components/LoadingSpinner';
import RecipeCard from '../components/RecipeCard';
import { Plus, Search, Filter, X } from 'lucide-react';
import { toast } from 'react-toastify';

const Recipes = () => {
  const [filters, setFilters] = useState({
    search: '',
    category_id: '',
    difficulty: '',
    is_favorite: '',
  });

  const [showFilters, setShowFilters] = useState(false);

  const { data: recipes, isLoading, refetch } = useQuery(
    ['recipes', filters],
    () => recipeService.getAll(filters),
    { keepPreviousData: true }
  );

  const { data: categories } = useQuery('categories', categoryService.getAll);

  const handleToggleFavorite = async (id) => {
    try {
      await recipeService.toggleFavorite(id);
      refetch();
      toast.success('Favorite status updated');
    } catch (error) {
      toast.error('Failed to update favorite status');
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      category_id: '',
      difficulty: '',
      is_favorite: '',
    });
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">My Recipes</h1>
        <Link to="/recipes/new" className="btn-primary flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>Add Recipe</span>
        </Link>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search recipes..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center space-x-2 ${activeFilterCount > 0 ? 'ring-2 ring-primary-500' : ''}`}
          >
            <Filter className="h-5 w-5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-primary-600 text-white text-xs rounded-full px-2 py-0.5">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={filters.category_id}
                  onChange={(e) => handleFilterChange('category_id', e.target.value)}
                  className="input-field"
                >
                  <option value="">All Categories</option>
                  {categories?.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Difficulty
                </label>
                <select
                  value={filters.difficulty}
                  onChange={(e) => handleFilterChange('difficulty', e.target.value)}
                  className="input-field"
                >
                  <option value="">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Show Only
                </label>
                <select
                  value={filters.is_favorite}
                  onChange={(e) => handleFilterChange('is_favorite', e.target.value)}
                  className="input-field"
                >
                  <option value="">All Recipes</option>
                  <option value="true">Favorites Only</option>
                </select>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center space-x-1"
              >
                <X className="h-4 w-4" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Recipe Grid */}
      {isLoading ? (
        <LoadingSpinner />
      ) : recipes && recipes.length > 0 ? (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Showing {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recipes found</h3>
          <p className="text-gray-600 mb-4">
            {activeFilterCount > 0 
              ? 'Try adjusting your filters or search query'
              : 'Start adding recipes to your collection'}
          </p>
          {activeFilterCount > 0 ? (
            <button onClick={clearFilters} className="btn-secondary">
              Clear Filters
            </button>
          ) : (
            <Link to="/recipes/new" className="btn-primary inline-flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>Add Your First Recipe</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default Recipes;