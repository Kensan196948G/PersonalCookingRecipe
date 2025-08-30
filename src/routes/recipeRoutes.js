const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');
const { optionalAuth, requireAuth } = require('../middleware/unifiedAuth');
const { validateRecipe } = require('../middleware/validation');

// パブリック（認証不要）ルート - レシピ閲覧系
// レシピ一覧取得（認証オプショナル - ログイン時はお気に入りや個人情報も含む）
router.get('/', optionalAuth, recipeController.getRecipes);
// レシピ詳細取得（認証オプショナル）
router.get('/:id', optionalAuth, recipeController.getRecipe);

// プライベート（認証必須）ルート - レシピ作成・編集系
// レシピ作成
router.post('/', requireAuth, recipeController.uploadImage, recipeController.processImage, validateRecipe, recipeController.createRecipe);
// レシピ更新
router.put('/:id', requireAuth, recipeController.uploadImage, recipeController.processImage, validateRecipe, recipeController.updateRecipe);
// レシピ削除
router.delete('/:id', requireAuth, recipeController.deleteRecipe);
// お気に入り切り替え
router.put('/:id/favorite', requireAuth, recipeController.toggleFavorite);
// 評価更新
router.put('/:id/rating', requireAuth, recipeController.updateRating);


module.exports = router;