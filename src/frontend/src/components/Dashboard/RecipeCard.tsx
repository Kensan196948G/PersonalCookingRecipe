import React from 'react';
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Avatar,
  CardActions,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  AccessTime as TimeIcon,
  Group as ServingsIcon,
  Star as DifficultyIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  PlayArrow as PlayIcon,
  Visibility as ViewIcon,
  ThumbUp as LikeIcon,
} from '@mui/icons-material';
import { Recipe } from '@/types';
import { formatDistanceToNow, format } from 'date-fns';
import { useFavoriteRecipes } from '@/hooks/useRecipes';

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
      case 'easy': return 'success';
      case 'medium': return 'warning';
      case 'hard': return 'error';
      default: return 'default';
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
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 3,
        },
      }}
      onClick={handleClick}
    >
      {/* Video Thumbnail */}
      <Box sx={{ position: 'relative' }}>
        <CardMedia
          component="img"
          height={isCompact ? 140 : 200}
          image={recipe.thumbnailUrl}
          alt={recipe.title}
          sx={{
            objectFit: 'cover',
          }}
        />
        
        {/* Play Button Overlay */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.8,
          }}
        >
          <IconButton
            sx={{
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
              },
            }}
          >
            <PlayIcon />
          </IconButton>
        </Box>

        {/* Duration Badge */}
        <Chip
          label={formatDuration(recipe.duration)}
          size="small"
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            fontSize: '0.75rem',
          }}
        />

        {/* Favorite Button */}
        <IconButton
          onClick={handleFavoriteClick}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 1)',
            },
          }}
          size="small"
        >
          {isFavorite(recipe.id) ? (
            <FavoriteIcon color="error" />
          ) : (
            <FavoriteBorderIcon />
          )}
        </IconButton>
      </Box>

      {/* Content */}
      <CardContent sx={{ flexGrow: 1, pb: isCompact ? 1 : 2 }}>
        {/* Channel Info */}
        {showChannel && (
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Avatar
              src={recipe.channelName} // You might want to add channelAvatar to Recipe type
              sx={{ width: 24, height: 24 }}
            >
              {recipe.channelName.charAt(0)}
            </Avatar>
            <Typography variant="caption" color="text.secondary">
              {recipe.channelName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              • {formatDistanceToNow(new Date(recipe.publishedAt))} ago
            </Typography>
          </Box>
        )}

        {/* Title */}
        <Typography
          variant={isCompact ? "subtitle2" : "h6"}
          component="h3"
          sx={{
            fontWeight: 600,
            mb: 1,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {recipe.title}
        </Typography>

        {/* Description */}
        {!isCompact && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {recipe.description}
          </Typography>
        )}

        {/* Recipe Info */}
        <Box display="flex" flexWrap="wrap" gap={1} mb={1}>
          {recipe.cookingTime && (
            <Chip
              icon={<TimeIcon />}
              label={`${recipe.cookingTime}min`}
              size="small"
              variant="outlined"
            />
          )}
          
          {recipe.servings && (
            <Chip
              icon={<ServingsIcon />}
              label={`${recipe.servings} servings`}
              size="small"
              variant="outlined"
            />
          )}
          
          <Chip
            icon={<DifficultyIcon />}
            label={recipe.difficulty}
            size="small"
            color={getDifficultyColor(recipe.difficulty) as any}
            variant="outlined"
          />
        </Box>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <Box display="flex" flexWrap="wrap" gap={0.5} mb={1}>
            {recipe.tags.slice(0, 3).map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant="filled"
                sx={{
                  fontSize: '0.7rem',
                  height: 20,
                }}
              />
            ))}
            {recipe.tags.length > 3 && (
              <Typography variant="caption" color="text.secondary">
                +{recipe.tags.length - 3} more
              </Typography>
            )}
          </Box>
        )}
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ justifyContent: 'space-between', pt: 0 }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Box display="flex" alignItems="center" gap={0.5}>
            <ViewIcon fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary">
              {formatViewCount(recipe.viewCount)}
            </Typography>
          </Box>
          
          {recipe.likeCount > 0 && (
            <Box display="flex" alignItems="center" gap={0.5}>
              <LikeIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {formatViewCount(recipe.likeCount)}
              </Typography>
            </Box>
          )}
        </Box>
        
        <Typography variant="caption" color="text.secondary">
          {format(new Date(recipe.publishedAt), 'MMM dd, yyyy')}
        </Typography>
      </CardActions>
    </Card>
  );
};