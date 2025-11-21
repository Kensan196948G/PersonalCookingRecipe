const jwt = require('jsonwebtoken');
const { redisClient } = require('../config/database-postgresql');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_CACHE_ENABLED = process.env.JWT_CACHE_ENABLED === 'true';
const JWT_CACHE_TTL = parseInt(process.env.JWT_CACHE_TTL || '3600');

/**
 * JWT トークン生成（Redisキャッシング対応）
 */
async function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  // Redisキャッシング（有効な場合）
  if (JWT_CACHE_ENABLED && redisClient && redisClient.isOpen) {
    try {
      const cacheKey = `jwt:${user.id}`;
      await redisClient.setEx(cacheKey, JWT_CACHE_TTL, token);
    } catch (error) {
      console.error('Redis cache error:', error);
      // キャッシュ失敗時もトークンは返す
    }
  }

  return token;
}

/**
 * JWT トークン検証（Redisキャッシング対応）
 */
async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Redisキャッシュチェック（有効な場合）
    if (JWT_CACHE_ENABLED && redisClient && redisClient.isOpen) {
      try {
        const cacheKey = `jwt:${decoded.id}`;
        const cachedToken = await redisClient.get(cacheKey);

        if (cachedToken === token) {
          // キャッシュヒット - 高速パス
          return decoded;
        }
      } catch (error) {
        console.error('Redis verification error:', error);
        // キャッシュ失敗時も通常の検証を続行
      }
    }

    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * 認証ミドルウェア
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);

  verifyToken(token)
    .then((decoded) => {
      req.user = decoded;
      next();
    })
    .catch((error) => {
      res.status(401).json({ error: error.message });
    });
}

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
};
