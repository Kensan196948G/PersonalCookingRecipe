#!/usr/bin/env node
/**
 * メトリクスコレクター起動スクリプト
 * PersonalCookingRecipe - PM2対応
 */

const MetricsCollectorWithSQLite = require('./MetricsCollectorWithSQLite');
const path = require('path');

// グレースフルシャットダウン
let collector = null;

async function start() {
    console.log('===========================================');
    console.log('PersonalCookingRecipe メトリクスコレクター');
    console.log('===========================================\n');

    try {
        // 設定
        const config = {
            databaseType: process.env.MONITORING_DB || 'sqlite',
            sqlite: {
                dbPath: process.env.SQLITE_DB_PATH ||
                        path.join(__dirname, '../../data/monitoring.db')
            },
            enableRedis: process.env.REDIS_HOST ? true : false,
            metricsRetentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '30')
        };

        console.log('設定:');
        console.log(`  データベース: ${config.databaseType}`);
        if (config.databaseType === 'sqlite') {
            console.log(`  SQLiteパス: ${config.sqlite.dbPath}`);
        }
        console.log(`  Redis: ${config.enableRedis ? '有効' : '無効'}`);
        console.log(`  保持期間: ${config.metricsRetentionDays}日\n`);

        // コレクター起動
        collector = new MetricsCollectorWithSQLite(config);
        await collector.initialize();

        console.log('✅ メトリクスコレクター起動完了\n');
        console.log('統計情報は定期的に収集されます...');

        // 定期的に統計情報を出力（デバッグ用）
        setInterval(() => {
            const stats = collector.getStats();
            console.log(`\n[統計] 収集: ${stats.collectionCount}, DB保存: ${stats.savedToDatabase}, エラー: ${stats.errors}`);
        }, 60000); // 1分毎

    } catch (error) {
        console.error('❌ 起動エラー:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// グレースフルシャットダウン
async function shutdown(signal) {
    console.log(`\n${signal} シグナル受信 - シャットダウン開始`);

    if (collector) {
        try {
            await collector.shutdown();
            console.log('✅ シャットダウン完了');
            process.exit(0);
        } catch (error) {
            console.error('❌ シャットダウンエラー:', error.message);
            process.exit(1);
        }
    } else {
        process.exit(0);
    }
}

// シグナルハンドラー登録
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// 未処理エラー対応
process.on('unhandledRejection', (reason, promise) => {
    console.error('未処理のPromise拒否:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('未処理の例外:', error);
    process.exit(1);
});

// 起動
start().catch(console.error);
