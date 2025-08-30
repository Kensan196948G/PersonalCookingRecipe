import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { recipeService } from '../services/recipeService';
import LoadingSpinner from '../components/LoadingSpinner';
import { 
  Clock, 
  Users, 
  ChefHat, 
  Heart, 
  Star, 
  Edit, 
  Trash2,
  ArrowLeft,
  Calendar,
  Tag
} from 'lucide-react';
import { toast } from 'react-toastify';

const RecipeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);

  const { data: recipe, isLoading, refetch } = useQuery(
    ['recipe', id],
    () => recipeService.getById(id)
  );

  const deleteMutation = useMutation(
    () => recipeService.delete(id),
    {
      onSuccess: () => {
        toast.success('Recipe deleted successfully');
        navigate('/recipes');
      },
      onError: () => {
        toast.error('Failed to delete recipe');
      }
    }
  );

  const favoriteMutation = useMutation(
    () => recipeService.toggleFavorite(id),
    {
      onSuccess: () => {
        refetch();
        toast.success('Favorite status updated');
      },
      onError: () => {
        toast.error('Failed to update favorite status');
      }
    }
  );

  const ratingMutation = useMutation(
    (newRating) => recipeService.updateRating(id, newRating),
    {
      onSuccess: () => {
        refetch();
        toast.success('Rating updated');
      },
      onError: () => {
        toast.error('Failed to update rating');
      }
    }
  );

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this recipe?')) {
      deleteMutation.mutate();
    }
  };

  const handleRating = (newRating) => {
    setRating(newRating);
    ratingMutation.mutate(newRating);
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800',
    };
    return colors[difficulty] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!recipe) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Recipe not found</h2>
        <Link to="/recipes" className="mt-4 text-primary-600 hover:text-primary-700">
          Back to recipes
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-6">
        <Link
          to="/recipes"
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Recipes</span>
        </Link>
        
        <div className="flex items-center space-x-2">
          <Link
            to={`/recipes/${id}/edit`}
            className="btn-secondary flex items-center space-x-2"
          >
            <Edit className="h-4 w-4" />
            <span>Edit</span>
          </Link>
          <button
            onClick={handleDelete}
            className="btn-secondary flex items-center space-x-2 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Recipe Content */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {recipe.image_url && (
          <img
            src={`http://localhost:5000${recipe.image_url}`}
            alt={recipe.title}
            className="w-full h-64 md:h-96 object-cover"
          />
        )}
        
        <div className="p-6 md:p-8">
          {/* Title and Actions */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{recipe.title}</h1>
              {recipe.description && (
                <p className="text-gray-600">{recipe.description}</p>
              )}
            </div>
            <button
              onClick={() => favoriteMutation.mutate()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Heart
                className={`h-6 w-6 ${
                  recipe.is_favorite ? 'text-red-500 fill-current' : 'text-gray-400'
                }`}
              />
            </button>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-4 mb-6 text-sm">
            {recipe.prep_time && (
              <div className="flex items-center space-x-1 text-gray-600">
                <Clock className="h-4 w-4" />
                <span>Prep: {recipe.prep_time} min</span>
              </div>
            )}
            {recipe.cook_time && (
              <div className="flex items-center space-x-1 text-gray-600">
                <Clock className="h-4 w-4" />
                <span>Cook: {recipe.cook_time} min</span>
              </div>
            )}
            {recipe.servings && (
              <div className="flex items-center space-x-1 text-gray-600">
                <Users className="h-4 w-4" />
                <span>{recipe.servings} servings</span>
              </div>
            )}
            {recipe.difficulty && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(recipe.difficulty)}`}>
                {recipe.difficulty}
              </span>
            )}
            {recipe.category_name && (
              <span 
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ 
                  backgroundColor: `${recipe.category_color}20`,
                  color: recipe.category_color 
                }}
              >
                {recipe.category_name}
              </span>
            )}
          </div>

          {/* Rating */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">Rating</p>
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`h-6 w-6 ${
                      star <= (recipe.rating || 0)
                        ? 'text-yellow-400 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Ingredients</h2>
              <ul className="space-y-2">
                {recipe.ingredients.map((ingredient, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-primary-600 mr-2">•</span>
                    <span className="text-gray-700">
                      <span className="font-medium">{ingredient.amount}</span>
                      {ingredient.unit && ` ${ingredient.unit}`} {ingredient.name}
                      {ingredient.notes && (
                        <span className="text-gray-500 text-sm ml-2">({ingredient.notes})</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Instructions */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Instructions</h2>
            <div className="prose prose-blue max-w-none">
              <div className="whitespace-pre-wrap text-gray-700">{recipe.instructions}</div>
            </div>
          </div>

          {/* Notes */}
          {recipe.notes && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Notes</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700">{recipe.notes}</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>Added {new Date(recipe.created_at).toLocaleDateString()}</span>
              </div>
              {recipe.updated_at !== recipe.created_at && (
                <div className="flex items-center space-x-1">
                  <Edit className="h-4 w-4" />
                  <span>Updated {new Date(recipe.updated_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipeDetail;