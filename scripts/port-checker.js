#!/usr/bin/env node

/**
 * PersonalCookingRecipe ポート競合チェックシステム
 * 3000番ポート（Frontend）と5000番ポート（Backend）の状態確認
 */

const net = require('net');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// カラー出力関数
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`
};

// 設定
const PORTS = {
  frontend: 3000,
  backend: 5000
};

const TIMEOUT = 3000; // 3秒タイムアウト

// ログ関数
const log = {
  info: (msg) => console.log(colors.blue('[INFO]'), msg),
  success: (msg) => console.log(colors.green('[SUCCESS]'), msg),
  warn: (msg) => console.log(colors.yellow('[WARN]'), msg),
  error: (msg) => console.log(colors.red('[ERROR]'), msg)
};

/**
 * ポート使用状況確認
 * @param {number} port - チェックするポート番号
 * @param {string} serviceName - サービス名
 * @returns {Promise<object>} ポート情報
 */
function checkPort(port, serviceName) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, '0.0.0.0', () => {
      server.once('close', () => {
        log.success(`ポート ${port} は利用可能です (${serviceName})`);
        resolve({
          port,
          serviceName,
          available: true,
          inUse: false,
          pid: null,
          process: null
        });
      });
      server.close();
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        log.warn(`ポート ${port} は既に使用中です (${serviceName})`);
        
        // プロセス情報取得
        exec(`lsof -ti:${port} 2>/dev/null`, (error, stdout) => {
          const pid = stdout.trim();
          if (pid) {
            exec(`ps -p ${pid} -o comm= 2>/dev/null`, (error, processName) => {
              resolve({
                port,
                serviceName,
                available: false,
                inUse: true,
                pid: parseInt(pid),
                process: processName.trim() || 'unknown'
              });
            });
          } else {
            resolve({
              port,
              serviceName,
              available: false,
              inUse: true,
              pid: null,
              process: null
            });
          }
        });
      } else {
        log.error(`ポート ${port} チェック中にエラー: ${err.message}`);
        resolve({
          port,
          serviceName,
          available: false,
          inUse: false,
          error: err.message,
          pid: null,
          process: null
        });
      }
    });
  });
}

/**
 * プロセス強制終了
 * @param {number} port - 終了するプロセスのポート
 * @param {string} serviceName - サービス名
 * @returns {Promise<boolean>} 終了成功/失敗
 */
function killPortProcess(port, serviceName) {
  return new Promise((resolve) => {
    exec(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, (error) => {
      if (error) {
        log.error(`ポート ${port} のプロセス終了に失敗: ${error.message}`);
        resolve(false);
      } else {
        log.success(`ポート ${port} のプロセスを終了しました (${serviceName})`);
        resolve(true);
      }
    });
  });
}

/**
 * システム状態レポート生成
 * @param {Array} portResults - ポートチェック結果
 */
async function generateReport(portResults) {
  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    ports: portResults,
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    },
    recommendations: []
  };
  
  // 推奨事項生成
  portResults.forEach(result => {
    if (result.inUse && result.process) {
      report.recommendations.push({
        type: 'port_conflict',
        message: `ポート ${result.port} (${result.serviceName}) は ${result.process} (PID: ${result.pid}) によって使用されています`,
        action: `プロセスを終了するには: kill -9 ${result.pid}`
      });
    }
  });
  
  // レポートファイル保存
  const logsDir = path.join(__dirname, '..', 'logs');
  try {
    await fs.mkdir(logsDir, { recursive: true });
    const reportPath = path.join(logsDir, `port-check-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    log.success(`レポート保存: ${reportPath}`);
  } catch (error) {
    log.error(`レポート保存エラー: ${error.message}`);
  }
  
  return report;
}

/**
 * メイン処理
 */
async function main() {
  log.info('=== PersonalCookingRecipe ポートチェックシステム ===');
  
  // コマンドライン引数処理
  const args = process.argv.slice(2);
  const killMode = args.includes('--kill') || args.includes('-k');
  const verboseMode = args.includes('--verbose') || args.includes('-v');
  
  if (killMode) {
    log.warn('強制終了モードが有効です');
  }
  
  try {
    // 全ポートをチェック
    const portPromises = Object.entries(PORTS).map(([name, port]) => 
      checkPort(port, name)
    );
    
    const results = await Promise.all(portPromises);
    
    // 結果表示
    console.log('\n' + colors.cyan('=== チェック結果 ==='));
    results.forEach(result => {
      if (result.available) {
        console.log(colors.green(`✓ ${result.serviceName} (${result.port}): 利用可能`));
      } else if (result.inUse) {
        console.log(colors.yellow(`⚠ ${result.serviceName} (${result.port}): 使用中 (PID: ${result.pid}, プロセス: ${result.process})`));
      } else {
        console.log(colors.red(`✗ ${result.serviceName} (${result.port}): エラー`));
      }
    });
    
    // 強制終了モード
    if (killMode) {
      console.log('\n' + colors.yellow('=== プロセス終了中 ==='));
      const killPromises = results
        .filter(result => result.inUse && result.pid)
        .map(result => killPortProcess(result.port, result.serviceName));
      
      await Promise.all(killPromises);
      
      // 再チェック
      log.info('再チェック実行中...');
      const recheckPromises = Object.entries(PORTS).map(([name, port]) => 
        checkPort(port, name)
      );
      const recheckResults = await Promise.all(recheckPromises);
      
      console.log('\n' + colors.cyan('=== 再チェック結果 ==='));
      recheckResults.forEach(result => {
        if (result.available) {
          console.log(colors.green(`✓ ${result.serviceName} (${result.port}): 利用可能`));
        } else {
          console.log(colors.red(`✗ ${result.serviceName} (${result.port}): まだ使用中`));
        }
      });
    }
    
    // レポート生成
    const report = await generateReport(results);
    
    if (verboseMode) {
      console.log('\n' + colors.cyan('=== 詳細レポート ==='));
      console.log(JSON.stringify(report, null, 2));
    }
    
    // 終了コード設定
    const hasConflicts = results.some(result => result.inUse);
    process.exit(hasConflicts && !killMode ? 1 : 0);
    
  } catch (error) {
    log.error(`システムエラー: ${error.message}`);
    process.exit(1);
  }
}

// スクリプト直接実行時
if (require.main === module) {
  main().catch(error => {
    log.error(`未処理エラー: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  checkPort,
  killPortProcess,
  generateReport,
  PORTS
};