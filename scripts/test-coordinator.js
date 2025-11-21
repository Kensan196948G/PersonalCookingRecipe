#!/usr/bin/env node

/**
 * GitHub Actions調整システムのテスト
 */

const GitHubActionsCoordinator = require('./github-actions-coordinator');

async function test() {
  console.log('🧪 GitHub Actions調整システム テスト開始\n');

  const coordinator = new GitHubActionsCoordinator({
    repoOwner: 'test-owner',
    repoName: 'PersonalCookingRecipe',
    intervalMinutes: 30,
    githubToken: null // テストのためAPI無効
  });

  await coordinator.initialize();

  // テストエラーデータ
  const testErrors = [
    {
      type: 'build-failure',
      pattern: 'npm-build-error',
      message: 'Build failed due to missing dependency',
      blocking: true,
      frequency: 8,
      timestamp: new Date().toISOString()
    },
    {
      type: 'test-failure',
      pattern: 'jest-test-error',
      message: 'Test suite failed',
      frequency: 5,
      timestamp: new Date().toISOString()
    },
    {
      type: 'linting-error',
      pattern: 'eslint-error',
      message: 'Linting errors found',
      frequency: 2,
      timestamp: new Date().toISOString()
    },
    {
      type: 'documentation',
      pattern: 'missing-docs',
      message: 'Documentation missing',
      frequency: 1,
      timestamp: new Date().toISOString()
    },
    {
      type: 'security-vulnerability',
      pattern: 'security-vulnerability',
      message: 'Security vulnerability detected',
      blocking: false,
      frequency: 3,
      timestamp: new Date().toISOString()
    }
  ];

  console.log('📊 テストエラーデータ:');
  testErrors.forEach(e => {
    console.log(`  - ${e.type} (頻度: ${e.frequency})`);
  });
  console.log();

  // エラーを優先順位付け
  console.log('⚖️  優先順位付けテスト...\n');
  const prioritized = coordinator.prioritizeErrors(testErrors);

  console.log('\n📋 優先順位付け結果:\n');
  prioritized.forEach((error, index) => {
    const retryStatus = error.shouldRetry ? '✅ 再試行' : '⛔ スキップ';
    console.log(`${index + 1}. ${error.type}`);
    console.log(`   優先順位: ${error.priority}`);
    console.log(`   ブロッキング: ${error.blocking ? 'はい' : 'いいえ'}`);
    console.log(`   頻度: ${error.frequency}`);
    console.log(`   再試行: ${retryStatus}`);
    console.log();
  });

  // 実行レポートテスト
  console.log('📊 実行レポート生成テスト...\n');

  const mockRun = {
    attempt: 1,
    errors: prioritized,
    fixes: [
      {
        type: 'build-failure',
        errorType: 'build-failure',
        success: true,
        duration: 3456,
        fixApplied: 'npm install --legacy-peer-deps'
      },
      {
        type: 'test-failure',
        errorType: 'test-failure',
        success: true,
        duration: 2345,
        fixApplied: 'Updated test configuration'
      },
      {
        type: 'linting-error',
        errorType: 'linting-error',
        success: true,
        duration: 1234,
        fixApplied: 'Applied auto-fix'
      }
    ],
    duration: 12345,
    nextRun: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  };

  // 修復成功を記録
  prioritized.forEach(error => {
    const fix = mockRun.fixes.find(f => f.errorType === error.type);
    if (fix) {
      error.fixed = fix.success;
    }
  });

  const report = await coordinator.generateExecutionReport(mockRun);

  console.log(coordinator.generateExecutionSummary(report));

  // スケジューリングテスト
  console.log('\n⏰ スケジューリングテスト...\n');
  const nextRun = new Date(Date.now() + 30 * 60 * 1000);
  console.log(`次回実行予定: ${nextRun.toLocaleString('ja-JP')}`);
  console.log(`間隔: 30分`);
  console.log();

  // Issue本文生成テスト
  console.log('📝 Issue本文生成テスト...\n');
  const issueBody = coordinator.generateIssueBody(
    prioritized[0],
    mockRun.fixes.filter(f => f.errorType === prioritized[0].type)
  );
  console.log('--- Issue本文プレビュー ---');
  console.log(issueBody);
  console.log('--- End ---\n');

  // 統計情報テスト
  console.log('📈 統計情報テスト...\n');
  const overall = coordinator.monitor.getOverallStats();
  console.log('全体統計:');
  console.log(`  - 総試行回数: ${overall.totalAttempts}`);
  console.log(`  - 成功回数: ${overall.totalSuccesses}`);
  console.log(`  - 失敗回数: ${overall.totalFailures}`);
  console.log(`  - 成功率: ${(overall.overallSuccessRate * 100).toFixed(2)}%`);
  console.log(`  - パターン数: ${overall.totalPatterns}`);
  console.log();

  // 成功率トップパターン
  console.log('🏆 成功率トップ3:\n');
  const topPatterns = coordinator.monitor.getTopPatterns(3);
  topPatterns.forEach((pattern, index) => {
    console.log(`${index + 1}. ${pattern.pattern}`);
    console.log(`   成功率: ${(pattern.successRate * 100).toFixed(2)}%`);
    console.log(`   試行回数: ${pattern.attempts}`);
    console.log();
  });

  console.log('✅ 全テスト完了\n');
}

test().catch(error => {
  console.error('❌ テストエラー:', error.message);
  process.exit(1);
});
