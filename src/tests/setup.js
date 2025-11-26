/**
 * Jest Global Setup File
 * Provides test utilities for all test suites
 */

const { v4: uuidv4 } = require('crypto');

// Custom Jest matchers
expect.extend({
  toBeValidJWT(received) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    const pass = jwtRegex.test(received);
    return {
      message: () => pass
        ? `expected ${received} not to be a valid JWT`
        : `expected ${received} to be a valid JWT`,
      pass,
    };
  },
});

// Global test utilities
global.testUtils = {
  /**
   * Create a test user with unique credentials
   */
  createTestUser: () => {
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    return {
      username: `testuser_${uniqueId}`,
      email: `test_${uniqueId}@example.com`,
      password: 'TestPassword123!'
    };
  },

  /**
   * Create a test recipe object
   */
  createTestRecipe: (userId) => {
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    return {
      title: `Test Recipe ${uniqueId}`,
      description: 'A test recipe for automated testing',
      ingredients: ['ingredient1', 'ingredient2', 'ingredient3'],
      instructions: ['Step 1', 'Step 2', 'Step 3'],
      cookTime: 30,
      prepTime: 15,
      servings: 4,
      userId: userId
    };
  },

  /**
   * Clean up test database
   */
  cleanTestDatabase: async () => {
    // Attempt to clean up test data
    try {
      const { getDatabase, close } = require('../config/database');
      const db = getDatabase();

      if (db) {
        // Delete test data (users/recipes starting with 'test')
        await new Promise((resolve, reject) => {
          db.run("DELETE FROM users WHERE username LIKE 'testuser_%'", (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        await new Promise((resolve, reject) => {
          db.run("DELETE FROM recipes WHERE title LIKE 'Test Recipe%'", (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    } catch (error) {
      // Silently ignore cleanup errors in test environment
      console.log('Test cleanup warning:', error.message);
    }
  },

  /**
   * Wait for a specified time
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate random string for test data
   */
  randomString: (length = 10) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing';

// Increase default timeout for integration tests
jest.setTimeout(30000);

// Global beforeAll - runs once before all tests
beforeAll(async () => {
  // Suppress console output during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    global.console = {
      ...console,
      log: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      // Keep warn and error for debugging
      warn: console.warn,
      error: console.error,
    };
  }
});

// Global afterAll - runs once after all tests
afterAll(async () => {
  // Allow time for connections to close
  await new Promise(resolve => setTimeout(resolve, 500));
});
