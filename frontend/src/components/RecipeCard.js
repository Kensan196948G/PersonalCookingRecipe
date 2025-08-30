import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Users, ChefHat, Heart, Star } from 'lucide-react';

const RecipeCard = ({ recipe, onToggleFavorite }) => {
  const getDifficultyColor = (difficulty) => {
    const colors = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800',
    };
    return colors[difficulty] || 'bg-gray-100 text-gray-800';
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200">
      {recipe.image_url && (
        <img
          src={`http://localhost:5000${recipe.image_url}`}
          alt={recipe.title}
          className="w-full h-48 object-cover"
        />
      )}
      
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <Link to={`/recipes/${recipe.id}`}>
            <h3 className="text-lg font-semibold text-gray-900 hover:text-primary-600 transition-colors">
              {recipe.title}
            </h3>
          </Link>
          <button
            onClick={() => onToggleFavorite(recipe.id)}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Heart
              className={`h-5 w-5 ${
                recipe.is_favorite ? 'text-red-500 fill-current' : 'text-gray-400'
              }`}
            />
          </button>
        </div>

        {recipe.description && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{recipe.description}</p>
        )}

        <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
          {recipe.prep_time && (
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>{recipe.prep_time + (recipe.cook_time || 0)} min</span>
            </div>
          )}
          {recipe.servings && (
            <div className="flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>{recipe.servings}</span>
            </div>
          )}
          {recipe.difficulty && (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(recipe.difficulty)}`}>
              {recipe.difficulty}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {recipe.rating && renderStars(recipe.rating)}
          </div>
          {recipe.category_name && (
            <span 
              className="text-xs px-2 py-1 rounded-full"
              style={{ 
                backgroundColor: `${recipe.category_color}20`,
                color: recipe.category_color 
              }}
            >
              {recipe.category_name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecipeCard;