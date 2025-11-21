#!/usr/bin/env node

/**
 * PersonalCookingRecipe エラー自動修復ループシステム
 * 段階的修復戦略（Level 1-3）による自動エラー修復
 */

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

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
  info: (msg) => console.log(colors.blue('🔧 [REPAIR]'), msg),
  success: (msg) => console.log(colors.green('✅ [SUCCESS]'), msg),
  warn: (msg) => console.log(colors.yellow('⚠️  [WARN]'), msg),
  error: (msg) => console.log(colors.red('❌ [ERROR]'), msg),
  debug: (msg) => console.log(colors.cyan('🐛 [DEBUG]'), msg)
};

/**
 * エラー自動修復システム
 */
class AutoRepairSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      maxRetries: 3,
      retryDelay: 5000,
      timeoutMs: 60000,
      ...options
    };
    
    this.repairHistory = [];
    this.isRunning = false;
  }

  /**
   * エラー種別分類
   * @param {object} error - エラーオブジェクト
   * @returns {string} エラー種別
   */
  classifyError(error) {
    const message = error.message || error.text || '';
    const stack = error.stack || '';
    
    // React/Next.js エラー
    if (message.includes('React') || message.includes('hydration') || 
        message.includes('Next.js') || message.includes('useEffect')) {
      return 'REACT_ERROR';
    }
    
    // Network/API エラー
    if (message.includes('fetch') || message.includes('XMLHttpRequest') ||
        message.includes('CORS') || message.includes('Network')) {
      return 'NETWORK_ERROR';
    }
    
    // JavaScript構文エラー
    if (message.includes('SyntaxError') || message.includes('ReferenceError') ||
        message.includes('TypeError')) {
      return 'JAVASCRIPT_ERROR';
    }
    
    // CSS/スタイリングエラー
    if (message.includes('CSS') || message.includes('style') ||
        message.includes('Tailwind')) {
      return 'STYLING_ERROR';
    }
    
    // ビルド/コンパイルエラー
    if (message.includes('build') || message.includes('compile') ||
        message.includes('webpack') || message.includes('esbuild')) {
      return 'BUILD_ERROR';
    }
    
    // ポート競合
    if (message.includes('EADDRINUSE') || message.includes('port')) {
      return 'PORT_CONFLICT';
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Level 1修復: 基本的な修復処理
   * @param {string} errorType - エラー種別
   * @param {object} error - エラーオブジェクト
   */
  async level1Repair(errorType, error) {
    log.info(`Level 1修復開始: ${errorType}`);
    
    try {
      switch (errorType) {
        case 'PORT_CONFLICT':
          await this.repairPortConflict();
          break;
          
        case 'NETWORK_ERROR':
          await this.repairNetworkError();
          break;
          
        case 'BUILD_ERROR':
          await this.repairBuildError();
          break;
          
        case 'REACT_ERROR':
          await this.repairReactError();
          break;
          
        case 'JAVASCRIPT_ERROR':
          await this.repairJavaScriptError();
          break;
          
        default:
          await this.repairGeneric();
      }
      
      log.success(`Level 1修復完了: ${errorType}`);
      return true;
      
    } catch (repairError) {
      log.error(`Level 1修復失敗: ${repairError.message}`);
      return false;
    }
  }

  /**
   * Level 2修復: より積極的な修復処理
   */
  async level2Repair(errorType, error) {
    log.info(`Level 2修復開始: ${errorType}`);
    
    try {
      // 依存関係再インストール
      await this.reinstallDependencies();
      
      // キャッシュクリア
      await this.clearCaches();
      
      // プロセス完全リセット
      await this.fullProcessReset();
      
      log.success(`Level 2修復完了: ${errorType}`);
      return true;
      
    } catch (repairError) {
      log.error(`Level 2修復失敗: ${repairError.message}`);
      return false;
    }
  }

  /**
   * Level 3修復: 最終手段の修復処理
   */
  async level3Repair(errorType, error) {
    log.info(`Level 3修復開始 (最終手段): ${errorType}`);
    
    try {
      // システム完全再起動
      await this.systemFullRestart();
      
      // バックアップからの復元
      await this.restoreFromBackup();
      
      log.success(`Level 3修復完了: ${errorType}`);
      return true;
      
    } catch (repairError) {
      log.error(`Level 3修復失敗: ${repairError.message}`);
      return false;
    }
  }

  /**
   * ポート競合修復
   */
  async repairPortConflict() {
    log.info('ポート競合修復中...');
    
    // ポートチェッカー実行
    return new Promise((resolve, reject) => {
      exec('node scripts/port-checker.js --kill', (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`ポート競合修復失敗: ${error.message}`));
        } else {
          log.success('ポート競合修復完了');
          resolve(true);
        }
      });
    });
  }

  /**
   * ネットワークエラー修復
   */
  async repairNetworkError() {
    log.info('ネットワークエラー修復中...');
    
    // バックエンドサービス再起動
    return new Promise((resolve, reject) => {
      exec('pm2 restart recipe-backend', (error, stdout, stderr) => {
        if (error) {
          log.warn(`PM2再起動失敗、手動再起動試行: ${error.message}`);
          // 手動でバックエンド再起動
          exec('cd backend && npm run dev', () => {
            resolve(true);
          });
        } else {
          log.success('バックエンドサービス再起動完了');
          resolve(true);
        }
      });
    });
  }

  /**
   * ビルドエラー修復
   */
  async repairBuildError() {
    log.info('ビルドエラー修復中...');
    
    // Next.js ビルドキャッシュクリア
    await this.executeCommand('cd frontend && rm -rf .next && npm run build');
    
    log.success('ビルドエラー修復完了');
  }

  /**
   * Reactエラー修復
   */
  async repairReactError() {
    log.info('Reactエラー修復中...');
    
    // フロントエンドサービス再起動
    await this.executeCommand('pm2 restart recipe-frontend');
    
    log.success('Reactエラー修復完了');
  }

  /**
   * JavaScriptエラー修復
   */
  async repairJavaScriptError() {
    log.info('JavaScriptエラー修復中...');
    
    // ESLint自動修復
    await this.executeCommand('cd frontend && npm run lint --fix 2>/dev/null || true');
    
    log.success('JavaScriptエラー修復完了');
  }

  /**
   * 汎用修復
   */
  async repairGeneric() {
    log.info('汎用修復処理中...');
    
    // 基本的な再起動
    await this.executeCommand('pm2 restart all');
    await this.delay(3000);
    
    log.success('汎用修復完了');
  }

  /**
   * 依存関係再インストール
   */
  async reinstallDependencies() {
    log.info('依存関係再インストール中...');
    
    // フロントエンド
    await this.executeCommand('cd frontend && rm -rf node_modules package-lock.json && npm install');
    
    // バックエンド  
    await this.executeCommand('cd backend && rm -rf node_modules package-lock.json && npm install');
    
    log.success('依存関係再インストール完了');
  }

  /**
   * キャッシュクリア
   */
  async clearCaches() {
    log.info('キャッシュクリア中...');
    
    await this.executeCommand('rm -rf frontend/.next');
    await this.executeCommand('npm cache clean --force');
    
    log.success('キャッシュクリア完了');
  }

  /**
   * プロセス完全リセット
   */
  async fullProcessReset() {
    log.info('プロセス完全リセット中...');
    
    await this.executeCommand('pm2 kill');
    await this.delay(2000);
    await this.executeCommand('pm2 start ecosystem.config.js');
    
    log.success('プロセス完全リセット完了');
  }

  /**
   * システム完全再起動
   */
  async systemFullRestart() {
    log.warn('システム完全再起動中... (Level 3)');
    
    // 全プロセス停止
    await this.executeCommand('pm2 kill');
    await this.executeCommand('pkill -f "node.*dev"');
    
    // IP再取得
    await this.executeCommand('bash scripts/get-ip.sh');
    
    // システム再起動
    await this.executeCommand('pm2 start ecosystem.config.js');
    
    log.success('システム完全再起動完了');
  }

  /**
   * バックアップからの復元
   */
  async restoreFromBackup() {
    log.warn('バックアップからの復元中... (Level 3)');
    
    try {
      // 設定ファイルのバックアップチェック
      const backupExists = await fs.access('./backup/.env.backup').then(() => true).catch(() => false);
      
      if (backupExists) {
        await this.executeCommand('cp ./backup/.env.backup ./.env');
        log.success('設定ファイル復元完了');
      } else {
        log.warn('バックアップファイルが見つかりません');
      }
      
    } catch (error) {
      log.error(`バックアップ復元エラー: ${error.message}`);
    }
  }

  /**
   * コマンド実行ヘルパー
   */
  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { timeout: this.options.timeoutMs }, (error, stdout, stderr) => {
        if (error) {
          log.debug(`コマンド実行エラー: ${command} - ${error.message}`);
          reject(error);
        } else {
          log.debug(`コマンド実行成功: ${command}`);
          resolve({ stdout, stderr });
        }
      });
    });
  }

  /**
   * 遅延ヘルパー
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 修復履歴記録
   */
  recordRepair(errorType, level, success, error = null) {
    const record = {
      timestamp: new Date().toISOString(),
      errorType,
      level,
      success,
      error: error ? error.message : null
    };
    
    this.repairHistory.push(record);
    this.emit('repairCompleted', record);
  }

  /**
   * メイン修復ループ
   */
  async repairError(error) {
    const errorType = this.classifyError(error);
    log.info(`エラー修復開始: ${errorType}`);
    
    // Level 1修復
    let success = await this.level1Repair(errorType, error);
    this.recordRepair(errorType, 1, success, success ? null : error);
    
    if (success) {
      log.success('Level 1修復で成功');
      return true;
    }
    
    // Level 2修復
    log.warn('Level 1修復失敗、Level 2修復実行中...');
    await this.delay(this.options.retryDelay);
    
    success = await this.level2Repair(errorType, error);
    this.recordRepair(errorType, 2, success, success ? null : error);
    
    if (success) {
      log.success('Level 2修復で成功');
      return true;
    }
    
    // Level 3修復 (最終手段)
    log.warn('Level 2修復失敗、Level 3修復実行中... (最終手段)');
    await this.delay(this.options.retryDelay * 2);
    
    success = await this.level3Repair(errorType, error);
    this.recordRepair(errorType, 3, success, success ? null : error);
    
    if (success) {
      log.success('Level 3修復で成功');
      return true;
    }
    
    log.error('全レベルの修復が失敗しました');
    return false;
  }

  /**
   * 修復履歴取得
   */
  getRepairHistory() {
    return this.repairHistory;
  }

  /**
   * 統計情報取得
   */
  getStats() {
    const total = this.repairHistory.length;
    const successful = this.repairHistory.filter(r => r.success).length;
    const failed = total - successful;
    
    const byLevel = {
      level1: this.repairHistory.filter(r => r.level === 1).length,
      level2: this.repairHistory.filter(r => r.level === 2).length,
      level3: this.repairHistory.filter(r => r.level === 3).length
    };
    
    const byType = this.repairHistory.reduce((acc, r) => {
      acc[r.errorType] = (acc[r.errorType] || 0) + 1;
      return acc;
    }, {});
    
    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total * 100).toFixed(2) + '%' : '0%',
      byLevel,
      byType
    };
  }
}

/**
 * メイン処理
 */
async function main() {
  const repairSystem = new AutoRepairSystem({
    maxRetries: 3,
    retryDelay: 5000,
    timeoutMs: 60000
  });
  
  // 修復完了イベントリスナー
  repairSystem.on('repairCompleted', (record) => {
    log.info(`修復記録: ${record.errorType} Level${record.level} - ${record.success ? '成功' : '失敗'}`);
  });
  
  log.info('=== PersonalCookingRecipe 自動修復システム ===');
  log.info('エラー監視・自動修復ループを開始します...');
  
  // テスト用のエラー修復実行
  const testError = {
    message: 'EADDRINUSE: address already in use :::3000',
    type: 'PORT_CONFLICT'
  };
  
  const repairSuccess = await repairSystem.repairError(testError);
  
  if (repairSuccess) {
    log.success('テスト修復完了');
  } else {
    log.error('テスト修復失敗');
  }
  
  // 統計情報表示
  const stats = repairSystem.getStats();
  console.log('\n' + colors.cyan('=== 修復統計 ==='));
  console.log(JSON.stringify(stats, null, 2));
  
  // 継続監視モード（オプション）
  if (process.argv.includes('--monitor')) {
    log.info('継続監視モード開始...');
    // 実際の監視ループはここに実装
    setInterval(async () => {
      // Playwright テスト実行
      try {
        await repairSystem.executeCommand('npx playwright test tests/e2e/browser-error-detection.spec.js');
      } catch (error) {
        log.warn('エラー検知、修復実行中...');
        await repairSystem.repairError(error);
      }
    }, 30000); // 30秒間隔
  }
}

// スクリプト直接実行時
if (require.main === module) {
  main().catch(error => {
    log.error(`システムエラー: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { AutoRepairSystem };