import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  InputAdornment,
  Chip,
  Autocomplete,
  Paper,
  Typography,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Slider,
  Button,
  Stack,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { SearchFilters, Channel } from '@/types';
import { useChannelApi } from '@/hooks/useChannels';
import { debounce } from 'lodash';

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

const COOKING_TIME_MARKS = [
  { value: 15, label: '15min' },
  { value: 30, label: '30min' },
  { value: 60, label: '1h' },
  { value: 120, label: '2h' },
  { value: 180, label: '3h+' },
];

export const SearchBar: React.FC<SearchBarProps> = ({
  filters,
  onFiltersChange,
  onSearch,
}) => {
  const [query, setQuery] = useState(filters.query || '');
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<HTMLElement | null>(null);
  const { channels } = useChannelApi();

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

  const handleChannelChange = (channelId: string | null) => {
    onFiltersChange({
      ...filters,
      channel: channelId || undefined,
    });
  };

  const handleDifficultyChange = (difficulty: string | null) => {
    onFiltersChange({
      ...filters,
      difficulty: difficulty || undefined,
    });
  };

  const handleCookingTimeChange = (_: Event, value: number | number[]) => {
    const [min, max] = Array.isArray(value) ? value : [0, value];
    onFiltersChange({
      ...filters,
      cookingTime: max > 0 ? { min, max } : undefined,
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
    <Box sx={{ width: '100%', mb: 3 }}>
      {/* Main Search Bar */}
      <Box display="flex" gap={2} mb={2}>
        <TextField
          fullWidth
          placeholder="Search recipes, ingredients, or channels..."
          value={query}
          onChange={handleQueryChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: query && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClearSearch}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              backgroundColor: 'background.paper',
            },
          }}
        />
        
        <IconButton
          onClick={(event) => setFilterMenuAnchor(event.currentTarget)}
          color={hasActiveFilters ? 'primary' : 'default'}
          sx={{
            minWidth: 48,
            borderRadius: 3,
            backgroundColor: hasActiveFilters ? 'primary.light' : 'background.paper',
          }}
        >
          <FilterIcon />
        </IconButton>
      </Box>

      {/* Active Tags */}
      {filters.tags.length > 0 && (
        <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
          {filters.tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              onDelete={() => handleTagRemove(tag)}
              color="primary"
              variant="outlined"
              size="small"
            />
          ))}
        </Box>
      )}

      {/* Filter Menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
        PaperProps={{
          sx: { width: 320, maxHeight: 500 },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Filters</Typography>
            <IconButton
              size="small"
              onClick={() => setFilterMenuAnchor(null)}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          <Stack spacing={3}>
            {/* Channel Filter */}
            <FormControl fullWidth size="small">
              <InputLabel>Channel</InputLabel>
              <Select
                value={filters.channel || ''}
                onChange={(e) => handleChannelChange(e.target.value || null)}
                label="Channel"
              >
                <MenuItem value="">All Channels</MenuItem>
                {channels?.map((channel) => (
                  <MenuItem key={channel.id} value={channel.id}>
                    {channel.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Difficulty Filter */}
            <FormControl fullWidth size="small">
              <InputLabel>Difficulty</InputLabel>
              <Select
                value={filters.difficulty || ''}
                onChange={(e) => handleDifficultyChange(e.target.value || null)}
                label="Difficulty"
              >
                <MenuItem value="">Any Difficulty</MenuItem>
                {DIFFICULTY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Cooking Time Filter */}
            <Box>
              <Typography gutterBottom>Cooking Time</Typography>
              <Slider
                value={filters.cookingTime ? [filters.cookingTime.min, filters.cookingTime.max] : [0, 180]}
                onChange={handleCookingTimeChange}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value} min`}
                marks={COOKING_TIME_MARKS}
                min={0}
                max={180}
                step={15}
              />
            </Box>

            {/* Popular Tags */}
            <Box>
              <Typography gutterBottom>Popular Tags</Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {POPULAR_TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onClick={() => handleTagAdd(tag)}
                    variant={filters.tags.includes(tag) ? 'filled' : 'outlined'}
                    color={filters.tags.includes(tag) ? 'primary' : 'default'}
                    size="small"
                  />
                ))}
              </Box>
            </Box>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="outlined"
                onClick={handleClearFilters}
                startIcon={<ClearIcon />}
              >
                Clear All Filters
              </Button>
            )}
          </Stack>
        </Box>
      </Menu>
    </Box>
  );
};