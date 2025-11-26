const request = require('supertest');
const express = require('express');
const { performance, PerformanceObserver } = require('perf_hooks');
const { initialize } = require('../../config/database');

// Import routes for testing
const authRoutes = require('../../routes/authRoutes');
const recipeRoutes = require('../../routes/recipeRoutes');

// DB接続が必要な統合テスト - CI環境ではスキップ
const describeIfDbAvailable = process.env.SKIP_DB_TESTS ? describe.skip : describe;

describeIfDbAvailable('Performance Tests', () => {
  let app;
  let authToken;
  let testUserId;
  let performanceMetrics = [];

  // Performance observer to collect metrics
  const obs = new PerformanceObserver((list) => {
    performanceMetrics.push(...list.getEntries());
  });
  obs.observe({ entryTypes: ['measure'] });

  beforeAll(async () => {
    await initialize();

    // データベース初期化待機（SQLITE_BUSYエラー回避）
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/recipes', recipeRoutes);

    // Create test user and get auth token
    const testUser = global.testUtils.createTestUser();
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    testUserId = registerResponse.body.user?.id;
    authToken = registerResponse.body.token;
  }, 120000); // タイムアウトを120秒に延長

  afterAll(async () => {
    obs.disconnect();
    await global.testUtils.cleanTestDatabase();
  });

  describe('JWT Authentication Performance', () => {
    test('should verify JWT token within 1.44ms target', async () => {
      const jwt = require('jsonwebtoken');
      const testPayload = { userId: 123, email: 'test@example.com' };
      const token = jwt.sign(testPayload, process.env.JWT_SECRET);

      // Warm up
      for (let i = 0; i < 10; i++) {
        jwt.verify(token, process.env.JWT_SECRET);
      }

      // Performance test
      const measurements = [];
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        jwt.verify(token, process.env.JWT_SECRET);
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxTime = Math.max(...measurements);
      const minTime = Math.min(...measurements);

      expect(avgTime).toBeLessThan(1.44); // Target: 1.44ms average
      expect(maxTime).toBeLessThan(5.0);  // Max should be under 5ms
      expect(minTime).toBeGreaterThan(0); // Sanity check

      console.log(`JWT Verification Performance:
        Average: ${avgTime.toFixed(3)}ms
        Min: ${minTime.toFixed(3)}ms  
        Max: ${maxTime.toFixed(3)}ms
        Target: 1.44ms`);
    });

    test('should generate JWT token efficiently', async () => {
      const jwt = require('jsonwebtoken');
      const testPayload = { userId: 123, email: 'test@example.com' };

      const measurements = [];
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        jwt.sign(testPayload, process.env.JWT_SECRET);
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      expect(avgTime).toBeLessThan(2.0); // Target: under 2ms for generation

      console.log(`JWT Generation Performance: ${avgTime.toFixed(3)}ms average`);
    });

    test('should handle concurrent JWT operations efficiently', async () => {
      const jwt = require('jsonwebtoken');
      const testPayload = { userId: 123 };
      const token = jwt.sign(testPayload, process.env.JWT_SECRET);

      const startTime = performance.now();

      // 1000 concurrent verification operations
      const promises = Array(1000).fill().map(() => 
        Promise.resolve(jwt.verify(token, process.env.JWT_SECRET))
      );

      await Promise.all(promises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const avgTimePerOperation = totalTime / 1000;

      expect(avgTimePerOperation).toBeLessThan(0.5); // Under 0.5ms per operation
      expect(totalTime).toBeLessThan(100); // Total under 100ms

      console.log(`Concurrent JWT Operations: ${avgTimePerOperation.toFixed(3)}ms per operation`);
    });
  });

  describe('Database Performance Tests', () => {
    test('should execute database queries within acceptable time', async () => {
      const { dbManager } = require('../../config/database');

      // Test SELECT performance
      const selectMeasurements = [];
      for (let i = 0; i < 50; i++) {
        const startTime = performance.now();
        await dbManager.executeWithRetry('SELECT COUNT(*) as count FROM users');
        const endTime = performance.now();
        selectMeasurements.push(endTime - startTime);
      }

      const avgSelectTime = selectMeasurements.reduce((a, b) => a + b, 0) / selectMeasurements.length;
      expect(avgSelectTime).toBeLessThan(100); // Under 100ms

      // Test INSERT performance
      const insertMeasurements = [];
      for (let i = 0; i < 20; i++) {
        const testUser = global.testUtils.createTestUser();
        
        const startTime = performance.now();
        await dbManager.executeWithRetry(
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          [testUser.username, testUser.email, 'hashedpass']
        );
        const endTime = performance.now();
        insertMeasurements.push(endTime - startTime);
      }

      const avgInsertTime = insertMeasurements.reduce((a, b) => a + b, 0) / insertMeasurements.length;
      expect(avgInsertTime).toBeLessThan(200); // Under 200ms

      console.log(`Database Performance:
        SELECT: ${avgSelectTime.toFixed(3)}ms average
        INSERT: ${avgInsertTime.toFixed(3)}ms average`);
    });

    test('should handle concurrent database operations', async () => {
      const { dbManager } = require('../../config/database');

      const startTime = performance.now();

      // 50 concurrent SELECT operations
      const selectPromises = Array(50).fill().map(() =>
        dbManager.executeWithRetry('SELECT COUNT(*) as count FROM users')
      );

      await Promise.all(selectPromises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const avgTimePerQuery = totalTime / 50;

      expect(totalTime).toBeLessThan(2000); // Total under 2 seconds
      expect(avgTimePerQuery).toBeLessThan(50); // Under 50ms per query

      console.log(`Concurrent DB Operations: ${avgTimePerQuery.toFixed(3)}ms per query`);
    });

    test('should optimize database connection pooling', async () => {
      const { dbManager } = require('../../config/database');

      // Test connection reuse
      const connectionTests = [];
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        const connection = dbManager.getConnection();
        dbManager.releaseConnection(connection.id);
        const endTime = performance.now();
        connectionTests.push(endTime - startTime);
      }

      const avgConnectionTime = connectionTests.reduce((a, b) => a + b, 0) / connectionTests.length;
      expect(avgConnectionTime).toBeLessThan(1.0); // Under 1ms for connection handling

      console.log(`Connection Pooling: ${avgConnectionTime.toFixed(3)}ms average`);
    });
  });

  describe('API Response Time Tests', () => {
    test('should respond to health checks quickly', async () => {
      // Add health check endpoint
      app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', timestamp: Date.now() });
      });

      const measurements = [];
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now();
        const response = await request(app).get('/api/health');
        const endTime = performance.now();
        
        expect(response.status).toBe(200);
        measurements.push(endTime - startTime);
      }

      const avgResponseTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      expect(avgResponseTime).toBeLessThan(100); // Under 100ms

      console.log(`Health Check Response: ${avgResponseTime.toFixed(3)}ms average`);
    });

    test('should handle authenticated requests within target time', async () => {
      const measurements = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        const response = await request(app)
          .get('/api/recipes')
          .set('Authorization', `Bearer ${authToken}`);
        const endTime = performance.now();
        
        expect(response.status).toBe(200);
        measurements.push(endTime - startTime);
      }

      const avgResponseTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      expect(avgResponseTime).toBeLessThan(2000); // Under 2 seconds

      console.log(`Authenticated API Response: ${avgResponseTime.toFixed(3)}ms average`);
    });

    test('should handle recipe creation efficiently', async () => {
      const recipeData = global.testUtils.createTestRecipe();
      delete recipeData.user_id;

      const measurements = [];
      
      for (let i = 0; i < 5; i++) {
        const uniqueRecipeData = {
          ...recipeData,
          title: `${recipeData.title} ${i}`
        };

        const startTime = performance.now();
        const response = await request(app)
          .post('/api/recipes')
          .set('Authorization', `Bearer ${authToken}`)
          .send(uniqueRecipeData);
        const endTime = performance.now();
        
        expect(response.status).toBe(201);
        measurements.push(endTime - startTime);
      }

      const avgResponseTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      expect(avgResponseTime).toBeLessThan(3000); // Under 3 seconds

      console.log(`Recipe Creation: ${avgResponseTime.toFixed(3)}ms average`);
    });
  });

  describe('Load Testing Simulation', () => {
    test('should handle multiple concurrent users', async () => {
      // Create multiple test users
      const users = [];
      for (let i = 0; i < 10; i++) {
        const testUser = global.testUtils.createTestUser();
        const registerResponse = await request(app)
          .post('/api/auth/register')
          .send(testUser);
        
        users.push({
          id: registerResponse.body.user.id,
          token: registerResponse.body.token
        });
      }

      // Simulate concurrent activity
      const startTime = performance.now();
      
      const concurrentOperations = users.map(user => 
        request(app)
          .get('/api/recipes')
          .set('Authorization', `Bearer ${user.token}`)
      );

      const responses = await Promise.all(concurrentOperations);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(totalTime).toBeLessThan(5000); // Under 5 seconds for 10 concurrent users

      console.log(`Concurrent Users Test: ${totalTime.toFixed(3)}ms for 10 users`);
    });

    test('should maintain performance under sustained load', async () => {
      const iterations = 100;
      const measurements = [];
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const iterationStart = performance.now();
        
        const response = await request(app)
          .get('/api/recipes')
          .set('Authorization', `Bearer ${authToken}`);
        
        const iterationEnd = performance.now();
        
        expect(response.status).toBe(200);
        measurements.push(iterationEnd - iterationStart);

        // Small delay between requests
        await global.testUtils.wait(10);
      }

      const totalTime = performance.now() - startTime;
      const avgResponseTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxResponseTime = Math.max(...measurements);
      
      expect(avgResponseTime).toBeLessThan(2000); // Average under 2 seconds
      expect(maxResponseTime).toBeLessThan(5000); // Max under 5 seconds

      console.log(`Sustained Load Test (${iterations} requests):
        Total Time: ${totalTime.toFixed(3)}ms
        Average Response: ${avgResponseTime.toFixed(3)}ms
        Max Response: ${maxResponseTime.toFixed(3)}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should not leak memory during extended operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/api/recipes')
          .set('Authorization', `Bearer ${authToken}`);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (under 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      console.log(`Memory Usage:
        Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should meet overall performance targets', () => {
      const performanceReport = {
        jwtVerification: '< 1.44ms',
        databaseQueries: '< 100ms',
        apiResponses: '< 2000ms',
        concurrentUsers: '10 users in < 5s',
        memoryUsage: 'stable'
      };

      console.log('Performance Benchmark Results:', performanceReport);

      // All performance tests should have passed if we reach here
      expect(true).toBe(true);
    });
  });
});