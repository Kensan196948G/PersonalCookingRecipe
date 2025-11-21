const { MealPlan, MealPlanItem, Recipe, ShoppingList } = require('../models');
const { Op } = require('sequelize');

const mealPlanController = {
  // Get all meal plans
  getAllMealPlans: async (req, res) => {
    try {
      const mealPlans = await MealPlan.findAll({
        where: { userId: req.user.id },
        include: [
          {
            model: MealPlanItem,
            as: 'items',
            include: [
              { model: Recipe, as: 'recipe', attributes: ['id', 'title', 'imageUrl'] }
            ]
          }
        ],
        order: [['start_date', 'DESC']]
      });

      res.json({ mealPlans });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching meal plans', error: error.message });
    }
  },

  // Get current week's meal plan
  getCurrentWeekPlan: async (req, res) => {
    try {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const mealPlan = await MealPlan.findOne({
        where: {
          userId: req.user.id,
          startDate: { [Op.lte]: endOfWeek },
          endDate: { [Op.gte]: startOfWeek }
        },
        include: [
          {
            model: MealPlanItem,
            as: 'items',
            include: [
              { model: Recipe, as: 'recipe' }
            ]
          }
        ]
      });

      res.json({ mealPlan });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching current week plan', error: error.message });
    }
  },

  // Get meal plan by ID
  getMealPlanById: async (req, res) => {
    try {
      const mealPlan = await MealPlan.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        },
        include: [
          {
            model: MealPlanItem,
            as: 'items',
            include: [
              { model: Recipe, as: 'recipe' }
            ]
          },
          {
            model: ShoppingList,
            as: 'shoppingList'
          }
        ]
      });

      if (!mealPlan) {
        return res.status(404).json({ message: 'Meal plan not found' });
      }

      res.json({ mealPlan });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching meal plan', error: error.message });
    }
  },

  // Create new meal plan
  createMealPlan: async (req, res) => {
    try {
      const mealPlanData = {
        ...req.body,
        userId: req.user.id
      };

      const mealPlan = await MealPlan.create(mealPlanData);
      
      res.status(201).json({
        message: 'Meal plan created successfully',
        mealPlan
      });
    } catch (error) {
      res.status(400).json({ message: 'Error creating meal plan', error: error.message });
    }
  },

  // Add recipe to meal plan
  addMealPlanItem: async (req, res) => {
    try {
      const { recipeId, date, mealType, servings, notes } = req.body;

      // Verify meal plan belongs to user
      const mealPlan = await MealPlan.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!mealPlan) {
        return res.status(404).json({ message: 'Meal plan not found' });
      }

      // Verify recipe exists and belongs to user
      const recipe = await Recipe.findOne({
        where: {
          id: recipeId,
          userId: req.user.id
        }
      });

      if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
      }

      const mealPlanItem = await MealPlanItem.create({
        mealPlanId: req.params.id,
        recipeId,
        date,
        mealType,
        servings,
        notes
      });

      const fullItem = await MealPlanItem.findByPk(mealPlanItem.id, {
        include: [{ model: Recipe, as: 'recipe' }]
      });

      res.status(201).json({
        message: 'Recipe added to meal plan',
        item: fullItem
      });
    } catch (error) {
      res.status(400).json({ message: 'Error adding recipe to meal plan', error: error.message });
    }
  },

  // Update meal plan item
  updateMealPlanItem: async (req, res) => {
    try {
      const item = await MealPlanItem.findOne({
        where: { id: req.params.itemId },
        include: [
          {
            model: MealPlan,
            as: 'mealPlan',
            where: { userId: req.user.id }
          }
        ]
      });

      if (!item) {
        return res.status(404).json({ message: 'Meal plan item not found' });
      }

      await item.update(req.body);

      res.json({
        message: 'Meal plan item updated',
        item
      });
    } catch (error) {
      res.status(400).json({ message: 'Error updating meal plan item', error: error.message });
    }
  },

  // Remove recipe from meal plan
  removeMealPlanItem: async (req, res) => {
    try {
      const item = await MealPlanItem.findOne({
        where: { id: req.params.itemId },
        include: [
          {
            model: MealPlan,
            as: 'mealPlan',
            where: { userId: req.user.id }
          }
        ]
      });

      if (!item) {
        return res.status(404).json({ message: 'Meal plan item not found' });
      }

      await item.destroy();

      res.json({ message: 'Recipe removed from meal plan' });
    } catch (error) {
      res.status(500).json({ message: 'Error removing recipe from meal plan', error: error.message });
    }
  },

  // Delete meal plan
  deleteMealPlan: async (req, res) => {
    try {
      const result = await MealPlan.destroy({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (result === 0) {
        return res.status(404).json({ message: 'Meal plan not found' });
      }

      res.json({ message: 'Meal plan deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting meal plan', error: error.message });
    }
  },

  // Generate shopping list from meal plan
  generateShoppingList: async (req, res) => {
    try {
      const mealPlan = await MealPlan.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        },
        include: [
          {
            model: MealPlanItem,
            as: 'items',
            include: [
              { model: Recipe, as: 'recipe' }
            ]
          }
        ]
      });

      if (!mealPlan) {
        return res.status(404).json({ message: 'Meal plan not found' });
      }

      // Aggregate ingredients from all recipes
      const ingredientMap = new Map();
      
      mealPlan.items.forEach(item => {
        if (item.recipe && item.recipe.ingredients) {
          item.recipe.ingredients.forEach(ingredient => {
            const key = ingredient.name.toLowerCase();
            if (ingredientMap.has(key)) {
              const existing = ingredientMap.get(key);
              // Simple aggregation - you might want to handle units properly
              existing.amount = `${existing.amount}, ${ingredient.amount}`;
              existing.recipes.push(item.recipe.title);
            } else {
              ingredientMap.set(key, {
                name: ingredient.name,
                amount: ingredient.amount,
                unit: ingredient.unit,
                category: ingredient.category || 'Other',
                recipes: [item.recipe.title],
                checked: false
              });
            }
          });
        }
      });

      const shoppingItems = Array.from(ingredientMap.values());

      // Create shopping list
      const shoppingList = await ShoppingList.create({
        name: `Shopping list for ${mealPlan.name}`,
        items: shoppingItems,
        mealPlanId: mealPlan.id,
        userId: req.user.id
      });

      res.status(201).json({
        message: 'Shopping list generated successfully',
        shoppingList
      });
    } catch (error) {
      res.status(500).json({ message: 'Error generating shopping list', error: error.message });
    }
  }
};

module.exports = mealPlanController;