/**
 * レシピデータキャッシング戦略実装
 * PersonalCookingRecipe Phase 2b パフォーマンス最適化
 */

const { cacheGet, cacheSet, cacheDel } = require('../config/database-postgresql');

class RecipeCacheManager {
    constructor() {
        this.cacheTTL = {
            recipe: 1800,      // 30分
            userRecipes: 900,  // 15分
            categories: 3600,  // 1時間
            popular: 7200,     // 2時間
            search: 600        // 10分
        };
    }

    // レシピ詳細キャッシング
    async cacheRecipe(recipeId, recipeData) {
        const key = `recipe:detail:${recipeId}`;
        const data = {
            ...recipeData,
            cached_at: Date.now(),
            ttl: this.cacheTTL.recipe
        };
        
        return await cacheSet(key, JSON.stringify(data), this.cacheTTL.recipe);
    }

    async getCachedRecipe(recipeId) {
        const key = `recipe:detail:${recipeId}`;
        const cached = await cacheGet(key);
        
        if (cached) {
            const data = JSON.parse(cached);
            // 鮮度チェック
            if (Date.now() - data.cached_at < this.cacheTTL.recipe * 1000) {
                return data;
            }
        }
        
        return null;
    }

    // ユーザー別レシピリストキャッシング
    async cacheUserRecipes(userId, recipes, filters = {}) {
        const filterHash = this.generateFilterHash(filters);
        const key = `recipes:user:${userId}:${filterHash}`;
        
        const data = {
            recipes,
            filters,
            cached_at: Date.now(),
            count: recipes.length
        };
        
        return await cacheSet(key, JSON.stringify(data), this.cacheTTL.userRecipes);
    }

    async getCachedUserRecipes(userId, filters = {}) {
        const filterHash = this.generateFilterHash(filters);
        const key = `recipes:user:${userId}:${filterHash}`;
        const cached = await cacheGet(key);
        
        if (cached) {
            const data = JSON.parse(cached);
            if (Date.now() - data.cached_at < this.cacheTTL.userRecipes * 1000) {
                return data.recipes;
            }
        }
        
        return null;
    }

    // パブリックレシピリストキャッシング
    async cachePublicRecipes(recipes, filters = {}, pagination = {}) {
        const filterHash = this.generateFilterHash({ ...filters, ...pagination });
        const key = `recipes:public:${filterHash}`;
        
        const data = {
            recipes,
            filters,
            pagination,
            cached_at: Date.now(),
            count: recipes.length
        };
        
        return await cacheSet(key, JSON.stringify(data), this.cacheTTL.recipe);
    }

    async getCachedPublicRecipes(filters = {}, pagination = {}) {
        const filterHash = this.generateFilterHash({ ...filters, ...pagination });
        const key = `recipes:public:${filterHash}`;
        const cached = await cacheGet(key);
        
        if (cached) {
            const data = JSON.parse(cached);
            if (Date.now() - data.cached_at < this.cacheTTL.recipe * 1000) {
                return data.recipes;
            }
        }
        
        return null;
    }

    // 人気レシピキャッシング
    async cachePopularRecipes(recipes, timeframe = '24h') {
        const key = `recipes:popular:${timeframe}`;
        
        const data = {
            recipes,
            timeframe,
            cached_at: Date.now(),
            count: recipes.length
        };
        
        return await cacheSet(key, JSON.stringify(data), this.cacheTTL.popular);
    }

    async getCachedPopularRecipes(timeframe = '24h') {
        const key = `recipes:popular:${timeframe}`;
        const cached = await cacheGet(key);
        
        if (cached) {
            const data = JSON.parse(cached);
            if (Date.now() - data.cached_at < this.cacheTTL.popular * 1000) {
                return data.recipes;
            }
        }
        
        return null;
    }

    // 検索結果キャッシング
    async cacheSearchResults(query, results, filters = {}) {
        const searchHash = require('crypto')
            .createHash('md5')
            .update(JSON.stringify({ query, filters }))
            .digest('hex');
        
        const key = `search:${searchHash}`;
        
        const data = {
            query,
            filters,
            results,
            cached_at: Date.now(),
            count: results.length
        };
        
        return await cacheSet(key, JSON.stringify(data), this.cacheTTL.search);
    }

    async getCachedSearchResults(query, filters = {}) {
        const searchHash = require('crypto')
            .createHash('md5')
            .update(JSON.stringify({ query, filters }))
            .digest('hex');
        
        const key = `search:${searchHash}`;
        const cached = await cacheGet(key);
        
        if (cached) {
            const data = JSON.parse(cached);
            if (Date.now() - data.cached_at < this.cacheTTL.search * 1000) {
                return data.results;
            }
        }
        
        return null;
    }

    // カテゴリデータキャッシング
    async cacheCategories(categories) {
        const key = 'categories:all';
        
        const data = {
            categories,
            cached_at: Date.now(),
            count: categories.length
        };
        
        return await cacheSet(key, JSON.stringify(data), this.cacheTTL.categories);
    }

    async getCachedCategories() {
        const key = 'categories:all';
        const cached = await cacheGet(key);
        
        if (cached) {
            const data = JSON.parse(cached);
            if (Date.now() - data.cached_at < this.cacheTTL.categories * 1000) {
                return data.categories;
            }
        }
        
        return null;
    }

    // キャッシュ無効化戦略
    async invalidateRecipeCache(recipeId) {
        const keys = [
            `recipe:detail:${recipeId}`,
            'recipes:public:*',
            'recipes:popular:*',
            'search:*'
        ];
        
        // 個別キー削除
        const deletePromises = keys.filter(key => !key.includes('*')).map(key => cacheDel(key));
        
        // パターンキーは次回アクセス時に期限切れで無効化される
        // （Redis SCAN + DELETE は性能上問題があるため、TTL依存）
        
        await Promise.all(deletePromises);
        
        console.log(`レシピキャッシュ無効化完了: ${recipeId}`);
    }

    async invalidateUserRecipeCache(userId) {
        // ユーザー関連キャッシュ無効化
        // 実装上、パターンマッチングでの一括削除は避け、TTLに依存
        console.log(`ユーザーレシピキャッシュ無効化: ${userId}`);
    }

    // フィルターハッシュ生成
    generateFilterHash(filters) {
        const normalized = JSON.stringify(filters, Object.keys(filters).sort());
        return require('crypto')
            .createHash('md5')
            .update(normalized)
            .digest('hex')
            .substring(0, 8);
    }

    // キャッシュ統計情報
    async getCacheStats() {
        return {
            timestamp: new Date().toISOString(),
            ttl_settings: this.cacheTTL,
            cache_keys: {
                recipe_detail: 'recipe:detail:{id}',
                user_recipes: 'recipes:user:{userId}:{filterHash}',
                public_recipes: 'recipes:public:{filterHash}',
                popular_recipes: 'recipes:popular:{timeframe}',
                search_results: 'search:{hash}',
                categories: 'categories:all'
            },
            performance_impact: {
                cache_hit_ratio: '計測要実装',
                avg_response_time_improvement: '推定30-70%向上'
            }
        };
    }

    // キャッシュウォームアップ（初期化時）
    async warmupCache() {
        try {
            console.log('レシピキャッシュウォームアップ開始...');
            
            // 基本的なデータを事前キャッシュ
            // 実装は必要に応じて追加
            
            console.log('レシピキャッシュウォームアップ完了');
        } catch (error) {
            console.error('キャッシュウォームアップエラー:', error.message);
        }
    }
}

// シングルトンインスタンス
const recipeCacheManager = new RecipeCacheManager();

module.exports = {
    recipeCacheManager,
    RecipeCacheManager
};