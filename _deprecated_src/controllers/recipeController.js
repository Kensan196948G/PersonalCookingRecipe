const { Recipe, Category, User } = require('../models');
const { Op } = require('sequelize');

const recipeController = {
  // Get all recipes with filters
  getAllRecipes: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        cuisine,
        difficulty,
        mealType,
        maxTime,
        vegetarian,
        vegan,
        glutenFree
      } = req.query;

      const where = { userId: req.user.id };
      
      if (category) where.categoryId = category;
      if (cuisine) where.cuisine = cuisine;
      if (difficulty) where.difficulty = difficulty;
      if (mealType) where.mealType = mealType;
      
      if (maxTime) {
        where[Op.or] = [
          { prepTime: { [Op.lte]: parseInt(maxTime) } },
          { cookTime: { [Op.lte]: parseInt(maxTime) } }
        ];
      }

      const dietaryFilters = {};
      if (vegetarian === 'true') dietaryFilters['dietaryInfo.vegetarian'] = true;
      if (vegan === 'true') dietaryFilters['dietaryInfo.vegan'] = true;
      if (glutenFree === 'true') dietaryFilters['dietaryInfo.glutenFree'] = true;

      const offset = (page - 1) * limit;
      
      const { count, rows } = await Recipe.findAndCountAll({
        where,
        include: [
          { model: Category, as: 'category', attributes: ['id', 'name', 'color'] }
        ],
        limit: parseInt(limit),
        offset,
        order: [['created_at', 'DESC']]
      });

      res.json({
        recipes: rows,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        totalRecipes: count
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching recipes', error: error.message });
    }
  },

  // Search recipes
  searchRecipes: async (req, res) => {
    try {
      const { q, fields = 'title,description,ingredients' } = req.query;
      
      if (!q) {
        return res.status(400).json({ message: 'Search query is required' });
      }

      const searchFields = fields.split(',');
      const orConditions = [];

      if (searchFields.includes('title')) {
        orConditions.push({ title: { [Op.like]: `%${q}%` } });
      }
      if (searchFields.includes('description')) {
        orConditions.push({ description: { [Op.like]: `%${q}%` } });
      }
      if (searchFields.includes('tags')) {
        orConditions.push({ tags: { [Op.like]: `%${q}%` } });
      }

      const recipes = await Recipe.findAll({
        where: {
          userId: req.user.id,
          [Op.or]: orConditions
        },
        include: [
          { model: Category, as: 'category', attributes: ['id', 'name'] }
        ],
        limit: 50
      });

      res.json({ recipes, count: recipes.length });
    } catch (error) {
      res.status(500).json({ message: 'Error searching recipes', error: error.message });
    }
  },

  // Get favorite recipes
  getFavorites: async (req, res) => {
    try {
      const recipes = await Recipe.findAll({
        where: {
          userId: req.user.id,
          isFavorite: true
        },
        include: [
          { model: Category, as: 'category', attributes: ['id', 'name', 'color'] }
        ],
        order: [['updated_at', 'DESC']]
      });

      res.json({ recipes });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching favorite recipes', error: error.message });
    }
  },

  // Get recipe by ID
  getRecipeById: async (req, res) => {
    try {
      const recipe = await Recipe.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        },
        include: [
          { model: Category, as: 'category' },
          { model: User, as: 'user', attributes: ['id', 'username'] }
        ]
      });

      if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
      }

      res.json({ recipe });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching recipe', error: error.message });
    }
  },

  // Create new recipe
  createRecipe: async (req, res) => {
    try {
      const recipeData = {
        ...req.body,
        userId: req.user.id
      };

      const recipe = await Recipe.create(recipeData);
      const fullRecipe = await Recipe.findByPk(recipe.id, {
        include: [{ model: Category, as: 'category' }]
      });

      res.status(201).json({ 
        message: 'Recipe created successfully',
        recipe: fullRecipe 
      });
    } catch (error) {
      res.status(400).json({ message: 'Error creating recipe', error: error.message });
    }
  },

  // Update recipe
  updateRecipe: async (req, res) => {
    try {
      const recipe = await Recipe.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
      }

      await recipe.update(req.body);
      
      const updatedRecipe = await Recipe.findByPk(recipe.id, {
        include: [{ model: Category, as: 'category' }]
      });

      res.json({ 
        message: 'Recipe updated successfully',
        recipe: updatedRecipe 
      });
    } catch (error) {
      res.status(400).json({ message: 'Error updating recipe', error: error.message });
    }
  },

  // Toggle favorite status
  toggleFavorite: async (req, res) => {
    try {
      const recipe = await Recipe.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
      }

      recipe.isFavorite = !recipe.isFavorite;
      await recipe.save();

      res.json({ 
        message: `Recipe ${recipe.isFavorite ? 'added to' : 'removed from'} favorites`,
        isFavorite: recipe.isFavorite 
      });
    } catch (error) {
      res.status(500).json({ message: 'Error updating favorite status', error: error.message });
    }
  },

  // Update times cooked
  updateTimesCooked: async (req, res) => {
    try {
      const recipe = await Recipe.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
      }

      recipe.timesCooked += 1;
      recipe.lastCooked = new Date();
      await recipe.save();

      res.json({ 
        message: 'Recipe cooked count updated',
        timesCooked: recipe.timesCooked,
        lastCooked: recipe.lastCooked
      });
    } catch (error) {
      res.status(500).json({ message: 'Error updating times cooked', error: error.message });
    }
  },

  // Delete recipe
  deleteRecipe: async (req, res) => {
    try {
      const result = await Recipe.destroy({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (result === 0) {
        return res.status(404).json({ message: 'Recipe not found' });
      }

      res.json({ message: 'Recipe deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting recipe', error: error.message });
    }
  },

  // Import recipes (JSON format)
  importRecipes: async (req, res) => {
    try {
      const { recipes } = req.body;
      
      if (!Array.isArray(recipes)) {
        return res.status(400).json({ message: 'Recipes must be an array' });
      }

      const importedRecipes = [];
      const errors = [];

      for (const [index, recipeData] of recipes.entries()) {
        try {
          const recipe = await Recipe.create({
            ...recipeData,
            userId: req.user.id
          });
          importedRecipes.push(recipe);
        } catch (error) {
          errors.push({ index, error: error.message });
        }
      }

      res.json({
        message: `Imported ${importedRecipes.length} recipes`,
        imported: importedRecipes.length,
        failed: errors.length,
        errors
      });
    } catch (error) {
      res.status(500).json({ message: 'Error importing recipes', error: error.message });
    }
  },

  // Export recipes
  exportRecipes: async (req, res) => {
    try {
      const { format = 'json' } = req.params;
      
      const recipes = await Recipe.findAll({
        where: { userId: req.user.id },
        include: [{ model: Category, as: 'category' }]
      });

      if (format === 'json') {
        res.json({ recipes, exportDate: new Date(), count: recipes.length });
      } else if (format === 'csv') {
        // Simple CSV export implementation
        const csv = recipes.map(r => 
          `"${r.title}","${r.description || ''}","${r.cuisine || ''}","${r.difficulty}","${r.servings}"`
        ).join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=recipes.csv');
        res.send(`Title,Description,Cuisine,Difficulty,Servings\n${csv}`);
      } else {
        res.status(400).json({ message: 'Unsupported export format' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Error exporting recipes', error: error.message });
    }
  }
};

module.exports = recipeController;