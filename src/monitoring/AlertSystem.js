/**
 * アラート・通知システム
 * PersonalCookingRecipe統合開発環境
 */

const EventEmitter = require('events');
const winston = require('winston');
const nodemailer = require('nodemailer');

class AlertSystem extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // 通知チャンネル設定
            email: {
                enabled: config.email?.enabled || false,
                smtp: {
                    host: config.email?.smtp?.host || process.env.SMTP_HOST,
                    port: config.email?.smtp?.port || 587,
                    secure: config.email?.smtp?.secure || false,
                    auth: {
                        user: config.email?.smtp?.user || process.env.SMTP_USER,
                        pass: config.email?.smtp?.pass || process.env.SMTP_PASS
                    }
                },
                from: config.email?.from || process.env.ALERT_FROM_EMAIL || 'alerts@personalcookingrecipe.local',
                to: config.email?.to || process.env.ALERT_TO_EMAIL?.split(',') || []
            },
            
            slack: {
                enabled: config.slack?.enabled || false,
                webhookUrl: config.slack?.webhookUrl || process.env.SLACK_WEBHOOK_URL,
                channel: config.slack?.channel || '#alerts',
                username: config.slack?.username || 'PersonalCookingRecipe Alert Bot'
            },
            
            discord: {
                enabled: config.discord?.enabled || false,
                webhookUrl: config.discord?.webhookUrl || process.env.DISCORD_WEBHOOK_URL,
                username: config.discord?.username || 'PersonalCookingRecipe Bot'
            },
            
            console: {
                enabled: config.console?.enabled !== false, // デフォルトで有効
                colors: config.console?.colors !== false
            },
            
            // アラート設定
            severity: {
                critical: { enabled: true, cooldown: 0 },      // クリティカルはクールダウンなし
                warning: { enabled: true, cooldown: 300000 },  // 5分
                info: { enabled: false, cooldown: 600000 },    // 10分
                ...config.severity
            },
            
            // レート制限
            rateLimit: {
                maxAlertsPerMinute: config.rateLimit?.maxAlertsPerMinute || 10,
                maxAlertsPerHour: config.rateLimit?.maxAlertsPerHour || 100
            },
            
            // テンプレート設定
            templates: {
                email: config.templates?.email || 'default',
                slack: config.templates?.slack || 'default',
                discord: config.templates?.discord || 'default'
            },
            
            ...config
        };

        this.state = {
            alertHistory: new Map(),
            rateLimitCounters: {
                perMinute: 0,
                perHour: 0,
                lastMinute: Date.now(),
                lastHour: Date.now()
            },
            cooldowns: new Map()
        };

        this.transporters = {
            email: null,
            slack: null,
            discord: null
        };

        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'alert-system' },
            transports: [
                new winston.transports.File({ 
                    filename: 'logs/alert-system.log' 
                }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });

        this.templates = new Map();
        
        this.initialize();
    }

    async initialize() {
        this.logger.info('アラートシステム初期化開始');
        
        // 通知チャンネル初期化
        await this.initializeChannels();
        
        // テンプレート初期化
        this.initializeTemplates();
        
        // レート制限リセット タイマー
        this.setupRateLimitTimers();
        
        this.logger.info('アラートシステム初期化完了');
    }

    async initializeChannels() {
        // Email 初期化
        if (this.config.email.enabled && this.config.email.smtp.host) {
            try {
                this.transporters.email = nodemailer.createTransporter(this.config.email.smtp);
                await this.transporters.email.verify();
                this.logger.info('Email 通知チャンネル初期化完了');
            } catch (error) {
                this.logger.error('Email 通知チャンネル初期化失敗', error);
                this.config.email.enabled = false;
            }
        }
        
        // Slack/Discord は axios を使用するため、初期化不要
        if (this.config.slack.enabled && this.config.slack.webhookUrl) {
            this.logger.info('Slack 通知チャンネル設定完了');
        }
        
        if (this.config.discord.enabled && this.config.discord.webhookUrl) {
            this.logger.info('Discord 通知チャンネル設定完了');
        }
    }

    initializeTemplates() {
        // デフォルトテンプレート
        this.templates.set('default', {
            email: {
                subject: '[{{severity}}] {{title}} - PersonalCookingRecipe',
                html: `
                    <h2 style="color: {{severityColor}}">{{title}}</h2>
                    <p><strong>重要度:</strong> {{severity}}</p>
                    <p><strong>発生時刻:</strong> {{timestamp}}</p>
                    <p><strong>メッセージ:</strong> {{message}}</p>
                    {{#details}}
                    <h3>詳細情報:</h3>
                    <pre>{{details}}</pre>
                    {{/details}}
                    {{#recommendations}}
                    <h3>推奨対応:</h3>
                    <ul>
                    {{#each recommendations}}
                        <li>{{this}}</li>
                    {{/each}}
                    </ul>
                    {{/recommendations}}
                    <hr>
                    <p><small>PersonalCookingRecipe 監視システム</small></p>
                `
            },
            slack: {
                color: '{{severityColor}}',
                title: '{{title}}',
                text: '{{message}}',
                fields: [
                    { title: '重要度', value: '{{severity}}', short: true },
                    { title: '発生時刻', value: '{{timestamp}}', short: true }
                ]
            },
            discord: {
                embeds: [{
                    title: '{{title}}',
                    description: '{{message}}',
                    color: '{{severityColorInt}}',
                    fields: [
                        { name: '重要度', value: '{{severity}}', inline: true },
                        { name: '発生時刻', value: '{{timestamp}}', inline: true }
                    ],
                    footer: { text: 'PersonalCookingRecipe 監視システム' },
                    timestamp: '{{isoTimestamp}}'
                }]
            }
        });
    }

    setupRateLimitTimers() {
        // 1分間のカウンターリセット
        setInterval(() => {
            this.state.rateLimitCounters.perMinute = 0;
            this.state.rateLimitCounters.lastMinute = Date.now();
        }, 60000);
        
        // 1時間のカウンターリセット  
        setInterval(() => {
            this.state.rateLimitCounters.perHour = 0;
            this.state.rateLimitCounters.lastHour = Date.now();
        }, 3600000);
    }

    async sendAlert(alert) {
        try {
            // 基本情報の正規化
            const normalizedAlert = this.normalizeAlert(alert);
            
            // レート制限チェック
            if (!this.checkRateLimit()) {
                this.logger.warn('レート制限によりアラート送信をスキップ');
                return { success: false, reason: 'rate_limited' };
            }
            
            // 重要度設定チェック
            if (!this.config.severity[normalizedAlert.severity]?.enabled) {
                this.logger.debug(`重要度 ${normalizedAlert.severity} のアラートは無効化されています`);
                return { success: false, reason: 'severity_disabled' };
            }
            
            // クールダウンチェック
            if (!this.checkCooldown(normalizedAlert)) {
                this.logger.debug('クールダウン中のためアラート送信をスキップ');
                return { success: false, reason: 'cooldown_active' };
            }
            
            // 履歴に追加
            this.addToHistory(normalizedAlert);
            
            // 各チャンネルに送信
            const results = await this.sendToAllChannels(normalizedAlert);
            
            // クールダウン設定
            this.setCooldown(normalizedAlert);
            
            // レート制限カウンター更新
            this.updateRateLimitCounters();
            
            // 成功結果のログ
            const successChannels = Object.entries(results)
                .filter(([_, result]) => result.success)
                .map(([channel, _]) => channel);
            
            this.logger.info('アラート送信完了', {
                severity: normalizedAlert.severity,
                title: normalizedAlert.title,
                channels: successChannels
            });
            
            return { success: true, results };
            
        } catch (error) {
            this.logger.error('アラート送信エラー', error);
            return { success: false, error: error.message };
        }
    }

    normalizeAlert(alert) {
        return {
            id: alert.id || this.generateAlertId(),
            title: alert.title || 'Unknown Alert',
            message: alert.message || 'No message provided',
            severity: alert.severity || 'info',
            timestamp: alert.timestamp || new Date(),
            details: alert.details || null,
            source: alert.source || 'unknown',
            recommendations: alert.recommendations || [],
            metadata: alert.metadata || {}
        };
    }

    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    checkRateLimit() {
        const { maxAlertsPerMinute, maxAlertsPerHour } = this.config.rateLimit;
        
        return this.state.rateLimitCounters.perMinute < maxAlertsPerMinute &&
               this.state.rateLimitCounters.perHour < maxAlertsPerHour;
    }

    checkCooldown(alert) {
        const cooldownKey = `${alert.severity}_${alert.source}_${alert.title}`;
        const cooldownEnd = this.state.cooldowns.get(cooldownKey);
        
        if (cooldownEnd && Date.now() < cooldownEnd) {
            return false;
        }
        
        return true;
    }

    setCooldown(alert) {
        const cooldownDuration = this.config.severity[alert.severity]?.cooldown || 0;
        if (cooldownDuration > 0) {
            const cooldownKey = `${alert.severity}_${alert.source}_${alert.title}`;
            this.state.cooldowns.set(cooldownKey, Date.now() + cooldownDuration);
        }
    }

    updateRateLimitCounters() {
        this.state.rateLimitCounters.perMinute++;
        this.state.rateLimitCounters.perHour++;
    }

    addToHistory(alert) {
        this.state.alertHistory.set(alert.id, {
            ...alert,
            sentAt: new Date()
        });
        
        // 履歴サイズ制限（最新1000件）
        if (this.state.alertHistory.size > 1000) {
            const firstKey = this.state.alertHistory.keys().next().value;
            this.state.alertHistory.delete(firstKey);
        }
    }

    async sendToAllChannels(alert) {
        const results = {};
        
        // コンソール出力
        if (this.config.console.enabled) {
            results.console = await this.sendToConsole(alert);
        }
        
        // Email送信
        if (this.config.email.enabled && this.transporters.email) {
            results.email = await this.sendToEmail(alert);
        }
        
        // Slack送信
        if (this.config.slack.enabled && this.config.slack.webhookUrl) {
            results.slack = await this.sendToSlack(alert);
        }
        
        // Discord送信
        if (this.config.discord.enabled && this.config.discord.webhookUrl) {
            results.discord = await this.sendToDiscord(alert);
        }
        
        return results;
    }

    async sendToConsole(alert) {
        try {
            const severityColors = {
                critical: '\x1b[91m', // 明るい赤
                warning: '\x1b[93m',  // 明るい黄
                info: '\x1b[94m',     // 明るい青
                success: '\x1b[92m'   // 明るい緑
            };
            
            const reset = '\x1b[0m';
            const bold = '\x1b[1m';
            
            const color = this.config.console.colors ? 
                (severityColors[alert.severity] || '') : '';
            
            const prefix = alert.severity === 'critical' ? '🚨' : 
                          alert.severity === 'warning' ? '⚠️' : 
                          alert.severity === 'success' ? '✅' : 'ℹ️';
            
            console.log(`${color}${bold}${prefix} [${alert.severity.toUpperCase()}]${reset}${color} ${alert.title}${reset}`);
            console.log(`${color}📅 ${alert.timestamp.toISOString()}${reset}`);
            console.log(`${color}💬 ${alert.message}${reset}`);
            
            if (alert.details) {
                console.log(`${color}📋 詳細:${reset}`);
                console.log(JSON.stringify(alert.details, null, 2));
            }
            
            if (alert.recommendations && alert.recommendations.length > 0) {
                console.log(`${color}💡 推奨対応:${reset}`);
                alert.recommendations.forEach((rec, index) => {
                    console.log(`${color}   ${index + 1}. ${rec}${reset}`);
                });
            }
            
            console.log('─'.repeat(80));
            
            return { success: true };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async sendToEmail(alert) {
        try {
            const template = this.templates.get('default').email;
            const templateData = this.prepareTemplateData(alert);
            
            const subject = this.renderTemplate(template.subject, templateData);
            const html = this.renderTemplate(template.html, templateData);
            
            const mailOptions = {
                from: this.config.email.from,
                to: this.config.email.to.join(','),
                subject: subject,
                html: html
            };
            
            await this.transporters.email.sendMail(mailOptions);
            
            return { success: true };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async sendToSlack(alert) {
        try {
            const template = this.templates.get('default').slack;
            const templateData = this.prepareTemplateData(alert);
            
            const payload = {
                channel: this.config.slack.channel,
                username: this.config.slack.username,
                attachments: [{
                    color: this.renderTemplate(template.color, templateData),
                    title: this.renderTemplate(template.title, templateData),
                    text: this.renderTemplate(template.text, templateData),
                    fields: template.fields.map(field => ({
                        title: field.title,
                        value: this.renderTemplate(field.value, templateData),
                        short: field.short
                    })),
                    ts: Math.floor(alert.timestamp.getTime() / 1000)
                }]
            };
            
            const axios = require('axios');
            await axios.post(this.config.slack.webhookUrl, payload);
            
            return { success: true };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async sendToDiscord(alert) {
        try {
            const template = this.templates.get('default').discord;
            const templateData = this.prepareTemplateData(alert);
            
            const payload = {
                username: this.config.discord.username,
                embeds: template.embeds.map(embed => ({
                    title: this.renderTemplate(embed.title, templateData),
                    description: this.renderTemplate(embed.description, templateData),
                    color: parseInt(this.renderTemplate(embed.color, templateData)),
                    fields: embed.fields.map(field => ({
                        name: field.name,
                        value: this.renderTemplate(field.value, templateData),
                        inline: field.inline
                    })),
                    footer: embed.footer,
                    timestamp: alert.timestamp.toISOString()
                }))
            };
            
            const axios = require('axios');
            await axios.post(this.config.discord.webhookUrl, payload);
            
            return { success: true };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    prepareTemplateData(alert) {
        const severityColors = {
            critical: '#FF0000',
            warning: '#FFA500', 
            info: '#0099FF',
            success: '#00FF00'
        };
        
        const severityColorInts = {
            critical: 16711680, // 0xFF0000
            warning: 16753920,  // 0xFFA500
            info: 39423,       // 0x0099FF
            success: 65280     // 0x00FF00
        };
        
        return {
            ...alert,
            severityColor: severityColors[alert.severity] || '#808080',
            severityColorInt: severityColorInts[alert.severity] || 8421504,
            isoTimestamp: alert.timestamp.toISOString(),
            details: alert.details ? JSON.stringify(alert.details, null, 2) : null
        };
    }

    renderTemplate(template, data) {
        let rendered = template;
        
        // 単純な置換（本格的なテンプレートエンジンの代替）
        Object.keys(data).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            const value = data[key] !== null && data[key] !== undefined ? 
                data[key].toString() : '';
            rendered = rendered.replace(regex, value);
        });
        
        // 条件分岐の簡単な処理
        rendered = rendered.replace(/{{#(\w+)}}(.*?){{\/\1}}/gs, (match, key, content) => {
            return data[key] ? content : '';
        });
        
        return rendered;
    }

    // ユーティリティメソッド
    async sendTestAlert(severity = 'info') {
        return await this.sendAlert({
            title: 'テストアラート',
            message: `これは${severity}レベルのテストアラートです`,
            severity,
            source: 'test',
            details: { test: true, timestamp: new Date().toISOString() },
            recommendations: ['テストが正常に動作していることを確認してください']
        });
    }

    getAlertHistory(limit = 50) {
        const history = Array.from(this.state.alertHistory.values())
            .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
            .slice(0, limit);
        
        return history;
    }

    getStatus() {
        return {
            channels: {
                console: this.config.console.enabled,
                email: this.config.email.enabled && !!this.transporters.email,
                slack: this.config.slack.enabled && !!this.config.slack.webhookUrl,
                discord: this.config.discord.enabled && !!this.config.discord.webhookUrl
            },
            rateLimit: this.state.rateLimitCounters,
            alertHistory: this.state.alertHistory.size,
            activeCooldowns: this.state.cooldowns.size
        };
    }

    async shutdown() {
        this.logger.info('アラートシステム停止開始');
        
        if (this.transporters.email) {
            this.transporters.email.close();
        }
        
        this.logger.info('アラートシステム停止完了');
    }
}

module.exports = AlertSystem;