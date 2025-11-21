#!/usr/bin/env node

/**
 * Lighthouse CI実行ツール
 *
 * 目的:
 * - フロントエンドのパフォーマンス、アクセシビリティ、SEOを測定
 * - Lighthouseスコアが90以上であることを検証
 * - PWA対応状況を確認
 *
 * 使用方法:
 *   node scripts/lighthouse-ci.js
 *   MIN_SCORE=90 node scripts/lighthouse-ci.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 設定
const config = {
  minScore: parseInt(process.env.MIN_SCORE) || 90,
  url: process.env.FRONTEND_URL || 'http://localhost:3000',
  reportDir: path.join(process.cwd(), '.lighthouseci'),
  categories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'],
};

// Lighthouseレポート結果
const results = {
  timestamp: new Date().toISOString(),
  url: config.url,
  scores: {},
  passed: false,
  details: {},
};

/**
 * Lighthouse実行
 */
function runLighthouse() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Lighthouse CI実行開始');
    console.log(`   URL: ${config.url}`);
    console.log(`   最小スコア要件: ${config.minScore}`);
    console.log('='.repeat(60));

    // Lighthouseコマンド構築
    const args = [
      config.url,
      '--output=json',
      '--output=html',
      `--output-path=${path.join(config.reportDir, 'report')}`,
      '--chrome-flags="--headless --no-sandbox --disable-gpu"',
      '--quiet',
    ];

    // Lighthouseプロセス起動
    const lighthouse = spawn('lighthouse', args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    lighthouse.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    lighthouse.stderr.on('data', (data) => {
      stderr += data.toString();
      // Lighthouse進捗表示
      const progress = data.toString().match(/(\d+)%/);
      if (progress) {
        process.stdout.write(`   進捗: ${progress[1]}%\r`);
      }
    });

    lighthouse.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Lighthouse実行失敗 (コード: ${code})\n${stderr}`));
      }
    });

    lighthouse.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Lighthouseレポート解析
 */
function parseReport() {
  const reportPath = path.join(config.reportDir, 'report.json');

  if (!fs.existsSync(reportPath)) {
    throw new Error(`レポートファイルが見つかりません: ${reportPath}`);
  }

  const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

  // スコア抽出
  const categories = reportData.categories;

  Object.keys(categories).forEach((categoryId) => {
    const category = categories[categoryId];
    const score = Math.round(category.score * 100);
    results.scores[categoryId] = score;

    console.log(`   ${category.title}: ${score}/100 ${score >= config.minScore ? '✅' : '❌'}`);
  });

  // 詳細情報抽出
  results.details = {
    performanceMetrics: {
      firstContentfulPaint: reportData.audits['first-contentful-paint']?.displayValue || 'N/A',
      largestContentfulPaint: reportData.audits['largest-contentful-paint']?.displayValue || 'N/A',
      totalBlockingTime: reportData.audits['total-blocking-time']?.displayValue || 'N/A',
      cumulativeLayoutShift: reportData.audits['cumulative-layout-shift']?.displayValue || 'N/A',
      speedIndex: reportData.audits['speed-index']?.displayValue || 'N/A',
    },
    accessibility: {
      score: results.scores.accessibility,
      issues: reportData.audits['accessibility']?.details?.items?.length || 0,
    },
    bestPractices: {
      score: results.scores['best-practices'],
      issues: getFailedAudits(reportData, 'best-practices'),
    },
    seo: {
      score: results.scores.seo,
      issues: getFailedAudits(reportData, 'seo'),
    },
    pwa: {
      score: results.scores.pwa,
      installable: reportData.audits['installable-manifest']?.score === 1,
      serviceWorker: reportData.audits['service-worker']?.score === 1,
      offlineSupport: reportData.audits['works-offline']?.score === 1,
    },
  };

  // 合格判定
  const allScores = Object.values(results.scores);
  const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const minScore = Math.min(...allScores);

  results.passed = minScore >= config.minScore;
  results.avgScore = Math.round(avgScore);
  results.minScore = minScore;

  return results;
}

/**
 * 失敗した監査項目を取得
 */
function getFailedAudits(reportData, categoryId) {
  const category = reportData.categories[categoryId];
  if (!category || !category.auditRefs) {
    return [];
  }

  const failedAudits = category.auditRefs
    .filter(ref => {
      const audit = reportData.audits[ref.id];
      return audit && audit.score !== null && audit.score < 1;
    })
    .map(ref => {
      const audit = reportData.audits[ref.id];
      return {
        id: ref.id,
        title: audit.title,
        score: audit.score,
        description: audit.description,
      };
    });

  return failedAudits.slice(0, 5); // 上位5件のみ
}

/**
 * サマリーレポート生成
 */
function generateSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Lighthouse CI結果サマリー');
  console.log('='.repeat(60));

  console.log('\n🎯 スコア:');
  Object.entries(results.scores).forEach(([category, score]) => {
    const status = score >= config.minScore ? '✅' : '❌';
    console.log(`   ${category}: ${score}/100 ${status}`);
  });

  console.log(`\n📈 総合:`);
  console.log(`   平均スコア: ${results.avgScore}/100`);
  console.log(`   最低スコア: ${results.minScore}/100`);
  console.log(`   判定: ${results.passed ? '✅ 合格' : '❌ 不合格'}`);

  console.log('\n⚡ パフォーマンスメトリクス:');
  Object.entries(results.details.performanceMetrics).forEach(([metric, value]) => {
    console.log(`   ${metric}: ${value}`);
  });

  console.log('\n♿ アクセシビリティ:');
  console.log(`   スコア: ${results.details.accessibility.score}/100`);
  console.log(`   課題数: ${results.details.accessibility.issues}`);

  console.log('\n📱 PWA対応状況:');
  console.log(`   スコア: ${results.details.pwa.score}/100`);
  console.log(`   インストール可能: ${results.details.pwa.installable ? '✅' : '❌'}`);
  console.log(`   Service Worker: ${results.details.pwa.serviceWorker ? '✅' : '❌'}`);
  console.log(`   オフライン対応: ${results.details.pwa.offlineSupport ? '✅' : '❌'}`);

  // 改善推奨項目
  if (results.details.bestPractices.issues.length > 0) {
    console.log('\n⚠️ ベストプラクティス改善推奨:');
    results.details.bestPractices.issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue.title} (スコア: ${Math.round(issue.score * 100)}/100)`);
    });
  }

  if (results.details.seo.issues.length > 0) {
    console.log('\n🔍 SEO改善推奨:');
    results.details.seo.issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue.title} (スコア: ${Math.round(issue.score * 100)}/100)`);
    });
  }

  // レポートファイル保存
  const summaryPath = path.join(config.reportDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 サマリー保存: ${summaryPath}`);

  const htmlReportPath = path.join(config.reportDir, 'report.html');
  if (fs.existsSync(htmlReportPath)) {
    console.log(`📄 HTMLレポート: ${htmlReportPath}`);
  }
}

/**
 * Lighthouse CI実行メイン処理
 */
async function main() {
  try {
    // レポートディレクトリ作成
    if (!fs.existsSync(config.reportDir)) {
      fs.mkdirSync(config.reportDir, { recursive: true });
    }

    // Lighthouse実行
    await runLighthouse();
    console.log('\n✅ Lighthouse実行完了');

    // レポート解析
    console.log('\n📊 レポート解析中...');
    parseReport();

    // サマリー生成
    generateSummary();

    // CI/CD用: 品質ゲート判定
    if (!results.passed) {
      console.error(`\n❌ 品質ゲート失敗: 最低スコア ${results.minScore}/100 < ${config.minScore}/100`);
      process.exit(1);
    }

    console.log('\n✅ 品質ゲート合格: 全カテゴリが基準達成');
    process.exit(0);

  } catch (error) {
    console.error('❌ Lighthouse CI実行エラー:', error.message);

    // Lighthouseがインストールされていない場合のヘルプ
    if (error.message.includes('lighthouse') && error.message.includes('not found')) {
      console.error('\n💡 Lighthouseをインストールしてください:');
      console.error('   npm install -g @lhci/cli@0.12.x');
      console.error('   または');
      console.error('   npm install -g lighthouse');
    }

    process.exit(1);
  }
}

// メイン実行
if (require.main === module) {
  main();
}

module.exports = { runLighthouse, parseReport, generateSummary };
