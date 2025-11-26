/**
 * Redis L2キャッシングミドルウェア
 * PersonalCookingRecipe Phase 2b パフォーマンス最適化
 */

const { cacheGet, cacheSet, cacheDel } = require('../config/database-postgresql');

class CacheManager {
    constructor() {
        this.defaultTTL = {
            jwt: 3600,        // JWT: 1時間
            recipes: 1800,    // レシピ: 30分
            users: 3600,      // ユーザー: 1時間
            categories: 7200, // カテゴリ: 2時間
            search: 600,      // 検索結果: 10分
            api: 300          // API応答: 5分
        };
    }

    // JWT認証キャッシング強化
    async cacheJWT(userId, token, payload) {
        const key = `jwt:${userId}:${token.slice(-8)}`;
        const value = JSON.stringify({
            userId,
            payload,
            timestamp: Date.now()
        });
        return await cacheSet(key, value, this.defaultTTL.jwt);
    }

    async getCachedJWT(userId, token) {
        const key = `jwt:${userId}:${token.slice(-8)}`;
        const cached = await cacheGet(key);
        if (cached) {
            const data = JSON.parse(cached);
            // 有効性チェック
            if (Date.now() - data.timestamp < this.defaultTTL.jwt * 1000) {
                return data.payload;
            }
        }
        return null;
    }

    // レシピデータキャッシング戦略
    async cacheRecipe(recipeId, data) {
        const key = `recipe:${recipeId}`;
        return await cacheSet(key, JSON.stringify(data), this.defaultTTL.recipes);
    }

    async getCachedRecipe(recipeId) {
        const key = `recipe:${recipeId}`;
        const cached = await cacheGet(key);
        return cached ? JSON.parse(cached) : null;
    }

    async cacheUserRecipes(userId, recipes) {
        const key = `user_recipes:${userId}`;
        return await cacheSet(key, JSON.stringify(recipes), this.defaultTTL.recipes);
    }

    async getCachedUserRecipes(userId) {
        const key = `user_recipes:${userId}`;
        const cached = await cacheGet(key);
        return cached ? JSON.parse(cached) : null;
    }

    // 検索結果キャッシング
    async cacheSearchResults(query, results) {
        const key = `search:${Buffer.from(query).toString('base64')}`;
        return await cacheSet(key, JSON.stringify(results), this.defaultTTL.search);
    }

    async getCachedSearchResults(query) {
        const key = `search:${Buffer.from(query).toString('base64')}`;
        const cached = await cacheGet(key);
        return cached ? JSON.parse(cached) : null;
    }

    // API応答キャッシング
    async cacheAPIResponse(endpoint, params, response) {
        const key = `api:${endpoint}:${Buffer.from(JSON.stringify(params)).toString('base64')}`;
        return await cacheSet(key, JSON.stringify(response), this.defaultTTL.api);
    }

    async getCachedAPIResponse(endpoint, params) {
        const key = `api:${endpoint}:${Buffer.from(JSON.stringify(params)).toString('base64')}`;
        const cached = await cacheGet(key);
        return cached ? JSON.parse(cached) : null;
    }

    // キャッシュ無効化戦略
    async invalidateRecipeCache(recipeId) {
        const keys = [
            `recipe:${recipeId}`,
            `user_recipes:*`,
            'search:*'
        ];
        
        const promises = keys.map(key => {
            if (key.includes('*')) {
                // パターンマッチングキー削除は実装上困難なため、TTL短縮で対応
                return Promise.resolve();
            }
            return cacheDel(key);
        });
        
        return Promise.all(promises);
    }

    async invalidateUserCache(userId) {
        const keys = [
            `jwt:${userId}:*`,
            `user_recipes:${userId}`
        ];
        
        return Promise.all(keys.map(key => cacheDel(key)));
    }

    // 統計情報
    async getCacheStats() {
        return {
            timestamp: new Date().toISOString(),
            ttl_settings: this.defaultTTL,
            note: 'キャッシュ統計情報は Redis INFO コマンドで確認可能'
        };
    }
}

// シングルトンインスタンス
const cacheManager = new CacheManager();

// ミドルウェア関数群
const cacheMiddleware = {
    // レスポンスキャッシング
    response: (ttl = 300) => {
        return async (req, res, next) => {
            const key = `response:${req.originalUrl}:${JSON.stringify(req.query)}`;
            
            try {
                const cached = await cacheGet(key);
                if (cached) {
                    const data = JSON.parse(cached);
                    res.set('X-Cache', 'HIT');
                    return res.json(data);
                }
            } catch (error) {
                console.warn('キャッシュ読み込みエラー:', error.message);
            }
            
            // レスポンスをキャッシュ
            const originalJson = res.json;
            res.json = function(data) {
                cacheSet(key, JSON.stringify(data), ttl).catch(err => 
                    console.warn('キャッシュ保存エラー:', err.message)
                );
                res.set('X-Cache', 'MISS');
                originalJson.call(this, data);
            };
            
            next();
        };
    },

    // JWT認証キャッシング
    jwtCache: () => {
        return async (req, res, next) => {
            const token = req.header('Authorization')?.replace('Bearer ', '');
            if (!token) return next();
            
            try {
                const cached = await cacheManager.getCachedJWT(req.userId, token);
                if (cached) {
                    req.user = cached;
                    req.fromCache = true;
                    return next();
                }
            } catch (error) {
                console.warn('JWTキャッシュエラー:', error.message);
            }
            
            next();
        };
    }
};

module.exports = {
    cacheManager,
    cacheMiddleware
};