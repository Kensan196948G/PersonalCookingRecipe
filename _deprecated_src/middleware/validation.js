const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateRecipe = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters'),
  body('ingredients')
    .isArray().withMessage('Ingredients must be an array')
    .notEmpty().withMessage('At least one ingredient is required'),
  body('instructions')
    .isArray().withMessage('Instructions must be an array')
    .notEmpty().withMessage('At least one instruction is required'),
  body('servings')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Servings must be between 1 and 100'),
  body('prepTime')
    .optional()
    .isInt({ min: 0 }).withMessage('Prep time must be a positive number'),
  body('cookTime')
    .optional()
    .isInt({ min: 0 }).withMessage('Cook time must be a positive number'),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard']).withMessage('Difficulty must be easy, medium, or hard'),
  body('mealType')
    .optional()
    .isIn(['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'beverage'])
    .withMessage('Invalid meal type'),
  handleValidationErrors
];

const validateUser = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
    .matches(/\d/).withMessage('Password must contain at least one number'),
  handleValidationErrors
];

const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

const validateCategory = [
  body('name')
    .trim()
    .notEmpty().withMessage('Category name is required')
    .isLength({ min: 1, max: 50 }).withMessage('Category name must be between 1 and 50 characters'),
  handleValidationErrors
];

const validateMealPlan = [
  body('name')
    .trim()
    .notEmpty().withMessage('Meal plan name is required'),
  body('startDate')
    .notEmpty().withMessage('Start date is required')
    .isISO8601().withMessage('Start date must be a valid date'),
  body('endDate')
    .notEmpty().withMessage('End date is required')
    .isISO8601().withMessage('End date must be a valid date'),
  handleValidationErrors
];

module.exports = {
  validateRecipe,
  validateUser,
  validateLogin,
  validateCategory,
  validateMealPlan,
  handleValidationErrors
};