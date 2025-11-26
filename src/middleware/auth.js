const jwt = require('jsonwebtoken');
const { cacheManager } = require('./cache');

module.exports = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // キャッシュから認証情報を取得
    let decoded;
    const cachedAuth = await cacheManager.getCachedJWT('temp', token);
    
    if (cachedAuth) {
      decoded = cachedAuth;
      req.fromCache = true;
    } else {
      // JWT検証 (パフォーマンス測定)
      const startTime = process.hrtime.bigint();
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      const endTime = process.hrtime.bigint();
      
      // パフォーマンスログ
      const duration = Number(endTime - startTime) / 1000000; // ナノ秒からミリ秒へ
      if (duration > 2.0) { // 2ms超過時にログ
        console.warn(`JWT検証時間超過: ${duration.toFixed(3)}ms`);
      }
      
      // 認証情報をキャッシュに保存
      await cacheManager.cacheJWT(decoded.userId, token, decoded);
      req.fromCache = false;
    }
    
    req.userId = decoded.userId;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};