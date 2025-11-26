/**
 * 統合メトリクスコレクター（SQLite対応版）
 * PersonalCookingRecipe - sudo権限不要の監視システム
 *
 * 機能:
 * - PostgreSQL / SQLite自動切り替え
 * - 全監視モジュールの統合管理
 * - 定期的なメトリクス収集
 * - アラート管理統合
 *
 * 環境変数:
 * - MONITORING_DB=sqlite または postgresql (デフォルト: sqlite)
 * - SQLITE_DB_PATH=/path/to/monitoring.db
 */

const { EventEmitter } = require('events');
const winston = require('winston');
const cron = require('node-cron');
const { Pool } = require('pg');
const Redis = require('ioredis');

const NativeMonitoring = require('./NativeMonitoring');
const ApplicationMetrics = require('./ApplicationMetrics');
const BusinessMetrics = require('./BusinessMetrics');
const NativeAlertManager = require('./NativeAlertManager');
const SQLiteMonitoringAdapter = require('./SQLiteMonitoringAdapter');

class MetricsCollectorWithSQLite extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            // データベースタイプ選択
            databaseType: config.databaseType || process.env.MONITORING_DB || 'sqlite',

            // 収集間隔
            systemMetricsInterval: config.systemMetricsInterval || 10000,
            applicationMetricsInterval: config.applicationMetricsInterval || 5000,
            businessMetricsInterval: config.businessMetricsInterval || 60000,

            // PostgreSQL設定
            postgres: {
                host: config.postgres?.host || process.env.DB_HOST || 'localhost',
                port: config.postgres?.port || process.env.DB_PORT || 5432,
                database: config.postgres?.database || process.env.DB_NAME || 'recipe_db',
                user: config.postgres?.user || process.env.DB_USER || 'recipe_user',
                password: config.postgres?.password || process.env.DB_PASSWORD,
                max: 10,
                idleTimeoutMillis: 30000
            },

            // SQLite設定
            sqlite: {
                dbPath: config.sqlite?.dbPath || process.env.SQLITE_DB_PATH ||
                        require('path').join(__dirname, '../../data/monitoring.db'),
                enableWAL: config.sqlite?.enableWAL !== false
            },

            // Redis設定
            redis: {
                host: config.redis?.host || process.env.REDIS_HOST || 'localhost',
                port: config.redis?.port || process.env.REDIS_PORT || 6379,
                password: config.redis?.password || process.env.REDIS_PASSWORD,
                db: config.redis?.db || 1,
                keyPrefix: 'metrics:'
            },

            // データ保存設定
            enableRedis: config.enableRedis !== false,
            metricsRetentionDays: config.metricsRetentionDays || 30,

            // アラート設定
            enableAlerts: config.enableAlerts !== false,
            alertConfig: config.alertConfig || {},

            ...config
        };

        // ロガー初期化
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'metrics-collector-sqlite' },
            transports: [
                new winston.transports.File({
                    filename: 'logs/metrics-collector.log',
                    maxsize: 20 * 1024 * 1024,
                    maxFiles: 10
                }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });

        // 監視モジュール
        this.nativeMonitoring = null;
        this.applicationMetrics = null;
        this.businessMetrics = null;
        this.alertManager = null;

        // データベース接続
        this.dbAdapter = null; // SQLite or PostgreSQL
        this.pgPool = null;
        this.redis = null;

        // Cronジョブ
        this.cronJobs = [];

        // 統計
        this.stats = {
            startTime: Date.now(),
            collectionCount: 0,
            savedToDatabase: 0,
            savedToRedis: 0,
            alertsTriggered: 0,
            errors: 0
        };

        this.logger.info('メトリクスコレクター初期化完了', {
            databaseType: this.config.databaseType
        });
    }

    /**
     * 初期化
     */
    async initialize() {
        try {
            this.logger.info('メトリクスコレクター起動開始', {
                databaseType: this.config.databaseType
            });

            // データベース接続
            await this.initializeDatabase();

            // Redis接続
            if (this.config.enableRedis) {
                await this.initializeRedis();
            }

            // 監視モジュール初期化
            this.nativeMonitoring = new NativeMonitoring({
                updateInterval: this.config.systemMetricsInterval
            });

            this.applicationMetrics = new ApplicationMetrics();
            this.businessMetrics = new BusinessMetrics();

            // アラート管理初期化
            if (this.config.enableAlerts) {
                this.alertManager = new NativeAlertManager(this.config.alertConfig);
            }

            // イベントリスナー登録
            this.registerEventListeners();

            // システム監視開始
            this.nativeMonitoring.start();

            // 定期収集スケジュール開始
            this.startScheduledCollection();

            // クリーンアップジョブ開始
            this.startCleanupJobs();

            this.logger.info('メトリクスコレクター起動完了');
            this.emit('initialized');

        } catch (error) {
            this.logger.error('メトリクスコレクター初期化エラー', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * データベース初期化
     */
    async initializeDatabase() {
        const dbType = this.config.databaseType.toLowerCase();

        if (dbType === 'sqlite') {
            await this.initializeSQLite();
        } else if (dbType === 'postgresql' || dbType === 'postgres') {
            await this.initializePostgreSQL();
        } else {
            throw new Error(`Unsupported database type: ${dbType}`);
        }
    }

    /**
     * SQLite初期化
     */
    async initializeSQLite() {
        try {
            this.logger.info('SQLite初期化開始', {
                dbPath: this.config.sqlite.dbPath
            });

            this.dbAdapter = new SQLiteMonitoringAdapter(this.config.sqlite);
            await this.dbAdapter.initialize();

            this.logger.info('SQLite初期化完了');

        } catch (error) {
            this.logger.error('SQLite初期化エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * PostgreSQL初期化
     */
    async initializePostgreSQL() {
        try {
            this.logger.info('PostgreSQL初期化開始');

            this.pgPool = new Pool(this.config.postgres);

            // 接続テスト
            const client = await this.pgPool.connect();
            await client.query('SELECT NOW()');
            client.release();

            this.logger.info('PostgreSQL接続成功');

        } catch (error) {
            this.logger.error('PostgreSQL接続エラー', { error: error.message });
            this.logger.warn('PostgreSQL接続失敗 - SQLiteにフォールバック');

            // SQLiteにフォールバック
            this.config.databaseType = 'sqlite';
            await this.initializeSQLite();
        }
    }

    /**
     * Redis初期化
     */
    async initializeRedis() {
        try {
            this.redis = new Redis(this.config.redis);
            await this.redis.ping();
            this.logger.info('Redis接続成功');

        } catch (error) {
            this.logger.error('Redis接続エラー', { error: error.message });
            this.logger.warn('Redis無しで継続');
            this.redis = null;
        }
    }

    /**
     * イベントリスナー登録
     */
    registerEventListeners() {
        // システムメトリクス
        if (this.nativeMonitoring) {
            this.nativeMonitoring.on('metrics', (metrics) => {
                this.handleSystemMetrics(metrics);
            });

            this.nativeMonitoring.on('alert', (alert) => {
                if (this.alertManager) {
                    this.alertManager.recordAlert(alert);
                }
            });
        }

        // ビジネスメトリクス
        if (this.businessMetrics) {
            this.businessMetrics.on('daily_summary', (summary) => {
                this.saveDailySummary(summary).catch(err => {
                    this.logger.error('日次サマリー保存エラー', { error: err.message });
                });
            });
        }
    }

    /**
     * システムメトリクス処理
     */
    async handleSystemMetrics(metrics) {
        try {
            this.stats.collectionCount++;

            // データベース保存
            await this.saveToDatabase('system', metrics);
            this.stats.savedToDatabase++;

            // Redis保存
            if (this.redis) {
                await this.saveToRedis('system:current', metrics);
                this.stats.savedToRedis++;
            }

            // アラートチェック
            if (this.alertManager) {
                await this.alertManager.checkMetrics(metrics);
            }

            this.emit('system_metrics', metrics);

        } catch (error) {
            this.logger.error('システムメトリクス処理エラー', { error: error.message });
            this.stats.errors++;
        }
    }

    /**
     * 定期収集スケジュール開始
     */
    startScheduledCollection() {
        // 1分毎: 統合メトリクス収集
        const job1 = cron.schedule('* * * * *', async () => {
            try {
                await this.collectIntegratedMetrics();
            } catch (error) {
                this.logger.error('統合メトリクス収集エラー', { error: error.message });
            }
        });
        this.cronJobs.push(job1);

        // 5分毎: 集約メトリクス保存
        const job2 = cron.schedule('*/5 * * * *', async () => {
            try {
                await this.saveAggregatedMetrics();
            } catch (error) {
                this.logger.error('集約メトリクス保存エラー', { error: error.message });
            }
        });
        this.cronJobs.push(job2);

        // 1時間毎: メトリクス集約
        const job3 = cron.schedule('0 * * * *', async () => {
            try {
                await this.aggregateHourlyMetrics();
            } catch (error) {
                this.logger.error('時間別集約エラー', { error: error.message });
            }
        });
        this.cronJobs.push(job3);

        this.logger.info('定期収集スケジュール開始');
    }

    /**
     * クリーンアップジョブ開始
     */
    startCleanupJobs() {
        // 毎日午前3時: 古いメトリクス削除
        const cleanupJob = cron.schedule('0 3 * * *', async () => {
            try {
                await this.cleanupOldMetrics();
            } catch (error) {
                this.logger.error('クリーンアップエラー', { error: error.message });
            }
        });
        this.cronJobs.push(cleanupJob);

        // 週1回日曜午前4時: データベース最適化
        const optimizeJob = cron.schedule('0 4 * * 0', async () => {
            try {
                await this.optimizeDatabase();
            } catch (error) {
                this.logger.error('データベース最適化エラー', { error: error.message });
            }
        });
        this.cronJobs.push(optimizeJob);

        this.logger.info('クリーンアップジョブ開始');
    }

    /**
     * 統合メトリクス収集
     */
    async collectIntegratedMetrics() {
        const metrics = {
            timestamp: Date.now(),
            system: this.nativeMonitoring?.getCurrentMetrics(),
            application: this.applicationMetrics?.getCurrentMetrics(),
            business: this.businessMetrics?.getCurrentMetrics()
        };

        // Redis保存
        if (this.redis) {
            await this.saveToRedis('integrated:current', metrics, 300);
        }

        this.emit('integrated_metrics', metrics);
        return metrics;
    }

    /**
     * 集約メトリクス保存
     */
    async saveAggregatedMetrics() {
        const metrics = await this.collectIntegratedMetrics();

        // システムメトリクス保存
        if (metrics.system) {
            await this.saveMetric('cpu_usage', metrics.system.cpu?.usage);
            await this.saveMetric('memory_usage', metrics.system.memory?.usage_percent);
            await this.saveMetric('disk_usage', metrics.system.disk?.usage_percent);
        }

        // アプリケーションメトリクス保存
        if (metrics.application) {
            await this.saveMetric('http_requests_total', metrics.application.http?.totalRequests);
            await this.saveMetric('http_error_rate', metrics.application.http?.errorRate);
        }

        // ビジネスメトリクス保存
        if (metrics.business) {
            await this.saveMetric('user_registrations_daily', metrics.business.users?.dailyRegistrations);
            await this.saveMetric('recipes_created_daily', metrics.business.recipes?.dailyCreations);
        }
    }

    /**
     * メトリクス保存
     */
    async saveMetric(metricName, metricValue, labels = {}) {
        if (metricValue === undefined || metricValue === null) return;

        try {
            if (this.dbAdapter) {
                // SQLite
                await this.dbAdapter.saveMetric(metricName, metricValue, labels);
            } else if (this.pgPool) {
                // PostgreSQL
                await this.pgPool.query(
                    `INSERT INTO system_metrics (metric_name, metric_value, labels, timestamp)
                     VALUES ($1, $2, $3, NOW())`,
                    [metricName, metricValue, JSON.stringify(labels)]
                );
            }
        } catch (error) {
            this.logger.error('メトリクス保存エラー', {
                metricName,
                error: error.message
            });
        }
    }

    /**
     * データベースに保存
     */
    async saveToDatabase(type, data) {
        try {
            if (this.dbAdapter) {
                await this.dbAdapter.saveRawMetrics(type, data);
            } else if (this.pgPool) {
                await this.pgPool.query(
                    `INSERT INTO metrics_raw (metric_type, data, timestamp)
                     VALUES ($1, $2, NOW())`,
                    [type, JSON.stringify(data)]
                );
            }
        } catch (error) {
            this.logger.debug('データベース保存スキップ', { type, error: error.message });
        }
    }

    /**
     * Redisに保存
     */
    async saveToRedis(key, data, ttl = null) {
        if (!this.redis) return;

        try {
            const fullKey = `${this.config.redis.keyPrefix}${key}`;
            const value = JSON.stringify(data);

            if (ttl) {
                await this.redis.setex(fullKey, ttl, value);
            } else {
                await this.redis.set(fullKey, value);
            }
        } catch (error) {
            this.logger.error('Redis保存エラー', { key, error: error.message });
        }
    }

    /**
     * 時間別メトリクス集約
     */
    async aggregateHourlyMetrics() {
        try {
            if (this.dbAdapter) {
                await this.dbAdapter.aggregateHourlyMetrics();
            } else if (this.pgPool) {
                // PostgreSQL用の集約クエリ
                await this.pgPool.query(`
                    INSERT INTO metrics_hourly (hour, metric_name, avg_value, min_value, max_value, count)
                    SELECT
                        date_trunc('hour', timestamp) as hour,
                        metric_name,
                        AVG(metric_value) as avg_value,
                        MIN(metric_value) as min_value,
                        MAX(metric_value) as max_value,
                        COUNT(*) as count
                    FROM system_metrics
                    WHERE timestamp >= NOW() - INTERVAL '1 hour'
                      AND timestamp < date_trunc('hour', NOW())
                    GROUP BY date_trunc('hour', timestamp), metric_name
                    ON CONFLICT (hour, metric_name) DO UPDATE
                    SET avg_value = EXCLUDED.avg_value,
                        min_value = EXCLUDED.min_value,
                        max_value = EXCLUDED.max_value,
                        count = EXCLUDED.count
                `);
            }

            this.logger.info('時間別メトリクス集約完了');

        } catch (error) {
            this.logger.debug('時間別集約スキップ', { error: error.message });
        }
    }

    /**
     * 古いメトリクス削除
     */
    async cleanupOldMetrics() {
        try {
            if (this.dbAdapter) {
                const result = await this.dbAdapter.cleanupOldMetrics(this.config.metricsRetentionDays);
                this.logger.info('古いメトリクス削除完了', result);
            } else if (this.pgPool) {
                const result = await this.pgPool.query(
                    `DELETE FROM system_metrics WHERE timestamp < NOW() - INTERVAL '${this.config.metricsRetentionDays} days'`
                );
                this.logger.info('古いメトリクス削除完了', { deletedRows: result.rowCount });
            }
        } catch (error) {
            this.logger.debug('メトリクス削除スキップ', { error: error.message });
        }
    }

    /**
     * データベース最適化
     */
    async optimizeDatabase() {
        try {
            if (this.dbAdapter) {
                await this.dbAdapter.optimize();
                this.logger.info('SQLiteデータベース最適化完了');
            } else if (this.pgPool) {
                await this.pgPool.query('VACUUM ANALYZE');
                this.logger.info('PostgreSQLデータベース最適化完了');
            }
        } catch (error) {
            this.logger.error('データベース最適化エラー', { error: error.message });
        }
    }

    /**
     * 日次サマリー保存
     */
    async saveDailySummary(summary) {
        try {
            const date = summary.date || new Date().toISOString().split('T')[0];

            if (this.dbAdapter) {
                await this.dbAdapter.saveDailySummary(date, summary);
            } else if (this.pgPool) {
                await this.pgPool.query(
                    `INSERT INTO daily_summaries (date, summary_data)
                     VALUES ($1, $2)
                     ON CONFLICT (date) DO UPDATE
                     SET summary_data = EXCLUDED.summary_data`,
                    [date, JSON.stringify(summary)]
                );
            }

            this.logger.info('日次サマリー保存完了', { date });

        } catch (error) {
            this.logger.debug('日次サマリー保存スキップ', { error: error.message });
        }
    }

    /**
     * ExpressミドルウェアFactory
     */
    createExpressMiddleware() {
        if (!this.applicationMetrics) {
            throw new Error('ApplicationMetrics not initialized');
        }
        return this.applicationMetrics.createHTTPMiddleware();
    }

    /**
     * 統計情報取得
     */
    getStats() {
        return {
            databaseType: this.config.databaseType,
            uptime: Date.now() - this.stats.startTime,
            collectionCount: this.stats.collectionCount,
            savedToDatabase: this.stats.savedToDatabase,
            savedToRedis: this.stats.savedToRedis,
            alertsTriggered: this.stats.alertsTriggered,
            errors: this.stats.errors,
            modules: {
                nativeMonitoring: this.nativeMonitoring?.getStats(),
                applicationMetrics: this.applicationMetrics?.getStats(),
                businessMetrics: this.businessMetrics?.getStats()
            }
        };
    }

    /**
     * データベース統計取得
     */
    async getDatabaseStats() {
        if (this.dbAdapter) {
            return await this.dbAdapter.getDatabaseStats();
        } else if (this.pgPool) {
            const result = await this.pgPool.query(`
                SELECT
                    (SELECT COUNT(*) FROM system_metrics) as system_metrics,
                    (SELECT COUNT(*) FROM metrics_raw) as metrics_raw,
                    (SELECT COUNT(*) FROM alert_history) as alert_history,
                    pg_database_size(current_database()) as database_size_bytes
            `);
            return result.rows[0];
        }
        return {};
    }

    /**
     * シャットダウン
     */
    async shutdown() {
        this.logger.info('メトリクスコレクターシャットダウン開始');

        // Cronジョブ停止
        this.cronJobs.forEach(job => job.stop());

        // 監視停止
        if (this.nativeMonitoring) {
            this.nativeMonitoring.stop();
        }

        // データベース接続クローズ
        if (this.dbAdapter) {
            await this.dbAdapter.close();
        }

        if (this.pgPool) {
            await this.pgPool.end();
        }

        if (this.redis) {
            await this.redis.quit();
        }

        this.logger.info('メトリクスコレクターシャットダウン完了');
    }

    /**
     * 公開API
     */
    getNativeMonitoring() {
        return this.nativeMonitoring;
    }

    getApplicationMetrics() {
        return this.applicationMetrics;
    }

    getBusinessMetrics() {
        return this.businessMetrics;
    }

    getAlertManager() {
        return this.alertManager;
    }
}

module.exports = MetricsCollectorWithSQLite;
