const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { validateUser, validateLogin } = require('../middleware/validation');

// Register new user
router.post('/register', validateUser, userController.register);

// Login
router.post('/login', validateLogin, userController.login);

// Logout
router.post('/logout', authenticate, userController.logout);

// Get current user profile
router.get('/profile', authenticate, userController.getProfile);

// Update user profile
router.put('/profile', authenticate, userController.updateProfile);

// Change password
router.post('/change-password', authenticate, userController.changePassword);

// Delete account
router.delete('/account', authenticate, userController.deleteAccount);

module.exports = router;