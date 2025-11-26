#!/usr/bin/env node
/**
 * SQLite監視システムテスト
 * PersonalCookingRecipe
 */

const SQLiteMonitoringAdapter = require('./SQLiteMonitoringAdapter');
const MetricsCollectorWithSQLite = require('./MetricsCollectorWithSQLite');
const path = require('path');

async function testSQLiteAdapter() {
    console.log('=== SQLiteMonitoringAdapter テスト開始 ===\n');

    const adapter = new SQLiteMonitoringAdapter({
        dbPath: path.join(__dirname, '../../data/test-monitoring.db')
    });

    try {
        // 1. 初期化
        console.log('1. アダプター初期化...');
        await adapter.initialize();
        console.log('✅ 初期化完了\n');

        // 2. 接続テスト
        console.log('2. 接続テスト...');
        const pingResult = await adapter.ping();
        console.log(`✅ Ping: ${pingResult}\n`);

        // 3. メトリクス保存
        console.log('3. メトリクス保存...');
        await adapter.saveMetric('cpu_usage', 45.5, { host: 'localhost' });
        await adapter.saveMetric('memory_usage', 68.2, { host: 'localhost' });
        await adapter.saveMetric('disk_usage', 75.0, { host: 'localhost', mount: '/' });
        console.log('✅ メトリクス保存完了\n');

        // 4. 最新メトリクス取得
        console.log('4. 最新メトリクス取得...');
        const latestMetrics = await adapter.getLatestMetrics();
        console.log('最新メトリクス:', JSON.stringify(latestMetrics, null, 2));
        console.log('✅ 取得完了\n');

        // 5. メトリクス統計取得
        console.log('5. メトリクス統計取得...');
        const stats = await adapter.getMetricStats('cpu_usage', 24);
        console.log('CPU統計:', JSON.stringify(stats, null, 2));
        console.log('✅ 統計取得完了\n');

        // 6. アラート保存
        console.log('6. アラート保存...');
        await adapter.saveAlert({
            rule_name: 'high_cpu_usage',
            severity: 'warning',
            category: 'system',
            message: 'CPU使用率が80%を超えました',
            metrics_snapshot: { cpu_usage: 85.5 }
        });
        console.log('✅ アラート保存完了\n');

        // 7. アクティブアラート取得
        console.log('7. アクティブアラート取得...');
        const activeAlerts = await adapter.getActiveAlerts();
        console.log('アクティブアラート:', JSON.stringify(activeAlerts, null, 2));
        console.log('✅ アラート取得完了\n');

        // 8. データベース統計
        console.log('8. データベース統計取得...');
        const dbStats = await adapter.getDatabaseStats();
        console.log('データベース統計:', JSON.stringify(dbStats, null, 2));
        console.log('✅ 統計取得完了\n');

        // クローズ
        await adapter.close();
        console.log('=== SQLiteMonitoringAdapter テスト完了 ===\n');

    } catch (error) {
        console.error('❌ エラー:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

async function testMetricsCollector() {
    console.log('=== MetricsCollectorWithSQLite テスト開始 ===\n');

    const collector = new MetricsCollectorWithSQLite({
        databaseType: 'sqlite',
        sqlite: {
            dbPath: path.join(__dirname, '../../data/test-monitoring-collector.db')
        },
        enableRedis: false, // Redisは無効化（テスト用）
        enableAlerts: false
    });

    try {
        // 1. 初期化
        console.log('1. コレクター初期化...');
        await collector.initialize();
        console.log('✅ 初期化完了\n');

        // 2. メトリクス収集待機（10秒）
        console.log('2. メトリクス収集待機（10秒）...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        console.log('✅ 収集完了\n');

        // 3. 統計情報取得
        console.log('3. 統計情報取得...');
        const stats = collector.getStats();
        console.log('コレクター統計:', JSON.stringify(stats, null, 2));
        console.log('✅ 統計取得完了\n');

        // 4. データベース統計取得
        console.log('4. データベース統計取得...');
        const dbStats = await collector.getDatabaseStats();
        console.log('データベース統計:', JSON.stringify(dbStats, null, 2));
        console.log('✅ 統計取得完了\n');

        // シャットダウン
        await collector.shutdown();
        console.log('=== MetricsCollectorWithSQLite テスト完了 ===\n');

    } catch (error) {
        console.error('❌ エラー:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

async function main() {
    const testType = process.argv[2] || 'adapter';

    if (testType === 'adapter') {
        await testSQLiteAdapter();
    } else if (testType === 'collector') {
        await testMetricsCollector();
    } else {
        console.log('使用方法:');
        console.log('  node test-sqlite-monitoring.js adapter   # SQLiteアダプターテスト');
        console.log('  node test-sqlite-monitoring.js collector # メトリクスコレクターテスト');
        process.exit(1);
    }
}

main().catch(console.error);
