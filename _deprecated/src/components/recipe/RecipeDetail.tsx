import { Recipe } from '@/types/recipe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  Users, 
  ChefHat, 
  Heart, 
  BookOpen, 
  Star,
  Share2,
  Download,
  Edit,
  Play,
  Pause
} from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useState, useRef } from 'react';

interface RecipeDetailProps {
  recipe: Recipe;
  canEdit?: boolean;
  onLike?: (recipeId: string) => void;
  onShare?: (recipeId: string) => void;
  onEdit?: (recipeId: string) => void;
  onSave?: (recipeId: string) => void;
}

export const RecipeDetail: React.FC<RecipeDetailProps> = ({
  recipe,
  canEdit = false,
  onLike,
  onShare,
  onEdit,
  onSave
}) => {
  const [isLiked, setIsLiked] = useState(recipe.isLiked || false);
  const [likeCount, setLikeCount] = useState(recipe.likeCount || 0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleLike = async () => {
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikeCount(prev => newIsLiked ? prev + 1 : prev - 1);
    
    if (onLike) {
      onLike(recipe.id);
    }
  };

  const handleShare = () => {
    if (onShare) {
      onShare(recipe.id);
    }
  };

  const handleVideoToggle = () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsVideoPlaying(!isVideoPlaying);
    }
  };

  const toggleStep = (stepIndex: number) => {
    setCheckedSteps(prev => {
      const newChecked = new Set(prev);
      if (newChecked.has(stepIndex)) {
        newChecked.delete(stepIndex);
      } else {
        newChecked.add(stepIndex);
      }
      return newChecked;
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          {recipe.title}
        </h1>
        
        {recipe.description && (
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {recipe.description}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap justify-center gap-3">
          <Button 
            onClick={handleLike}
            variant={isLiked ? "default" : "outline"}
            className={isLiked ? "bg-red-500 hover:bg-red-600" : ""}
          >
            <Heart className={`w-4 h-4 mr-2 ${isLiked ? 'fill-current' : ''}`} />
            {likeCount} いいね
          </Button>
          
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" />
            シェア
          </Button>
          
          <Button variant="outline" onClick={() => onSave?.(recipe.id)}>
            <BookOpen className="w-4 h-4 mr-2" />
            保存
          </Button>
          
          {canEdit && (
            <Button variant="outline" onClick={() => onEdit?.(recipe.id)}>
              <Edit className="w-4 h-4 mr-2" />
              編集
            </Button>
          )}
        </div>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Media Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-0">
              {recipe.videoUrl ? (
                <div className="relative aspect-video bg-black">
                  <video
                    ref={videoRef}
                    src={recipe.videoUrl}
                    poster={recipe.imageUrl}
                    className="w-full h-full object-cover"
                    controls={false}
                    onPlay={() => setIsVideoPlaying(true)}
                    onPause={() => setIsVideoPlaying(false)}
                  />
                  <button
                    onClick={handleVideoToggle}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
                  >
                    {isVideoPlaying ? (
                      <Pause className="w-16 h-16 text-white" />
                    ) : (
                      <Play className="w-16 h-16 text-white" />
                    )}
                  </button>
                </div>
              ) : recipe.imageUrl ? (
                <div className="aspect-video relative">
                  <Image
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center">
                  <ChefHat className="w-24 h-24 text-orange-400" />
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recipe Info */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* Metrics */}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {recipe.prepTime && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="text-sm text-gray-600">準備時間</p>
                      <p className="font-semibold">{recipe.prepTime}分</p>
                    </div>
                  </div>
                )}
                
                {recipe.cookTime && (
                  <div className="flex items-center gap-2">
                    <ChefHat className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="text-sm text-gray-600">調理時間</p>
                      <p className="font-semibold">{recipe.cookTime}分</p>
                    </div>
                  </div>
                )}
                
                {recipe.servings && (
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="text-sm text-gray-600">人数</p>
                      <p className="font-semibold">{recipe.servings}人分</p>
                    </div>
                  </div>
                )}
                
                {recipe.difficulty && (
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="text-sm text-gray-600">難易度</p>
                      <Badge variant="secondary">{recipe.difficulty}</Badge>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          {recipe.tags && recipe.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">カテゴリー</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {recipe.tags.map((tag, index) => (
                    <Badge key={index} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      {/* Ingredients */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              材料 {recipe.servings && `(${recipe.servings}人分)`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recipe.ingredients && recipe.ingredients.length > 0 ? (
              <div className="space-y-3">
                {recipe.ingredients.map((ingredient, index) => (
                  <div 
                    key={index}
                    className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                  >
                    <span className="font-medium">{ingredient.name}</span>
                    <span className="text-gray-600">
                      {ingredient.amount} {ingredient.unit}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">材料情報がありません</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">作り方</CardTitle>
          </CardHeader>
          <CardContent>
            {recipe.instructions && recipe.instructions.length > 0 ? (
              <div className="space-y-4">
                {recipe.instructions.map((instruction, index) => (
                  <div 
                    key={index}
                    className={`flex gap-4 p-4 rounded-lg border transition-all ${
                      checkedSteps.has(index) 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <button
                      onClick={() => toggleStep(index)}
                      className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all ${
                        checkedSteps.has(index)
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 text-gray-600 hover:border-orange-400'
                      }`}
                    >
                      {index + 1}
                    </button>
                    <div className="flex-1">
                      <p className={`leading-relaxed ${
                        checkedSteps.has(index) ? 'text-gray-700' : 'text-gray-900'
                      }`}>
                        {instruction.description}
                      </p>
                      {instruction.time && (
                        <p className="text-sm text-gray-500 mt-2">
                          <Clock className="w-4 h-4 inline mr-1" />
                          約 {instruction.time}分
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">作り方がありません</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Author Info */}
      {recipe.author && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                {recipe.author.avatar ? (
                  <Image
                    src={recipe.author.avatar}
                    alt={recipe.author.name}
                    width={60}
                    height={60}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-15 h-15 bg-gray-300 rounded-full flex items-center justify-center">
                    <ChefHat className="w-8 h-8 text-gray-600" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{recipe.author.name}</h3>
                  {recipe.author.bio && (
                    <p className="text-gray-600">{recipe.author.bio}</p>
                  )}
                </div>
                <Button variant="outline">フォロー</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};