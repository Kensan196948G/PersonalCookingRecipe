/**
 * 統合メトリクスコレクター
 * PersonalCookingRecipe - Docker非依存監視システム
 *
 * 機能:
 * - 全監視モジュールの統合管理
 * - 定期的なメトリクス収集スケジューリング
 * - PostgreSQLへのメトリクス保存
 * - Redisへのリアルタイムメトリクス保存
 * - アラート管理統合
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

class MetricsCollector extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            // 収集間隔
            systemMetricsInterval: config.systemMetricsInterval || 10000, // 10秒
            applicationMetricsInterval: config.applicationMetricsInterval || 5000, // 5秒
            businessMetricsInterval: config.businessMetricsInterval || 60000, // 1分

            // PostgreSQL設定
            postgres: {
                host: config.postgres?.host || process.env.DB_HOST || 'localhost',
                port: config.postgres?.port || process.env.DB_PORT || 5432,
                database: config.postgres?.database || process.env.DB_NAME || 'personalcookingrecipe',
                user: config.postgres?.user || process.env.DB_USER || 'postgres',
                password: config.postgres?.password || process.env.DB_PASSWORD,
                max: 10,
                idleTimeoutMillis: 30000
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
            enablePostgres: config.enablePostgres !== false,
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
            defaultMeta: { service: 'metrics-collector' },
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

        // 監視モジュール初期化
        this.nativeMonitoring = null;
        this.applicationMetrics = null;
        this.businessMetrics = null;
        this.alertManager = null;

        // データベース接続
        this.pgPool = null;
        this.redis = null;

        // Cronジョブ
        this.cronJobs = [];

        // 統計
        this.stats = {
            startTime: Date.now(),
            collectionCount: 0,
            savedToPostgres: 0,
            savedToRedis: 0,
            alertsTriggered: 0,
            errors: 0
        };

        this.logger.info('メトリクスコレクター初期化完了');
    }

    /**
     * 初期化
     */
    async initialize() {
        try {
            this.logger.info('メトリクスコレクター起動開始');

            // データベース接続
            if (this.config.enablePostgres) {
                await this.initializePostgres();
            }

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
            this.logger.error('メトリクスコレクター初期化エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * PostgreSQL初期化
     */
    async initializePostgres() {
        try {
            this.pgPool = new Pool(this.config.postgres);

            // 接続テスト
            const client = await this.pgPool.connect();
            await client.query('SELECT NOW()');
            client.release();

            this.logger.info('PostgreSQL接続成功');

        } catch (error) {
            this.logger.error('PostgreSQL接続エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * Redis初期化
     */
    async initializeRedis() {
        try {
            this.redis = new Redis(this.config.redis);

            // 接続テスト
            await this.redis.ping();

            this.logger.info('Redis接続成功');

        } catch (error) {
            this.logger.error('Redis接続エラー', { error: error.message });
            throw error;
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

        // アプリケーションメトリクス
        if (this.applicationMetrics) {
            this.applicationMetrics.on('alert', (alert) => {
                if (this.alertManager) {
                    this.alertManager.recordAlert(alert);
                }
            });
        }

        // ビジネスメトリクス
        if (this.businessMetrics) {
            this.businessMetrics.on('daily_summary', (summary) => {
                this.logger.info('日次サマリー', summary);
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

            // PostgreSQL保存
            if (this.config.enablePostgres) {
                await this.saveToPostgres('system', metrics);
                this.stats.savedToPostgres++;
            }

            // Redis保存
            if (this.config.enableRedis) {
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

        // 5分毎: PostgreSQL保存
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

        // Redis保存（リアルタイムアクセス用）
        if (this.redis) {
            await this.saveToRedis('integrated:current', metrics, 300); // 5分間保持
        }

        this.emit('integrated_metrics', metrics);
        return metrics;
    }

    /**
     * 集約メトリクス保存
     */
    async saveAggregatedMetrics() {
        const metrics = await this.collectIntegratedMetrics();

        if (this.pgPool) {
            // システムメトリクス保存
            if (metrics.system) {
                await this.saveMetricToPostgres('cpu_usage', metrics.system.cpu?.usage);
                await this.saveMetricToPostgres('memory_usage', metrics.system.memory?.usage_percent);
            }

            // アプリケーションメトリクス保存
            if (metrics.application) {
                await this.saveMetricToPostgres('http_requests_total', metrics.application.http?.totalRequests);
                await this.saveMetricToPostgres('http_error_rate', metrics.application.http?.errorRate);
                await this.saveMetricToPostgres('response_time_p95', metrics.application.http?.percentiles?.p95);
            }

            // ビジネスメトリクス保存
            if (metrics.business) {
                await this.saveMetricToPostgres('user_registrations_daily', metrics.business.users?.dailyRegistrations);
                await this.saveMetricToPostgres('recipes_created_daily', metrics.business.recipes?.dailyCreations);
                await this.saveMetricToPostgres('search_executions_daily', metrics.business.search?.dailyExecutions);
            }
        }
    }

    /**
     * PostgreSQLにメトリクス保存
     */
    async saveMetricToPostgres(metricName, metricValue, labels = {}) {
        if (!this.pgPool || metricValue === undefined || metricValue === null) return;

        try {
            // SQL インジェクション対策: ラベルのサニタイズ
            const sanitizedLabels = this.sanitizeLabels(labels);

            await this.pgPool.query(
                `INSERT INTO system_metrics (metric_name, metric_value, labels, timestamp)
                 VALUES ($1, $2, $3, NOW())`,
                [metricName, metricValue, JSON.stringify(sanitizedLabels)]
            );
        } catch (error) {
            this.logger.error('PostgreSQLメトリクス保存エラー', {
                metricName,
                error: error.message
            });
        }
    }

    /**
     * ラベルサニタイズ（プロトタイプ汚染防止）
     * @param {object} labels - 元のラベル
     * @returns {object} - サニタイズ済みラベル
     */
    sanitizeLabels(labels) {
        if (typeof labels !== 'object' || labels === null) {
            return {};
        }

        const sanitized = {};

        for (const [key, value] of Object.entries(labels)) {
            // プロトタイプチェーン汚染防止
            if (Object.prototype.hasOwnProperty.call(labels, key)) {
                // 危険なキー名をブロック
                if (['__proto__', 'constructor', 'prototype'].includes(key)) {
                    this.logger.warn('Dangerous label key blocked', { key });
                    continue;
                }

                // 値を文字列化して長さ制限（1000文字）
                const sanitizedValue = String(value).slice(0, 1000);
                sanitized[key] = sanitizedValue;
            }
        }

        return sanitized;
    }

    /**
     * PostgreSQLに汎用データ保存
     */
    async saveToPostgres(type, data) {
        if (!this.pgPool) return;

        try {
            await this.pgPool.query(
                `INSERT INTO metrics_raw (metric_type, data, timestamp)
                 VALUES ($1, $2, NOW())`,
                [type, JSON.stringify(data)]
            );
        } catch (error) {
            // テーブルが存在しない場合は警告のみ
            this.logger.debug('PostgreSQL保存スキップ', { type, error: error.message });
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
     * Redisから取得
     */
    async getFromRedis(key) {
        if (!this.redis) return null;

        try {
            const fullKey = `${this.config.redis.keyPrefix}${key}`;
            const value = await this.redis.get(fullKey);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            this.logger.error('Redis取得エラー', { key, error: error.message });
            return null;
        }
    }

    /**
     * 時間別メトリクス集約
     */
    async aggregateHourlyMetrics() {
        if (!this.pgPool) return;

        try {
            const query = `
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
            `;

            await this.pgPool.query(query);
            this.logger.info('時間別メトリクス集約完了');

        } catch (error) {
            this.logger.debug('時間別集約スキップ', { error: error.message });
        }
    }

    /**
     * 古いメトリクス削除
     */
    async cleanupOldMetrics() {
        if (!this.pgPool) return;

        try {
            const retentionDate = new Date();
            retentionDate.setDate(retentionDate.getDate() - this.config.metricsRetentionDays);

            const result = await this.pgPool.query(
                `DELETE FROM system_metrics WHERE timestamp < $1`,
                [retentionDate]
            );

            this.logger.info('古いメトリクス削除完了', {
                deletedRows: result.rowCount,
                retentionDays: this.config.metricsRetentionDays
            });

        } catch (error) {
            this.logger.debug('メトリクス削除スキップ', { error: error.message });
        }
    }

    /**
     * 日次サマリー保存
     */
    async saveDailySummary(summary) {
        if (!this.pgPool) return;

        try {
            await this.pgPool.query(
                `INSERT INTO daily_summaries (date, summary_data)
                 VALUES ($1, $2)
                 ON CONFLICT (date) DO UPDATE
                 SET summary_data = EXCLUDED.summary_data`,
                [summary.date, JSON.stringify(summary)]
            );

            this.logger.info('日次サマリー保存完了', { date: summary.date });

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
            uptime: Date.now() - this.stats.startTime,
            collectionCount: this.stats.collectionCount,
            savedToPostgres: this.stats.savedToPostgres,
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
        if (this.pgPool) {
            await this.pgPool.end();
        }

        if (this.redis) {
            await this.redis.quit();
        }

        this.logger.info('メトリクスコレクターシャットダウン完了');
    }

    /**
     * 公開API: 各モジュールへのアクセス
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

module.exports = MetricsCollector;
