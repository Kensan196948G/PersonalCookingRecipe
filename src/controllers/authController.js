const User = require('../models/User');
const { generateToken, generateRefreshToken, blacklistToken } = require('../middleware/unifiedAuth');
const { ERROR_CODES, createSuccessResponse, createErrorResponse } = require('../utils/errorCodes');

// Token generation moved to unified auth middleware

exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(ERROR_CODES.USER_ALREADY_EXISTS.status).json(
        createErrorResponse(ERROR_CODES.USER_ALREADY_EXISTS)
      );
    }
    
    // Create user
    const user = await User.create({ username, email, password });
    
    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      username: user.username
    };
    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    
    res.status(201).json(
      createSuccessResponse({
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        accessToken,
        refreshToken
      }, 'User registered successfully')
    );
  } catch (error) {
    console.error('Registration error:', error);
    res.status(ERROR_CODES.INTERNAL_SERVER_ERROR.status).json(
      createErrorResponse(ERROR_CODES.INTERNAL_SERVER_ERROR, error.message)
    );
  }
};

exports.login = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(ERROR_CODES.USER_INVALID_CREDENTIALS.status).json(
        createErrorResponse(ERROR_CODES.USER_INVALID_CREDENTIALS)
      );
    }
    
    // Validate password
    const isValid = await User.validatePassword(password, user.password);
    if (!isValid) {
      return res.status(ERROR_CODES.USER_INVALID_CREDENTIALS.status).json(
        createErrorResponse(ERROR_CODES.USER_INVALID_CREDENTIALS)
      );
    }
    
    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      username: user.username
    };
    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    
    const responseTime = Date.now() - startTime;
    console.log(`Login completed in ${responseTime}ms`);
    
    res.json(
      createSuccessResponse({
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        accessToken,
        refreshToken
      }, 'Login successful')
    );
  } catch (error) {
    console.error('Login error:', error);
    res.status(ERROR_CODES.INTERNAL_SERVER_ERROR.status).json(
      createErrorResponse(ERROR_CODES.INTERNAL_SERVER_ERROR, error.message)
    );
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(ERROR_CODES.USER_NOT_FOUND.status).json(
        createErrorResponse(ERROR_CODES.USER_NOT_FOUND)
      );
    }
    
    res.json(
      createSuccessResponse({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      })
    );
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(ERROR_CODES.INTERNAL_SERVER_ERROR.status).json(
      createErrorResponse(ERROR_CODES.INTERNAL_SERVER_ERROR, error.message)
    );
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { username, email } = req.body;
    const updated = await User.update(req.user.id, { username, email });
    
    if (!updated) {
      return res.status(ERROR_CODES.USER_NOT_FOUND.status).json(
        createErrorResponse(ERROR_CODES.USER_NOT_FOUND)
      );
    }
    
    res.json(
      createSuccessResponse(null, 'Profile updated successfully')
    );
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(ERROR_CODES.INTERNAL_SERVER_ERROR.status).json(
      createErrorResponse(ERROR_CODES.INTERNAL_SERVER_ERROR, error.message)
    );
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(ERROR_CODES.USER_NOT_FOUND.status).json(
        createErrorResponse(ERROR_CODES.USER_NOT_FOUND)
      );
    }
    
    // Validate current password
    const fullUser = await User.findByEmail(user.email);
    const isValid = await User.validatePassword(currentPassword, fullUser.password);
    if (!isValid) {
      return res.status(ERROR_CODES.USER_INVALID_CREDENTIALS.status).json(
        createErrorResponse(
          ERROR_CODES.USER_INVALID_CREDENTIALS, 
          'Current password is incorrect'
        )
      );
    }
    
    // Update password
    await User.updatePassword(req.user.id, newPassword);
    
    res.json(
      createSuccessResponse(null, 'Password changed successfully')
    );
  } catch (error) {
    console.error('Change password error:', error);
    res.status(ERROR_CODES.INTERNAL_SERVER_ERROR.status).json(
      createErrorResponse(ERROR_CODES.INTERNAL_SERVER_ERROR, error.message)
    );
  }
};

// 新規追加メソッド
exports.logout = async (req, res, next) => {
  try {
    // トークンをブラックリストに追加
    if (req.token) {
      blacklistToken(req.token);
    }
    
    res.json(
      createSuccessResponse(null, 'Logout successful')
    );
  } catch (error) {
    console.error('Logout error:', error);
    res.status(ERROR_CODES.INTERNAL_SERVER_ERROR.status).json(
      createErrorResponse(ERROR_CODES.INTERNAL_SERVER_ERROR, error.message)
    );
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(ERROR_CODES.AUTH_NO_TOKEN.status).json(
        createErrorResponse(ERROR_CODES.AUTH_NO_TOKEN, 'Refresh token is required')
      );
    }
    
    // リフレッシュトークンの検証と新トークン生成は
    // 統一認証ミドルウェアで実装予定
    
    res.status(501).json(
      createErrorResponse(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Refresh token functionality coming soon'
      )
    );
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(ERROR_CODES.INTERNAL_SERVER_ERROR.status).json(
      createErrorResponse(ERROR_CODES.INTERNAL_SERVER_ERROR, error.message)
    );
  }
};