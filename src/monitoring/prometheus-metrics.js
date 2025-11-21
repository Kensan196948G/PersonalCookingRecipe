/**
 * Prometheus メトリクス収集システム
 * PersonalCookingRecipe 統合監視システム
 *
 * 機能:
 * - システムメトリクス (CPU, メモリ, ディスクI/O)
 * - アプリケーションメトリクス (HTTP, API, データベース)
 * - ビジネスメトリクス (ユーザー, レシピ, 検索)
 * - カスタムSLI/SLOメトリクス
 */

const promClient = require('prom-client');
const os = require('os');
const winston = require('winston');

class PrometheusMetrics {
    constructor(config = {}) {
        this.config = {
            prefix: config.prefix || 'personalcookingrecipe_',
            defaultLabels: config.defaultLabels || { app: 'personalcookingrecipe' },
            collectDefaultMetrics: config.collectDefaultMetrics !== false,
            metricsPath: config.metricsPath || '/metrics',
            ...config
        };

        // ロガー初期化
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'prometheus-metrics' },
            transports: [
                new winston.transports.File({ filename: 'logs/prometheus-metrics.log' }),
                new winston.transports.Console({ format: winston.format.simple() })
            ]
        });

        // レジストリ初期化
        this.register = new promClient.Registry();
        this.register.setDefaultLabels(this.config.defaultLabels);

        // メトリクス初期化
        this.initializeMetrics();

        this.logger.info('Prometheusメトリクスシステム初期化完了');
    }

    initializeMetrics() {
        // ===================================
        // 1. システムメトリクス
        // ===================================

        // CPU使用率 (カスタム - デフォルトメトリクスに追加)
        this.cpuUsageGauge = new promClient.Gauge({
            name: `${this.config.prefix}cpu_usage_percent`,
            help: 'CPU使用率 (閾値: 85%)',
            labelNames: ['core'],
            registers: [this.register]
        });

        // メモリ使用率
        this.memoryUsageGauge = new promClient.Gauge({
            name: `${this.config.prefix}memory_usage_percent`,
            help: 'メモリ使用率 (閾値: 90%)',
            registers: [this.register]
        });

        this.memoryUsedBytes = new promClient.Gauge({
            name: `${this.config.prefix}memory_used_bytes`,
            help: 'メモリ使用量（バイト）',
            registers: [this.register]
        });

        this.memoryTotalBytes = new promClient.Gauge({
            name: `${this.config.prefix}memory_total_bytes`,
            help: 'メモリ総量（バイト）',
            registers: [this.register]
        });

        // ディスクI/O
        this.diskIOReadBytes = new promClient.Counter({
            name: `${this.config.prefix}disk_io_read_bytes_total`,
            help: 'ディスクI/O読み込みバイト数',
            registers: [this.register]
        });

        this.diskIOWriteBytes = new promClient.Counter({
            name: `${this.config.prefix}disk_io_write_bytes_total`,
            help: 'ディスクI/O書き込みバイト数',
            registers: [this.register]
        });

        // ネットワーク帯域
        this.networkBandwidthUsageGauge = new promClient.Gauge({
            name: `${this.config.prefix}network_bandwidth_usage_percent`,
            help: 'ネットワーク帯域使用率 (閾値: 80%)',
            labelNames: ['interface'],
            registers: [this.register]
        });

        // ===================================
        // 2. アプリケーションメトリクス
        // ===================================

        // HTTPリクエスト数
        this.httpRequestsTotal = new promClient.Counter({
            name: `${this.config.prefix}http_requests_total`,
            help: 'HTTPリクエスト総数',
            labelNames: ['method', 'route', 'status_code'],
            registers: [this.register]
        });

        // HTTPレスポンス時間
        this.httpRequestDuration = new promClient.Histogram({
            name: `${this.config.prefix}http_request_duration_seconds`,
            help: 'HTTPリクエスト処理時間（秒）',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
            registers: [this.register]
        });

        // APIエラー率
        this.apiErrorsTotal = new promClient.Counter({
            name: `${this.config.prefix}api_errors_total`,
            help: 'APIエラー総数',
            labelNames: ['endpoint', 'error_type', 'status_code'],
            registers: [this.register]
        });

        // 同時接続数
        this.activeConcurrentConnections = new promClient.Gauge({
            name: `${this.config.prefix}active_concurrent_connections`,
            help: '現在のアクティブな同時接続数',
            registers: [this.register]
        });

        // データベースクエリ時間
        this.databaseQueryDuration = new promClient.Histogram({
            name: `${this.config.prefix}database_query_duration_seconds`,
            help: 'データベースクエリ実行時間（秒）',
            labelNames: ['query_type', 'table'],
            buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2],
            registers: [this.register]
        });

        this.databaseQueriesTotal = new promClient.Counter({
            name: `${this.config.prefix}database_queries_total`,
            help: 'データベースクエリ総数',
            labelNames: ['query_type', 'table', 'status'],
            registers: [this.register]
        });

        // データベース接続プール
        this.databasePoolSize = new promClient.Gauge({
            name: `${this.config.prefix}database_pool_size`,
            help: 'データベース接続プールサイズ',
            labelNames: ['state'],
            registers: [this.register]
        });

        // Redis操作時間
        this.redisOperationDuration = new promClient.Histogram({
            name: `${this.config.prefix}redis_operation_duration_seconds`,
            help: 'Redis操作実行時間（秒）',
            labelNames: ['operation'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
            registers: [this.register]
        });

        this.redisOperationsTotal = new promClient.Counter({
            name: `${this.config.prefix}redis_operations_total`,
            help: 'Redis操作総数',
            labelNames: ['operation', 'status'],
            registers: [this.register]
        });

        // ===================================
        // 3. ビジネスメトリクス
        // ===================================

        // ユーザー登録数
        this.userRegistrationsTotal = new promClient.Counter({
            name: `${this.config.prefix}user_registrations_total`,
            help: 'ユーザー登録総数',
            labelNames: ['registration_type'],
            registers: [this.register]
        });

        this.userRegistrationsDaily = new promClient.Gauge({
            name: `${this.config.prefix}user_registrations_daily`,
            help: '本日のユーザー登録数',
            registers: [this.register]
        });

        // レシピ作成数
        this.recipesCreatedTotal = new promClient.Counter({
            name: `${this.config.prefix}recipes_created_total`,
            help: 'レシピ作成総数',
            labelNames: ['category'],
            registers: [this.register]
        });

        this.recipesCreatedDaily = new promClient.Gauge({
            name: `${this.config.prefix}recipes_created_daily`,
            help: '本日のレシピ作成数',
            registers: [this.register]
        });

        // 検索実行回数
        this.searchExecutionsTotal = new promClient.Counter({
            name: `${this.config.prefix}search_executions_total`,
            help: '検索実行総数',
            labelNames: ['search_type'],
            registers: [this.register]
        });

        this.searchResultsCount = new promClient.Histogram({
            name: `${this.config.prefix}search_results_count`,
            help: '検索結果数の分布',
            labelNames: ['search_type'],
            buckets: [0, 1, 5, 10, 20, 50, 100],
            registers: [this.register]
        });

        // キャッシュヒット率
        this.cacheHitsTotal = new promClient.Counter({
            name: `${this.config.prefix}cache_hits_total`,
            help: 'キャッシュヒット総数',
            labelNames: ['cache_type'],
            registers: [this.register]
        });

        this.cacheMissesTotal = new promClient.Counter({
            name: `${this.config.prefix}cache_misses_total`,
            help: 'キャッシュミス総数',
            labelNames: ['cache_type'],
            registers: [this.register]
        });

        this.cacheHitRate = new promClient.Gauge({
            name: `${this.config.prefix}cache_hit_rate`,
            help: 'キャッシュヒット率',
            labelNames: ['cache_type'],
            registers: [this.register]
        });

        // ===================================
        // 4. SLI/SLOメトリクス
        // ===================================

        // 可用性 SLI
        this.availabilitySLI = new promClient.Gauge({
            name: `${this.config.prefix}availability_sli`,
            help: '可用性SLI - 正常レスポンス率 (目標: 99.5%)',
            registers: [this.register]
        });

        // レスポンス時間 SLI (P95)
        this.responseTimeSLI = new promClient.Gauge({
            name: `${this.config.prefix}response_time_p95_sli`,
            help: 'レスポンス時間SLI - P95レスポンス時間 (目標: <2秒)',
            labelNames: ['endpoint'],
            registers: [this.register]
        });

        // スループット SLI
        this.throughputSLI = new promClient.Gauge({
            name: `${this.config.prefix}throughput_sli`,
            help: 'スループットSLI - 成功リクエスト/秒 (目標: >10 RPS)',
            registers: [this.register]
        });

        // エラーバジェット
        this.errorBudgetRemaining = new promClient.Gauge({
            name: `${this.config.prefix}error_budget_remaining`,
            help: '残りエラーバジェット（％）',
            labelNames: ['sli_type'],
            registers: [this.register]
        });

        // ===================================
        // 5. デフォルトメトリクス
        // ===================================
        if (this.config.collectDefaultMetrics) {
            promClient.collectDefaultMetrics({
                register: this.register,
                prefix: this.config.prefix,
                gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
            });
        }

        this.logger.info('全メトリクス初期化完了');
    }

    // ===================================
    // システムメトリクス更新メソッド
    // ===================================

    updateSystemMetrics() {
        try {
            // CPU使用率
            const cpus = os.cpus();
            cpus.forEach((cpu, index) => {
                const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
                const idle = cpu.times.idle;
                const usage = ((total - idle) / total) * 100;
                this.cpuUsageGauge.labels(`core_${index}`).set(usage);
            });

            // メモリ使用率
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const memUsagePercent = (usedMem / totalMem) * 100;

            this.memoryUsageGauge.set(memUsagePercent);
            this.memoryUsedBytes.set(usedMem);
            this.memoryTotalBytes.set(totalMem);

            this.logger.debug('システムメトリクス更新完了', {
                cpuCores: cpus.length,
                memUsagePercent: memUsagePercent.toFixed(2)
            });
        } catch (error) {
            this.logger.error('システムメトリクス更新エラー', { error: error.message });
        }
    }

    // ===================================
    // Expressミドルウェア
    // ===================================

    createMiddleware() {
        return (req, res, next) => {
            // リクエスト開始時刻
            const startTime = Date.now();

            // 同時接続数増加
            this.activeConcurrentConnections.inc();

            // レスポンス完了時の処理
            res.on('finish', () => {
                const duration = (Date.now() - startTime) / 1000;
                const route = req.route ? req.route.path : req.path;
                const method = req.method;
                const statusCode = res.statusCode;

                // HTTPリクエスト数カウント
                this.httpRequestsTotal.labels(method, route, statusCode.toString()).inc();

                // HTTPレスポンス時間記録
                this.httpRequestDuration.labels(method, route, statusCode.toString()).observe(duration);

                // エラーカウント
                if (statusCode >= 400) {
                    const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
                    this.apiErrorsTotal.labels(route, errorType, statusCode.toString()).inc();
                }

                // 同時接続数減少
                this.activeConcurrentConnections.dec();

                // SLI更新
                this.updateSLIMetrics(duration, statusCode);
            });

            next();
        };
    }

    // ===================================
    // SLI/SLOメトリクス更新
    // ===================================

    updateSLIMetrics(duration, statusCode) {
        // 可用性SLI更新（成功率）
        const isSuccess = statusCode < 500;
        // 注: 実際のSLI計算は集計クエリで行う（ここでは記録のみ）

        // レスポンス時間SLI（P95は集計で計算）
        // 注: Prometheusのquantile関数で集計

        // スループットSLI（rateで計算）
        // 注: PromQLでrate()関数を使用
    }

    // ===================================
    // データベースメトリクス記録
    // ===================================

    recordDatabaseQuery(queryType, table, duration, status = 'success') {
        this.databaseQueryDuration.labels(queryType, table).observe(duration / 1000);
        this.databaseQueriesTotal.labels(queryType, table, status).inc();
    }

    updateDatabasePoolMetrics(idle, active, waiting) {
        this.databasePoolSize.labels('idle').set(idle);
        this.databasePoolSize.labels('active').set(active);
        this.databasePoolSize.labels('waiting').set(waiting);
    }

    // ===================================
    // Redisメトリクス記録
    // ===================================

    recordRedisOperation(operation, duration, status = 'success') {
        this.redisOperationDuration.labels(operation).observe(duration / 1000);
        this.redisOperationsTotal.labels(operation, status).inc();
    }

    // ===================================
    // ビジネスメトリクス記録
    // ===================================

    recordUserRegistration(registrationType = 'email') {
        this.userRegistrationsTotal.labels(registrationType).inc();
    }

    updateDailyUserRegistrations(count) {
        this.userRegistrationsDaily.set(count);
    }

    recordRecipeCreation(category = 'general') {
        this.recipesCreatedTotal.labels(category).inc();
    }

    updateDailyRecipeCreations(count) {
        this.recipesCreatedDaily.set(count);
    }

    recordSearch(searchType = 'keyword', resultCount = 0) {
        this.searchExecutionsTotal.labels(searchType).inc();
        this.searchResultsCount.labels(searchType).observe(resultCount);
    }

    recordCacheHit(cacheType = 'redis') {
        this.cacheHitsTotal.labels(cacheType).inc();
        this.updateCacheHitRate(cacheType);
    }

    recordCacheMiss(cacheType = 'redis') {
        this.cacheMissesTotal.labels(cacheType).inc();
        this.updateCacheHitRate(cacheType);
    }

    async updateCacheHitRate(cacheType) {
        // 注: 実際のヒット率はPromQLで計算
        // cache_hits_total / (cache_hits_total + cache_misses_total)
    }

    // ===================================
    // エラーバジェット計算
    // ===================================

    updateErrorBudget(sliType, currentValue, targetValue, errorBudgetPercent) {
        const deviation = Math.abs(currentValue - targetValue);
        const budgetUsed = (deviation / targetValue) * 100;
        const remaining = Math.max(0, errorBudgetPercent - budgetUsed);

        this.errorBudgetRemaining.labels(sliType).set(remaining);
    }

    // ===================================
    // メトリクスエクスポート
    // ===================================

    async getMetrics() {
        try {
            // システムメトリクス更新
            this.updateSystemMetrics();

            return await this.register.metrics();
        } catch (error) {
            this.logger.error('メトリクス取得エラー', { error: error.message });
            throw error;
        }
    }

    getMetricsContentType() {
        return this.register.contentType;
    }

    // ===================================
    // ヘルパーメソッド
    // ===================================

    getRegister() {
        return this.register;
    }

    reset() {
        this.register.clear();
        this.logger.info('全メトリクスリセット完了');
    }
}

// シングルトンインスタンス
let instance = null;

module.exports = {
    PrometheusMetrics,
    getInstance: (config) => {
        if (!instance) {
            instance = new PrometheusMetrics(config);
        }
        return instance;
    },
    resetInstance: () => {
        if (instance) {
            instance.reset();
            instance = null;
        }
    }
};
