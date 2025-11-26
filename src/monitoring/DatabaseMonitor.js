/**
 * PostgreSQLデータベース監視モジュール
 * PersonalCookingRecipe統合開発環境
 */

const { Pool } = require('pg');
const winston = require('winston');

class DatabaseMonitor {
    constructor(config = {}) {
        this.config = {
            connectionString: config.connectionString || process.env.DATABASE_URL,
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000,
            healthCheckTimeout: config.healthCheckTimeout || 5000,
            poolConfig: {
                max: config.poolConfig?.max || 20,
                min: config.poolConfig?.min || 5,
                idleTimeoutMillis: config.poolConfig?.idleTimeoutMillis || 30000,
                connectionTimeoutMillis: config.poolConfig?.connectionTimeoutMillis || 5000,
                ...config.poolConfig
            }
        };

        this.pool = null;
        this.isHealthy = false;
        this.lastError = null;
        this.connectionAttempts = 0;
        this.lastHealthCheck = null;

        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'database-monitor' },
            transports: [
                new winston.transports.File({ 
                    filename: 'logs/database-monitor.log' 
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
            await this.createPool();
            await this.testConnection();
            this.isHealthy = true;
            this.logger.info('データベース監視初期化完了');
        } catch (error) {
            this.logger.error('データベース監視初期化失敗', error);
            this.isHealthy = false;
            this.lastError = error;
        }
    }

    async createPool() {
        if (this.pool) {
            await this.pool.end();
        }

        this.pool = new Pool({
            connectionString: this.config.connectionString,
            ...this.config.poolConfig
        });

        // プールイベントリスナー設定
        this.pool.on('error', (error) => {
            this.logger.error('データベースプールエラー', error);
            this.isHealthy = false;
            this.lastError = error;
        });

        this.pool.on('connect', (client) => {
            this.logger.debug('新しいデータベース接続が確立されました');
        });

        this.pool.on('acquire', (client) => {
            this.logger.debug('データベース接続をプールから取得しました');
        });

        this.pool.on('remove', (client) => {
            this.logger.debug('データベース接続がプールから削除されました');
        });
    }

    async testConnection() {
        const client = await this.pool.connect();
        
        try {
            const startTime = Date.now();
            const result = await client.query('SELECT NOW() as current_time, version() as version');
            const duration = Date.now() - startTime;
            
            this.lastHealthCheck = new Date();
            this.connectionAttempts = 0;
            
            this.logger.info(`データベース接続テスト成功 (${duration}ms)`, {
                currentTime: result.rows[0].current_time,
                version: result.rows[0].version.split(' ')[0] // PostgreSQL version only
            });

            return {
                healthy: true,
                duration,
                details: {
                    currentTime: result.rows[0].current_time,
                    version: result.rows[0].version.split(' ')[0]
                }
            };

        } finally {
            client.release();
        }
    }

    async checkHealth() {
        try {
            const result = await Promise.race([
                this.testConnection(),
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
            
            this.logger.error('データベースヘルスチェック失敗', {
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

    async repairConnection() {
        this.logger.info('データベース接続修復開始');
        
        try {
            // 段階的修復アプローチ
            
            // ステップ1: 簡単な接続テスト
            try {
                await this.testConnection();
                this.logger.info('接続テストで修復完了');
                return { success: true, method: 'connection_test' };
            } catch (error) {
                this.logger.warn('接続テスト失敗、プール再作成を試行');
            }

            // ステップ2: プール再作成
            try {
                await this.recreatePool();
                await this.testConnection();
                this.logger.info('プール再作成で修復完了');
                return { success: true, method: 'pool_recreation' };
            } catch (error) {
                this.logger.error('プール再作成失敗', error);
                throw error;
            }

        } catch (error) {
            this.logger.error('データベース接続修復失敗', error);
            return { success: false, error: error.message };
        }
    }

    async recreatePool() {
        this.logger.info('データベースプール再作成開始');
        
        try {
            if (this.pool) {
                await this.pool.end();
                this.logger.info('既存プールを終了しました');
            }

            await this.createPool();
            this.logger.info('新しいプールを作成しました');

        } catch (error) {
            this.logger.error('プール再作成エラー', error);
            throw error;
        }
    }

    async getPoolStats() {
        if (!this.pool) {
            return null;
        }

        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount,
            maxPoolSize: this.config.poolConfig.max,
            minPoolSize: this.config.poolConfig.min
        };
    }

    async executeQuery(text, params = []) {
        if (!this.isHealthy) {
            throw new Error('Database is not healthy');
        }

        const client = await this.pool.connect();
        
        try {
            const startTime = Date.now();
            const result = await client.query(text, params);
            const duration = Date.now() - startTime;
            
            this.logger.debug('クエリ実行完了', {
                duration,
                rowCount: result.rowCount
            });

            return result;

        } catch (error) {
            this.logger.error('クエリ実行エラー', {
                error: error.message,
                query: text
            });
            throw error;
            
        } finally {
            client.release();
        }
    }

    // 高度な診断機能
    async runDiagnostics() {
        const diagnostics = {
            timestamp: new Date(),
            poolStats: await this.getPoolStats(),
            connectionTest: null,
            performanceTest: null,
            systemInfo: null
        };

        try {
            // 基本接続テスト
            diagnostics.connectionTest = await this.testConnection();

            // パフォーマンステスト
            const perfStart = Date.now();
            await this.executeQuery('SELECT COUNT(*) FROM pg_stat_activity');
            diagnostics.performanceTest = {
                duration: Date.now() - perfStart,
                success: true
            };

            // システム情報収集
            const systemInfoQuery = `
                SELECT 
                    version() as version,
                    current_database() as database,
                    current_user as user,
                    inet_server_addr() as server_ip,
                    inet_server_port() as server_port
            `;
            
            const systemResult = await this.executeQuery(systemInfoQuery);
            diagnostics.systemInfo = systemResult.rows[0];

        } catch (error) {
            this.logger.error('診断実行エラー', error);
            diagnostics.error = error.message;
        }

        return diagnostics;
    }

    getStatus() {
        return {
            healthy: this.isHealthy,
            lastError: this.lastError?.message || null,
            connectionAttempts: this.connectionAttempts,
            lastHealthCheck: this.lastHealthCheck,
            poolStats: this.pool ? {
                totalCount: this.pool.totalCount,
                idleCount: this.pool.idleCount,
                waitingCount: this.pool.waitingCount
            } : null
        };
    }

    async shutdown() {
        this.logger.info('データベース監視停止開始');
        
        if (this.pool) {
            await this.pool.end();
            this.logger.info('データベースプール終了完了');
        }
        
        this.logger.info('データベース監視停止完了');
    }
}

module.exports = DatabaseMonitor;