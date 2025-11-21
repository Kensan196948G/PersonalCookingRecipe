/**
 * 統合監視システム
 * PersonalCookingRecipe - 既存監視 + Prometheus統合
 *
 * 機能:
 * - 既存監視モジュールの統合管理
 * - Prometheusメトリクス自動収集
 * - Express統合ミドルウェア
 */

const { getInstance: getPrometheusMetrics } = require('./prometheus-metrics');
const ApiHealthMonitor = require('./ApiHealthMonitor');
const DatabaseMonitor = require('./DatabaseMonitor');
const RedisMonitor = require('./RedisMonitor');
const MemoryMonitor = require('./MemoryMonitor');
const winston = require('winston');

class MonitoringIntegration {
    constructor(config = {}) {
        this.config = {
            enablePrometheus: config.enablePrometheus !== false,
            enableHealthMonitoring: config.enableHealthMonitoring !== false,
            metricsUpdateInterval: config.metricsUpdateInterval || 30000, // 30秒
            ...config
        };

        // ロガー初期化
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'monitoring-integration' },
            transports: [
                new winston.transports.File({ filename: 'logs/monitoring-integration.log' }),
                new winston.transports.Console({ format: winston.format.simple() })
            ]
        });

        // Prometheusメトリクス
        this.prometheus = null;

        // 既存監視モジュール
        this.apiHealthMonitor = null;
        this.databaseMonitor = null;
        this.redisMonitor = null;
        this.memoryMonitor = null;

        // 自動更新タイマー
        this.updateTimer = null;

        this.logger.info('統合監視システム初期化開始');
    }

    async initialize(app) {
        try {
            // Prometheusメトリクス初期化
            if (this.config.enablePrometheus) {
                this.prometheus = getPrometheusMetrics(this.config.prometheus);
                this.logger.info('Prometheusメトリクス初期化完了');

                // Expressミドルウェア設定
                if (app) {
                    app.use(this.prometheus.createMiddleware());
                    this.logger.info('Prometheusミドルウェア登録完了');
                }

                // メトリクスエンドポイント
                if (app) {
                    app.get('/metrics', async (req, res) => {
                        try {
                            res.set('Content-Type', this.prometheus.getMetricsContentType());
                            const metrics = await this.prometheus.getMetrics();
                            res.end(metrics);
                        } catch (error) {
                            this.logger.error('メトリクス取得エラー', { error: error.message });
                            res.status(500).end(error.message);
                        }
                    });
                    this.logger.info('メトリクスエンドポイント /metrics 登録完了');
                }
            }

            // 既存監視モジュール初期化
            if (this.config.enableHealthMonitoring) {
                // API ヘルスモニター
                this.apiHealthMonitor = new ApiHealthMonitor(this.config.apiHealth);
                this.logger.info('APIヘルスモニター初期化完了');

                // データベースモニター
                this.databaseMonitor = new DatabaseMonitor(this.config.database);
                this.logger.info('データベースモニター初期化完了');

                // Redisモニター
                this.redisMonitor = new RedisMonitor(this.config.redis);
                this.logger.info('Redisモニター初期化完了');

                // メモリモニター
                this.memoryMonitor = new MemoryMonitor(this.config.memory);
                this.logger.info('メモリモニター初期化完了');
            }

            // 自動メトリクス更新開始
            this.startAutoUpdate();

            this.logger.info('統合監視システム初期化完了');
            return true;
        } catch (error) {
            this.logger.error('統合監視システム初期化エラー', { error: error.message });
            throw error;
        }
    }

    // 自動メトリクス更新
    startAutoUpdate() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }

        this.updateTimer = setInterval(async () => {
            await this.updateAllMetrics();
        }, this.config.metricsUpdateInterval);

        this.logger.info(`自動メトリクス更新開始（間隔: ${this.config.metricsUpdateInterval}ms）`);
    }

    // 全メトリクス更新
    async updateAllMetrics() {
        try {
            if (!this.prometheus) return;

            // システムメトリクス更新（既にprometheus-metrics.jsで実装済み）
            // this.prometheus.updateSystemMetrics(); は getMetrics() 内で呼ばれる

            // データベースプールメトリクス更新
            if (this.databaseMonitor && this.databaseMonitor.pool) {
                const pool = this.databaseMonitor.pool;
                this.prometheus.updateDatabasePoolMetrics(
                    pool.idleCount || 0,
                    pool.totalCount - pool.idleCount || 0,
                    pool.waitingCount || 0
                );
            }

            // ビジネスメトリクス更新（デイリーカウント）
            await this.updateDailyBusinessMetrics();

        } catch (error) {
            this.logger.error('メトリクス更新エラー', { error: error.message });
        }
    }

    // デイリービジネスメトリクス更新
    async updateDailyBusinessMetrics() {
        try {
            // 注: 実際のデータベースクエリで実装
            // ここではプレースホルダー
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // ユーザー登録数（本日）
            // const userRegistrations = await getUserRegistrationsCountToday();
            // this.prometheus.updateDailyUserRegistrations(userRegistrations);

            // レシピ作成数（本日）
            // const recipesCreated = await getRecipesCreatedCountToday();
            // this.prometheus.updateDailyRecipeCreations(recipesCreated);

        } catch (error) {
            this.logger.error('デイリービジネスメトリクス更新エラー', { error: error.message });
        }
    }

    // データベースクエリ記録ヘルパー
    recordDatabaseQuery(queryType, table, startTime, success = true) {
        if (!this.prometheus) return;

        const duration = Date.now() - startTime;
        const status = success ? 'success' : 'error';

        this.prometheus.recordDatabaseQuery(queryType, table, duration, status);
    }

    // Redis操作記録ヘルパー
    recordRedisOperation(operation, startTime, success = true) {
        if (!this.prometheus) return;

        const duration = Date.now() - startTime;
        const status = success ? 'success' : 'error';

        this.prometheus.recordRedisOperation(operation, duration, status);
    }

    // ビジネスイベント記録ヘルパー
    recordUserRegistration(registrationType = 'email') {
        if (!this.prometheus) return;
        this.prometheus.recordUserRegistration(registrationType);
    }

    recordRecipeCreation(category = 'general') {
        if (!this.prometheus) return;
        this.prometheus.recordRecipeCreation(category);
    }

    recordSearch(searchType = 'keyword', resultCount = 0) {
        if (!this.prometheus) return;
        this.prometheus.recordSearch(searchType, resultCount);
    }

    recordCacheHit(cacheType = 'redis') {
        if (!this.prometheus) return;
        this.prometheus.recordCacheHit(cacheType);
    }

    recordCacheMiss(cacheType = 'redis') {
        if (!this.prometheus) return;
        this.prometheus.recordCacheMiss(cacheType);
    }

    // ヘルスチェックエンドポイント用統合ステータス
    async getHealthStatus() {
        const status = {
            timestamp: new Date(),
            overall: 'healthy',
            components: {}
        };

        try {
            // APIヘルス
            if (this.apiHealthMonitor) {
                const apiStatus = this.apiHealthMonitor.getStatus();
                status.components.api = {
                    healthy: apiStatus.healthy,
                    uptime: apiStatus.uptime,
                    lastCheck: apiStatus.lastHealthCheck
                };
                if (!apiStatus.healthy) status.overall = 'unhealthy';
            }

            // データベース
            if (this.databaseMonitor) {
                status.components.database = {
                    healthy: this.databaseMonitor.isHealthy,
                    lastCheck: this.databaseMonitor.lastHealthCheck
                };
                if (!this.databaseMonitor.isHealthy) status.overall = 'unhealthy';
            }

            // Redis
            if (this.redisMonitor) {
                status.components.redis = {
                    healthy: this.redisMonitor.isHealthy,
                    lastCheck: this.redisMonitor.lastHealthCheck
                };
                if (!this.redisMonitor.isHealthy) status.overall = 'degraded';
            }

            // メモリ
            if (this.memoryMonitor) {
                const memoryStatus = this.memoryMonitor.getStatus();
                status.components.memory = {
                    healthy: memoryStatus.healthy,
                    usage: memoryStatus.usage,
                    warnings: memoryStatus.warnings
                };
                if (!memoryStatus.healthy) status.overall = 'degraded';
            }

        } catch (error) {
            this.logger.error('ヘルスステータス取得エラー', { error: error.message });
            status.overall = 'error';
            status.error = error.message;
        }

        return status;
    }

    // 詳細診断
    async runDiagnostics() {
        const diagnostics = {
            timestamp: new Date(),
            prometheus: this.prometheus ? 'enabled' : 'disabled',
            monitoring: {}
        };

        try {
            // APIヘルス診断
            if (this.apiHealthMonitor) {
                diagnostics.monitoring.api = await this.apiHealthMonitor.runDetailedDiagnostics();
            }

            // その他の監視モジュール診断...

        } catch (error) {
            this.logger.error('診断実行エラー', { error: error.message });
            diagnostics.error = error.message;
        }

        return diagnostics;
    }

    // シャットダウン
    async shutdown() {
        this.logger.info('統合監視システムシャットダウン開始');

        try {
            // 自動更新停止
            if (this.updateTimer) {
                clearInterval(this.updateTimer);
                this.updateTimer = null;
            }

            // 各モニターのシャットダウン
            if (this.apiHealthMonitor) {
                await this.apiHealthMonitor.shutdown();
            }

            if (this.databaseMonitor && this.databaseMonitor.pool) {
                await this.databaseMonitor.pool.end();
            }

            if (this.redisMonitor && this.redisMonitor.client) {
                this.redisMonitor.client.disconnect();
            }

            this.logger.info('統合監視システムシャットダウン完了');
        } catch (error) {
            this.logger.error('統合監視システムシャットダウンエラー', { error: error.message });
            throw error;
        }
    }

    // Prometheusインスタンス取得
    getPrometheus() {
        return this.prometheus;
    }

    // 各モニター取得
    getApiHealthMonitor() {
        return this.apiHealthMonitor;
    }

    getDatabaseMonitor() {
        return this.databaseMonitor;
    }

    getRedisMonitor() {
        return this.redisMonitor;
    }

    getMemoryMonitor() {
        return this.memoryMonitor;
    }
}

// シングルトンインスタンス
let instance = null;

module.exports = {
    MonitoringIntegration,
    getInstance: (config) => {
        if (!instance) {
            instance = new MonitoringIntegration(config);
        }
        return instance;
    },
    resetInstance: () => {
        if (instance) {
            instance.shutdown();
            instance = null;
        }
    }
};
