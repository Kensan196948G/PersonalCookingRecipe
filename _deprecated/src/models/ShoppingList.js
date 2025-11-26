const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ShoppingList = sequelize.define('ShoppingList', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  items: {
    type: DataTypes.JSON,
    defaultValue: [],
    validate: {
      isValidItems(value) {
        if (!Array.isArray(value)) {
          throw new Error('Items must be an array');
        }
      }
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'archived'),
    defaultValue: 'active'
  },
  completedAt: {
    type: DataTypes.DATE,
    field: 'completed_at'
  },
  mealPlanId: {
    type: DataTypes.INTEGER,
    field: 'meal_plan_id'
  },
  userId: {
    type: DataTypes.INTEGER,
    field: 'user_id',
    allowNull: false
  }
});

module.exports = ShoppingList;