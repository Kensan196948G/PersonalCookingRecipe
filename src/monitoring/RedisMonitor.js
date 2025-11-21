/**
 * Redis キャッシュ監視モジュール
 * PersonalCookingRecipe統合開発環境
 */

const Redis = require('ioredis');
const winston = require('winston');

class RedisMonitor {
    constructor(config = {}) {
        this.config = {
            host: config.host || process.env.REDIS_HOST || 'localhost',
            port: config.port || process.env.REDIS_PORT || 6379,
            password: config.password || process.env.REDIS_PASSWORD,
            db: config.db || 0,
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000,
            healthCheckTimeout: config.healthCheckTimeout || 5000,
            connectionTimeout: config.connectionTimeout || 5000,
            lazyConnect: true, // 手動接続制御
            ...config
        };

        this.client = null;
        this.isHealthy = false;
        this.lastError = null;
        this.connectionAttempts = 0;
        this.lastHealthCheck = null;
        this.metrics = {
            totalCommands: 0,
            failedCommands: 0,
            avgResponseTime: 0,
            lastPingTime: null
        };

        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'redis-monitor' },
            transports: [
                new winston.transports.File({ 
                    filename: 'logs/redis-monitor.log' 
                }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });

        this.initialize();
    }

    async initialize() {
        try {
            await this.createClient();
            await this.testConnection();
            this.isHealthy = true;
            this.logger.info('Redis監視初期化完了');
        } catch (error) {
            this.logger.error('Redis監視初期化失敗', error);
            this.isHealthy = false;
            this.lastError = error;
        }
    }

    async createClient() {
        if (this.client) {
            this.client.disconnect();
        }

        this.client = new Redis({
            host: this.config.host,
            port: this.config.port,
            password: this.config.password,
            db: this.config.db,
            connectTimeout: this.config.connectionTimeout,
            lazyConnect: this.config.lazyConnect,
            maxRetriesPerRequest: this.config.maxRetries,
            retryDelayOnFailover: this.config.retryDelay
        });

        // イベントリスナー設定
        this.client.on('connect', () => {
            this.logger.info('Redis接続確立');
            this.connectionAttempts = 0;
        });

        this.client.on('ready', () => {
            this.logger.info('Redis準備完了');
            this.isHealthy = true;
        });

        this.client.on('error', (error) => {
            this.logger.error('Redisクライアントエラー', error);
            this.isHealthy = false;
            this.lastError = error;
            this.connectionAttempts++;
        });

        this.client.on('close', () => {
            this.logger.warn('Redis接続終了');
            this.isHealthy = false;
        });

        this.client.on('reconnecting', (delay) => {
            this.logger.info(`Redis再接続試行中... (${delay}ms後)`);
        });
    }

    async testConnection() {
        if (!this.client) {
            throw new Error('Redis client not initialized');
        }

        const startTime = Date.now();
        
        try {
            // 接続確立
            await this.client.connect();
            
            // PINGテスト
            const pingResult = await this.client.ping();
            const duration = Date.now() - startTime;
            
            if (pingResult !== 'PONG') {
                throw new Error(`Unexpected ping response: ${pingResult}`);
            }

            // サーバー情報取得
            const serverInfo = await this.client.info('server');
            const memoryInfo = await this.client.info('memory');
            
            this.lastHealthCheck = new Date();
            this.connectionAttempts = 0;
            this.metrics.lastPingTime = duration;
            
            this.logger.info(`Redis接続テスト成功 (${duration}ms)`);

            return {
                healthy: true,
                duration,
                details: {
                    pingResponse: pingResult,
                    serverInfo: this.parseRedisInfo(serverInfo),
                    memoryInfo: this.parseRedisInfo(memoryInfo)
                }
            };

        } catch (error) {
            this.connectionAttempts++;
            throw error;
        }
    }

    parseRedisInfo(infoString) {
        const info = {};
        const lines = infoString.split('\r\n');
        
        lines.forEach(line => {
            if (line && !line.startsWith('#') && line.includes(':')) {
                const [key, value] = line.split(':');
                info[key.trim()] = value.trim();
            }
        });
        
        return info;
    }

    async checkHealth() {
        try {
            const result = await Promise.race([
                this.performHealthCheck(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Health check timeout')), 
                              this.config.healthCheckTimeout)
                )
            ]);

            this.isHealthy = true;
            this.lastError = null;
            return result;

        } catch (error) {
            this.connectionAttempts++;
            this.isHealthy = false;
            this.lastError = error;
            
            this.logger.error('Redisヘルスチェック失敗', {
                error: error.message,
                attempts: this.connectionAttempts
            });

            return {
                healthy: false,
                message: error.message,
                details: {
                    attempts: this.connectionAttempts,
                    lastError: error.message
                }
            };
        }
    }

    async performHealthCheck() {
        const startTime = Date.now();
        
        // 基本PING
        const pingResult = await this.client.ping();
        const pingDuration = Date.now() - startTime;
        
        // メモリ使用量チェック
        const memInfo = await this.client.info('memory');
        const memoryData = this.parseRedisInfo(memInfo);
        
        // キー統計
        const keyStats = await this.getKeyStats();
        
        // レプリケーション状態
        const replInfo = await this.client.info('replication');
        const replicationData = this.parseRedisInfo(replInfo);

        this.metrics.lastPingTime = pingDuration;
        this.lastHealthCheck = new Date();

        return {
            healthy: true,
            duration: pingDuration,
            details: {
                ping: pingResult,
                memory: {
                    usedMemory: parseInt(memoryData.used_memory) || 0,
                    maxMemory: parseInt(memoryData.maxmemory) || 0,
                    memoryFragmentationRatio: parseFloat(memoryData.mem_fragmentation_ratio) || 0
                },
                keys: keyStats,
                replication: {
                    role: replicationData.role,
                    connectedSlaves: parseInt(replicationData.connected_slaves) || 0
                }
            }
        };
    }

    async getKeyStats() {
        try {
            const dbInfo = await this.client.info('keyspace');
            const keyspaceData = this.parseRedisInfo(dbInfo);
            
            const stats = {};
            Object.keys(keyspaceData).forEach(key => {
                if (key.startsWith('db')) {
                    const match = keyspaceData[key].match(/keys=(\d+),expires=(\d+),avg_ttl=(\d+)/);
                    if (match) {
                        stats[key] = {
                            keys: parseInt(match[1]),
                            expires: parseInt(match[2]),
                            avgTtl: parseInt(match[3])
                        };
                    }
                }
            });
            
            return stats;
        } catch (error) {
            return { error: error.message };
        }
    }

    async repairConnection() {
        this.logger.info('Redis接続修復開始');
        
        try {
            // ステップ1: 基本接続テスト
            try {
                await this.testConnection();
                this.logger.info('基本接続テストで修復完了');
                return { success: true, method: 'connection_test' };
            } catch (error) {
                this.logger.warn('基本接続テスト失敗、クライアント再作成を試行');
            }

            // ステップ2: クライアント再作成
            try {
                await this.recreateClient();
                await this.testConnection();
                this.logger.info('クライアント再作成で修復完了');
                return { success: true, method: 'client_recreation' };
            } catch (error) {
                this.logger.error('クライアント再作成失敗', error);
                throw error;
            }

        } catch (error) {
            this.logger.error('Redis接続修復失敗', error);
            return { success: false, error: error.message };
        }
    }

    async recreateClient() {
        this.logger.info('Redisクライアント再作成開始');
        
        try {
            if (this.client) {
                this.client.disconnect();
                this.logger.info('既存クライアントを切断しました');
            }

            await this.createClient();
            this.logger.info('新しいクライアントを作成しました');

        } catch (error) {
            this.logger.error('クライアント再作成エラー', error);
            throw error;
        }
    }

    async executeCommand(command, ...args) {
        if (!this.isHealthy) {
            throw new Error('Redis is not healthy');
        }

        const startTime = Date.now();
        this.metrics.totalCommands++;

        try {
            const result = await this.client[command](...args);
            const duration = Date.now() - startTime;
            
            // 平均応答時間更新
            this.metrics.avgResponseTime = 
                (this.metrics.avgResponseTime + duration) / 2;
            
            this.logger.debug(`Redisコマンド実行完了: ${command}`, {
                duration,
                command,
                argsLength: args.length
            });

            return result;

        } catch (error) {
            this.metrics.failedCommands++;
            this.logger.error(`Redisコマンド実行エラー: ${command}`, {
                error: error.message,
                command,
                args
            });
            throw error;
        }
    }

    // 高度な診断機能
    async runDiagnostics() {
        const diagnostics = {
            timestamp: new Date(),
            connectionInfo: null,
            performanceTest: null,
            memoryAnalysis: null,
            configInfo: null
        };

        try {
            // 接続情報
            diagnostics.connectionInfo = await this.checkHealth();

            // パフォーマンステスト
            const perfStart = Date.now();
            await this.client.set('__test_key__', 'test_value');
            await this.client.get('__test_key__');
            await this.client.del('__test_key__');
            diagnostics.performanceTest = {
                setGetDeleteDuration: Date.now() - perfStart,
                success: true
            };

            // メモリ分析
            const memInfo = await this.client.info('memory');
            diagnostics.memoryAnalysis = this.parseRedisInfo(memInfo);

            // 設定情報
            const configInfo = await this.client.config('get', '*');
            diagnostics.configInfo = this.arrayToObject(configInfo);

        } catch (error) {
            this.logger.error('Redis診断実行エラー', error);
            diagnostics.error = error.message;
        }

        return diagnostics;
    }

    arrayToObject(array) {
        const obj = {};
        for (let i = 0; i < array.length; i += 2) {
            obj[array[i]] = array[i + 1];
        }
        return obj;
    }

    // キャッシュ機能のヘルパーメソッド
    async cacheGet(key) {
        return await this.executeCommand('get', key);
    }

    async cacheSet(key, value, ttl = null) {
        if (ttl) {
            return await this.executeCommand('setex', key, ttl, value);
        } else {
            return await this.executeCommand('set', key, value);
        }
    }

    async cacheDel(key) {
        return await this.executeCommand('del', key);
    }

    async cacheExists(key) {
        return await this.executeCommand('exists', key);
    }

    async flushCache() {
        return await this.executeCommand('flushdb');
    }

    getStatus() {
        return {
            healthy: this.isHealthy,
            lastError: this.lastError?.message || null,
            connectionAttempts: this.connectionAttempts,
            lastHealthCheck: this.lastHealthCheck,
            metrics: this.metrics,
            connection: this.client ? {
                status: this.client.status,
                host: this.config.host,
                port: this.config.port,
                db: this.config.db
            } : null
        };
    }

    async shutdown() {
        this.logger.info('Redis監視停止開始');
        
        if (this.client) {
            this.client.disconnect();
            this.logger.info('Redisクライアント切断完了');
        }
        
        this.logger.info('Redis監視停止完了');
    }
}

module.exports = RedisMonitor;