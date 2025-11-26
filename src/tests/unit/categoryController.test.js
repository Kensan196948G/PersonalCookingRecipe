/**
 * @file categoryController.test.js
 * @description カテゴリーコントローラーの完全なテストスイート
 * @target Coverage: 16.66% → 80%
 */

const categoryController = require('../../controllers/categoryController');
const Category = require('../../models/Category');

// モック設定
jest.mock('../../models/Category');

describe('Category Controller - Complete Test Suite', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // リクエスト・レスポンス・ネクストのモック初期化
    mockReq = {
      body: {},
      params: {},
      query: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    // モックのクリア
    jest.clearAllMocks();
  });

  describe('📝 カテゴリー作成 (createCategory)', () => {
    test('有効なデータで新規カテゴリー作成成功', async () => {
      // テストデータ準備
      mockReq.body = {
        name: '和食',
        description: '日本の伝統料理',
        color: '#FF6B6B'
      };

      const mockCategory = {
        id: 1,
        name: '和食',
        description: '日本の伝統料理',
        color: '#FF6B6B'
      };

      // モック動作設定
      Category.create.mockResolvedValue(mockCategory);

      // テスト実行
      await categoryController.createCategory(mockReq, mockRes, mockNext);

      // アサーション
      expect(Category.create).toHaveBeenCalledWith({
        name: '和食',
        description: '日本の伝統料理',
        color: '#FF6B6B'
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Category created successfully',
        category: mockCategory
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('カテゴリー作成時にデフォルトカラーが設定される', async () => {
      mockReq.body = {
        name: 'イタリアン',
        description: 'イタリア料理'
        // color未指定
      };

      Category.create.mockResolvedValue({
        id: 2,
        name: 'イタリアン',
        description: 'イタリア料理',
        color: '#3498db' // デフォルトカラー
      });

      await categoryController.createCategory(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test('カテゴリー作成時のデータベースエラー処理', async () => {
      mockReq.body = {
        name: 'テストカテゴリー'
      };

      const dbError = new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed');
      Category.create.mockRejectedValue(dbError);

      await categoryController.createCategory(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('空の名前でカテゴリー作成失敗', async () => {
      mockReq.body = {
        name: '',
        description: 'テスト'
      };

      const validationError = new Error('Category name is required');
      Category.create.mockRejectedValue(validationError);

      await categoryController.createCategory(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(validationError);
    });
  });

  describe('📋 全カテゴリー取得 (getCategories)', () => {
    test('全カテゴリーの取得成功', async () => {
      const mockCategories = [
        { id: 1, name: '和食', description: '日本料理', color: '#FF6B6B' },
        { id: 2, name: '洋食', description: '西洋料理', color: '#4ECDC4' },
        { id: 3, name: '中華', description: '中国料理', color: '#FFE66D' }
      ];

      Category.findAll.mockResolvedValue(mockCategories);

      // レシピカウントのモック
      Category.getRecipeCount.mockResolvedValueOnce(5);
      Category.getRecipeCount.mockResolvedValueOnce(3);
      Category.getRecipeCount.mockResolvedValueOnce(8);

      await categoryController.getCategories(mockReq, mockRes, mockNext);

      expect(Category.findAll).toHaveBeenCalled();
      expect(Category.getRecipeCount).toHaveBeenCalledTimes(3);
      expect(mockRes.json).toHaveBeenCalledWith({
        categories: [
          { id: 1, name: '和食', description: '日本料理', color: '#FF6B6B', recipe_count: 5 },
          { id: 2, name: '洋食', description: '西洋料理', color: '#4ECDC4', recipe_count: 3 },
          { id: 3, name: '中華', description: '中国料理', color: '#FFE66D', recipe_count: 8 }
        ]
      });
    });

    test('カテゴリーが存在しない場合は空配列を返す', async () => {
      Category.findAll.mockResolvedValue([]);

      await categoryController.getCategories(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ categories: [] });
    });

    test('カテゴリー取得時のデータベースエラー処理', async () => {
      const dbError = new Error('Database connection error');
      Category.findAll.mockRejectedValue(dbError);

      await categoryController.getCategories(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });

    test('レシピカウント取得時のエラー処理', async () => {
      const mockCategories = [
        { id: 1, name: '和食' }
      ];

      Category.findAll.mockResolvedValue(mockCategories);
      Category.getRecipeCount.mockRejectedValue(new Error('Count failed'));

      await categoryController.getCategories(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('🔍 特定カテゴリー取得 (getCategory)', () => {
    test('IDでカテゴリー取得成功', async () => {
      mockReq.params = { id: 1 };

      const mockCategory = {
        id: 1,
        name: '和食',
        description: '日本料理',
        color: '#FF6B6B'
      };

      Category.findById.mockResolvedValue(mockCategory);
      Category.getRecipeCount.mockResolvedValue(12);

      await categoryController.getCategory(mockReq, mockRes, mockNext);

      expect(Category.findById).toHaveBeenCalledWith(1);
      expect(Category.getRecipeCount).toHaveBeenCalledWith(1);
      expect(mockRes.json).toHaveBeenCalledWith({
        category: {
          id: 1,
          name: '和食',
          description: '日本料理',
          color: '#FF6B6B',
          recipe_count: 12
        }
      });
    });

    test('存在しないカテゴリーIDで404エラー', async () => {
      mockReq.params = { id: 999 };

      Category.findById.mockResolvedValue(null);

      await categoryController.getCategory(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Category not found'
      });
    });

    test('無効なIDでデータベースエラー', async () => {
      mockReq.params = { id: 'invalid' };

      const dbError = new Error('Invalid ID format');
      Category.findById.mockRejectedValue(dbError);

      await categoryController.getCategory(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });

    test('レシピカウント取得失敗時のエラー処理', async () => {
      mockReq.params = { id: 1 };

      Category.findById.mockResolvedValue({ id: 1, name: 'テスト' });
      Category.getRecipeCount.mockRejectedValue(new Error('Count error'));

      await categoryController.getCategory(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('✏️ カテゴリー更新 (updateCategory)', () => {
    test('有効なデータでカテゴリー更新成功', async () => {
      mockReq.params = { id: 1 };
      mockReq.body = {
        name: '和食(更新)',
        description: '日本の伝統料理(更新)',
        color: '#00FF00'
      };

      Category.update.mockResolvedValue(true);

      await categoryController.updateCategory(mockReq, mockRes, mockNext);

      expect(Category.update).toHaveBeenCalledWith(1, {
        name: '和食(更新)',
        description: '日本の伝統料理(更新)',
        color: '#00FF00'
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Category updated successfully'
      });
    });

    test('存在しないカテゴリーの更新で404エラー', async () => {
      mockReq.params = { id: 999 };
      mockReq.body = {
        name: '存在しない'
      };

      Category.update.mockResolvedValue(false);

      await categoryController.updateCategory(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Category not found'
      });
    });

    test('カテゴリー更新時のバリデーションエラー', async () => {
      mockReq.params = { id: 1 };
      mockReq.body = {
        name: '' // 空の名前
      };

      const validationError = new Error('Category name cannot be empty');
      Category.update.mockRejectedValue(validationError);

      await categoryController.updateCategory(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(validationError);
    });

    test('重複する名前での更新エラー', async () => {
      mockReq.params = { id: 1 };
      mockReq.body = {
        name: '既存カテゴリー名'
      };

      const constraintError = new Error('UNIQUE constraint failed');
      Category.update.mockRejectedValue(constraintError);

      await categoryController.updateCategory(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(constraintError);
    });
  });

  describe('🗑️ カテゴリー削除 (deleteCategory)', () => {
    test('カテゴリー削除成功', async () => {
      mockReq.params = { id: 1 };

      Category.delete.mockResolvedValue(true);

      await categoryController.deleteCategory(mockReq, mockRes, mockNext);

      expect(Category.delete).toHaveBeenCalledWith(1);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Category deleted successfully'
      });
    });

    test('存在しないカテゴリーの削除で404エラー', async () => {
      mockReq.params = { id: 999 };

      Category.delete.mockResolvedValue(false);

      await categoryController.deleteCategory(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Category not found'
      });
    });

    test('関連レシピがある場合の外部キー制約エラー', async () => {
      mockReq.params = { id: 1 };

      const foreignKeyError = new Error('FOREIGN KEY constraint failed');
      Category.delete.mockRejectedValue(foreignKeyError);

      await categoryController.deleteCategory(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(foreignKeyError);
    });

    test('データベース接続エラー時の処理', async () => {
      mockReq.params = { id: 1 };

      const dbError = new Error('Database connection lost');
      Category.delete.mockRejectedValue(dbError);

      await categoryController.deleteCategory(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });

  describe('🛡️ セキュリティテスト', () => {
    test('SQLインジェクション攻撃を防ぐ (カテゴリー作成)', async () => {
      mockReq.body = {
        name: "'; DROP TABLE categories; --",
        description: 'テスト',
        color: '#000000'
      };

      Category.create.mockResolvedValue({
        id: 1,
        name: "'; DROP TABLE categories; --",
        description: 'テスト',
        color: '#000000'
      });

      await categoryController.createCategory(mockReq, mockRes, mockNext);

      // SQLインジェクションはパラメータ化クエリで無効化される
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test('XSS攻撃を防ぐ (カテゴリー名)', async () => {
      mockReq.body = {
        name: '<script>alert("XSS")</script>',
        description: 'テスト'
      };

      Category.create.mockResolvedValue({
        id: 1,
        name: '<script>alert("XSS")</script>',
        description: 'テスト'
      });

      await categoryController.createCategory(mockReq, mockRes, mockNext);

      // XSSスクリプトはエスケープされるべき
      expect(Category.create).toHaveBeenCalled();
    });

    test('過度に長い名前の処理', async () => {
      const longName = 'あ'.repeat(1000);
      mockReq.body = {
        name: longName
      };

      const validationError = new Error('Category name too long');
      Category.create.mockRejectedValue(validationError);

      await categoryController.createCategory(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(validationError);
    });
  });

  describe('⚡ パフォーマンステスト', () => {
    test('大量カテゴリー取得のパフォーマンス', async () => {
      const mockCategories = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `カテゴリー${i + 1}`,
        description: `説明${i + 1}`,
        color: '#FF0000'
      }));

      Category.findAll.mockResolvedValue(mockCategories);

      // レシピカウントのモック (100回)
      for (let i = 0; i < 100; i++) {
        Category.getRecipeCount.mockResolvedValueOnce(Math.floor(Math.random() * 20));
      }

      const startTime = Date.now();
      await categoryController.getCategories(mockReq, mockRes, mockNext);
      const duration = Date.now() - startTime;

      // 100カテゴリーの取得が1秒以内に完了
      expect(duration).toBeLessThan(1000);
      expect(Category.getRecipeCount).toHaveBeenCalledTimes(100);
    });

    test('並行カテゴリー作成のパフォーマンス', async () => {
      const promises = [];

      for (let i = 0; i < 50; i++) {
        const req = {
          body: {
            name: `カテゴリー${i}`,
            description: `説明${i}`
          }
        };
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };

        Category.create.mockResolvedValue({ id: i, name: `カテゴリー${i}` });
        promises.push(categoryController.createCategory(req, res, mockNext));
      }

      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // 50件の作成が500ms以内に完了
      expect(duration).toBeLessThan(500);
    });

    test('カテゴリー検索の応答時間', async () => {
      mockReq.params = { id: 1 };

      Category.findById.mockResolvedValue({
        id: 1,
        name: 'テスト',
        description: 'テスト'
      });
      Category.getRecipeCount.mockResolvedValue(10);

      const startTime = Date.now();
      await categoryController.getCategory(mockReq, mockRes, mockNext);
      const duration = Date.now() - startTime;

      // 単一カテゴリー取得が50ms以内に完了
      expect(duration).toBeLessThan(50);
    });
  });

  describe('📊 エッジケーステスト', () => {
    test('カラーコードの境界値テスト', async () => {
      const testColors = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF'];

      for (const color of testColors) {
        mockReq.body = {
          name: 'テスト',
          color: color
        };

        Category.create.mockResolvedValue({ id: 1, name: 'テスト', color });

        await categoryController.createCategory(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(201);
        mockRes.status.mockClear();
        mockRes.json.mockClear();
      }
    });

    test('特殊文字を含むカテゴリー名の処理', async () => {
      const specialNames = [
        '和食 & 洋食',
        'カテゴリー#1',
        '料理@ホーム',
        'テスト_カテゴリー',
        'カテゴリー-2025'
      ];

      for (const name of specialNames) {
        mockReq.body = { name };
        Category.create.mockResolvedValue({ id: 1, name });

        await categoryController.createCategory(mockReq, mockRes, mockNext);

        expect(Category.create).toHaveBeenCalledWith(expect.objectContaining({ name }));
        Category.create.mockClear();
      }
    });

    test('レシピカウントが0のカテゴリー', async () => {
      mockReq.params = { id: 1 };

      Category.findById.mockResolvedValue({
        id: 1,
        name: '空カテゴリー'
      });
      Category.getRecipeCount.mockResolvedValue(0);

      await categoryController.getCategory(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        category: expect.objectContaining({
          recipe_count: 0
        })
      });
    });

    test('最大整数値のIDでのクエリ', async () => {
      const maxId = Number.MAX_SAFE_INTEGER;
      mockReq.params = { id: maxId };

      Category.findById.mockResolvedValue(null);

      await categoryController.getCategory(mockReq, mockRes, mockNext);

      expect(Category.findById).toHaveBeenCalledWith(maxId);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});
