import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  Search, 
  Filter, 
  X, 
  Clock, 
  Users, 
  Star,
  ChefHat,
  SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Recipe } from '@/types/recipe';

export interface SearchFilters {
  query?: string;
  tags?: string[];
  difficulty?: string[];
  cookTimeRange?: [number, number];
  prepTimeRange?: [number, number];
  servings?: number;
  ingredients?: string[];
  sortBy?: 'newest' | 'oldest' | 'popular' | 'rating' | 'cookTime' | 'title';
  sortOrder?: 'asc' | 'desc';
}

interface RecipeSearchProps {
  onSearch: (filters: SearchFilters) => void;
  availableTags?: string[];
  availableIngredients?: string[];
  isLoading?: boolean;
  totalResults?: number;
  className?: string;
}

const DIFFICULTY_OPTIONS = ['初心者', '中級者', '上級者'];
const SORT_OPTIONS = [
  { value: 'newest', label: '新しい順' },
  { value: 'popular', label: '人気順' },
  { value: 'rating', label: '評価順' },
  { value: 'cookTime', label: '調理時間順' },
  { value: 'title', label: '名前順' }
];

export const RecipeSearch: React.FC<RecipeSearchProps> = ({
  onSearch,
  availableTags = [],
  availableIngredients = [],
  isLoading = false,
  totalResults = 0,
  className = ''
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [cookTimeRange, setCookTimeRange] = useState<[number, number]>([1, 180]);
  const [prepTimeRange, setPrepTimeRange] = useState<[number, number]>([1, 60]);
  const [servings, setServings] = useState<number | undefined>(undefined);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SearchFilters['sortBy']>('newest');
  const [tagSearch, setTagSearch] = useState('');
  const [ingredientSearch, setIngredientSearch] = useState('');

  // Filtered options for dropdowns
  const filteredTags = useMemo(() => {
    return availableTags.filter(tag => 
      tag.toLowerCase().includes(tagSearch.toLowerCase()) &&
      !selectedTags.includes(tag)
    );
  }, [availableTags, tagSearch, selectedTags]);

  const filteredIngredients = useMemo(() => {
    return availableIngredients.filter(ingredient => 
      ingredient.toLowerCase().includes(ingredientSearch.toLowerCase()) &&
      !selectedIngredients.includes(ingredient)
    );
  }, [availableIngredients, ingredientSearch, selectedIngredients]);

  // Apply search when filters change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      const filters: SearchFilters = {
        query: searchQuery.trim() || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        difficulty: selectedDifficulties.length > 0 ? selectedDifficulties : undefined,
        cookTimeRange: cookTimeRange[0] !== 1 || cookTimeRange[1] !== 180 ? cookTimeRange : undefined,
        prepTimeRange: prepTimeRange[0] !== 1 || prepTimeRange[1] !== 60 ? prepTimeRange : undefined,
        servings: servings || undefined,
        ingredients: selectedIngredients.length > 0 ? selectedIngredients : undefined,
        sortBy,
        sortOrder: 'desc'
      };
      onSearch(filters);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [
    searchQuery,
    selectedTags,
    selectedDifficulties,
    cookTimeRange,
    prepTimeRange,
    servings,
    selectedIngredients,
    sortBy,
    onSearch
  ]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTags([]);
    setSelectedDifficulties([]);
    setCookTimeRange([1, 180]);
    setPrepTimeRange([1, 60]);
    setServings(undefined);
    setSelectedIngredients([]);
    setSortBy('newest');
  };

  const hasActiveFilters = useMemo(() => {
    return searchQuery.trim() !== '' ||
           selectedTags.length > 0 ||
           selectedDifficulties.length > 0 ||
           cookTimeRange[0] !== 1 || cookTimeRange[1] !== 180 ||
           prepTimeRange[0] !== 1 || prepTimeRange[1] !== 60 ||
           servings !== undefined ||
           selectedIngredients.length > 0;
  }, [searchQuery, selectedTags, selectedDifficulties, cookTimeRange, prepTimeRange, servings, selectedIngredients]);

  const addTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setTagSearch('');
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  const addIngredient = (ingredient: string) => {
    if (!selectedIngredients.includes(ingredient)) {
      setSelectedIngredients([...selectedIngredients, ingredient]);
    }
    setIngredientSearch('');
  };

  const removeIngredient = (ingredient: string) => {
    setSelectedIngredients(selectedIngredients.filter(i => i !== ingredient));
  };

  const toggleDifficulty = (difficulty: string) => {
    setSelectedDifficulties(prev => 
      prev.includes(difficulty)
        ? prev.filter(d => d !== difficulty)
        : [...prev, difficulty]
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="レシピ名、材料、タグで検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Button
                variant="outline"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center gap-2 ${hasActiveFilters ? 'border-orange-500 text-orange-600' : ''}`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                フィルター
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1 px-2 py-0.5 text-xs">
                    ON
                  </Badge>
                )}
              </Button>

              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="text-gray-600"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Results Info */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <div className="text-sm text-gray-600">
                {isLoading ? (
                  '検索中...'
                ) : (
                  `${totalResults}件のレシピが見つかりました`
                )}
              </div>
              
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Advanced Filters */}
      <AnimatePresence>
        {isFilterOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  詳細フィルター
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Tags Filter */}
                <div>
                  <Label className="text-base font-semibold">タグ</Label>
                  <div className="mt-2 space-y-2">
                    <div className="relative">
                      <Input
                        placeholder="タグを検索..."
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        className="pr-8"
                      />
                      {tagSearch && (
                        <button
                          onClick={() => setTagSearch('')}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    {/* Available tags */}
                    {filteredTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {filteredTags.slice(0, 10).map(tag => (
                          <Button
                            key={tag}
                            variant="outline"
                            size="sm"
                            onClick={() => addTag(tag)}
                            className="text-xs h-7"
                          >
                            {tag}
                          </Button>
                        ))}
                      </div>
                    )}
                    
                    {/* Selected tags */}
                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedTags.map(tag => (
                          <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                            {tag}
                            <button
                              onClick={() => removeTag(tag)}
                              className="hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Difficulty Filter */}
                <div>
                  <Label className="text-base font-semibold">難易度</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DIFFICULTY_OPTIONS.map(difficulty => (
                      <Button
                        key={difficulty}
                        variant={selectedDifficulties.includes(difficulty) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleDifficulty(difficulty)}
                        className="flex items-center gap-2"
                      >
                        <Star className="w-4 h-4" />
                        {difficulty}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Time Filters */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-base font-semibold">調理時間</Label>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{cookTimeRange[0]}分 〜 {cookTimeRange[1]}分</span>
                      </div>
                      <Slider
                        value={cookTimeRange}
                        onValueChange={(value) => setCookTimeRange(value as [number, number])}
                        min={1}
                        max={180}
                        step={5}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-base font-semibold">準備時間</Label>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{prepTimeRange[0]}分 〜 {prepTimeRange[1]}分</span>
                      </div>
                      <Slider
                        value={prepTimeRange}
                        onValueChange={(value) => setPrepTimeRange(value as [number, number])}
                        min={1}
                        max={60}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Servings Filter */}
                <div>
                  <Label className="text-base font-semibold">人数</Label>
                  <div className="mt-2">
                    <Select value={servings?.toString()} onValueChange={(value) => setServings(value ? parseInt(value) : undefined)}>
                      <SelectTrigger className="w-32">
                        <Users className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="指定なし" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">指定なし</SelectItem>
                        {[1, 2, 3, 4, 5, 6, 8, 10].map(num => (
                          <SelectItem key={num} value={num.toString()}>
                            {num}人分
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Ingredients Filter */}
                <div>
                  <Label className="text-base font-semibold">含む材料</Label>
                  <div className="mt-2 space-y-2">
                    <div className="relative">
                      <Input
                        placeholder="材料を検索..."
                        value={ingredientSearch}
                        onChange={(e) => setIngredientSearch(e.target.value)}
                        className="pr-8"
                      />
                      {ingredientSearch && (
                        <button
                          onClick={() => setIngredientSearch('')}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    {/* Available ingredients */}
                    {filteredIngredients.length > 0 && (
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {filteredIngredients.slice(0, 10).map(ingredient => (
                          <Button
                            key={ingredient}
                            variant="outline"
                            size="sm"
                            onClick={() => addIngredient(ingredient)}
                            className="text-xs h-7"
                          >
                            {ingredient}
                          </Button>
                        ))}
                      </div>
                    )}
                    
                    {/* Selected ingredients */}
                    {selectedIngredients.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedIngredients.map(ingredient => (
                          <Badge key={ingredient} variant="secondary" className="flex items-center gap-1">
                            <ChefHat className="w-3 h-3" />
                            {ingredient}
                            <button
                              onClick={() => removeIngredient(ingredient)}
                              className="hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};