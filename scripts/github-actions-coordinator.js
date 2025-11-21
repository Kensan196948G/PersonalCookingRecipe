#!/usr/bin/env node

/**
 * PersonalCookingRecipe - GitHub Actions自動修復調整システム
 * エラー優先順位付け、タイムアウト管理、Issue統合
 */

// Octokitをオプショナルにロード
let Octokit = null;
try {
  const octokitModule = require('@octokit/rest');
  Octokit = octokitModule.Octokit;
} catch (error) {
  console.warn('⚠️  @octokit/rest not installed. GitHub API features will be disabled.');
  console.warn('   Install with: npm install @octokit/rest');
}

const fs = require('fs').promises;
const path = require('path');
const FixSuccessMonitor = require('./fix-success-monitor');

// カラー出力
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`
};

const log = {
  info: (msg) => console.log(colors.blue('🔧 [COORDINATOR]'), msg),
  success: (msg) => console.log(colors.green('✅ [SUCCESS]'), msg),
  warn: (msg) => console.log(colors.yellow('⚠️  [WARN]'), msg),
  error: (msg) => console.log(colors.red('❌ [ERROR]'), msg),
  debug: (msg) => console.log(colors.cyan('🐛 [DEBUG]'), msg)
};

/**
 * GitHub Actions自動修復調整システム
 */
class GitHubActionsCoordinator {
  constructor(options = {}) {
    this.options = {
      intervalMinutes: 30,
      maxRetries: 3,
      repoOwner: 'your-github-username',
      repoName: 'PersonalCookingRecipe',
      githubToken: process.env.GITHUB_TOKEN,
      ...options
    };

    this.monitor = new FixSuccessMonitor();
    this.octokit = null;
    this.isRunning = false;
    this.currentRun = null;

    // エラー優先順位マッピング
    this.priorityLevels = {
      CRITICAL: 100,
      HIGH: 75,
      MEDIUM: 50,
      LOW: 25
    };

    // エラータイプ別優先順位
    this.errorPriorities = {
      'build-failure': 'CRITICAL',
      'deploy-failure': 'CRITICAL',
      'test-failure': 'HIGH',
      'security-vulnerability': 'HIGH',
      'dependency-error': 'HIGH',
      'linting-error': 'MEDIUM',
      'warning': 'MEDIUM',
      'performance-issue': 'MEDIUM',
      'documentation': 'LOW',
      'style-issue': 'LOW'
    };

    if (this.options.githubToken && Octokit) {
      this.octokit = new Octokit({ auth: this.options.githubToken });
    }
  }

  /**
   * 初期化
   */
  async initialize() {
    log.info('調整システムを初期化中...');
    await this.monitor.load();
    log.success('初期化完了');
  }

  /**
   * エラーの優先順位を計算
   * @param {object} error - エラーオブジェクト
   * @returns {number} 優先順位スコア
   */
  calculatePriority(error) {
    let priority = this.priorityLevels.MEDIUM;

    // エラータイプから基本優先順位を取得
    if (error.type && this.errorPriorities[error.type]) {
      const level = this.errorPriorities[error.type];
      priority = this.priorityLevels[level];
    }

    // 成功率による調整
    const successRate = this.monitor.getSuccessRate(error.pattern || error.type);
    if (successRate > 0.7) {
      priority += 10; // 修復成功率が高いものを優先
    }

    // 頻度による調整
    if (error.frequency && error.frequency > 5) {
      priority += 15; // 頻繁に発生するエラーを優先
    }

    // ブロッキングエラーは最優先
    if (error.blocking) {
      priority += 50;
    }

    return Math.min(priority, 150); // 最大値は150
  }

  /**
   * エラーを優先順位付け
   * @param {Array} errors - エラー配列
   * @returns {Array} 優先順位付けされたエラー
   */
  prioritizeErrors(errors) {
    log.info(`${errors.length}件のエラーを優先順位付け中...`);

    const prioritized = errors
      .map(error => ({
        ...error,
        priority: this.calculatePriority(error),
        shouldRetry: this.monitor.shouldRetry(error.pattern || error.type)
      }))
      .sort((a, b) => b.priority - a.priority);

    // 優先順位でグループ化
    const groups = {
      critical: prioritized.filter(e => e.priority >= 100),
      high: prioritized.filter(e => e.priority >= 75 && e.priority < 100),
      medium: prioritized.filter(e => e.priority >= 50 && e.priority < 75),
      low: prioritized.filter(e => e.priority < 50)
    };

    log.info('優先順位グループ:');
    log.info(`  CRITICAL: ${groups.critical.length}件`);
    log.info(`  HIGH: ${groups.high.length}件`);
    log.info(`  MEDIUM: ${groups.medium.length}件`);
    log.info(`  LOW: ${groups.low.length}件`);

    return prioritized;
  }

  /**
   * 次回実行をスケジュール
   * @param {number} intervalMinutes - 実行間隔（分）
   * @returns {Promise} タイマーPromise
   */
  async scheduleNextRun(intervalMinutes = null) {
    const interval = intervalMinutes || this.options.intervalMinutes;
    const nextRun = new Date(Date.now() + interval * 60 * 1000);

    log.info(`⏰ 次回実行: ${nextRun.toLocaleString('ja-JP')}`);

    // スケジュールログに記録
    const logPath = path.join(__dirname, '../logs/auto-fix-schedule.log');
    await fs.appendFile(
      logPath,
      `Next run: ${nextRun.toISOString()} (in ${interval} minutes)\n`
    );

    return new Promise(resolve => setTimeout(resolve, interval * 60 * 1000));
  }

  /**
   * GitHub Issueを検索
   * @param {string} title - Issueタイトル
   * @returns {object|null} Issue情報
   */
  async findIssue(title) {
    if (!this.octokit) {
      log.warn('GitHub API未設定のためIssue検索をスキップ');
      return null;
    }

    try {
      const query = `repo:${this.options.repoOwner}/${this.options.repoName} is:issue "${title}"`;
      const result = await this.octokit.search.issuesAndPullRequests({ q: query });

      return result.data.items.length > 0 ? result.data.items[0] : null;
    } catch (error) {
      log.error(`Issue検索エラー: ${error.message}`);
      return null;
    }
  }

  /**
   * GitHub Issueを作成
   * @param {string} title - Issueタイトル
   * @param {object} error - エラー情報
   * @returns {object|null} 作成されたIssue
   */
  async createIssue(title, error) {
    if (!this.octokit) {
      log.warn('GitHub API未設定のためIssue作成をスキップ');
      return null;
    }

    try {
      const body = this.generateIssueBody(error);
      const result = await this.octokit.issues.create({
        owner: this.options.repoOwner,
        repo: this.options.repoName,
        title,
        body,
        labels: ['auto-fix', `priority-${error.priorityLevel || 'medium'}`]
      });

      log.success(`Issue作成: #${result.data.number}`);
      return result.data;
    } catch (error) {
      log.error(`Issue作成エラー: ${error.message}`);
      return null;
    }
  }

  /**
   * GitHub Issueを更新
   * @param {number} issueNumber - Issue番号
   * @param {object} updates - 更新内容
   * @returns {object|null} 更新されたIssue
   */
  async updateIssue(issueNumber, updates) {
    if (!this.octokit) {
      log.warn('GitHub API未設定のためIssue更新をスキップ');
      return null;
    }

    try {
      const result = await this.octokit.issues.update({
        owner: this.options.repoOwner,
        repo: this.options.repoName,
        issue_number: issueNumber,
        ...updates
      });

      log.success(`Issue更新: #${issueNumber}`);
      return result.data;
    } catch (error) {
      log.error(`Issue更新エラー: ${error.message}`);
      return null;
    }
  }

  /**
   * Issue本文を生成
   * @param {object} error - エラー情報
   * @param {Array} fixes - 適用された修復
   * @returns {string} Issue本文
   */
  generateIssueBody(error, fixes = []) {
    let body = '## エラー情報\n\n';
    body += `- **タイプ**: ${error.type}\n`;
    body += `- **パターン**: ${error.pattern || 'N/A'}\n`;
    body += `- **優先順位**: ${error.priority || 'N/A'}\n`;
    body += `- **検出日時**: ${error.timestamp || new Date().toISOString()}\n\n`;

    if (error.message) {
      body += '## エラーメッセージ\n\n```\n';
      body += error.message;
      body += '\n```\n\n';
    }

    if (fixes && fixes.length > 0) {
      body += '## 適用された修復\n\n';
      fixes.forEach((fix, i) => {
        body += `${i + 1}. ${fix.description}\n`;
        body += `   - 成功: ${fix.success ? '✅' : '❌'}\n`;
        body += `   - 実行時間: ${fix.duration}ms\n\n`;
      });
    }

    const successRate = this.monitor.getSuccessRate(error.pattern || error.type);
    body += '## 統計情報\n\n';
    body += `- 修復成功率: ${(successRate * 100).toFixed(2)}%\n`;
    body += `- 再試行推奨: ${this.monitor.shouldRetry(error.pattern || error.type) ? 'はい' : 'いいえ'}\n\n`;

    body += '---\n';
    body += '*このIssueは自動生成されました*\n';

    return body;
  }

  /**
   * Issueを管理
   * @param {Array} errors - エラー配列
   * @param {Array} fixes - 修復結果
   */
  async manageIssues(errors, fixes) {
    if (!this.octokit) {
      log.warn('GitHub API未設定のためIssue管理をスキップ');
      return;
    }

    log.info('GitHub Issues を管理中...');

    for (const error of errors) {
      const issueTitle = `🤖 Auto-Fix: ${error.type}`;
      const existing = await this.findIssue(issueTitle);

      const errorFixes = fixes.filter(f => f.errorType === error.type);
      const fixed = errorFixes.some(f => f.success);

      if (existing) {
        // 既存Issue更新
        await this.updateIssue(existing.number, {
          body: this.generateIssueBody(error, errorFixes),
          state: fixed ? 'closed' : 'open'
        });
      } else if (!fixed) {
        // 新規Issue作成（未修復の場合のみ）
        await this.createIssue(issueTitle, error);
      }

      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    log.success('Issue管理完了');
  }

  /**
   * 実行レポートを生成
   * @param {object} run - 実行情報
   * @returns {object} レポート
   */
  async generateExecutionReport(run) {
    const report = {
      timestamp: new Date().toISOString(),
      attempt: run.attempt,
      errorsDetected: run.errors.length,
      errorsFixed: run.fixes.filter(f => f.success).length,
      errorsFailed: run.fixes.filter(f => !f.success).length,
      successRate: run.errors.length > 0
        ? run.fixes.filter(f => f.success).length / run.errors.length
        : 0,
      duration: run.duration,
      nextRun: run.nextRun,
      priorityBreakdown: {
        critical: run.errors.filter(e => e.priority >= 100).length,
        high: run.errors.filter(e => e.priority >= 75 && e.priority < 100).length,
        medium: run.errors.filter(e => e.priority >= 50 && e.priority < 75).length,
        low: run.errors.filter(e => e.priority < 50).length
      },
      errors: run.errors.map(e => ({
        type: e.type,
        priority: e.priority,
        fixed: e.fixed
      })),
      fixes: run.fixes.map(f => ({
        type: f.type,
        success: f.success,
        duration: f.duration
      }))
    };

    // レポートを保存
    const reportPath = path.join(
      __dirname,
      '../logs',
      `auto-fix-report-${Date.now()}.json`
    );
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    log.success(`レポート保存: ${reportPath}`);

    return report;
  }

  /**
   * 実行統計を生成
   * @param {object} report - 実行レポート
   * @returns {string} 統計テキスト
   */
  generateExecutionSummary(report) {
    let summary = '\n' + '='.repeat(60) + '\n';
    summary += '  GitHub Actions 自動修復実行サマリー\n';
    summary += '='.repeat(60) + '\n\n';

    summary += `実行日時: ${new Date(report.timestamp).toLocaleString('ja-JP')}\n`;
    summary += `実行回数: ${report.attempt}\n\n`;

    summary += '【エラー検出】\n';
    summary += `  総数: ${report.errorsDetected}件\n`;
    summary += `  - CRITICAL: ${report.priorityBreakdown.critical}件\n`;
    summary += `  - HIGH: ${report.priorityBreakdown.high}件\n`;
    summary += `  - MEDIUM: ${report.priorityBreakdown.medium}件\n`;
    summary += `  - LOW: ${report.priorityBreakdown.low}件\n\n`;

    summary += '【修復結果】\n';
    summary += `  成功: ${report.errorsFixed}件\n`;
    summary += `  失敗: ${report.errorsFailed}件\n`;
    summary += `  成功率: ${(report.successRate * 100).toFixed(2)}%\n\n`;

    summary += '【実行時間】\n';
    summary += `  総実行時間: ${(report.duration / 1000).toFixed(2)}秒\n`;
    summary += `  次回実行: ${new Date(report.nextRun).toLocaleString('ja-JP')}\n\n`;

    summary += '='.repeat(60) + '\n';

    return summary;
  }

  /**
   * 調整システムを実行
   * @param {Array} errors - 検出されたエラー
   * @returns {object} 実行結果
   */
  async run(errors = []) {
    if (this.isRunning) {
      log.warn('既に実行中です');
      return null;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      log.info('GitHub Actions自動修復調整システム起動');

      // エラーを優先順位付け
      const prioritizedErrors = this.prioritizeErrors(errors);

      // 修復を実行（ここでは実際の修復ロジックは省略）
      const fixes = [];
      for (const error of prioritizedErrors) {
        if (!error.shouldRetry) {
          log.warn(`スキップ: ${error.type} (成功率が低い)`);
          continue;
        }

        log.info(`修復試行: ${error.type} (優先順位: ${error.priority})`);
        // 実際の修復処理を呼び出す
        // const result = await this.applyFix(error);
        // fixes.push(result);

        // モニターに記録
        // await this.monitor.recordFix(error.pattern || error.type, result.success, {
        //   duration: result.duration,
        //   errorMessage: error.message,
        //   fixApplied: result.fixApplied
        // });
      }

      // Issueを管理
      await this.manageIssues(prioritizedErrors, fixes);

      // 実行レポートを生成
      const nextRun = new Date(Date.now() + this.options.intervalMinutes * 60 * 1000);
      this.currentRun = {
        attempt: 1,
        errors: prioritizedErrors,
        fixes,
        duration: Date.now() - startTime,
        nextRun: nextRun.toISOString()
      };

      const report = await this.generateExecutionReport(this.currentRun);
      console.log(this.generateExecutionSummary(report));

      log.success('実行完了');

      return report;
    } catch (error) {
      log.error(`実行エラー: ${error.message}`);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 連続実行ループを開始
   * @param {Function} errorDetector - エラー検出関数
   */
  async startLoop(errorDetector) {
    log.info('連続実行ループを開始します');

    let attempt = 0;
    while (true) {
      attempt++;
      log.info(`\n実行 #${attempt} 開始...`);

      try {
        // エラーを検出
        const errors = await errorDetector();
        log.info(`${errors.length}件のエラーを検出`);

        // 調整システムを実行
        await this.run(errors);

        // 次回実行をスケジュール
        log.info(`${this.options.intervalMinutes}分待機中...`);
        await this.scheduleNextRun();
      } catch (error) {
        log.error(`ループエラー: ${error.message}`);
        log.info('5分後に再試行します...');
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
      }
    }
  }
}

// CLI実行
if (require.main === module) {
  const coordinator = new GitHubActionsCoordinator({
    repoOwner: process.env.GITHUB_REPO_OWNER || 'your-username',
    repoName: process.env.GITHUB_REPO_NAME || 'PersonalCookingRecipe',
    intervalMinutes: parseInt(process.env.AUTO_FIX_INTERVAL) || 30
  });

  async function main() {
    await coordinator.initialize();

    // テストエラーデータ
    const testErrors = [
      { type: 'build-failure', pattern: 'npm-build-error', message: 'Build failed', blocking: true },
      { type: 'test-failure', pattern: 'jest-test-error', message: 'Test suite failed', frequency: 3 },
      { type: 'linting-error', pattern: 'eslint-error', message: 'Linting errors found' },
      { type: 'documentation', pattern: 'missing-docs', message: 'Documentation missing' }
    ];

    await coordinator.run(testErrors);
  }

  main().catch(console.error);
}

module.exports = GitHubActionsCoordinator;
