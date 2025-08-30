// PostgreSQL データベース設定 - SQLite置き換え
// Phase 1: 緊急安定化対応
const { Pool } = require('pg');
const Redis = require('redis');
const path = require('path');
require('dotenv').config();

class DatabaseManager {
    constructor() {
        this.pgPool = null;
        this.redisClient = null;
        this.isInitialized = false;
    }

    // PostgreSQL 接続プール初期化
    async initializePostgreSQL() {
        try {
            const pgConfig = {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432'),
                database: process.env.DB_NAME || 'recipe_db',
                user: process.env.DB_USER || 'recipe_user',
                password: process.env.DB_PASSWORD,
                
                // 接続プール最適化 (20-50接続)
                min: parseInt(process.env.DB_CONNECTION_POOL_MIN || '5'),
                max: parseInt(process.env.DB_CONNECTION_POOL_MAX || '50'),
                idleTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
                connectionTimeoutMillis: 10000,
                
                // パフォーマンス設定
                statement_timeout: 30000,
                query_timeout: 30000,
                application_name: 'PersonalCookingRecipe-Backend',
            };

            this.pgPool = new Pool(pgConfig);

            // 接続テスト
            const client = await this.pgPool.connect();
            console.log('✅ PostgreSQL接続成功');
            console.log(`📊 データベース: ${pgConfig.database}@${pgConfig.host}:${pgConfig.port}`);
            client.release();

            // データベーススキーマ初期化
            await this.initializeSchema();

            return this.pgPool;
        } catch (error) {
            console.error('❌ PostgreSQL接続エラー:', error.message);
            throw error;
        }
    }

    // Redis キャッシュ初期化
    async initializeRedis() {
        try {
            const redisConfig = {
                host: process.env.REDIS_HOST || 'redis',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD,
                
                // 接続設定
                retryDelayOnFailover: 100,
                enableReadyCheck: true,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                
                // JWT キャッシング用設定
                keyPrefix: 'recipe:',
                db: 0, // JWT用DB
            };

            this.redisClient = Redis.createClient(redisConfig);

            // エラーハンドリング
            this.redisClient.on('error', (err) => {
                console.error('❌ Redis接続エラー:', err.message);
            });

            this.redisClient.on('connect', () => {
                console.log('✅ Redis接続成功');
            });

            this.redisClient.on('ready', () => {
                console.log('📦 Redisキャッシュ準備完了');
            });

            await this.redisClient.connect();
            
            // 接続テスト
            await this.redisClient.ping();
            console.log('📊 Redis接続確認完了');

            return this.redisClient;
        } catch (error) {
            console.error('❌ Redis初期化エラー:', error.message);
            // Redis接続失敗時も続行（フォールバック）
            this.redisClient = null;
            return null;
        }
    }

    // データベーススキーマ初期化
    async initializeSchema() {
        const client = await this.pgPool.connect();
        try {
            // トランザクション開始
            await client.query('BEGIN');

            // Users テーブル
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `);

            // Categories テーブル
            await client.query(`
                CREATE TABLE IF NOT EXISTS categories (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `);

            // Recipes テーブル（最適化済み）
            await client.query(`
                CREATE TABLE IF NOT EXISTS recipes (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(500) NOT NULL,
                    description TEXT,
                    ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
                    instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
                    prep_time INTEGER,
                    cook_time INTEGER,
                    servings INTEGER,
                    difficulty_level VARCHAR(50),
                    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    image_url VARCHAR(1000),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `);

            // Recipe_ratings テーブル
            await client.query(`
                CREATE TABLE IF NOT EXISTS recipe_ratings (
                    id SERIAL PRIMARY KEY,
                    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                    review TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE(recipe_id, user_id)
                );
            `);

            // パフォーマンス最適化用インデックス
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
                CREATE INDEX IF NOT EXISTS idx_recipes_category_id ON recipes(category_id);
                CREATE INDEX IF NOT EXISTS idx_recipes_title ON recipes USING GIN (to_tsvector('english', title));
                CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_recipe_ratings_recipe_id ON recipe_ratings(recipe_id);
            `);

            // 初期カテゴリデータ投入
            await client.query(`
                INSERT INTO categories (name, description) VALUES 
                    ('和食', '日本の伝統料理'),
                    ('洋食', '西洋料理'),
                    ('中華', '中国料理'),
                    ('イタリアン', 'イタリア料理'),
                    ('デザート', '甘いもの・お菓子')
                ON CONFLICT DO NOTHING;
            `);

            await client.query('COMMIT');
            console.log('✅ データベーススキーマ初期化完了');

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ スキーマ初期化エラー:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    // 統合初期化
    async initialize() {
        if (this.isInitialized) {
            return { pgPool: this.pgPool, redisClient: this.redisClient };
        }

        try {
            console.log('🚀 データベース初期化開始...');

            // PostgreSQL と Redis を並列で初期化
            const [pgPool, redisClient] = await Promise.allSettled([
                this.initializePostgreSQL(),
                this.initializeRedis()
            ]);

            if (pgPool.status === 'rejected') {
                throw new Error(`PostgreSQL初期化失敗: ${pgPool.reason.message}`);
            }

            if (redisClient.status === 'rejected') {
                console.warn('⚠️ Redis初期化失敗 (続行):', redisClient.reason.message);
            }

            this.isInitialized = true;
            console.log('✅ データベース初期化完了');

            return { pgPool: this.pgPool, redisClient: this.redisClient };
        } catch (error) {
            console.error('❌ データベース初期化エラー:', error.message);
            throw error;
        }
    }

    // 接続取得
    async getConnection() {
        if (!this.pgPool) {
            throw new Error('PostgreSQL未初期化');
        }
        return await this.pgPool.connect();
    }

    // Redis操作（キャッシング用）
    async cacheGet(key) {
        if (!this.redisClient) return null;
        try {
            return await this.redisClient.get(key);
        } catch (error) {
            console.error('Redis GET エラー:', error.message);
            return null;
        }
    }

    async cacheSet(key, value, ttl = 3600) {
        if (!this.redisClient) return false;
        try {
            await this.redisClient.setEx(key, ttl, value);
            return true;
        } catch (error) {
            console.error('Redis SET エラー:', error.message);
            return false;
        }
    }

    async cacheDel(key) {
        if (!this.redisClient) return false;
        try {
            await this.redisClient.del(key);
            return true;
        } catch (error) {
            console.error('Redis DEL エラー:', error.message);
            return false;
        }
    }

    // 接続クリーンアップ
    async close() {
        try {
            if (this.pgPool) {
                await this.pgPool.end();
                console.log('✅ PostgreSQL接続クローズ完了');
            }
            if (this.redisClient) {
                await this.redisClient.quit();
                console.log('✅ Redis接続クローズ完了');
            }
        } catch (error) {
            console.error('❌ 接続クローズエラー:', error.message);
        }
    }
}

// シングルトンインスタンス
const dbManager = new DatabaseManager();

module.exports = {
    initialize: () => dbManager.initialize(),
    getConnection: () => dbManager.getConnection(),
    cacheGet: (key) => dbManager.cacheGet(key),
    cacheSet: (key, value, ttl) => dbManager.cacheSet(key, value, ttl),
    cacheDel: (key) => dbManager.cacheDel(key),
    close: () => dbManager.close(),
    dbManager // テスト用エクスポート
};