#!/usr/bin/env node

/**
 * Universal Phase Management System
 *
 * 全Phase (1 - N) に対応した汎用Phase管理システム
 *
 * @module phase-manager
 * @version 1.0.0
 * @author Claude Code - System Architect
 */

const fs = require('fs').promises;
const path = require('path');

class PhaseManager {
  constructor(configPath = null) {
    this.configPath = configPath || path.join(__dirname, '../config/phases.json');
    this.phasesDir = path.join(__dirname, '../phases');
    this.config = null;
  }

  /**
   * 設定ファイルの読み込み
   */
  async loadConfig() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(data);
      return this.config;
    } catch (error) {
      throw new Error(`Failed to load phase configuration: ${error.message}`);
    }
  }

  /**
   * 設定ファイルの保存
   */
  async saveConfig() {
    try {
      this.config.metadata.updatedAt = new Date().toISOString().split('T')[0];
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf8'
      );
      return true;
    } catch (error) {
      throw new Error(`Failed to save phase configuration: ${error.message}`);
    }
  }

  /**
   * 現在のPhaseを取得
   */
  async getCurrentPhase() {
    if (!this.config) await this.loadConfig();

    const currentPhaseId = this.config.currentPhase;
    const phase = this.config.phases.find(p => p.id === currentPhaseId);

    if (!phase) {
      throw new Error(`Current phase ${currentPhaseId} not found`);
    }

    return phase;
  }

  /**
   * 指定IDのPhaseを取得
   * @param {number} id - Phase ID
   */
  async getPhase(id) {
    if (!this.config) await this.loadConfig();

    const phase = this.config.phases.find(p => p.id === id);

    if (!phase) {
      throw new Error(`Phase ${id} not found`);
    }

    return phase;
  }

  /**
   * 次のPhaseを取得
   */
  async getNextPhase() {
    if (!this.config) await this.loadConfig();

    const nextPhaseId = this.config.nextPhase;

    if (!nextPhaseId) {
      return null; // 次のPhaseがない
    }

    const phase = this.config.phases.find(p => p.id === nextPhaseId);

    if (!phase) {
      throw new Error(`Next phase ${nextPhaseId} not found`);
    }

    return phase;
  }

  /**
   * 全Phaseのリストを取得
   * @param {string} status - フィルタするステータス (optional)
   */
  async getAllPhases(status = null) {
    if (!this.config) await this.loadConfig();

    let phases = this.config.phases;

    if (status) {
      phases = phases.filter(p => p.status === status);
    }

    return phases;
  }

  /**
   * Phaseのステータスを更新
   * @param {number} id - Phase ID
   * @param {string} status - 新しいステータス (planned, in_progress, completed, cancelled)
   */
  async updatePhaseStatus(id, status) {
    if (!this.config) await this.loadConfig();

    const validStatuses = ['planned', 'in_progress', 'completed', 'cancelled', 'future'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Valid statuses: ${validStatuses.join(', ')}`);
    }

    const phase = this.config.phases.find(p => p.id === id);

    if (!phase) {
      throw new Error(`Phase ${id} not found`);
    }

    const oldStatus = phase.status;
    phase.status = status;

    // ステータスに応じて日付を更新
    if (status === 'in_progress' && !phase.actualStartDate) {
      phase.actualStartDate = new Date().toISOString().split('T')[0];
    }

    if (status === 'completed' && !phase.actualEndDate) {
      phase.actualEndDate = new Date().toISOString().split('T')[0];
    }

    await this.saveConfig();

    return {
      success: true,
      phaseId: id,
      oldStatus,
      newStatus: status,
      phase
    };
  }

  /**
   * KPIを更新
   * @param {number} phaseId - Phase ID
   * @param {string} kpiKey - KPI識別子
   * @param {object} updates - 更新内容 { actual, status }
   */
  async updateKPI(phaseId, kpiKey, updates) {
    if (!this.config) await this.loadConfig();

    const phase = this.config.phases.find(p => p.id === phaseId);

    if (!phase) {
      throw new Error(`Phase ${phaseId} not found`);
    }

    if (!phase.kpis[kpiKey]) {
      throw new Error(`KPI ${kpiKey} not found in phase ${phaseId}`);
    }

    const kpi = phase.kpis[kpiKey];

    if (updates.actual !== undefined) {
      kpi.actual = updates.actual;
    }

    if (updates.status !== undefined) {
      kpi.status = updates.status;
    }

    await this.saveConfig();

    return {
      success: true,
      phaseId,
      kpiKey,
      kpi
    };
  }

  /**
   * Phase完了処理
   * @param {number} id - Phase ID
   */
  async completePhase(id) {
    if (!this.config) await this.loadConfig();

    const phase = this.config.phases.find(p => p.id === id);

    if (!phase) {
      throw new Error(`Phase ${id} not found`);
    }

    // 完了条件チェック
    const completionCheck = await this.checkPhaseCompletion(id);

    if (!completionCheck.canComplete) {
      return {
        success: false,
        phaseId: id,
        reason: completionCheck.reason,
        missingKPIs: completionCheck.missingKPIs
      };
    }

    // ステータスを完了に更新
    await this.updatePhaseStatus(id, 'completed');

    // 次のPhaseを更新
    if (this.config.currentPhase === id) {
      const nextPhase = this.config.phases.find(p => p.id === id + 1);
      if (nextPhase) {
        this.config.currentPhase = id;
        this.config.nextPhase = id + 1;
      } else {
        this.config.nextPhase = null; // 最終Phase完了
      }
      await this.saveConfig();
    }

    return {
      success: true,
      phaseId: id,
      phase,
      nextPhaseId: this.config.nextPhase
    };
  }

  /**
   * 次Phaseへの移行
   */
  async startNextPhase() {
    if (!this.config) await this.loadConfig();

    const currentPhaseId = this.config.currentPhase;
    const nextPhaseId = this.config.nextPhase;

    if (!nextPhaseId) {
      return {
        success: false,
        reason: 'No next phase available'
      };
    }

    // 現在のPhaseが完了しているかチェック
    const currentPhase = this.config.phases.find(p => p.id === currentPhaseId);
    if (currentPhase && currentPhase.status !== 'completed') {
      return {
        success: false,
        reason: `Current phase ${currentPhaseId} is not completed yet`,
        currentPhaseStatus: currentPhase.status
      };
    }

    // 次のPhaseを開始
    await this.updatePhaseStatus(nextPhaseId, 'in_progress');

    this.config.currentPhase = nextPhaseId;

    // その次のPhaseを設定
    const followingPhase = this.config.phases.find(p => p.id === nextPhaseId + 1);
    this.config.nextPhase = followingPhase ? followingPhase.id : null;

    await this.saveConfig();

    return {
      success: true,
      previousPhaseId: currentPhaseId,
      currentPhaseId: nextPhaseId,
      nextPhaseId: this.config.nextPhase
    };
  }

  /**
   * Phase完了条件のチェック
   * @param {number} id - Phase ID
   */
  async checkPhaseCompletion(id) {
    if (!this.config) await this.loadConfig();

    const phase = this.config.phases.find(p => p.id === id);

    if (!phase) {
      throw new Error(`Phase ${id} not found`);
    }

    const missingKPIs = [];

    // 全KPIが達成されているかチェック
    for (const [key, kpi] of Object.entries(phase.kpis)) {
      if (kpi.status === 'pending' || kpi.actual === null) {
        missingKPIs.push({
          key,
          name: kpi.name,
          target: kpi.target,
          actual: kpi.actual,
          status: kpi.status
        });
      }
    }

    if (missingKPIs.length > 0) {
      return {
        canComplete: false,
        reason: 'Some KPIs are not achieved',
        missingKPIs
      };
    }

    return {
      canComplete: true,
      allKPIsAchieved: true
    };
  }

  /**
   * Phase進捗レポートの生成
   * @param {number} id - Phase ID
   * @param {string} format - レポート形式 (json, markdown, html)
   */
  async generateReport(id, format = 'markdown') {
    if (!this.config) await this.loadConfig();

    const phase = this.config.phases.find(p => p.id === id);

    if (!phase) {
      throw new Error(`Phase ${id} not found`);
    }

    const completionCheck = await this.checkPhaseCompletion(id);
    const kpiProgress = this.calculateKPIProgress(phase);

    const report = {
      phase,
      completionCheck,
      kpiProgress,
      generatedAt: new Date().toISOString()
    };

    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    if (format === 'markdown') {
      return this.generateMarkdownReport(report);
    }

    if (format === 'html') {
      return this.generateHTMLReport(report);
    }

    throw new Error(`Invalid report format: ${format}`);
  }

  /**
   * KPI進捗率の計算
   * @param {object} phase - Phaseオブジェクト
   */
  calculateKPIProgress(phase) {
    const kpis = Object.entries(phase.kpis);
    const total = kpis.length;

    const achieved = kpis.filter(([_, kpi]) =>
      kpi.status === 'achieved' || kpi.status === 'exceeded'
    ).length;

    const pending = kpis.filter(([_, kpi]) =>
      kpi.status === 'pending'
    ).length;

    const failed = kpis.filter(([_, kpi]) =>
      kpi.status === 'failed'
    ).length;

    const progress = total > 0 ? (achieved / total * 100).toFixed(2) : 0;

    return {
      total,
      achieved,
      pending,
      failed,
      progress: parseFloat(progress)
    };
  }

  /**
   * Markdownレポート生成
   */
  generateMarkdownReport(report) {
    const { phase, completionCheck, kpiProgress } = report;

    let md = `# Phase ${phase.id}: ${phase.name}\n\n`;
    md += `**ステータス**: ${phase.status}\n`;
    md += `**期間**: ${phase.startDate} - ${phase.endDate}\n`;
    md += `**説明**: ${phase.description}\n\n`;

    md += `## KPI進捗\n\n`;
    md += `**達成率**: ${kpiProgress.progress}% (${kpiProgress.achieved}/${kpiProgress.total})\n\n`;

    md += `| KPI | 目標 | 実績 | ステータス |\n`;
    md += `|-----|------|------|------------|\n`;

    for (const [key, kpi] of Object.entries(phase.kpis)) {
      const statusEmoji = {
        'achieved': '✅',
        'exceeded': '🎯',
        'pending': '⏳',
        'failed': '❌'
      }[kpi.status] || '❓';

      md += `| ${kpi.name} | ${kpi.target} | ${kpi.actual || 'N/A'} | ${statusEmoji} ${kpi.status} |\n`;
    }

    md += `\n## 成果物\n\n`;
    for (const deliverable of phase.deliverables) {
      md += `- ${deliverable}\n`;
    }

    if (phase.achievements && phase.achievements.length > 0) {
      md += `\n## 実績\n\n`;
      for (const achievement of phase.achievements) {
        md += `- ${achievement}\n`;
      }
    }

    if (!completionCheck.canComplete) {
      md += `\n## 未達成KPI\n\n`;
      for (const kpi of completionCheck.missingKPIs) {
        md += `- **${kpi.name}**: 目標 ${kpi.target}, 現状 ${kpi.actual || 'N/A'}\n`;
      }
    }

    md += `\n---\n`;
    md += `レポート生成日時: ${new Date(report.generatedAt).toLocaleString('ja-JP')}\n`;

    return md;
  }

  /**
   * HTMLレポート生成
   */
  generateHTMLReport(report) {
    const { phase, completionCheck, kpiProgress } = report;

    let html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Phase ${phase.id}: ${phase.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
    .header h1 { margin: 0 0 10px 0; }
    .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 14px; font-weight: bold; }
    .status-completed { background: #10b981; color: white; }
    .status-in_progress { background: #f59e0b; color: white; }
    .status-planned { background: #6b7280; color: white; }
    .card { background: white; padding: 25px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card h2 { margin-top: 0; color: #667eea; }
    .progress-bar { background: #e5e7eb; height: 30px; border-radius: 15px; overflow: hidden; margin: 15px 0; }
    .progress-fill { background: linear-gradient(90deg, #10b981 0%, #059669 100%); height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; transition: width 0.3s ease; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    .kpi-achieved { color: #10b981; }
    .kpi-exceeded { color: #6366f1; }
    .kpi-pending { color: #f59e0b; }
    .kpi-failed { color: #ef4444; }
    ul { line-height: 1.8; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Phase ${phase.id}: ${phase.name}</h1>
    <p><span class="status-badge status-${phase.status}">${phase.status.toUpperCase()}</span></p>
    <p>${phase.description}</p>
    <p>期間: ${phase.startDate} - ${phase.endDate}</p>
  </div>

  <div class="card">
    <h2>KPI 進捗</h2>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${kpiProgress.progress}%">
        ${kpiProgress.progress}%
      </div>
    </div>
    <p>達成: ${kpiProgress.achieved}/${kpiProgress.total} KPIs</p>

    <table>
      <thead>
        <tr>
          <th>KPI</th>
          <th>目標</th>
          <th>実績</th>
          <th>ステータス</th>
        </tr>
      </thead>
      <tbody>`;

    for (const [key, kpi] of Object.entries(phase.kpis)) {
      const statusClass = `kpi-${kpi.status}`;
      const statusEmoji = {
        'achieved': '✅',
        'exceeded': '🎯',
        'pending': '⏳',
        'failed': '❌'
      }[kpi.status] || '❓';

      html += `
        <tr>
          <td><strong>${kpi.name}</strong><br><small>${kpi.description}</small></td>
          <td>${kpi.target}</td>
          <td>${kpi.actual || 'N/A'}</td>
          <td class="${statusClass}">${statusEmoji} ${kpi.status}</td>
        </tr>`;
    }

    html += `
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>成果物</h2>
    <ul>`;

    for (const deliverable of phase.deliverables) {
      html += `<li>${deliverable}</li>`;
    }

    html += `
    </ul>
  </div>`;

    if (phase.achievements && phase.achievements.length > 0) {
      html += `
  <div class="card">
    <h2>実績</h2>
    <ul>`;

      for (const achievement of phase.achievements) {
        html += `<li>${achievement}</li>`;
      }

      html += `
    </ul>
  </div>`;
    }

    if (!completionCheck.canComplete) {
      html += `
  <div class="card" style="border-left: 4px solid #f59e0b;">
    <h2>未達成KPI</h2>
    <ul>`;

      for (const kpi of completionCheck.missingKPIs) {
        html += `<li><strong>${kpi.name}</strong>: 目標 ${kpi.target}, 現状 ${kpi.actual || 'N/A'}</li>`;
      }

      html += `
    </ul>
  </div>`;
    }

    html += `
  <div style="text-align: center; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
    <p>レポート生成日時: ${new Date(report.generatedAt).toLocaleString('ja-JP')}</p>
    <p>Generated by Universal Phase Management System v1.0.0</p>
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * Phase依存関係の検証
   * @param {number} id - Phase ID
   */
  async validateDependencies(id) {
    if (!this.config) await this.loadConfig();

    const phase = this.config.phases.find(p => p.id === id);

    if (!phase) {
      throw new Error(`Phase ${id} not found`);
    }

    if (!phase.dependencies || phase.dependencies.length === 0) {
      return { valid: true, dependencies: [] };
    }

    const unmetDependencies = [];

    for (const depId of phase.dependencies) {
      const depPhase = this.config.phases.find(p => p.id === depId);

      if (!depPhase) {
        unmetDependencies.push({
          id: depId,
          reason: 'Phase not found'
        });
        continue;
      }

      if (depPhase.status !== 'completed') {
        unmetDependencies.push({
          id: depId,
          name: depPhase.name,
          status: depPhase.status,
          reason: 'Dependency not completed'
        });
      }
    }

    return {
      valid: unmetDependencies.length === 0,
      dependencies: phase.dependencies,
      unmetDependencies
    };
  }

  /**
   * 全Phase概要の取得
   */
  async getOverview() {
    if (!this.config) await this.loadConfig();

    const overview = {
      projectName: this.config.projectName,
      projectDescription: this.config.projectDescription,
      currentPhase: this.config.currentPhase,
      nextPhase: this.config.nextPhase,
      totalPhases: this.config.phases.length,
      phases: []
    };

    for (const phase of this.config.phases) {
      const kpiProgress = this.calculateKPIProgress(phase);

      overview.phases.push({
        id: phase.id,
        name: phase.name,
        status: phase.status,
        duration: phase.duration,
        kpiProgress: kpiProgress.progress,
        kpisAchieved: kpiProgress.achieved,
        kpisTotal: kpiProgress.total
      });
    }

    return overview;
  }
}

// CLI実行
if (require.main === module) {
  const manager = new PhaseManager();
  const command = process.argv[2];
  const args = process.argv.slice(3);

  (async () => {
    try {
      switch (command) {
        case 'current':
          const current = await manager.getCurrentPhase();
          console.log(JSON.stringify(current, null, 2));
          break;

        case 'get':
          const id = parseInt(args[0]);
          const phase = await manager.getPhase(id);
          console.log(JSON.stringify(phase, null, 2));
          break;

        case 'list':
          const status = args[0];
          const phases = await manager.getAllPhases(status);
          console.log(JSON.stringify(phases, null, 2));
          break;

        case 'overview':
          const overview = await manager.getOverview();
          console.log(JSON.stringify(overview, null, 2));
          break;

        case 'report':
          const reportId = parseInt(args[0]);
          const format = args[1] || 'markdown';
          const report = await manager.generateReport(reportId, format);
          console.log(report);
          break;

        case 'check':
          const checkId = parseInt(args[0]);
          const completionCheck = await manager.checkPhaseCompletion(checkId);
          console.log(JSON.stringify(completionCheck, null, 2));
          break;

        case 'complete':
          const completeId = parseInt(args[0]);
          const result = await manager.completePhase(completeId);
          console.log(JSON.stringify(result, null, 2));
          break;

        case 'start-next':
          const startResult = await manager.startNextPhase();
          console.log(JSON.stringify(startResult, null, 2));
          break;

        case 'update-kpi':
          const phaseId = parseInt(args[0]);
          const kpiKey = args[1];
          const actual = args[2];
          const kpiStatus = args[3] || 'achieved';
          const kpiResult = await manager.updateKPI(phaseId, kpiKey, { actual, status: kpiStatus });
          console.log(JSON.stringify(kpiResult, null, 2));
          break;

        default:
          console.log(`
Universal Phase Management System - CLI

Usage:
  node phase-manager.js <command> [args]

Commands:
  current                           現在のPhaseを表示
  get <id>                          指定IDのPhaseを表示
  list [status]                     全Phase一覧 (オプション: status フィルタ)
  overview                          全Phase概要を表示
  report <id> [format]              Phaseレポート生成 (format: json|markdown|html)
  check <id>                        Phase完了条件チェック
  complete <id>                     Phase完了処理
  start-next                        次Phaseを開始
  update-kpi <phaseId> <kpiKey> <actual> [status]  KPI更新

Examples:
  node phase-manager.js current
  node phase-manager.js get 2
  node phase-manager.js list completed
  node phase-manager.js overview
  node phase-manager.js report 2 markdown
  node phase-manager.js check 3
  node phase-manager.js complete 2
  node phase-manager.js start-next
  node phase-manager.js update-kpi 3 horizontal_scaling "完了" "achieved"
          `);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = PhaseManager;
