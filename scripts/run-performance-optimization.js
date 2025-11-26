#!/usr/bin/env node
/**
 * PersonalCookingRecipe Phase 2b パフォーマンス最適化実行スクリプト
 * 全最適化項目を実行し、ベンチマークテストでパフォーマンス向上を確認
 */

const { databaseOptimizer } = require('../src/utils/database-optimizer');
const { BenchmarkSuite } = require('../src/tests/performance/benchmark-suite');
const { youtubeOptimizer } = require('../src/utils/youtube-optimizer');
const { prometheusMonitor } = require('../src/monitoring/prometheus-config');

async function main() {
    console.log('🚀 PersonalCookingRecipe Phase 2b パフォーマンス最適化開始');
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    
    try {
        // 1. データベース最適化実行
        console.log('📊 ステップ 1: データベース最適化');
        await databaseOptimizer.optimizeIndexes();
        await databaseOptimizer.optimizeQueries();
        console.log('✅ データベース最適化完了\n');
        
        // 2. システム状況確認
        console.log('🔍 ステップ 2: システム診断');
        const diagnostics = await databaseOptimizer.runPerformanceDiagnostics();
        console.log('診断結果:', diagnostics.recommendations);
        console.log('✅ システム診断完了\n');
        
        // 3. YouTube API最適化確認
        console.log('📺 ステップ 3: YouTube API最適化確認');
        const youtubeStats = youtubeOptimizer.getPerformanceStats();
        console.log('YouTube APIパフォーマンス統計:', youtubeStats.metrics);
        console.log('✅ YouTube API確認完了\n');
        
        // 4. ベンチマークテスト実行
        console.log('⚡ ステップ 4: 総合パフォーマンステスト実行');
        const benchmarkSuite = new BenchmarkSuite();
        const benchmarkResults = await benchmarkSuite.runFullBenchmark();
        
        // 5. 結果保存
        await benchmarkSuite.saveResults(`phase2b-optimization-${Date.now()}.json`);
        
        // 6. 最終結果サマリー
        const totalDuration = Date.now() - startTime;
        
        console.log('\n🎉 Phase 2b パフォーマンス最適化完了');
        console.log('='.repeat(60));
        console.log(`⏱️  総実行時間: ${(totalDuration / 1000).toFixed(2)}秒`);
        
        // 成功指標チェック
        const targetsMet = checkPerformanceTargets(benchmarkResults);
        displayFinalResults(targetsMet, benchmarkResults);
        
        // Prometheusメトリクス出力
        console.log('\n📊 Prometheusメトリクス取得可能:');
        console.log('curl http://localhost:5000/metrics');
        
    } catch (error) {
        console.error('❌ 最適化実行エラー:', error.message);
        process.exit(1);
    }
}

function checkPerformanceTargets(benchmarkResults) {
    const targets = {
        jwt_verification: { target: 1.44, actual: benchmarkResults.actual_results.jwt?.verify?.avg, unit: 'ms' },
        db_queries: { target: 100, actual: null, unit: 'ms' },
        redis_operations: { target: 5, actual: null, unit: 'ms' },
        overall_score: { target: 80, actual: benchmarkResults.summary?.performance_score, unit: 'points' }
    };
    
    // データベース平均計算
    if (benchmarkResults.actual_results.database) {
        const dbTimes = Object.values(benchmarkResults.actual_results.database).map(r => r.avg);
        targets.db_queries.actual = dbTimes.reduce((a, b) => a + b, 0) / dbTimes.length;
    }
    
    // Redis平均計算
    if (benchmarkResults.actual_results.redis) {
        const redisTimes = Object.values(benchmarkResults.actual_results.redis).map(r => r.avg);
        targets.redis_operations.actual = redisTimes.reduce((a, b) => a + b, 0) / redisTimes.length;
    }
    
    return targets;
}

function displayFinalResults(targets, benchmarkResults) {
    console.log('\n📈 パフォーマンス目標達成状況:');
    console.log('-'.repeat(50));
    
    let totalScore = 0;
    let maxScore = 0;
    
    for (const [metric, data] of Object.entries(targets)) {
        if (data.actual !== null && data.actual !== undefined) {
            const status = data.actual <= data.target ? '✅' : '❌';
            const achievement = data.actual <= data.target ? '達成' : '未達成';
            
            console.log(`${status} ${metric.replace(/_/g, ' ')}: ${data.actual.toFixed(3)}${data.unit} (目標: ${data.target}${data.unit}) - ${achievement}`);
            
            if (data.actual <= data.target) totalScore += 25;
            maxScore += 25;
        } else {
            console.log(`⚠️  ${metric.replace(/_/g, ' ')}: 測定不可`);
        }
    }
    
    console.log('-'.repeat(50));
    console.log(`🏆 総合スコア: ${totalScore}/${maxScore} (${((totalScore/maxScore)*100).toFixed(1)}%)`);
    
    if (totalScore === maxScore) {
        console.log('🎊 すべてのパフォーマンス目標を達成しました！');
    } else {
        console.log('📝 一部の目標が未達成です。追加最適化を検討してください。');
    }
    
    // 改善推奨事項
    if (benchmarkResults.recommendations && benchmarkResults.recommendations.length > 0) {
        console.log('\n💡 改善推奨事項:');
        benchmarkResults.recommendations.forEach((rec, index) => {
            console.log(`  ${index + 1}. ${rec}`);
        });
    }
    
    console.log('\n🔗 関連ファイル:');
    console.log('  - データベース設定: src/config/database-postgresql.js');
    console.log('  - キャッシュ設定: src/middleware/cache.js');
    console.log('  - 圧縮設定: src/middleware/compression.js');
    console.log('  - 監視設定: src/monitoring/prometheus-config.js');
    console.log('  - フロントエンド最適化: webui/next.config.ts');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main, checkPerformanceTargets, displayFinalResults };