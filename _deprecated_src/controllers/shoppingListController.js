const { ShoppingList, MealPlan } = require('../models');

const shoppingListController = {
  // Get all shopping lists
  getAllShoppingLists: async (req, res) => {
    try {
      const shoppingLists = await ShoppingList.findAll({
        where: { userId: req.user.id },
        include: [
          {
            model: MealPlan,
            as: 'mealPlan',
            attributes: ['id', 'name', 'startDate', 'endDate']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      res.json({ shoppingLists });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching shopping lists', error: error.message });
    }
  },

  // Get active shopping list
  getActiveList: async (req, res) => {
    try {
      const activeList = await ShoppingList.findOne({
        where: {
          userId: req.user.id,
          status: 'active'
        },
        include: [
          {
            model: MealPlan,
            as: 'mealPlan',
            attributes: ['id', 'name']
          }
        ]
      });

      res.json({ shoppingList: activeList });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching active shopping list', error: error.message });
    }
  },

  // Get shopping list by ID
  getShoppingListById: async (req, res) => {
    try {
      const shoppingList = await ShoppingList.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        },
        include: [
          {
            model: MealPlan,
            as: 'mealPlan'
          }
        ]
      });

      if (!shoppingList) {
        return res.status(404).json({ message: 'Shopping list not found' });
      }

      res.json({ shoppingList });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching shopping list', error: error.message });
    }
  },

  // Create new shopping list
  createShoppingList: async (req, res) => {
    try {
      const { name, items, mealPlanId } = req.body;

      // If mealPlanId provided, verify it belongs to user
      if (mealPlanId) {
        const mealPlan = await MealPlan.findOne({
          where: {
            id: mealPlanId,
            userId: req.user.id
          }
        });

        if (!mealPlan) {
          return res.status(404).json({ message: 'Meal plan not found' });
        }
      }

      const shoppingList = await ShoppingList.create({
        name,
        items: items || [],
        mealPlanId,
        userId: req.user.id
      });

      res.status(201).json({
        message: 'Shopping list created successfully',
        shoppingList
      });
    } catch (error) {
      res.status(400).json({ message: 'Error creating shopping list', error: error.message });
    }
  },

  // Update shopping list
  updateShoppingList: async (req, res) => {
    try {
      const shoppingList = await ShoppingList.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!shoppingList) {
        return res.status(404).json({ message: 'Shopping list not found' });
      }

      await shoppingList.update(req.body);

      res.json({
        message: 'Shopping list updated successfully',
        shoppingList
      });
    } catch (error) {
      res.status(400).json({ message: 'Error updating shopping list', error: error.message });
    }
  },

  // Toggle item completion
  toggleItem: async (req, res) => {
    try {
      const shoppingList = await ShoppingList.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!shoppingList) {
        return res.status(404).json({ message: 'Shopping list not found' });
      }

      const itemIndex = parseInt(req.params.itemIndex);
      const items = shoppingList.items;

      if (itemIndex < 0 || itemIndex >= items.length) {
        return res.status(400).json({ message: 'Invalid item index' });
      }

      items[itemIndex].checked = !items[itemIndex].checked;
      shoppingList.items = items;
      await shoppingList.save();

      res.json({
        message: 'Item toggled successfully',
        item: items[itemIndex]
      });
    } catch (error) {
      res.status(500).json({ message: 'Error toggling item', error: error.message });
    }
  },

  // Mark list as completed
  completeList: async (req, res) => {
    try {
      const shoppingList = await ShoppingList.findOne({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (!shoppingList) {
        return res.status(404).json({ message: 'Shopping list not found' });
      }

      shoppingList.status = 'completed';
      shoppingList.completedAt = new Date();
      await shoppingList.save();

      res.json({
        message: 'Shopping list marked as completed',
        shoppingList
      });
    } catch (error) {
      res.status(500).json({ message: 'Error completing shopping list', error: error.message });
    }
  },

  // Delete shopping list
  deleteShoppingList: async (req, res) => {
    try {
      const result = await ShoppingList.destroy({
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      });

      if (result === 0) {
        return res.status(404).json({ message: 'Shopping list not found' });
      }

      res.json({ message: 'Shopping list deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting shopping list', error: error.message });
    }
  }
};

module.exports = shoppingListController;