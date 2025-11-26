/**
 * @file Recipe.test.js
 * @description Recipeモデルの完全なテストスイート
 * @target Coverage: 3.94% → 70%
 */

const Recipe = require('../../models/Recipe');
const { dbManager } = require('../../config/database');

// モック設定
jest.mock('../../config/database');

describe('Recipe Model - Complete Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('📝 レシピ作成 (create)', () => {
    test('有効なデータで新規レシピ作成成功', async () => {
      const recipeData = {
        title: 'カレーライス',
        description: '美味しいカレー',
        category_id: 1,
        prep_time: 15,
        cook_time: 30,
        servings: 4,
        difficulty: 'medium',
        instructions: '野菜を切る\n炒める\n煮込む',
        notes: '辛さ調整可能',
        ingredients: [
          { name: '玉ねぎ', amount: '2個', unit: '個', notes: '' },
          { name: 'にんじん', amount: '1本', unit: '本', notes: '' }
        ]
      };

      dbManager.executeWithRetry
        .mockResolvedValueOnce(undefined) // BEGIN TRANSACTION
        .mockResolvedValueOnce({ lastID: 1 }) // INSERT recipe
        .mockResolvedValueOnce(undefined) // INSERT ingredient 1
        .mockResolvedValueOnce(undefined) // INSERT ingredient 2
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await Recipe.create(recipeData, 1);

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO recipes'),
        expect.arrayContaining([1, 1, 'カレーライス'])
      );
      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ingredients'),
        expect.arrayContaining([1, '玉ねぎ', '2個'])
      );
      expect(dbManager.executeWithRetry).toHaveBeenCalledWith('COMMIT');
      expect(result).toEqual(expect.objectContaining({ id: 1 }));
    });

    test('材料なしでレシピ作成成功', async () => {
      const recipeData = {
        title: 'シンプルレシピ',
        instructions: '簡単な手順',
        ingredients: []
      };

      dbManager.executeWithRetry
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ lastID: 2 }) // INSERT recipe
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await Recipe.create(recipeData, 1);

      expect(result.id).toBe(2);
    });

    test('必須フィールドが欠けている場合エラー (title)', async () => {
      const recipeData = {
        instructions: '手順'
      };

      await expect(Recipe.create(recipeData, 1))
        .rejects.toThrow('Title and instructions are required');
    });

    test('必須フィールドが欠けている場合エラー (instructions)', async () => {
      const recipeData = {
        title: 'タイトル'
      };

      await expect(Recipe.create(recipeData, 1))
        .rejects.toThrow('Title and instructions are required');
    });

    test('ユーザーIDが未提供の場合エラー', async () => {
      const recipeData = {
        title: 'テスト',
        instructions: '手順'
      };

      await expect(Recipe.create(recipeData, null))
        .rejects.toThrow('User ID is required');
    });

    test('材料の必須フィールド欠如でエラー (name)', async () => {
      const recipeData = {
        title: 'テスト',
        instructions: '手順',
        ingredients: [
          { amount: '1個' } // name がない
        ]
      };

      dbManager.executeWithRetry
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ lastID: 1 }); // INSERT recipe

      await expect(Recipe.create(recipeData, 1))
        .rejects.toThrow('Ingredient at index 0 is missing required fields (name and amount)');

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith('ROLLBACK');
    });

    test('材料の必須フィールド欠如でエラー (amount)', async () => {
      const recipeData = {
        title: 'テスト',
        instructions: '手順',
        ingredients: [
          { name: '玉ねぎ' } // amount がない
        ]
      };

      dbManager.executeWithRetry
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ lastID: 1 });

      await expect(Recipe.create(recipeData, 1))
        .rejects.toThrow('Ingredient at index 0 is missing required fields (name and amount)');
    });

    test('NOT NULL制約違反エラー', async () => {
      const recipeData = {
        title: 'テスト',
        instructions: '手順'
      };

      dbManager.executeWithRetry
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce({
          code: 'SQLITE_CONSTRAINT',
          message: 'NOT NULL constraint failed: recipes.title'
        });

      await expect(Recipe.create(recipeData, 1))
        .rejects.toThrow('Missing required field: recipes.title');
    });

    test('FOREIGN KEY制約違反エラー', async () => {
      const recipeData = {
        title: 'テスト',
        instructions: '手順',
        category_id: 999 // 存在しないカテゴリー
      };

      dbManager.executeWithRetry
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce({
          code: 'SQLITE_CONSTRAINT',
          message: 'FOREIGN KEY constraint failed'
        });

      await expect(Recipe.create(recipeData, 1))
        .rejects.toThrow('Invalid reference to related data');
    });
  });

  describe('📋 全レシピ取得 (findAll)', () => {
    test('ユーザーの全レシピ取得成功', async () => {
      const mockRecipes = [
        { id: 1, title: 'カレー', category_name: '和食', category_color: '#FF0000' },
        { id: 2, title: 'パスタ', category_name: '洋食', category_color: '#00FF00' }
      ];

      dbManager.executeWithRetry.mockResolvedValue(mockRecipes);

      const result = await Recipe.findAll(1);

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('SELECT r.*, c.name as category_name'),
        [1]
      );
      expect(result).toEqual(mockRecipes);
    });

    test('カテゴリーフィルタ付き取得', async () => {
      dbManager.executeWithRetry.mockResolvedValue([]);

      await Recipe.findAll(1, { category_id: 2 });

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('AND r.category_id = ?'),
        [1, 2]
      );
    });

    test('難易度フィルタ付き取得', async () => {
      dbManager.executeWithRetry.mockResolvedValue([]);

      await Recipe.findAll(1, { difficulty: 'easy' });

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('AND r.difficulty = ?'),
        [1, 'easy']
      );
    });

    test('お気に入りフィルタ付き取得', async () => {
      dbManager.executeWithRetry.mockResolvedValue([]);

      await Recipe.findAll(1, { is_favorite: true });

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('AND r.is_favorite = ?'),
        [1, 1]
      );
    });

    test('検索クエリ付き取得', async () => {
      dbManager.executeWithRetry.mockResolvedValue([]);

      await Recipe.findAll(1, { search: 'カレー' });

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('AND (r.title LIKE ? OR r.description LIKE ?)'),
        [1, '%カレー%', '%カレー%']
      );
    });

    test('制限付き取得', async () => {
      dbManager.executeWithRetry.mockResolvedValue([]);

      await Recipe.findAll(1, { limit: 10 });

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        [1, 10]
      );
    });

    test('複数フィルタ組み合わせ', async () => {
      dbManager.executeWithRetry.mockResolvedValue([]);

      await Recipe.findAll(1, {
        category_id: 1,
        difficulty: 'easy',
        is_favorite: true,
        search: 'カレー',
        limit: 5
      });

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('AND r.category_id = ?'),
        expect.arrayContaining([1, 1, 'easy', 1, '%カレー%', '%カレー%', 5])
      );
    });

    test('ユーザーIDが未提供の場合エラー', async () => {
      await expect(Recipe.findAll(null))
        .rejects.toThrow('User ID is required');
    });

    test('レシピが存在しない場合空配列を返す', async () => {
      dbManager.executeWithRetry.mockResolvedValue([]);

      const result = await Recipe.findAll(1);

      expect(result).toEqual([]);
    });
  });

  describe('🔍 IDでレシピ取得 (findById)', () => {
    test('レシピと材料の取得成功', async () => {
      const mockRecipe = {
        id: 1,
        title: 'カレー',
        description: '美味しい',
        category_name: '和食',
        category_color: '#FF0000'
      };

      const mockIngredients = [
        { id: 1, recipe_id: 1, name: '玉ねぎ', amount: '2個', unit: '個', order_index: 0 },
        { id: 2, recipe_id: 1, name: 'にんじん', amount: '1本', unit: '本', order_index: 1 }
      ];

      dbManager.executeWithRetry
        .mockResolvedValueOnce([mockRecipe])
        .mockResolvedValueOnce(mockIngredients);

      const result = await Recipe.findById(1, 1);

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('SELECT r.*, c.name as category_name'),
        [1, 1]
      );
      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM ingredients'),
        [1]
      );
      expect(result).toEqual({
        ...mockRecipe,
        ingredients: mockIngredients
      });
    });

    test('存在しないレシピIDでnullを返す', async () => {
      dbManager.executeWithRetry.mockResolvedValue([]);

      const result = await Recipe.findById(999, 1);

      expect(result).toBeNull();
    });

    test('IDまたはユーザーIDが未提供の場合エラー', async () => {
      await expect(Recipe.findById(null, 1))
        .rejects.toThrow('Recipe ID and User ID are required');
      await expect(Recipe.findById(1, null))
        .rejects.toThrow('Recipe ID and User ID are required');
    });
  });

  describe('✏️ レシピ更新 (update)', () => {
    test('有効なデータでレシピ更新成功', async () => {
      const updateData = {
        title: 'カレーライス(更新)',
        description: '更新された説明',
        instructions: '新しい手順',
        ingredients: [
          { name: '玉ねぎ', amount: '3個', unit: '個' }
        ]
      };

      dbManager.executeWithRetry
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ changes: 1 }) // UPDATE recipe
        .mockResolvedValueOnce(undefined) // DELETE ingredients
        .mockResolvedValueOnce(undefined) // INSERT ingredient
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await Recipe.update(1, 1, updateData);

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE recipes'),
        expect.arrayContaining(['カレーライス(更新)', '更新された説明'])
      );
      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        'DELETE FROM ingredients WHERE recipe_id = ?',
        [1]
      );
      expect(dbManager.executeWithRetry).toHaveBeenCalledWith('COMMIT');
      expect(result).toEqual(expect.objectContaining({ id: 1 }));
    });

    test('存在しないレシピの更新でnullを返す', async () => {
      dbManager.executeWithRetry
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ changes: 0 }) // UPDATE (no changes)
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const result = await Recipe.update(999, 1, {
        title: 'テスト',
        instructions: '手順'
      });

      expect(result).toBeNull();
      expect(dbManager.executeWithRetry).toHaveBeenCalledWith('ROLLBACK');
    });

    test('必須フィールドが欠けている場合エラー', async () => {
      await expect(Recipe.update(1, 1, { description: '説明のみ' }))
        .rejects.toThrow('Title and instructions are required');
    });

    test('IDまたはユーザーIDが未提供の場合エラー', async () => {
      await expect(Recipe.update(null, 1, { title: 'テスト', instructions: '手順' }))
        .rejects.toThrow('Recipe ID and User ID are required');
      await expect(Recipe.update(1, null, { title: 'テスト', instructions: '手順' }))
        .rejects.toThrow('Recipe ID and User ID are required');
    });
  });

  describe('🗑️ レシピ削除 (delete)', () => {
    test('レシピ削除成功', async () => {
      dbManager.executeWithRetry.mockResolvedValue({ changes: 1 });

      const result = await Recipe.delete(1, 1);

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        'DELETE FROM recipes WHERE id = ? AND user_id = ?',
        [1, 1]
      );
      expect(result).toBe(true);
    });

    test('存在しないレシピの削除でfalseを返す', async () => {
      dbManager.executeWithRetry.mockResolvedValue({ changes: 0 });

      const result = await Recipe.delete(999, 1);

      expect(result).toBe(false);
    });

    test('IDまたはユーザーIDが未提供の場合エラー', async () => {
      await expect(Recipe.delete(null, 1))
        .rejects.toThrow('Recipe ID and User ID are required');
      await expect(Recipe.delete(1, null))
        .rejects.toThrow('Recipe ID and User ID are required');
    });
  });

  describe('⭐ お気に入り切り替え (toggleFavorite)', () => {
    test('お気に入り切り替え成功', async () => {
      dbManager.executeWithRetry.mockResolvedValue({ changes: 1 });

      const result = await Recipe.toggleFavorite(1, 1);

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE recipes'),
        [1, 1]
      );
      expect(result).toBe(true);
    });

    test('存在しないレシピのお気に入り切り替えでfalseを返す', async () => {
      dbManager.executeWithRetry.mockResolvedValue({ changes: 0 });

      const result = await Recipe.toggleFavorite(999, 1);

      expect(result).toBe(false);
    });

    test('IDまたはユーザーIDが未提供の場合エラー', async () => {
      await expect(Recipe.toggleFavorite(null, 1))
        .rejects.toThrow('Recipe ID and User ID are required');
      await expect(Recipe.toggleFavorite(1, null))
        .rejects.toThrow('Recipe ID and User ID are required');
    });
  });

  describe('⭐ 評価更新 (updateRating)', () => {
    test('有効な評価で更新成功 (1-5)', async () => {
      const validRatings = [1, 2, 3, 4, 5];

      for (const rating of validRatings) {
        dbManager.executeWithRetry.mockResolvedValue({ changes: 1 });

        const result = await Recipe.updateRating(1, 1, rating);

        expect(result).toBe(true);
        jest.clearAllMocks();
      }
    });

    test('範囲外の評価でエラー (0)', async () => {
      await expect(Recipe.updateRating(1, 1, 0))
        .rejects.toThrow('Rating must be between 1 and 5');
    });

    test('範囲外の評価でエラー (6)', async () => {
      await expect(Recipe.updateRating(1, 1, 6))
        .rejects.toThrow('Rating must be between 1 and 5');
    });

    test('存在しないレシピの評価更新でfalseを返す', async () => {
      dbManager.executeWithRetry.mockResolvedValue({ changes: 0 });

      const result = await Recipe.updateRating(999, 1, 5);

      expect(result).toBe(false);
    });

    test('IDまたはユーザーIDが未提供の場合エラー', async () => {
      await expect(Recipe.updateRating(null, 1, 5))
        .rejects.toThrow('Recipe ID and User ID are required');
      await expect(Recipe.updateRating(1, null, 5))
        .rejects.toThrow('Recipe ID and User ID are required');
    });
  });

  describe('🔍 追加メソッドテスト', () => {
    test('ユーザーIDでレシピ検索 (findByUserId)', async () => {
      const mockRecipes = [
        { id: 1, title: 'カレー', ingredients_data: '玉ねぎ|2個|個,にんじん|1本|本' }
      ];

      dbManager.executeWithRetry.mockResolvedValue(mockRecipes);

      const result = await Recipe.findByUserId(1);

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('WHERE r.user_id = ?'),
        [1]
      );
      expect(result[0].ingredients).toBeDefined();
    });

    test('材料付きレシピ取得 (findByIdWithIngredients)', async () => {
      const mockRecipe = { id: 1, title: 'カレー' };
      const mockIngredients = [
        { name: '玉ねぎ', amount: '2個' }
      ];

      dbManager.executeWithRetry
        .mockResolvedValueOnce([mockRecipe])
        .mockResolvedValueOnce(mockIngredients);

      const result = await Recipe.findByIdWithIngredients(1);

      expect(result.ingredients).toEqual(mockIngredients);
    });

    test('タイトルで検索 (searchByTitle)', async () => {
      dbManager.executeWithRetry.mockResolvedValue([
        { id: 1, title: 'カレーライス' },
        { id: 2, title: 'カレーパン' }
      ]);

      const result = await Recipe.searchByTitle('カレー');

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('WHERE title LIKE ?'),
        ['%カレー%']
      );
      expect(result).toHaveLength(2);
    });

    test('お気に入りレシピ取得 (findFavoritesByUserId)', async () => {
      dbManager.executeWithRetry.mockResolvedValue([
        { id: 1, title: 'お気に入り1', is_favorite: 1 }
      ]);

      const result = await Recipe.findFavoritesByUserId(1);

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ? AND is_favorite = 1'),
        [1]
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('⚡ パフォーマンステスト', () => {
    test('大量レシピ取得のパフォーマンス', async () => {
      const mockRecipes = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        title: `レシピ${i + 1}`
      }));

      dbManager.executeWithRetry.mockResolvedValue(mockRecipes);

      const startTime = Date.now();
      await Recipe.findAll(1);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('🛡️ セキュリティテスト', () => {
    test('SQLインジェクション攻撃を防ぐ', async () => {
      dbManager.executeWithRetry.mockResolvedValue([]);

      await Recipe.findAll(1, { search: "'; DROP TABLE recipes; --" });

      // パラメータ化クエリで安全に処理される
      expect(dbManager.executeWithRetry).toHaveBeenCalled();
    });
  });
});
