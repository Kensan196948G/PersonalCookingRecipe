#!/usr/bin/env node

/**
 * Universal Phase Transition System
 *
 * Phase間の自動移行を管理するシステム
 * - 完了条件の自動チェック
 * - バックアップ作成
 * - 通知送信
 * - ロールバック機能
 *
 * @module phase-transition
 * @version 1.0.0
 * @author Claude Code - System Architect
 */

const fs = require('fs').promises;
const path = require('path');
const PhaseManager = require('./phase-manager');

class PhaseTransition {
  constructor() {
    this.manager = new PhaseManager();
    this.backupDir = path.join(__dirname, '../phases/backups');
    this.logDir = path.join(__dirname, '../logs/phase-transitions');
  }

  /**
   * 初期化
   */
  async initialize() {
    await this.ensureDirectories();
    await this.manager.loadConfig();
  }

  /**
   * 必要なディレクトリを作成
   */
  async ensureDirectories() {
    const dirs = [this.backupDir, this.logDir];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        // ディレクトリが既に存在する場合は無視
      }
    }
  }

  /**
   * Phase自動移行のメイン処理
   * @param {object} options - オプション設定
   */
  async autoTransition(options = {}) {
    const {
      requireManualApproval = true,
      createBackup = true,
      sendNotification = true,
      dryRun = false
    } = options;

    await this.initialize();

    const currentPhase = await this.manager.getCurrentPhase();
    const log = [];

    log.push(`[${new Date().toISOString()}] Phase Transition Check Started`);
    log.push(`Current Phase: ${currentPhase.id} - ${currentPhase.name}`);
    log.push(`Status: ${currentPhase.status}`);

    // 1. 完了条件チェック
    log.push('\n--- Phase Completion Check ---');
    const completionCheck = await this.manager.checkPhaseCompletion(currentPhase.id);

    if (!completionCheck.canComplete) {
      log.push('❌ Phase cannot be completed yet');
      log.push(`Reason: ${completionCheck.reason}`);

      if (completionCheck.missingKPIs) {
        log.push('\nMissing KPIs:');
        for (const kpi of completionCheck.missingKPIs) {
          log.push(`  - ${kpi.name}: Target ${kpi.target}, Current ${kpi.actual || 'N/A'}`);
        }
      }

      await this.writeLog(log.join('\n'));
      return {
        success: false,
        canTransition: false,
        reason: completionCheck.reason,
        missingKPIs: completionCheck.missingKPIs
      };
    }

    log.push('✅ Phase completion check passed');
    log.push(`All ${Object.keys(currentPhase.kpis).length} KPIs achieved`);

    // 2. 依存関係チェック (次のPhaseの)
    const nextPhase = await this.manager.getNextPhase();

    if (!nextPhase) {
      log.push('\n⚠️ No next phase available - Current phase is final');
      await this.writeLog(log.join('\n'));
      return {
        success: true,
        canTransition: false,
        reason: 'No next phase available',
        isFinalPhase: true
      };
    }

    log.push(`\n--- Next Phase Dependency Check ---`);
    log.push(`Next Phase: ${nextPhase.id} - ${nextPhase.name}`);

    const dependencyCheck = await this.manager.validateDependencies(nextPhase.id);

    if (!dependencyCheck.valid) {
      log.push('❌ Dependency check failed');
      for (const dep of dependencyCheck.unmetDependencies) {
        log.push(`  - Phase ${dep.id}: ${dep.reason}`);
      }

      await this.writeLog(log.join('\n'));
      return {
        success: false,
        canTransition: false,
        reason: 'Dependencies not met',
        unmetDependencies: dependencyCheck.unmetDependencies
      };
    }

    log.push('✅ All dependencies satisfied');

    // 3. 手動承認チェック
    if (requireManualApproval && !dryRun) {
      log.push('\n--- Manual Approval Required ---');
      log.push('⏳ Waiting for manual approval...');
      log.push('Run with --approve flag to proceed');

      await this.writeLog(log.join('\n'));
      return {
        success: true,
        canTransition: true,
        requiresApproval: true,
        currentPhase,
        nextPhase
      };
    }

    // Dry Runモード
    if (dryRun) {
      log.push('\n--- Dry Run Mode ---');
      log.push('✅ All checks passed - Ready for transition');
      log.push('Run without --dry-run to execute transition');

      await this.writeLog(log.join('\n'));
      return {
        success: true,
        canTransition: true,
        dryRun: true,
        currentPhase,
        nextPhase
      };
    }

    // 4. バックアップ作成
    if (createBackup) {
      log.push('\n--- Backup Creation ---');
      const backupPath = await this.createBackup(currentPhase.id);
      log.push(`✅ Backup created: ${backupPath}`);
    }

    // 5. Phase完了処理
    log.push('\n--- Phase Completion ---');
    const completionResult = await this.manager.completePhase(currentPhase.id);

    if (!completionResult.success) {
      log.push(`❌ Phase completion failed: ${completionResult.reason}`);
      await this.writeLog(log.join('\n'));
      return {
        success: false,
        reason: 'Phase completion failed',
        error: completionResult
      };
    }

    log.push(`✅ Phase ${currentPhase.id} marked as completed`);

    // 6. 次Phase開始
    log.push('\n--- Next Phase Start ---');
    const startResult = await this.manager.startNextPhase();

    if (!startResult.success) {
      log.push(`❌ Failed to start next phase: ${startResult.reason}`);
      await this.writeLog(log.join('\n'));
      return {
        success: false,
        reason: 'Failed to start next phase',
        error: startResult
      };
    }

    log.push(`✅ Phase ${nextPhase.id} started`);
    log.push(`New current phase: ${startResult.currentPhaseId}`);

    // 7. 通知送信
    if (sendNotification) {
      log.push('\n--- Notification ---');
      await this.sendTransitionNotification(currentPhase, nextPhase);
      log.push('✅ Notification sent');
    }

    // 8. 最終ログ
    log.push('\n--- Transition Complete ---');
    log.push(`✅ Successfully transitioned from Phase ${currentPhase.id} to Phase ${nextPhase.id}`);
    log.push(`Completed at: ${new Date().toISOString()}`);

    await this.writeLog(log.join('\n'));

    return {
      success: true,
      transitioned: true,
      previousPhase: currentPhase,
      currentPhase: nextPhase,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * バックアップ作成
   * @param {number} phaseId - Phase ID
   */
  async createBackup(phaseId) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `phase-${phaseId}-backup-${timestamp}.json`;
    const backupPath = path.join(this.backupDir, backupName);

    const config = await this.manager.loadConfig();

    await fs.writeFile(
      backupPath,
      JSON.stringify(config, null, 2),
      'utf8'
    );

    return backupPath;
  }

  /**
   * ログファイルへの書き込み
   * @param {string} content - ログ内容
   */
  async writeLog(content) {
    const timestamp = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `transition-${timestamp}.log`);

    await fs.appendFile(logFile, content + '\n\n', 'utf8');
  }

  /**
   * 通知送信
   * @param {object} fromPhase - 元のPhase
   * @param {object} toPhase - 次のPhase
   */
  async sendTransitionNotification(fromPhase, toPhase) {
    const notification = {
      type: 'phase_transition',
      timestamp: new Date().toISOString(),
      from: {
        id: fromPhase.id,
        name: fromPhase.name,
        status: 'completed'
      },
      to: {
        id: toPhase.id,
        name: toPhase.name,
        status: 'in_progress'
      },
      message: `Phase ${fromPhase.id} (${fromPhase.name}) completed. Phase ${toPhase.id} (${toPhase.name}) started.`
    };

    // Console出力
    console.log('\n' + '='.repeat(80));
    console.log('🎯 PHASE TRANSITION');
    console.log('='.repeat(80));
    console.log(notification.message);
    console.log(`Time: ${new Date(notification.timestamp).toLocaleString('ja-JP')}`);
    console.log('='.repeat(80) + '\n');

    // TODO: Slack, Email, Discord等への通知実装
    // await this.sendSlackNotification(notification);
    // await this.sendEmailNotification(notification);

    return notification;
  }

  /**
   * ロールバック実行
   * @param {string} backupPath - バックアップファイルパス
   */
  async rollback(backupPath) {
    try {
      const backupData = await fs.readFile(backupPath, 'utf8');
      const config = JSON.parse(backupData);

      const configPath = path.join(__dirname, '../config/phases.json');
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

      console.log(`✅ Rollback successful from: ${backupPath}`);
      return { success: true, backupPath };
    } catch (error) {
      console.error(`❌ Rollback failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * バックアップ一覧取得
   */
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = files.filter(f => f.startsWith('phase-') && f.endsWith('.json'));

      const backupList = [];

      for (const file of backups) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);

        backupList.push({
          name: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime
        });
      }

      // 作成日時の降順でソート
      backupList.sort((a, b) => b.created - a.created);

      return backupList;
    } catch (error) {
      console.error(`Failed to list backups: ${error.message}`);
      return [];
    }
  }

  /**
   * 定期チェックの実行
   * @param {number} interval - チェック間隔 (ミリ秒)
   */
  async startPeriodicCheck(interval = 3600000) { // デフォルト: 1時間
    console.log(`Starting periodic phase transition check (interval: ${interval}ms)`);

    const check = async () => {
      console.log(`\n[${new Date().toISOString()}] Running periodic check...`);

      const result = await this.autoTransition({
        requireManualApproval: true,
        createBackup: true,
        sendNotification: true,
        dryRun: false
      });

      if (result.canTransition && result.requiresApproval) {
        console.log('✅ Ready for transition - Manual approval required');
      } else if (result.transitioned) {
        console.log('✅ Automatic transition completed');
      } else {
        console.log('⏳ Not ready for transition yet');
      }
    };

    // 初回実行
    await check();

    // 定期実行
    setInterval(check, interval);
  }
}

// CLI実行
if (require.main === module) {
  const transition = new PhaseTransition();
  const command = process.argv[2];
  const flags = process.argv.slice(3);

  (async () => {
    try {
      switch (command) {
        case 'check':
          console.log('Checking phase transition readiness...\n');
          const dryRun = flags.includes('--dry-run');
          const result = await transition.autoTransition({
            requireManualApproval: true,
            createBackup: true,
            sendNotification: false,
            dryRun
          });
          console.log('\n' + JSON.stringify(result, null, 2));
          break;

        case 'transition':
        case 'execute':
          console.log('Executing phase transition...\n');
          const approve = flags.includes('--approve');

          if (!approve) {
            console.log('❌ Error: --approve flag required for transition');
            console.log('Usage: node phase-transition.js transition --approve');
            process.exit(1);
          }

          const execResult = await transition.autoTransition({
            requireManualApproval: false,
            createBackup: true,
            sendNotification: true,
            dryRun: false
          });

          console.log('\n' + JSON.stringify(execResult, null, 2));
          break;

        case 'rollback':
          const backupPath = flags[0];

          if (!backupPath) {
            console.log('❌ Error: Backup path required');
            console.log('Usage: node phase-transition.js rollback <backup-path>');
            process.exit(1);
          }

          const rollbackResult = await transition.rollback(backupPath);
          console.log(JSON.stringify(rollbackResult, null, 2));
          break;

        case 'backups':
        case 'list-backups':
          const backups = await transition.listBackups();
          console.log(`Found ${backups.length} backup(s):\n`);

          for (const backup of backups) {
            console.log(`- ${backup.name}`);
            console.log(`  Path: ${backup.path}`);
            console.log(`  Size: ${(backup.size / 1024).toFixed(2)} KB`);
            console.log(`  Created: ${backup.created.toLocaleString('ja-JP')}`);
            console.log();
          }
          break;

        case 'watch':
        case 'monitor':
          const intervalArg = flags.find(f => f.startsWith('--interval='));
          const interval = intervalArg
            ? parseInt(intervalArg.split('=')[1]) * 1000
            : 3600000; // デフォルト1時間

          console.log(`Starting phase transition monitor (interval: ${interval / 1000}s)`);
          await transition.startPeriodicCheck(interval);
          break;

        default:
          console.log(`
Universal Phase Transition System - CLI

Usage:
  node phase-transition.js <command> [options]

Commands:
  check [--dry-run]              Phase移行可否をチェック
  transition --approve           Phase移行を実行 (要承認フラグ)
  rollback <backup-path>         バックアップから復元
  backups                        バックアップ一覧表示
  watch [--interval=3600]        定期監視開始 (秒単位)

Options:
  --dry-run                      実行せずにチェックのみ
  --approve                      移行処理を承認
  --interval=<seconds>           チェック間隔 (秒)

Examples:
  # 移行可否チェック (Dry Run)
  node phase-transition.js check --dry-run

  # 移行可否チェック (実際の準備)
  node phase-transition.js check

  # Phase移行実行
  node phase-transition.js transition --approve

  # バックアップ一覧
  node phase-transition.js backups

  # バックアップから復元
  node phase-transition.js rollback ./phases/backups/phase-2-backup-2025-11-21.json

  # 1時間おきに自動チェック
  node phase-transition.js watch --interval=3600

  # 10分おきに自動チェック
  node phase-transition.js watch --interval=600

Workflow:
  1. check --dry-run          # 移行可否を確認
  2. check                    # 実際に準備 (バックアップ作成等)
  3. transition --approve     # 承認して移行実行
  4. backups                  # 必要に応じてバックアップ確認
  5. rollback <path>          # 問題があればロールバック
          `);
      }
    } catch (error) {
      console.error('Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  })();
}

module.exports = PhaseTransition;
