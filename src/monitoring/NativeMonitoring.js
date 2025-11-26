/**
 * ネイティブシステム監視モジュール
 * PersonalCookingRecipe - Docker非依存監視システム
 *
 * 機能:
 * - systeminformationライブラリを使用したシステムメトリクス収集
 * - CPU, メモリ, ディスクI/O, ネットワーク帯域の監視
 * - プロセスメトリクス収集
 * - リアルタイムメトリクス更新
 */

const si = require('systeminformation');
const os = require('os');
const { EventEmitter } = require('events');
const winston = require('winston');

/**
 * 循環バッファクラス（メモリリーク対策）
 * O(N) の shift() を使わず、O(1) で動作する固定サイズバッファ
 */
class CircularBuffer {
    constructor(size) {
        this.size = size;
        this.buffer = new Array(size);
        this.writeIndex = 0;
        this.count = 0;
    }

    /**
     * データを追加
     */
    push(item) {
        this.buffer[this.writeIndex] = item;
        this.writeIndex = (this.writeIndex + 1) % this.size;

        if (this.count < this.size) {
            this.count++;
        }
    }

    /**
     * 配列として取得（古い順）
     */
    toArray() {
        if (this.count === 0) {
            return [];
        }

        if (this.count < this.size) {
            // まだバッファが満杯でない場合
            return this.buffer.slice(0, this.count);
        }

        // バッファ満杯の場合、書き込み位置から順番に並べ替え
        return [
            ...this.buffer.slice(this.writeIndex),
            ...this.buffer.slice(0, this.writeIndex)
        ];
    }

    /**
     * 最新の値を取得
     */
    latest() {
        if (this.count === 0) {
            return null;
        }

        const latestIndex = (this.writeIndex - 1 + this.size) % this.size;
        return this.buffer[latestIndex];
    }

    /**
     * データ数を取得
     */
    length() {
        return this.count;
    }

    /**
     * バッファをクリア
     */
    clear() {
        this.writeIndex = 0;
        this.count = 0;
        this.buffer = new Array(this.size);
    }
}

class NativeMonitoring extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            updateInterval: config.updateInterval || 5000, // 5秒毎
            enableCPU: config.enableCPU !== false,
            enableMemory: config.enableMemory !== false,
            enableDisk: config.enableDisk !== false,
            enableNetwork: config.enableNetwork !== false,
            enableProcess: config.enableProcess !== false,
            thresholds: {
                cpu: config.thresholds?.cpu || 85,        // CPU使用率閾値: 85%
                memory: config.thresholds?.memory || 90,  // メモリ使用率閾値: 90%
                disk: config.thresholds?.disk || 85,      // ディスク使用率閾値: 85%
                network: config.thresholds?.network || 80 // ネットワーク帯域使用率閾値: 80%
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
            defaultMeta: { service: 'native-monitoring' },
            transports: [
                new winston.transports.File({
                    filename: 'logs/native-monitoring.log',
                    maxsize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 5
                }),
                new winston.transports.Console({
                    format: winston.format.simple(),
                    level: 'warn' // コンソールは警告以上のみ
                })
            ]
        });

        // メトリクスストレージ（循環バッファ使用でメモリ効率化）
        const bufferSize = 100; // 最大100件保持
        this.metrics = {
            system: {
                cpu: new CircularBuffer(bufferSize),
                memory: new CircularBuffer(bufferSize),
                disk: new CircularBuffer(bufferSize),
                network: new CircularBuffer(bufferSize),
                uptime: 0
            },
            process: {
                pid: process.pid,
                memory: new CircularBuffer(bufferSize),
                cpu: new CircularBuffer(bufferSize)
            },
            lastUpdate: null,
            collectionCount: 0
        };

        // 監視タイマー
        this.timer = null;

        // ネットワーク統計（前回値保存用）
        this.previousNetworkStats = null;

        this.logger.info('ネイティブ監視システム初期化完了', {
            config: {
                updateInterval: this.config.updateInterval,
                thresholds: this.config.thresholds
            }
        });
    }

    /**
     * 監視開始
     */
    start() {
        if (this.timer) {
            this.logger.warn('監視は既に開始されています');
            return;
        }

        this.logger.info('ネイティブ監視開始');

        // 初回収集
        this.collectMetrics().catch(err => {
            this.logger.error('初回メトリクス収集エラー', { error: err.message });
        });

        // 定期収集開始
        this.timer = setInterval(async () => {
            try {
                await this.collectMetrics();
            } catch (error) {
                this.logger.error('メトリクス収集エラー', { error: error.message });
                this.emit('error', error);
            }
        }, this.config.updateInterval);

        this.emit('started');
    }

    /**
     * 監視停止
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            this.logger.info('ネイティブ監視停止');
            this.emit('stopped');
        }
    }

    /**
     * 全メトリクス収集
     */
    async collectMetrics() {
        const startTime = Date.now();

        try {
            const metrics = {};

            // 各メトリクス収集
            if (this.config.enableCPU) {
                metrics.cpu = await this.collectCPUMetrics();
            }

            if (this.config.enableMemory) {
                metrics.memory = await this.collectMemoryMetrics();
            }

            if (this.config.enableDisk) {
                metrics.disk = await this.collectDiskMetrics();
            }

            if (this.config.enableNetwork) {
                metrics.network = await this.collectNetworkMetrics();
            }

            if (this.config.enableProcess) {
                metrics.process = await this.collectProcessMetrics();
            }

            // システム稼働時間
            metrics.uptime = os.uptime();

            // メトリクス保存
            this.updateMetricsStorage(metrics);

            // 閾値チェック
            this.checkThresholds(metrics);

            const duration = Date.now() - startTime;
            this.logger.debug('メトリクス収集完了', { duration_ms: duration });

            this.emit('metrics', metrics);
            return metrics;

        } catch (error) {
            this.logger.error('メトリクス収集失敗', { error: error.message, stack: error.stack });
            throw error;
        }
    }

    /**
     * CPUメトリクス収集
     */
    async collectCPUMetrics() {
        try {
            const cpuData = await si.currentLoad();
            const cpuTemp = await si.cpuTemperature().catch(() => ({ main: null }));

            const metrics = {
                usage: cpuData.currentLoad, // 全体使用率
                user: cpuData.currentLoadUser,
                system: cpuData.currentLoadSystem,
                idle: cpuData.currentLoadIdle,
                cores: cpuData.cpus.map((cpu, index) => ({
                    core: index,
                    usage: cpu.load
                })),
                temperature: cpuTemp.main, // 温度（対応している場合）
                timestamp: Date.now()
            };

            return metrics;

        } catch (error) {
            this.logger.error('CPU メトリクス収集エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * メモリメトリクス収集
     */
    async collectMemoryMetrics() {
        try {
            const memData = await si.mem();

            const metrics = {
                total: memData.total,
                used: memData.used,
                free: memData.free,
                available: memData.available,
                usage_percent: (memData.used / memData.total) * 100,
                swap: {
                    total: memData.swaptotal,
                    used: memData.swapused,
                    free: memData.swapfree,
                    usage_percent: memData.swaptotal > 0
                        ? (memData.swapused / memData.swaptotal) * 100
                        : 0
                },
                timestamp: Date.now()
            };

            return metrics;

        } catch (error) {
            this.logger.error('メモリメトリクス収集エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * ディスクメトリクス収集
     */
    async collectDiskMetrics() {
        try {
            const fsSize = await si.fsSize();
            const diskIO = await si.disksIO();

            const metrics = {
                filesystems: fsSize.map(fs => ({
                    filesystem: fs.fs,
                    type: fs.type,
                    mount: fs.mount,
                    total: fs.size,
                    used: fs.used,
                    available: fs.available,
                    usage_percent: fs.use
                })),
                io: {
                    read_bytes: diskIO.rIO_sec || diskIO.rIO || 0,
                    write_bytes: diskIO.wIO_sec || diskIO.wIO || 0,
                    read_ops: diskIO.rIO || 0,
                    write_ops: diskIO.wIO || 0
                },
                timestamp: Date.now()
            };

            return metrics;

        } catch (error) {
            this.logger.error('ディスクメトリクス収集エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * ネットワークメトリクス収集
     */
    async collectNetworkMetrics() {
        try {
            const networkStats = await si.networkStats();

            // 帯域使用率計算（前回値との差分）
            let bandwidth = [];

            if (this.previousNetworkStats) {
                const timeDiff = (Date.now() - this.previousNetworkStats.timestamp) / 1000; // 秒

                bandwidth = networkStats.map((current, index) => {
                    const previous = this.previousNetworkStats.interfaces[index];

                    if (!previous || previous.iface !== current.iface) {
                        return {
                            interface: current.iface,
                            rx_speed_mbps: 0,
                            tx_speed_mbps: 0,
                            usage_percent: 0
                        };
                    }

                    const rxBytes = current.rx_bytes - previous.rx_bytes;
                    const txBytes = current.tx_bytes - previous.tx_bytes;

                    const rxSpeedMbps = (rxBytes * 8) / (timeDiff * 1000000); // Mbps
                    const txSpeedMbps = (txBytes * 8) / (timeDiff * 1000000); // Mbps

                    // 仮定: 1Gbps = 1000Mbpsのリンク速度
                    const linkSpeedMbps = 1000;
                    const usagePercent = ((rxSpeedMbps + txSpeedMbps) / linkSpeedMbps) * 100;

                    return {
                        interface: current.iface,
                        rx_speed_mbps: rxSpeedMbps,
                        tx_speed_mbps: txSpeedMbps,
                        usage_percent: Math.min(usagePercent, 100)
                    };
                });
            }

            // 現在の統計を保存
            this.previousNetworkStats = {
                interfaces: networkStats.map(net => ({
                    iface: net.iface,
                    rx_bytes: net.rx_bytes,
                    tx_bytes: net.tx_bytes
                })),
                timestamp: Date.now()
            };

            const metrics = {
                interfaces: networkStats.map(net => ({
                    interface: net.iface,
                    rx_bytes: net.rx_bytes,
                    tx_bytes: net.tx_bytes,
                    rx_dropped: net.rx_dropped,
                    tx_dropped: net.tx_dropped,
                    rx_errors: net.rx_errors,
                    tx_errors: net.tx_errors
                })),
                bandwidth,
                timestamp: Date.now()
            };

            return metrics;

        } catch (error) {
            this.logger.error('ネットワークメトリクス収集エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * プロセスメトリクス収集
     */
    async collectProcessMetrics() {
        try {
            const processData = await si.processLoad(process.pid);
            const memUsage = process.memoryUsage();

            const metrics = {
                pid: process.pid,
                cpu_percent: processData.cpu || 0,
                memory: {
                    rss: memUsage.rss,
                    heap_total: memUsage.heapTotal,
                    heap_used: memUsage.heapUsed,
                    external: memUsage.external,
                    usage_percent: (memUsage.heapUsed / memUsage.heapTotal) * 100
                },
                uptime: process.uptime(),
                timestamp: Date.now()
            };

            return metrics;

        } catch (error) {
            this.logger.error('プロセスメトリクス収集エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * メトリクスストレージ更新（循環バッファ使用 - メモリリーク対策）
     * 従来の shift() O(N) から CircularBuffer の push() O(1) に変更
     */
    updateMetricsStorage(metrics) {
        if (metrics.cpu) {
            this.metrics.system.cpu.push(metrics.cpu);
        }

        if (metrics.memory) {
            this.metrics.system.memory.push(metrics.memory);
        }

        if (metrics.disk) {
            this.metrics.system.disk.push(metrics.disk);
        }

        if (metrics.network) {
            this.metrics.system.network.push(metrics.network);
        }

        if (metrics.process) {
            this.metrics.process.memory.push(metrics.process.memory);
            this.metrics.process.cpu.push(metrics.process.cpu_percent);
        }

        if (metrics.uptime) {
            this.metrics.system.uptime = metrics.uptime;
        }

        this.metrics.lastUpdate = Date.now();
        this.metrics.collectionCount++;
    }

    /**
     * 閾値チェック
     */
    checkThresholds(metrics) {
        const alerts = [];

        // CPU閾値チェック
        if (metrics.cpu && metrics.cpu.usage > this.config.thresholds.cpu) {
            const alert = {
                type: 'cpu_high',
                severity: 'warning',
                message: `CPU使用率が高い: ${metrics.cpu.usage.toFixed(2)}%`,
                value: metrics.cpu.usage,
                threshold: this.config.thresholds.cpu,
                timestamp: Date.now()
            };
            alerts.push(alert);
            this.emit('alert', alert);
        }

        // メモリ閾値チェック
        if (metrics.memory && metrics.memory.usage_percent > this.config.thresholds.memory) {
            const alert = {
                type: 'memory_high',
                severity: 'warning',
                message: `メモリ使用率が高い: ${metrics.memory.usage_percent.toFixed(2)}%`,
                value: metrics.memory.usage_percent,
                threshold: this.config.thresholds.memory,
                timestamp: Date.now()
            };
            alerts.push(alert);
            this.emit('alert', alert);
        }

        // ディスク閾値チェック
        if (metrics.disk && metrics.disk.filesystems) {
            metrics.disk.filesystems.forEach(fs => {
                if (fs.usage_percent > this.config.thresholds.disk) {
                    const alert = {
                        type: 'disk_high',
                        severity: 'warning',
                        message: `ディスク使用率が高い (${fs.mount}): ${fs.usage_percent.toFixed(2)}%`,
                        value: fs.usage_percent,
                        threshold: this.config.thresholds.disk,
                        filesystem: fs.mount,
                        timestamp: Date.now()
                    };
                    alerts.push(alert);
                    this.emit('alert', alert);
                }
            });
        }

        // ネットワーク帯域閾値チェック
        if (metrics.network && metrics.network.bandwidth) {
            metrics.network.bandwidth.forEach(bw => {
                if (bw.usage_percent > this.config.thresholds.network) {
                    const alert = {
                        type: 'network_high',
                        severity: 'warning',
                        message: `ネットワーク帯域使用率が高い (${bw.interface}): ${bw.usage_percent.toFixed(2)}%`,
                        value: bw.usage_percent,
                        threshold: this.config.thresholds.network,
                        interface: bw.interface,
                        timestamp: Date.now()
                    };
                    alerts.push(alert);
                    this.emit('alert', alert);
                }
            });
        }

        if (alerts.length > 0) {
            this.logger.warn('閾値アラート検出', { alerts });
        }
    }

    /**
     * 現在のメトリクス取得（循環バッファ対応）
     */
    getCurrentMetrics() {
        return {
            system: {
                cpu: this.metrics.system.cpu.latest(),
                memory: this.metrics.system.memory.latest(),
                disk: this.metrics.system.disk.latest(),
                network: this.metrics.system.network.latest(),
                uptime: this.metrics.system.uptime
            },
            process: {
                pid: this.metrics.process.pid,
                memory: this.metrics.process.memory.latest(),
                cpu: this.metrics.process.cpu.latest()
            },
            lastUpdate: this.metrics.lastUpdate,
            collectionCount: this.metrics.collectionCount
        };
    }

    /**
     * メトリクス履歴取得（循環バッファ対応）
     */
    getMetricsHistory(limit = 10) {
        const getLast = (buffer, n) => {
            const arr = buffer.toArray();
            return arr.slice(-n);
        };

        return {
            system: {
                cpu: getLast(this.metrics.system.cpu, limit),
                memory: getLast(this.metrics.system.memory, limit),
                disk: getLast(this.metrics.system.disk, limit),
                network: getLast(this.metrics.system.network, limit)
            },
            process: {
                memory: getLast(this.metrics.process.memory, limit),
                cpu: getLast(this.metrics.process.cpu, limit)
            }
        };
    }

    /**
     * システム情報取得
     */
    async getSystemInfo() {
        try {
            const [system, cpu, osInfo, versions] = await Promise.all([
                si.system(),
                si.cpu(),
                si.osInfo(),
                si.versions()
            ]);

            return {
                system: {
                    manufacturer: system.manufacturer,
                    model: system.model,
                    version: system.version
                },
                cpu: {
                    manufacturer: cpu.manufacturer,
                    brand: cpu.brand,
                    speed: cpu.speed,
                    cores: cpu.cores,
                    physicalCores: cpu.physicalCores
                },
                os: {
                    platform: osInfo.platform,
                    distro: osInfo.distro,
                    release: osInfo.release,
                    kernel: osInfo.kernel,
                    arch: osInfo.arch,
                    hostname: osInfo.hostname
                },
                node: {
                    version: versions.node,
                    v8: versions.v8,
                    npm: versions.npm
                }
            };

        } catch (error) {
            this.logger.error('システム情報取得エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * 統計情報取得（循環バッファ対応）
     */
    getStats() {
        const cpuArray = this.metrics.system.cpu.toArray();
        const memArray = this.metrics.system.memory.toArray();

        const cpuAvg = this.calculateAverage(cpuArray.map(c => c?.usage || 0));
        const memAvg = this.calculateAverage(memArray.map(m => m?.usage_percent || 0));

        return {
            collection_count: this.metrics.collectionCount,
            last_update: this.metrics.lastUpdate,
            averages: {
                cpu_usage: cpuAvg,
                memory_usage: memAvg
            },
            system_uptime: this.metrics.system.uptime,
            process_uptime: process.uptime()
        };
    }

    /**
     * 平均値計算
     */
    calculateAverage(arr) {
        if (!arr || arr.length === 0) return 0;
        const sum = arr.reduce((a, b) => a + b, 0);
        return sum / arr.length;
    }
}

module.exports = NativeMonitoring;
