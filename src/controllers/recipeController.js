const Recipe = require('../models/Recipe');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { recipeCacheManager } = require('../utils/recipe-cache');

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

exports.createRecipe = async (req, res, next) => {
  try {
    const recipeData = { ...req.body };
    if (req.imageUrl) {
      recipeData.image_url = req.imageUrl;
    }
    
    // Parse ingredients if they come as JSON string
    if (typeof recipeData.ingredients === 'string') {
      recipeData.ingredients = JSON.parse(recipeData.ingredients);
    }
    
    const recipe = await Recipe.create(recipeData, req.userId);
    res.status(201).json({
      message: 'Recipe created successfully',
      recipe
    });
  } catch (error) {
    next(error);
  }
};

exports.getRecipes = async (req, res, next) => {
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
    
    // キャッシュから検索
    let recipes;
    
    if (req.userId) {
      // 認証ユーザー: ユーザー別キャッシュ
      recipes = await recipeCacheManager.getCachedUserRecipes(req.userId, { ...filters, ...pagination });
    } else {
      // 未認証ユーザー: パブリックキャッシュ
      recipes = await recipeCacheManager.getCachedPublicRecipes(filters, pagination);
    }
    
    if (!recipes) {
      // キャッシュミス: DBから取得
      const startTime = process.hrtime.bigint();
      recipes = await Recipe.findAll(req.userId, filters, pagination);
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      
      // パフォーマンスログ
      if (duration > 100) { // 100ms超過
        console.warn(`DB検索時間超過: ${duration.toFixed(3)}ms`);
      }
      
      // 結果をキャッシュ
      if (req.userId) {
        await recipeCacheManager.cacheUserRecipes(req.userId, recipes, { ...filters, ...pagination });
      } else {
        await recipeCacheManager.cachePublicRecipes(recipes, filters, pagination);
      }
      
      res.set('X-Cache', 'MISS');
    } else {
      res.set('X-Cache', 'HIT');
    }
    
    res.json({ 
      recipes,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: recipes.length
      },
      performance: {
        cached: !!res.get('X-Cache')?.includes('HIT')
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getRecipe = async (req, res, next) => {
  try {
    const recipeId = req.params.id;
    
    // キャッシュから検索
    let recipe = await recipeCacheManager.getCachedRecipe(recipeId);
    
    if (!recipe) {
      // キャッシュミス: DBから取得
      const startTime = process.hrtime.bigint();
      recipe = await Recipe.findById(recipeId, req.userId);
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      
      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }
      
      // パフォーマンスログ
      if (duration > 50) { // 50ms超過
        console.warn(`レシピ詳細取得時間超過: ${duration.toFixed(3)}ms`);
      }
      
      // 結果をキャッシュ
      await recipeCacheManager.cacheRecipe(recipeId, recipe);
      res.set('X-Cache', 'MISS');
    } else {
      res.set('X-Cache', 'HIT');
    }
    
    res.json({ 
      recipe,
      performance: {
        cached: !!res.get('X-Cache')?.includes('HIT')
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateRecipe = async (req, res, next) => {
  try {
    const recipeData = { ...req.body };
    if (req.imageUrl) {
      recipeData.image_url = req.imageUrl;
    }
    
    // Parse ingredients if they come as JSON string
    if (typeof recipeData.ingredients === 'string') {
      recipeData.ingredients = JSON.parse(recipeData.ingredients);
    }
    
    const updated = await Recipe.update(req.params.id, req.userId, recipeData);
    if (!updated) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    res.json({
      message: 'Recipe updated successfully',
      recipe: updated
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteRecipe = async (req, res, next) => {
  try {
    const deleted = await Recipe.delete(req.params.id, req.userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.toggleFavorite = async (req, res, next) => {
  try {
    const updated = await Recipe.toggleFavorite(req.params.id, req.userId);
    if (!updated) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    res.json({ message: 'Favorite status updated' });
  } catch (error) {
    next(error);
  }
};

exports.updateRating = async (req, res, next) => {
  try {
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    const updated = await Recipe.updateRating(req.params.id, req.userId, rating);
    if (!updated) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    res.json({ message: 'Rating updated successfully' });
  } catch (error) {
    next(error);
  }
};