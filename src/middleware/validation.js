const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

exports.validateRegister = [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidationErrors
];

exports.validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

exports.validateRecipe = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('instructions').trim().notEmpty().withMessage('Instructions are required'),
  body('servings').optional().isInt({ min: 1 }).withMessage('Servings must be a positive number'),
  body('prep_time').optional().isInt({ min: 0 }).withMessage('Prep time must be non-negative'),
  body('cook_time').optional().isInt({ min: 0 }).withMessage('Cook time must be non-negative'),
  body('difficulty').optional().isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty level'),
  handleValidationErrors
];

exports.validateCategory = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Invalid color format'),
  handleValidationErrors
];

exports.validatePasswordChange = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  handleValidationErrors
];