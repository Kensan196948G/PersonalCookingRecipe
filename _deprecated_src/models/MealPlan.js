const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MealPlan = sequelize.define('MealPlan', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'start_date'
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'end_date'
  },
  notes: {
    type: DataTypes.TEXT
  },
  userId: {
    type: DataTypes.INTEGER,
    field: 'user_id',
    allowNull: false
  }
});

const MealPlanItem = sequelize.define('MealPlanItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  mealPlanId: {
    type: DataTypes.INTEGER,
    field: 'meal_plan_id',
    allowNull: false
  },
  recipeId: {
    type: DataTypes.INTEGER,
    field: 'recipe_id',
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  mealType: {
    type: DataTypes.ENUM('breakfast', 'lunch', 'dinner', 'snack'),
    field: 'meal_type',
    allowNull: false
  },
  servings: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  notes: {
    type: DataTypes.TEXT
  },
  isCompleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_completed'
  }
});

module.exports = { MealPlan, MealPlanItem };