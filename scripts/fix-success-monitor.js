#!/usr/bin/env node

/**
 * PersonalCookingRecipe - 修復成功率監視システム
 * 自動修復パターンの成功率を追跡し、戦略を最適化
 */

const fs = require('fs').promises;
const path = require('path');

class FixSuccessMonitor {
  constructor(statsPath = null) {
    this.statsPath = statsPath || path.join(__dirname, '../logs/auto-fix-stats.json');
    this.stats = {
      patterns: {},
      overall: {
        totalAttempts: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        lastUpdated: null
      },
      history: []
    };
    this.loaded = false;
  }

  /**
   * 統計データをロード
   */
  async load() {
    try {
      const data = await fs.readFile(this.statsPath, 'utf8');
      this.stats = JSON.parse(data);
      this.loaded = true;
      console.log('✅ 統計データをロード:', this.statsPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📝 新規統計ファイルを作成します');
        await this.save();
      } else {
        console.error('❌ 統計データのロードに失敗:', error.message);
      }
    }
  }

  /**
   * 統計データを保存
   */
  async save() {
    try {
      const dir = path.dirname(this.statsPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        this.statsPath,
        JSON.stringify(this.stats, null, 2),
        'utf8'
      );
      console.log('💾 統計データを保存しました');
    } catch (error) {
      console.error('❌ 統計データの保存に失敗:', error.message);
    }
  }

  /**
   * 修復試行を記録
   * @param {string} pattern - エラーパターン
   * @param {boolean} success - 成功/失敗
   * @param {object} metadata - メタデータ
   */
  async recordFix(pattern, success, metadata = {}) {
    if (!this.loaded) {
      await this.load();
    }

    // パターン別統計を初期化
    if (!this.stats.patterns[pattern]) {
      this.stats.patterns[pattern] = {
        attempts: 0,
        successes: 0,
        failures: 0,
        successRate: 0,
        avgDuration: 0,
        durations: [],
        lastAttempt: null,
        firstSeen: new Date().toISOString()
      };
    }

    const patternStats = this.stats.patterns[pattern];
    patternStats.attempts++;

    if (success) {
      patternStats.successes++;
      this.stats.overall.totalSuccesses++;
    } else {
      patternStats.failures++;
      this.stats.overall.totalFailures++;
    }

    this.stats.overall.totalAttempts++;
    patternStats.successRate = patternStats.successes / patternStats.attempts;
    patternStats.lastAttempt = new Date().toISOString();

    // 実行時間を記録
    if (metadata.duration) {
      patternStats.durations.push(metadata.duration);
      if (patternStats.durations.length > 100) {
        patternStats.durations = patternStats.durations.slice(-100);
      }
      patternStats.avgDuration =
        patternStats.durations.reduce((a, b) => a + b, 0) / patternStats.durations.length;
    }

    // 履歴に追加
    this.stats.history.push({
      timestamp: new Date().toISOString(),
      pattern,
      success,
      duration: metadata.duration,
      errorMessage: metadata.errorMessage,
      fixApplied: metadata.fixApplied
    });

    // 履歴は最新1000件のみ保持
    if (this.stats.history.length > 1000) {
      this.stats.history = this.stats.history.slice(-1000);
    }

    this.stats.overall.lastUpdated = new Date().toISOString();

    await this.save();
  }

  /**
   * パターンの成功率を取得
   * @param {string} pattern - エラーパターン
   * @returns {number} 成功率 (0-1)
   */
  getSuccessRate(pattern) {
    if (!this.stats.patterns[pattern]) {
      return 0;
    }
    return this.stats.patterns[pattern].successRate;
  }

  /**
   * 再試行すべきか判定
   * @param {string} pattern - エラーパターン
   * @param {number} threshold - 成功率の閾値 (デフォルト: 0.3)
   * @returns {boolean} 再試行すべきか
   */
  shouldRetry(pattern, threshold = 0.3) {
    const successRate = this.getSuccessRate(pattern);
    const attempts = this.stats.patterns[pattern]?.attempts || 0;

    // 試行回数が少ない場合は再試行を許可
    if (attempts < 3) {
      return true;
    }

    // 成功率が閾値以上なら再試行
    return successRate >= threshold;
  }

  /**
   * 最も成功率の高いパターンを取得
   * @param {number} topN - 上位N件を取得
   * @returns {Array} パターンと統計情報の配列
   */
  getTopPatterns(topN = 10) {
    return Object.entries(this.stats.patterns)
      .map(([pattern, stats]) => ({ pattern, ...stats }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, topN);
  }

  /**
   * 最も失敗率の高いパターンを取得
   * @param {number} topN - 上位N件を取得
   * @returns {Array} パターンと統計情報の配列
   */
  getWorstPatterns(topN = 10) {
    return Object.entries(this.stats.patterns)
      .map(([pattern, stats]) => ({ pattern, ...stats }))
      .filter(p => p.attempts >= 3) // 十分な試行回数があるもの
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, topN);
  }

  /**
   * 全体統計を取得
   * @returns {object} 統計情報
   */
  getOverallStats() {
    const overall = this.stats.overall;
    return {
      ...overall,
      overallSuccessRate: overall.totalAttempts > 0
        ? overall.totalSuccesses / overall.totalAttempts
        : 0,
      totalPatterns: Object.keys(this.stats.patterns).length
    };
  }

  /**
   * 最近の修復履歴を取得
   * @param {number} count - 取得件数
   * @returns {Array} 履歴データ
   */
  getRecentHistory(count = 20) {
    return this.stats.history.slice(-count).reverse();
  }

  /**
   * 統計レポートを生成
   * @returns {string} レポート文字列
   */
  generateReport() {
    const overall = this.getOverallStats();
    const topPatterns = this.getTopPatterns(5);
    const worstPatterns = this.getWorstPatterns(5);

    let report = '# 自動修復統計レポート\n\n';
    report += `生成日時: ${new Date().toLocaleString('ja-JP')}\n\n`;

    report += '## 全体統計\n\n';
    report += `- 総試行回数: ${overall.totalAttempts}\n`;
    report += `- 成功回数: ${overall.totalSuccesses}\n`;
    report += `- 失敗回数: ${overall.totalFailures}\n`;
    report += `- 成功率: ${(overall.overallSuccessRate * 100).toFixed(2)}%\n`;
    report += `- パターン数: ${overall.totalPatterns}\n\n`;

    report += '## 成功率トップ5\n\n';
    topPatterns.forEach((p, i) => {
      report += `${i + 1}. ${p.pattern}\n`;
      report += `   - 成功率: ${(p.successRate * 100).toFixed(2)}%\n`;
      report += `   - 試行回数: ${p.attempts}\n`;
      report += `   - 平均実行時間: ${p.avgDuration.toFixed(2)}ms\n\n`;
    });

    if (worstPatterns.length > 0) {
      report += '## 要改善パターン\n\n';
      worstPatterns.forEach((p, i) => {
        report += `${i + 1}. ${p.pattern}\n`;
        report += `   - 成功率: ${(p.successRate * 100).toFixed(2)}%\n`;
        report += `   - 試行回数: ${p.attempts}\n`;
        report += `   - 推奨: 修復戦略の見直しが必要\n\n`;
      });
    }

    return report;
  }

  /**
   * 統計をクリア
   */
  async clear() {
    this.stats = {
      patterns: {},
      overall: {
        totalAttempts: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        lastUpdated: null
      },
      history: []
    };
    await this.save();
    console.log('🗑️  統計データをクリアしました');
  }
}

// CLI実行
if (require.main === module) {
  const monitor = new FixSuccessMonitor();

  async function main() {
    const command = process.argv[2];

    switch (command) {
      case 'report':
        await monitor.load();
        console.log(monitor.generateReport());
        break;

      case 'stats':
        await monitor.load();
        console.log('全体統計:', JSON.stringify(monitor.getOverallStats(), null, 2));
        break;

      case 'top':
        await monitor.load();
        console.log('成功率トップ10:');
        monitor.getTopPatterns(10).forEach((p, i) => {
          console.log(`${i + 1}. ${p.pattern}: ${(p.successRate * 100).toFixed(2)}%`);
        });
        break;

      case 'worst':
        await monitor.load();
        console.log('要改善パターン:');
        monitor.getWorstPatterns(10).forEach((p, i) => {
          console.log(`${i + 1}. ${p.pattern}: ${(p.successRate * 100).toFixed(2)}%`);
        });
        break;

      case 'history':
        await monitor.load();
        const count = parseInt(process.argv[3]) || 20;
        console.log(`最近の修復履歴 (${count}件):`);
        monitor.getRecentHistory(count).forEach(h => {
          const status = h.success ? '✅' : '❌';
          console.log(`${status} ${h.timestamp} - ${h.pattern}`);
        });
        break;

      case 'clear':
        await monitor.clear();
        break;

      default:
        console.log('使用方法:');
        console.log('  node fix-success-monitor.js report   - 統計レポート生成');
        console.log('  node fix-success-monitor.js stats    - 全体統計表示');
        console.log('  node fix-success-monitor.js top      - 成功率トップ10');
        console.log('  node fix-success-monitor.js worst    - 要改善パターン');
        console.log('  node fix-success-monitor.js history [N] - 最近の履歴表示');
        console.log('  node fix-success-monitor.js clear    - 統計クリア');
    }
  }

  main().catch(console.error);
}

module.exports = FixSuccessMonitor;
