import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Tab,
  Tabs,
  Grid,
  Chip,
  IconButton,
  Button,
  Avatar,
  Divider,
  Alert,
  Breadcrumbs,
  Link,
  Skeleton,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Share as ShareIcon,
  Print as PrintIcon,
  AccessTime as TimeIcon,
  Group as ServingsIcon,
  Star as DifficultyIcon,
  Restaurant as IngredientIcon,
  List as StepsIcon,
  PlayArrow as VideoIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { VideoPlayer } from '@/components/RecipeDetail/VideoPlayer';
import { IngredientsList } from '@/components/RecipeDetail/IngredientsList';
import { RecipeSteps } from '@/components/RecipeDetail/RecipeSteps';
import { useRecipe, useFavoriteRecipes } from '@/hooks/useRecipes';
import { ErrorBoundary } from '@/components/Common/ErrorBoundary';
import { format } from 'date-fns';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`recipe-tabpanel-${index}`}
      aria-labelledby={`recipe-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

export const RecipeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [servings, setServings] = useState(4);

  const { recipe, isLoading, error } = useRecipe(id!);
  const { isFavorite, toggleFavorite } = useFavoriteRecipes();

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleShare = async () => {
    if (navigator.share && recipe) {
      try {
        await navigator.share({
          title: recipe.title,
          text: recipe.description,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'success';
      case 'medium': return 'warning';
      case 'hard': return 'error';
      default: return 'default';
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Skeleton variant="rectangular" height={400} sx={{ mb: 3, borderRadius: 2 }} />
        <Skeleton variant="text" height={40} sx={{ mb: 2 }} />
        <Skeleton variant="text" height={24} width="60%" sx={{ mb: 3 }} />
        <Box display="flex" gap={2}>
          <Skeleton variant="rectangular" width={100} height={32} />
          <Skeleton variant="rectangular" width={100} height={32} />
          <Skeleton variant="rectangular" width={100} height={32} />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Alert severity="error">
          <Typography variant="h6">Recipe not found</Typography>
          <Typography variant="body2">
            The recipe you're looking for doesn't exist or has been removed.
          </Typography>
          <Button
            variant="outlined"
            onClick={handleBack}
            sx={{ mt: 2 }}
          >
            Go Back
          </Button>
        </Alert>
      </Container>
    );
  }

  if (!recipe) {
    return null;
  }

  // Update servings based on recipe data
  if (servings !== recipe.servings && recipe.servings > 0) {
    setServings(recipe.servings);
  }

  return (
    <ErrorBoundary>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            component="button"
            variant="body2"
            onClick={handleBack}
            sx={{ textDecoration: 'none' }}
          >
            Recipes
          </Link>
          <Typography variant="body2" color="text.primary">
            {recipe.title}
          </Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <IconButton onClick={handleBack}>
            <BackIcon />
          </IconButton>
          <Typography variant="h3" component="h1" sx={{ flexGrow: 1 }}>
            {recipe.title}
          </Typography>
          
          <Box display="flex" gap={1}>
            <IconButton
              onClick={() => toggleFavorite(recipe.id)}
              color={isFavorite(recipe.id) ? 'error' : 'default'}
            >
              {isFavorite(recipe.id) ? <FavoriteIcon /> : <FavoriteBorderIcon />}
            </IconButton>
            <IconButton onClick={handleShare}>
              <ShareIcon />
            </IconButton>
            <IconButton onClick={handlePrint}>
              <PrintIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Video Player */}
        <Paper sx={{ mb: 4, overflow: 'hidden', borderRadius: 3 }}>
          <VideoPlayer
            videoId={recipe.videoId}
            title={recipe.title}
            height={400}
          />
        </Paper>

        {/* Recipe Info */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              {/* Channel Info */}
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Avatar sx={{ width: 40, height: 40 }}>
                  {recipe.channelName.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {recipe.channelName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Published {format(new Date(recipe.publishedAt), 'MMM dd, yyyy')}
                  </Typography>
                </Box>
              </Box>

              {/* Description */}
              <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.6 }}>
                {recipe.description}
              </Typography>

              {/* Tags */}
              <Box display="flex" flexWrap="wrap" gap={1}>
                {recipe.tags.map((tag) => (
                  <Chip key={tag} label={tag} variant="outlined" size="small" />
                ))}
              </Box>
            </Grid>

            <Grid item xs={12} md={4}>
              {/* Recipe Stats */}
              <Box display="flex" flexDirection="column" gap={2}>
                <Box display="flex" alignItems="center" gap={2}>
                  <TimeIcon color="action" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Cooking Time
                    </Typography>
                    <Typography variant="h6">
                      {recipe.cookingTime} minutes
                    </Typography>
                  </Box>
                </Box>

                <Box display="flex" alignItems="center" gap={2}>
                  <ServingsIcon color="action" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Servings
                    </Typography>
                    <Typography variant="h6">
                      {recipe.servings}
                    </Typography>
                  </Box>
                </Box>

                <Box display="flex" alignItems="center" gap={2}>
                  <DifficultyIcon color="action" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Difficulty
                    </Typography>
                    <Chip
                      label={recipe.difficulty}
                      color={getDifficultyColor(recipe.difficulty) as any}
                      variant="filled"
                    />
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Tabs */}
        <Paper sx={{ width: '100%' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab 
              icon={<IngredientIcon />} 
              label={`Ingredients (${recipe.ingredients.length})`}
              iconPosition="start"
            />
            <Tab 
              icon={<StepsIcon />} 
              label={`Steps (${recipe.steps.length})`}
              iconPosition="start"
            />
            <Tab 
              icon={<VideoIcon />} 
              label="Video"
              iconPosition="start"
            />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            <IngredientsList
              ingredients={recipe.ingredients}
              servings={servings}
              onServingsChange={setServings}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <RecipeSteps
              steps={recipe.steps}
              autoPlay={false}
              showImages={true}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <Box sx={{ maxWidth: 800, mx: 'auto' }}>
              <VideoPlayer
                videoId={recipe.videoId}
                title={recipe.title}
                height={450}
                autoPlay={true}
              />
              <Box mt={3}>
                <Typography variant="h6" gutterBottom>
                  Watch the full recipe video
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Follow along with the video for the best cooking experience.
                  You can also use the ingredients and steps tabs for text-based instructions.
                </Typography>
              </Box>
            </Box>
          </TabPanel>
        </Paper>
      </Container>
    </ErrorBoundary>
  );
};