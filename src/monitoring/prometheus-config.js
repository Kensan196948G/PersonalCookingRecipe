/**
 * Prometheus/Grafana監視システム設定
 * PersonalCookingRecipe Phase 2b パフォーマンス最適化
 */

const client = require('prom-client');

// Prometheus クライアント設定
const register = new client.Registry();

// デフォルトメトリクス収集（CPU、メモリなど）
client.collectDefaultMetrics({
    register,
    prefix: 'personalcookingrecipe_',
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    eventLoopMonitoringPrecision: 10
});

// カスタムメトリクス定義

// HTTP リクエストカウンター
const httpRequestsTotal = new client.Counter({
    name: 'personalcookingrecipe_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register]
});

// HTTP レスポンス時間
const httpRequestDuration = new client.Histogram({
    name: 'personalcookingrecipe_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
    registers: [register]
});

// データベース接続プール
const dbConnectionsActive = new client.Gauge({
    name: 'personalcookingrecipe_db_connections_active',
    help: 'Number of active database connections',
    registers: [register]
});

const dbConnectionsIdle = new client.Gauge({
    name: 'personalcookingrecipe_db_connections_idle',
    help: 'Number of idle database connections',
    registers: [register]
});

// データベース クエリ実行時間
const dbQueryDuration = new client.Histogram({
    name: 'personalcookingrecipe_db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.001, 0.01, 0.05, 0.1, 0.2, 0.5, 1, 2],
    registers: [register]
});

// Redis 操作メトリクス
const redisOperationsTotal = new client.Counter({
    name: 'personalcookingrecipe_redis_operations_total',
    help: 'Total number of Redis operations',
    labelNames: ['operation', 'status'],
    registers: [register]
});

const redisOperationDuration = new client.Histogram({
    name: 'personalcookingrecipe_redis_operation_duration_seconds',
    help: 'Duration of Redis operations in seconds',
    labelNames: ['operation'],
    buckets: [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5],
    registers: [register]
});

// キャッシュ ヒット/ミス
const cacheOperations = new client.Counter({
    name: 'personalcookingrecipe_cache_operations_total',
    help: 'Total number of cache operations',
    labelNames: ['type', 'result'], // type: jwt|recipe|search, result: hit|miss
    registers: [register]
});

// JWT 認証メトリクス
const jwtOperations = new client.Counter({
    name: 'personalcookingrecipe_jwt_operations_total',
    help: 'Total number of JWT operations',
    labelNames: ['operation', 'status'], // operation: verify|generate, status: success|failed
    registers: [register]
});

const jwtVerificationDuration = new client.Histogram({
    name: 'personalcookingrecipe_jwt_verification_duration_seconds',
    help: 'Duration of JWT verification in seconds',
    buckets: [0.0001, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05],
    registers: [register]
});

// API エラーカウンター
const apiErrors = new client.Counter({
    name: 'personalcookingrecipe_api_errors_total',
    help: 'Total number of API errors',
    labelNames: ['route', 'error_type'],
    registers: [register]
});

// レシピ関連メトリクス
const recipeOperations = new client.Counter({
    name: 'personalcookingrecipe_recipe_operations_total',
    help: 'Total number of recipe operations',
    labelNames: ['operation'], // operation: create|read|update|delete
    registers: [register]
});

// YouTube API メトリクス
const youtubeApiCalls = new client.Counter({
    name: 'personalcookingrecipe_youtube_api_calls_total',
    help: 'Total number of YouTube API calls',
    labelNames: ['endpoint', 'status'],
    registers: [register]
});

// アクティブユーザー数
const activeUsers = new client.Gauge({
    name: 'personalcookingrecipe_active_users',
    help: 'Number of currently active users',
    registers: [register]
});

// システムヘルス
const systemHealth = new client.Gauge({
    name: 'personalcookingrecipe_system_health',
    help: 'Overall system health status (1=healthy, 0=unhealthy)',
    registers: [register]
});

class PrometheusMonitor {
    constructor() {
        this.metrics = {
            httpRequestsTotal,
            httpRequestDuration,
            dbConnectionsActive,
            dbConnectionsIdle,
            dbQueryDuration,
            redisOperationsTotal,
            redisOperationDuration,
            cacheOperations,
            jwtOperations,
            jwtVerificationDuration,
            apiErrors,
            recipeOperations,
            youtubeApiCalls,
            activeUsers,
            systemHealth
        };
        
        this.register = register;
    }

    // HTTPリクエスト記録
    recordHttpRequest(method, route, statusCode, duration) {
        this.metrics.httpRequestsTotal.inc({
            method,
            route,
            status_code: statusCode
        });
        
        this.metrics.httpRequestDuration.observe({
            method,
            route,
            status_code: statusCode
        }, duration / 1000); // ミリ秒を秒に変換
    }

    // データベース接続状況更新
    updateDbConnections(active, idle) {
        this.metrics.dbConnectionsActive.set(active);
        this.metrics.dbConnectionsIdle.set(idle);
    }

    // データベース クエリ記録
    recordDbQuery(operation, table, duration) {
        this.metrics.dbQueryDuration.observe({
            operation,
            table
        }, duration / 1000);
    }

    // Redis操作記録
    recordRedisOperation(operation, status, duration) {
        this.metrics.redisOperationsTotal.inc({
            operation,
            status
        });
        
        if (duration !== undefined) {
            this.metrics.redisOperationDuration.observe({
                operation
            }, duration / 1000);
        }
    }

    // キャッシュ操作記録
    recordCacheOperation(type, result) {
        this.metrics.cacheOperations.inc({
            type,
            result
        });
    }

    // JWT操作記録
    recordJwtOperation(operation, status, duration) {
        this.metrics.jwtOperations.inc({
            operation,
            status
        });
        
        if (operation === 'verify' && duration !== undefined) {
            this.metrics.jwtVerificationDuration.observe(duration / 1000);
        }
    }

    // API エラー記録
    recordApiError(route, errorType) {
        this.metrics.apiErrors.inc({
            route,
            error_type: errorType
        });
    }

    // レシピ操作記録
    recordRecipeOperation(operation) {
        this.metrics.recipeOperations.inc({
            operation
        });
    }

    // YouTube API 呼び出し記録
    recordYouTubeApiCall(endpoint, status) {
        this.metrics.youtubeApiCalls.inc({
            endpoint,
            status
        });
    }

    // アクティブユーザー数更新
    updateActiveUsers(count) {
        this.metrics.activeUsers.set(count);
    }

    // システムヘルス更新
    updateSystemHealth(isHealthy) {
        this.metrics.systemHealth.set(isHealthy ? 1 : 0);
    }

    // メトリクス取得（Prometheus形式）
    getMetrics() {
        return this.register.metrics();
    }

    // メトリクスリセット
    resetMetrics() {
        this.register.resetMetrics();
        console.log('✅ Prometheusメトリクスリセット完了');
    }

    // パフォーマンス サマリー取得
    async getPerformanceSummary() {
        const metrics = await this.register.getMetricsAsJSON();
        
        // 主要メトリクスを抽出
        const summary = {
            timestamp: new Date().toISOString(),
            http: this.extractMetric(metrics, 'personalcookingrecipe_http_requests_total'),
            database: this.extractMetric(metrics, 'personalcookingrecipe_db_connections_active'),
            redis: this.extractMetric(metrics, 'personalcookingrecipe_redis_operations_total'),
            jwt: this.extractMetric(metrics, 'personalcookingrecipe_jwt_operations_total'),
            cache: this.extractMetric(metrics, 'personalcookingrecipe_cache_operations_total'),
            system_health: this.extractMetric(metrics, 'personalcookingrecipe_system_health')
        };
        
        return summary;
    }

    // メトリクス抽出ヘルパー
    extractMetric(metrics, name) {
        const metric = metrics.find(m => m.name === name);
        if (!metric) return null;
        
        if (metric.type === 'counter') {
            return {
                total: metric.values.reduce((sum, v) => sum + v.value, 0),
                labels: metric.values.map(v => ({ labels: v.labels, value: v.value }))
            };
        } else if (metric.type === 'gauge') {
            return {
                current: metric.values[0]?.value || 0
            };
        }
        
        return metric;
    }
}

// シングルトンインスタンス
const prometheusMonitor = new PrometheusMonitor();

module.exports = {
    prometheusMonitor,
    register,
    PrometheusMonitor
};