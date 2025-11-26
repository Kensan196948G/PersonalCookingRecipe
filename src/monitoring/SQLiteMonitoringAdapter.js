/**
 * SQLite監視システムアダプター
 * PersonalCookingRecipe - sudo権限不要の監視システム
 *
 * 機能:
 * - PostgreSQLと同等のスキーマをSQLiteで実装
 * - 自動テーブル作成・初期化
 * - メトリクス保存・取得API
 * - 将来のPostgreSQL移行を容易にする設計
 *
 * 利点:
 * - sudo権限不要で即座に稼働
 * - ファイルベースで管理が容易
 * - PostgreSQLと互換性のあるAPI
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');
const winston = require('winston');

class SQLiteMonitoringAdapter extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            dbPath: config.dbPath || path.join(__dirname, '../../data/monitoring.db'),
            enableWAL: config.enableWAL !== false, // WALモード（パフォーマンス向上）
            busyTimeout: config.busyTimeout || 5000,
            cacheSize: config.cacheSize || 10000,
            ...config
        };

        // ロガー初期化
        this.logger = winston.createLogger({
            level: config.logLevel || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'sqlite-monitoring-adapter' },
            transports: [
                new winston.transports.File({
                    filename: 'logs/sqlite-monitoring.log',
                    maxsize: 10 * 1024 * 1024,
                    maxFiles: 5
                }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });

        this.db = null;
        this.initialized = false;

        this.logger.info('SQLiteMonitoringAdapter作成完了', {
            dbPath: this.config.dbPath
        });
    }

    /**
     * 初期化
     */
    async initialize() {
        try {
            this.logger.info('SQLiteMonitoringAdapter初期化開始');

            // データディレクトリ確認・作成
            const dataDir = path.dirname(this.config.dbPath);
            await fs.mkdir(dataDir, { recursive: true });

            // SQLite接続
            await this.connect();

            // テーブル作成
            await this.createTables();

            // 初期設定
            await this.configureDatabase();

            this.initialized = true;
            this.logger.info('SQLiteMonitoringAdapter初期化完了');
            this.emit('initialized');

        } catch (error) {
            this.logger.error('SQLiteMonitoringAdapter初期化エラー', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * データベース接続
     */
    connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(
                this.config.dbPath,
                sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
                (err) => {
                    if (err) {
                        this.logger.error('SQLite接続エラー', { error: err.message });
                        reject(err);
                    } else {
                        this.logger.info('SQLite接続成功', {
                            dbPath: this.config.dbPath
                        });
                        resolve();
                    }
                }
            );

            // エラーハンドリング
            this.db.on('error', (err) => {
                this.logger.error('SQLiteエラー', { error: err.message });
                this.emit('error', err);
            });
        });
    }

    /**
     * データベース設定
     */
    async configureDatabase() {
        const settings = [];

        // WALモード（パフォーマンス向上）
        if (this.config.enableWAL) {
            settings.push('PRAGMA journal_mode = WAL');
        }

        // 同期モード（バランス重視）
        settings.push('PRAGMA synchronous = NORMAL');

        // キャッシュサイズ
        settings.push(`PRAGMA cache_size = ${this.config.cacheSize}`);

        // ビジータイムアウト
        settings.push(`PRAGMA busy_timeout = ${this.config.busyTimeout}`);

        // 外部キー制約有効化
        settings.push('PRAGMA foreign_keys = ON');

        for (const sql of settings) {
            await this.run(sql);
        }

        this.logger.info('SQLite設定完了', { settings });
    }

    /**
     * テーブル作成
     */
    async createTables() {
        this.logger.info('テーブル作成開始');

        // 1. システムメトリクステーブル
        await this.run(`
            CREATE TABLE IF NOT EXISTS system_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                metric_name TEXT NOT NULL,
                metric_value REAL NOT NULL,
                labels TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // インデックス
        await this.run(`
            CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp
            ON system_metrics(timestamp DESC)
        `);
        await this.run(`
            CREATE INDEX IF NOT EXISTS idx_system_metrics_name
            ON system_metrics(metric_name)
        `);
        await this.run(`
            CREATE INDEX IF NOT EXISTS idx_system_metrics_name_timestamp
            ON system_metrics(metric_name, timestamp DESC)
        `);

        // 2. 生メトリクステーブル
        await this.run(`
            CREATE TABLE IF NOT EXISTS metrics_raw (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                metric_type TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.run(`
            CREATE INDEX IF NOT EXISTS idx_metrics_raw_timestamp
            ON metrics_raw(timestamp DESC)
        `);
        await this.run(`
            CREATE INDEX IF NOT EXISTS idx_metrics_raw_type
            ON metrics_raw(metric_type)
        `);

        // 3. 時間別集約メトリクステーブル
        await this.run(`
            CREATE TABLE IF NOT EXISTS metrics_hourly (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hour DATETIME NOT NULL,
                metric_name TEXT NOT NULL,
                avg_value REAL,
                min_value REAL,
                max_value REAL,
                count INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(hour, metric_name)
            )
        `);

        await this.run(`
            CREATE INDEX IF NOT EXISTS idx_metrics_hourly_hour
            ON metrics_hourly(hour DESC)
        `);
        await this.run(`
            CREATE INDEX IF NOT EXISTS idx_metrics_hourly_name
            ON metrics_hourly(metric_name)
        `);

        // 4. 日次サマリーテーブル
        await this.run(`
            CREATE TABLE IF NOT EXISTS daily_summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL UNIQUE,
                summary_data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.run(`
            CREATE INDEX IF NOT EXISTS idx_daily_summaries_date
            ON daily_summaries(date DESC)
        `);

        // 5. アラート履歴テーブル
        await this.run(`
            CREATE TABLE IF NOT EXISTS alert_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                rule_name TEXT NOT NULL,
                severity TEXT NOT NULL,
                category TEXT,
                message TEXT NOT NULL,
                metrics_snapshot TEXT,
                resolved INTEGER DEFAULT 0,
                resolved_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.run(`
            CREATE INDEX IF NOT EXISTS idx_alert_history_timestamp
            ON alert_history(timestamp DESC)
        `);
        await this.run(`
            CREATE INDEX IF NOT EXISTS idx_alert_history_severity
            ON alert_history(severity)
        `);
        await this.run(`
            CREATE INDEX IF NOT EXISTS idx_alert_history_resolved
            ON alert_history(resolved)
        `);
        await this.run(`
            CREATE INDEX IF NOT EXISTS idx_alert_history_rule_name
            ON alert_history(rule_name)
        `);

        // 6. 最新メトリクスビュー
        await this.run(`
            CREATE VIEW IF NOT EXISTS latest_metrics AS
            SELECT
                metric_name,
                metric_value,
                labels,
                timestamp
            FROM system_metrics
            WHERE id IN (
                SELECT MAX(id)
                FROM system_metrics
                GROUP BY metric_name
            )
        `);

        // 7. アクティブアラートビュー
        await this.run(`
            CREATE VIEW IF NOT EXISTS active_alerts AS
            SELECT
                id,
                rule_name,
                severity,
                category,
                message,
                timestamp,
                (JULIANDAY('now') - JULIANDAY(timestamp)) * 86400 as age_seconds
            FROM alert_history
            WHERE resolved = 0
            ORDER BY timestamp DESC
        `);

        this.logger.info('テーブル作成完了');
    }

    /**
     * SQLクエリ実行（Promise化）
     */
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    /**
     * SQLクエリ実行（単一行取得）
     */
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * SQLクエリ実行（複数行取得）
     */
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * メトリクス保存
     */
    async saveMetric(metricName, metricValue, labels = {}) {
        try {
            const result = await this.run(
                `INSERT INTO system_metrics (metric_name, metric_value, labels, timestamp)
                 VALUES (?, ?, ?, datetime('now'))`,
                [metricName, metricValue, JSON.stringify(labels)]
            );

            this.emit('metric_saved', { metricName, metricValue, labels });
            return result;

        } catch (error) {
            this.logger.error('メトリクス保存エラー', {
                metricName,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * 生メトリクス保存
     */
    async saveRawMetrics(metricType, data) {
        try {
            const result = await this.run(
                `INSERT INTO metrics_raw (metric_type, data, timestamp)
                 VALUES (?, ?, datetime('now'))`,
                [metricType, JSON.stringify(data)]
            );

            return result;

        } catch (error) {
            this.logger.error('生メトリクス保存エラー', {
                metricType,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * 最新メトリクス取得
     */
    async getLatestMetrics() {
        try {
            const rows = await this.all(`
                SELECT metric_name, metric_value, labels, timestamp
                FROM latest_metrics
            `);

            return rows.map(row => ({
                ...row,
                labels: JSON.parse(row.labels || '{}')
            }));

        } catch (error) {
            this.logger.error('最新メトリクス取得エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * メトリクス統計取得
     */
    async getMetricStats(metricName, hours = 24) {
        try {
            const row = await this.get(`
                SELECT
                    ? as metric_name,
                    AVG(metric_value) as avg_value,
                    MIN(metric_value) as min_value,
                    MAX(metric_value) as max_value,
                    COUNT(*) as data_points
                FROM system_metrics
                WHERE metric_name = ?
                  AND timestamp >= datetime('now', '-' || ? || ' hours')
            `, [metricName, metricName, hours]);

            return row;

        } catch (error) {
            this.logger.error('メトリクス統計取得エラー', {
                metricName,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * 時間別集約
     */
    async aggregateHourlyMetrics() {
        try {
            await this.run(`
                INSERT OR REPLACE INTO metrics_hourly (hour, metric_name, avg_value, min_value, max_value, count)
                SELECT
                    datetime(strftime('%Y-%m-%d %H:00:00', timestamp)) as hour,
                    metric_name,
                    AVG(metric_value) as avg_value,
                    MIN(metric_value) as min_value,
                    MAX(metric_value) as max_value,
                    COUNT(*) as count
                FROM system_metrics
                WHERE timestamp >= datetime('now', '-1 hour')
                  AND timestamp < datetime(strftime('%Y-%m-%d %H:00:00', 'now'))
                GROUP BY datetime(strftime('%Y-%m-%d %H:00:00', timestamp)), metric_name
            `);

            this.logger.info('時間別集約完了');

        } catch (error) {
            this.logger.error('時間別集約エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * 古いメトリクス削除
     */
    async cleanupOldMetrics(retentionDays = 30) {
        try {
            const result1 = await this.run(`
                DELETE FROM system_metrics
                WHERE timestamp < datetime('now', '-' || ? || ' days')
            `, [retentionDays]);

            const result2 = await this.run(`
                DELETE FROM metrics_raw
                WHERE timestamp < datetime('now', '-' || ? || ' days')
            `, [retentionDays]);

            this.logger.info('古いメトリクス削除完了', {
                system_metrics_deleted: result1.changes,
                metrics_raw_deleted: result2.changes,
                retentionDays
            });

            return {
                system_metrics_deleted: result1.changes,
                metrics_raw_deleted: result2.changes
            };

        } catch (error) {
            this.logger.error('メトリクス削除エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * アラート保存
     */
    async saveAlert(alert) {
        try {
            const result = await this.run(`
                INSERT INTO alert_history (rule_name, severity, category, message, metrics_snapshot, timestamp)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            `, [
                alert.rule_name,
                alert.severity,
                alert.category || null,
                alert.message,
                JSON.stringify(alert.metrics_snapshot || {})
            ]);

            this.emit('alert_saved', alert);
            return result;

        } catch (error) {
            this.logger.error('アラート保存エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * アクティブアラート取得
     */
    async getActiveAlerts() {
        try {
            const rows = await this.all(`
                SELECT id, rule_name, severity, category, message, timestamp, age_seconds
                FROM active_alerts
            `);

            return rows;

        } catch (error) {
            this.logger.error('アクティブアラート取得エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * 日次サマリー保存
     */
    async saveDailySummary(date, summaryData) {
        try {
            await this.run(`
                INSERT OR REPLACE INTO daily_summaries (date, summary_data, updated_at)
                VALUES (?, ?, datetime('now'))
            `, [date, JSON.stringify(summaryData)]);

            this.logger.info('日次サマリー保存完了', { date });

        } catch (error) {
            this.logger.error('日次サマリー保存エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * データベース統計取得
     */
    async getDatabaseStats() {
        try {
            const stats = {};

            // 各テーブルのレコード数
            const tables = ['system_metrics', 'metrics_raw', 'metrics_hourly', 'daily_summaries', 'alert_history'];

            for (const table of tables) {
                const row = await this.get(`SELECT COUNT(*) as count FROM ${table}`);
                stats[table] = row.count;
            }

            // データベースサイズ
            const fileStats = await fs.stat(this.config.dbPath);
            stats.database_size_bytes = fileStats.size;
            stats.database_size_mb = (fileStats.size / 1024 / 1024).toFixed(2);

            return stats;

        } catch (error) {
            this.logger.error('データベース統計取得エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * データベース最適化
     */
    async optimize() {
        try {
            await this.run('VACUUM');
            await this.run('ANALYZE');
            this.logger.info('データベース最適化完了');

        } catch (error) {
            this.logger.error('データベース最適化エラー', { error: error.message });
            throw error;
        }
    }

    /**
     * クローズ
     */
    close() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve();
                return;
            }

            this.db.close((err) => {
                if (err) {
                    this.logger.error('SQLiteクローズエラー', { error: err.message });
                    reject(err);
                } else {
                    this.logger.info('SQLite接続クローズ完了');
                    this.db = null;
                    resolve();
                }
            });
        });
    }

    /**
     * 接続確認
     */
    async ping() {
        try {
            await this.get('SELECT 1');
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = SQLiteMonitoringAdapter;
