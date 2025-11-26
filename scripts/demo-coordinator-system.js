#!/usr/bin/env node

/**
 * GitHub Actions自動修復調整システム - デモンストレーション
 * 全機能の統合デモ
 */

const GitHubActionsCoordinator = require('./github-actions-coordinator');
const FixSuccessMonitor = require('./fix-success-monitor');
const fs = require('fs').promises;

// カラー出力
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function demo() {
  console.log('\n' + '='.repeat(70));
  console.log(colors.bold(colors.cyan('  🚀 GitHub Actions 自動修復調整・監視システム デモ')));
  console.log('='.repeat(70) + '\n');

  // ステップ1: システム初期化
  console.log(colors.bold('\n📌 ステップ 1: システム初期化\n'));
  console.log('調整システムと監視システムを初期化中...');

  const coordinator = new GitHubActionsCoordinator({
    repoOwner: 'your-username',
    repoName: 'PersonalCookingRecipe',
    intervalMinutes: 30,
    githubToken: null // デモ用にAPI無効
  });

  await coordinator.initialize();
  console.log(colors.green('✅ 初期化完了\n'));
  await sleep(1000);

  // ステップ2: エラー検出シミュレーション
  console.log(colors.bold('\n📌 ステップ 2: エラー検出\n'));
  console.log('GitHub Actionsからエラーを検出中...');
  await sleep(1000);

  const detectedErrors = [
    {
      type: 'build-failure',
      pattern: 'npm-build-error',
      message: 'npm ERR! missing dependency: express@^4.18.0',
      blocking: true,
      frequency: 10,
      timestamp: new Date().toISOString()
    },
    {
      type: 'test-failure',
      pattern: 'jest-test-error',
      message: 'FAIL src/__tests__/api.test.js',
      blocking: false,
      frequency: 6,
      timestamp: new Date().toISOString()
    },
    {
      type: 'security-vulnerability',
      pattern: 'security-vulnerability',
      message: 'High severity vulnerability in lodash@4.17.19',
      blocking: false,
      frequency: 1,
      timestamp: new Date().toISOString()
    },
    {
      type: 'linting-error',
      pattern: 'eslint-error',
      message: 'Expected linebreak before return statement',
      blocking: false,
      frequency: 3,
      timestamp: new Date().toISOString()
    },
    {
      type: 'documentation',
      pattern: 'missing-docs',
      message: 'API endpoint /recipes/:id missing documentation',
      blocking: false,
      frequency: 1,
      timestamp: new Date().toISOString()
    }
  ];

  console.log(colors.yellow(`検出されたエラー: ${detectedErrors.length}件\n`));
  detectedErrors.forEach((err, i) => {
    console.log(`  ${i + 1}. ${err.type}`);
    console.log(`     メッセージ: ${err.message.substring(0, 60)}...`);
  });
  console.log();
  await sleep(1500);

  // ステップ3: エラー優先順位付け
  console.log(colors.bold('\n📌 ステップ 3: エラー優先順位付け\n'));
  console.log('エラーの優先順位を計算中...');
  await sleep(1000);

  const prioritizedErrors = coordinator.prioritizeErrors(detectedErrors);

  console.log(colors.cyan('\n優先順位付け結果:\n'));
  prioritizedErrors.forEach((err, i) => {
    const priorityColor = err.priority >= 100 ? colors.red :
                         err.priority >= 75 ? colors.yellow :
                         err.priority >= 50 ? colors.blue :
                         colors.cyan;

    console.log(`  ${priorityColor(`${i + 1}. ${err.type}`)}`);
    console.log(`     優先順位: ${err.priority}`);
    console.log(`     再試行推奨: ${err.shouldRetry ? '✅' : '⛔'}`);
    console.log(`     ブロッキング: ${err.blocking ? '🚫' : '⚠️'}`);
    console.log();
  });
  await sleep(2000);

  // ステップ4: 修復実行シミュレーション
  console.log(colors.bold('\n📌 ステップ 4: 自動修復実行\n'));

  const fixes = [];
  for (const error of prioritizedErrors) {
    if (!error.shouldRetry) {
      console.log(colors.yellow(`⏭️  スキップ: ${error.type} (成功率が低い)`));
      continue;
    }

    console.log(colors.blue(`🔧 修復試行: ${error.type}...`));
    await sleep(500);

    // 修復シミュレーション
    const fixStrategies = {
      'build-failure': 'npm install --legacy-peer-deps',
      'test-failure': 'jest --clearCache && npm test',
      'security-vulnerability': 'npm audit fix',
      'linting-error': 'npm run lint:fix',
      'documentation': 'Auto-generate API docs'
    };

    const success = Math.random() > 0.2; // 80%の成功率
    const duration = Math.floor(Math.random() * 3000) + 1000;

    const fix = {
      type: error.type,
      errorType: error.type,
      pattern: error.pattern,
      success,
      duration,
      fixApplied: fixStrategies[error.type] || 'Generic fix',
      timestamp: new Date().toISOString()
    };

    fixes.push(fix);

    // モニターに記録
    await coordinator.monitor.recordFix(error.pattern, success, {
      duration,
      errorMessage: error.message,
      fixApplied: fix.fixApplied
    });

    if (success) {
      console.log(colors.green(`   ✅ 成功 (${duration}ms)`));
      console.log(colors.cyan(`   適用: ${fix.fixApplied}`));
    } else {
      console.log(colors.red(`   ❌ 失敗 (${duration}ms)`));
    }
    console.log();
    await sleep(800);
  }

  await sleep(1000);

  // ステップ5: 統計分析
  console.log(colors.bold('\n📌 ステップ 5: 統計分析\n'));
  console.log('修復成功率を分析中...');
  await sleep(1000);

  const overall = coordinator.monitor.getOverallStats();
  console.log(colors.cyan('\n📊 全体統計:\n'));
  console.log(`  総試行回数: ${overall.totalAttempts}`);
  console.log(`  成功回数: ${colors.green(overall.totalSuccesses + '')}`);
  console.log(`  失敗回数: ${colors.red(overall.totalFailures + '')}`);
  console.log(`  成功率: ${colors.bold((overall.overallSuccessRate * 100).toFixed(2) + '%')}`);
  console.log(`  パターン数: ${overall.totalPatterns}`);
  console.log();

  const topPatterns = coordinator.monitor.getTopPatterns(3);
  console.log(colors.cyan('🏆 成功率トップ3:\n'));
  topPatterns.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.pattern}`);
    console.log(`     成功率: ${colors.green((p.successRate * 100).toFixed(2) + '%')}`);
    console.log(`     試行回数: ${p.attempts}`);
    console.log();
  });

  await sleep(1500);

  // ステップ6: レポート生成
  console.log(colors.bold('\n📌 ステップ 6: 実行レポート生成\n'));
  console.log('実行レポートを生成中...');
  await sleep(1000);

  const mockRun = {
    attempt: Math.floor(Math.random() * 100) + 1,
    errors: prioritizedErrors,
    fixes,
    duration: fixes.reduce((sum, f) => sum + f.duration, 0),
    nextRun: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  };

  const report = await coordinator.generateExecutionReport(mockRun);
  console.log(coordinator.generateExecutionSummary(report));

  await sleep(1000);

  // ステップ7: GitHub Issue管理（シミュレーション）
  console.log(colors.bold('\n📌 ステップ 7: GitHub Issue管理\n'));
  console.log('Issue作成・更新をシミュレーション中...');
  await sleep(1000);

  console.log(colors.cyan('\n📝 Issue操作:\n'));
  for (const error of prioritizedErrors.slice(0, 3)) {
    const fixed = fixes.find(f => f.errorType === error.type && f.success);
    const action = fixed ? 'クローズ' : '作成/更新';
    const emoji = fixed ? '✅' : '📝';

    console.log(`  ${emoji} Issue ${action}: 🤖 Auto-Fix: ${error.type}`);
    await sleep(500);
  }
  console.log();
  await sleep(1000);

  // ステップ8: 次回実行スケジュール
  console.log(colors.bold('\n📌 ステップ 8: 次回実行スケジュール\n'));
  const nextRun = new Date(Date.now() + 30 * 60 * 1000);
  console.log(colors.cyan('⏰ スケジューリング:\n'));
  console.log(`  次回実行: ${colors.bold(nextRun.toLocaleString('ja-JP'))}`);
  console.log(`  実行間隔: ${colors.bold('30分')}`);
  console.log(`  スケジュールログ: logs/auto-fix-schedule.log`);
  console.log();

  await sleep(1000);

  // まとめ
  console.log('\n' + '='.repeat(70));
  console.log(colors.bold(colors.green('  ✨ デモ完了')));
  console.log('='.repeat(70) + '\n');

  const successCount = fixes.filter(f => f.success).length;
  const failCount = fixes.filter(f => !f.success).length;
  const demoSuccessRate = fixes.length > 0 ? (successCount / fixes.length * 100).toFixed(2) : 0;

  console.log(colors.cyan('📋 デモ実行サマリー:\n'));
  console.log(`  検出エラー: ${detectedErrors.length}件`);
  console.log(`  修復試行: ${fixes.length}件`);
  console.log(`  修復成功: ${colors.green(successCount + '件')}`);
  console.log(`  修復失敗: ${colors.red(failCount + '件')}`);
  console.log(`  デモ成功率: ${colors.bold(demoSuccessRate + '%')}`);
  console.log();
  console.log(colors.cyan('📁 生成ファイル:\n'));
  console.log(`  - logs/auto-fix-stats.json`);
  console.log(`  - logs/auto-fix-report-${Date.now()}.json`);
  console.log();
  console.log(colors.yellow('💡 次のステップ:\n'));
  console.log(`  1. node scripts/fix-success-monitor.js report`);
  console.log(`  2. node scripts/fix-success-monitor.js top`);
  console.log(`  3. node scripts/github-actions-coordinator.js`);
  console.log();
  console.log(colors.green('✅ 全機能が正常に動作しています！\n'));
}

// エラーハンドリング付きで実行
demo().catch(error => {
  console.error(colors.red('\n❌ デモ実行エラー:'), error.message);
  console.error(error.stack);
  process.exit(1);
});
