const request = require('supertest');
const app = require('../src/server');

describe('Recipe Endpoints', () => {
  let authToken;
  
  const testUser = {
    username: 'recipeuser',
    email: 'recipe@example.com',
    password: 'password123'
  };

  const testRecipe = {
    title: 'Test Recipe',
    description: 'A test recipe',
    ingredients: ['ingredient 1', 'ingredient 2'],
    instructions: ['step 1', 'step 2'],
    category_id: 1,
    prep_time: 15,
    cook_time: 30
  };

  beforeAll(async () => {
    // Register and login to get auth token
    await request(app)
      .post('/api/auth/register')
      .send(testUser);
    
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    
    authToken = loginResponse.body.token;
  });

  describe('GET /api/recipes', () => {
    test('should get all recipes', async () => {
      const response = await request(app)
        .get('/api/recipes')
        .expect(200);

      expect(response.body).toHaveProperty('recipes');
      expect(Array.isArray(response.body.recipes)).toBe(true);
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/recipes?page=1&limit=5')
        .expect(200);

      expect(response.body).toHaveProperty('recipes');
      expect(response.body).toHaveProperty('pagination');
    });
  });

  describe('POST /api/recipes', () => {
    test('should create a recipe with valid auth', async () => {
      const response = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testRecipe)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('recipe');
      expect(response.body.recipe.title).toBe(testRecipe.title);
    });

    test('should not create recipe without auth', async () => {
      const response = await request(app)
        .post('/api/recipes')
        .send(testRecipe)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    test('should not create recipe with invalid data', async () => {
      const invalidRecipe = { title: 'No other fields' };
      
      const response = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRecipe)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/recipes/:id', () => {
    let recipeId;

    beforeAll(async () => {
      const createResponse = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testRecipe);
      
      recipeId = createResponse.body.recipe.id;
    });

    test('should get recipe by valid ID', async () => {
      const response = await request(app)
        .get(`/api/recipes/${recipeId}`)
        .expect(200);

      expect(response.body).toHaveProperty('recipe');
      expect(response.body.recipe.id).toBe(recipeId);
    });

    test('should return 404 for non-existent recipe', async () => {
      const response = await request(app)
        .get('/api/recipes/99999')
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });
});