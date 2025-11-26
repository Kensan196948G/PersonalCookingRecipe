const { Category, Recipe } = require('../models');

const categoryController = {
  // Get all categories
  getAllCategories: async (req, res) => {
    try {
      const categories = await Category.findAll({
        where: { userId: req.user.id },
        include: [
          {
            model: Category,
            as: 'subcategories',
            attributes: ['id', 'name', 'icon', 'color']
          },
          {
            model: Recipe,
            as: 'recipes',
            attributes: ['id']
          }
        ],
        order: [['name', 'ASC']]
      });

      const categoriesWithCount = categories.map(cat => ({
        ...cat.toJSON(),
        recipeCount: cat.recipes.length,
        recipes: undefined
      }));

      res.json({ categories: categoriesWithCount });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching categories', error: error.message });
    }
  },

  // Get category by ID with recipes
  getCategoryById: async (req, res) => {
    try {
      const category = await Category.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        },
        include: [
          {
            model: Recipe,
            as: 'recipes',
            attributes: ['id', 'title', 'description', 'imageUrl', 'difficulty', 'totalTime']
          },
          {
            model: Category,
            as: 'subcategories'
          }
        ]
      });

      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }

      res.json({ category });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching category', error: error.message });
    }
  },

  // Create new category
  createCategory: async (req, res) => {
    try {
      const categoryData = {
        ...req.body,
        userId: req.user.id
      };

      const category = await Category.create(categoryData);
      
      res.status(201).json({
        message: 'Category created successfully',
        category
      });
    } catch (error) {
      res.status(400).json({ message: 'Error creating category', error: error.message });
    }
  },

  // Update category
  updateCategory: async (req, res) => {
    try {
      const category = await Category.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }

      await category.update(req.body);

      res.json({
        message: 'Category updated successfully',
        category
      });
    } catch (error) {
      res.status(400).json({ message: 'Error updating category', error: error.message });
    }
  },

  // Delete category
  deleteCategory: async (req, res) => {
    try {
      // Check if category has recipes
      const category = await Category.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        },
        include: [{ model: Recipe, as: 'recipes' }]
      });

      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }

      if (category.recipes.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot delete category with recipes. Please move or delete recipes first.' 
        });
      }

      await category.destroy();

      res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting category', error: error.message });
    }
  }
};

module.exports = categoryController;