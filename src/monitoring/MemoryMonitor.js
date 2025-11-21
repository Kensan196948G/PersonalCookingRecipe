/**
 * メモリ使用量監視・リーク検出モジュール
 * PersonalCookingRecipe統合開発環境
 */

const EventEmitter = require('events');
const winston = require('winston');
const prometheus = require('prom-client');

class MemoryMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // 監視設定
            checkInterval: config.checkInterval || 10000, // 10秒間隔
            leakThreshold: config.leakThreshold || 0.85, // 85%でリーク警告
            criticalThreshold: config.criticalThreshold || 0.95, // 95%で緊急
            
            // GC設定
            autoGcEnabled: config.autoGcEnabled || true,
            gcThreshold: config.gcThreshold || 0.80, // 80%で自動GC
            forceGcThreshold: config.forceGcThreshold || 0.90, // 90%で強制GC
            
            // 履歴管理
            historyLength: config.historyLength || 100, // 100回分の履歴保持
            trendAnalysisLength: config.trendAnalysisLength || 20, // 20回分でトレンド分析
            
            // アラート設定
            alertCooldown: config.alertCooldown || 60000, // 1分間のクールダウン
            ...config
        };

        this.state = {
            isHealthy: true,
            currentUsage: 0,
            lastGcTime: null,
            memoryHistory: [],
            leakSuspected: false,
            criticalState: false,
            lastAlert: null
        };

        this.metrics = {
            totalChecks: 0,
            leaksDetected: 0,
            gcExecutions: 0,
            forceGcExecutions: 0,
            peakMemoryUsage: 0,
            averageMemoryUsage: 0
        };

        this.timer = null;
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'memory-monitor' },
            transports: [
                new winston.transports.File({ 
                    filename: 'logs/memory-monitor.log' 
                }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });

        // Prometheus メトリクス
        this.prometheusMetrics = {
            memoryUsage: new prometheus.Gauge({
                name: 'memory_usage_bytes',
                help: 'Current memory usage in bytes',
                labelNames: ['type']
            }),
            memoryUsagePercent: new prometheus.Gauge({
                name: 'memory_usage_percentage',
                help: 'Current memory usage percentage'
            }),
            gcExecutions: new prometheus.Counter({
                name: 'gc_executions_total',
                help: 'Total number of garbage collections',
                labelNames: ['type']
            }),
            memoryLeaksDetected: new prometheus.Counter({
                name: 'memory_leaks_detected_total',
                help: 'Total number of memory leaks detected'
            })
        };

        this.initialize();
    }

    async initialize() {
        this.logger.info('メモリ監視システム初期化開始');
        
        // 初回メモリチェック
        await this.checkMemoryUsage();
        
        // 定期監視開始
        this.startMonitoring();
        
        // Node.js GCイベントリスナー設定（可能な場合）
        this.setupGcListeners();
        
        this.logger.info('メモリ監視システム初期化完了');
    }

    setupGcListeners() {
        // パフォーマンス監視フック（Node.js v8.5+）
        try {
            const { PerformanceObserver, performance } = require('perf_hooks');
            
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    if (entry.entryType === 'gc') {
                        this.handleGcEvent(entry);
                    }
                });
            });
            
            observer.observe({ entryTypes: ['gc'] });
            this.logger.info('GCイベントリスナー設定完了');
            
        } catch (error) {
            this.logger.warn('GCイベントリスナー設定失敗（Node.js v8.5+が必要）', error);
        }
    }

    handleGcEvent(entry) {
        this.metrics.gcExecutions++;
        this.state.lastGcTime = new Date();
        
        this.prometheusMetrics.gcExecutions
            .labels(entry.kind || 'unknown')
            .inc();
        
        this.logger.debug('GCイベント検出', {
            kind: entry.kind,
            duration: entry.duration,
            startTime: entry.startTime
        });
    }

    startMonitoring() {
        if (this.timer) {
            clearInterval(this.timer);
        }

        this.timer = setInterval(async () => {
            await this.checkMemoryUsage();
        }, this.config.checkInterval);

        this.logger.info(`メモリ監視開始（間隔: ${this.config.checkInterval}ms）`);
    }

    async checkMemoryUsage() {
        try {
            const memoryData = this.getDetailedMemoryUsage();
            this.metrics.totalChecks++;
            
            // 現在の使用率計算
            this.state.currentUsage = memoryData.usagePercent;
            
            // 履歴に追加
            this.addToHistory(memoryData);
            
            // メトリクス更新
            this.updateMetrics(memoryData);
            
            // 閾値チェック
            await this.checkThresholds(memoryData);
            
            // トレンド分析
            await this.analyzeTrends();
            
            // ヘルス状態更新
            this.updateHealthStatus();

        } catch (error) {
            this.logger.error('メモリ使用量チェックエラー', error);
            this.state.isHealthy = false;
        }
    }

    getDetailedMemoryUsage() {
        const memoryUsage = process.memoryUsage();
        const totalMemory = require('os').totalmem();
        const freeMemory = require('os').freemem();
        const usedSystemMemory = totalMemory - freeMemory;
        
        const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        const systemUsagePercent = (usedSystemMemory / totalMemory) * 100;
        const processUsagePercent = (memoryUsage.rss / totalMemory) * 100;
        
        return {
            timestamp: new Date(),
            heap: {
                used: memoryUsage.heapUsed,
                total: memoryUsage.heapTotal,
                percent: heapUsedPercent
            },
            system: {
                total: totalMemory,
                free: freeMemory,
                used: usedSystemMemory,
                percent: systemUsagePercent
            },
            process: {
                rss: memoryUsage.rss,
                external: memoryUsage.external,
                arrayBuffers: memoryUsage.arrayBuffers,
                percent: processUsagePercent
            },
            usagePercent: Math.max(heapUsedPercent, processUsagePercent) / 100 // 正規化
        };
    }

    addToHistory(memoryData) {
        this.state.memoryHistory.push(memoryData);
        
        // 履歴長制限
        if (this.state.memoryHistory.length > this.config.historyLength) {
            this.state.memoryHistory.shift();
        }
    }

    updateMetrics(memoryData) {
        // ピーク更新
        if (memoryData.usagePercent > this.metrics.peakMemoryUsage) {
            this.metrics.peakMemoryUsage = memoryData.usagePercent;
        }
        
        // 平均計算
        const totalUsage = this.state.memoryHistory.reduce((sum, data) => sum + data.usagePercent, 0);
        this.metrics.averageMemoryUsage = totalUsage / this.state.memoryHistory.length;
        
        // Prometheusメトリクス更新
        this.prometheusMetrics.memoryUsage.labels('heap_used').set(memoryData.heap.used);
        this.prometheusMetrics.memoryUsage.labels('heap_total').set(memoryData.heap.total);
        this.prometheusMetrics.memoryUsage.labels('rss').set(memoryData.process.rss);
        this.prometheusMetrics.memoryUsage.labels('external').set(memoryData.process.external);
        
        this.prometheusMetrics.memoryUsagePercent.set(memoryData.usagePercent);
    }

    async checkThresholds(memoryData) {
        const usage = memoryData.usagePercent;
        
        // 緊急閾値チェック
        if (usage >= this.config.criticalThreshold) {
            if (!this.state.criticalState) {
                this.state.criticalState = true;
                await this.handleCriticalMemory(memoryData);
            }
        } else {
            this.state.criticalState = false;
        }
        
        // リーク閾値チェック
        if (usage >= this.config.leakThreshold) {
            if (!this.state.leakSuspected) {
                this.state.leakSuspected = true;
                await this.handleMemoryLeak(memoryData);
            }
        } else {
            this.state.leakSuspected = false;
        }
        
        // 自動GC閾値チェック
        if (this.config.autoGcEnabled) {
            if (usage >= this.config.forceGcThreshold) {
                await this.executeForceGarbageCollection();
            } else if (usage >= this.config.gcThreshold) {
                await this.executeGarbageCollection();
            }
        }
    }

    async analyzeTrends() {
        if (this.state.memoryHistory.length < this.config.trendAnalysisLength) {
            return;
        }
        
        const recentHistory = this.state.memoryHistory.slice(-this.config.trendAnalysisLength);
        const trend = this.calculateTrend(recentHistory);
        
        // 急激な増加を検出
        if (trend.slope > 0.05) { // 5%以上の増加傾向
            await this.handleMemoryTrendAlert(trend);
        }
    }

    calculateTrend(history) {
        const n = history.length;
        if (n < 2) return { slope: 0, correlation: 0 };
        
        const xValues = history.map((_, index) => index);
        const yValues = history.map(data => data.usagePercent);
        
        const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
        const yMean = yValues.reduce((sum, y) => sum + y, 0) / n;
        
        const numerator = xValues.reduce((sum, x, i) => sum + (x - xMean) * (yValues[i] - yMean), 0);
        const denominator = xValues.reduce((sum, x) => sum + Math.pow(x - xMean, 2), 0);
        
        const slope = denominator !== 0 ? numerator / denominator : 0;
        
        // 相関係数計算
        const yVariance = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
        const correlation = yVariance !== 0 ? Math.abs(numerator / Math.sqrt(denominator * yVariance)) : 0;
        
        return { slope, correlation, trend: slope > 0 ? 'increasing' : 'decreasing' };
    }

    async handleCriticalMemory(memoryData) {
        this.logger.error('緊急: メモリ使用量が臨界値に到達', {
            currentUsage: `${(memoryData.usagePercent * 100).toFixed(1)}%`,
            threshold: `${(this.config.criticalThreshold * 100).toFixed(1)}%`
        });
        
        await this.sendAlert('critical', 'メモリ使用量が臨界値に到達しました', memoryData);
        await this.executeEmergencyGarbageCollection();
        
        this.emit('criticalMemory', memoryData);
    }

    async handleMemoryLeak(memoryData) {
        this.metrics.leaksDetected++;
        this.prometheusMetrics.memoryLeaksDetected.inc();
        
        this.logger.warn('メモリリーク疑い検出', {
            currentUsage: `${(memoryData.usagePercent * 100).toFixed(1)}%`,
            threshold: `${(this.config.leakThreshold * 100).toFixed(1)}%`
        });
        
        await this.sendAlert('warning', 'メモリリークの疑いが検出されました', memoryData);
        
        this.emit('memoryLeak', memoryData);
    }

    async handleMemoryTrendAlert(trend) {
        this.logger.warn('メモリ使用量増加トレンド検出', {
            slope: trend.slope,
            correlation: trend.correlation,
            trend: trend.trend
        });
        
        await this.sendAlert('warning', 'メモリ使用量の急激な増加が検出されました', trend);
    }

    async executeGarbageCollection() {
        if (!global.gc) {
            this.logger.warn('GC関数が利用できません（--expose-gcフラグが必要）');
            return { success: false, reason: 'gc_not_exposed' };
        }
        
        try {
            const beforeMemory = process.memoryUsage();
            global.gc();
            const afterMemory = process.memoryUsage();
            
            this.metrics.gcExecutions++;
            this.prometheusMetrics.gcExecutions.labels('manual').inc();
            
            const memoryFreed = beforeMemory.heapUsed - afterMemory.heapUsed;
            
            this.logger.info('ガベージコレクション実行完了', {
                memoryFreed: `${(memoryFreed / 1024 / 1024).toFixed(2)}MB`,
                beforeHeap: `${(beforeMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
                afterHeap: `${(afterMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`
            });
            
            return { success: true, memoryFreed };
            
        } catch (error) {
            this.logger.error('ガベージコレクション実行エラー', error);
            return { success: false, error: error.message };
        }
    }

    async executeForceGarbageCollection() {
        this.metrics.forceGcExecutions++;
        this.prometheusMetrics.gcExecutions.labels('force').inc();
        
        this.logger.warn('強制ガベージコレクション実行');
        
        const result = await this.executeGarbageCollection();
        
        if (result.success) {
            this.logger.info('強制ガベージコレクション成功');
        } else {
            this.logger.error('強制ガベージコレクション失敗');
        }
        
        return result;
    }

    async executeEmergencyGarbageCollection() {
        this.logger.error('緊急ガベージコレクション実行');
        
        // 複数回実行
        for (let i = 0; i < 3; i++) {
            await this.executeGarbageCollection();
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms待機
        }
    }

    async sendAlert(severity, message, data) {
        // クールダウンチェック
        if (this.state.lastAlert && 
            Date.now() - this.state.lastAlert.getTime() < this.config.alertCooldown) {
            return;
        }
        
        this.state.lastAlert = new Date();
        
        const alert = {
            severity,
            message,
            timestamp: new Date(),
            data: {
                currentUsage: `${(this.state.currentUsage * 100).toFixed(1)}%`,
                peakUsage: `${(this.metrics.peakMemoryUsage * 100).toFixed(1)}%`,
                averageUsage: `${(this.metrics.averageMemoryUsage * 100).toFixed(1)}%`,
                ...data
            }
        };
        
        // TODO: 実際のアラート送信実装（メール、Slack等）
        console.log(`🚨 MEMORY ALERT [${severity.toUpperCase()}]: ${message}`);
        console.log(JSON.stringify(alert, null, 2));
    }

    updateHealthStatus() {
        const usage = this.state.currentUsage;
        this.state.isHealthy = usage < this.config.criticalThreshold && !this.state.criticalState;
    }

    // 診断機能
    async runDiagnostics() {
        const memoryData = this.getDetailedMemoryUsage();
        const trend = this.calculateTrend(this.state.memoryHistory.slice(-this.config.trendAnalysisLength));
        
        return {
            timestamp: new Date(),
            current: memoryData,
            metrics: this.metrics,
            trend,
            history: this.state.memoryHistory.slice(-10), // 直近10回分
            healthStatus: {
                isHealthy: this.state.isHealthy,
                leakSuspected: this.state.leakSuspected,
                criticalState: this.state.criticalState
            },
            configuration: this.config
        };
    }

    getStatus() {
        return {
            healthy: this.state.isHealthy,
            currentUsage: `${(this.state.currentUsage * 100).toFixed(1)}%`,
            leakSuspected: this.state.leakSuspected,
            criticalState: this.state.criticalState,
            lastGcTime: this.state.lastGcTime,
            metrics: this.metrics,
            historyLength: this.state.memoryHistory.length
        };
    }

    async shutdown() {
        this.logger.info('メモリ監視停止開始');
        
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        this.logger.info('メモリ監視停止完了');
    }
}

module.exports = MemoryMonitor;