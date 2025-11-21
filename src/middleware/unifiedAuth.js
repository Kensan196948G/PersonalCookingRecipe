/**
 * 統一認証ミドルウェア
 * Personal Cooking Recipe - 認証システム統一化
 */

const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');
const { ERROR_CODES, createErrorResponse } = require('../utils/errorCodes');

// トークン検証キャッシュ（5分間）
const tokenCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// ブラックリストトークンキャッシュ（24時間）
const blacklistCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

/**
 * JWT設定
 */
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  algorithm: 'HS256'
};

/**
 * 最適化されたトークン検証
 * @param {string} token - JWT トークン
 * @returns {Object} デコードされたトークンペイロード
 * @throws {Error} 無効なトークンの場合
 */
const optimizedTokenVerification = (token) => {
  // ブラックリストチェック
  if (blacklistCache.has(token)) {
    const error = new Error('Token blacklisted');
    error.name = 'TokenBlacklistedError';
    throw error;
  }

  // キャッシュ確認
  const cached = tokenCache.get(token);
  if (cached && cached.exp > Date.now() / 1000) {
    return cached;
  }

  try {
    // JWT検証
    const decoded = jwt.verify(token, JWT_CONFIG.secret, {
      algorithm: JWT_CONFIG.algorithm
    });

    // 基本的な検証
    if (!decoded.userId || !decoded.email) {
      throw new Error('Invalid token payload');
    }

    // キャッシュに保存（有効期限まで）
    const ttl = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
    if (ttl > 0) {
      tokenCache.set(token, decoded, ttl);
    }

    return decoded;
  } catch (error) {
    // キャッシュから削除
    tokenCache.del(token);
    throw error;
  }
};

/**
 * オプショナル認証ミドルウェア
 * トークンがあれば検証し、なくても続行
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  if (token) {
    try {
      const decoded = optimizedTokenVerification(token);
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        username: decoded.username
      };
      req.isAuthenticated = true;
      req.token = token;
    } catch (error) {
      req.user = null;
      req.isAuthenticated = false;
      req.token = null;
      
      // オプショナルなので、エラーをログに記録するが続行
      console.warn(`Optional auth failed for token: ${error.message}`);
    }
  } else {
    req.user = null;
    req.isAuthenticated = false;
    req.token = null;
  }
  
  next();
};

/**
 * 必須認証ミドルウェア
 * 有効なトークンが必要
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  if (!token) {
    return res.status(ERROR_CODES.AUTH_NO_TOKEN.status).json(
      createErrorResponse(ERROR_CODES.AUTH_NO_TOKEN)
    );
  }
  
  try {
    const decoded = optimizedTokenVerification(token);
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      username: decoded.username
    };
    req.isAuthenticated = true;
    req.token = token;
    
    next();
  } catch (error) {
    let errorCode = ERROR_CODES.AUTH_INVALID_TOKEN;
    
    switch (error.name) {
      case 'TokenExpiredError':
        errorCode = ERROR_CODES.AUTH_EXPIRED_TOKEN;
        break;
      case 'TokenBlacklistedError':
        errorCode = ERROR_CODES.AUTH_TOKEN_BLACKLISTED;
        break;
      case 'JsonWebTokenError':
      case 'NotBeforeError':
        errorCode = ERROR_CODES.AUTH_INVALID_TOKEN;
        break;
      default:
        errorCode = ERROR_CODES.AUTH_INVALID_TOKEN;
    }
    
    res.status(errorCode.status).json(
      createErrorResponse(errorCode, error.message)
    );
  }
};

/**
 * 管理者権限チェックミドルウェア
 */
const requireAdmin = async (req, res, next) => {
  // まず認証チェック
  await requireAuth(req, res, () => {
    if (!req.user) {
      return;
    }
    
    // 管理者権限チェック（今後実装予定）
    if (req.user.role !== 'admin') {
      return res.status(ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS.status).json(
        createErrorResponse(ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS)
      );
    }
    
    next();
  });
};

/**
 * リソースオーナーチェックミドルウェア
 * @param {string} resourceField - リソースのオーナーフィールド名（デフォルト: 'userId'）
 */
const requireResourceOwner = (resourceField = 'userId') => {
  return async (req, res, next) => {
    // まず認証チェック
    await requireAuth(req, res, () => {
      if (!req.user) {
        return;
      }
      
      // リソースオーナーチェックは後続のコントローラーで実行
      req.resourceOwnerField = resourceField;
      next();
    });
  };
};

/**
 * JWT トークン生成
 * @param {Object} payload - トークンペイロード
 * @param {string} expiresIn - 有効期限（デフォルト: 15m）
 * @returns {string} JWT トークン
 */
const generateToken = (payload, expiresIn = JWT_CONFIG.accessTokenExpiry) => {
  return jwt.sign(payload, JWT_CONFIG.secret, {
    expiresIn,
    algorithm: JWT_CONFIG.algorithm,
    issuer: 'personal-cooking-recipe',
    audience: 'recipe-app-users'
  });
};

/**
 * リフレッシュトークン生成
 * @param {Object} payload - トークンペイロード
 * @returns {string} リフレッシュトークン
 */
const generateRefreshToken = (payload) => {
  return generateToken(
    { ...payload, type: 'refresh' },
    JWT_CONFIG.refreshTokenExpiry
  );
};

/**
 * トークンをブラックリストに追加
 * @param {string} token - ブラックリストに追加するトークン
 */
const blacklistToken = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      const ttl = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
      blacklistCache.set(token, true, ttl);
      tokenCache.del(token);
    }
  } catch (error) {
    console.error('Failed to blacklist token:', error);
  }
};

/**
 * 認証統計情報取得
 */
const getAuthStats = () => ({
  tokenCacheStats: tokenCache.getStats(),
  blacklistCacheStats: blacklistCache.getStats(),
  activeCachedTokens: tokenCache.keys().length,
  blacklistedTokens: blacklistCache.keys().length
});

/**
 * キャッシュクリア（開発・テスト用）
 */
const clearAuthCache = () => {
  tokenCache.flushAll();
  blacklistCache.flushAll();
  console.log('Auth cache cleared');
};

module.exports = {
  optionalAuth,
  requireAuth,
  requireAdmin,
  requireResourceOwner,
  generateToken,
  generateRefreshToken,
  blacklistToken,
  getAuthStats,
  clearAuthCache,
  JWT_CONFIG
};