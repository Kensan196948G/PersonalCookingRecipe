const express = require('express');
const router = express.Router();
const mealPlanController = require('../controllers/mealPlanController');
const { authenticate } = require('../middleware/auth');
const { validateMealPlan } = require('../middleware/validation');

// Get all meal plans
router.get('/', authenticate, mealPlanController.getAllMealPlans);

// Get current week's meal plan
router.get('/current-week', authenticate, mealPlanController.getCurrentWeekPlan);

// Get meal plan by ID
router.get('/:id', authenticate, mealPlanController.getMealPlanById);

// Create new meal plan
router.post('/', authenticate, validateMealPlan, mealPlanController.createMealPlan);

// Add recipe to meal plan
router.post('/:id/items', authenticate, mealPlanController.addMealPlanItem);

// Update meal plan item
router.put('/:id/items/:itemId', authenticate, mealPlanController.updateMealPlanItem);

// Remove recipe from meal plan
router.delete('/:id/items/:itemId', authenticate, mealPlanController.removeMealPlanItem);

// Delete meal plan
router.delete('/:id', authenticate, mealPlanController.deleteMealPlan);

// Generate shopping list from meal plan
router.post('/:id/shopping-list', authenticate, mealPlanController.generateShoppingList);

module.exports = router;