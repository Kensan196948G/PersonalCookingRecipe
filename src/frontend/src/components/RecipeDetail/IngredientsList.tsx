import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Paper,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  ShoppingCart as ShoppingCartIcon,
  Restaurant as RestaurantIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ContentCopy as CopyIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { Ingredient } from '@/types';

interface IngredientsListProps {
  ingredients: Ingredient[];
  servings: number;
  onServingsChange?: (servings: number) => void;
}

export const IngredientsList: React.FC<IngredientsListProps> = ({
  ingredients,
  servings,
  onServingsChange,
}) => {
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [currentServings, setCurrentServings] = useState(servings);

  // Group ingredients by category
  const ingredientsByCategory = ingredients.reduce((acc, ingredient) => {
    const category = ingredient.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(ingredient);
    return acc;
  }, {} as Record<string, Ingredient[]>);

  const handleIngredientCheck = (ingredientId: string) => {
    const newChecked = new Set(checkedIngredients);
    if (newChecked.has(ingredientId)) {
      newChecked.delete(ingredientId);
    } else {
      newChecked.add(ingredientId);
    }
    setCheckedIngredients(newChecked);
  };

  const handleCategoryToggle = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleServingsChange = (delta: number) => {
    const newServings = Math.max(1, currentServings + delta);
    setCurrentServings(newServings);
    onServingsChange?.(newServings);
  };

  const calculateScaledAmount = (ingredient: Ingredient) => {
    if (!ingredient.amount) return ingredient.amount;
    
    const multiplier = currentServings / servings;
    const amount = parseFloat(ingredient.amount);
    
    if (isNaN(amount)) return ingredient.amount;
    
    const scaledAmount = amount * multiplier;
    
    // Format the scaled amount nicely
    if (scaledAmount < 1 && scaledAmount > 0) {
      // Convert to fractions for small amounts
      if (scaledAmount === 0.5) return '1/2';
      if (scaledAmount === 0.25) return '1/4';
      if (scaledAmount === 0.75) return '3/4';
      if (scaledAmount === 0.33) return '1/3';
      if (scaledAmount === 0.67) return '2/3';
      return scaledAmount.toFixed(2);
    }
    
    return scaledAmount % 1 === 0 ? scaledAmount.toString() : scaledAmount.toFixed(1);
  };

  const handleCopyIngredients = () => {
    const ingredientText = ingredients
      .map(ingredient => {
        const amount = calculateScaledAmount(ingredient);
        return `• ${amount} ${ingredient.unit} ${ingredient.name}`;
      })
      .join('\n');
    
    navigator.clipboard.writeText(`Ingredients (${currentServings} servings):\n\n${ingredientText}`);
  };

  const handleShareIngredients = () => {
    if (navigator.share) {
      const ingredientText = ingredients
        .map(ingredient => {
          const amount = calculateScaledAmount(ingredient);
          return `• ${amount} ${ingredient.unit} ${ingredient.name}`;
        })
        .join('\n');
      
      navigator.share({
        title: 'Recipe Ingredients',
        text: `Ingredients (${currentServings} servings):\n\n${ingredientText}`,
      });
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <RestaurantIcon color="primary" />
          <Typography variant="h5" component="h2">
            Ingredients
          </Typography>
        </Box>
        
        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip title="Copy ingredients">
            <IconButton onClick={handleCopyIngredients} size="small">
              <CopyIcon />
            </IconButton>
          </Tooltip>
          
          {navigator.share && (
            <Tooltip title="Share ingredients">
              <IconButton onClick={handleShareIngredients} size="small">
                <ShareIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Servings Adjuster */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Typography variant="body2">Servings:</Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton
            size="small"
            onClick={() => handleServingsChange(-1)}
            disabled={currentServings <= 1}
          >
            -
          </IconButton>
          <Typography variant="h6" sx={{ minWidth: 20, textAlign: 'center' }}>
            {currentServings}
          </Typography>
          <IconButton
            size="small"
            onClick={() => handleServingsChange(1)}
          >
            +
          </IconButton>
        </Box>
        {currentServings !== servings && (
          <Chip
            label={`Original: ${servings}`}
            size="small"
            variant="outlined"
          />
        )}
      </Box>

      {/* Progress Indicator */}
      {checkedIngredients.size > 0 && (
        <Box mb={2}>
          <Typography variant="body2" color="text.secondary">
            {checkedIngredients.size} of {ingredients.length} ingredients checked
          </Typography>
        </Box>
      )}

      {/* Ingredients by Category */}
      {Object.entries(ingredientsByCategory).map(([category, categoryIngredients]) => {
        const isExpanded = expandedCategories.has(category) || Object.keys(ingredientsByCategory).length === 1;
        
        return (
          <Box key={category} mb={2}>
            {/* Category Header */}
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              sx={{
                cursor: 'pointer',
                p: 1,
                borderRadius: 1,
                backgroundColor: 'action.hover',
                mb: 1,
              }}
              onClick={() => handleCategoryToggle(category)}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {category}
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Chip
                  label={categoryIngredients.length}
                  size="small"
                  variant="outlined"
                />
                {Object.keys(ingredientsByCategory).length > 1 && (
                  isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />
                )}
              </Box>
            </Box>

            {/* Category Ingredients */}
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <List dense>
                {categoryIngredients.map((ingredient) => {
                  const isChecked = checkedIngredients.has(ingredient.id);
                  const amount = calculateScaledAmount(ingredient);
                  
                  return (
                    <ListItem
                      key={ingredient.id}
                      sx={{
                        pl: 0,
                        opacity: isChecked ? 0.6 : 1,
                        textDecoration: isChecked ? 'line-through' : 'none',
                      }}
                    >
                      <ListItemIcon>
                        <Checkbox
                          edge="start"
                          checked={isChecked}
                          onChange={() => handleIngredientCheck(ingredient.id)}
                          size="small"
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography
                              variant="body1"
                              sx={{
                                fontWeight: isChecked ? 'normal' : 500,
                              }}
                            >
                              {amount} {ingredient.unit} {ingredient.name}
                            </Typography>
                            {ingredient.optional && (
                              <Chip
                                label="optional"
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem', height: 20 }}
                              />
                            )}
                          </Box>
                        }
                        secondary={ingredient.notes}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Collapse>
            
            {category !== Object.keys(ingredientsByCategory)[Object.keys(ingredientsByCategory).length - 1] && (
              <Divider sx={{ my: 2 }} />
            )}
          </Box>
        );
      })}

      {/* Shopping List Button */}
      {checkedIngredients.size < ingredients.length && (
        <Box mt={3}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Tip: Check off ingredients as you prepare them
          </Typography>
        </Box>
      )}
    </Paper>
  );
};