/**
 * 強化版キャッシュミドルウェア - PersonalCookingRecipe Phase 2 Week 1
 * 多様なキャッシング戦略対応ミドルウェア群
 *
 * @author Backend API Developer
 * @version 2.0.0
 */

const { cacheService } = require('../services/cacheService');

/**
 * ===================================
 * レスポンスキャッシングミドルウェア
 * Strategy: Cache-Aside
 * ===================================
 */

/**
 * 汎用レスポンスキャッシング
 * @param {number} ttl - TTL（秒）
 * @param {function} keyGenerator - キャッシュキー生成関数
 */
const cacheResponse = (ttl = 300, keyGenerator = null) => {
    return async (req, res, next) => {
        // キャッシュ無効化パラメータチェック
        if (req.query.no_cache === '1' || req.headers['cache-control'] === 'no-cache') {
            res.set('X-Cache', 'BYPASS');
            return next();
        }

        try {
            // キャッシュキー生成
            const cacheKey = keyGenerator
                ? keyGenerator(req)
                : generateDefaultCacheKey(req);

            // キャッシュ確認
            const cached = await cacheService.getCachedAPIResponse(cacheKey, {});

            if (cached) {
                res.set('X-Cache', 'HIT');
                res.set('X-Cache-Key', cacheKey);
                return res.json(cached);
            }

            // レスポンス横取り
            const originalJson = res.json.bind(res);

            res.json = function (data) {
                // キャッシュ保存（非同期）
                setImmediate(async () => {
                    try {
                        await cacheService.cacheAPIResponse(cacheKey, {}, data, ttl);
                        console.log(`Response cached: ${cacheKey} (TTL: ${ttl}s)`);
                    } catch (error) {
                        console.error('レスポンスキャッシュ保存エラー:', error.message);
                    }
                });

                res.set('X-Cache', 'MISS');
                res.set('X-Cache-Key', cacheKey);
                return originalJson(data);
            };

            next();

        } catch (error) {
            console.error('キャッシュミドルウェアエラー:', error.message);
            res.set('X-Cache', 'ERROR');
            next();
        }
    };
};

/**
 * デフォルトキャッシュキー生成
 */
function generateDefaultCacheKey(req) {
    const url = req.originalUrl || req.url;
    const method = req.method;
    const userId = req.userId || 'anonymous';
    const query = JSON.stringify(req.query);

    return `${method}:${url}:${userId}:${query}`;
}

/**
 * ===================================
 * JWT認証キャッシングミドルウェア
 * Strategy: Cache-Aside
 * ===================================
 */

/**
 * JWT認証結果キャッシング
 */
const cacheJWT = () => {
    return async (req, res, next) => {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return next();
        }

        try {
            // ユーザーID取得（デコード後に利用可能と仮定）
            const userId = req.userId || 'temp';

            // キャッシュ確認
            const cached = await cacheService.getCachedJWT(userId, token);

            if (cached) {
                req.user = cached;
                req.fromCache = true;
                res.set('X-Auth-Cache', 'HIT');
                console.log(`JWT Cache HIT: User ${userId}`);
            } else {
                res.set('X-Auth-Cache', 'MISS');
            }

            next();

        } catch (error) {
            console.error('JWTキャッシュミドルウェアエラー:', error.message);
            next();
        }
    };
};

/**
 * ===================================
 * レシピキャッシングミドルウェア
 * ===================================
 */

/**
 * レシピ詳細キャッシング (Write-Through)
 */
const cacheRecipeDetail = () => {
    return async (req, res, next) => {
        const recipeId = req.params.id;

        if (!recipeId) {
            return next();
        }

        try {
            // キャッシュ確認
            const cached = await cacheService.getCachedRecipe(recipeId);

            if (cached) {
                res.set('X-Cache', 'HIT');
                res.set('X-Cache-Strategy', 'Write-Through');
                return res.json({
                    recipe: cached,
                    performance: {
                        cached: true,
                        strategy: 'write-through'
                    }
                });
            }

            // レスポンス横取り（Write-Through戦略）
            const originalJson = res.json.bind(res);

            res.json = function (data) {
                // レシピデータ保存
                if (data.recipe) {
                    setImmediate(async () => {
                        try {
                            await cacheService.cacheRecipe(recipeId, data.recipe);
                            console.log(`Recipe cached (Write-Through): ${recipeId}`);
                        } catch (error) {
                            console.error('レシピキャッシュ保存エラー:', error.message);
                        }
                    });
                }

                res.set('X-Cache', 'MISS');
                res.set('X-Cache-Strategy', 'Write-Through');
                return originalJson(data);
            };

            next();

        } catch (error) {
            console.error('レシピキャッシュミドルウェアエラー:', error.message);
            next();
        }
    };
};

/**
 * レシピリストキャッシング (Cache-Aside)
 */
const cacheRecipeList = () => {
    return async (req, res, next) => {
        try {
            const userId = req.userId || null;
            const filters = {
                category_id: req.query.category_id,
                difficulty: req.query.difficulty,
                is_favorite: req.query.is_favorite,
                search: req.query.search
            };
            const pagination = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20
            };

            // キャッシュ確認
            const cached = await cacheService.getCachedRecipeList(userId, filters, pagination);

            if (cached) {
                res.set('X-Cache', 'HIT');
                res.set('X-Cache-Strategy', 'Cache-Aside');
                return res.json({
                    recipes: cached,
                    pagination,
                    performance: {
                        cached: true,
                        strategy: 'cache-aside'
                    }
                });
            }

            // レスポンス横取り
            const originalJson = res.json.bind(res);

            res.json = function (data) {
                // レシピリスト保存
                if (data.recipes) {
                    setImmediate(async () => {
                        try {
                            await cacheService.cacheRecipeList(userId, filters, pagination, data.recipes);
                            console.log(`Recipe list cached (Cache-Aside): User ${userId}`);
                        } catch (error) {
                            console.error('レシピリストキャッシュ保存エラー:', error.message);
                        }
                    });
                }

                res.set('X-Cache', 'MISS');
                res.set('X-Cache-Strategy', 'Cache-Aside');
                return originalJson(data);
            };

            next();

        } catch (error) {
            console.error('レシピリストキャッシュミドルウェアエラー:', error.message);
            next();
        }
    };
};

/**
 * ===================================
 * ダッシュボードキャッシング
 * Strategy: Refresh-Ahead
 * ===================================
 */

/**
 * ダッシュボードキャッシング（先読み更新）
 * @param {function} dataFetcher - データ取得関数
 */
const cacheDashboard = (dataFetcher = null) => {
    return async (req, res, next) => {
        const userId = req.userId;

        if (!userId) {
            return next();
        }

        try {
            // Refresh-Ahead コールバック
            const refreshCallback = dataFetcher || null;

            // キャッシュ確認（Refresh-Ahead戦略）
            const cached = await cacheService.getCachedDashboard(userId, refreshCallback);

            if (cached) {
                res.set('X-Cache', 'HIT');
                res.set('X-Cache-Strategy', 'Refresh-Ahead');
                return res.json({
                    ...cached,
                    performance: {
                        cached: true,
                        strategy: 'refresh-ahead'
                    }
                });
            }

            // レスポンス横取り
            const originalJson = res.json.bind(res);

            res.json = function (data) {
                // ダッシュボードデータ保存
                setImmediate(async () => {
                    try {
                        await cacheService.cacheDashboard(userId, data);
                        console.log(`Dashboard cached (Refresh-Ahead): User ${userId}`);
                    } catch (error) {
                        console.error('ダッシュボードキャッシュ保存エラー:', error.message);
                    }
                });

                res.set('X-Cache', 'MISS');
                res.set('X-Cache-Strategy', 'Refresh-Ahead');
                return originalJson(data);
            };

            next();

        } catch (error) {
            console.error('ダッシュボードキャッシュミドルウェアエラー:', error.message);
            next();
        }
    };
};

/**
 * ===================================
 * 検索結果キャッシング
 * Strategy: Cache-Aside
 * ===================================
 */

/**
 * 検索結果キャッシング
 */
const cacheSearchResults = () => {
    return async (req, res, next) => {
        try {
            const query = req.query.q || req.query.query || '';
            const filters = {
                category: req.query.category,
                difficulty: req.query.difficulty,
                tags: req.query.tags
            };

            if (!query) {
                return next();
            }

            // キャッシュ確認
            const cached = await cacheService.getCachedSearchResults(query, filters);

            if (cached) {
                res.set('X-Cache', 'HIT');
                res.set('X-Cache-Strategy', 'Cache-Aside');
                return res.json({
                    results: cached,
                    query,
                    filters,
                    performance: {
                        cached: true
                    }
                });
            }

            // レスポンス横取り
            const originalJson = res.json.bind(res);

            res.json = function (data) {
                // 検索結果保存
                if (data.results) {
                    setImmediate(async () => {
                        try {
                            await cacheService.cacheSearchResults(query, filters, data.results);
                            console.log(`Search results cached: "${query}"`);
                        } catch (error) {
                            console.error('検索結果キャッシュ保存エラー:', error.message);
                        }
                    });
                }

                res.set('X-Cache', 'MISS');
                res.set('X-Cache-Strategy', 'Cache-Aside');
                return originalJson(data);
            };

            next();

        } catch (error) {
            console.error('検索結果キャッシュミドルウェアエラー:', error.message);
            next();
        }
    };
};

/**
 * ===================================
 * カテゴリキャッシング
 * Strategy: Cache-Aside (静的データ)
 * ===================================
 */

/**
 * カテゴリキャッシング
 */
const cacheCategories = () => {
    return async (req, res, next) => {
        try {
            // キャッシュ確認
            const cached = await cacheService.getCachedCategories();

            if (cached) {
                res.set('X-Cache', 'HIT');
                res.set('X-Cache-Strategy', 'Cache-Aside');
                return res.json({
                    categories: cached,
                    performance: {
                        cached: true
                    }
                });
            }

            // レスポンス横取り
            const originalJson = res.json.bind(res);

            res.json = function (data) {
                // カテゴリデータ保存
                if (data.categories) {
                    setImmediate(async () => {
                        try {
                            await cacheService.cacheCategories(data.categories);
                            console.log('Categories cached');
                        } catch (error) {
                            console.error('カテゴリキャッシュ保存エラー:', error.message);
                        }
                    });
                }

                res.set('X-Cache', 'MISS');
                res.set('X-Cache-Strategy', 'Cache-Aside');
                return originalJson(data);
            };

            next();

        } catch (error) {
            console.error('カテゴリキャッシュミドルウェアエラー:', error.message);
            next();
        }
    };
};

/**
 * ===================================
 * キャッシュ無効化ミドルウェア
 * ===================================
 */

/**
 * レシピ更新時のキャッシュ無効化
 */
const invalidateRecipeCache = () => {
    return async (req, res, next) => {
        const recipeId = req.params.id;

        // レスポンス後に無効化
        res.on('finish', async () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    await cacheService.invalidateRecipe(recipeId);
                    await cacheService.invalidateUserRecipes(req.userId);
                    console.log(`Cache invalidated: Recipe ${recipeId}`);
                } catch (error) {
                    console.error('キャッシュ無効化エラー:', error.message);
                }
            }
        });

        next();
    };
};

/**
 * ユーザー更新時のキャッシュ無効化
 */
const invalidateUserCache = () => {
    return async (req, res, next) => {
        const userId = req.userId;

        // レスポンス後に無効化
        res.on('finish', async () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    await cacheService.invalidateUserProfile(userId);
                    await cacheService.invalidateDashboard(userId);
                    await cacheService.invalidateUserRecipes(userId);
                    console.log(`Cache invalidated: User ${userId}`);
                } catch (error) {
                    console.error('ユーザーキャッシュ無効化エラー:', error.message);
                }
            }
        });

        next();
    };
};

/**
 * ===================================
 * キャッシュ統計ミドルウェア
 * ===================================
 */

/**
 * レスポンスヘッダーにキャッシュ統計追加
 */
const addCacheStatsHeader = () => {
    return async (req, res, next) => {
        try {
            const stats = await cacheService.getStats();
            res.set('X-Cache-Hit-Rate', stats.metrics.hitRate || '0%');
            res.set('X-Cache-Total-Commands', stats.metrics.totalCommands || 0);
        } catch (error) {
            // エラーは無視（統計は必須ではない）
        }

        next();
    };
};

module.exports = {
    // レスポンスキャッシング
    cacheResponse,

    // 認証キャッシング
    cacheJWT,

    // レシピキャッシング
    cacheRecipeDetail,
    cacheRecipeList,

    // ダッシュボードキャッシング
    cacheDashboard,

    // 検索キャッシング
    cacheSearchResults,

    // カテゴリキャッシング
    cacheCategories,

    // キャッシュ無効化
    invalidateRecipeCache,
    invalidateUserCache,

    // 統計
    addCacheStatsHeader
};
