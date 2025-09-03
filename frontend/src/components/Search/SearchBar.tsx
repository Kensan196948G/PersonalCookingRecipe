import React, { useState, useCallback, useEffect } from 'react';
import { 
  SearchIcon, 
  FilterIcon, 
  XIcon 
} from 'lucide-react';

interface SearchFilters {
  query: string;
  channel?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  cookingTime?: {
    min: number;
    max: number;
  };
  tags: string[];
  publishedAfter?: string;
  publishedBefore?: string;
}

interface SearchBarProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch?: (query: string) => void;
}

const POPULAR_TAGS = [
  'Easy', 'Quick', 'Healthy', 'Vegetarian', 'Vegan', 'Dessert',
  'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Italian', 'Asian',
  'Mexican', 'Indian', 'Japanese', 'Chinese', 'Thai', 'Low-carb',
  'Gluten-free', 'Dairy-free', 'Keto', 'Paleo', 'Comfort-food'
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export const SearchBar: React.FC<SearchBarProps> = ({
  filters,
  onFiltersChange,
  onSearch,
}) => {
  const [query, setQuery] = useState(filters.query || '');
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      onFiltersChange({ ...filters, query: searchQuery });
      onSearch?.(searchQuery);
    }, 300),
    [filters, onFiltersChange, onSearch]
  );

  useEffect(() => {
    debouncedSearch(query);
    return () => {
      debouncedSearch.cancel();
    };
  }, [query, debouncedSearch]);

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleClearSearch = () => {
    setQuery('');
    onFiltersChange({ ...filters, query: '' });
  };

  const handleTagAdd = (tag: string) => {
    if (!filters.tags.includes(tag)) {
      onFiltersChange({
        ...filters,
        tags: [...filters.tags, tag],
      });
    }
  };

  const handleTagRemove = (tagToRemove: string) => {
    onFiltersChange({
      ...filters,
      tags: filters.tags.filter(tag => tag !== tagToRemove),
    });
  };

  const handleDifficultyChange = (difficulty: string) => {
    onFiltersChange({
      ...filters,
      difficulty: difficulty === filters.difficulty ? undefined : difficulty as 'easy' | 'medium' | 'hard',
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      query: '',
      tags: [],
    });
    setQuery('');
  };

  const hasActiveFilters = 
    filters.channel || 
    filters.difficulty || 
    filters.cookingTime || 
    filters.tags.length > 0;

  return (
    <div className="w-full mb-6">
      {/* Main Search Bar */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="レシピ、材料、チャンネルを検索..."
            value={query}
            onChange={handleQueryChange}
            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
          />
          {query && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XIcon className="h-5 w-5" />
            </button>
          )}
        </div>
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-3 rounded-lg border transition-colors ${
            hasActiveFilters 
              ? 'bg-primary-500 text-white border-primary-500' 
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          <FilterIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Active Tags */}
      {filters.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-100 text-primary-800"
            >
              {tag}
              <button
                onClick={() => handleTagRemove(tag)}
                className="ml-2 text-primary-600 hover:text-primary-800"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">フィルター</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Difficulty Filter */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">難易度</h4>
            <div className="flex gap-2">
              {DIFFICULTY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleDifficultyChange(option.value)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    filters.difficulty === option.value
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Popular Tags */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">人気のタグ</h4>
            <div className="flex flex-wrap gap-2">
              {POPULAR_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagAdd(tag)}
                  className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                    filters.tags.includes(tag)
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleClearFilters}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                すべてのフィルターをクリア
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout;
  
  const debouncedFunc = ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T & { cancel: () => void };

  debouncedFunc.cancel = () => {
    clearTimeout(timeoutId);
  };

  return debouncedFunc;
}