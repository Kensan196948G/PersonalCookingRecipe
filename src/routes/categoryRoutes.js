const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { requireAuth } = require('../middleware/unifiedAuth');
const { validateCategory } = require('../middleware/validation');

// Public routes
router.get('/', categoryController.getCategories);
router.get('/:id', categoryController.getCategory);

// Protected routes
router.post('/', requireAuth, validateCategory, categoryController.createCategory);
router.put('/:id', requireAuth, validateCategory, categoryController.updateCategory);
router.delete('/:id', requireAuth, categoryController.deleteCategory);

module.exports = router;