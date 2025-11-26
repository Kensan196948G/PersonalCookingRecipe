const request = require('supertest');
const express = require('express');
const { initialize } = require('../../config/database');

// Import routes
const authRoutes = require('../../routes/authRoutes');
const recipeRoutes = require('../../routes/recipeRoutes');
const categoryRoutes = require('../../routes/categoryRoutes');

// Import middleware
const errorHandler = require('../../middleware/errorHandler');
const cors = require('cors');

// DB接続が必要な統合テスト - CI環境ではスキップ
const describeIfDbAvailable = process.env.SKIP_DB_TESTS ? describe.skip : describe;

describeIfDbAvailable('API Endpoints Integration Tests', () => {
  let app;
  let authToken;
  let testUserId;

  beforeAll(async () => {
    // Initialize database
    await initialize();

    // データベース初期化待機（SQLITE_BUSYエラー回避）
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Setup Express app for testing
    app = express();
    app.use(express.json());
    app.use(cors());

    // Add routes
    app.use('/api/auth', authRoutes);
    app.use('/api/recipes', recipeRoutes);
    app.use('/api/categories', categoryRoutes);

    // Add error handler
    app.use(errorHandler);

    // Create test user and get auth token
    const testUser = global.testUtils.createTestUser();
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    testUserId = registerResponse.body.user?.id;
    authToken = registerResponse.body.token;
  }, 120000); // タイムアウトを120秒に延長

  afterAll(async () => {
    await global.testUtils.cleanTestDatabase();
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      test('should register new user successfully', async () => {
        const newUser = global.testUtils.createTestUser();
        
        const response = await request(app)
          .post('/api/auth/register')
          .send(newUser);

        expect(response.status).toBe(201);
        expect(response.body.user).toBeDefined();
        expect(response.body.token).toBeDefined();
        expect(response.body.user.email).toBe(newUser.email.toLowerCase());
        expect(response.body.token).toBeValidJWT();
      });

      test('should reject registration with invalid email', async () => {
        const invalidUser = {
          username: 'testuser',
          email: 'invalid-email',
          password: 'password123'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(invalidUser);

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      test('should reject registration with weak password', async () => {
        const weakPasswordUser = {
          username: 'testuser',
          email: 'test@example.com',
          password: '123' // Too short
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(weakPasswordUser);

        expect(response.status).toBe(400);
      });

      test('should reject duplicate email registration', async () => {
        const user = global.testUtils.createTestUser();
        
        // First registration
        await request(app)
          .post('/api/auth/register')
          .send(user);
        
        // Duplicate registration
        const response = await request(app)
          .post('/api/auth/register')
          .send(user);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('already registered');
      });
    });

    describe('POST /api/auth/login', () => {
      test('should login with valid credentials', async () => {
        const user = global.testUtils.createTestUser();
        
        // Register user first
        await request(app)
          .post('/api/auth/register')
          .send(user);
        
        // Login
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.password
          });

        expect(response.status).toBe(200);
        expect(response.body.token).toBeDefined();
        expect(response.body.user).toBeDefined();
        expect(response.body.token).toBeValidJWT();
      });

      test('should reject login with invalid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
          });

        expect(response.status).toBe(401);
        expect(response.body.error).toBeDefined();
      });
    });
  });

  describe('Recipe Endpoints', () => {
    describe('POST /api/recipes', () => {
      test('should create recipe with valid token', async () => {
        const recipeData = global.testUtils.createTestRecipe();
        delete recipeData.user_id; // Will be set from token

        const response = await request(app)
          .post('/api/recipes')
          .set('Authorization', `Bearer ${authToken}`)
          .send(recipeData);

        expect(response.status).toBe(201);
        expect(response.body.recipe).toBeDefined();
        expect(response.body.recipe.title).toBe(recipeData.title);
      });

      test('should reject recipe creation without token', async () => {
        const recipeData = global.testUtils.createTestRecipe();

        const response = await request(app)
          .post('/api/recipes')
          .send(recipeData);

        expect(response.status).toBe(401);
        expect(response.body.error).toContain('No token provided');
      });

      test('should reject recipe with invalid data', async () => {
        const invalidRecipe = {
          // Missing required fields
          prep_time: 15
        };

        const response = await request(app)
          .post('/api/recipes')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidRecipe);

        expect(response.status).toBe(400);
      });
    });

    describe('GET /api/recipes', () => {
      beforeEach(async () => {
        // Create test recipes
        for (let i = 0; i < 3; i++) {
          const recipeData = global.testUtils.createTestRecipe();
          await request(app)
            .post('/api/recipes')
            .set('Authorization', `Bearer ${authToken}`)
            .send(recipeData);
        }
      });

      test('should retrieve user recipes with valid token', async () => {
        const response = await request(app)
          .get('/api/recipes')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.recipes).toBeDefined();
        expect(Array.isArray(response.body.recipes)).toBe(true);
        expect(response.body.recipes.length).toBeGreaterThan(0);
      });

      test('should reject recipe retrieval without token', async () => {
        const response = await request(app)
          .get('/api/recipes');

        expect(response.status).toBe(401);
      });
    });

    describe('GET /api/recipes/:id', () => {
      let createdRecipeId;

      beforeEach(async () => {
        const recipeData = global.testUtils.createTestRecipe();
        const createResponse = await request(app)
          .post('/api/recipes')
          .set('Authorization', `Bearer ${authToken}`)
          .send(recipeData);
        
        createdRecipeId = createResponse.body.recipe.id;
      });

      test('should retrieve specific recipe by ID', async () => {
        const response = await request(app)
          .get(`/api/recipes/${createdRecipeId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.recipe).toBeDefined();
        expect(response.body.recipe.id).toBe(createdRecipeId);
      });

      test('should return 404 for non-existent recipe', async () => {
        const response = await request(app)
          .get('/api/recipes/99999')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
      });
    });

    describe('PUT /api/recipes/:id', () => {
      let createdRecipeId;

      beforeEach(async () => {
        const recipeData = global.testUtils.createTestRecipe();
        const createResponse = await request(app)
          .post('/api/recipes')
          .set('Authorization', `Bearer ${authToken}`)
          .send(recipeData);
        
        createdRecipeId = createResponse.body.recipe.id;
      });

      test('should update recipe successfully', async () => {
        const updateData = {
          title: 'Updated Recipe Title',
          description: 'Updated description',
          prep_time: 25
        };

        const response = await request(app)
          .put(`/api/recipes/${createdRecipeId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.recipe.title).toBe(updateData.title);
      });

      test('should reject update with invalid data', async () => {
        const invalidUpdateData = {
          prep_time: -5, // Invalid negative value
          servings: 0    // Invalid zero servings
        };

        const response = await request(app)
          .put(`/api/recipes/${createdRecipeId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidUpdateData);

        expect(response.status).toBe(400);
      });
    });

    describe('DELETE /api/recipes/:id', () => {
      let createdRecipeId;

      beforeEach(async () => {
        const recipeData = global.testUtils.createTestRecipe();
        const createResponse = await request(app)
          .post('/api/recipes')
          .set('Authorization', `Bearer ${authToken}`)
          .send(recipeData);
        
        createdRecipeId = createResponse.body.recipe.id;
      });

      test('should delete recipe successfully', async () => {
        const response = await request(app)
          .delete(`/api/recipes/${createdRecipeId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);

        // Verify recipe is deleted
        const getResponse = await request(app)
          .get(`/api/recipes/${createdRecipeId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(getResponse.status).toBe(404);
      });
    });
  });

  describe('Performance Tests', () => {
    test('should handle API requests within acceptable time', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeWithinPerformanceTarget(2000); // 2 second target
    });

    test('should handle concurrent API requests', async () => {
      const requests = [];
      
      // Make 20 concurrent requests
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .get('/api/recipes')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send('{"malformed": json}')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    test('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('should handle invalid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/recipes')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid token');
    });
  });
});