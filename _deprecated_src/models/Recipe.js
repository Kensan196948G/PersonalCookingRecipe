const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Recipe = sequelize.define('Recipe', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 200]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ingredients: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    validate: {
      isValidIngredients(value) {
        if (!Array.isArray(value)) {
          throw new Error('Ingredients must be an array');
        }
        value.forEach(ingredient => {
          if (!ingredient.name || !ingredient.amount) {
            throw new Error('Each ingredient must have name and amount');
          }
        });
      }
    }
  },
  instructions: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    validate: {
      isValidInstructions(value) {
        if (!Array.isArray(value)) {
          throw new Error('Instructions must be an array');
        }
      }
    }
  },
  prepTime: {
    type: DataTypes.INTEGER,
    field: 'prep_time',
    comment: 'Preparation time in minutes'
  },
  cookTime: {
    type: DataTypes.INTEGER,
    field: 'cook_time',
    comment: 'Cooking time in minutes'
  },
  totalTime: {
    type: DataTypes.VIRTUAL,
    get() {
      return (this.prepTime || 0) + (this.cookTime || 0);
    }
  },
  servings: {
    type: DataTypes.INTEGER,
    defaultValue: 4,
    validate: {
      min: 1,
      max: 100
    }
  },
  difficulty: {
    type: DataTypes.ENUM('easy', 'medium', 'hard'),
    defaultValue: 'medium'
  },
  cuisine: {
    type: DataTypes.STRING
  },
  mealType: {
    type: DataTypes.ENUM('breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'beverage'),
    field: 'meal_type'
  },
  dietaryInfo: {
    type: DataTypes.JSON,
    field: 'dietary_info',
    defaultValue: {
      vegetarian: false,
      vegan: false,
      glutenFree: false,
      dairyFree: false,
      nutFree: false,
      lowCarb: false,
      keto: false
    }
  },
  nutrition: {
    type: DataTypes.JSON,
    defaultValue: {
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
      fiber: null,
      sugar: null,
      sodium: null
    }
  },
  imageUrl: {
    type: DataTypes.STRING,
    field: 'image_url',
    validate: {
      isUrl: true
    }
  },
  source: {
    type: DataTypes.STRING,
    comment: 'Original source of the recipe'
  },
  notes: {
    type: DataTypes.TEXT
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  rating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 5
    }
  },
  isFavorite: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_favorite'
  },
  timesCooked: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'times_cooked'
  },
  lastCooked: {
    type: DataTypes.DATE,
    field: 'last_cooked'
  },
  userId: {
    type: DataTypes.INTEGER,
    field: 'user_id',
    allowNull: false
  },
  categoryId: {
    type: DataTypes.INTEGER,
    field: 'category_id'
  }
}, {
  indexes: [
    {
      fields: ['title']
    },
    {
      fields: ['cuisine']
    },
    {
      fields: ['meal_type']
    },
    {
      fields: ['difficulty']
    },
    {
      fields: ['is_favorite']
    }
  ]
});

module.exports = Recipe;