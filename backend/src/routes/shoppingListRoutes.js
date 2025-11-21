const express = require('express');
const router = express.Router();
const shoppingListController = require('../controllers/shoppingListController');
const { authenticate } = require('../middleware/auth');

// Get all shopping lists
router.get('/', authenticate, shoppingListController.getAllShoppingLists);

// Get active shopping list
router.get('/active', authenticate, shoppingListController.getActiveList);

// Get shopping list by ID
router.get('/:id', authenticate, shoppingListController.getShoppingListById);

// Create new shopping list
router.post('/', authenticate, shoppingListController.createShoppingList);

// Update shopping list
router.put('/:id', authenticate, shoppingListController.updateShoppingList);

// Toggle item completion
router.patch('/:id/items/:itemIndex/toggle', authenticate, shoppingListController.toggleItem);

// Mark list as completed
router.patch('/:id/complete', authenticate, shoppingListController.completeList);

// Delete shopping list
router.delete('/:id', authenticate, shoppingListController.deleteShoppingList);

module.exports = router;