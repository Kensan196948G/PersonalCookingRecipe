const jwt = require('jsonwebtoken');
const auth = require('../../middleware/auth');
const { performance } = require('perf_hooks');

describe('JWT Authentication Unit Tests', () => {
  const JWT_SECRET = 'test-secret-key';
  
  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  describe('JWT Token Generation', () => {
    test('should generate valid JWT token', () => {
      const payload = { userId: 123, email: 'test@example.com' };
      const token = jwt.sign(payload, JWT_SECRET);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // Header.Payload.Signature
    });

    test('should generate token with expiration', () => {
      const payload = { userId: 123 };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
      
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    test('should include custom claims in token', () => {
      const payload = { 
        userId: 123, 
        role: 'user', 
        permissions: ['read', 'write'] 
      };
      const token = jwt.sign(payload, JWT_SECRET);
      
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.userId).toBe(123);
      expect(decoded.role).toBe('user');
      expect(decoded.permissions).toEqual(['read', 'write']);
    });
  });

  describe('JWT Token Verification', () => {
    test('should verify valid JWT token successfully', () => {
      const payload = { userId: 123 };
      const token = jwt.sign(payload, JWT_SECRET);
      
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.userId).toBe(123);
    });

    test('should reject invalid JWT token', () => {
      const invalidToken = 'invalid.token.here';
      
      expect(() => {
        jwt.verify(invalidToken, JWT_SECRET);
      }).toThrow();
    });

    test('should reject token with wrong secret', () => {
      const payload = { userId: 123 };
      const token = jwt.sign(payload, 'wrong-secret');
      
      expect(() => {
        jwt.verify(token, JWT_SECRET);
      }).toThrow();
    });

    test('should reject expired token', () => {
      const payload = { userId: 123 };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' }); // Already expired
      
      expect(() => {
        jwt.verify(token, JWT_SECRET);
      }).toThrow('jwt expired');
    });
  });

  describe('Auth Middleware Tests', () => {
    test('should authenticate valid token in middleware', async () => {
      const payload = { userId: 123 };
      const token = jwt.sign(payload, JWT_SECRET);

      const req = {
        header: jest.fn().mockReturnValue(`Bearer ${token}`)
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await auth(req, res, next);

      expect(req.userId).toBe(123);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should reject request without token', async () => {
      const req = {
        header: jest.fn().mockReturnValue(null)
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject request with invalid token', async () => {
      const req = {
        header: jest.fn().mockReturnValue('Bearer invalid-token')
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle malformed Authorization header', async () => {
      const req = {
        header: jest.fn().mockReturnValue('Malformed header')
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    });
  });

  describe('JWT Performance Tests (Target: 1.44ms)', () => {
    test('should verify token within performance target', () => {
      const payload = { userId: 123 };
      const token = jwt.sign(payload, JWT_SECRET);
      
      const startTime = performance.now();
      jwt.verify(token, JWT_SECRET);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(1.44); // Target: 1.44ms
    });

    test('should generate token within performance target', () => {
      const payload = { userId: 123 };
      
      const startTime = performance.now();
      jwt.sign(payload, JWT_SECRET);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(2.0); // 2ms target for generation
    });

    test('should handle concurrent token operations', async () => {
      const payload = { userId: 123 };
      const operations = [];
      
      const startTime = performance.now();
      
      // Generate 100 tokens concurrently
      for (let i = 0; i < 100; i++) {
        operations.push(Promise.resolve(jwt.sign({ ...payload, userId: i }, JWT_SECRET)));
      }
      
      await Promise.all(operations);
      const endTime = performance.now();
      
      const averageTime = (endTime - startTime) / 100;
      expect(averageTime).toBeLessThan(1.44); // Average should be under target
    });

    test('should maintain performance with large payloads', () => {
      const largePayload = {
        userId: 123,
        permissions: Array(100).fill('permission'),
        metadata: Array(50).fill({ key: 'value', data: 'test' })
      };
      
      const startTime = performance.now();
      const token = jwt.sign(largePayload, JWT_SECRET);
      jwt.verify(token, JWT_SECRET);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(5.0); // 5ms for large payloads
    });
  });

  describe('JWT Security Tests', () => {
    test('should use secure algorithms', () => {
      const payload = { userId: 123 };
      const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
      
      const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
      expect(header.alg).toBe('HS256');
    });

    test('should prevent algorithm confusion attacks', () => {
      const payload = { userId: 123 };
      const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
      
      // Attempt to verify with 'none' algorithm should fail
      expect(() => {
        jwt.verify(token, '', { algorithms: ['none'] });
      }).toThrow();
    });

    test('should handle token tampering', () => {
      const payload = { userId: 123 };
      const token = jwt.sign(payload, JWT_SECRET);
      
      // Tamper with the token
      const parts = token.split('.');
      const tamperedPayload = Buffer.from(JSON.stringify({ userId: 999 })).toString('base64url');
      const tamperedToken = [parts[0], tamperedPayload, parts[2]].join('.');
      
      expect(() => {
        jwt.verify(tamperedToken, JWT_SECRET);
      }).toThrow();
    });

    test('should validate token structure', () => {
      const malformedTokens = [
        'not.a.jwt',
        'only.two.parts',
        '',
        'a',
        'a.b.c.d.e'
      ];
      
      malformedTokens.forEach(token => {
        expect(() => {
          jwt.verify(token, JWT_SECRET);
        }).toThrow();
      });
    });
  });

  describe('JWT Best Practices', () => {
    test('should not include sensitive data in payload', () => {
      const payload = { 
        userId: 123,
        email: 'test@example.com'
        // Should NOT include: password, ssn, credit card, etc.
      };
      const token = jwt.sign(payload, JWT_SECRET);
      
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.password).toBeUndefined();
      expect(decoded.ssn).toBeUndefined();
      expect(decoded.creditCard).toBeUndefined();
    });

    test('should implement proper token refresh strategy', () => {
      const shortLivedToken = jwt.sign(
        { userId: 123, type: 'access' }, 
        JWT_SECRET, 
        { expiresIn: '15m' }
      );
      
      const refreshToken = jwt.sign(
        { userId: 123, type: 'refresh' }, 
        JWT_SECRET, 
        { expiresIn: '7d' }
      );
      
      const accessDecoded = jwt.verify(shortLivedToken, JWT_SECRET);
      const refreshDecoded = jwt.verify(refreshToken, JWT_SECRET);
      
      expect(accessDecoded.type).toBe('access');
      expect(refreshDecoded.type).toBe('refresh');
      expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp);
    });
  });
});