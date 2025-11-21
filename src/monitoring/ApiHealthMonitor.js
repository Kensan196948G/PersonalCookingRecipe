/**
 * API ヘルスチェック監視モジュール
 * PersonalCookingRecipe統合開発環境
 */

const axios = require('axios');
const winston = require('winston');
const prometheus = require('prom-client');

class ApiHealthMonitor {
    constructor(config = {}) {
        this.config = {
            // 基本設定
            baseUrl: config.baseUrl || `http://localhost:${process.env.BACKEND_PORT || 5000}`,
            checkInterval: config.checkInterval || 30000, // 30秒間隔
            timeout: config.timeout || 5000,
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000,
            
            // 監視エンドポイント
            endpoints: config.endpoints || [
                { path: '/api/health', method: 'GET', critical: true },
                { path: '/api/recipes', method: 'GET', critical: false },
                { path: '/api/categories', method: 'GET', critical: false }
            ],
            
            // パフォーマンス閾値
            responseTimeThreshold: config.responseTimeThreshold || 2000, // 2秒
            uptimeThreshold: config.uptimeThreshold || 0.95, // 95%
            
            ...config
        };

        this.state = {
            isHealthy: true,
            lastHealthCheck: null,
            uptime: 0,
            downtime: 0,
            endpoints: new Map()
        };

        this.metrics = {
            totalChecks: 0,
            successfulChecks: 0,
            failedChecks: 0,
            averageResponseTime: 0,
            uptimePercentage: 100
        };

        this.timer = null;
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'api-health-monitor' },
            transports: [
                new winston.transports.File({ 
                    filename: 'logs/api-health-monitor.log' 
                }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });

        // Prometheus メトリクス
        this.prometheusMetrics = {
            httpRequests: new prometheus.Counter({
                name: 'http_requests_total',
                help: 'Total number of HTTP requests',
                labelNames: ['method', 'endpoint', 'status']
            }),
            httpDuration: new prometheus.Histogram({
                name: 'http_request_duration_seconds',
                help: 'HTTP request duration in seconds',
                labelNames: ['method', 'endpoint']
            }),
            apiUptime: new prometheus.Gauge({
                name: 'api_uptime_percentage',
                help: 'API uptime percentage'
            }),
            endpointHealth: new prometheus.Gauge({
                name: 'endpoint_health_status',
                help: 'Health status of endpoints (1=healthy, 0=unhealthy)',
                labelNames: ['endpoint']
            })
        };

        this.initialize();
    }

    async initialize() {
        this.logger.info('API ヘルス監視初期化開始');
        
        // エンドポイント状態初期化
        this.config.endpoints.forEach(endpoint => {
            this.state.endpoints.set(endpoint.path, {
                ...endpoint,
                lastCheck: null,
                isHealthy: true,
                consecutiveFailures: 0,
                responseTimeHistory: [],
                uptime: 0,
                downtime: 0
            });
        });
        
        // 初回ヘルスチェック
        await this.performHealthCheck();
        
        // 定期監視開始
        this.startMonitoring();
        
        this.logger.info('API ヘルス監視初期化完了');
    }

    startMonitoring() {
        if (this.timer) {
            clearInterval(this.timer);
        }

        this.timer = setInterval(async () => {
            await this.performHealthCheck();
        }, this.config.checkInterval);

        this.logger.info(`API ヘルス監視開始（間隔: ${this.config.checkInterval}ms）`);
    }

    async performHealthCheck() {
        const startTime = Date.now();
        this.metrics.totalChecks++;
        
        const results = await Promise.allSettled(
            this.config.endpoints.map(endpoint => this.checkEndpoint(endpoint))
        );
        
        const duration = Date.now() - startTime;
        let allHealthy = true;
        let criticalFailures = 0;
        
        results.forEach((result, index) => {
            const endpoint = this.config.endpoints[index];
            const endpointState = this.state.endpoints.get(endpoint.path);
            
            if (result.status === 'fulfilled' && result.value.healthy) {
                endpointState.isHealthy = true;
                endpointState.consecutiveFailures = 0;
                endpointState.uptime++;
                this.prometheusMetrics.endpointHealth.labels(endpoint.path).set(1);
            } else {
                endpointState.isHealthy = false;
                endpointState.consecutiveFailures++;
                endpointState.downtime++;
                allHealthy = false;
                
                if (endpoint.critical) {
                    criticalFailures++;
                }
                
                this.prometheusMetrics.endpointHealth.labels(endpoint.path).set(0);
            }
            
            endpointState.lastCheck = new Date();
        });
        
        // 全体ヘルス状態更新
        this.state.isHealthy = allHealthy || criticalFailures === 0;
        this.state.lastHealthCheck = new Date();
        
        if (this.state.isHealthy) {
            this.metrics.successfulChecks++;
            this.state.uptime++;
        } else {
            this.metrics.failedChecks++;
            this.state.downtime++;
        }
        
        // アップタイム計算
        const totalChecks = this.state.uptime + this.state.downtime;
        this.metrics.uptimePercentage = totalChecks > 0 ? (this.state.uptime / totalChecks) * 100 : 100;
        this.prometheusMetrics.apiUptime.set(this.metrics.uptimePercentage / 100);
        
        // 平均応答時間更新
        this.metrics.averageResponseTime = 
            (this.metrics.averageResponseTime + duration) / 2;
        
        this.logger.info(`ヘルスチェック完了 (${duration}ms)`, {
            healthy: this.state.isHealthy,
            uptime: `${this.metrics.uptimePercentage.toFixed(2)}%`,
            criticalFailures
        });
    }

    async checkEndpoint(endpoint) {
        const endpointState = this.state.endpoints.get(endpoint.path);
        const url = `${this.config.baseUrl}${endpoint.path}`;
        const startTime = Date.now();
        
        try {
            const response = await axios({
                method: endpoint.method,
                url,
                timeout: this.config.timeout,
                validateStatus: (status) => status < 500 // 5xxのみエラー扱い
            });
            
            const duration = Date.now() - startTime;
            
            // レスポンス時間記録
            endpointState.responseTimeHistory.push(duration);
            if (endpointState.responseTimeHistory.length > 50) {
                endpointState.responseTimeHistory.shift();
            }
            
            // メトリクス記録
            this.prometheusMetrics.httpRequests
                .labels(endpoint.method, endpoint.path, response.status.toString())
                .inc();
            
            this.prometheusMetrics.httpDuration
                .labels(endpoint.method, endpoint.path)
                .observe(duration / 1000);
            
            // ヘルス判定
            const isHealthy = response.status < 400 && duration < this.config.responseTimeThreshold;
            
            if (!isHealthy) {
                this.logger.warn(`エンドポイント異常: ${endpoint.path}`, {
                    status: response.status,
                    duration,
                    threshold: this.config.responseTimeThreshold
                });
            }
            
            return {
                healthy: isHealthy,
                status: response.status,
                duration,
                response: response.data
            };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.prometheusMetrics.httpRequests
                .labels(endpoint.method, endpoint.path, 'error')
                .inc();
            
            this.logger.error(`エンドポイントエラー: ${endpoint.path}`, {
                error: error.message,
                duration
            });
            
            return {
                healthy: false,
                error: error.message,
                duration
            };
        }
    }

    // 詳細診断
    async runDetailedDiagnostics() {
        const diagnostics = {
            timestamp: new Date(),
            overallHealth: this.state.isHealthy,
            uptime: this.metrics.uptimePercentage,
            endpoints: {},
            systemInfo: await this.getSystemInfo(),
            performanceMetrics: this.getPerformanceMetrics()
        };
        
        // 各エンドポイントの診断
        for (const [path, state] of this.state.endpoints.entries()) {
            diagnostics.endpoints[path] = {
                healthy: state.isHealthy,
                consecutiveFailures: state.consecutiveFailures,
                lastCheck: state.lastCheck,
                responseTimeStats: this.calculateResponseTimeStats(state.responseTimeHistory),
                uptime: state.uptime,
                downtime: state.downtime,
                uptimePercentage: this.calculateEndpointUptime(state)
            };
            
            // 詳細テスト実行
            try {
                const detailedResult = await this.performDetailedEndpointTest(state);
                diagnostics.endpoints[path].detailedTest = detailedResult;
            } catch (error) {
                diagnostics.endpoints[path].detailedTest = { error: error.message };
            }
        }
        
        return diagnostics;
    }

    async performDetailedEndpointTest(endpointState) {
        const url = `${this.config.baseUrl}${endpointState.path}`;
        const tests = [];
        
        // 接続テスト
        const connectionTest = await this.testConnection(url);
        tests.push({ name: 'connection', ...connectionTest });
        
        // レスポンス時間テスト
        const performanceTest = await this.testPerformance(url, endpointState.method);
        tests.push({ name: 'performance', ...performanceTest });
        
        // ヘッダーテスト
        const headerTest = await this.testHeaders(url, endpointState.method);
        tests.push({ name: 'headers', ...headerTest });
        
        return {
            tests,
            summary: {
                passed: tests.filter(t => t.passed).length,
                failed: tests.filter(t => !t.passed).length,
                total: tests.length
            }
        };
    }

    async testConnection(url) {
        try {
            const startTime = Date.now();
            const response = await axios.head(url, { timeout: this.config.timeout });
            const duration = Date.now() - startTime;
            
            return {
                passed: response.status < 400,
                duration,
                status: response.status,
                message: 'Connection successful'
            };
        } catch (error) {
            return {
                passed: false,
                error: error.message,
                message: 'Connection failed'
            };
        }
    }

    async testPerformance(url, method) {
        const measurements = [];
        const testCount = 5;
        
        for (let i = 0; i < testCount; i++) {
            try {
                const startTime = Date.now();
                await axios({ method, url, timeout: this.config.timeout });
                measurements.push(Date.now() - startTime);
            } catch (error) {
                measurements.push(-1); // エラー時は-1
            }
            
            // 少し間隔を空ける
            if (i < testCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        const validMeasurements = measurements.filter(m => m > 0);
        const average = validMeasurements.length > 0 ? 
            validMeasurements.reduce((sum, m) => sum + m, 0) / validMeasurements.length : -1;
        
        return {
            passed: average > 0 && average < this.config.responseTimeThreshold,
            measurements,
            average,
            threshold: this.config.responseTimeThreshold,
            message: `Average response time: ${average}ms`
        };
    }

    async testHeaders(url, method) {
        try {
            const response = await axios({ method, url, timeout: this.config.timeout });
            const headers = response.headers;
            
            const expectedHeaders = ['content-type'];
            const missingHeaders = expectedHeaders.filter(header => !headers[header]);
            
            return {
                passed: missingHeaders.length === 0,
                headers: Object.keys(headers),
                missingHeaders,
                message: missingHeaders.length > 0 ? 
                    `Missing headers: ${missingHeaders.join(', ')}` : 
                    'All expected headers present'
            };
        } catch (error) {
            return {
                passed: false,
                error: error.message,
                message: 'Header test failed'
            };
        }
    }

    calculateResponseTimeStats(history) {
        if (history.length === 0) return null;
        
        const sorted = [...history].sort((a, b) => a - b);
        const sum = history.reduce((sum, time) => sum + time, 0);
        
        return {
            min: sorted[0],
            max: sorted[sorted.length - 1],
            average: sum / history.length,
            median: sorted[Math.floor(sorted.length / 2)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            count: history.length
        };
    }

    calculateEndpointUptime(state) {
        const total = state.uptime + state.downtime;
        return total > 0 ? (state.uptime / total) * 100 : 100;
    }

    async getSystemInfo() {
        try {
            const os = require('os');
            return {
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                uptime: os.uptime(),
                loadavg: os.loadavg(),
                totalmem: os.totalmem(),
                freemem: os.freemem(),
                cpus: os.cpus().length
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    getPerformanceMetrics() {
        return {
            totalChecks: this.metrics.totalChecks,
            successRate: this.metrics.totalChecks > 0 ? 
                (this.metrics.successfulChecks / this.metrics.totalChecks) * 100 : 0,
            averageResponseTime: this.metrics.averageResponseTime,
            uptime: this.metrics.uptimePercentage
        };
    }

    // 修復機能
    async attemptRepair() {
        this.logger.info('API修復試行開始');
        
        const repairResults = [];
        
        // レベル1: 基本ヘルスチェック再実行
        try {
            await this.performHealthCheck();
            if (this.state.isHealthy) {
                repairResults.push({ level: 1, method: 'health_recheck', success: true });
                return { success: true, results: repairResults };
            }
        } catch (error) {
            repairResults.push({ level: 1, method: 'health_recheck', success: false, error: error.message });
        }
        
        // レベル2: 各エンドポイントの個別確認
        let healthyEndpoints = 0;
        for (const [path, state] of this.state.endpoints.entries()) {
            try {
                const result = await this.checkEndpoint(state);
                if (result.healthy) {
                    healthyEndpoints++;
                }
                repairResults.push({ 
                    level: 2, 
                    method: `endpoint_check_${path}`, 
                    success: result.healthy,
                    details: result 
                });
            } catch (error) {
                repairResults.push({ 
                    level: 2, 
                    method: `endpoint_check_${path}`, 
                    success: false, 
                    error: error.message 
                });
            }
        }
        
        // 部分的回復の判定
        const totalEndpoints = this.config.endpoints.length;
        const partialRecovery = healthyEndpoints > 0 && healthyEndpoints < totalEndpoints;
        
        if (partialRecovery) {
            this.logger.info(`部分回復検出: ${healthyEndpoints}/${totalEndpoints} エンドポイントが正常`);
        }
        
        return { 
            success: healthyEndpoints > 0,
            partialRecovery,
            healthyEndpoints,
            totalEndpoints,
            results: repairResults 
        };
    }

    getStatus() {
        return {
            healthy: this.state.isHealthy,
            lastHealthCheck: this.state.lastHealthCheck,
            uptime: `${this.metrics.uptimePercentage.toFixed(2)}%`,
            averageResponseTime: `${this.metrics.averageResponseTime.toFixed(0)}ms`,
            totalChecks: this.metrics.totalChecks,
            successRate: `${((this.metrics.successfulChecks / this.metrics.totalChecks) * 100).toFixed(1)}%`,
            endpoints: Array.from(this.state.endpoints.entries()).map(([path, state]) => ({
                path,
                healthy: state.isHealthy,
                consecutiveFailures: state.consecutiveFailures,
                uptime: `${this.calculateEndpointUptime(state).toFixed(2)}%`,
                lastCheck: state.lastCheck
            }))
        };
    }

    async shutdown() {
        this.logger.info('API ヘルス監視停止開始');
        
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        this.logger.info('API ヘルス監視停止完了');
    }
}

module.exports = ApiHealthMonitor;