#!/usr/bin/env node
/**
 * PostgreSQL監視システム動作確認テストスクリプト
 * PersonalCookingRecipe - ネイティブ監視システム
 *
 * 使用方法:
 *   node src/monitoring/test-monitoring.js
 *
 * テスト項目:
 *   1. PostgreSQL接続テスト
 *   2. Redis接続テスト
 *   3. テーブル存在確認
 *   4. メトリクス書き込みテスト
 *   5. メトリクス読み込みテスト
 *   6. アラート履歴テスト
 *   7. 集約関数テスト
 *   8. マテリアライズドビュー更新テスト
 */

const { Pool } = require('pg');
const Redis = require('ioredis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../..', '.env') });

// 色定義
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m'
};

// ログ関数
const log = {
    info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
    test: (msg) => console.log(`${colors.magenta}[TEST]${colors.reset} ${msg}`)
};

// テスト結果
const results = {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
};

// テスト実行関数
async function runTest(name, testFn) {
    results.total++;
    log.test(`実行中: ${name}`);

    try {
        const result = await testFn();
        if (result === 'warning') {
            results.warnings++;
            log.warning(`${name} - 警告`);
        } else {
            results.passed++;
            log.success(`${name} - 成功`);
        }
        return true;
    } catch (error) {
        results.failed++;
        log.error(`${name} - 失敗: ${error.message}`);
        return false;
    }
}

// PostgreSQL接続プール
let pgPool = null;
let redisClient = null;

// テスト1: PostgreSQL接続
async function testPostgresConnection() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'recipe_db',
        user: process.env.DB_USER || 'recipe_user',
        password: process.env.DB_PASSWORD,
        max: 10,
        idleTimeoutMillis: 30000
    };

    pgPool = new Pool(config);

    const client = await pgPool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();

    log.info(`  データベース時刻: ${result.rows[0].current_time}`);
}

// テスト2: Redis接続
async function testRedisConnection() {
    const config = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: 1,
        keyPrefix: 'metrics:'
    };

    redisClient = new Redis(config);

    const pong = await redisClient.ping();
    if (pong !== 'PONG') {
        throw new Error('Redis PING failed');
    }

    log.info('  Redis接続応答: PONG');
}

// テスト3: テーブル存在確認
async function testTablesExist() {
    const expectedTables = [
        'system_metrics',
        'metrics_raw',
        'metrics_hourly',
        'daily_summaries',
        'alert_history'
    ];

    const result = await pgPool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (${expectedTables.map((_, i) => `$${i + 1}`).join(',')})
    `, expectedTables);

    const foundTables = result.rows.map(row => row.table_name);
    const missingTables = expectedTables.filter(t => !foundTables.includes(t));

    if (missingTables.length > 0) {
        throw new Error(`不足しているテーブル: ${missingTables.join(', ')}`);
    }

    log.info(`  確認されたテーブル: ${foundTables.length}/${expectedTables.length}`);
}

// テスト4: ビュー存在確認
async function testViewsExist() {
    const expectedViews = [
        'latest_metrics',
        'active_alerts'
    ];

    const result = await pgPool.query(`
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
          AND table_name IN (${expectedViews.map((_, i) => `$${i + 1}`).join(',')})
    `, expectedViews);

    const foundViews = result.rows.map(row => row.table_name);
    const missingViews = expectedViews.filter(v => !foundViews.includes(v));

    if (missingViews.length > 0) {
        log.warning(`  不足しているビュー: ${missingViews.join(', ')}`);
        return 'warning';
    }

    log.info(`  確認されたビュー: ${foundViews.length}/${expectedViews.length}`);
}

// テスト5: メトリクス書き込み
async function testMetricsWrite() {
    const testMetrics = [
        { name: 'test_cpu_usage', value: 42.5, labels: { test: 'true', host: 'localhost' } },
        { name: 'test_memory_usage', value: 68.3, labels: { test: 'true', host: 'localhost' } },
        { name: 'test_disk_usage', value: 55.1, labels: { test: 'true', mount: '/' } }
    ];

    for (const metric of testMetrics) {
        await pgPool.query(
            `INSERT INTO system_metrics (metric_name, metric_value, labels, timestamp)
             VALUES ($1, $2, $3, NOW())`,
            [metric.name, metric.value, JSON.stringify(metric.labels)]
        );
    }

    log.info(`  書き込みメトリクス数: ${testMetrics.length}`);
}

// テスト6: メトリクス読み込み
async function testMetricsRead() {
    const result = await pgPool.query(`
        SELECT metric_name, metric_value, labels, timestamp
        FROM system_metrics
        WHERE metric_name LIKE 'test_%'
        ORDER BY timestamp DESC
        LIMIT 5
    `);

    if (result.rows.length === 0) {
        throw new Error('テストメトリクスが見つかりません');
    }

    log.info(`  読み込みメトリクス数: ${result.rows.length}`);
    log.info(`  最新メトリクス: ${result.rows[0].metric_name} = ${result.rows[0].metric_value}`);
}

// テスト7: latest_metricsビューテスト
async function testLatestMetricsView() {
    const result = await pgPool.query(`
        SELECT metric_name, metric_value, timestamp
        FROM latest_metrics
        WHERE metric_name LIKE 'test_%'
        LIMIT 3
    `);

    log.info(`  latest_metricsビュー結果: ${result.rows.length} 件`);
}

// テスト8: アラート履歴書き込み
async function testAlertWrite() {
    await pgPool.query(`
        INSERT INTO alert_history (rule_name, severity, category, message, metrics_snapshot)
        VALUES ($1, $2, $3, $4, $5)
    `, [
        'test_alert',
        'warning',
        'test',
        'これはテストアラートです',
        JSON.stringify({ cpu: 42.5, memory: 68.3 })
    ]);

    log.info('  テストアラート書き込み完了');
}

// テスト9: アラート履歴読み込み
async function testAlertRead() {
    const result = await pgPool.query(`
        SELECT id, rule_name, severity, message, timestamp
        FROM alert_history
        WHERE rule_name = 'test_alert'
        ORDER BY timestamp DESC
        LIMIT 1
    `);

    if (result.rows.length === 0) {
        throw new Error('テストアラートが見つかりません');
    }

    log.info(`  アラートID: ${result.rows[0].id}, 重大度: ${result.rows[0].severity}`);
}

// テスト10: active_alertsビューテスト
async function testActiveAlertsView() {
    const result = await pgPool.query(`
        SELECT rule_name, severity, age_seconds
        FROM active_alerts
        WHERE rule_name = 'test_alert'
    `);

    if (result.rows.length > 0) {
        log.info(`  未解決アラート数: ${result.rows.length}`);
        log.info(`  経過時間: ${Math.floor(result.rows[0].age_seconds)} 秒`);
    }
}

// テスト11: 統計関数テスト
async function testMetricStatsFunction() {
    const result = await pgPool.query(`
        SELECT * FROM get_metric_stats('test_cpu_usage', 24)
    `);

    if (result.rows.length === 0) {
        log.warning('  統計データなし（データ不足の可能性）');
        return 'warning';
    }

    const stats = result.rows[0];
    log.info(`  平均: ${parseFloat(stats.avg_value).toFixed(2)}`);
    log.info(`  最小: ${parseFloat(stats.min_value).toFixed(2)}`);
    log.info(`  最大: ${parseFloat(stats.max_value).toFixed(2)}`);
    log.info(`  データポイント: ${stats.data_points}`);
}

// テスト12: Redis書き込み
async function testRedisWrite() {
    if (!redisClient) {
        log.warning('  Redisクライアント未接続（スキップ）');
        return 'warning';
    }

    const testData = {
        timestamp: Date.now(),
        cpu: 42.5,
        memory: 68.3,
        disk: 55.1
    };

    await redisClient.set('test:metrics', JSON.stringify(testData), 'EX', 300);
    log.info('  Redis書き込み完了（TTL: 300秒）');
}

// テスト13: Redis読み込み
async function testRedisRead() {
    if (!redisClient) {
        log.warning('  Redisクライアント未接続（スキップ）');
        return 'warning';
    }

    const value = await redisClient.get('test:metrics');
    if (!value) {
        throw new Error('Redisからデータを読み込めません');
    }

    const data = JSON.parse(value);
    log.info(`  Redis読み込み完了: CPU=${data.cpu}%, Memory=${data.memory}%`);
}

// テスト14: マテリアライズドビュー更新
async function testMaterializedViewRefresh() {
    try {
        await pgPool.query('SELECT refresh_metrics_views()');
        log.info('  マテリアライズドビュー更新完了');
    } catch (error) {
        // metrics_last_24h が存在しない場合は警告
        if (error.message.includes('does not exist')) {
            log.warning('  マテリアライズドビュー未作成（通常ビューのみ）');
            return 'warning';
        }
        throw error;
    }
}

// テスト15: クリーンアップ（テストデータ削除）
async function testCleanup() {
    // テストメトリクス削除
    const metricsResult = await pgPool.query(`
        DELETE FROM system_metrics WHERE metric_name LIKE 'test_%'
    `);

    // テストアラート削除
    const alertsResult = await pgPool.query(`
        DELETE FROM alert_history WHERE rule_name = 'test_alert'
    `);

    log.info(`  削除されたメトリクス: ${metricsResult.rowCount} 件`);
    log.info(`  削除されたアラート: ${alertsResult.rowCount} 件`);

    // Redis削除
    if (redisClient) {
        await redisClient.del('test:metrics');
    }
}

// メイン実行
async function main() {
    console.log('');
    log.info('==========================================');
    log.info('PostgreSQL監視システム動作確認テスト');
    log.info('==========================================');
    console.log('');

    try {
        // 接続テスト
        await runTest('1. PostgreSQL接続テスト', testPostgresConnection);
        await runTest('2. Redis接続テスト', testRedisConnection);

        // スキーマ確認
        await runTest('3. テーブル存在確認', testTablesExist);
        await runTest('4. ビュー存在確認', testViewsExist);

        // メトリクステスト
        await runTest('5. メトリクス書き込みテスト', testMetricsWrite);
        await runTest('6. メトリクス読み込みテスト', testMetricsRead);
        await runTest('7. latest_metricsビューテスト', testLatestMetricsView);

        // アラートテスト
        await runTest('8. アラート履歴書き込みテスト', testAlertWrite);
        await runTest('9. アラート履歴読み込みテスト', testAlertRead);
        await runTest('10. active_alertsビューテスト', testActiveAlertsView);

        // 関数テスト
        await runTest('11. 統計関数テスト', testMetricStatsFunction);

        // Redisテスト
        await runTest('12. Redis書き込みテスト', testRedisWrite);
        await runTest('13. Redis読み込みテスト', testRedisRead);

        // 高度な機能テスト
        await runTest('14. マテリアライズドビュー更新テスト', testMaterializedViewRefresh);

        // クリーンアップ
        await runTest('15. テストデータクリーンアップ', testCleanup);

    } catch (error) {
        log.error(`予期しないエラー: ${error.message}`);
        results.failed++;
    } finally {
        // 接続クローズ
        if (pgPool) {
            await pgPool.end();
        }
        if (redisClient) {
            await redisClient.quit();
        }
    }

    // テスト結果サマリー
    console.log('');
    log.info('==========================================');
    log.info('テスト結果サマリー');
    log.info('==========================================');
    console.log(`  総テスト数:   ${results.total}`);
    console.log(`  ${colors.green}成功:${colors.reset}         ${results.passed}`);
    console.log(`  ${colors.yellow}警告:${colors.reset}         ${results.warnings}`);
    console.log(`  ${colors.red}失敗:${colors.reset}         ${results.failed}`);
    console.log('');

    if (results.failed === 0) {
        log.success('全テスト完了しました！');
        console.log('');
        log.info('次のステップ:');
        console.log('  1. PM2で監視システムを起動:');
        console.log('     pm2 start ecosystem.config.js --only recipe-monitoring-collector');
        console.log('');
        console.log('  2. 監視ダッシュボードへアクセス:');
        console.log('     http://localhost:5000/monitoring/dashboard');
        console.log('');
        process.exit(0);
    } else {
        log.error(`${results.failed} 件のテストが失敗しました。`);
        log.info('セットアップスクリプトを再実行してください:');
        console.log('  ./backend/scripts/setup-postgresql-monitoring.sh');
        console.log('');
        process.exit(1);
    }
}

// 実行
main().catch(error => {
    log.error(`致命的エラー: ${error.message}`);
    console.error(error);
    process.exit(1);
});
