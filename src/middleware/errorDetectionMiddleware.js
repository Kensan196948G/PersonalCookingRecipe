/**
 * Express エラー検知統合ミドルウェア
 * PersonalCookingRecipe統合開発環境
 */

const ErrorDetectionSystem = require('../monitoring/ErrorDetectionSystem');
const DatabaseMonitor = require('../monitoring/DatabaseMonitor');
const RedisMonitor = require('../monitoring/RedisMonitor');
const MemoryMonitor = require('../monitoring/MemoryMonitor');
const ApiHealthMonitor = require('../monitoring/ApiHealthMonitor');
const AlertSystem = require('../monitoring/AlertSystem');

class ErrorDetectionMiddleware {
    constructor(config = {}) {
        this.config = {
            // システム設定
            enabled: config.enabled !== false,
            healthCheckPath: config.healthCheckPath || '/api/health/monitoring',
            metricsPath: config.metricsPath || '/api/metrics',
            
            // 監視設定
            monitors: {
                database: config.monitors?.database !== false,
                redis: config.monitors?.redis !== false,
                memory: config.monitors?.memory !== false,
                api: config.monitors?.api !== false,
                ...config.monitors
            },
            
            // アラート設定
            alerts: {
                console: { enabled: true },
                email: { enabled: false },
                slack: { enabled: false },
                discord: { enabled: false },
                ...config.alerts
            },
            
            // Express統合設定
            requestTracking: config.requestTracking !== false,
            errorCapture: config.errorCapture !== false,
            responseTimeTracking: config.responseTimeTracking !== false,
            
            ...config
        };

        this.systems = {};
        this.initialized = false;
        this.healthStatus = {
            overall: true,
            systems: {},
            lastCheck: null
        };
    }

    async initialize() {
        if (this.initialized) return;
        
        console.log('🔧 エラー検知ミドルウェア初期化開始...');
        
        try {
            // アラートシステム初期化
            this.systems.alertSystem = new AlertSystem(this.config.alerts);
            await this.systems.alertSystem.initialize();
            
            // メインエラー検知システム初期化
            this.systems.errorDetection = new ErrorDetectionSystem({
                monitors: this.config.monitors,
                alerts: this.config.alerts,
                autoRepair: {
                    level1: true,
                    level2: true,
                    level3: false // Express環境では慎重に
                }
            });
            
            // 個別監視システム初期化
            if (this.config.monitors.database) {
                this.systems.database = new DatabaseMonitor();
                await this.systems.database.initialize();
            }
            
            if (this.config.monitors.redis) {
                this.systems.redis = new RedisMonitor();
                await this.systems.redis.initialize();
            }
            
            if (this.config.monitors.memory) {
                this.systems.memory = new MemoryMonitor({
                    autoGcEnabled: true,
                    leakThreshold: 0.85,
                    criticalThreshold: 0.95
                });
                await this.systems.memory.initialize();
            }
            
            if (this.config.monitors.api) {
                this.systems.api = new ApiHealthMonitor({
                    baseUrl: `http://localhost:${process.env.BACKEND_PORT || 5000}`,
                    endpoints: [
                        { path: '/api/health', method: 'GET', critical: true },
                        { path: '/api/recipes', method: 'GET', critical: false },
                        { path: '/api/categories', method: 'GET', critical: false }
                    ]
                });
                await this.systems.api.initialize();
            }
            
            // イベントリスナー設定
            this.setupEventListeners();
            
            this.initialized = true;
            console.log('✅ エラー検知ミドルウェア初期化完了');
            
            // 初期化完了通知
            await this.systems.alertSystem.sendAlert({
                title: 'エラー検知システム起動',
                message: 'PersonalCookingRecipe エラー検知・自動修復システムが正常に起動しました',
                severity: 'info',
                source: 'system',
                details: {
                    enabledMonitors: Object.entries(this.config.monitors)
                        .filter(([_, enabled]) => enabled)
                        .map(([name]) => name),
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('❌ エラー検知ミドルウェア初期化失敗:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // エラー検知システムのイベント
        if (this.systems.errorDetection) {
            this.systems.errorDetection.on('error', async (errorInfo) => {
                await this.handleSystemError('errorDetection', errorInfo);
            });
        }
        
        // メモリ監視イベント
        if (this.systems.memory) {
            this.systems.memory.on('memoryLeak', async (memoryData) => {
                await this.systems.alertSystem.sendAlert({
                    title: 'メモリリーク検出',
                    message: `メモリ使用量が閾値を超過しました: ${(memoryData.usagePercent * 100).toFixed(1)}%`,
                    severity: 'warning',
                    source: 'memory',
                    details: memoryData,
                    recommendations: [
                        'アプリケーションの再起動を検討してください',
                        'メモリ使用量の多いプロセスを確認してください'
                    ]
                });
            });
            
            this.systems.memory.on('criticalMemory', async (memoryData) => {
                await this.systems.alertSystem.sendAlert({
                    title: '緊急: メモリ枯渇警告',
                    message: `メモリ使用量が緊急レベルに到達: ${(memoryData.usagePercent * 100).toFixed(1)}%`,
                    severity: 'critical',
                    source: 'memory',
                    details: memoryData,
                    recommendations: [
                        '即座にアプリケーションを再起動してください',
                        'システム管理者に連絡してください'
                    ]
                });
            });
        }
        
        // プロセス終了時のクリーンアップ
        process.on('SIGTERM', async () => {
            await this.shutdown();
            process.exit(0);
        });
        
        process.on('SIGINT', async () => {
            await this.shutdown();
            process.exit(0);
        });
    }

    async handleSystemError(systemName, errorInfo) {
        this.healthStatus.systems[systemName] = false;
        this.updateOverallHealth();
        
        await this.systems.alertSystem.sendAlert({
            title: `システムエラー: ${systemName}`,
            message: errorInfo.message,
            severity: errorInfo.severity || 'warning',
            source: systemName,
            details: errorInfo,
            recommendations: this.getRecommendations(systemName, errorInfo)
        });
    }

    getRecommendations(systemName, errorInfo) {
        const recommendations = {
            database: [
                'データベース接続を確認してください',
                'PostgreSQL サービスの状態を確認してください',
                '必要に応じてコネクションプールをリセットしてください'
            ],
            redis: [
                'Redis サーバーの状態を確認してください',
                'Redis 接続設定を確認してください',
                'キャッシュのクリアを検討してください'
            ],
            memory: [
                'メモリ使用量を確認してください',
                '不要なプロセスを終了してください',
                'アプリケーションの再起動を検討してください'
            ],
            api: [
                'API エンドポイントの応答を確認してください',
                'サーバーの負荷状況を確認してください',
                'ログを確認してエラーの詳細を調べてください'
            ]
        };
        
        return recommendations[systemName] || [
            'システム管理者に連絡してください',
            'ログを確認してください'
        ];
    }

    updateOverallHealth() {
        const systemStatuses = Object.values(this.healthStatus.systems);
        this.healthStatus.overall = systemStatuses.length === 0 || 
                                   systemStatuses.some(status => status === true);
        this.healthStatus.lastCheck = new Date();
    }

    // Express ミドルウェア関数群

    // リクエスト追跡ミドルウェア
    requestTracker() {
        if (!this.config.requestTracking) {
            return (req, res, next) => next();
        }
        
        return (req, res, next) => {
            req.startTime = Date.now();
            req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // レスポンス終了時の処理
            res.on('finish', () => {
                const duration = Date.now() - req.startTime;
                const statusCode = res.statusCode;
                
                // エラーレスポンスの監視
                if (statusCode >= 500) {
                    this.handleHttpError(req, res, {
                        statusCode,
                        duration,
                        url: req.originalUrl,
                        method: req.method
                    });
                }
                
                // レスポンス時間の監視
                if (this.config.responseTimeTracking && duration > 5000) {
                    this.handleSlowResponse(req, res, duration);
                }
            });
            
            next();
        };
    }

    // エラーキャプチャミドルウェア
    errorCapture() {
        if (!this.config.errorCapture) {
            return (error, req, res, next) => next(error);
        }
        
        return async (error, req, res, next) => {
            // エラー情報を収集
            const errorInfo = {
                message: error.message,
                stack: error.stack,
                requestId: req.requestId,
                url: req.originalUrl,
                method: req.method,
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                timestamp: new Date()
            };
            
            // システムエラーとして通知
            await this.systems.alertSystem.sendAlert({
                title: 'アプリケーションエラー',
                message: `${req.method} ${req.originalUrl}: ${error.message}`,
                severity: 'warning',
                source: 'application',
                details: errorInfo,
                recommendations: [
                    'エラーログを確認してください',
                    '該当するエンドポイントの実装を確認してください'
                ]
            });
            
            next(error);
        };
    }

    // ヘルスチェックエンドポイント
    healthCheckEndpoint() {
        return async (req, res) => {
            try {
                const healthData = await this.getHealthStatus();
                
                res.status(healthData.overall ? 200 : 503).json(healthData);
                
            } catch (error) {
                res.status(500).json({
                    overall: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        };
    }

    // メトリクスエンドポイント  
    metricsEndpoint() {
        return async (req, res) => {
            try {
                const prometheus = require('prom-client');
                const metrics = await prometheus.register.metrics();
                
                res.set('Content-Type', prometheus.register.contentType);
                res.end(metrics);
                
            } catch (error) {
                res.status(500).json({
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        };
    }

    async handleHttpError(req, res, errorData) {
        await this.systems.alertSystem.sendAlert({
            title: 'HTTP エラー',
            message: `${errorData.method} ${errorData.url} returned ${errorData.statusCode}`,
            severity: errorData.statusCode >= 500 ? 'warning' : 'info',
            source: 'http',
            details: {
                ...errorData,
                requestId: req.requestId
            }
        });
    }

    async handleSlowResponse(req, res, duration) {
        await this.systems.alertSystem.sendAlert({
            title: 'レスポンス時間警告',
            message: `${req.method} ${req.originalUrl} took ${duration}ms to respond`,
            severity: 'warning',
            source: 'performance',
            details: {
                url: req.originalUrl,
                method: req.method,
                duration,
                requestId: req.requestId
            },
            recommendations: [
                'エンドポイントのパフォーマンスを確認してください',
                'データベースクエリを最適化してください'
            ]
        });
    }

    async getHealthStatus() {
        const health = {
            overall: true,
            timestamp: new Date().toISOString(),
            systems: {},
            uptime: process.uptime(),
            memory: process.memoryUsage()
        };
        
        // 各システムのヘルス状態収集
        for (const [name, system] of Object.entries(this.systems)) {
            if (system && typeof system.getStatus === 'function') {
                try {
                    health.systems[name] = await system.getStatus();
                    if (!health.systems[name].healthy) {
                        health.overall = false;
                    }
                } catch (error) {
                    health.systems[name] = {
                        healthy: false,
                        error: error.message
                    };
                    health.overall = false;
                }
            }
        }
        
        return health;
    }

    // Express アプリケーションへの統合
    integrate(app) {
        if (!this.config.enabled) {
            console.log('⚠️ エラー検知システムは無効化されています');
            return;
        }
        
        console.log('🔗 Express アプリケーションと統合中...');
        
        // ミドルウェア登録
        app.use(this.requestTracker());
        
        // ヘルスチェックエンドポイント
        app.get(this.config.healthCheckPath, this.healthCheckEndpoint());
        
        // メトリクスエンドポイント
        app.get(this.config.metricsPath, this.metricsEndpoint());
        
        // エラーキャプチャミドルウェア（最後に登録）
        app.use(this.errorCapture());
        
        console.log('✅ Express統合完了');
        console.log(`📊 ヘルスチェック: ${this.config.healthCheckPath}`);
        console.log(`📈 メトリクス: ${this.config.metricsPath}`);
    }

    async shutdown() {
        console.log('🔧 エラー検知システム停止開始...');
        
        for (const [name, system] of Object.entries(this.systems)) {
            if (system && typeof system.shutdown === 'function') {
                try {
                    await system.shutdown();
                    console.log(`✅ ${name} 停止完了`);
                } catch (error) {
                    console.error(`❌ ${name} 停止エラー:`, error);
                }
            }
        }
        
        console.log('✅ エラー検知システム停止完了');
    }

    // 診断機能
    async runDiagnostics() {
        const diagnostics = {
            timestamp: new Date(),
            system: 'ErrorDetectionMiddleware',
            initialized: this.initialized,
            config: this.config,
            health: await this.getHealthStatus(),
            systems: {}
        };
        
        // 各システムの詳細診断
        for (const [name, system] of Object.entries(this.systems)) {
            if (system && typeof system.runDiagnostics === 'function') {
                try {
                    diagnostics.systems[name] = await system.runDiagnostics();
                } catch (error) {
                    diagnostics.systems[name] = { error: error.message };
                }
            }
        }
        
        return diagnostics;
    }
}

module.exports = ErrorDetectionMiddleware;