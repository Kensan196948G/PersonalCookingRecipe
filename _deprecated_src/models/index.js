const { sequelize } = require('../config/database');
const User = require('./User');
const Recipe = require('./Recipe');
const Category = require('./Category');
const { MealPlan, MealPlanItem } = require('./MealPlan');
const ShoppingList = require('./ShoppingList');

// User associations
User.hasMany(Recipe, { foreignKey: 'user_id', as: 'recipes' });
User.hasMany(Category, { foreignKey: 'user_id', as: 'categories' });
User.hasMany(MealPlan, { foreignKey: 'user_id', as: 'mealPlans' });
User.hasMany(ShoppingList, { foreignKey: 'user_id', as: 'shoppingLists' });

// Recipe associations
Recipe.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Recipe.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Recipe.hasMany(MealPlanItem, { foreignKey: 'recipe_id', as: 'mealPlanItems' });

// Category associations
Category.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Category.hasMany(Recipe, { foreignKey: 'category_id', as: 'recipes' });
Category.belongsTo(Category, { foreignKey: 'parent_id', as: 'parent' });
Category.hasMany(Category, { foreignKey: 'parent_id', as: 'subcategories' });

// MealPlan associations
MealPlan.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
MealPlan.hasMany(MealPlanItem, { foreignKey: 'meal_plan_id', as: 'items' });
MealPlan.hasOne(ShoppingList, { foreignKey: 'meal_plan_id', as: 'shoppingList' });

// MealPlanItem associations
MealPlanItem.belongsTo(MealPlan, { foreignKey: 'meal_plan_id', as: 'mealPlan' });
MealPlanItem.belongsTo(Recipe, { foreignKey: 'recipe_id', as: 'recipe' });

// ShoppingList associations
ShoppingList.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
ShoppingList.belongsTo(MealPlan, { foreignKey: 'meal_plan_id', as: 'mealPlan' });

module.exports = {
  sequelize,
  User,
  Recipe,
  Category,
  MealPlan,
  MealPlanItem,
  ShoppingList
};