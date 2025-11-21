#!/usr/bin/env node

/**
 * APIパフォーマンスベンチマークツール
 *
 * 目的:
 * - 全APIエンドポイントのレスポンス時間を測定
 * - 95パーセンタイルが500ms以下であることを検証
 * - パフォーマンスレポートを生成
 *
 * 使用方法:
 *   node scripts/benchmark-api.js
 *   MAX_RESPONSE_TIME=500 node scripts/benchmark-api.js
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 設定
const config = {
  maxResponseTime: parseInt(process.env.MAX_RESPONSE_TIME) || 500, // ms
  iterations: parseInt(process.env.BENCHMARK_ITERATIONS) || 100,
  baseUrl: process.env.BACKEND_URL || 'http://localhost:3001',
  apiUrl: process.env.API_URL || 'http://localhost:8001',
  reportDir: path.join(process.cwd(), 'reports'),
};

// テスト対象エンドポイント
const endpoints = [
  // ヘルスチェック
  { method: 'GET', path: '/health', name: 'Health Check', critical: true },

  // レシピAPI
  { method: 'GET', path: '/api/recipes', name: 'Get Recipes', critical: true },
  { method: 'GET', path: '/api/recipes?limit=10&offset=0', name: 'Get Recipes (Paginated)', critical: true },
  { method: 'GET', path: '/api/recipes/search?q=chicken', name: 'Search Recipes', critical: true },

  // カテゴリAPI
  { method: 'GET', path: '/api/categories', name: 'Get Categories', critical: false },

  // Python API
  { method: 'GET', path: '/python-api/health', name: 'Python API Health', critical: true, usePythonApi: true },
  { method: 'GET', path: '/python-api/recipes', name: 'Python API Recipes', critical: false, usePythonApi: true },
];

// パフォーマンステスト結果
const results = {
  timestamp: new Date().toISOString(),
  config: config,
  endpoints: [],
  summary: {
    totalTests: 0,
    passed: 0,
    failed: 0,
    avgResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
  },
};

/**
 * HTTPリクエスト実行
 */
function makeRequest(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const options = {
      method: method,
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      timeout: 30000,
    };

    const req = protocol.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          responseTime: responseTime,
          success: res.statusCode >= 200 && res.statusCode < 400,
        });
      });
    });

    req.on('error', (error) => {
      const responseTime = Date.now() - startTime;
      reject({
        error: error.message,
        responseTime: responseTime,
        success: false,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      reject({
        error: 'Request timeout',
        responseTime: responseTime,
        success: false,
      });
    });

    req.end();
  });
}

/**
 * エンドポイントベンチマーク実行
 */
async function benchmarkEndpoint(endpoint) {
  console.log(`\n📊 ベンチマーク実行: ${endpoint.name}`);
  console.log(`   エンドポイント: ${endpoint.method} ${endpoint.path}`);

  const responseTimes = [];
  const errors = [];
  let successCount = 0;

  const baseUrl = endpoint.usePythonApi ? config.apiUrl : config.baseUrl;
  const url = `${baseUrl}${endpoint.path}`;

  // 複数回実行
  for (let i = 0; i < config.iterations; i++) {
    try {
      const result = await makeRequest(url, endpoint.method);
      responseTimes.push(result.responseTime);

      if (result.success) {
        successCount++;
      } else {
        errors.push(`HTTP ${result.statusCode}`);
      }

      // 進捗表示
      if ((i + 1) % 20 === 0) {
        const avgSoFar = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        process.stdout.write(`   進捗: ${i + 1}/${config.iterations} (平均: ${avgSoFar.toFixed(0)}ms)\r`);
      }
    } catch (error) {
      responseTimes.push(error.responseTime || 30000);
      errors.push(error.error || 'Unknown error');
    }
  }

  // 統計計算
  responseTimes.sort((a, b) => a - b);
  const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const minResponseTime = responseTimes[0];
  const maxResponseTime = responseTimes[responseTimes.length - 1];
  const p50ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.5)];
  const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)];
  const p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)];

  const successRate = (successCount / config.iterations) * 100;
  const passed = p95ResponseTime <= config.maxResponseTime && successRate >= 95;

  const endpointResult = {
    name: endpoint.name,
    method: endpoint.method,
    path: endpoint.path,
    critical: endpoint.critical,
    stats: {
      iterations: config.iterations,
      successCount: successCount,
      successRate: successRate,
      avgResponseTime: avgResponseTime,
      minResponseTime: minResponseTime,
      maxResponseTime: maxResponseTime,
      p50ResponseTime: p50ResponseTime,
      p95ResponseTime: p95ResponseTime,
      p99ResponseTime: p99ResponseTime,
    },
    errors: errors.slice(0, 10), // 最初の10個のエラーのみ保存
    passed: passed,
  };

  // 結果表示
  console.log(`\n   結果:`);
  console.log(`   - 成功率: ${successRate.toFixed(1)}%`);
  console.log(`   - 平均: ${avgResponseTime.toFixed(0)}ms`);
  console.log(`   - 最小/最大: ${minResponseTime}ms / ${maxResponseTime}ms`);
  console.log(`   - P50: ${p50ResponseTime}ms`);
  console.log(`   - P95: ${p95ResponseTime}ms`);
  console.log(`   - P99: ${p99ResponseTime}ms`);
  console.log(`   - 判定: ${passed ? '✅ 合格' : '❌ 不合格'}`);

  if (errors.length > 0) {
    console.log(`   - エラー数: ${errors.length}`);
  }

  results.endpoints.push(endpointResult);
  results.summary.totalTests++;

  if (passed) {
    results.summary.passed++;
  } else {
    results.summary.failed++;
  }

  return endpointResult;
}

/**
 * 全エンドポイントのベンチマーク実行
 */
async function runBenchmarks() {
  console.log('🚀 APIパフォーマンスベンチマーク開始');
  console.log(`   ベースURL: ${config.baseUrl}`);
  console.log(`   Python API URL: ${config.apiUrl}`);
  console.log(`   反復回数: ${config.iterations}`);
  console.log(`   目標レスポンス時間: ${config.maxResponseTime}ms (P95)`);
  console.log('='.repeat(60));

  const startTime = Date.now();

  // 各エンドポイントをベンチマーク
  for (const endpoint of endpoints) {
    try {
      await benchmarkEndpoint(endpoint);
    } catch (error) {
      console.error(`❌ ベンチマーク失敗: ${endpoint.name}`, error.message);
      results.endpoints.push({
        name: endpoint.name,
        method: endpoint.method,
        path: endpoint.path,
        critical: endpoint.critical,
        error: error.message,
        passed: false,
      });
      results.summary.totalTests++;
      results.summary.failed++;
    }

    // エンドポイント間に短い待機時間を挟む
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const totalTime = Date.now() - startTime;

  // 全体統計計算
  const allResponseTimes = [];
  results.endpoints.forEach(ep => {
    if (ep.stats && ep.stats.avgResponseTime) {
      allResponseTimes.push(ep.stats.avgResponseTime);
    }
  });

  if (allResponseTimes.length > 0) {
    results.summary.avgResponseTime = allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length;

    const allP95 = results.endpoints
      .filter(ep => ep.stats && ep.stats.p95ResponseTime)
      .map(ep => ep.stats.p95ResponseTime);
    results.summary.p95ResponseTime = allP95.reduce((a, b) => a + b, 0) / allP95.length;

    const allP99 = results.endpoints
      .filter(ep => ep.stats && ep.stats.p99ResponseTime)
      .map(ep => ep.stats.p99ResponseTime);
    results.summary.p99ResponseTime = allP99.reduce((a, b) => a + b, 0) / allP99.length;
  }

  results.summary.totalTime = totalTime;

  // レポート出力
  console.log('\n' + '='.repeat(60));
  console.log('📊 ベンチマーク結果サマリー');
  console.log('='.repeat(60));
  console.log(`実行時間: ${(totalTime / 1000).toFixed(1)}秒`);
  console.log(`テスト数: ${results.summary.totalTests}`);
  console.log(`合格: ${results.summary.passed}`);
  console.log(`不合格: ${results.summary.failed}`);
  console.log(`全体平均レスポンス時間: ${results.summary.avgResponseTime.toFixed(0)}ms`);
  console.log(`全体P95レスポンス時間: ${results.summary.p95ResponseTime.toFixed(0)}ms`);
  console.log(`全体P99レスポンス時間: ${results.summary.p99ResponseTime.toFixed(0)}ms`);

  // 不合格エンドポイント一覧
  const failedEndpoints = results.endpoints.filter(ep => !ep.passed && ep.critical);
  if (failedEndpoints.length > 0) {
    console.log('\n⚠️ クリティカルな不合格エンドポイント:');
    failedEndpoints.forEach(ep => {
      console.log(`   - ${ep.name} (${ep.method} ${ep.path})`);
      if (ep.stats) {
        console.log(`     P95: ${ep.stats.p95ResponseTime}ms > ${config.maxResponseTime}ms`);
      }
    });
  }

  // レポートファイル保存
  if (!fs.existsSync(config.reportDir)) {
    fs.mkdirSync(config.reportDir, { recursive: true });
  }

  const reportPath = path.join(config.reportDir, `performance-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 レポート保存: ${reportPath}`);

  // CI/CD用: 品質ゲート判定
  const criticalFailures = failedEndpoints.length;
  if (criticalFailures > 0) {
    console.error(`\n❌ 品質ゲート失敗: ${criticalFailures}個のクリティカルエンドポイントが基準未達成`);
    process.exit(1);
  }

  console.log('\n✅ 品質ゲート合格: 全エンドポイントが基準達成');
  process.exit(0);
}

// メイン実行
if (require.main === module) {
  runBenchmarks().catch(error => {
    console.error('❌ ベンチマーク実行エラー:', error);
    process.exit(1);
  });
}

module.exports = { benchmarkEndpoint, makeRequest };
