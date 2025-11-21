/**
 * 継続的ベンチマーク・パフォーマンステスト スイート
 * PersonalCookingRecipe Phase 2b パフォーマンス最適化
 */

const request = require('supertest');
const { performance, PerformanceObserver } = require('perf_hooks');
const { initialize } = require('../../config/database-postgresql');
const { prometheusMonitor } = require('../../monitoring/prometheus-config');
const { youtubeOptimizer } = require('../../utils/youtube-optimizer');
const { databaseOptimizer } = require('../../utils/database-optimizer');

class BenchmarkSuite {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            performance_targets: {
                jwt_verification: '< 1.44ms',
                api_response: '< 500ms',
                db_query: '< 100ms',
                redis_operation: '< 5ms',
                cache_hit_ratio: '> 70%'
            },
            actual_results: {},
            recommendations: []
        };
        
        this.performanceMetrics = [];
        this.setupPerformanceObserver();
    }

    setupPerformanceObserver() {
        const obs = new PerformanceObserver((list) => {
            this.performanceMetrics.push(...list.getEntries());
        });
        obs.observe({ entryTypes: ['measure'] });
    }

    // JWT認証パフォーマンステスト
    async testJWTPerformance() {
        console.log('🔐 JWT認証パフォーマンステスト開始...');
        
        const jwt = require('jsonwebtoken');
        const testPayload = { userId: 12345, email: 'test@example.com' };
        const secret = process.env.JWT_SECRET || 'test-secret';
        
        // トークン生成テスト
        const generateTimes = [];
        for (let i = 0; i < 1000; i++) {
            const start = process.hrtime.bigint();
            jwt.sign(testPayload, secret);
            const end = process.hrtime.bigint();
            generateTimes.push(Number(end - start) / 1000000);
        }
        
        // トークン検証テスト
        const token = jwt.sign(testPayload, secret);
        const verifyTimes = [];
        
        // ウォームアップ
        for (let i = 0; i < 100; i++) {
            jwt.verify(token, secret);
        }
        
        // 実測
        for (let i = 0; i < 1000; i++) {
            const start = process.hrtime.bigint();
            jwt.verify(token, secret);
            const end = process.hrtime.bigint();
            verifyTimes.push(Number(end - start) / 1000000);
        }
        
        const results = {
            generate: {
                avg: generateTimes.reduce((a, b) => a + b, 0) / generateTimes.length,
                min: Math.min(...generateTimes),
                max: Math.max(...generateTimes),
                p95: this.percentile(generateTimes, 95),
                p99: this.percentile(generateTimes, 99)
            },
            verify: {
                avg: verifyTimes.reduce((a, b) => a + b, 0) / verifyTimes.length,
                min: Math.min(...verifyTimes),
                max: Math.max(...verifyTimes),
                p95: this.percentile(verifyTimes, 95),
                p99: this.percentile(verifyTimes, 99)
            }
        };
        
        this.results.actual_results.jwt = results;
        
        // 目標達成チェック
        if (results.verify.avg <= 1.44) {
            console.log(`✅ JWT検証: ${results.verify.avg.toFixed(3)}ms (目標: 1.44ms)`);
        } else {
            console.log(`❌ JWT検証: ${results.verify.avg.toFixed(3)}ms (目標: 1.44ms)`);
            this.results.recommendations.push('JWT検証時間が目標を超過しています。キャッシング戦略の見直しを検討してください。');
        }
        
        return results;
    }

    // データベースパフォーマンステスト
    async testDatabasePerformance() {
        console.log('🗄️ データベースパフォーマンステスト開始...');
        
        const connection = await require('../../config/database-postgresql').getConnection();
        
        try {
            const tests = [
                {
                    name: 'simple_select',
                    query: 'SELECT COUNT(*) FROM users',
                    params: []
                },
                {
                    name: 'recipe_search',
                    query: `
                        SELECT r.*, c.name as category_name 
                        FROM recipes r 
                        LEFT JOIN categories c ON r.category_id = c.id 
                        ORDER BY r.created_at DESC 
                        LIMIT 20
                    `,
                    params: []
                },
                {
                    name: 'user_recipes',
                    query: 'SELECT * FROM recipes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
                    params: [1]
                },
                {
                    name: 'recipe_with_ratings',
                    query: `
                        SELECT r.*, AVG(rt.rating) as avg_rating, COUNT(rt.rating) as rating_count
                        FROM recipes r
                        LEFT JOIN recipe_ratings rt ON r.id = rt.recipe_id
                        WHERE r.id = $1
                        GROUP BY r.id
                    `,
                    params: [1]
                }
            ];
            
            const results = {};
            
            for (const test of tests) {
                const times = [];
                
                // ウォームアップ
                for (let i = 0; i < 10; i++) {
                    await connection.query(test.query, test.params);
                }
                
                // 実測
                for (let i = 0; i < 100; i++) {
                    const start = process.hrtime.bigint();
                    await connection.query(test.query, test.params);
                    const end = process.hrtime.bigint();
                    times.push(Number(end - start) / 1000000);
                }
                
                results[test.name] = {
                    avg: times.reduce((a, b) => a + b, 0) / times.length,
                    min: Math.min(...times),
                    max: Math.max(...times),
                    p95: this.percentile(times, 95),
                    p99: this.percentile(times, 99)
                };
                
                console.log(`  ${test.name}: ${results[test.name].avg.toFixed(3)}ms平均`);
            }
            
            this.results.actual_results.database = results;
            
            // 目標達成チェック
            const avgTimes = Object.values(results).map(r => r.avg);
            const overallAvg = avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length;
            
            if (overallAvg <= 100) {
                console.log(`✅ データベース: ${overallAvg.toFixed(3)}ms平均 (目標: 100ms)`);
            } else {
                console.log(`❌ データベース: ${overallAvg.toFixed(3)}ms平均 (目標: 100ms)`);
                this.results.recommendations.push('データベースクエリ時間が目標を超過しています。インデックスの最適化を検討してください。');
            }
            
            return results;
            
        } finally {
            connection.release();
        }
    }

    // Redis パフォーマンステスト
    async testRedisPerformance() {
        console.log('📦 Redisパフォーマンステスト開始...');
        
        const { cacheSet, cacheGet, cacheDel } = require('../../config/database-postgresql');
        
        const operations = ['set', 'get', 'del'];
        const results = {};
        
        for (const operation of operations) {
            const times = [];
            const testKey = `benchmark:${operation}:${Date.now()}`;
            const testValue = JSON.stringify({ test: true, timestamp: Date.now() });
            
            // SET操作テスト
            if (operation === 'set') {
                for (let i = 0; i < 1000; i++) {
                    const start = process.hrtime.bigint();
                    await cacheSet(`${testKey}:${i}`, testValue, 3600);
                    const end = process.hrtime.bigint();
                    times.push(Number(end - start) / 1000000);
                }
            }
            
            // GET操作テスト
            else if (operation === 'get') {
                // まずデータを準備
                for (let i = 0; i < 100; i++) {
                    await cacheSet(`${testKey}:${i}`, testValue, 3600);
                }
                
                for (let i = 0; i < 1000; i++) {
                    const start = process.hrtime.bigint();
                    await cacheGet(`${testKey}:${i % 100}`);
                    const end = process.hrtime.bigint();
                    times.push(Number(end - start) / 1000000);
                }
            }
            
            // DEL操作テスト
            else if (operation === 'del') {
                // まずデータを準備
                for (let i = 0; i < 1000; i++) {
                    await cacheSet(`${testKey}:${i}`, testValue, 3600);
                }
                
                for (let i = 0; i < 1000; i++) {
                    const start = process.hrtime.bigint();
                    await cacheDel(`${testKey}:${i}`);
                    const end = process.hrtime.bigint();
                    times.push(Number(end - start) / 1000000);
                }
            }
            
            results[operation] = {
                avg: times.reduce((a, b) => a + b, 0) / times.length,
                min: Math.min(...times),
                max: Math.max(...times),
                p95: this.percentile(times, 95),
                p99: this.percentile(times, 99)
            };
            
            console.log(`  Redis ${operation}: ${results[operation].avg.toFixed(3)}ms平均`);
        }
        
        this.results.actual_results.redis = results;
        
        // 目標達成チェック
        const avgTimes = Object.values(results).map(r => r.avg);
        const overallAvg = avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length;
        
        if (overallAvg <= 5) {
            console.log(`✅ Redis: ${overallAvg.toFixed(3)}ms平均 (目標: 5ms)`);
        } else {
            console.log(`❌ Redis: ${overallAvg.toFixed(3)}ms平均 (目標: 5ms)`);
            this.results.recommendations.push('Redis操作時間が目標を超過しています。接続設定の最適化を検討してください。');
        }
        
        return results;
    }

    // YouTube API パフォーマンステスト
    async testYouTubeAPIPerformance() {
        console.log('📺 YouTube APIパフォーマンステスト開始...');
        
        const tests = [
            {
                name: 'channel_info',
                operation: () => youtubeOptimizer.getChannelInfo('UCzqfooJY4-5VNMhUXTf6ZdA')
            },
            {
                name: 'video_search',
                operation: () => youtubeOptimizer.searchCookingVideos('鶏肉 レシピ', 5)
            }
        ];
        
        const results = {};
        
        for (const test of tests) {
            try {
                const times = [];
                
                // キャッシュクリア
                await youtubeOptimizer.clearCache();
                
                // 実測（少数回：API制限考慮）
                for (let i = 0; i < 3; i++) {
                    const start = process.hrtime.bigint();
                    await test.operation();
                    const end = process.hrtime.bigint();
                    times.push(Number(end - start) / 1000000);
                    
                    // API制限回避の待機
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                results[test.name] = {
                    avg: times.reduce((a, b) => a + b, 0) / times.length,
                    min: Math.min(...times),
                    max: Math.max(...times)
                };
                
                console.log(`  YouTube ${test.name}: ${results[test.name].avg.toFixed(3)}ms平均`);
                
            } catch (error) {
                console.warn(`⚠️ YouTube API ${test.name} テストスキップ:`, error.message);
                results[test.name] = { error: error.message };
            }
        }
        
        this.results.actual_results.youtube = results;
        return results;
    }

    // 負荷テスト
    async testLoadPerformance(app) {
        console.log('🚀 負荷テスト開始...');
        
        // 認証トークン取得
        const testUser = {
            username: 'benchmarkuser',
            email: 'benchmark@test.com',
            password: 'testpassword123'
        };
        
        let authToken;
        try {
            const authResponse = await request(app)
                .post('/api/auth/register')
                .send(testUser);
            authToken = authResponse.body.token;
        } catch (error) {
            // すでに存在する場合はログイン
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                });
            authToken = loginResponse.body.token;
        }
        
        const endpoints = [
            { path: '/api/recipes', method: 'get', auth: false },
            { path: '/api/recipes', method: 'get', auth: true },
            { path: '/api/recipes/1', method: 'get', auth: false }
        ];
        
        const results = {};
        
        for (const endpoint of endpoints) {
            const times = [];
            const errors = [];
            
            console.log(`  テスト中: ${endpoint.method.toUpperCase()} ${endpoint.path}`);
            
            // 並行リクエスト実行
            const requests = [];
            for (let i = 0; i < 50; i++) {
                const requestPromise = this.makeRequest(app, endpoint, authToken)
                    .then(time => times.push(time))
                    .catch(error => errors.push(error.message));
                requests.push(requestPromise);
            }
            
            await Promise.all(requests);
            
            if (times.length > 0) {
                results[`${endpoint.method}_${endpoint.path.replace(/[^a-zA-Z]/g, '_')}`] = {
                    avg: times.reduce((a, b) => a + b, 0) / times.length,
                    min: Math.min(...times),
                    max: Math.max(...times),
                    success_rate: (times.length / (times.length + errors.length)) * 100,
                    error_count: errors.length
                };
            }
        }
        
        this.results.actual_results.load_test = results;
        return results;
    }

    // 個別リクエストヘルパー
    async makeRequest(app, endpoint, authToken) {
        const start = process.hrtime.bigint();
        
        let request_builder = request(app)[endpoint.method](endpoint.path);
        
        if (endpoint.auth && authToken) {
            request_builder = request_builder.set('Authorization', `Bearer ${authToken}`);
        }
        
        const response = await request_builder;
        const end = process.hrtime.bigint();
        
        if (response.status >= 400) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return Number(end - start) / 1000000;
    }

    // パーセンタイル計算
    percentile(arr, p) {
        const sorted = arr.slice().sort((a, b) => a - b);
        const index = (p / 100) * sorted.length;
        
        if (Math.floor(index) === index) {
            return sorted[index - 1];
        } else {
            return sorted[Math.floor(index)];
        }
    }

    // 総合ベンチマーク実行
    async runFullBenchmark(app = null) {
        console.log('🔄 PersonalCookingRecipe 総合パフォーマンステスト開始...');
        console.log(`開始時刻: ${this.results.timestamp}`);
        
        try {
            // データベース初期化
            await initialize();
            
            // 1. JWT認証テスト
            await this.testJWTPerformance();
            
            // 2. データベーステスト
            await this.testDatabasePerformance();
            
            // 3. Redisテスト
            await this.testRedisPerformance();
            
            // 4. YouTube APIテスト（APIキーが設定されている場合のみ）
            if (process.env.YOUTUBE_API_KEY) {
                await this.testYouTubeAPIPerformance();
            } else {
                console.log('⚠️ YouTube APIテストスキップ: API キー未設定');
            }
            
            // 5. 負荷テスト（アプリケーションが提供されている場合）
            if (app) {
                await this.testLoadPerformance(app);
            }
            
            // 結果サマリー
            this.generateSummary();
            
            console.log('✅ 総合パフォーマンステスト完了');
            return this.results;
            
        } catch (error) {
            console.error('❌ ベンチマークテストエラー:', error.message);
            this.results.error = error.message;
            return this.results;
        }
    }

    // 結果サマリー生成
    generateSummary() {
        const summary = {
            overall_status: 'PASS',
            failed_targets: [],
            performance_score: 100
        };
        
        // JWT目標チェック
        if (this.results.actual_results.jwt && 
            this.results.actual_results.jwt.verify.avg > 1.44) {
            summary.overall_status = 'FAIL';
            summary.failed_targets.push('jwt_verification');
            summary.performance_score -= 20;
        }
        
        // データベース目標チェック
        if (this.results.actual_results.database) {
            const avgTimes = Object.values(this.results.actual_results.database).map(r => r.avg);
            const overallAvg = avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length;
            if (overallAvg > 100) {
                summary.overall_status = 'FAIL';
                summary.failed_targets.push('database_queries');
                summary.performance_score -= 30;
            }
        }
        
        // Redis目標チェック
        if (this.results.actual_results.redis) {
            const avgTimes = Object.values(this.results.actual_results.redis).map(r => r.avg);
            const overallAvg = avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length;
            if (overallAvg > 5) {
                summary.overall_status = 'FAIL';
                summary.failed_targets.push('redis_operations');
                summary.performance_score -= 15;
            }
        }
        
        this.results.summary = summary;
        
        console.log('\n📊 パフォーマンステスト サマリー');
        console.log(`Overall Status: ${summary.overall_status}`);
        console.log(`Performance Score: ${summary.performance_score}/100`);
        if (summary.failed_targets.length > 0) {
            console.log(`Failed Targets: ${summary.failed_targets.join(', ')}`);
        }
        
        if (this.results.recommendations.length > 0) {
            console.log('\n💡 改善推奨事項:');
            this.results.recommendations.forEach(rec => console.log(`  - ${rec}`));
        }
    }

    // 結果をファイルに保存
    async saveResults(filename = null) {
        const fs = require('fs').promises;
        const path = require('path');
        
        if (!filename) {
            filename = `benchmark-results-${Date.now()}.json`;
        }
        
        const filepath = path.join(__dirname, '../../../logs', filename);
        
        try {
            await fs.writeFile(filepath, JSON.stringify(this.results, null, 2));
            console.log(`📄 ベンチマーク結果保存: ${filepath}`);
        } catch (error) {
            console.error('結果保存エラー:', error.message);
        }
    }
}

module.exports = {
    BenchmarkSuite
};