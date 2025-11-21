const { Pool } = require('pg');
const redis = require('redis');

// PostgreSQL接続プール設定
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'recipe_db',
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || '',
  max: parseInt(process.env.DB_POOL_MAX || '50'),
  min: parseInt(process.env.DB_POOL_MIN || '5'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Redis クライアント設定
let redisClient = null;
if (process.env.REDIS_URL) {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('Redis connected successfully');
  });
}

// データベース初期化
async function initialize() {
  try {
    // PostgreSQL接続テスト
    const client = await pool.connect();
    console.log('PostgreSQL connected successfully');
    client.release();

    // Redis接続（設定されている場合）
    if (redisClient && !redisClient.isOpen) {
      await redisClient.connect();
    }

    return { pool, redisClient };
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// クリーンアップ
async function close() {
  try {
    await pool.end();
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
    }
    console.log('Database connections closed');
  } catch (error) {
    console.error('Error closing database connections:', error);
    throw error;
  }
}

module.exports = {
  pool,
  redisClient,
  initialize,
  close,
};
