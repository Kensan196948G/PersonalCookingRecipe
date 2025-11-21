const request = require('supertest');
const app = require('../src/server');

describe('Health Check', () => {
  test('GET /api/health should return OK', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);
    
    expect(response.body).toEqual({
      status: 'OK',
      message: 'Recipe API is running'
    });
  });

  test('GET /api/health should respond within 500ms', async () => {
    const start = Date.now();
    await request(app)
      .get('/api/health')
      .expect(200);
    const end = Date.now();
    
    expect(end - start).toBeLessThan(500);
  });
});