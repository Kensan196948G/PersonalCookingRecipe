/**
 * ネイティブアラート管理システム
 * PersonalCookingRecipe - Docker非依存監視システム
 *
 * 機能:
 * - 複数チャンネル通知 (Console, File, Email, Slack, Discord)
 * - アラートルール管理
 * - 重複アラート抑制
 * - エスカレーション管理
 * - アラート履歴管理
 */

const { EventEmitter } = require('events');
const winston = require('winston');
const nodemailer = require('nodemailer');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class NativeAlertManager extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            // 通知チャンネル有効化
            enableConsole: config.enableConsole !== false,
            enableFile: config.enableFile !== false,
            enableEmail: config.enableEmail || false,
            enableSlack: config.enableSlack || false,
            enableDiscord: config.enableDiscord || false,

            // Email設定
            email: {
                service: config.email?.service || 'gmail',
                user: config.email?.user,
                pass: config.email?.pass,
                from: config.email?.from,
                to: config.email?.to
            },

            // Slack設定
            slack: {
                webhookUrl: config.slack?.webhookUrl,
                channel: config.slack?.channel || '#alerts',
                username: config.slack?.username || 'PersonalCookingRecipe Monitor'
            },

            // Discord設定
            discord: {
                webhookUrl: config.discord?.webhookUrl,
                username: config.discord?.username || 'PersonalCookingRecipe Monitor'
            },

            // アラート設定
            alertRules: config.alertRules || [],
            suppressDuration: config.suppressDuration || 300000, // 5分間は同じアラート抑制
            alertHistoryLimit: config.alertHistoryLimit || 1000,
            alertLogDir: config.alertLogDir || 'logs/alerts',

            ...config
        };

        // ロガー初期化
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'native-alert-manager' },
            transports: [
                new winston.transports.File({
                    filename: 'logs/alert-manager.log',
                    maxsize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 10
                }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });

        // アラート履歴
        this.alertHistory = [];
        this.suppressedAlerts = new Map(); // アラート抑制マップ

        // Email トランスポーター
        this.emailTransporter = null;
        if (this.config.enableEmail && this.config.email.user && this.config.email.pass) {
            this.initializeEmailTransporter();
        }

        // デフォルトアラートルール登録
        this.registerDefaultAlertRules();

        this.logger.info('ネイティブアラート管理システム初期化完了', {
            channels: {
                console: this.config.enableConsole,
                file: this.config.enableFile,
                email: this.config.enableEmail,
                slack: this.config.enableSlack,
                discord: this.config.enableDiscord
            }
        });
    }

    /**
     * Emailトランスポーター初期化
     */
    initializeEmailTransporter() {
        try {
            this.emailTransporter = nodemailer.createTransporter({
                service: this.config.email.service,
                auth: {
                    user: this.config.email.user,
                    pass: this.config.email.pass
                }
            });
            this.logger.info('Emailトランスポーター初期化完了');
        } catch (error) {
            this.logger.error('Emailトランスポーター初期化エラー', { error: error.message });
        }
    }

    /**
     * デフォルトアラートルール登録
     */
    registerDefaultAlertRules() {
        const defaultRules = [
            // システムリソース
            {
                name: 'HighCPUUsage',
                condition: (metrics) => metrics.cpu?.usage > 85,
                severity: 'warning',
                message: 'CPU使用率が高い',
                category: 'system'
            },
            {
                name: 'CriticalCPUUsage',
                condition: (metrics) => metrics.cpu?.usage > 95,
                severity: 'critical',
                message: 'CPU使用率が危険レベル',
                category: 'system'
            },
            {
                name: 'HighMemoryUsage',
                condition: (metrics) => metrics.memory?.usage_percent > 90,
                severity: 'warning',
                message: 'メモリ使用率が高い',
                category: 'system'
            },
            {
                name: 'CriticalMemoryUsage',
                condition: (metrics) => metrics.memory?.usage_percent > 95,
                severity: 'critical',
                message: 'メモリ使用率が危険レベル',
                category: 'system'
            },
            {
                name: 'HighDiskUsage',
                condition: (metrics) => {
                    if (!metrics.disk?.filesystems) return false;
                    return metrics.disk.filesystems.some(fs => fs.usage_percent > 85);
                },
                severity: 'warning',
                message: 'ディスク使用率が高い',
                category: 'system'
            },
            {
                name: 'CriticalDiskUsage',
                condition: (metrics) => {
                    if (!metrics.disk?.filesystems) return false;
                    return metrics.disk.filesystems.some(fs => fs.usage_percent > 95);
                },
                severity: 'critical',
                message: 'ディスク使用率が危険レベル',
                category: 'system'
            },
            {
                name: 'HighNetworkBandwidth',
                condition: (metrics) => {
                    if (!metrics.network?.bandwidth) return false;
                    return metrics.network.bandwidth.some(bw => bw.usage_percent > 80);
                },
                severity: 'warning',
                message: 'ネットワーク帯域使用率が高い',
                category: 'system'
            },

            // アプリケーション
            {
                name: 'HighErrorRate',
                condition: (metrics) => metrics.errorRate > 5,
                severity: 'warning',
                message: 'APIエラー率が高い',
                category: 'application'
            },
            {
                name: 'CriticalErrorRate',
                condition: (metrics) => metrics.errorRate > 10,
                severity: 'critical',
                message: 'APIエラー率が危険レベル',
                category: 'application'
            },
            {
                name: 'SlowResponseTime',
                condition: (metrics) => metrics.percentiles?.p95 > 2000,
                severity: 'warning',
                message: 'APIレスポンス時間が遅い (P95 > 2秒)',
                category: 'application'
            },
            {
                name: 'VerySlowResponseTime',
                condition: (metrics) => metrics.percentiles?.p95 > 5000,
                severity: 'critical',
                message: 'APIレスポンス時間が非常に遅い (P95 > 5秒)',
                category: 'application'
            },
            {
                name: 'SlowDatabaseQuery',
                condition: (metrics) => {
                    if (!metrics.database?.slowQueriesCount) return false;
                    return metrics.database.slowQueriesCount > 10;
                },
                severity: 'warning',
                message: '遅いDBクエリが多数検出',
                category: 'database'
            },
            {
                name: 'LowCacheHitRate',
                condition: (metrics) => metrics.redis?.hitRate < 80,
                severity: 'warning',
                message: 'キャッシュヒット率が低い',
                category: 'cache'
            },
            {
                name: 'VeryLowCacheHitRate',
                condition: (metrics) => metrics.redis?.hitRate < 50,
                severity: 'critical',
                message: 'キャッシュヒット率が非常に低い',
                category: 'cache'
            },

            // データベース
            {
                name: 'DatabaseConnectionPoolExhausted',
                condition: (metrics) => {
                    const pool = metrics.database?.poolStats;
                    if (!pool) return false;
                    return pool.waiting > 0 && pool.idle === 0;
                },
                severity: 'critical',
                message: 'データベース接続プールが枯渇',
                category: 'database'
            },
            {
                name: 'HighDatabaseErrorRate',
                condition: (metrics) => {
                    const db = metrics.database;
                    if (!db || db.totalQueries === 0) return false;
                    return (db.totalErrors / db.totalQueries) > 0.05; // 5%
                },
                severity: 'warning',
                message: 'データベースエラー率が高い',
                category: 'database'
            },

            // ビジネス
            {
                name: 'HighSearchNoResultsRate',
                condition: (metrics) => {
                    const search = metrics.search;
                    if (!search || search.totalExecutions < 100) return false;
                    return search.noResultsRate > 30; // 30%
                },
                severity: 'warning',
                message: '検索で結果なしが多い',
                category: 'business'
            },
            {
                name: 'LowDailyUserRegistrations',
                condition: (metrics) => {
                    const users = metrics.users;
                    if (!users) return false;
                    // 例: 過去の平均より50%以上低い場合
                    return users.dailyRegistrations < 5;
                },
                severity: 'info',
                message: '本日のユーザー登録数が少ない',
                category: 'business'
            }
        ];

        defaultRules.forEach(rule => this.registerAlertRule(rule));
    }

    /**
     * アラートルール登録
     */
    registerAlertRule(rule) {
        this.config.alertRules.push({
            name: rule.name,
            condition: rule.condition,
            severity: rule.severity || 'warning',
            message: rule.message,
            category: rule.category || 'general',
            enabled: rule.enabled !== false
        });

        this.logger.debug('アラートルール登録', {
            name: rule.name,
            severity: rule.severity,
            category: rule.category
        });
    }

    /**
     * メトリクスチェック（全ルール評価）
     */
    async checkMetrics(metrics) {
        const triggeredAlerts = [];

        for (const rule of this.config.alertRules) {
            if (!rule.enabled) continue;

            try {
                if (rule.condition(metrics)) {
                    const alert = {
                        ruleName: rule.name,
                        severity: rule.severity,
                        message: rule.message,
                        category: rule.category,
                        metrics,
                        timestamp: Date.now()
                    };

                    // 重複抑制チェック
                    if (!this.isSuppressed(alert)) {
                        triggeredAlerts.push(alert);
                        await this.sendAlert(alert);
                        this.recordAlert(alert);
                        this.setSuppression(alert);
                    }
                }
            } catch (error) {
                this.logger.error('アラートルール評価エラー', {
                    ruleName: rule.name,
                    error: error.message
                });
            }
        }

        return triggeredAlerts;
    }

    /**
     * アラート送信（全チャンネル）
     */
    async sendAlert(alert) {
        const sendPromises = [];

        if (this.config.enableConsole) {
            sendPromises.push(this.sendConsoleAlert(alert));
        }

        if (this.config.enableFile) {
            sendPromises.push(this.sendFileAlert(alert));
        }

        if (this.config.enableEmail && this.emailTransporter) {
            sendPromises.push(this.sendEmailAlert(alert));
        }

        if (this.config.enableSlack && this.config.slack.webhookUrl) {
            sendPromises.push(this.sendSlackAlert(alert));
        }

        if (this.config.enableDiscord && this.config.discord.webhookUrl) {
            sendPromises.push(this.sendDiscordAlert(alert));
        }

        try {
            await Promise.allSettled(sendPromises);
            this.emit('alert_sent', alert);
        } catch (error) {
            this.logger.error('アラート送信エラー', { error: error.message });
        }
    }

    /**
     * コンソールアラート
     */
    async sendConsoleAlert(alert) {
        const icon = this.getSeverityIcon(alert.severity);
        const color = this.getSeverityColor(alert.severity);

        console.log(`\n${color}${icon} ALERT [${alert.severity.toUpperCase()}]: ${alert.message}\x1b[0m`);
        console.log(`  Rule: ${alert.ruleName}`);
        console.log(`  Category: ${alert.category}`);
        console.log(`  Time: ${new Date(alert.timestamp).toISOString()}`);
        console.log('');
    }

    /**
     * ファイルアラート
     */
    async sendFileAlert(alert) {
        try {
            const alertLogPath = path.join(this.config.alertLogDir, `${this.getToday()}-alerts.log`);

            // ディレクトリ作成
            await fs.mkdir(this.config.alertLogDir, { recursive: true });

            // アラートログ追加
            const logEntry = JSON.stringify({
                ...alert,
                timestamp: new Date(alert.timestamp).toISOString()
            }) + '\n';

            await fs.appendFile(alertLogPath, logEntry);

        } catch (error) {
            this.logger.error('ファイルアラート記録エラー', { error: error.message });
        }
    }

    /**
     * Emailアラート
     */
    async sendEmailAlert(alert) {
        if (!this.emailTransporter) return;

        try {
            const subject = `[${alert.severity.toUpperCase()}] ${alert.message}`;
            const html = this.formatEmailHTML(alert);

            await this.emailTransporter.sendMail({
                from: this.config.email.from,
                to: this.config.email.to,
                subject,
                html
            });

            this.logger.info('Emailアラート送信完了', { ruleName: alert.ruleName });

        } catch (error) {
            this.logger.error('Emailアラート送信エラー', { error: error.message });
        }
    }

    /**
     * Slackアラート
     */
    async sendSlackAlert(alert) {
        try {
            const payload = {
                channel: this.config.slack.channel,
                username: this.config.slack.username,
                icon_emoji: this.getSeverityEmoji(alert.severity),
                attachments: [{
                    color: this.getSeverityHexColor(alert.severity),
                    title: `${alert.severity.toUpperCase()}: ${alert.message}`,
                    fields: [
                        { title: 'Rule', value: alert.ruleName, short: true },
                        { title: 'Category', value: alert.category, short: true },
                        { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: false }
                    ]
                }]
            };

            await axios.post(this.config.slack.webhookUrl, payload);
            this.logger.info('Slackアラート送信完了', { ruleName: alert.ruleName });

        } catch (error) {
            this.logger.error('Slackアラート送信エラー', { error: error.message });
        }
    }

    /**
     * Discordアラート
     */
    async sendDiscordAlert(alert) {
        try {
            const payload = {
                username: this.config.discord.username,
                embeds: [{
                    color: parseInt(this.getSeverityHexColor(alert.severity).replace('#', ''), 16),
                    title: `${alert.severity.toUpperCase()}: ${alert.message}`,
                    fields: [
                        { name: 'Rule', value: alert.ruleName, inline: true },
                        { name: 'Category', value: alert.category, inline: true },
                        { name: 'Time', value: new Date(alert.timestamp).toISOString(), inline: false }
                    ],
                    timestamp: new Date(alert.timestamp).toISOString()
                }]
            };

            await axios.post(this.config.discord.webhookUrl, payload);
            this.logger.info('Discordアラート送信完了', { ruleName: alert.ruleName });

        } catch (error) {
            this.logger.error('Discordアラート送信エラー', { error: error.message });
        }
    }

    /**
     * Email HTML フォーマット
     */
    formatEmailHTML(alert) {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .alert { padding: 20px; border-left: 5px solid ${this.getSeverityHexColor(alert.severity)}; }
        .severity { font-size: 20px; font-weight: bold; color: ${this.getSeverityHexColor(alert.severity)}; }
        .details { margin-top: 10px; }
        .label { font-weight: bold; }
    </style>
</head>
<body>
    <div class="alert">
        <div class="severity">${alert.severity.toUpperCase()}: ${alert.message}</div>
        <div class="details">
            <p><span class="label">Rule:</span> ${alert.ruleName}</p>
            <p><span class="label">Category:</span> ${alert.category}</p>
            <p><span class="label">Time:</span> ${new Date(alert.timestamp).toISOString()}</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * アラート抑制チェック
     */
    isSuppressed(alert) {
        const key = `${alert.ruleName}`;
        const suppressed = this.suppressedAlerts.get(key);

        if (!suppressed) return false;

        const elapsed = Date.now() - suppressed.timestamp;
        if (elapsed > this.config.suppressDuration) {
            this.suppressedAlerts.delete(key);
            return false;
        }

        return true;
    }

    /**
     * アラート抑制設定
     */
    setSuppression(alert) {
        const key = `${alert.ruleName}`;
        this.suppressedAlerts.set(key, {
            alert,
            timestamp: Date.now()
        });
    }

    /**
     * アラート記録
     */
    recordAlert(alert) {
        this.alertHistory.push(alert);

        // 履歴上限チェック
        if (this.alertHistory.length > this.config.alertHistoryLimit) {
            this.alertHistory.shift();
        }
    }

    /**
     * アラート履歴取得
     */
    getAlertHistory(limit = 100, severity = null) {
        let history = [...this.alertHistory];

        if (severity) {
            history = history.filter(a => a.severity === severity);
        }

        return history.slice(-limit).reverse();
    }

    /**
     * アラート統計取得
     */
    getAlertStats() {
        const stats = {
            total: this.alertHistory.length,
            bySeverity: {},
            byCategory: {},
            byRule: {},
            recent24h: 0
        };

        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

        this.alertHistory.forEach(alert => {
            // 重大度別
            stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;

            // カテゴリ別
            stats.byCategory[alert.category] = (stats.byCategory[alert.category] || 0) + 1;

            // ルール別
            stats.byRule[alert.ruleName] = (stats.byRule[alert.ruleName] || 0) + 1;

            // 24時間以内
            if (alert.timestamp > oneDayAgo) {
                stats.recent24h++;
            }
        });

        return stats;
    }

    /**
     * 重大度アイコン取得
     */
    getSeverityIcon(severity) {
        const icons = {
            critical: '🚨',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[severity] || '•';
    }

    /**
     * 重大度絵文字取得
     */
    getSeverityEmoji(severity) {
        const emojis = {
            critical: ':rotating_light:',
            warning: ':warning:',
            info: ':information_source:'
        };
        return emojis[severity] || ':bell:';
    }

    /**
     * 重大度カラー取得（ターミナル）
     */
    getSeverityColor(severity) {
        const colors = {
            critical: '\x1b[31m', // 赤
            warning: '\x1b[33m',  // 黄
            info: '\x1b[36m'      // シアン
        };
        return colors[severity] || '\x1b[37m'; // 白
    }

    /**
     * 重大度カラー取得（Hex）
     */
    getSeverityHexColor(severity) {
        const colors = {
            critical: '#FF0000',
            warning: '#FFA500',
            info: '#00BFFF'
        };
        return colors[severity] || '#808080';
    }

    /**
     * 今日の日付取得
     */
    getToday() {
        return new Date().toISOString().split('T')[0];
    }
}

module.exports = NativeAlertManager;
