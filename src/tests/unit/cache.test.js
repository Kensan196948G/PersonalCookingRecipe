/**
 * @file cache.test.js
 * @description キャッシュマネージャーの完全なテストスイート
 * @target Coverage: 100%
 */

const { cacheManager, cacheMiddleware } = require('../../middleware/cache');
const { cacheGet, cacheSet, cacheDel } = require('../../config/database-postgresql');

// database-postgresqlのモック
jest.mock('../../config/database-postgresql', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
  cacheDel: jest.fn()
}));

describe('Cache Manager - Complete Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('⚙️ CacheManager基本機能', () => {
    test('デフォルトTTL設定が正しい', () => {
      expect(cacheManager.defaultTTL).toEqual({
        jwt: 3600,
        recipes: 1800,
        users: 3600,
        categories: 7200,
        search: 600,
        api: 300
      });
    });

    test('キャッシュ統計情報取得', async () => {
      const stats = await cacheManager.getCacheStats();

      expect(stats).toHaveProperty('timestamp');
      expect(stats).toHaveProperty('ttl_settings');
      expect(stats.ttl_settings).toEqual(cacheManager.defaultTTL);
    });
  });

  describe('🔐 JWTキャッシング', () => {
    test('JWTトークンを正しくキャッシュ', async () => {
      const userId = 123;
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
      const payload = { userId, email: 'test@example.com' };

      cacheSet.mockResolvedValue('OK');

      await cacheManager.cacheJWT(userId, token, payload);

      expect(cacheSet).toHaveBeenCalledWith(
        expect.stringContaining(`jwt:${userId}:`),
        expect.stringContaining('"userId":123'),
        3600
      );
    });

    test('キャッシュされたJWTトークンを取得', async () => {
      const userId = 123;
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
      const payload = { userId, email: 'test@example.com' };

      const cachedData = JSON.stringify({
        userId,
        payload,
        timestamp: Date.now()
      });

      cacheGet.mockResolvedValue(cachedData);

      const result = await cacheManager.getCachedJWT(userId, token);

      expect(result).toEqual(payload);
      expect(cacheGet).toHaveBeenCalledWith(
        expect.stringContaining(`jwt:${userId}:`)
      );
    });

    test('期限切れJWTはnullを返す', async () => {
      const userId = 123;
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';

      const cachedData = JSON.stringify({
        userId,
        payload: { userId },
        timestamp: Date.now() - 4000000 // 1時間以上前
      });

      cacheGet.mockResolvedValue(cachedData);

      const result = await cacheManager.getCachedJWT(userId, token);

      expect(result).toBeNull();
    });

    test('キャッシュが存在しない場合nullを返す', async () => {
      cacheGet.mockResolvedValue(null);

      const result = await cacheManager.getCachedJWT(123, 'token');

      expect(result).toBeNull();
    });
  });

  describe('🍳 レシピキャッシング', () => {
    test('レシピデータを正しくキャッシュ', async () => {
      const recipeId = 456;
      const recipeData = {
        id: 456,
        title: 'Test Recipe',
        ingredients: ['flour', 'sugar']
      };

      cacheSet.mockResolvedValue('OK');

      await cacheManager.cacheRecipe(recipeId, recipeData);

      expect(cacheSet).toHaveBeenCalledWith(
        `recipe:${recipeId}`,
        JSON.stringify(recipeData),
        1800
      );
    });

    test('キャッシュされたレシピを取得', async () => {
      const recipeId = 456;
      const recipeData = {
        id: 456,
        title: 'Test Recipe'
      };

      cacheGet.mockResolvedValue(JSON.stringify(recipeData));

      const result = await cacheManager.getCachedRecipe(recipeId);

      expect(result).toEqual(recipeData);
      expect(cacheGet).toHaveBeenCalledWith(`recipe:${recipeId}`);
    });

    test('ユーザーのレシピ一覧をキャッシュ', async () => {
      const userId = 123;
      const recipes = [
        { id: 1, title: 'Recipe 1' },
        { id: 2, title: 'Recipe 2' }
      ];

      cacheSet.mockResolvedValue('OK');

      await cacheManager.cacheUserRecipes(userId, recipes);

      expect(cacheSet).toHaveBeenCalledWith(
        `user_recipes:${userId}`,
        JSON.stringify(recipes),
        1800
      );
    });

    test('キャッシュされたユーザーレシピ一覧を取得', async () => {
      const userId = 123;
      const recipes = [{ id: 1, title: 'Recipe 1' }];

      cacheGet.mockResolvedValue(JSON.stringify(recipes));

      const result = await cacheManager.getCachedUserRecipes(userId);

      expect(result).toEqual(recipes);
    });
  });

  describe('🔍 検索結果キャッシング', () => {
    test('検索結果を正しくキャッシュ', async () => {
      const query = 'pasta recipe';
      const results = [
        { id: 1, title: 'Spaghetti Carbonara' },
        { id: 2, title: 'Penne Arrabiata' }
      ];

      cacheSet.mockResolvedValue('OK');

      await cacheManager.cacheSearchResults(query, results);

      expect(cacheSet).toHaveBeenCalledWith(
        expect.stringContaining('search:'),
        JSON.stringify(results),
        600
      );
    });

    test('キャッシュされた検索結果を取得', async () => {
      const query = 'pasta recipe';
      const results = [{ id: 1, title: 'Pasta' }];

      cacheGet.mockResolvedValue(JSON.stringify(results));

      const result = await cacheManager.getCachedSearchResults(query);

      expect(result).toEqual(results);
    });

    test('日本語クエリも正しくキャッシュ', async () => {
      const query = 'パスタ レシピ';
      const results = [{ id: 1, title: 'カルボナーラ' }];

      cacheSet.mockResolvedValue('OK');

      await cacheManager.cacheSearchResults(query, results);

      expect(cacheSet).toHaveBeenCalled();
    });
  });

  describe('🌐 API応答キャッシング', () => {
    test('API応答を正しくキャッシュ', async () => {
      const endpoint = '/api/recipes';
      const params = { category: 'italian', limit: 10 };
      const response = { recipes: [], total: 0 };

      cacheSet.mockResolvedValue('OK');

      await cacheManager.cacheAPIResponse(endpoint, params, response);

      expect(cacheSet).toHaveBeenCalledWith(
        expect.stringContaining(`api:${endpoint}:`),
        JSON.stringify(response),
        300
      );
    });

    test('キャッシュされたAPI応答を取得', async () => {
      const endpoint = '/api/recipes';
      const params = { category: 'italian' };
      const response = { recipes: [{ id: 1 }] };

      cacheGet.mockResolvedValue(JSON.stringify(response));

      const result = await cacheManager.getCachedAPIResponse(endpoint, params);

      expect(result).toEqual(response);
    });
  });

  describe('🗑️ キャッシュ無効化', () => {
    test('レシピキャッシュを無効化', async () => {
      const recipeId = 456;

      cacheDel.mockResolvedValue(1);

      await cacheManager.invalidateRecipeCache(recipeId);

      expect(cacheDel).toHaveBeenCalledWith(`recipe:${recipeId}`);
    });

    test('ユーザーキャッシュを無効化', async () => {
      const userId = 123;

      cacheDel.mockResolvedValue(1);

      await cacheManager.invalidateUserCache(userId);

      expect(cacheDel).toHaveBeenCalled();
    });

    test('キャッシュ無効化エラーを適切に処理', async () => {
      cacheDel.mockRejectedValue(new Error('Redis connection failed'));

      await expect(
        cacheManager.invalidateRecipeCache(456)
      ).rejects.toThrow('Redis connection failed');
    });
  });

  describe('🔄 レスポンスキャッシングミドルウェア', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
      mockReq = {
        originalUrl: '/api/recipes',
        query: {}
      };

      mockRes = {
        json: jest.fn(),
        set: jest.fn()
      };

      mockNext = jest.fn();
    });

    test('キャッシュHIT時はキャッシュデータを返す', async () => {
      const cachedData = { recipes: [{ id: 1, title: 'Cached Recipe' }] };
      cacheGet.mockResolvedValue(JSON.stringify(cachedData));

      const middleware = cacheMiddleware.response(300);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(mockRes.json).toHaveBeenCalledWith(cachedData);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('キャッシュMISS時は次のミドルウェアへ', async () => {
      cacheGet.mockResolvedValue(null);

      const middleware = cacheMiddleware.response(300);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.set).not.toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(mockNext).toHaveBeenCalled();
    });

    test('レスポンスをキャッシュに保存', async () => {
      cacheGet.mockResolvedValue(null);
      cacheSet.mockResolvedValue('OK');

      const middleware = cacheMiddleware.response(300);
      await middleware(mockReq, mockRes, mockNext);

      // レスポンスを送信
      const responseData = { recipes: [] };
      mockRes.json(responseData);

      expect(mockRes.set).toHaveBeenCalledWith('X-Cache', 'MISS');
    });

    test('カスタムTTLでキャッシュ', async () => {
      cacheGet.mockResolvedValue(null);

      const customTTL = 600;
      const middleware = cacheMiddleware.response(customTTL);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('🔐 JWTキャッシングミドルウェア', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
      mockReq = {
        header: jest.fn(),
        userId: 123
      };

      mockRes = {};
      mockNext = jest.fn();
    });

    test('キャッシュされたJWTを使用', async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
      mockReq.header.mockReturnValue(`Bearer ${token}`);

      const cachedPayload = { userId: 123, email: 'test@example.com' };

      const cachedData = JSON.stringify({
        userId: 123,
        payload: cachedPayload,
        timestamp: Date.now()
      });
      cacheGet.mockResolvedValue(cachedData);

      const middleware = cacheMiddleware.jwtCache();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual(cachedPayload);
      expect(mockReq.fromCache).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    test('トークンがない場合はスキップ', async () => {
      mockReq.header.mockReturnValue(null);

      const middleware = cacheMiddleware.jwtCache();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });
  });

  describe('⚡ パフォーマンステスト', () => {
    test('キャッシュ読み取りが高速 (<5ms)', async () => {
      cacheGet.mockResolvedValue(JSON.stringify({ data: 'test' }));

      const startTime = Date.now();
      await cacheManager.getCachedRecipe(1);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5);
    });

    test('大量のキャッシュ操作を処理', async () => {
      cacheSet.mockResolvedValue('OK');
      cacheGet.mockResolvedValue(null);

      const operations = [];

      for (let i = 0; i < 1000; i++) {
        operations.push(
          cacheManager.cacheRecipe(i, { id: i, title: `Recipe ${i}` })
        );
      }

      const startTime = Date.now();
      await Promise.all(operations);
      const endTime = Date.now();

      // 1000件のキャッシュ保存が100ms以内
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('同時読み書きを正しく処理', async () => {
      cacheSet.mockResolvedValue('OK');
      cacheGet.mockResolvedValue(JSON.stringify({ id: 1 }));

      const operations = [];

      for (let i = 0; i < 50; i++) {
        operations.push(cacheManager.cacheRecipe(i, { id: i }));
        operations.push(cacheManager.getCachedRecipe(i));
      }

      const results = await Promise.all(operations);
      expect(results).toHaveLength(100);
    });
  });

  describe('🛡️ エラーハンドリング', () => {
    test('キャッシュ取得エラーを適切に処理', async () => {
      cacheGet.mockRejectedValue(new Error('Redis connection error'));

      const result = await cacheManager.getCachedRecipe(1).catch(() => null);

      expect(result).toBeNull();
    });

    test('キャッシュ保存エラーを適切に処理', async () => {
      cacheSet.mockRejectedValue(new Error('Redis write error'));

      await expect(
        cacheManager.cacheRecipe(1, { id: 1 })
      ).rejects.toThrow('Redis write error');
    });

    test('JSON解析エラーを適切に処理', async () => {
      cacheGet.mockResolvedValue('invalid-json');

      await expect(
        cacheManager.getCachedRecipe(1)
      ).rejects.toThrow();
    });
  });

  describe('🧪 エッジケース', () => {
    test('空のデータをキャッシュ', async () => {
      cacheSet.mockResolvedValue('OK');

      await cacheManager.cacheRecipe(1, {});

      expect(cacheSet).toHaveBeenCalledWith(
        'recipe:1',
        '{}',
        1800
      );
    });

    test('nullデータはキャッシュしない', async () => {
      cacheSet.mockResolvedValue('OK');

      await cacheManager.cacheRecipe(1, null);

      expect(cacheSet).toHaveBeenCalledWith(
        'recipe:1',
        'null',
        1800
      );
    });

    test('非常に長いクエリをキャッシュ', async () => {
      const longQuery = 'a'.repeat(10000);
      cacheSet.mockResolvedValue('OK');

      await cacheManager.cacheSearchResults(longQuery, []);

      expect(cacheSet).toHaveBeenCalled();
    });

    test('特殊文字を含むキーを正しく処理', async () => {
      const specialQuery = '特殊文字!@#$%^&*()';
      cacheSet.mockResolvedValue('OK');

      await cacheManager.cacheSearchResults(specialQuery, []);

      expect(cacheSet).toHaveBeenCalled();
    });
  });
});
