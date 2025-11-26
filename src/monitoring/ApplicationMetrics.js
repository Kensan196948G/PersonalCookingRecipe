/**
 * アプリケーション監視モジュール
 * PersonalCookingRecipe - Docker非依存監視システム
 *
 * 機能:
 * - HTTPリクエスト監視
 * - APIレスポンス時間計測 (P50, P95, P99)
 * - エラー率追跡
 * - アクティブ接続数監視
 * - データベースクエリ時間追跡
 * - Redisヒット率監視
 */

const { EventEmitter } = require('events');
const winston = require('winston');

class ApplicationMetrics extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            enableHTTP: config.enableHTTP !== false,
            enableDatabase: config.enableDatabase !== false,
            enableRedis: config.enableRedis !== false,
            historyLimit: config.historyLimit || 1000, // 直近1000件保持
            percentiles: config.percentiles || [50, 95, 99],
            thresholds: {
                responseTime: config.thresholds?.responseTime || 2000, // 2秒
                errorRate: config.thresholds?.errorRate || 5, // 5%
                dbQueryTime: config.thresholds?.dbQueryTime || 1000, // 1秒
                cacheHitRate: config.thresholds?.cacheHitRate || 80 // 80%
            },
            ...config
        };

        // ロガー初期化
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'application-metrics' },
            transports: [
                new winston.transports.File({
                    filename: 'logs/application-metrics.log',
                    maxsize: 20 * 1024 * 1024, // 20MB
                    maxFiles: 10
                }),
                new winston.transports.Console({
                    format: winston.format.simple(),
                    level: 'warn'
                })
            ]
        });

        // メトリクスストレージ
        this.metrics = {
            http: {
                requests: [],
                totalRequests: 0,
                totalErrors: 0,
                statusCodes: {},
                methods: {},
                routes: {},
                activeConnections: 0
            },
            database: {
                queries: [],
                totalQueries: 0,
                totalErrors: 0,
                queryTypes: {},
                slowQueries: [],
                poolStats: {
                    active: 0,
                    idle: 0,
                    waiting: 0,
                    total: 0
                }
            },
            redis: {
                operations: [],
                totalOperations: 0,
                totalErrors: 0,
                hits: 0,
                misses: 0,
                hitRate: 0,
                operationTypes: {}
            },
            lastUpdate: null,
            startTime: Date.now()
        };

        this.logger.info('アプリケーション監視システム初期化完了');
    }

    /**
     * Expressミドルウェア作成
     */
    createHTTPMiddleware() {
        return (req, res, next) => {
            const startTime = Date.now();
            const requestId = this.generateRequestId();

            // アクティブ接続数増加
            this.metrics.http.activeConnections++;

            // リクエスト情報記録
            const requestInfo = {
                id: requestId,
                method: req.method,
                route: req.route?.path || req.path,
                url: req.url,
                startTime,
                ip: req.ip || req.connection?.remoteAddress
            };

            // レスポンス終了時の処理
            const originalEnd = res.end;
            res.end = (...args) => {
                const duration = Date.now() - startTime;
                const statusCode = res.statusCode;

                // メトリクス記録
                this.recordHTTPRequest({
                    ...requestInfo,
                    statusCode,
                    duration,
                    endTime: Date.now(),
                    success: statusCode < 400
                });

                // アクティブ接続数減少
                this.metrics.http.activeConnections--;

                // 元のend関数を呼び出し
                originalEnd.apply(res, args);
            };

            next();
        };
    }

    /**
     * HTTPリクエスト記録
     */
    recordHTTPRequest(request) {
        // リクエスト履歴に追加
        this.metrics.http.requests.push(request);
        if (this.metrics.http.requests.length > this.config.historyLimit) {
            this.metrics.http.requests.shift();
        }

        // カウンター更新
        this.metrics.http.totalRequests++;

        // ステータスコード集計
        const code = request.statusCode.toString();
        this.metrics.http.statusCodes[code] = (this.metrics.http.statusCodes[code] || 0) + 1;

        // メソッド集計
        this.metrics.http.methods[request.method] = (this.metrics.http.methods[request.method] || 0) + 1;

        // ルート集計
        const route = request.route || 'unknown';
        if (!this.metrics.http.routes[route]) {
            this.metrics.http.routes[route] = {
                count: 0,
                errors: 0,
                totalDuration: 0,
                minDuration: Infinity,
                maxDuration: 0
            };
        }
        const routeStats = this.metrics.http.routes[route];
        routeStats.count++;
        routeStats.totalDuration += request.duration;
        routeStats.minDuration = Math.min(routeStats.minDuration, request.duration);
        routeStats.maxDuration = Math.max(routeStats.maxDuration, request.duration);

        // エラー記録
        if (!request.success) {
            this.metrics.http.totalErrors++;
            routeStats.errors++;
        }

        // 閾値チェック
        if (request.duration > this.config.thresholds.responseTime) {
            this.emit('alert', {
                type: 'slow_request',
                severity: 'warning',
                message: `遅いリクエスト検出: ${request.method} ${request.route} (${request.duration}ms)`,
                request,
                threshold: this.config.thresholds.responseTime
            });
        }

        this.metrics.lastUpdate = Date.now();
        this.emit('http_request', request);
    }

    /**
     * データベースクエリ記録
     */
    recordDatabaseQuery(query) {
        const queryInfo = {
            id: this.generateRequestId(),
            queryType: query.type || 'SELECT',
            table: query.table || 'unknown',
            duration: query.duration,
            success: query.success !== false,
            timestamp: query.timestamp || Date.now(),
            error: query.error
        };

        // クエリ履歴に追加
        this.metrics.database.queries.push(queryInfo);
        if (this.metrics.database.queries.length > this.config.historyLimit) {
            this.metrics.database.queries.shift();
        }

        // カウンター更新
        this.metrics.database.totalQueries++;

        // クエリタイプ集計
        const type = queryInfo.queryType;
        if (!this.metrics.database.queryTypes[type]) {
            this.metrics.database.queryTypes[type] = {
                count: 0,
                errors: 0,
                totalDuration: 0,
                avgDuration: 0
            };
        }
        const typeStats = this.metrics.database.queryTypes[type];
        typeStats.count++;
        typeStats.totalDuration += queryInfo.duration;
        typeStats.avgDuration = typeStats.totalDuration / typeStats.count;

        // エラー記録
        if (!queryInfo.success) {
            this.metrics.database.totalErrors++;
            typeStats.errors++;
        }

        // 遅いクエリ記録
        if (queryInfo.duration > this.config.thresholds.dbQueryTime) {
            this.metrics.database.slowQueries.push(queryInfo);
            if (this.metrics.database.slowQueries.length > 100) {
                this.metrics.database.slowQueries.shift();
            }

            this.emit('alert', {
                type: 'slow_query',
                severity: 'warning',
                message: `遅いDBクエリ検出: ${type} ${queryInfo.table} (${queryInfo.duration}ms)`,
                query: queryInfo,
                threshold: this.config.thresholds.dbQueryTime
            });
        }

        this.metrics.lastUpdate = Date.now();
        this.emit('database_query', queryInfo);
    }

    /**
     * データベースプール統計更新
     */
    updateDatabasePoolStats(poolStats) {
        this.metrics.database.poolStats = {
            active: poolStats.active || 0,
            idle: poolStats.idle || 0,
            waiting: poolStats.waiting || 0,
            total: poolStats.total || 0,
            timestamp: Date.now()
        };

        this.emit('database_pool', this.metrics.database.poolStats);
    }

    /**
     * Redis操作記録
     */
    recordRedisOperation(operation) {
        const opInfo = {
            id: this.generateRequestId(),
            operation: operation.operation || 'GET',
            key: operation.key,
            duration: operation.duration,
            success: operation.success !== false,
            hit: operation.hit || false,
            timestamp: operation.timestamp || Date.now(),
            error: operation.error
        };

        // 操作履歴に追加
        this.metrics.redis.operations.push(opInfo);
        if (this.metrics.redis.operations.length > this.config.historyLimit) {
            this.metrics.redis.operations.shift();
        }

        // カウンター更新
        this.metrics.redis.totalOperations++;

        // 操作タイプ集計
        const op = opInfo.operation;
        if (!this.metrics.redis.operationTypes[op]) {
            this.metrics.redis.operationTypes[op] = {
                count: 0,
                errors: 0,
                totalDuration: 0,
                avgDuration: 0
            };
        }
        const opStats = this.metrics.redis.operationTypes[op];
        opStats.count++;
        opStats.totalDuration += opInfo.duration;
        opStats.avgDuration = opStats.totalDuration / opStats.count;

        // ヒット/ミス記録
        if (opInfo.hit) {
            this.metrics.redis.hits++;
        } else if (opInfo.operation === 'GET' || opInfo.operation === 'MGET') {
            this.metrics.redis.misses++;
        }

        // ヒット率計算
        const totalCacheOps = this.metrics.redis.hits + this.metrics.redis.misses;
        if (totalCacheOps > 0) {
            this.metrics.redis.hitRate = (this.metrics.redis.hits / totalCacheOps) * 100;
        }

        // エラー記録
        if (!opInfo.success) {
            this.metrics.redis.totalErrors++;
            opStats.errors++;
        }

        // ヒット率閾値チェック
        if (totalCacheOps > 100 && this.metrics.redis.hitRate < this.config.thresholds.cacheHitRate) {
            this.emit('alert', {
                type: 'low_cache_hit_rate',
                severity: 'warning',
                message: `キャッシュヒット率が低い: ${this.metrics.redis.hitRate.toFixed(2)}%`,
                hitRate: this.metrics.redis.hitRate,
                threshold: this.config.thresholds.cacheHitRate
            });
        }

        this.metrics.lastUpdate = Date.now();
        this.emit('redis_operation', opInfo);
    }

    /**
     * レスポンス時間パーセンタイル計算
     */
    calculateResponseTimePercentiles() {
        const durations = this.metrics.http.requests
            .map(r => r.duration)
            .sort((a, b) => a - b);

        if (durations.length === 0) {
            return { p50: 0, p95: 0, p99: 0 };
        }

        const getPercentile = (arr, p) => {
            const index = Math.ceil((p / 100) * arr.length) - 1;
            return arr[Math.max(0, index)] || 0;
        };

        return {
            p50: getPercentile(durations, 50),
            p95: getPercentile(durations, 95),
            p99: getPercentile(durations, 99)
        };
    }

    /**
     * エラー率計算
     */
    calculateErrorRate() {
        if (this.metrics.http.totalRequests === 0) return 0;
        return (this.metrics.http.totalErrors / this.metrics.http.totalRequests) * 100;
    }

    /**
     * スループット計算 (requests/sec)
     */
    calculateThroughput() {
        const uptime = (Date.now() - this.metrics.startTime) / 1000; // 秒
        if (uptime === 0) return 0;
        return this.metrics.http.totalRequests / uptime;
    }

    /**
     * 現在のメトリクス取得
     */
    getCurrentMetrics() {
        const percentiles = this.calculateResponseTimePercentiles();
        const errorRate = this.calculateErrorRate();
        const throughput = this.calculateThroughput();

        return {
            http: {
                totalRequests: this.metrics.http.totalRequests,
                totalErrors: this.metrics.http.totalErrors,
                activeConnections: this.metrics.http.activeConnections,
                errorRate,
                throughput,
                percentiles,
                statusCodes: this.metrics.http.statusCodes,
                topRoutes: this.getTopRoutes(10)
            },
            database: {
                totalQueries: this.metrics.database.totalQueries,
                totalErrors: this.metrics.database.totalErrors,
                queryTypes: this.metrics.database.queryTypes,
                poolStats: this.metrics.database.poolStats,
                slowQueriesCount: this.metrics.database.slowQueries.length
            },
            redis: {
                totalOperations: this.metrics.redis.totalOperations,
                totalErrors: this.metrics.redis.totalErrors,
                hits: this.metrics.redis.hits,
                misses: this.metrics.redis.misses,
                hitRate: this.metrics.redis.hitRate,
                operationTypes: this.metrics.redis.operationTypes
            },
            lastUpdate: this.metrics.lastUpdate,
            uptime: Date.now() - this.metrics.startTime
        };
    }

    /**
     * トップルート取得
     */
    getTopRoutes(limit = 10) {
        return Object.entries(this.metrics.http.routes)
            .map(([route, stats]) => ({
                route,
                count: stats.count,
                errors: stats.errors,
                avgDuration: stats.totalDuration / stats.count,
                minDuration: stats.minDuration,
                maxDuration: stats.maxDuration,
                errorRate: stats.count > 0 ? (stats.errors / stats.count) * 100 : 0
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    /**
     * 遅いクエリ取得
     */
    getSlowQueries(limit = 10) {
        return this.metrics.database.slowQueries
            .sort((a, b) => b.duration - a.duration)
            .slice(0, limit);
    }

    /**
     * 統計情報取得
     */
    getStats() {
        const percentiles = this.calculateResponseTimePercentiles();
        const errorRate = this.calculateErrorRate();
        const throughput = this.calculateThroughput();

        return {
            uptime: Date.now() - this.metrics.startTime,
            lastUpdate: this.metrics.lastUpdate,
            http: {
                totalRequests: this.metrics.http.totalRequests,
                totalErrors: this.metrics.http.totalErrors,
                errorRate: errorRate.toFixed(2) + '%',
                throughput: throughput.toFixed(2) + ' req/s',
                avgResponseTime: this.calculateAverageResponseTime(),
                percentiles
            },
            database: {
                totalQueries: this.metrics.database.totalQueries,
                totalErrors: this.metrics.database.totalErrors,
                errorRate: this.metrics.database.totalQueries > 0
                    ? ((this.metrics.database.totalErrors / this.metrics.database.totalQueries) * 100).toFixed(2) + '%'
                    : '0%',
                avgQueryTime: this.calculateAverageDatabaseQueryTime()
            },
            redis: {
                totalOperations: this.metrics.redis.totalOperations,
                totalErrors: this.metrics.redis.totalErrors,
                hitRate: this.metrics.redis.hitRate.toFixed(2) + '%',
                avgOperationTime: this.calculateAverageRedisOperationTime()
            }
        };
    }

    /**
     * 平均レスポンス時間計算
     */
    calculateAverageResponseTime() {
        if (this.metrics.http.requests.length === 0) return 0;
        const total = this.metrics.http.requests.reduce((sum, r) => sum + r.duration, 0);
        return total / this.metrics.http.requests.length;
    }

    /**
     * 平均DBクエリ時間計算
     */
    calculateAverageDatabaseQueryTime() {
        if (this.metrics.database.queries.length === 0) return 0;
        const total = this.metrics.database.queries.reduce((sum, q) => sum + q.duration, 0);
        return total / this.metrics.database.queries.length;
    }

    /**
     * 平均Redis操作時間計算
     */
    calculateAverageRedisOperationTime() {
        if (this.metrics.redis.operations.length === 0) return 0;
        const total = this.metrics.redis.operations.reduce((sum, op) => sum + op.duration, 0);
        return total / this.metrics.redis.operations.length;
    }

    /**
     * リクエストID生成
     */
    generateRequestId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * メトリクスリセット
     */
    reset() {
        this.metrics = {
            http: {
                requests: [],
                totalRequests: 0,
                totalErrors: 0,
                statusCodes: {},
                methods: {},
                routes: {},
                activeConnections: 0
            },
            database: {
                queries: [],
                totalQueries: 0,
                totalErrors: 0,
                queryTypes: {},
                slowQueries: [],
                poolStats: {
                    active: 0,
                    idle: 0,
                    waiting: 0,
                    total: 0
                }
            },
            redis: {
                operations: [],
                totalOperations: 0,
                totalErrors: 0,
                hits: 0,
                misses: 0,
                hitRate: 0,
                operationTypes: {}
            },
            lastUpdate: null,
            startTime: Date.now()
        };

        this.logger.info('アプリケーションメトリクスリセット完了');
    }
}

module.exports = ApplicationMetrics;
