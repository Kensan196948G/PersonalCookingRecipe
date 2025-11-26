const Recipe = require('../../models/Recipe');
const User = require('../../models/User');
const { initialize } = require('../../config/database');

// DB接続が必要な統合テスト - CI環境ではスキップ
const describeIfDbAvailable = process.env.SKIP_DB_TESTS ? describe.skip : describe;

describeIfDbAvailable('Recipe CRUD Operations Unit Tests', () => {
  let testUser;
  let testUserId;
  let dbInitialized = false;

  beforeAll(async () => {
    try {
      await initialize();

      // データベース初期化待機（SQLITE_BUSYエラー回避）
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create test user
      testUser = global.testUtils?.createTestUser?.() || {
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: 'TestPassword123!'
      };
      const user = await User.create(testUser);
      testUserId = user.id;
      dbInitialized = true;
    } catch (error) {
      console.warn('Database initialization failed, skipping CRUD tests:', error.message);
      dbInitialized = false;
    }
  }, 120000); // タイムアウトを120秒に延長

  afterAll(async () => {
    if (global.testUtils?.cleanTestDatabase) {
      await global.testUtils.cleanTestDatabase();
    }
  });

  describe('Recipe Creation', () => {
    test('should create recipe successfully with valid data', async () => {
      const recipeData = global.testUtils.createTestRecipe(testUserId);

      const recipe = await Recipe.create(recipeData, testUserId);

      expect(recipe).toBeDefined();
      expect(recipe.id).toBeDefined();
      expect(recipe.title).toBe(recipeData.title);
      expect(recipe.user_id).toBe(testUserId);
      expect(recipe.prep_time).toBe(recipeData.prep_time);
      expect(recipe.cook_time).toBe(recipeData.cook_time);
    });

    test('should reject recipe creation with missing required fields', async () => {
      const invalidRecipeData = {
        user_id: testUserId,
        // Missing title and instructions
        prep_time: 15
      };

      await expect(Recipe.create(invalidRecipeData, testUserId))
        .rejects.toThrow();
    });

    test('should reject recipe creation with invalid user_id', async () => {
      const recipeData = global.testUtils.createTestRecipe(99999); // Non-existent user

      await expect(Recipe.create(recipeData, 99999))
        .rejects.toThrow();
    });

    test('should validate recipe data constraints', async () => {
      const invalidData = [
        { ...global.testUtils.createTestRecipe(testUserId), prep_time: -1 }, // Negative prep_time
        { ...global.testUtils.createTestRecipe(testUserId), cook_time: -1 }, // Negative cook_time
        { ...global.testUtils.createTestRecipe(testUserId), servings: 0 },   // Zero servings
        { ...global.testUtils.createTestRecipe(testUserId), difficulty: 'invalid' }, // Invalid difficulty
        { ...global.testUtils.createTestRecipe(testUserId), rating: 6 } // Rating > 5
      ];

      for (const data of invalidData) {
        await expect(Recipe.create(data, testUserId)).rejects.toThrow();
      }
    });
  });

  describe('Recipe Retrieval', () => {
    let createdRecipe;

    beforeEach(async () => {
      const recipeData = global.testUtils.createTestRecipe(testUserId);
      createdRecipe = await Recipe.create(recipeData, testUserId);
    });

    test('should retrieve recipe by ID successfully', async () => {
      const recipe = await Recipe.findById(createdRecipe.id);
      
      expect(recipe).toBeDefined();
      expect(recipe.id).toBe(createdRecipe.id);
      expect(recipe.title).toBe(createdRecipe.title);
      expect(recipe.user_id).toBe(testUserId);
    });

    test('should return null for non-existent recipe ID', async () => {
      const recipe = await Recipe.findById(99999);
      expect(recipe).toBeNull();
    });

    test('should retrieve recipes by user ID', async () => {
      // Create additional recipes for the same user
      await Recipe.create(global.testUtils.createTestRecipe(testUserId), testUserId);
      await Recipe.create(global.testUtils.createTestRecipe(testUserId), testUserId);

      const recipes = await Recipe.findByUserId(testUserId);
      
      expect(recipes).toBeDefined();
      expect(Array.isArray(recipes)).toBe(true);
      expect(recipes.length).toBeGreaterThanOrEqual(3);
      
      recipes.forEach(recipe => {
        expect(recipe.user_id).toBe(testUserId);
      });
    });

    test('should retrieve recipes with ingredients', async () => {
      const recipe = await Recipe.findByIdWithIngredients(createdRecipe.id);
      
      expect(recipe).toBeDefined();
      expect(recipe.ingredients).toBeDefined();
      expect(Array.isArray(recipe.ingredients)).toBe(true);
    });

    test('should search recipes by title', async () => {
      const searchTerm = 'Test Recipe';
      const recipes = await Recipe.searchByTitle(searchTerm);
      
      expect(recipes).toBeDefined();
      expect(Array.isArray(recipes)).toBe(true);
      
      recipes.forEach(recipe => {
        expect(recipe.title.toLowerCase()).toContain(searchTerm.toLowerCase());
      });
    });
  });

  describe('Recipe Update', () => {
    let recipeToUpdate;

    beforeEach(async () => {
      const recipeData = global.testUtils.createTestRecipe(testUserId);
      recipeToUpdate = await Recipe.create(recipeData, testUserId);
    });

    test('should update recipe successfully with valid data', async () => {
      const updateData = {
        title: 'Updated Recipe Title',
        description: 'Updated description',
        prep_time: 20,
        cook_time: 45,
        servings: 6,
        difficulty: 'medium',
        rating: 4
      };

      const success = await Recipe.update(recipeToUpdate.id, updateData);
      expect(success).toBe(true);

      const updatedRecipe = await Recipe.findById(recipeToUpdate.id);
      expect(updatedRecipe.title).toBe(updateData.title);
      expect(updatedRecipe.description).toBe(updateData.description);
      expect(updatedRecipe.prep_time).toBe(updateData.prep_time);
      expect(updatedRecipe.rating).toBe(updateData.rating);
    });

    test('should reject update with invalid data', async () => {
      const invalidUpdateData = {
        prep_time: -5, // Invalid negative value
        servings: 0,   // Invalid zero servings
        difficulty: 'invalid' // Invalid difficulty
      };

      await expect(Recipe.update(recipeToUpdate.id, invalidUpdateData))
        .rejects.toThrow();
    });

    test('should return false for non-existent recipe update', async () => {
      const updateData = { title: 'Updated Title' };
      const success = await Recipe.update(99999, updateData);
      expect(success).toBe(false);
    });

    test('should update only provided fields', async () => {
      const originalTitle = recipeToUpdate.title;
      const partialUpdateData = { prep_time: 25 };

      await Recipe.update(recipeToUpdate.id, partialUpdateData);

      const updatedRecipe = await Recipe.findById(recipeToUpdate.id);
      expect(updatedRecipe.title).toBe(originalTitle); // Unchanged
      expect(updatedRecipe.prep_time).toBe(25); // Changed
    });
  });

  describe('Recipe Deletion', () => {
    let recipeToDelete;

    beforeEach(async () => {
      const recipeData = global.testUtils.createTestRecipe(testUserId);
      recipeToDelete = await Recipe.create(recipeData, testUserId);
    });

    test('should delete recipe successfully', async () => {
      const success = await Recipe.delete(recipeToDelete.id);
      expect(success).toBe(true);

      const deletedRecipe = await Recipe.findById(recipeToDelete.id);
      expect(deletedRecipe).toBeNull();
    });

    test('should return false for non-existent recipe deletion', async () => {
      const success = await Recipe.delete(99999);
      expect(success).toBe(false);
    });

    test('should cascade delete ingredients when recipe is deleted', async () => {
      const recipeWithIngredients = await Recipe.findByIdWithIngredients(recipeToDelete.id);
      expect(recipeWithIngredients.ingredients.length).toBeGreaterThan(0);

      await Recipe.delete(recipeToDelete.id);

      // Verify ingredients are also deleted
      const { dbManager } = require('../../config/database');
      const remainingIngredients = await dbManager.executeWithRetry(
        'SELECT * FROM ingredients WHERE recipe_id = ?',
        [recipeToDelete.id]
      );
      expect(remainingIngredients.length).toBe(0);
    });
  });

  describe('Recipe Performance Tests', () => {
    test('should create recipe within acceptable time', async () => {
      const recipeData = global.testUtils.createTestRecipe(testUserId);

      const startTime = Date.now();
      await Recipe.create(recipeData, testUserId);
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;
      expect(executionTime).toBeWithinPerformanceTarget(1000); // 1 second target
    });

    test('should retrieve recipe within acceptable time', async () => {
      const recipeData = global.testUtils.createTestRecipe(testUserId);
      const recipe = await Recipe.create(recipeData, testUserId);

      const startTime = Date.now();
      await Recipe.findById(recipe.id);
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;
      expect(executionTime).toBeWithinPerformanceTarget(500); // 500ms target
    });

    test('should handle concurrent recipe operations', async () => {
      const operations = [];

      // Create 10 recipes concurrently
      for (let i = 0; i < 10; i++) {
        const recipeData = global.testUtils.createTestRecipe(testUserId);
        operations.push(Recipe.create(recipeData, testUserId));
      }
      
      const recipes = await Promise.all(operations);
      expect(recipes).toHaveLength(10);
      
      recipes.forEach(recipe => {
        expect(recipe.id).toBeDefined();
        expect(recipe.user_id).toBe(testUserId);
      });
    });
  });

  describe('Recipe Business Logic', () => {
    test('should calculate total recipe time correctly', async () => {
      const recipeData = {
        ...global.testUtils.createTestRecipe(testUserId),
        prep_time: 15,
        cook_time: 30
      };

      const recipe = await Recipe.create(recipeData, testUserId);
      const totalTime = recipe.prep_time + recipe.cook_time;
      
      expect(totalTime).toBe(45);
    });

    test('should handle favorite recipes functionality', async () => {
      const recipeData = global.testUtils.createTestRecipe(testUserId);
      const recipe = await Recipe.create(recipeData, testUserId);

      // Mark as favorite
      await Recipe.update(recipe.id, { is_favorite: true });
      
      const favoriteRecipe = await Recipe.findById(recipe.id);
      expect(favoriteRecipe.is_favorite).toBe(1); // SQLite returns 1 for true
      
      // Get all favorite recipes for user
      const favoriteRecipes = await Recipe.findFavoritesByUserId(testUserId);
      expect(favoriteRecipes.some(r => r.id === recipe.id)).toBe(true);
    });
  });
});