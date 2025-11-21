const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT
  },
  icon: {
    type: DataTypes.STRING,
    comment: 'Icon name or emoji for the category'
  },
  color: {
    type: DataTypes.STRING,
    comment: 'Color code for UI display'
  },
  parentId: {
    type: DataTypes.INTEGER,
    field: 'parent_id',
    references: {
      model: 'Categories',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    field: 'user_id',
    allowNull: false
  }
});

module.exports = Category;