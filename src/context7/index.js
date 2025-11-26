/**
 * Context7 Multi-Layer Context Management System
 * PersonalCookingRecipe統合版
 * 
 * Recipe-CTO設計・実装
 * セキュア・高性能・マルチモーダル対応
 */

const Redis = require('ioredis');
const { Pool } = require('pg');
const winston = require('winston');
const crypto = require('crypto');
const EventEmitter = require('events');

class Context7Manager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        keyPrefix: 'context7:',
        db: 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      },
      postgresql: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'personal_cooking_recipe',
        user: process.env.DB_USER || 'recipe_user',
        password: process.env.DB_PASSWORD,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      },
      security: {
        encryptionKey: process.env.CONTEXT7_ENCRYPTION_KEY || crypto.randomBytes(32),
        algorithm: 'aes-256-gcm'
      },
      performance: {
        maxMemoryMB: 512,
        compressionThreshold: 1024,
        cacheTimeout: 3600,
        batchSize: 100
      },
      ...config
    };

    this.redis = new Redis(this.config.redis);
    this.pgPool = new Pool(this.config.postgresql);
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/context7-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/context7-combined.log' }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });

    this.layers = this.initializeLayers();
    this.agentRegistry = new Map();
    this.processingQueue = [];
    
    this.init();
  }

  initializeLayers() {
    return {
      layer1: {
        name: 'プロジェクト基本情報',
        priority: 10,
        storage: 'redis',
        ttl: 3600,
        maxSize: '50MB'
      },
      layer2: {
        name: 'コード構造・アーキテクチャ', 
        priority: 9,
        storage: 'redis+postgresql',
        ttl: 7200,
        maxSize: '100MB'
      },
      layer3: {
        name: 'データベース・API設計',
        priority: 8,
        storage: 'postgresql',
        ttl: 86400,
        maxSize: '200MB'
      },
      layer4: {
        name: '開発進捗・課題管理',
        priority: 7,
        storage: 'postgresql',
        ttl: 86400,
        maxSize: '150MB'
      },
      layer5: {
        name: 'パフォーマンス・メトリクス',
        priority: 6,
        storage: 'redis+postgresql',
        ttl: 43200,
        maxSize: '300MB'
      },
      layer6: {
        name: 'テスト・品質管理',
        priority: 5,
        storage: 'postgresql',
        ttl: 86400,
        maxSize: '250MB'
      },
      layer7: {
        name: 'デプロイ・運用管理',
        priority: 4,
        storage: 'postgresql',
        ttl: 2592000,
        maxSize: '500MB'
      }
    };
  }

  async init() {
    try {
      // Redis接続確認
      await this.redis.ping();
      this.logger.info('Redis connection established');

      // PostgreSQL接続確認
      const client = await this.pgPool.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.logger.info('PostgreSQL connection established');

      // データベーススキーマ初期化
      await this.initializeSchema();
      
      // Context7システム開始
      this.emit('ready');
      this.logger.info('Context7 Manager initialized successfully');

    } catch (error) {
      this.logger.error('Context7 initialization failed:', error);
      throw error;
    }
  }

  async initializeSchema() {
    const client = await this.pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Context7コアテーブル
      await client.query(`
        CREATE TABLE IF NOT EXISTS context7_layers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          layer_number INTEGER NOT NULL,
          layer_name VARCHAR(100) NOT NULL,
          data_json JSONB NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          version INTEGER DEFAULT 1,
          checksum VARCHAR(64),
          UNIQUE(layer_number)
        )
      `);

      // マルチモーダルコンテンツテーブル
      await client.query(`
        CREATE TABLE IF NOT EXISTS context7_multimodal (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          content_type VARCHAR(50) NOT NULL,
          content_path TEXT,
          content_hash VARCHAR(64),
          analysis_result JSONB,
          layer_id UUID REFERENCES context7_layers(id),
          processed_at TIMESTAMP DEFAULT NOW(),
          file_size BIGINT,
          metadata JSONB DEFAULT '{}'
        )
      `);

      // エージェント連携テーブル
      await client.query(`
        CREATE TABLE IF NOT EXISTS context7_agent_interactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_name VARCHAR(100) NOT NULL,
          interaction_type VARCHAR(50) NOT NULL,
          context_data JSONB NOT NULL,
          result JSONB,
          layer_access JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT NOW(),
          execution_time_ms INTEGER,
          success BOOLEAN DEFAULT true
        )
      `);

      // パフォーマンス監視テーブル
      await client.query(`
        CREATE TABLE IF NOT EXISTS context7_performance_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          metric_name VARCHAR(100) NOT NULL,
          metric_value NUMERIC NOT NULL,
          metric_unit VARCHAR(20),
          layer_number INTEGER,
          timestamp TIMESTAMP DEFAULT NOW(),
          metadata JSONB DEFAULT '{}'
        )
      `);

      // インデックス作成
      await client.query('CREATE INDEX IF NOT EXISTS idx_context7_layers_layer_number ON context7_layers(layer_number)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_context7_layers_updated_at ON context7_layers(updated_at)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_context7_multimodal_content_type ON context7_multimodal(content_type)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_context7_agent_interactions_agent_name ON context7_agent_interactions(agent_name)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_context7_performance_metrics_metric_name ON context7_performance_metrics(metric_name, timestamp)');

      // GINインデックス（JSONB検索用）
      await client.query('CREATE INDEX IF NOT EXISTS idx_context7_layers_data_json ON context7_layers USING gin(data_json)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_context7_multimodal_analysis ON context7_multimodal USING gin(analysis_result)');

      await client.query('COMMIT');
      
      this.logger.info('Context7 database schema initialized');

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Schema initialization failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // セキュア暗号化機能
  encrypt(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.config.security.algorithm, this.config.security.encryptionKey);
    cipher.setAAD(Buffer.from('context7'));
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData) {
    const decipher = crypto.createDecipher(this.config.security.algorithm, this.config.security.encryptionKey);
    decipher.setAAD(Buffer.from('context7'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  // Context7レイヤー管理
  async setLayerData(layerNumber, data, metadata = {}) {
    const startTime = Date.now();
    
    try {
      const layerConfig = this.layers[`layer${layerNumber}`];
      if (!layerConfig) {
        throw new Error(`Invalid layer number: ${layerNumber}`);
      }

      // データサイズチェック
      const dataSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
      if (dataSize > this.parseSize(layerConfig.maxSize)) {
        throw new Error(`Data size ${dataSize} exceeds layer limit ${layerConfig.maxSize}`);
      }

      // チェックサム計算
      const checksum = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

      // ストレージに基づいて保存
      if (layerConfig.storage.includes('redis')) {
        const redisKey = `layer:${layerNumber}`;
        await this.redis.hset(redisKey, {
          data: JSON.stringify(data),
          metadata: JSON.stringify(metadata),
          checksum,
          updated_at: new Date().toISOString()
        });
        await this.redis.expire(redisKey, layerConfig.ttl);
      }

      if (layerConfig.storage.includes('postgresql')) {
        const client = await this.pgPool.connect();
        try {
          await client.query(`
            INSERT INTO context7_layers (layer_number, layer_name, data_json, metadata, checksum)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (layer_number) 
            DO UPDATE SET 
              data_json = $3, 
              metadata = $4, 
              checksum = $5,
              updated_at = NOW(),
              version = context7_layers.version + 1
          `, [layerNumber, layerConfig.name, data, metadata, checksum]);
        } finally {
          client.release();
        }
      }

      // パフォーマンスメトリクス記録
      const executionTime = Date.now() - startTime;
      await this.recordPerformanceMetric('layer_set_time', executionTime, 'ms', layerNumber);

      this.logger.info(`Layer ${layerNumber} data set successfully (${executionTime}ms)`);
      this.emit('layerUpdated', { layerNumber, dataSize, executionTime });

      return true;

    } catch (error) {
      this.logger.error(`Failed to set layer ${layerNumber} data:`, error);
      throw error;
    }
  }

  async getLayerData(layerNumber, options = {}) {
    const startTime = Date.now();
    
    try {
      const layerConfig = this.layers[`layer${layerNumber}`];
      if (!layerConfig) {
        throw new Error(`Invalid layer number: ${layerNumber}`);
      }

      let data = null;

      // Redis最優先で高速取得
      if (layerConfig.storage.includes('redis')) {
        const redisKey = `layer:${layerNumber}`;
        const cachedData = await this.redis.hgetall(redisKey);
        
        if (cachedData && cachedData.data) {
          data = {
            data: JSON.parse(cachedData.data),
            metadata: JSON.parse(cachedData.metadata || '{}'),
            checksum: cachedData.checksum,
            source: 'redis'
          };
        }
      }

      // PostgreSQLフォールバック
      if (!data && layerConfig.storage.includes('postgresql')) {
        const client = await this.pgPool.connect();
        try {
          const result = await client.query(`
            SELECT data_json, metadata, checksum, updated_at, version
            FROM context7_layers 
            WHERE layer_number = $1
          `, [layerNumber]);

          if (result.rows.length > 0) {
            const row = result.rows[0];
            data = {
              data: row.data_json,
              metadata: row.metadata,
              checksum: row.checksum,
              updated_at: row.updated_at,
              version: row.version,
              source: 'postgresql'
            };

            // Redisにキャッシュ
            if (layerConfig.storage.includes('redis')) {
              const redisKey = `layer:${layerNumber}`;
              await this.redis.hset(redisKey, {
                data: JSON.stringify(data.data),
                metadata: JSON.stringify(data.metadata),
                checksum: data.checksum,
                updated_at: data.updated_at.toISOString()
              });
              await this.redis.expire(redisKey, layerConfig.ttl);
            }
          }
        } finally {
          client.release();
        }
      }

      // パフォーマンスメトリクス記録
      const executionTime = Date.now() - startTime;
      await this.recordPerformanceMetric('layer_get_time', executionTime, 'ms', layerNumber);

      if (data) {
        this.logger.info(`Layer ${layerNumber} data retrieved from ${data.source} (${executionTime}ms)`);
        return data;
      } else {
        this.logger.warn(`Layer ${layerNumber} data not found`);
        return null;
      }

    } catch (error) {
      this.logger.error(`Failed to get layer ${layerNumber} data:`, error);
      throw error;
    }
  }

  // エージェント登録・連携機能
  async registerAgent(agentName, capabilities = [], layerAccess = []) {
    try {
      const agentInfo = {
        name: agentName,
        capabilities,
        layerAccess,
        registeredAt: new Date(),
        lastActivity: new Date(),
        status: 'active'
      };

      this.agentRegistry.set(agentName, agentInfo);
      
      // Redis保存
      await this.redis.hset('agents:registry', agentName, JSON.stringify(agentInfo));

      this.logger.info(`Agent ${agentName} registered with capabilities:`, capabilities);
      this.emit('agentRegistered', agentInfo);

      return true;

    } catch (error) {
      this.logger.error(`Failed to register agent ${agentName}:`, error);
      throw error;
    }
  }

  // パフォーマンスメトリクス記録
  async recordPerformanceMetric(metricName, value, unit = 'count', layerNumber = null) {
    try {
      // Redis即座記録
      const redisKey = `metrics:${metricName}`;
      await this.redis.zadd(redisKey, Date.now(), JSON.stringify({
        value,
        unit,
        layerNumber,
        timestamp: new Date().toISOString()
      }));

      // PostgreSQL永続化（バッチ処理）
      this.processingQueue.push({
        type: 'performance_metric',
        data: { metricName, value, unit, layerNumber }
      });

      // キュー処理
      if (this.processingQueue.length >= this.config.performance.batchSize) {
        await this.processQueue();
      }

    } catch (error) {
      this.logger.error('Failed to record performance metric:', error);
    }
  }

  // バッチ処理キュー
  async processQueue() {
    if (this.processingQueue.length === 0) return;

    const client = await this.pgPool.connect();
    
    try {
      await client.query('BEGIN');

      for (const item of this.processingQueue) {
        if (item.type === 'performance_metric') {
          await client.query(`
            INSERT INTO context7_performance_metrics 
            (metric_name, metric_value, metric_unit, layer_number)
            VALUES ($1, $2, $3, $4)
          `, [item.data.metricName, item.data.value, item.data.unit, item.data.layerNumber]);
        }
      }

      await client.query('COMMIT');
      this.processingQueue = [];

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Queue processing failed:', error);
    } finally {
      client.release();
    }
  }

  // ユーティリティメソッド
  parseSize(sizeString) {
    const units = { 'KB': 1024, 'MB': 1024 * 1024, 'GB': 1024 * 1024 * 1024 };
    const match = sizeString.match(/^(\d+)(KB|MB|GB)$/);
    return match ? parseInt(match[1]) * units[match[2]] : parseInt(sizeString);
  }

  // 健全性チェック
  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {}
    };

    try {
      // Redis チェック
      const redisStart = Date.now();
      await this.redis.ping();
      health.services.redis = {
        status: 'healthy',
        latency: Date.now() - redisStart
      };
    } catch (error) {
      health.services.redis = { status: 'unhealthy', error: error.message };
      health.status = 'degraded';
    }

    try {
      // PostgreSQL チェック
      const pgStart = Date.now();
      const client = await this.pgPool.connect();
      await client.query('SELECT 1');
      client.release();
      health.services.postgresql = {
        status: 'healthy',
        latency: Date.now() - pgStart
      };
    } catch (error) {
      health.services.postgresql = { status: 'unhealthy', error: error.message };
      health.status = 'degraded';
    }

    return health;
  }

  // グレースフル終了
  async shutdown() {
    this.logger.info('Context7 Manager shutting down...');

    try {
      // 残りのキューを処理
      await this.processQueue();
      
      // 接続終了
      await this.redis.quit();
      await this.pgPool.end();
      
      this.logger.info('Context7 Manager shutdown complete');
      this.emit('shutdown');
      
    } catch (error) {
      this.logger.error('Shutdown error:', error);
    }
  }
}

module.exports = Context7Manager;