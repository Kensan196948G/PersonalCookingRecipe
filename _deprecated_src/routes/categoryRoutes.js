const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticate } = require('../middleware/auth');
const { validateCategory } = require('../middleware/validation');

// Get all categories
router.get('/', authenticate, categoryController.getAllCategories);

// Get category by ID with recipes
router.get('/:id', authenticate, categoryController.getCategoryById);

// Create new category
router.post('/', authenticate, validateCategory, categoryController.createCategory);

// Update category
router.put('/:id', authenticate, validateCategory, categoryController.updateCategory);

// Delete category
router.delete('/:id', authenticate, categoryController.deleteCategory);

module.exports = router;