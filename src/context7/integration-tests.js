/**
 * Context7 Integration Test Suite
 * PersonalCookingRecipe統合版
 * 
 * Recipe-CTO設計・実装
 * 全Context7機能の統合テスト・品質保証
 */

const { describe, it, beforeAll, afterAll, expect } = require('@jest/globals');
const Context7Manager = require('./index');
const MultimodalProcessor = require('./multimodal-processor');
const RecipeSpecialization = require('./recipe-specialization');
const Redis = require('ioredis');
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

describe('Context7 Integration Test Suite', () => {
  let context7Manager;
  let multimodalProcessor;
  let recipeSpecialization;
  let testRedis;
  let testPgPool;

  beforeAll(async () => {
    // Test database configuration
    const testConfig = {
      redis: {
        host: process.env.TEST_REDIS_HOST || 'localhost',
        port: process.env.TEST_REDIS_PORT || 6380, // Different port for testing
        db: 15, // Use test database
        keyPrefix: 'test:context7:'
      },
      postgresql: {
        host: process.env.TEST_DB_HOST || 'localhost',
        port: process.env.TEST_DB_PORT || 5433, // Different port for testing
        database: process.env.TEST_DB_NAME || 'test_personal_cooking_recipe',
        user: process.env.TEST_DB_USER || 'test_user',
        password: process.env.TEST_DB_PASSWORD || 'test_password'
      }
    };

    // Initialize Context7 components
    context7Manager = new Context7Manager(testConfig);
    multimodalProcessor = new MultimodalProcessor(context7Manager);
    recipeSpecialization = new RecipeSpecialization(context7Manager);

    // Wait for initialization
    await new Promise(resolve => {
      context7Manager.on('ready', resolve);
    });

    testRedis = new Redis(testConfig.redis);
    testPgPool = new Pool(testConfig.postgresql);
  });

  afterAll(async () => {
    // Cleanup test data
    await testRedis.flushdb();
    await testRedis.quit();
    
    // Clean up test PostgreSQL tables
    const client = await testPgPool.connect();
    try {
      await client.query('DROP SCHEMA IF EXISTS test_context7 CASCADE');
    } finally {
      client.release();
    }
    await testPgPool.end();

    // Shutdown Context7 components
    await context7Manager.shutdown();
  });

  describe('Context7 Core Manager Tests', () => {
    it('should initialize all 7 layers correctly', async () => {
      expect(context7Manager.layers).toBeDefined();
      expect(Object.keys(context7Manager.layers)).toHaveLength(7);
      
      for (let i = 1; i <= 7; i++) {
        expect(context7Manager.layers[`layer${i}`]).toBeDefined();
        expect(context7Manager.layers[`layer${i}`].name).toBeDefined();
        expect(context7Manager.layers[`layer${i}`].priority).toBeDefined();
      }
    });

    it('should set and retrieve layer data correctly', async () => {
      const testData = {
        project: 'PersonalCookingRecipe',
        version: '2.0.0',
        timestamp: new Date().toISOString()
      };

      await context7Manager.setLayerData(1, testData);
      const retrievedData = await context7Manager.getLayerData(1);

      expect(retrievedData).toBeTruthy();
      expect(retrievedData.data.project).toBe(testData.project);
      expect(retrievedData.data.version).toBe(testData.version);
    });

    it('should handle layer data encryption/decryption', () => {
      const testData = { sensitive: 'information', api_key: 'secret123' };
      
      const encrypted = context7Manager.encrypt(testData);
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      const decrypted = context7Manager.decrypt(encrypted);
      expect(decrypted).toEqual(testData);
    });

    it('should register and manage agents correctly', async () => {
      const agentName = 'test-agent';
      const capabilities = ['testing', 'validation'];
      const layerAccess = [1, 2, 3];

      await context7Manager.registerAgent(agentName, capabilities, layerAccess);
      
      expect(context7Manager.agentRegistry.has(agentName)).toBe(true);
      
      const agentInfo = context7Manager.agentRegistry.get(agentName);
      expect(agentInfo.capabilities).toEqual(capabilities);
      expect(agentInfo.layerAccess).toEqual(layerAccess);
    });

    it('should record performance metrics accurately', async () => {
      const metricName = 'test_metric';
      const value = 123.45;
      const unit = 'ms';

      await context7Manager.recordPerformanceMetric(metricName, value, unit);

      // Check Redis storage
      const redisKey = `test:context7:metrics:${metricName}`;
      const stored = await testRedis.zrange(redisKey, 0, -1, 'WITHSCORES');
      expect(stored.length).toBeGreaterThan(0);

      const storedData = JSON.parse(stored[0]);
      expect(storedData.value).toBe(value);
      expect(storedData.unit).toBe(unit);
    });

    it('should perform health checks correctly', async () => {
      const health = await context7Manager.healthCheck();
      
      expect(health.status).toBeDefined();
      expect(health.timestamp).toBeDefined();
      expect(health.services).toBeDefined();
      expect(health.services.redis).toBeDefined();
      expect(health.services.postgresql).toBeDefined();
    });
  });

  describe('Multimodal Processor Tests', () => {
    const testImagePath = path.join(__dirname, '../../../test-assets/test-image.jpg');
    const testTextPath = path.join(__dirname, '../../../test-assets/test-code.js');

    beforeAll(async () => {
      // Create test assets directory
      await fs.mkdir(path.dirname(testImagePath), { recursive: true });
      
      // Create test image (minimal JPEG)
      const minimalJpeg = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46,
        0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
        0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01,
        0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xFF,
        0xDA, 0x00, 0x0C, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11,
        0x00, 0x3F, 0x00, 0x00, 0xFF, 0xD9
      ]);
      await fs.writeFile(testImagePath, minimalJpeg);

      // Create test code file
      const testCode = `
        // Test JavaScript file
        function calculateRecipeScore(ingredients, instructions) {
          let score = 0;
          if (ingredients && ingredients.length > 0) {
            score += ingredients.length * 0.1;
          }
          if (instructions && instructions.length > 0) {
            score += instructions.length * 0.2;
          }
          return Math.min(score, 1.0);
        }
        
        module.exports = { calculateRecipeScore };
      `;
      await fs.writeFile(testTextPath, testCode);
    });

    afterAll(async () => {
      // Clean up test assets
      try {
        await fs.unlink(testImagePath);
        await fs.unlink(testTextPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should validate file formats and sizes', async () => {
      await expect(
        multimodalProcessor.validateFile(testImagePath, 'image')
      ).resolves.toBe(true);

      await expect(
        multimodalProcessor.validateFile(testTextPath, 'text')
      ).resolves.toBe(true);
    });

    it('should process text files correctly', async () => {
      const result = await multimodalProcessor.processText(testTextPath);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.fileExtension).toBe('js');
      expect(result.analysis).toBeDefined();
      expect(result.analysis.content).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should detect code complexity correctly', () => {
      const testCode = `
        function complexFunction(a, b, c) {
          if (a > 0) {
            for (let i = 0; i < b; i++) {
              if (c[i]) {
                switch (c[i].type) {
                  case 'A':
                    return handleA();
                  case 'B':
                    return handleB();
                  default:
                    return handleDefault();
                }
              }
            }
          }
          return null;
        }
      `;

      const complexity = multimodalProcessor.calculateComplexity(testCode);
      expect(complexity).toBeGreaterThan(1);
    });

    it('should detect sensitive data in text', () => {
      const testText = `
        const config = {
          email: "user@example.com",
          api_key: "sk-1234567890abcdef1234567890abcdef",
          password: "secretpassword123"
        };
      `;

      const findings = multimodalProcessor.detectSensitiveData(testText);
      expect(findings.email).toBeGreaterThan(0);
      expect(findings.apiKey).toBeGreaterThan(0);
      expect(findings.password).toBeGreaterThan(0);
    });

    it('should generate appropriate recommendations', () => {
      const analysis = { complexity: 15 };
      const securityScan = { 
        sensitiveData: { apiKey: 1, password: 1 } 
      };

      const recommendations = multimodalProcessor.generateTextRecommendations(
        analysis, 
        securityScan
      );

      expect(recommendations).toHaveLength(2);
      expect(recommendations[0].type).toBe('complexity');
      expect(recommendations[1].type).toBe('security');
    });

    it('should perform health checks correctly', async () => {
      const health = await multimodalProcessor.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
      expect(health.queueLength).toBeDefined();
    });
  });

  describe('Recipe Specialization Tests', () => {
    it('should initialize recipe-specific schema', async () => {
      const client = await testPgPool.connect();
      
      try {
        // Check if recipe monitoring table exists
        const result = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'context7_recipe_monitoring'
        `);
        
        expect(result.rows.length).toBeGreaterThan(0);
      } finally {
        client.release();
      }
    });

    it('should register channels correctly', async () => {
      const channelName = 'Test Cooking Channel';
      const config = {
        channelId: 'TEST123',
        priority: 'high',
        updateFrequency: '15min'
      };

      await recipeSpecialization.registerChannel(channelName, config);

      const client = await testPgPool.connect();
      try {
        const result = await client.query(
          'SELECT * FROM context7_recipe_monitoring WHERE channel_name = $1',
          [channelName]
        );
        
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].channel_id).toBe(config.channelId);
      } finally {
        client.release();
      }
    });

    it('should calculate recipe quality scores correctly', () => {
      const highQualityRecipe = {
        ingredients: new Array(8).fill('ingredient'),
        instructions: new Array(6).fill('instruction'),
        nutrition: { calories: 350, protein: 25 },
        cookTime: '30min',
        difficulty: 'medium',
        servings: 4,
        tags: ['healthy', 'quick']
      };

      const score = recipeSpecialization.calculateRecipeQualityScore(highQualityRecipe);
      expect(score).toBeGreaterThan(0.8);

      const lowQualityRecipe = {
        ingredients: ['ingredient'],
        instructions: ['instruction']
      };

      const lowScore = recipeSpecialization.calculateRecipeQualityScore(lowQualityRecipe);
      expect(lowScore).toBeLessThan(0.5);
    });

    it('should perform JWT authentication within performance target', async () => {
      const userId = 'test-user-123';
      const testData = { role: 'user' };

      // Generate JWT token
      const generated = await recipeSpecialization.generateJWT(userId, testData);
      expect(generated.token).toBeDefined();
      expect(generated.performanceMs).toBeLessThan(5); // Should be very fast

      // Verify JWT token
      const verified = await recipeSpecialization.authenticateJWT(generated.token);
      expect(verified.valid).toBe(true);
      expect(verified.decoded.userId).toBe(userId);
      expect(verified.performanceMs).toBeLessThan(1.44); // Performance target
    });

    it('should record JWT performance metrics', async () => {
      await recipeSpecialization.recordJWTPerformance('test_operation', 1.2, true, 'test-user');

      const client = await testPgPool.connect();
      try {
        const result = await client.query(
          'SELECT * FROM context7_jwt_performance WHERE operation_type = $1',
          ['test_operation']
        );
        
        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.rows[0].execution_time_ms).toBe('1.200');
        expect(result.rows[0].success).toBe(true);
      } finally {
        client.release();
      }
    });

    it('should parse time strings to milliseconds correctly', () => {
      expect(recipeSpecialization.parseTimeToMs('15min')).toBe(900000);
      expect(recipeSpecialization.parseTimeToMs('30s')).toBe(30000);
      expect(recipeSpecialization.parseTimeToMs('1h')).toBe(3600000);
    });

    it('should perform health checks correctly', async () => {
      const health = await recipeSpecialization.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
      expect(health.active_channels).toBeDefined();
      expect(health.jwt_performance_target).toBe(1.44);
    });
  });

  describe('Integration Tests', () => {
    it('should integrate all components seamlessly', async () => {
      // Test full integration flow
      const testRecipeData = {
        name: 'Test Recipe',
        ingredients: ['ingredient1', 'ingredient2'],
        instructions: ['step1', 'step2'],
        cookTime: '25min'
      };

      // Set recipe data in Context7
      await context7Manager.setLayerData(4, {
        currentRecipe: testRecipeData,
        analysisInProgress: true
      });

      // Register a recipe agent
      await context7Manager.registerAgent(
        'test-recipe-agent',
        ['recipe-analysis'],
        [1, 3, 4]
      );

      // Process recipe data through multimodal processor (mock text analysis)
      const textAnalysisResult = await multimodalProcessor.analyzeGenericText(
        JSON.stringify(testRecipeData)
      );

      // Calculate quality score through recipe specialization
      const qualityScore = recipeSpecialization.calculateRecipeQualityScore(testRecipeData);

      // Verify integration results
      expect(qualityScore).toBeGreaterThan(0);
      expect(textAnalysisResult).toBeDefined();

      // Verify layer data persistence
      const retrievedData = await context7Manager.getLayerData(4);
      expect(retrievedData.data.currentRecipe.name).toBe(testRecipeData.name);
    });

    it('should handle concurrent operations correctly', async () => {
      const concurrentOperations = [];

      // Simulate multiple concurrent layer operations
      for (let i = 1; i <= 5; i++) {
        concurrentOperations.push(
          context7Manager.setLayerData(i, {
            testData: `concurrent-test-${i}`,
            timestamp: new Date().toISOString()
          })
        );
      }

      // Execute all operations concurrently
      await Promise.all(concurrentOperations);

      // Verify all operations completed successfully
      for (let i = 1; i <= 5; i++) {
        const data = await context7Manager.getLayerData(i);
        expect(data.data.testData).toBe(`concurrent-test-${i}`);
      }
    });

    it('should handle error conditions gracefully', async () => {
      // Test invalid layer number
      await expect(
        context7Manager.setLayerData(999, { invalid: 'layer' })
      ).rejects.toThrow('Invalid layer number');

      // Test oversized data
      const oversizedData = 'x'.repeat(100 * 1024 * 1024); // 100MB
      await expect(
        context7Manager.setLayerData(1, { data: oversizedData })
      ).rejects.toThrow('exceeds layer limit');

      // Test invalid file validation
      await expect(
        multimodalProcessor.validateFile('/nonexistent/file.jpg', 'image')
      ).rejects.toThrow();
    });

    it('should maintain data consistency across components', async () => {
      const testData = {
        project: 'consistency-test',
        version: '1.0.0',
        components: ['context7', 'multimodal', 'recipe-spec']
      };

      // Set data through Context7
      await context7Manager.setLayerData(1, testData);

      // Retrieve through different component
      const layer1Data = await context7Manager.getLayerData(1);

      // Record performance metric
      await context7Manager.recordPerformanceMetric('consistency_test', 100, 'ms', 1);

      // Verify consistency
      expect(layer1Data.data.project).toBe(testData.project);
      expect(layer1Data.data.components).toEqual(testData.components);
    });

    it('should achieve performance targets', async () => {
      const performanceTests = [];

      // Test Context7 layer retrieval performance
      const layerStart = Date.now();
      await context7Manager.getLayerData(1);
      const layerTime = Date.now() - layerStart;
      expect(layerTime).toBeLessThan(100); // < 100ms target

      // Test JWT authentication performance
      const jwt = await recipeSpecialization.generateJWT('perf-test-user');
      const authResult = await recipeSpecialization.authenticateJWT(jwt.token);
      expect(authResult.performanceMs).toBeLessThan(1.44); // 1.44ms target

      // Test multimodal processing efficiency
      const processingStart = Date.now();
      await multimodalProcessor.analyzeGenericText('performance test content');
      const processingTime = Date.now() - processingStart;
      expect(processingTime).toBeLessThan(5000); // < 5s for text analysis
    });
  });
});

// Performance benchmarking utilities
class PerformanceBenchmark {
  static async measureFunction(fn, iterations = 100) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await fn();
      const end = process.hrtime.bigint();
      times.push(Number(end - start) / 1000000); // Convert to milliseconds
    }

    return {
      min: Math.min(...times),
      max: Math.max(...times),
      average: times.reduce((a, b) => a + b) / times.length,
      p95: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)],
      p99: times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)]
    };
  }

  static async benchmarkContext7Operations(context7Manager) {
    console.log('🚀 Context7 Performance Benchmarks');
    
    // Benchmark layer data operations
    const setDataBench = await this.measureFunction(async () => {
      await context7Manager.setLayerData(1, { benchmark: Date.now() });
    });
    
    const getDataBench = await this.measureFunction(async () => {
      await context7Manager.getLayerData(1);
    });

    console.log('Layer Set Operation:', setDataBench);
    console.log('Layer Get Operation:', getDataBench);

    return { setData: setDataBench, getData: getDataBench };
  }
}

module.exports = { PerformanceBenchmark };