import { Recipe, CreateRecipeDto, Ingredient, Instruction } from '@/types/recipe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Minus, 
  Upload, 
  X, 
  Camera,
  Video,
  Clock,
  Users,
  Star,
  Tags
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const recipeSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です'),
  description: z.string().min(10, '説明は10文字以上入力してください'),
  prepTime: z.number().min(1, '準備時間は1分以上で入力してください'),
  cookTime: z.number().min(1, '調理時間は1分以上で入力してください'),
  servings: z.number().min(1, '人数は1人以上で入力してください'),
  difficulty: z.enum(['初心者', '中級者', '上級者']),
  ingredients: z.array(z.object({
    name: z.string().min(1, '材料名は必須です'),
    amount: z.string().min(1, '分量は必須です'),
    unit: z.string().min(1, '単位は必須です'),
  })).min(1, '材料は1つ以上追加してください'),
  instructions: z.array(z.object({
    description: z.string().min(1, '手順の説明は必須です'),
    time: z.number().optional(),
  })).min(1, '手順は1つ以上追加してください'),
  tags: z.array(z.string()).optional(),
});

type RecipeFormData = z.infer<typeof recipeSchema>;

interface RecipeFormProps {
  recipe?: Recipe;
  onSubmit: (data: CreateRecipeDto) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const RecipeForm: React.FC<RecipeFormProps> = ({
  recipe,
  onSubmit,
  onCancel,
  isLoading = false
}) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(recipe?.imageUrl || null);
  const [videoPreview, setVideoPreview] = useState<string | null>(recipe?.videoUrl || null);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(recipe?.tags || []);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<RecipeFormData>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      title: recipe?.title || '',
      description: recipe?.description || '',
      prepTime: recipe?.prepTime || 15,
      cookTime: recipe?.cookTime || 30,
      servings: recipe?.servings || 2,
      difficulty: recipe?.difficulty || '初心者',
      ingredients: recipe?.ingredients || [{ name: '', amount: '', unit: '' }],
      instructions: recipe?.instructions || [{ description: '', time: undefined }],
      tags: recipe?.tags || [],
    }
  });

  const { 
    fields: ingredientFields, 
    append: appendIngredient, 
    remove: removeIngredient 
  } = useFieldArray({
    control,
    name: 'ingredients'
  });

  const { 
    fields: instructionFields, 
    append: appendInstruction, 
    remove: removeInstruction 
  } = useFieldArray({
    control,
    name: 'instructions'
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setVideoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      const newTags = [...tags, tagInput.trim()];
      setTags(newTags);
      setValue('tags', newTags);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = tags.filter(tag => tag !== tagToRemove);
    setTags(newTags);
    setValue('tags', newTags);
  };

  const onFormSubmit = async (data: RecipeFormData) => {
    const formData = new FormData();
    
    // Basic recipe data
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'ingredients' && key !== 'instructions' && key !== 'tags') {
        formData.append(key, value.toString());
      }
    });

    // Complex data as JSON strings
    formData.append('ingredients', JSON.stringify(data.ingredients));
    formData.append('instructions', JSON.stringify(data.instructions));
    formData.append('tags', JSON.stringify(tags));

    // Files
    if (imageFile) {
      formData.append('image', imageFile);
    }
    if (videoFile) {
      formData.append('video', videoFile);
    }

    await onSubmit(formData as unknown as CreateRecipeDto);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="max-w-4xl mx-auto space-y-6">
      {/* Basic Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">レシピ名 *</Label>
              <Input
                id="title"
                placeholder="美味しいレシピの名前を入力してください"
                {...register('title')}
                className={errors.title ? 'border-red-500' : ''}
              />
              {errors.title && (
                <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">説明 *</Label>
              <Textarea
                id="description"
                placeholder="このレシピの特徴や魅力を説明してください"
                rows={3}
                {...register('description')}
                className={errors.description ? 'border-red-500' : ''}
              />
              {errors.description && (
                <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="prepTime">準備時間 (分) *</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    id="prepTime"
                    type="number"
                    min="1"
                    className="pl-10"
                    {...register('prepTime', { valueAsNumber: true })}
                  />
                </div>
                {errors.prepTime && (
                  <p className="text-red-500 text-sm mt-1">{errors.prepTime.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="cookTime">調理時間 (分) *</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    id="cookTime"
                    type="number"
                    min="1"
                    className="pl-10"
                    {...register('cookTime', { valueAsNumber: true })}
                  />
                </div>
                {errors.cookTime && (
                  <p className="text-red-500 text-sm mt-1">{errors.cookTime.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="servings">人数 *</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    id="servings"
                    type="number"
                    min="1"
                    className="pl-10"
                    {...register('servings', { valueAsNumber: true })}
                  />
                </div>
                {errors.servings && (
                  <p className="text-red-500 text-sm mt-1">{errors.servings.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="difficulty">難易度 *</Label>
                <Select 
                  defaultValue={recipe?.difficulty || '初心者'}
                  onValueChange={(value) => setValue('difficulty', value as any)}
                >
                  <SelectTrigger>
                    <Star className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="初心者">初心者</SelectItem>
                    <SelectItem value="中級者">中級者</SelectItem>
                    <SelectItem value="上級者">上級者</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Media Upload */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>写真・動画</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Image Upload */}
              <div>
                <Label>メイン画像</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {imagePreview ? (
                    <div className="relative">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="w-full h-48 object-cover rounded"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setImagePreview(null);
                          setImageFile(null);
                          if (imageInputRef.current) {
                            imageInputRef.current.value = '';
                          }
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto" />
                      <p className="text-gray-600">画像をアップロード</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => imageInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        ファイル選択
                      </Button>
                    </div>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </div>
              </div>

              {/* Video Upload */}
              <div>
                <Label>調理動画（オプション）</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {videoPreview ? (
                    <div className="relative">
                      <video 
                        src={videoPreview} 
                        className="w-full h-48 object-cover rounded"
                        controls
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setVideoPreview(null);
                          setVideoFile(null);
                          if (videoInputRef.current) {
                            videoInputRef.current.value = '';
                          }
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Video className="w-12 h-12 text-gray-400 mx-auto" />
                      <p className="text-gray-600">動画をアップロード</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => videoInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        ファイル選択
                      </Button>
                    </div>
                  )}
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleVideoChange}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tags */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="w-5 h-5" />
              タグ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="タグを入力してEnterキーで追加"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" onClick={addTag} variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {tags.map((tag) => (
                    <motion.div
                      key={tag}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      <Badge variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Ingredients */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>材料</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence>
              {ingredientFields.map((field, index) => (
                <motion.div
                  key={field.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex gap-2 items-end"
                >
                  <div className="flex-1">
                    <Label>材料名</Label>
                    <Input
                      placeholder="例: 玉ねぎ"
                      {...register(`ingredients.${index}.name`)}
                      className={errors.ingredients?.[index]?.name ? 'border-red-500' : ''}
                    />
                    {errors.ingredients?.[index]?.name && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.ingredients[index]?.name?.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="w-24">
                    <Label>分量</Label>
                    <Input
                      placeholder="1"
                      {...register(`ingredients.${index}.amount`)}
                      className={errors.ingredients?.[index]?.amount ? 'border-red-500' : ''}
                    />
                  </div>
                  
                  <div className="w-20">
                    <Label>単位</Label>
                    <Input
                      placeholder="個"
                      {...register(`ingredients.${index}.unit`)}
                      className={errors.ingredients?.[index]?.unit ? 'border-red-500' : ''}
                    />
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeIngredient(index)}
                    disabled={ingredientFields.length === 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
            
            <Button
              type="button"
              variant="outline"
              onClick={() => appendIngredient({ name: '', amount: '', unit: '' })}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              材料を追加
            </Button>
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
            <CardTitle>作り方</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence>
              {instructionFields.map((field, index) => (
                <motion.div
                  key={field.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-semibold">手順 {index + 1}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeInstruction(index)}
                      disabled={instructionFields.length === 1}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div>
                    <Label>手順の説明 *</Label>
                    <Textarea
                      placeholder="具体的な手順を詳しく説明してください"
                      rows={3}
                      {...register(`instructions.${index}.description`)}
                      className={errors.instructions?.[index]?.description ? 'border-red-500' : ''}
                    />
                    {errors.instructions?.[index]?.description && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.instructions[index]?.description?.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="w-32">
                    <Label>目安時間（分）</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="5"
                      {...register(`instructions.${index}.time`, { valueAsNumber: true })}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            <Button
              type="button"
              variant="outline"
              onClick={() => appendInstruction({ description: '', time: undefined })}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              手順を追加
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex justify-end gap-4 pt-4"
      >
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          キャンセル
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="min-w-[120px]"
        >
          {isLoading ? '保存中...' : recipe ? 'レシピを更新' : 'レシピを作成'}
        </Button>
      </motion.div>
    </form>
  );
};