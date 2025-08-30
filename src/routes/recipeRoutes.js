const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');
const { authenticate } = require('../middleware/auth');
const { validateRecipe } = require('../middleware/validation');

// Get all recipes with filters
router.get('/', authenticate, recipeController.getAllRecipes);

// Search recipes
router.get('/search', authenticate, recipeController.searchRecipes);

// Get favorite recipes
router.get('/favorites', authenticate, recipeController.getFavorites);

// Get recipe by ID
router.get('/:id', authenticate, recipeController.getRecipeById);

// Create new recipe
router.post('/', authenticate, validateRecipe, recipeController.createRecipe);

// Update recipe
router.put('/:id', authenticate, validateRecipe, recipeController.updateRecipe);

// Toggle favorite status
router.patch('/:id/favorite', authenticate, recipeController.toggleFavorite);

// Update times cooked
router.patch('/:id/cooked', authenticate, recipeController.updateTimesCooked);

// Delete recipe
router.delete('/:id', authenticate, recipeController.deleteRecipe);

// Bulk import recipes
router.post('/import', authenticate, recipeController.importRecipes);

// Export recipes
router.get('/export/:format', authenticate, recipeController.exportRecipes);

module.exports = router;