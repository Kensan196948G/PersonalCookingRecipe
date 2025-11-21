/**
 * エラー検知・自動修復システム - コアモジュール
 * PersonalCookingRecipe統合開発環境
 */

const EventEmitter = require('events');
const winston = require('winston');
const prometheus = require('prom-client');

class ErrorDetectionSystem extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // 基本設定
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000,
            healthCheckInterval: config.healthCheckInterval || 30000,
            memoryThreshold: config.memoryThreshold || 0.85,
            
            // 監視対象
            monitors: {
                database: config.monitors?.database !== false,
                redis: config.monitors?.redis !== false,
                api: config.monitors?.api !== false,
                memory: config.monitors?.memory !== false,
                ...config.monitors
            },
            
            // 通知設定
            alerts: {
                critical: true,
                warning: true,
                info: false,
                ...config.alerts
            },
            
            // 修復レベル設定
            autoRepair: {
                level1: true,  // 軽微な修復（接続リトライ等）
                level2: true,  // 中程度修復（プール再初期化等）
                level3: false, // 重要修復（サービス再起動等）
                ...config.autoRepair
            }
        };

        this.state = {
            isHealthy: true,
            lastHealthCheck: new Date(),
            errors: new Map(),
            repairs: new Map(),
            metrics: {
                totalErrors: 0,
                totalRepairs: 0,
                successfulRepairs: 0,
                failedRepairs: 0
            }
        };

        this.monitors = new Map();
        this.repairStrategies = new Map();
        this.healthChecks = new Map();

        // Winston Logger設定
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'error-detection-system' },
            transports: [
                new winston.transports.File({ 
                    filename: 'logs/error-detection-error.log', 
                    level: 'error' 
                }),
                new winston.transports.File({ 
                    filename: 'logs/error-detection-combined.log' 
                }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });

        // Prometheus メトリクス設定
        this.metrics = {
            systemHealth: new prometheus.Gauge({
                name: 'system_health_status',
                help: 'Overall system health status (1=healthy, 0=unhealthy)',
            }),
            errorCount: new prometheus.Counter({
                name: 'errors_total',
                help: 'Total number of errors detected',
                labelNames: ['type', 'severity']
            }),
            repairCount: new prometheus.Counter({
                name: 'repairs_total',
                help: 'Total number of repair attempts',
                labelNames: ['type', 'level', 'status']
            }),
            memoryUsage: new prometheus.Gauge({
                name: 'memory_usage_percentage',
                help: 'Current memory usage percentage',
            }),
            healthCheckDuration: new prometheus.Histogram({
                name: 'health_check_duration_seconds',
                help: 'Duration of health checks',
                labelNames: ['component']
            })
        };

        this.initialize();
    }

    async initialize() {
        this.logger.info('エラー検知システム初期化開始');

        // デフォルト監視モジュール登録
        this.registerDefaultMonitors();
        
        // デフォルト修復戦略登録
        this.registerDefaultRepairStrategies();
        
        // ヘルスチェック開始
        this.startHealthChecks();
        
        // メトリクス初期化
        this.metrics.systemHealth.set(1);

        this.logger.info('エラー検知システム初期化完了');
    }

    registerDefaultMonitors() {
        // データベース監視
        if (this.config.monitors.database) {
            this.registerMonitor('database', {
                name: 'PostgreSQL Database Monitor',
                check: async () => this.checkDatabaseHealth(),
                interval: 15000,
                severity: 'critical'
            });
        }

        // Redis監視
        if (this.config.monitors.redis) {
            this.registerMonitor('redis', {
                name: 'Redis Cache Monitor',
                check: async () => this.checkRedisHealth(),
                interval: 15000,
                severity: 'critical'
            });
        }

        // API監視
        if (this.config.monitors.api) {
            this.registerMonitor('api', {
                name: 'Express API Monitor',
                check: async () => this.checkApiHealth(),
                interval: 30000,
                severity: 'warning'
            });
        }

        // メモリ監視
        if (this.config.monitors.memory) {
            this.registerMonitor('memory', {
                name: 'Memory Usage Monitor',
                check: async () => this.checkMemoryHealth(),
                interval: 10000,
                severity: 'warning'
            });
        }
    }

    registerDefaultRepairStrategies() {
        // レベル1: 軽微な修復
        this.registerRepairStrategy('database_connection_retry', {
            level: 1,
            description: 'データベース接続リトライ',
            execute: async (error) => this.repairDatabaseConnection(error)
        });

        this.registerRepairStrategy('redis_connection_retry', {
            level: 1,
            description: 'Redis接続リトライ',
            execute: async (error) => this.repairRedisConnection(error)
        });

        // レベル2: 中程度修復
        this.registerRepairStrategy('database_pool_reinit', {
            level: 2,
            description: 'データベースプール再初期化',
            execute: async (error) => this.reinitializeDatabasePool(error)
        });

        this.registerRepairStrategy('redis_client_reset', {
            level: 2,
            description: 'Redisクライアントリセット',
            execute: async (error) => this.resetRedisClient(error)
        });

        // レベル3: 重要修復
        this.registerRepairStrategy('memory_gc_force', {
            level: 3,
            description: '強制ガベージコレクション実行',
            execute: async (error) => this.forceGarbageCollection(error)
        });

        this.registerRepairStrategy('service_restart', {
            level: 3,
            description: 'サービス再起動',
            execute: async (error) => this.restartService(error)
        });
    }

    registerMonitor(id, config) {
        const monitor = {
            id,
            name: config.name,
            check: config.check,
            interval: config.interval || 30000,
            severity: config.severity || 'warning',
            enabled: true,
            lastCheck: null,
            consecutiveFailures: 0,
            timer: null
        };

        this.monitors.set(id, monitor);
        this.startMonitor(id);
        
        this.logger.info(`監視モジュール登録: ${monitor.name} (${id})`);
    }

    registerRepairStrategy(id, strategy) {
        this.repairStrategies.set(id, {
            id,
            level: strategy.level,
            description: strategy.description,
            execute: strategy.execute,
            enabled: this.config.autoRepair[`level${strategy.level}`] || false
        });

        this.logger.info(`修復戦略登録: ${strategy.description} (Level ${strategy.level})`);
    }

    startMonitor(id) {
        const monitor = this.monitors.get(id);
        if (!monitor || monitor.timer) return;

        monitor.timer = setInterval(async () => {
            if (!monitor.enabled) return;

            try {
                const start = Date.now();
                const result = await monitor.check();
                const duration = (Date.now() - start) / 1000;

                // メトリクス記録
                this.metrics.healthCheckDuration
                    .labels(monitor.id)
                    .observe(duration);

                monitor.lastCheck = new Date();

                if (result.healthy) {
                    monitor.consecutiveFailures = 0;
                } else {
                    monitor.consecutiveFailures++;
                    await this.handleError({
                        type: monitor.id,
                        severity: monitor.severity,
                        message: result.message || `${monitor.name} health check failed`,
                        details: result.details,
                        consecutiveFailures: monitor.consecutiveFailures
                    });
                }
            } catch (error) {
                monitor.consecutiveFailures++;
                await this.handleError({
                    type: monitor.id,
                    severity: 'critical',
                    message: `${monitor.name} check threw exception`,
                    error: error,
                    consecutiveFailures: monitor.consecutiveFailures
                });
            }
        }, monitor.interval);

        this.logger.info(`監視開始: ${monitor.name}`);
    }

    async handleError(errorInfo) {
        const errorKey = `${errorInfo.type}_${Date.now()}`;
        this.state.errors.set(errorKey, {
            ...errorInfo,
            timestamp: new Date(),
            resolved: false
        });

        this.state.metrics.totalErrors++;

        // メトリクス記録
        this.metrics.errorCount
            .labels(errorInfo.type, errorInfo.severity)
            .inc();

        // ログ記録
        this.logger.error('エラー検出', {
            type: errorInfo.type,
            severity: errorInfo.severity,
            message: errorInfo.message,
            consecutiveFailures: errorInfo.consecutiveFailures
        });

        // アラート送信
        if (this.shouldSendAlert(errorInfo)) {
            await this.sendAlert(errorInfo);
        }

        // 自動修復試行
        if (this.shouldAttemptRepair(errorInfo)) {
            await this.attemptRepair(errorInfo);
        }

        // イベント発行
        this.emit('error', errorInfo);

        // システム状態更新
        this.updateSystemHealth();
    }

    shouldSendAlert(errorInfo) {
        const severity = errorInfo.severity;
        return this.config.alerts[severity] || false;
    }

    shouldAttemptRepair(errorInfo) {
        // 連続失敗回数による判定
        const maxConsecutiveFailures = {
            critical: 1,
            warning: 2,
            info: 3
        };

        return errorInfo.consecutiveFailures >= 
               (maxConsecutiveFailures[errorInfo.severity] || 3);
    }

    async attemptRepair(errorInfo) {
        const repairKey = `${errorInfo.type}_repair_${Date.now()}`;
        
        // 適用可能な修復戦略を検索
        const applicableStrategies = this.findRepairStrategies(errorInfo);
        
        if (applicableStrategies.length === 0) {
            this.logger.warn(`修復戦略が見つかりません: ${errorInfo.type}`);
            return;
        }

        // レベル順でソート
        applicableStrategies.sort((a, b) => a.level - b.level);

        for (const strategy of applicableStrategies) {
            if (!strategy.enabled) continue;

            try {
                this.logger.info(`修復試行開始: ${strategy.description}`);
                
                const repairInfo = {
                    strategy: strategy.id,
                    level: strategy.level,
                    startTime: new Date(),
                    errorInfo
                };

                this.state.repairs.set(repairKey, repairInfo);
                this.state.metrics.totalRepairs++;

                // 修復実行
                const result = await strategy.execute(errorInfo);

                if (result.success) {
                    repairInfo.success = true;
                    repairInfo.endTime = new Date();
                    this.state.metrics.successfulRepairs++;

                    // メトリクス記録
                    this.metrics.repairCount
                        .labels(strategy.id, strategy.level, 'success')
                        .inc();

                    this.logger.info(`修復成功: ${strategy.description}`);
                    
                    // 成功アラート送信
                    await this.sendRepairSuccessAlert(repairInfo);
                    
                    break; // 成功したら停止
                } else {
                    throw new Error(result.error || '修復失敗');
                }

            } catch (repairError) {
                const repairInfo = this.state.repairs.get(repairKey);
                if (repairInfo) {
                    repairInfo.success = false;
                    repairInfo.error = repairError;
                    repairInfo.endTime = new Date();
                }

                this.state.metrics.failedRepairs++;

                // メトリクス記録
                this.metrics.repairCount
                    .labels(strategy.id, strategy.level, 'failed')
                    .inc();

                this.logger.error(`修復失敗: ${strategy.description}`, repairError);

                // レベル3修復失敗の場合はエスカレーション
                if (strategy.level === 3) {
                    await this.escalateToHuman(errorInfo, repairError);
                }
            }
        }
    }

    findRepairStrategies(errorInfo) {
        const strategies = [];
        
        for (const [id, strategy] of this.repairStrategies.entries()) {
            // エラータイプと戦略の関連性をチェック
            if (this.isStrategyApplicable(strategy, errorInfo)) {
                strategies.push(strategy);
            }
        }

        return strategies;
    }

    isStrategyApplicable(strategy, errorInfo) {
        // 戦略IDとエラータイプの関連性チェック
        const typeMap = {
            database: ['database_connection_retry', 'database_pool_reinit'],
            redis: ['redis_connection_retry', 'redis_client_reset'],
            memory: ['memory_gc_force'],
            api: ['service_restart']
        };

        const applicableStrategies = typeMap[errorInfo.type] || [];
        return applicableStrategies.includes(strategy.id) || 
               strategy.id === 'service_restart'; // service_restartは全エラーに適用可能
    }

    async sendAlert(errorInfo) {
        // TODO: メール/Slack/Discord通知実装
        console.log(`🚨 ALERT [${errorInfo.severity.toUpperCase()}]: ${errorInfo.message}`);
    }

    async sendRepairSuccessAlert(repairInfo) {
        console.log(`✅ REPAIR SUCCESS: ${repairInfo.strategy} completed successfully`);
    }

    async escalateToHuman(errorInfo, repairError) {
        const escalationMessage = `
🆘 HUMAN INTERVENTION REQUIRED 🆘
Error Type: ${errorInfo.type}
Severity: ${errorInfo.severity}
Message: ${errorInfo.message}
Auto-repair failed: ${repairError.message}
Time: ${new Date().toISOString()}
        `;
        
        this.logger.error('エスカレーション: 人的介入が必要', {
            errorInfo,
            repairError: repairError.message
        });
        
        // TODO: 緊急通知システム実装
        console.log(escalationMessage);
    }

    updateSystemHealth() {
        const criticalErrors = Array.from(this.state.errors.values())
            .filter(error => error.severity === 'critical' && !error.resolved);
        
        const isHealthy = criticalErrors.length === 0;
        this.state.isHealthy = isHealthy;
        this.state.lastHealthCheck = new Date();

        this.metrics.systemHealth.set(isHealthy ? 1 : 0);

        if (!isHealthy) {
            this.logger.warn(`システム異常: ${criticalErrors.length}件のクリティカルエラー`);
        }
    }

    startHealthChecks() {
        // 定期的な全体ヘルスチェック
        setInterval(() => {
            this.updateSystemHealth();
            
            // メモリメトリクス更新
            const memUsage = process.memoryUsage();
            const memPercent = memUsage.heapUsed / memUsage.heapTotal;
            this.metrics.memoryUsage.set(memPercent);
            
        }, this.config.healthCheckInterval);
    }

    // ヘルスチェック実装メソッド群
    async checkDatabaseHealth() {
        // TODO: 実際のDB接続チェック実装
        try {
            // PostgreSQL接続テスト
            return { healthy: true };
        } catch (error) {
            return { 
                healthy: false, 
                message: 'Database connection failed',
                details: error.message 
            };
        }
    }

    async checkRedisHealth() {
        // TODO: 実際のRedis接続チェック実装
        try {
            // Redis ping テスト
            return { healthy: true };
        } catch (error) {
            return { 
                healthy: false, 
                message: 'Redis connection failed',
                details: error.message 
            };
        }
    }

    async checkApiHealth() {
        // Express サーバーヘルスチェック
        return { healthy: true };
    }

    async checkMemoryHealth() {
        const memUsage = process.memoryUsage();
        const memPercent = memUsage.heapUsed / memUsage.heapTotal;
        
        if (memPercent > this.config.memoryThreshold) {
            return { 
                healthy: false, 
                message: `High memory usage: ${(memPercent * 100).toFixed(1)}%`,
                details: { memUsage, threshold: this.config.memoryThreshold }
            };
        }

        return { healthy: true };
    }

    // 修復戦略実装メソッド群
    async repairDatabaseConnection(error) {
        // TODO: 実際のDB接続修復実装
        return { success: true };
    }

    async repairRedisConnection(error) {
        // TODO: 実際のRedis接続修復実装
        return { success: true };
    }

    async reinitializeDatabasePool(error) {
        // TODO: 実際のDBプール再初期化実装
        return { success: true };
    }

    async resetRedisClient(error) {
        // TODO: 実際のRedisクライアントリセット実装
        return { success: true };
    }

    async forceGarbageCollection(error) {
        try {
            if (global.gc) {
                global.gc();
                this.logger.info('強制ガベージコレクション実行完了');
                return { success: true };
            } else {
                throw new Error('GC not available (start Node with --expose-gc)');
            }
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async restartService(error) {
        // TODO: サービス再起動実装
        // 本番環境では慎重に実装する必要がある
        this.logger.warn('サービス再起動が要求されましたが、実装されていません');
        return { success: false, error: 'Service restart not implemented' };
    }

    // 公開API
    getStatus() {
        return {
            healthy: this.state.isHealthy,
            lastHealthCheck: this.state.lastHealthCheck,
            metrics: this.state.metrics,
            monitors: Array.from(this.monitors.entries()).map(([id, monitor]) => ({
                id,
                name: monitor.name,
                enabled: monitor.enabled,
                lastCheck: monitor.lastCheck,
                consecutiveFailures: monitor.consecutiveFailures
            })),
            activeErrors: this.state.errors.size,
            activeRepairs: this.state.repairs.size
        };
    }

    async shutdown() {
        this.logger.info('エラー検知システム停止開始');
        
        // 全監視停止
        for (const monitor of this.monitors.values()) {
            if (monitor.timer) {
                clearInterval(monitor.timer);
                monitor.timer = null;
            }
        }

        this.logger.info('エラー検知システム停止完了');
    }
}

module.exports = ErrorDetectionSystem;