/**
 * 統合キャッシュサービス - PersonalCookingRecipe Phase 2 Week 1
 * 多層キャッシング戦略実装
 *
 * キャッシング階層:
 * - Level 1: Node-Cache (メモリ)
 * - Level 2: Redis (分散キャッシュ) ← 本実装
 * - Level 3: PostgreSQL (結果キャッシュ)
 * - Level 4: CDN (レスポンスキャッシュ)
 *
 * @author Backend API Developer
 * @version 2.0.0
 */

const { redisManager } = require('../config/redis');
const crypto = require('crypto');

class CacheService {
    constructor() {
        this.strategies = {
            CACHE_ASIDE: 'cache-aside',         // 遅延読み込み
            WRITE_THROUGH: 'write-through',     // 同時書き込み
            WRITE_BEHIND: 'write-behind',       // 非同期書き込み
            REFRESH_AHEAD: 'refresh-ahead'      // 先読み更新
        };

        this.isInitialized = false;
    }

    /**
     * サービス初期化
     */
    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        try {
            await redisManager.connect();
            this.isInitialized = true;
            console.log('CacheService初期化完了');
            return true;
        } catch (error) {
            console.error('CacheService初期化エラー:', error.message);
            return false;
        }
    }

    /**
     * ===================================
     * JWT認証キャッシング (TTL: 1時間)
     * Strategy: Cache-Aside
     * ===================================
     */

    /**
     * JWT保存
     */
    async cacheJWT(userId, token, payload, ttl = redisManager.TTL.JWT) {
        const key = this.generateJWTKey(userId, token);
        const value = {
            userId,
            payload,
            timestamp: Date.now(),
            expiresAt: Date.now() + (ttl * 1000)
        };

        return await redisManager.set(key, value, ttl);
    }

    /**
     * JWT取得
     */
    async getCachedJWT(userId, token) {
        const key = this.generateJWTKey(userId, token);
        const cached = await redisManager.get(key);

        if (!cached) {
            return null;
        }

        // 有効性確認
        if (Date.now() > cached.expiresAt) {
            await redisManager.del(key);
            return null;
        }

        return cached.payload;
    }

    /**
     * JWT無効化
     */
    async invalidateJWT(userId, token) {
        const key = this.generateJWTKey(userId, token);
        return await redisManager.del(key);
    }

    /**
     * ユーザーの全JWT無効化
     */
    async invalidateUserJWTs(userId) {
        const pattern = `${redisManager.PREFIX.JWT}${userId}:*`;
        const keys = await redisManager.scan(pattern);

        if (keys.length > 0) {
            return await redisManager.del(keys);
        }

        return 0;
    }

    /**
     * JWTキー生成
     */
    generateJWTKey(userId, token) {
        const tokenHash = token.slice(-8);
        return `${redisManager.PREFIX.JWT}${userId}:${tokenHash}`;
    }

    /**
     * ===================================
     * ユーザープロファイルキャッシング (TTL: 30分)
     * Strategy: Cache-Aside
     * ===================================
     */

    /**
     * ユーザープロファイル保存
     */
    async cacheUserProfile(userId, profile, ttl = redisManager.TTL.USER_PROFILE) {
        const key = `${redisManager.PREFIX.USER}profile:${userId}`;
        const value = {
            ...profile,
            cached_at: Date.now()
        };

        return await redisManager.set(key, value, ttl);
    }

    /**
     * ユーザープロファイル取得
     */
    async getCachedUserProfile(userId) {
        const key = `${redisManager.PREFIX.USER}profile:${userId}`;
        return await redisManager.get(key);
    }

    /**
     * ユーザープロファイル無効化
     */
    async invalidateUserProfile(userId) {
        const key = `${redisManager.PREFIX.USER}profile:${userId}`;
        return await redisManager.del(key);
    }

    /**
     * ===================================
     * レシピキャッシング
     * ===================================
     */

    /**
     * レシピ詳細キャッシング (TTL: 1時間)
     * Strategy: Write-Through
     */
    async cacheRecipe(recipeId, recipe, ttl = redisManager.TTL.RECIPE_DETAIL) {
        const key = `${redisManager.PREFIX.RECIPE}detail:${recipeId}`;
        const value = {
            ...recipe,
            cached_at: Date.now(),
            cache_strategy: this.strategies.WRITE_THROUGH
        };

        return await redisManager.set(key, value, ttl);
    }

    /**
     * レシピ詳細取得
     */
    async getCachedRecipe(recipeId) {
        const key = `${redisManager.PREFIX.RECIPE}detail:${recipeId}`;
        const cached = await redisManager.get(key);

        if (!cached) {
            return null;
        }

        // 鮮度チェック（1時間以内）
        const age = Date.now() - cached.cached_at;
        if (age > redisManager.TTL.RECIPE_DETAIL * 1000) {
            await redisManager.del(key);
            return null;
        }

        return cached;
    }

    /**
     * レシピリストキャッシング (TTL: 30分)
     * Strategy: Cache-Aside
     */
    async cacheRecipeList(userId, filters, pagination, recipes, ttl = redisManager.TTL.RECIPE_LIST) {
        const key = this.generateRecipeListKey(userId, filters, pagination);
        const value = {
            recipes,
            filters,
            pagination,
            cached_at: Date.now(),
            count: recipes.length,
            cache_strategy: this.strategies.CACHE_ASIDE
        };

        return await redisManager.set(key, value, ttl);
    }

    /**
     * レシピリスト取得
     */
    async getCachedRecipeList(userId, filters, pagination) {
        const key = this.generateRecipeListKey(userId, filters, pagination);
        const cached = await redisManager.get(key);

        if (!cached) {
            return null;
        }

        return cached.recipes;
    }

    /**
     * レシピリストキー生成
     */
    generateRecipeListKey(userId, filters, pagination) {
        const params = { userId, filters, pagination };
        const hash = this.generateHash(params);
        return `${redisManager.PREFIX.RECIPES}list:${hash}`;
    }

    /**
     * レシピ無効化（更新・削除時）
     */
    async invalidateRecipe(recipeId) {
        const keys = [
            `${redisManager.PREFIX.RECIPE}detail:${recipeId}`,
            // リスト系は次回アクセス時にTTL切れで自動削除
        ];

        return await redisManager.del(keys);
    }

    /**
     * ユーザーレシピキャッシュ無効化
     */
    async invalidateUserRecipes(userId) {
        // パターンマッチングで削除（SCAN使用で非ブロッキング）
        const pattern = `${redisManager.PREFIX.RECIPES}list:*${userId}*`;
        const keys = await redisManager.scan(pattern);

        if (keys.length > 0) {
            return await redisManager.del(keys);
        }

        return 0;
    }

    /**
     * ===================================
     * ダッシュボードキャッシング (TTL: 15分)
     * Strategy: Refresh-Ahead
     * ===================================
     */

    /**
     * ダッシュボードデータ保存
     */
    async cacheDashboard(userId, data, ttl = redisManager.TTL.DASHBOARD) {
        const key = `${redisManager.PREFIX.USER}dashboard:${userId}`;
        const value = {
            ...data,
            cached_at: Date.now(),
            cache_strategy: this.strategies.REFRESH_AHEAD
        };

        return await redisManager.set(key, value, ttl);
    }

    /**
     * ダッシュボードデータ取得（Refresh-Ahead）
     */
    async getCachedDashboard(userId, refreshCallback = null) {
        const key = `${redisManager.PREFIX.USER}dashboard:${userId}`;
        const cached = await redisManager.get(key);

        if (!cached) {
            return null;
        }

        // TTL確認（70%経過したら非同期更新）
        const ttl = await redisManager.ttl(key);
        const refreshThreshold = redisManager.TTL.DASHBOARD * 0.3; // 30%残り

        if (ttl > 0 && ttl < refreshThreshold && refreshCallback) {
            // 非同期でデータ更新（Refresh-Ahead戦略）
            setImmediate(async () => {
                try {
                    const newData = await refreshCallback(userId);
                    await this.cacheDashboard(userId, newData);
                    console.log(`Dashboard Refresh-Ahead完了: User ${userId}`);
                } catch (error) {
                    console.error('Refresh-Ahead失敗:', error.message);
                }
            });
        }

        return cached;
    }

    /**
     * ダッシュボード無効化
     */
    async invalidateDashboard(userId) {
        const key = `${redisManager.PREFIX.USER}dashboard:${userId}`;
        return await redisManager.del(key);
    }

    /**
     * ===================================
     * 検索結果キャッシング (TTL: 10分)
     * Strategy: Cache-Aside
     * ===================================
     */

    /**
     * 検索結果保存
     */
    async cacheSearchResults(query, filters, results, ttl = redisManager.TTL.SEARCH) {
        const key = this.generateSearchKey(query, filters);
        const value = {
            query,
            filters,
            results,
            cached_at: Date.now(),
            count: results.length
        };

        return await redisManager.set(key, value, ttl);
    }

    /**
     * 検索結果取得
     */
    async getCachedSearchResults(query, filters) {
        const key = this.generateSearchKey(query, filters);
        const cached = await redisManager.get(key);

        if (!cached) {
            return null;
        }

        return cached.results;
    }

    /**
     * 検索キー生成
     */
    generateSearchKey(query, filters) {
        const params = { query, filters };
        const hash = this.generateHash(params);
        return `${redisManager.PREFIX.SEARCH}${hash}`;
    }

    /**
     * ===================================
     * カテゴリキャッシング (TTL: 2時間)
     * Strategy: Cache-Aside (ほぼ静的データ)
     * ===================================
     */

    /**
     * カテゴリデータ保存
     */
    async cacheCategories(categories, ttl = redisManager.TTL.CATEGORIES) {
        const key = `${redisManager.PREFIX.CATEGORIES}all`;
        const value = {
            categories,
            cached_at: Date.now(),
            count: categories.length
        };

        return await redisManager.set(key, value, ttl);
    }

    /**
     * カテゴリデータ取得
     */
    async getCachedCategories() {
        const key = `${redisManager.PREFIX.CATEGORIES}all`;
        const cached = await redisManager.get(key);

        if (!cached) {
            return null;
        }

        return cached.categories;
    }

    /**
     * カテゴリ無効化
     */
    async invalidateCategories() {
        const key = `${redisManager.PREFIX.CATEGORIES}all`;
        return await redisManager.del(key);
    }

    /**
     * ===================================
     * 汎用API応答キャッシング (TTL: 5分)
     * Strategy: Cache-Aside
     * ===================================
     */

    /**
     * API応答保存
     */
    async cacheAPIResponse(endpoint, params, response, ttl = redisManager.TTL.API_RESPONSE) {
        const key = this.generateAPIKey(endpoint, params);
        const value = {
            endpoint,
            params,
            response,
            cached_at: Date.now()
        };

        return await redisManager.set(key, value, ttl);
    }

    /**
     * API応答取得
     */
    async getCachedAPIResponse(endpoint, params) {
        const key = this.generateAPIKey(endpoint, params);
        const cached = await redisManager.get(key);

        if (!cached) {
            return null;
        }

        return cached.response;
    }

    /**
     * APIキー生成
     */
    generateAPIKey(endpoint, params) {
        const combined = { endpoint, params };
        const hash = this.generateHash(combined);
        return `${redisManager.PREFIX.API}${hash}`;
    }

    /**
     * ===================================
     * ユーティリティメソッド
     * ===================================
     */

    /**
     * ハッシュ生成（SHA-256）
     * セキュリティ強化: MD5 16文字 → SHA-256 64文字（衝突確率を大幅削減）
     */
    generateHash(data) {
        const normalized = JSON.stringify(data, Object.keys(data).sort());
        return crypto.createHash('sha256').update(normalized).digest('hex');
    }

    /**
     * 一括キャッシュ削除（SCANベース）
     */
    async invalidatePattern(pattern) {
        const keys = await redisManager.scan(pattern);

        if (keys.length > 0) {
            return await redisManager.del(keys);
        }

        return 0;
    }

    /**
     * 全キャッシュクリア（開発環境のみ）
     */
    async clearAll() {
        if (process.env.NODE_ENV !== 'production') {
            return await redisManager.flushdb();
        }

        console.warn('本番環境でのキャッシュ全削除は禁止されています');
        return false;
    }

    /**
     * キャッシュ統計取得
     */
    async getStats() {
        return redisManager.getStats();
    }

    /**
     * ヘルスチェック
     */
    async healthCheck() {
        return await redisManager.healthCheck();
    }
}

// シングルトンインスタンス
const cacheService = new CacheService();

module.exports = {
    cacheService,
    CacheService
};
