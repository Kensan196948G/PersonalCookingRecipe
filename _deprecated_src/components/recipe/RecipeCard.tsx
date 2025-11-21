import { Recipe } from '@/types/recipe';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Users, ChefHat, Heart, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

interface RecipeCardProps {
  recipe: Recipe;
  onLike?: (recipeId: string) => void;
  onView?: (recipeId: string) => void;
  className?: string;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onLike,
  onView,
  className = ''
}) => {
  const [isLiked, setIsLiked] = useState(recipe.isLiked || false);
  const [likeCount, setLikeCount] = useState(recipe.likeCount || 0);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikeCount(prev => newIsLiked ? prev + 1 : prev - 1);
    
    if (onLike) {
      onLike(recipe.id);
    }
  };

  const handleView = () => {
    if (onView) {
      onView(recipe.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <Link href={`/recipes/${recipe.id}`} onClick={handleView}>
        <Card className="h-full overflow-hidden hover:shadow-xl transition-all duration-300 group cursor-pointer">
          <CardHeader className="p-0 relative">
            <div className="aspect-video relative overflow-hidden bg-gray-100">
              {recipe.imageUrl ? (
                <Image
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-red-100">
                  <ChefHat className="w-16 h-16 text-orange-400" />
                </div>
              )}
            </div>
            
            {/* Like button overlay */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className="absolute top-2 right-2 bg-white/80 hover:bg-white text-red-500 hover:text-red-600 transition-all duration-200"
              aria-label={isLiked ? "いいねを取り消す" : "いいねする"}
            >
              <Heart 
                className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`}
              />
            </Button>

            {/* Difficulty badge */}
            {recipe.difficulty && (
              <Badge 
                variant="secondary" 
                className="absolute top-2 left-2 bg-black/70 text-white"
              >
                {recipe.difficulty}
              </Badge>
            )}
          </CardHeader>

          <CardContent className="p-4 flex-1">
            <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">
              {recipe.title}
            </h3>
            
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
              {recipe.description}
            </p>

            {/* Recipe metrics */}
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
              {recipe.cookTime && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{recipe.cookTime}分</span>
                </div>
              )}
              
              {recipe.servings && (
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{recipe.servings}人分</span>
                </div>
              )}

              <div className="flex items-center gap-1 ml-auto">
                <Eye className="w-4 h-4" />
                <span>{recipe.viewCount || 0}</span>
              </div>
            </div>

            {/* Tags */}
            {recipe.tags && recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {recipe.tags.slice(0, 3).map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {recipe.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{recipe.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>

          <CardFooter className="p-4 pt-0 flex justify-between items-center">
            {/* Author info */}
            <div className="flex items-center gap-2">
              {recipe.author?.avatar ? (
                <Image
                  src={recipe.author.avatar}
                  alt={recipe.author.name}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              ) : (
                <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                  <ChefHat className="w-3 h-3 text-gray-600" />
                </div>
              )}
              <span className="text-sm text-gray-600">
                {recipe.author?.name || 'Anonymous'}
              </span>
            </div>

            {/* Like count */}
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Heart className="w-4 h-4" />
              <span>{likeCount}</span>
            </div>
          </CardFooter>
        </Card>
      </Link>
    </motion.div>
  );
};