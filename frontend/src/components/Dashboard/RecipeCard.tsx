import React from 'react';
import Image from 'next/image';
import { Recipe } from '@/types/recipe';
import { formatDistanceToNow, format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useFavoriteRecipes } from '@/hooks/useRecipes';
import { 
  Clock, 
  Users, 
  Star, 
  Heart, 
  Play, 
  Eye, 
  ThumbsUp,
  User
} from 'lucide-react';

interface RecipeCardProps {
  recipe: Recipe;
  onClick?: (recipe: Recipe) => void;
  showChannel?: boolean;
  variant?: 'default' | 'compact';
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onClick,
  showChannel = true,
  variant = 'default',
}) => {
  const { isFavorite, toggleFavorite } = useFavoriteRecipes();
  const isCompact = variant === 'compact';

  const handleClick = () => {
    onClick?.(recipe);
  };

  const handleFavoriteClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    toggleFavorite(recipe.id);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'hard': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatViewCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const formatDuration = (duration: string) => {
    // Convert YouTube duration format PT4M13S to readable format
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return duration;
    
    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const seconds = match[3] ? parseInt(match[3]) : 0;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer overflow-hidden"
      onClick={handleClick}
    >
      {/* Video Thumbnail */}
      <div className="relative">
        <div className={`relative ${isCompact ? 'h-32' : 'h-48'} overflow-hidden`}>
          <Image
            src={recipe.thumbnailUrl}
            alt={recipe.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        </div>
        
        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black bg-opacity-20">
          <div className="bg-black bg-opacity-70 text-white p-3 rounded-full">
            <Play className="h-6 w-6" fill="currentColor" />
          </div>
        </div>

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
          {formatDuration(recipe.duration)}
        </div>

        {/* Favorite Button */}
        <button
          onClick={handleFavoriteClick}
          className="absolute top-2 right-2 bg-white bg-opacity-90 hover:bg-white p-2 rounded-full transition-colors"
        >
          <Heart 
            className={`h-4 w-4 ${
              isFavorite(recipe.id) 
                ? 'text-red-500 fill-current' 
                : 'text-gray-400'
            }`}
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Channel Info */}
        {showChannel && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="h-3 w-3 text-gray-500" />
            </div>
            <span className="text-xs text-gray-600">
              {recipe.channelName}
            </span>
            <span className="text-xs text-gray-400">
              • {formatDistanceToNow(new Date(recipe.publishedAt), { locale: ja })} ago
            </span>
          </div>
        )}

        {/* Title */}
        <h3 className={`font-semibold text-gray-900 mb-2 line-clamp-2 ${
          isCompact ? 'text-sm' : 'text-base'
        }`}>
          {recipe.title}
        </h3>

        {/* Description */}
        {!isCompact && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {recipe.description}
          </p>
        )}

        {/* Recipe Info */}
        <div className="flex flex-wrap gap-2 mb-3">
          {recipe.cookingTime && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
              <Clock className="h-3 w-3" />
              {recipe.cookingTime}min
            </span>
          )}
          
          {recipe.servings && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
              <Users className="h-3 w-3" />
              {recipe.servings} servings
            </span>
          )}
          
          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${getDifficultyColor(recipe.difficulty)}`}>
            <Star className="h-3 w-3" />
            {recipe.difficulty}
          </span>
        </div>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {recipe.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
            {recipe.tags.length > 3 && (
              <span className="text-xs text-gray-500">
                +{recipe.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatViewCount(recipe.viewCount)}
            </div>
            
            {recipe.likeCount > 0 && (
              <div className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" />
                {formatViewCount(recipe.likeCount)}
              </div>
            )}
          </div>
          
          <span className="text-xs text-gray-500">
            {format(new Date(recipe.publishedAt), 'MMM dd, yyyy', { locale: ja })}
          </span>
        </div>
      </div>
    </div>
  );
};