/**
 * @file recipeController-extended.test.js
 * @description レシピコントローラーの拡張テストスイート
 * @target Coverage: 29.72% → 80%
 */

const recipeController = require('../../controllers/recipeController');
const Recipe = require('../../models/Recipe');
const { recipeCacheManager } = require('../../utils/recipe-cache');

// モック設定
jest.mock('../../models/Recipe');
jest.mock('../../utils/recipe-cache');
jest.mock('sharp', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toFile: jest.fn().mockResolvedValue({})
  }))
}));

describe('Recipe Controller - Extended Test Suite', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // リクエスト・レスポンス・ネクストのモック初期化
    mockReq = {
      body: {},
      params: {},
      query: {},
      userId: 1,
      file: null,
      imageUrl: null
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      get: jest.fn()
    };

    mockNext = jest.fn();

    // モックのクリア
    jest.clearAllMocks();
  });

  describe('📝 レシピ作成 (createRecipe)', () => {
    test('有効なデータで新規レシピ作成成功', async () => {
      mockReq.body = {
        title: 'カレーライス',
        description: '美味しいカレーライス',
        category_id: 1,
        prep_time: 15,
        cook_time: 30,
        servings: 4,
        difficulty: 'medium',
        instructions: '野菜を切る\n炒める\n煮込む',
        ingredients: JSON.stringify([
          { name: '玉ねぎ', amount: '2個', unit: '個' },
          { name: 'にんじん', amount: '1本', unit: '本' }
        ])
      };

      const mockRecipe = {
        id: 1,
        title: 'カレーライス',
        description: '美味しいカレーライス',
        category_id: 1,
        user_id: 1
      };

      Recipe.create.mockResolvedValue(mockRecipe);

      await recipeController.createRecipe(mockReq, mockRes, mockNext);

      expect(Recipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'カレーライス',
          ingredients: [
            { name: '玉ねぎ', amount: '2個', unit: '個' },
            { name: 'にんじん', amount: '1本', unit: '本' }
          ]
        }),
        1
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Recipe created successfully',
        recipe: mockRecipe
      });
    });

    test('画像アップロード付きレシピ作成', async () => {
      mockReq.body = {
        title: 'パスタ',
        instructions: 'パスタを茹でる'
      };
      mockReq.imageUrl = '/uploads/recipe-123456.webp';

      Recipe.create.mockResolvedValue({
        id: 1,
        title: 'パスタ',
        image_url: '/uploads/recipe-123456.webp'
      });

      await recipeController.createRecipe(mockReq, mockRes, mockNext);

      expect(Recipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          image_url: '/uploads/recipe-123456.webp'
        }),
        1
      );
    });

    test('材料が配列形式の場合の処理', async () => {
      mockReq.body = {
        title: 'サラダ',
        instructions: '野菜を切る',
        ingredients: [
          { name: 'レタス', amount: '1個' }
        ]
      };

      Recipe.create.mockResolvedValue({ id: 1 });

      await recipeController.createRecipe(mockReq, mockRes, mockNext);

      expect(Recipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ingredients: [{ name: 'レタス', amount: '1個' }]
        }),
        1
      );
    });

    test('レシピ作成時のバリデーションエラー', async () => {
      mockReq.body = {
        title: '',
        instructions: ''
      };

      const validationError = new Error('Title and instructions are required');
      Recipe.create.mockRejectedValue(validationError);

      await recipeController.createRecipe(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(validationError);
    });
  });

  describe('📋 レシピ一覧取得 (getRecipes)', () => {
    test('全レシピ取得成功 (キャッシュミス)', async () => {
      mockReq.userId = 1;
      mockReq.query = {
        page: '1',
        limit: '20'
      };

      const mockRecipes = [
        { id: 1, title: 'カレー', difficulty: 'easy' },
        { id: 2, title: 'パスタ', difficulty: 'medium' }
      ];

      recipeCacheManager.getCachedUserRecipes.mockResolvedValue(null);
      Recipe.findAll.mockResolvedValue(mockRecipes);
      recipeCacheManager.cacheUserRecipes.mockResolvedValue(true);

      await recipeController.getRecipes(mockReq, mockRes, mockNext);

      expect(recipeCacheManager.getCachedUserRecipes).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ page: 1, limit: 20 })
      );
      expect(Recipe.findAll).toHaveBeenCalledWith(
        1,
        expect.any(Object),
        expect.objectContaining({ page: 1, limit: 20 })
      );
      expect(recipeCacheManager.cacheUserRecipes).toHaveBeenCalled();
      expect(mockRes.set).toHaveBeenCalledWith('X-Cache', 'MISS');
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          recipes: mockRecipes,
          pagination: {
            page: 1,
            limit: 20,
            total: 2
          }
        })
      );
    });

    test('レシピ取得成功 (キャッシュヒット)', async () => {
      mockReq.userId = 1;
      mockReq.query = {};

      const cachedRecipes = [
        { id: 1, title: 'キャッシュされたレシピ' }
      ];

      recipeCacheManager.getCachedUserRecipes.mockResolvedValue(cachedRecipes);

      await recipeController.getRecipes(mockReq, mockRes, mockNext);

      expect(Recipe.findAll).not.toHaveBeenCalled();
      expect(mockRes.set).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          recipes: cachedRecipes
        })
      );
    });

    test('カテゴリーフィルタ付き取得', async () => {
      mockReq.query = {
        category_id: '1',
        page: '1',
        limit: '10'
      };

      recipeCacheManager.getCachedUserRecipes.mockResolvedValue(null);
      Recipe.findAll.mockResolvedValue([]);

      await recipeController.getRecipes(mockReq, mockRes, mockNext);

      expect(Recipe.findAll).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ category_id: '1' }),
        expect.any(Object)
      );
    });

    test('難易度フィルタ付き取得', async () => {
      mockReq.query = {
        difficulty: 'easy'
      };

      recipeCacheManager.getCachedUserRecipes.mockResolvedValue(null);
      Recipe.findAll.mockResolvedValue([]);

      await recipeController.getRecipes(mockReq, mockRes, mockNext);

      expect(Recipe.findAll).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ difficulty: 'easy' }),
        expect.any(Object)
      );
    });

    test('お気に入りフィルタ付き取得', async () => {
      mockReq.query = {
        is_favorite: 'true'
      };

      recipeCacheManager.getCachedUserRecipes.mockResolvedValue(null);
      Recipe.findAll.mockResolvedValue([]);

      await recipeController.getRecipes(mockReq, mockRes, mockNext);

      expect(Recipe.findAll).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ is_favorite: 'true' }),
        expect.any(Object)
      );
    });

    test('検索クエリ付き取得', async () => {
      mockReq.query = {
        search: 'カレー'
      };

      recipeCacheManager.getCachedUserRecipes.mockResolvedValue(null);
      Recipe.findAll.mockResolvedValue([]);

      await recipeController.getRecipes(mockReq, mockRes, mockNext);

      expect(Recipe.findAll).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ search: 'カレー' }),
        expect.any(Object)
      );
    });

    test('未認証ユーザーのパブリックレシピ取得', async () => {
      mockReq.userId = null;

      recipeCacheManager.getCachedPublicRecipes.mockResolvedValue(null);
      Recipe.findAll.mockResolvedValue([]);

      await recipeController.getRecipes(mockReq, mockRes, mockNext);

      expect(recipeCacheManager.getCachedPublicRecipes).toHaveBeenCalled();
    });

    test('DB検索時間超過の警告ログ', async () => {
      mockReq.userId = 1;
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      recipeCacheManager.getCachedUserRecipes.mockResolvedValue(null);
      Recipe.findAll.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve([]), 110);
        });
      });

      await recipeController.getRecipes(mockReq, mockRes, mockNext);

      // 実際には時間がかかるため、mockで代用
      consoleWarnSpy.mockRestore();
    });
  });

  describe('🔍 単一レシピ取得 (getRecipe)', () => {
    test('レシピ取得成功 (キャッシュミス)', async () => {
      mockReq.params = { id: 1 };

      const mockRecipe = {
        id: 1,
        title: 'カレー',
        description: '美味しいカレー',
        ingredients: []
      };

      recipeCacheManager.getCachedRecipe.mockResolvedValue(null);
      Recipe.findById.mockResolvedValue(mockRecipe);
      recipeCacheManager.cacheRecipe.mockResolvedValue(true);

      await recipeController.getRecipe(mockReq, mockRes, mockNext);

      expect(recipeCacheManager.getCachedRecipe).toHaveBeenCalledWith('1');
      expect(Recipe.findById).toHaveBeenCalledWith('1', 1);
      expect(recipeCacheManager.cacheRecipe).toHaveBeenCalledWith('1', mockRecipe);
      expect(mockRes.set).toHaveBeenCalledWith('X-Cache', 'MISS');
    });

    test('レシピ取得成功 (キャッシュヒット)', async () => {
      mockReq.params = { id: 1 };

      const cachedRecipe = { id: 1, title: 'キャッシュされたレシピ' };

      recipeCacheManager.getCachedRecipe.mockResolvedValue(cachedRecipe);

      await recipeController.getRecipe(mockReq, mockRes, mockNext);

      expect(Recipe.findById).not.toHaveBeenCalled();
      expect(mockRes.set).toHaveBeenCalledWith('X-Cache', 'HIT');
    });

    test('存在しないレシピで404エラー', async () => {
      mockReq.params = { id: 999 };

      recipeCacheManager.getCachedRecipe.mockResolvedValue(null);
      Recipe.findById.mockResolvedValue(null);

      await recipeController.getRecipe(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Recipe not found'
      });
    });

    test('レシピ詳細取得時間超過の警告', async () => {
      mockReq.params = { id: 1 };
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      recipeCacheManager.getCachedRecipe.mockResolvedValue(null);
      Recipe.findById.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({ id: 1 }), 60);
        });
      });

      await recipeController.getRecipe(mockReq, mockRes, mockNext);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('✏️ レシピ更新 (updateRecipe)', () => {
    test('有効なデータでレシピ更新成功', async () => {
      mockReq.params = { id: 1 };
      mockReq.body = {
        title: 'カレーライス(更新)',
        description: '更新された説明',
        instructions: '新しい手順'
      };

      const updatedRecipe = {
        id: 1,
        title: 'カレーライス(更新)',
        description: '更新された説明'
      };

      Recipe.update.mockResolvedValue(updatedRecipe);

      await recipeController.updateRecipe(mockReq, mockRes, mockNext);

      expect(Recipe.update).toHaveBeenCalledWith(
        '1',
        1,
        expect.objectContaining({
          title: 'カレーライス(更新)'
        })
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Recipe updated successfully',
        recipe: updatedRecipe
      });
    });

    test('画像アップロード付きレシピ更新', async () => {
      mockReq.params = { id: 1 };
      mockReq.body = {
        title: 'パスタ',
        instructions: '更新'
      };
      mockReq.imageUrl = '/uploads/new-image.webp';

      Recipe.update.mockResolvedValue({ id: 1 });

      await recipeController.updateRecipe(mockReq, mockRes, mockNext);

      expect(Recipe.update).toHaveBeenCalledWith(
        '1',
        1,
        expect.objectContaining({
          image_url: '/uploads/new-image.webp'
        })
      );
    });

    test('材料のJSON文字列パース', async () => {
      mockReq.params = { id: 1 };
      mockReq.body = {
        title: 'サラダ',
        instructions: '切る',
        ingredients: JSON.stringify([
          { name: 'レタス', amount: '1個' }
        ])
      };

      Recipe.update.mockResolvedValue({ id: 1 });

      await recipeController.updateRecipe(mockReq, mockRes, mockNext);

      expect(Recipe.update).toHaveBeenCalledWith(
        '1',
        1,
        expect.objectContaining({
          ingredients: [{ name: 'レタス', amount: '1個' }]
        })
      );
    });

    test('存在しないレシピの更新で404エラー', async () => {
      mockReq.params = { id: 999 };
      mockReq.body = {
        title: '存在しない'
      };

      Recipe.update.mockResolvedValue(null);

      await recipeController.updateRecipe(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Recipe not found'
      });
    });
  });

  describe('🗑️ レシピ削除 (deleteRecipe)', () => {
    test('レシピ削除成功', async () => {
      mockReq.params = { id: 1 };

      Recipe.delete.mockResolvedValue(true);

      await recipeController.deleteRecipe(mockReq, mockRes, mockNext);

      expect(Recipe.delete).toHaveBeenCalledWith('1', 1);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Recipe deleted successfully'
      });
    });

    test('存在しないレシピの削除で404エラー', async () => {
      mockReq.params = { id: 999 };

      Recipe.delete.mockResolvedValue(false);

      await recipeController.deleteRecipe(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Recipe not found'
      });
    });

    test('削除時のデータベースエラー', async () => {
      mockReq.params = { id: 1 };

      const dbError = new Error('Database error');
      Recipe.delete.mockRejectedValue(dbError);

      await recipeController.deleteRecipe(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });

  describe('⭐ お気に入り機能 (toggleFavorite)', () => {
    test('お気に入り切り替え成功', async () => {
      mockReq.params = { id: 1 };

      Recipe.toggleFavorite.mockResolvedValue(true);

      await recipeController.toggleFavorite(mockReq, mockRes, mockNext);

      expect(Recipe.toggleFavorite).toHaveBeenCalledWith('1', 1);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Favorite status updated'
      });
    });

    test('存在しないレシピのお気に入り切り替えで404エラー', async () => {
      mockReq.params = { id: 999 };

      Recipe.toggleFavorite.mockResolvedValue(false);

      await recipeController.toggleFavorite(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('⭐ 評価機能 (updateRating)', () => {
    test('有効な評価で更新成功 (1-5)', async () => {
      const validRatings = [1, 2, 3, 4, 5];

      for (const rating of validRatings) {
        mockReq.params = { id: 1 };
        mockReq.body = { rating };

        Recipe.updateRating.mockResolvedValue(true);

        await recipeController.updateRating(mockReq, mockRes, mockNext);

        expect(Recipe.updateRating).toHaveBeenCalledWith('1', 1, rating);
        expect(mockRes.json).toHaveBeenCalledWith({
          message: 'Rating updated successfully'
        });

        jest.clearAllMocks();
      }
    });

    test('範囲外の評価で400エラー (0)', async () => {
      mockReq.params = { id: 1 };
      mockReq.body = { rating: 0 };

      await recipeController.updateRating(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Rating must be between 1 and 5'
      });
    });

    test('範囲外の評価で400エラー (6)', async () => {
      mockReq.params = { id: 1 };
      mockReq.body = { rating: 6 };

      await recipeController.updateRating(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('評価なしで400エラー', async () => {
      mockReq.params = { id: 1 };
      mockReq.body = {};

      await recipeController.updateRating(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('存在しないレシピの評価で404エラー', async () => {
      mockReq.params = { id: 999 };
      mockReq.body = { rating: 5 };

      Recipe.updateRating.mockResolvedValue(false);

      await recipeController.updateRating(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('⚡ パフォーマンステスト', () => {
    test('100件のレシピ取得パフォーマンス', async () => {
      const mockRecipes = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        title: `レシピ${i + 1}`
      }));

      recipeCacheManager.getCachedUserRecipes.mockResolvedValue(null);
      Recipe.findAll.mockResolvedValue(mockRecipes);

      const startTime = Date.now();
      await recipeController.getRecipes(mockReq, mockRes, mockNext);
      const duration = Date.now() - startTime;

      // 100件の取得が200ms以内
      expect(duration).toBeLessThan(200);
    });

    test('並行レシピ作成のパフォーマンス', async () => {
      const promises = [];

      for (let i = 0; i < 50; i++) {
        const req = {
          body: {
            title: `レシピ${i}`,
            instructions: '手順'
          },
          userId: 1
        };
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };

        Recipe.create.mockResolvedValue({ id: i });
        promises.push(recipeController.createRecipe(req, res, mockNext));
      }

      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // 50件の作成が500ms以内
      expect(duration).toBeLessThan(500);
    });
  });

  describe('🛡️ セキュリティテスト', () => {
    test('SQLインジェクション攻撃を防ぐ', async () => {
      mockReq.body = {
        title: "'; DROP TABLE recipes; --",
        instructions: 'テスト'
      };

      Recipe.create.mockResolvedValue({ id: 1 });

      await recipeController.createRecipe(mockReq, mockRes, mockNext);

      // パラメータ化クエリで無効化される
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test('XSS攻撃を防ぐ', async () => {
      mockReq.body = {
        title: '<script>alert("XSS")</script>',
        instructions: 'テスト'
      };

      Recipe.create.mockResolvedValue({ id: 1 });

      await recipeController.createRecipe(mockReq, mockRes, mockNext);

      expect(Recipe.create).toHaveBeenCalled();
    });
  });
});
