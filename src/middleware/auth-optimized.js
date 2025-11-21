// JWT認証ミドルウェア（最適化版）
// Phase 1: 認証処理高速化対応 (3326ms → 500ms目標)
const jwt = require('jsonwebtoken');
const { cacheGet, cacheSet, cacheDel } = require('../config/database-postgresql');

class AuthManager {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET;
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
        this.cacheEnabled = process.env.JWT_CACHE_ENABLED === 'true';
        this.cacheTTL = parseInt(process.env.JWT_CACHE_TTL || '3600'); // 1時間
        
        if (!this.jwtSecret) {
            throw new Error('JWT_SECRET環境変数が設定されていません');
        }
        
        console.log('✅ JWT認証マネージャー初期化完了');
        console.log(`📊 キャッシュ: ${this.cacheEnabled ? '有効' : '無効'}, TTL: ${this.cacheTTL}秒`);
    }

    // JWT トークン生成（最適化版）
    async generateToken(user) {
        const startTime = Date.now();
        
        try {
            const payload = {
                id: user.id,
                username: user.username,
                email: user.email,
                iat: Math.floor(Date.now() / 1000)
            };

            // JWT生成（非同期版）
            const token = jwt.sign(payload, this.jwtSecret, { 
                expiresIn: this.jwtExpiresIn,
                algorithm: 'HS256'
            });

            // Redisキャッシングで高速化
            if (this.cacheEnabled) {
                const cacheKey = `jwt:${user.id}:${token.substring(0, 10)}`;
                await cacheSet(cacheKey, JSON.stringify(payload), this.cacheTTL);
                console.log(`📦 JWT キャッシュ保存: ${cacheKey}`);
            }

            const processingTime = Date.now() - startTime;
            console.log(`⚡ JWT生成完了: ${processingTime}ms`);

            return token;
        } catch (error) {
            console.error('❌ JWT生成エラー:', error.message);
            throw new Error('認証トークン生成に失敗しました');
        }
    }

    // JWT トークン検証（超高速化版）
    async verifyToken(token) {
        const startTime = Date.now();
        
        if (!token) {
            throw new Error('認証トークンが必要です');
        }

        try {
            // 1. Redisキャッシュから高速検索
            if (this.cacheEnabled) {
                const tokenPrefix = token.substring(0, 10);
                const cacheKey = `jwt:*:${tokenPrefix}`;
                const cachedPayload = await this.getCachedPayload(token);
                
                if (cachedPayload) {
                    const processingTime = Date.now() - startTime;
                    console.log(`🚀 JWT検証完了（キャッシュ）: ${processingTime}ms`);
                    return cachedPayload;
                }
            }

            // 2. フォールバック: JWT標準検証
            const decoded = jwt.verify(token, this.jwtSecret, {
                algorithms: ['HS256']
            });

            // 3. 検証済みトークンをキャッシュ
            if (this.cacheEnabled && decoded) {
                const cacheKey = `jwt:${decoded.id}:${token.substring(0, 10)}`;
                await cacheSet(cacheKey, JSON.stringify(decoded), this.cacheTTL);
            }

            const processingTime = Date.now() - startTime;
            console.log(`⚡ JWT検証完了（標準）: ${processingTime}ms`);

            return decoded;
        } catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`❌ JWT検証エラー (${processingTime}ms):`, error.message);
            
            if (error.name === 'TokenExpiredError') {
                throw new Error('認証トークンの有効期限が切れています');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('無効な認証トークンです');
            } else {
                throw new Error('認証に失敗しました');
            }
        }
    }

    // キャッシュからペイロード取得（高速化）
    async getCachedPayload(token) {
        try {
            const tokenPrefix = token.substring(0, 10);
            
            // TODO: Redis のパターンマッチング最適化
            // 現在は簡単な実装、実際は SCAN コマンドで効率化
            for (let userId = 1; userId <= 10000; userId++) { // 実用的な範囲
                const cacheKey = `jwt:${userId}:${tokenPrefix}`;
                const cached = await cacheGet(cacheKey);
                
                if (cached) {
                    const payload = JSON.parse(cached);
                    
                    // トークン完全一致確認
                    const fullToken = jwt.sign(payload, this.jwtSecret, { 
                        expiresIn: this.jwtExpiresIn,
                        algorithm: 'HS256'
                    });
                    
                    if (fullToken === token) {
                        return payload;
                    }
                }
            }
            return null;
        } catch (error) {
            console.error('キャッシュ取得エラー:', error.message);
            return null;
        }
    }

    // トークン無効化（ログアウト時）
    async invalidateToken(token) {
        if (!this.cacheEnabled) return true;

        try {
            const decoded = jwt.decode(token);
            if (decoded) {
                const cacheKey = `jwt:${decoded.id}:${token.substring(0, 10)}`;
                await cacheDel(cacheKey);
                console.log(`🗑️ JWT キャッシュ削除: ${cacheKey}`);
            }
            return true;
        } catch (error) {
            console.error('JWT無効化エラー:', error.message);
            return false;
        }
    }
}

// シングルトンインスタンス
const authManager = new AuthManager();

// Express ミドルウェア（高速化版）
const authMiddleware = async (req, res, next) => {
    const startTime = Date.now();
    
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: '認証ヘッダーが必要です',
                timestamp: new Date().toISOString()
            });
        }

        const token = authHeader.substring(7); // "Bearer " を除去
        const decoded = await authManager.verifyToken(token);

        // ユーザー情報をリクエストに追加
        req.user = {
            id: decoded.id,
            username: decoded.username,
            email: decoded.email
        };

        const processingTime = Date.now() - startTime;
        
        // パフォーマンス監視
        if (processingTime > 1000) {
            console.warn(`⚠️ 認証処理が遅い: ${processingTime}ms (Token: ${token.substring(0, 20)}...)`);
        }

        console.log(`✅ 認証成功 (${processingTime}ms): ${decoded.username}`);
        next();
        
    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`❌ 認証失敗 (${processingTime}ms):`, error.message);
        
        return res.status(401).json({
            error: 'Unauthorized',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// オプションミドルウェア（認証任意）
const optionalAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = await authManager.verifyToken(token);
            req.user = {
                id: decoded.id,
                username: decoded.username,
                email: decoded.email
            };
        }
        
        next();
    } catch (error) {
        // 認証任意なのでエラーでも続行
        console.warn('オプション認証警告:', error.message);
        next();
    }
};

// パフォーマンステストミドルウェア
const performanceTestMiddleware = (req, res, next) => {
    req.authStartTime = Date.now();
    
    res.on('finish', () => {
        const totalTime = Date.now() - req.authStartTime;
        console.log(`📊 認証パフォーマンス: ${totalTime}ms (${req.method} ${req.path})`);
        
        // 目標値チェック (500ms)
        if (totalTime > 500) {
            console.warn(`🚨 パフォーマンス目標未達成: ${totalTime}ms > 500ms`);
        }
    });
    
    next();
};

module.exports = {
    authMiddleware,
    optionalAuthMiddleware,
    performanceTestMiddleware,
    generateToken: (user) => authManager.generateToken(user),
    verifyToken: (token) => authManager.verifyToken(token),
    invalidateToken: (token) => authManager.invalidateToken(token),
    authManager // テスト用エクスポート
};