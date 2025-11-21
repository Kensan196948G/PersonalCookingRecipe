#!/usr/bin/env node
/**
 * JWT認証パフォーマンステスト
 * Phase 1: 3326ms → 500ms 目標達成確認
 * 
 * Author: Performance Test Specialist
 * Date: 2025-08-30
 */

const path = require('path');
const fs = require('fs');

// 環境変数設定
process.env.DB_TYPE = 'postgresql';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'recipe_db';
process.env.DB_USER = 'recipe_user';  
process.env.DB_PASSWORD = 'recipe_secure_password_2024';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.REDIS_PASSWORD = 'redis_secure_password_2024';
process.env.JWT_SECRET = 'phase1_test_jwt_secret_key_for_performance_testing';
process.env.JWT_CACHE_ENABLED = 'true';
process.env.JWT_CACHE_TTL = '3600';

const authModule = require('../backend/src/middleware/auth-optimized');

class JWTPerformanceTester {
    constructor() {
        this.testResults = {
            totalTests: 0,
            successCount: 0,
            failureCount: 0,
            times: [],
            averageTime: 0,
            minTime: Infinity,
            maxTime: 0,
            target: 500 // ms
        };
    }

    // テスト用ユーザーデータ
    getTestUser(id = 1) {
        return {
            id: id,
            username: `testuser${id}`,
            email: `test${id}@example.com`
        };
    }

    // 単一JWT操作テスト
    async testSingleJWTOperation(userId = 1) {
        const startTime = Date.now();
        
        try {
            const user = this.getTestUser(userId);
            
            // 1. JWT生成
            const token = await authModule.generateToken(user);
            
            // 2. JWT検証
            const decoded = await authModule.verifyToken(token);
            
            // 3. 結果検証
            if (decoded.id !== user.id || decoded.username !== user.username) {
                throw new Error('JWT検証結果が一致しません');
            }
            
            const endTime = Date.now();
            const operationTime = endTime - startTime;
            
            return {
                success: true,
                time: operationTime,
                token: token.substring(0, 20) + '...',
                decoded: decoded
            };
            
        } catch (error) {
            const endTime = Date.now();
            return {
                success: false,
                time: endTime - startTime,
                error: error.message
            };
        }
    }

    // 大量テスト実行
    async runBulkPerformanceTest(iterations = 100) {
        console.log('🚀 JWT認証パフォーマンステスト開始');
        console.log(`📊 テスト回数: ${iterations}回`);
        console.log(`🎯 目標時間: 平均${this.testResults.target}ms以下`);
        console.log('=' * 60);

        const startTime = Date.now();
        this.testResults.totalTests = iterations;

        for (let i = 0; i < iterations; i++) {
            const userId = (i % 10) + 1; // 1-10のユーザーIDを循環使用
            const result = await this.testSingleJWTOperation(userId);
            
            if (result.success) {
                this.testResults.successCount++;
                this.testResults.times.push(result.time);
                
                // 最小・最大時間更新
                this.testResults.minTime = Math.min(this.testResults.minTime, result.time);
                this.testResults.maxTime = Math.max(this.testResults.maxTime, result.time);
                
                // 進捗表示
                if ((i + 1) % 10 === 0) {
                    const progress = ((i + 1) / iterations * 100).toFixed(1);
                    console.log(`📈 進捗: ${progress}% (${i + 1}/${iterations}) - 最新: ${result.time}ms`);
                }
                
            } else {
                this.testResults.failureCount++;
                console.error(`❌ テスト${i + 1}失敗: ${result.error} (${result.time}ms)`);
            }
            
            // メモリリーク防止の小休憩
            if (i % 20 === 0 && i > 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        const totalTime = Date.now() - startTime;
        
        // 統計計算
        if (this.testResults.times.length > 0) {
            this.testResults.averageTime = this.testResults.times.reduce((a, b) => a + b, 0) / this.testResults.times.length;
        }

        // 結果レポート生成
        this.generateReport(totalTime);
        
        return this.testResults;
    }

    // パフォーマンス結果レポート生成
    generateReport(totalTime) {
        console.log('\n' + '=' * 60);
        console.log('📊 JWT認証パフォーマンステスト結果');
        console.log('=' * 60);

        console.log(`📈 実行統計:`);
        console.log(`   総テスト数: ${this.testResults.totalTests}`);
        console.log(`   成功数: ${this.testResults.successCount}`);
        console.log(`   失敗数: ${this.testResults.failureCount}`);
        console.log(`   成功率: ${(this.testResults.successCount / this.testResults.totalTests * 100).toFixed(2)}%`);
        console.log(`   全体実行時間: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}秒)`);

        console.log(`\n⏱️ パフォーマンス指標:`);
        console.log(`   平均時間: ${this.testResults.averageTime.toFixed(2)}ms`);
        console.log(`   最小時間: ${this.testResults.minTime}ms`);
        console.log(`   最大時間: ${this.testResults.maxTime}ms`);
        console.log(`   目標時間: ${this.testResults.target}ms`);

        // パーセンタイル計算
        const sortedTimes = this.testResults.times.sort((a, b) => a - b);
        const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
        const p90 = sortedTimes[Math.floor(sortedTimes.length * 0.9)];
        const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];

        console.log(`\n📊 パーセンタイル分布:`);
        console.log(`   50%: ${p50}ms`);
        console.log(`   90%: ${p90}ms`);
        console.log(`   95%: ${p95}ms`);

        // 目標達成判定
        console.log(`\n🎯 目標達成評価:`);
        const avgTargetMet = this.testResults.averageTime <= this.testResults.target;
        const p95TargetMet = p95 <= this.testResults.target * 1.2; // 95%地点は20%余裕
        const successRateMet = (this.testResults.successCount / this.testResults.totalTests) >= 0.95;

        console.log(`   平均時間目標: ${avgTargetMet ? '✅ 達成' : '❌ 未達成'} (${this.testResults.averageTime.toFixed(2)}ms ${avgTargetMet ? '<=' : '>'} ${this.testResults.target}ms)`);
        console.log(`   95%地点目標: ${p95TargetMet ? '✅ 達成' : '❌ 未達成'} (${p95}ms ${p95TargetMet ? '<=' : '>'} ${this.testResults.target * 1.2}ms)`);
        console.log(`   成功率目標: ${successRateMet ? '✅ 達成' : '❌ 未達成'} (${(this.testResults.successCount / this.testResults.totalTests * 100).toFixed(2)}% >= 95%)`);

        const overallSuccess = avgTargetMet && p95TargetMet && successRateMet;
        console.log(`\n🏆 総合評価: ${overallSuccess ? '✅ 合格' : '❌ 不合格'}`);

        if (overallSuccess) {
            console.log(`🎉 Phase 1認証パフォーマンス目標達成！`);
            console.log(`📈 旧システム3326ms → ${this.testResults.averageTime.toFixed(2)}ms (${((1 - this.testResults.averageTime / 3326) * 100).toFixed(1)}%改善)`);
        } else {
            console.log(`⚠️ パフォーマンス改善が必要です`);
            console.log(`📊 推奨対策:`);
            if (!avgTargetMet) console.log(`   - JWT生成処理の最適化`);
            if (!p95TargetMet) console.log(`   - Redisキャッシング戦略見直し`);  
            if (!successRateMet) console.log(`   - エラーハンドリング強化`);
        }

        // 結果ファイル出力
        this.saveResults();
    }

    // テスト結果ファイル保存
    saveResults() {
        const resultsDir = '../logs';
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${resultsDir}/jwt-performance-test-${timestamp}.json`;

        const reportData = {
            timestamp: new Date().toISOString(),
            testConfig: {
                iterations: this.testResults.totalTests,
                target: this.testResults.target,
                cacheEnabled: process.env.JWT_CACHE_ENABLED === 'true'
            },
            results: this.testResults,
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                dbType: process.env.DB_TYPE
            }
        };

        fs.writeFileSync(filename, JSON.stringify(reportData, null, 2));
        console.log(`\n💾 詳細結果保存: ${filename}`);
    }
}

// メイン実行
async function main() {
    const tester = new JWTPerformanceTester();
    
    try {
        // 引数処理
        const iterations = parseInt(process.argv[2]) || 100;
        
        console.log('🔧 Phase 1 JWT認証パフォーマンステスト');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🎯 目標: 3326ms → 500ms (85%改善)`);
        console.log(`🔄 Redis キャッシング: ${process.env.JWT_CACHE_ENABLED === 'true' ? '有効' : '無効'}`);
        console.log(`📊 PostgreSQL統合: ${process.env.DB_TYPE === 'postgresql' ? '有効' : 'SQLite'}`);
        console.log('');

        const results = await tester.runBulkPerformanceTest(iterations);
        
        // 終了コード設定
        const success = results.averageTime <= 500 && (results.successCount / results.totalTests) >= 0.95;
        process.exit(success ? 0 : 1);
        
    } catch (error) {
        console.error('❌ テスト実行エラー:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = JWTPerformanceTester;