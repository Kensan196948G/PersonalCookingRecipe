/**
 * 強化版レシピコントローラー - PersonalCookingRecipe Phase 2 Week 1
 * Redisキャッシング統合版（Write-Through + Cache-Aside戦略）
 *
 * @author Backend API Developer
 * @version 2.0.0
 */

const Recipe = require('../models/Recipe');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { cacheService } = require('../services/cacheService');

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
}).single('image');

exports.uploadImage = upload;

/**
 * 画像処理ミドルウェア
 */
exports.processImage = async (req, res, next) => {
    if (!req.file) return next();

    try {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filename = `recipe-${Date.now()}-${Math.round(Math.random() * 1000)}.webp`;
        const filepath = path.join(uploadDir, filename);

        await sharp(req.file.buffer)
            .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(filepath);

        req.imageUrl = `/uploads/${filename}`;
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * レシピ作成
 * Strategy: Write-Through（DB保存 + 即座にキャッシュ）
 */
exports.createRecipe = async (req, res, next) => {
    const startTime = Date.now();

    try {
        const recipeData = { ...req.body };
        if (req.imageUrl) {
            recipeData.image_url = req.imageUrl;
        }

        // Parse ingredients if they come as JSON string
        if (typeof recipeData.ingredients === 'string') {
            recipeData.ingredients = JSON.parse(recipeData.ingredients);
        }

        // DB保存
        const recipe = await Recipe.create(recipeData, req.userId);

        // 即座にキャッシュ（Write-Through戦略）
        await cacheService.cacheRecipe(recipe.id, recipe);

        // ユーザーレシピリストキャッシュ無効化
        await cacheService.invalidateUserRecipes(req.userId);

        const responseTime = Date.now() - startTime;
        console.log(`Recipe created and cached: ${recipe.id} (${responseTime}ms)`);

        res.status(201).json({
            message: 'Recipe created successfully',
            recipe,
            performance: {
                responseTime: `${responseTime}ms`,
                cacheStrategy: 'write-through'
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * レシピ一覧取得
 * Strategy: Cache-Aside（キャッシュ優先、ミス時DB取得）
 * TTL: 30分
 */
exports.getRecipes = async (req, res, next) => {
    const startTime = Date.now();

    try {
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

        const userId = req.userId || null;

        // キャッシュ確認
        let recipes = await cacheService.getCachedRecipeList(userId, filters, pagination);
        let fromCache = false;

        if (recipes) {
            // キャッシュヒット
            fromCache = true;
            console.log(`Recipe list Cache HIT: User ${userId}`);
        } else {
            // キャッシュミス: DBから取得
            const dbStartTime = Date.now();
            recipes = await Recipe.findAll(userId, filters, pagination);
            const dbDuration = Date.now() - dbStartTime;

            // パフォーマンスログ
            if (dbDuration > 100) { // 100ms超過
                console.warn(`DB検索時間超過: ${dbDuration}ms`);
            }

            // 結果をキャッシュ
            await cacheService.cacheRecipeList(userId, filters, pagination, recipes);

            console.log(`Recipe list Cache MISS: User ${userId} (DB: ${dbDuration}ms)`);
        }

        const responseTime = Date.now() - startTime;

        res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
        res.set('X-Cache-Strategy', 'Cache-Aside');
        res.json({
            recipes,
            pagination: {
                page: pagination.page,
                limit: pagination.limit,
                total: recipes.length
            },
            performance: {
                responseTime: `${responseTime}ms`,
                cached: fromCache,
                cacheStrategy: 'cache-aside'
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * レシピ詳細取得
 * Strategy: Write-Through（読み込み時キャッシュ、更新時即座反映）
 * TTL: 1時間
 */
exports.getRecipe = async (req, res, next) => {
    const startTime = Date.now();

    try {
        const recipeId = req.params.id;

        // キャッシュ確認
        let recipe = await cacheService.getCachedRecipe(recipeId);
        let fromCache = false;

        if (recipe) {
            // キャッシュヒット
            fromCache = true;
            console.log(`Recipe detail Cache HIT: ${recipeId}`);
        } else {
            // キャッシュミス: DBから取得
            const dbStartTime = Date.now();
            recipe = await Recipe.findById(recipeId, req.userId);
            const dbDuration = Date.now() - dbStartTime;

            if (!recipe) {
                return res.status(404).json({ error: 'Recipe not found' });
            }

            // パフォーマンスログ
            if (dbDuration > 50) { // 50ms超過
                console.warn(`レシピ詳細取得時間超過: ${dbDuration}ms`);
            }

            // 結果をキャッシュ（Write-Through戦略）
            await cacheService.cacheRecipe(recipeId, recipe);

            console.log(`Recipe detail Cache MISS: ${recipeId} (DB: ${dbDuration}ms)`);
        }

        const responseTime = Date.now() - startTime;

        res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
        res.set('X-Cache-Strategy', 'Write-Through');
        res.json({
            recipe,
            performance: {
                responseTime: `${responseTime}ms`,
                cached: fromCache,
                cacheStrategy: 'write-through'
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * レシピ更新
 * Strategy: Write-Through（DB更新 + 即座にキャッシュ更新）
 */
exports.updateRecipe = async (req, res, next) => {
    const startTime = Date.now();

    try {
        const recipeId = req.params.id;
        const recipeData = { ...req.body };

        if (req.imageUrl) {
            recipeData.image_url = req.imageUrl;
        }

        // Parse ingredients if they come as JSON string
        if (typeof recipeData.ingredients === 'string') {
            recipeData.ingredients = JSON.parse(recipeData.ingredients);
        }

        // DB更新
        const updated = await Recipe.update(recipeId, req.userId, recipeData);

        if (!updated) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        // キャッシュ更新（Write-Through戦略）
        await cacheService.cacheRecipe(recipeId, updated);

        // 関連キャッシュ無効化
        await cacheService.invalidateUserRecipes(req.userId);

        const responseTime = Date.now() - startTime;
        console.log(`Recipe updated and cache refreshed: ${recipeId} (${responseTime}ms)`);

        res.json({
            message: 'Recipe updated successfully',
            recipe: updated,
            performance: {
                responseTime: `${responseTime}ms`,
                cacheStrategy: 'write-through'
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * レシピ削除
 * キャッシング: 削除後にキャッシュ無効化
 */
exports.deleteRecipe = async (req, res, next) => {
    const startTime = Date.now();

    try {
        const recipeId = req.params.id;

        // DB削除
        const deleted = await Recipe.delete(recipeId, req.userId);

        if (!deleted) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        // キャッシュ無効化
        await cacheService.invalidateRecipe(recipeId);
        await cacheService.invalidateUserRecipes(req.userId);

        const responseTime = Date.now() - startTime;
        console.log(`Recipe deleted and cache invalidated: ${recipeId} (${responseTime}ms)`);

        res.json({
            message: 'Recipe deleted successfully',
            performance: {
                responseTime: `${responseTime}ms`
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * お気に入りトグル
 * キャッシング: 更新後にキャッシュ更新
 */
exports.toggleFavorite = async (req, res, next) => {
    const startTime = Date.now();

    try {
        const recipeId = req.params.id;

        // DB更新
        const updated = await Recipe.toggleFavorite(recipeId, req.userId);

        if (!updated) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        // キャッシュ更新
        await cacheService.cacheRecipe(recipeId, updated);
        await cacheService.invalidateUserRecipes(req.userId);

        const responseTime = Date.now() - startTime;
        console.log(`Favorite toggled and cache updated: ${recipeId} (${responseTime}ms)`);

        res.json({
            message: 'Favorite status updated',
            recipe: updated,
            performance: {
                responseTime: `${responseTime}ms`
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * 評価更新
 * キャッシング: 更新後にキャッシュ更新
 */
exports.updateRating = async (req, res, next) => {
    const startTime = Date.now();

    try {
        const { rating } = req.body;
        const recipeId = req.params.id;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        // DB更新
        const updated = await Recipe.updateRating(recipeId, req.userId, rating);

        if (!updated) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        // キャッシュ更新
        await cacheService.cacheRecipe(recipeId, updated);

        const responseTime = Date.now() - startTime;
        console.log(`Rating updated and cache refreshed: ${recipeId} (${responseTime}ms)`);

        res.json({
            message: 'Rating updated successfully',
            recipe: updated,
            performance: {
                responseTime: `${responseTime}ms`
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * 検索
 * Strategy: Cache-Aside（検索結果キャッシング）
 * TTL: 10分
 */
exports.searchRecipes = async (req, res, next) => {
    const startTime = Date.now();

    try {
        const query = req.query.q || req.query.query || '';
        const filters = {
            category: req.query.category,
            difficulty: req.query.difficulty,
            tags: req.query.tags
        };

        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // キャッシュ確認
        let results = await cacheService.getCachedSearchResults(query, filters);
        let fromCache = false;

        if (results) {
            // キャッシュヒット
            fromCache = true;
            console.log(`Search Cache HIT: "${query}"`);
        } else {
            // キャッシュミス: DBから検索
            const dbStartTime = Date.now();

            // 検索実装（仮）
            results = await Recipe.search(query, filters, req.userId);

            const dbDuration = Date.now() - dbStartTime;

            // 結果をキャッシュ
            await cacheService.cacheSearchResults(query, filters, results);

            console.log(`Search Cache MISS: "${query}" (DB: ${dbDuration}ms)`);
        }

        const responseTime = Date.now() - startTime;

        res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
        res.set('X-Cache-Strategy', 'Cache-Aside');
        res.json({
            results,
            query,
            filters,
            count: results.length,
            performance: {
                responseTime: `${responseTime}ms`,
                cached: fromCache,
                cacheStrategy: 'cache-aside'
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * ダッシュボードデータ取得
 * Strategy: Refresh-Ahead（先読み更新）
 * TTL: 15分
 */
exports.getDashboard = async (req, res, next) => {
    const startTime = Date.now();

    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Refresh-Ahead コールバック
        const refreshCallback = async (uid) => {
            // ダッシュボードデータ取得（仮実装）
            const [recipes, favorites, recent] = await Promise.all([
                Recipe.findAll(uid, {}, { limit: 10 }),
                Recipe.findAll(uid, { is_favorite: true }, { limit: 5 }),
                Recipe.findAll(uid, {}, { limit: 5, sortBy: 'created_at' })
            ]);

            return {
                recipes,
                favorites,
                recent,
                stats: {
                    totalRecipes: recipes.length,
                    totalFavorites: favorites.length
                }
            };
        };

        // キャッシュ確認（Refresh-Ahead戦略）
        let dashboard = await cacheService.getCachedDashboard(userId, refreshCallback);
        let fromCache = false;

        if (dashboard) {
            // キャッシュヒット
            fromCache = true;
            console.log(`Dashboard Cache HIT: User ${userId}`);
        } else {
            // キャッシュミス: データ取得
            dashboard = await refreshCallback(userId);

            // キャッシュに保存
            await cacheService.cacheDashboard(userId, dashboard);

            console.log(`Dashboard Cache MISS: User ${userId}`);
        }

        const responseTime = Date.now() - startTime;

        res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
        res.set('X-Cache-Strategy', 'Refresh-Ahead');
        res.json({
            ...dashboard,
            performance: {
                responseTime: `${responseTime}ms`,
                cached: fromCache,
                cacheStrategy: 'refresh-ahead'
            }
        });

    } catch (error) {
        next(error);
    }
};
