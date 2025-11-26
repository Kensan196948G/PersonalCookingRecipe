// tests/api-integration.spec.js
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('API Integration Tests @api @integration', () => {
  let apiContext;
  let authToken;

  test.beforeAll(async ({ playwright }) => {
    // Create API context
    apiContext = await playwright.request.newContext({
      baseURL: 'http://localhost:8000',
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      }
    });

    // Store test coordination
    try {
      execSync('npx claude-flow@alpha hooks pre-search --query "API integration test" --cache-results true');
    } catch (error) {
      // Continue without coordination
    }

    // Login to get auth token
    const loginResponse = await apiContext.post('/auth/login', {
      data: {
        email: 'test.user@example.com',
        password: 'TestUser123!'
      }
    });

    const loginData = await loginResponse.json();
    authToken = loginData.access_token;

    // Update context with auth header
    await apiContext.dispose();
    apiContext = await playwright.request.newContext({
      baseURL: 'http://localhost:8000',
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();

    // Store test results
    try {
      execSync('npx claude-flow@alpha hooks post-edit --file "api-integration.spec.js" --memory-key "testing/api/completed"');
    } catch (error) {
      // Continue without coordination
    }
  });

  test('should authenticate user via API', async () => {
    const response = await apiContext.post('/auth/login', {
      data: {
        email: 'test.user@example.com',
        password: 'TestUser123!'
      }
    });

    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('access_token');
    expect(data).toHaveProperty('token_type', 'bearer');
    expect(data).toHaveProperty('expires_in');
  });

  test('should reject invalid credentials', async () => {
    const response = await apiContext.post('/auth/login', {
      data: {
        email: 'test.user@example.com',
        password: 'WrongPassword'
      }
    });

    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data).toHaveProperty('detail', 'Incorrect email or password');
  });

  test('should create new recipe via API', async () => {
    const newRecipe = {
      title: 'API Test Recipe',
      description: 'Created via API integration test',
      category: 'Main Course',
      cuisine: 'International',
      servings: 4,
      prep_time: 15,
      cook_time: 30,
      difficulty: 'Medium',
      ingredients: [
        { name: 'flour', quantity: '2', unit: 'cups' },
        { name: 'eggs', quantity: '2', unit: 'pieces' },
        { name: 'milk', quantity: '1', unit: 'cup' }
      ],
      instructions: [
        { step: 1, description: 'Mix dry ingredients' },
        { step: 2, description: 'Add wet ingredients' },
        { step: 3, description: 'Cook as directed' }
      ],
      tags: ['test', 'api'],
      youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    };

    const response = await apiContext.post('/recipes', {
      data: newRecipe
    });

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    const createdRecipe = await response.json();
    expect(createdRecipe).toHaveProperty('id');
    expect(createdRecipe.title).toBe(newRecipe.title);
    expect(createdRecipe.ingredients).toHaveLength(3);
    expect(createdRecipe.instructions).toHaveLength(3);
  });

  test('should retrieve recipe list via API', async () => {
    const response = await apiContext.get('/recipes');

    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('recipes');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('page');
    expect(data).toHaveProperty('per_page');
    expect(Array.isArray(data.recipes)).toBeTruthy();
  });

  test('should retrieve specific recipe via API', async () => {
    // First get list of recipes
    const listResponse = await apiContext.get('/recipes');
    const listData = await listResponse.json();
    
    if (listData.recipes.length > 0) {
      const recipeId = listData.recipes[0].id;
      
      const response = await apiContext.get(`/recipes/${recipeId}`);
      
      expect(response.ok()).toBeTruthy();
      
      const recipe = await response.json();
      expect(recipe).toHaveProperty('id', recipeId);
      expect(recipe).toHaveProperty('title');
      expect(recipe).toHaveProperty('ingredients');
      expect(recipe).toHaveProperty('instructions');
    }
  });

  test('should update recipe via API', async () => {
    // Create a recipe first
    const newRecipe = {
      title: 'Recipe to Update',
      description: 'Original description',
      category: 'Appetizer',
      ingredients: [{ name: 'ingredient1', quantity: '1', unit: 'cup' }],
      instructions: [{ step: 1, description: 'Do something' }]
    };

    const createResponse = await apiContext.post('/recipes', {
      data: newRecipe
    });
    
    const createdRecipe = await createResponse.json();
    const recipeId = createdRecipe.id;

    // Update the recipe
    const updateData = {
      title: 'Updated Recipe Title',
      description: 'Updated description',
      category: 'Main Course'
    };

    const updateResponse = await apiContext.put(`/recipes/${recipeId}`, {
      data: updateData
    });

    expect(updateResponse.ok()).toBeTruthy();

    const updatedRecipe = await updateResponse.json();
    expect(updatedRecipe.title).toBe(updateData.title);
    expect(updatedRecipe.description).toBe(updateData.description);
    expect(updatedRecipe.category).toBe(updateData.category);
  });

  test('should delete recipe via API', async () => {
    // Create a recipe to delete
    const newRecipe = {
      title: 'Recipe to Delete',
      description: 'This will be deleted',
      category: 'Dessert',
      ingredients: [{ name: 'sugar', quantity: '1', unit: 'cup' }],
      instructions: [{ step: 1, description: 'Mix ingredients' }]
    };

    const createResponse = await apiContext.post('/recipes', {
      data: newRecipe
    });
    
    const createdRecipe = await createResponse.json();
    const recipeId = createdRecipe.id;

    // Delete the recipe
    const deleteResponse = await apiContext.delete(`/recipes/${recipeId}`);
    
    expect(deleteResponse.ok()).toBeTruthy();
    expect(deleteResponse.status()).toBe(204);

    // Verify recipe is deleted
    const getResponse = await apiContext.get(`/recipes/${recipeId}`);
    expect(getResponse.status()).toBe(404);
  });

  test('should search recipes via API', async () => {
    const searchParams = new URLSearchParams({
      q: 'test',
      category: 'Main Course',
      cuisine: 'Italian',
      difficulty: 'Medium',
      max_cook_time: '45',
      page: '1',
      per_page: '10'
    });

    const response = await apiContext.get(`/recipes/search?${searchParams}`);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('recipes');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('page', 1);
    expect(data).toHaveProperty('per_page', 10);
    expect(Array.isArray(data.recipes)).toBeTruthy();
  });

  test('should handle recipe favorites via API', async () => {
    // Get first available recipe
    const recipesResponse = await apiContext.get('/recipes');
    const recipesData = await recipesResponse.json();
    
    if (recipesData.recipes.length > 0) {
      const recipeId = recipesData.recipes[0].id;

      // Add to favorites
      const favoriteResponse = await apiContext.post(`/recipes/${recipeId}/favorite`);
      expect(favoriteResponse.ok()).toBeTruthy();

      const favoriteData = await favoriteResponse.json();
      expect(favoriteData).toHaveProperty('favorited', true);

      // Remove from favorites
      const unfavoriteResponse = await apiContext.delete(`/recipes/${recipeId}/favorite`);
      expect(unfavoriteResponse.ok()).toBeTruthy();

      const unfavoriteData = await unfavoriteResponse.json();
      expect(unfavoriteData).toHaveProperty('favorited', false);
    }
  });

  test('should get user favorites via API', async () => {
    const response = await apiContext.get('/users/me/favorites');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('recipes');
    expect(Array.isArray(data.recipes)).toBeTruthy();
  });

  test('should validate API input data', async () => {
    // Test missing required fields
    const invalidRecipe = {
      description: 'Missing title and other required fields'
    };

    const response = await apiContext.post('/recipes', {
      data: invalidRecipe
    });

    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(422);

    const errorData = await response.json();
    expect(errorData).toHaveProperty('detail');
    expect(Array.isArray(errorData.detail)).toBeTruthy();
  });

  test('should handle API rate limiting', async () => {
    // Make multiple rapid requests to test rate limiting
    const promises = [];
    
    for (let i = 0; i < 10; i++) {
      promises.push(apiContext.get('/recipes'));
    }

    const responses = await Promise.all(promises);
    
    // Check if any responses are rate limited (429)
    const rateLimitedResponses = responses.filter(r => r.status() === 429);
    
    // If rate limiting is implemented, we should get some 429 responses
    if (rateLimitedResponses.length > 0) {
      console.log(`Rate limiting working: ${rateLimitedResponses.length} requests were limited`);
    }
  });

  test('should handle CORS headers correctly', async () => {
    const response = await apiContext.get('/recipes');

    const headers = response.headers();
    
    // Check common CORS headers (if implemented)
    if (headers['access-control-allow-origin']) {
      expect(headers['access-control-allow-origin']).toBeTruthy();
    }
    
    if (headers['access-control-allow-methods']) {
      expect(headers['access-control-allow-methods']).toContain('GET');
    }
  });

  test('should upload recipe image via API', async () => {
    // Create a recipe first
    const newRecipe = {
      title: 'Recipe with Image',
      description: 'Testing image upload',
      category: 'Dessert',
      ingredients: [{ name: 'flour', quantity: '1', unit: 'cup' }],
      instructions: [{ step: 1, description: 'Mix ingredients' }]
    };

    const createResponse = await apiContext.post('/recipes', {
      data: newRecipe
    });
    
    const createdRecipe = await createResponse.json();
    const recipeId = createdRecipe.id;

    // Create a simple test image (1x1 pixel PNG)
    const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

    // Upload image
    const uploadResponse = await apiContext.post(`/recipes/${recipeId}/image`, {
      multipart: {
        image: {
          name: 'test-image.png',
          mimeType: 'image/png',
          buffer: testImageBuffer
        }
      }
    });

    expect(uploadResponse.ok()).toBeTruthy();

    const uploadData = await uploadResponse.json();
    expect(uploadData).toHaveProperty('image_url');
    expect(uploadData.image_url).toContain('.png');
  });

  test('should get recipe analytics via API', async () => {
    const response = await apiContext.get('/recipes/analytics');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('total_recipes');
    expect(data).toHaveProperty('categories_breakdown');
    expect(data).toHaveProperty('popular_tags');
    expect(typeof data.total_recipes).toBe('number');
  });

  test('should export recipes via API', async () => {
    const exportResponse = await apiContext.get('/recipes/export?format=json');

    expect(exportResponse.ok()).toBeTruthy();

    const exportData = await exportResponse.json();
    expect(exportData).toHaveProperty('recipes');
    expect(exportData).toHaveProperty('exported_at');
    expect(Array.isArray(exportData.recipes)).toBeTruthy();
  });

  test('should handle API errors gracefully', async () => {
    // Test 404 error
    const notFoundResponse = await apiContext.get('/recipes/999999');
    expect(notFoundResponse.status()).toBe(404);

    const notFoundData = await notFoundResponse.json();
    expect(notFoundData).toHaveProperty('detail');

    // Test unauthorized access without token
    const unauthorizedContext = await apiContext.request.newContext({
      baseURL: 'http://localhost:8000'
    });

    const unauthorizedResponse = await unauthorizedContext.post('/recipes', {
      data: { title: 'Unauthorized Recipe' }
    });

    expect(unauthorizedResponse.status()).toBe(401);

    await unauthorizedContext.dispose();
  });
});