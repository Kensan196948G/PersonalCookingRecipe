const jwt = require('jsonwebtoken');
const { User, Recipe, Category, MealPlan, ShoppingList } = require('../models');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

const userController = {
  // Register new user
  register: async (req, res) => {
    try {
      const { username, email, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        where: { 
          [require('sequelize').Op.or]: [{ email }, { username }] 
        }
      });

      if (existingUser) {
        return res.status(400).json({ 
          message: existingUser.email === email 
            ? 'Email already registered' 
            : 'Username already taken'
        });
      }

      // Create new user
      const user = await User.create({
        username,
        email,
        password,
        firstName,
        lastName
      });

      // Generate token
      const token = generateToken(user);

      // Create default categories for the user
      const defaultCategories = [
        { name: 'Breakfast', icon: '🍳', color: '#FF6B6B', userId: user.id },
        { name: 'Lunch', icon: '🥗', color: '#4ECDC4', userId: user.id },
        { name: 'Dinner', icon: '🍽️', color: '#45B7D1', userId: user.id },
        { name: 'Desserts', icon: '🍰', color: '#F7B731', userId: user.id },
        { name: 'Snacks', icon: '🍿', color: '#5F27CD', userId: user.id },
        { name: 'Drinks', icon: '🥤', color: '#00D2D3', userId: user.id }
      ];

      await Category.bulkCreate(defaultCategories);

      res.status(201).json({
        message: 'User registered successfully',
        user: user.toJSON(),
        token
      });
    } catch (error) {
      res.status(400).json({ message: 'Error registering user', error: error.message });
    }
  },

  // Login
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ where: { email } });
      
      if (!user || !(await user.validatePassword(password))) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: 'Account is deactivated' });
      }

      // Generate token
      const token = generateToken(user);

      // Save token in session if using sessions
      if (req.session) {
        req.session.token = token;
        req.session.userId = user.id;
      }

      res.json({
        message: 'Login successful',
        user: user.toJSON(),
        token
      });
    } catch (error) {
      res.status(500).json({ message: 'Error logging in', error: error.message });
    }
  },

  // Logout
  logout: async (req, res) => {
    try {
      if (req.session) {
        req.session.destroy();
      }
      res.json({ message: 'Logout successful' });
    } catch (error) {
      res.status(500).json({ message: 'Error logging out', error: error.message });
    }
  },

  // Get user profile
  getProfile: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['password'] },
        include: [
          { 
            model: Recipe, 
            as: 'recipes',
            attributes: ['id'],
            required: false
          },
          { 
            model: Category, 
            as: 'categories',
            attributes: ['id'],
            required: false
          },
          { 
            model: MealPlan, 
            as: 'mealPlans',
            attributes: ['id'],
            required: false
          }
        ]
      });

      const stats = {
        totalRecipes: user.recipes.length,
        totalCategories: user.categories.length,
        totalMealPlans: user.mealPlans.length
      };

      res.json({ 
        user: {
          ...user.toJSON(),
          recipes: undefined,
          categories: undefined,
          mealPlans: undefined
        },
        stats 
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching profile', error: error.message });
    }
  },

  // Update user profile
  updateProfile: async (req, res) => {
    try {
      const { firstName, lastName, preferences } = req.body;
      
      const user = await User.findByPk(req.user.id);
      
      if (firstName !== undefined) user.firstName = firstName;
      if (lastName !== undefined) user.lastName = lastName;
      if (preferences !== undefined) user.preferences = preferences;
      
      await user.save();

      res.json({ 
        message: 'Profile updated successfully',
        user: user.toJSON()
      });
    } catch (error) {
      res.status(400).json({ message: 'Error updating profile', error: error.message });
    }
  },

  // Change password
  changePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new passwords are required' });
      }

      const user = await User.findByPk(req.user.id);
      
      if (!(await user.validatePassword(currentPassword))) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      user.password = newPassword;
      await user.save();

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      res.status(400).json({ message: 'Error changing password', error: error.message });
    }
  },

  // Delete account
  deleteAccount: async (req, res) => {
    try {
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ message: 'Password is required to delete account' });
      }

      const user = await User.findByPk(req.user.id);
      
      if (!(await user.validatePassword(password))) {
        return res.status(401).json({ message: 'Password is incorrect' });
      }

      // Soft delete by deactivating the account
      user.isActive = false;
      await user.save();

      // Or hard delete if preferred
      // await user.destroy();

      if (req.session) {
        req.session.destroy();
      }

      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting account', error: error.message });
    }
  }
};

module.exports = userController;