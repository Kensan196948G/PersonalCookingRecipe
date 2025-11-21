#!/usr/bin/env node

/**
 * PersonalCookingRecipe Winston統合ログシステム
 * 構造化ログ・ローテーション・エラー追跡
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// ログディレクトリ確保
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// カスタムフォーマット定義
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `[${timestamp}] ${level}: ${message}`;
    
    // スタックトレース追加
    if (stack) {
      log += `\n${stack}`;
    }
    
    // メタデータ追加
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// JSON形式フォーマット
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * メインロガー設定
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  defaultMeta: { 
    service: 'personal-cooking-recipe',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // ファイル出力: エラーログ
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true
    }),
    
    // ファイル出力: 全ログ
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 15,
      tailable: true
    }),
    
    // ファイル出力: デバッグログ
    new winston.transports.File({
      filename: path.join(logsDir, 'debug.log'),
      level: 'debug',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5,
      tailable: true
    })
  ],
  
  // 例外ハンドリング
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    })
  ],
  
  // 未処理Promise拒否ハンドリング
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

// 開発環境：コンソール出力追加
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: customFormat,
    level: 'debug'
  }));
}

/**
 * サービス固有のロガー作成
 */
function createServiceLogger(serviceName) {
  return logger.child({ 
    service: serviceName,
    pid: process.pid
  });
}

/**
 * エラー追跡ロガー
 */
class ErrorTracker {
  constructor() {
    this.logger = createServiceLogger('error-tracker');
    this.errorCounts = new Map();
    this.startTime = Date.now();
  }

  /**
   * エラーログ記録
   */
  logError(error, context = {}) {
    const errorKey = `${error.name}:${error.message}`;
    const count = (this.errorCounts.get(errorKey) || 0) + 1;
    this.errorCounts.set(errorKey, count);

    this.logger.error('Application Error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      occurrence: count,
      timestamp: new Date().toISOString()
    });

    // 頻発エラーの警告
    if (count >= 5) {
      this.logger.warn('Frequent Error Detected', {
        errorKey,
        count,
        suggestion: 'このエラーが頻発しています。調査が必要です。'
      });
    }
  }

  /**
   * パフォーマンス計測
   */
  measurePerformance(operation, startTime, metadata = {}) {
    const duration = Date.now() - startTime;
    
    this.logger.info('Performance Measurement', {
      operation,
      duration_ms: duration,
      ...metadata
    });

    // 遅い処理の警告
    if (duration > 5000) {
      this.logger.warn('Slow Operation Detected', {
        operation,
        duration_ms: duration,
        suggestion: 'この処理は5秒以上かかっています。最適化を検討してください。'
      });
    }
  }

  /**
   * 統計情報取得
   */
  getStats() {
    const uptime = Date.now() - this.startTime;
    const totalErrors = Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0);
    
    return {
      uptime_ms: uptime,
      uptime_human: this.formatDuration(uptime),
      total_errors: totalErrors,
      unique_errors: this.errorCounts.size,
      error_frequency: totalErrors > 0 ? (totalErrors / (uptime / 1000 / 60)).toFixed(2) : 0, // エラー/分
      top_errors: Array.from(this.errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([error, count]) => ({ error, count }))
    };
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

/**
 * リクエスト追跡ミドルウェア（Express用）
 */
function requestLoggerMiddleware() {
  const requestLogger = createServiceLogger('http-requests');
  
  return (req, res, next) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    // リクエスト開始ログ
    requestLogger.info('Request Start', {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    });

    // レスポンス終了時のログ
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      requestLogger.info('Request Complete', {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration_ms: duration,
        contentLength: res.get('Content-Length')
      });
    });

    next();
  };
}

/**
 * Playwright テスト結果ロガー
 */
class PlaywrightLogger {
  constructor() {
    this.logger = createServiceLogger('playwright-tests');
  }

  logTestStart(testName) {
    this.logger.info('Test Started', {
      testName,
      timestamp: new Date().toISOString()
    });
  }

  logTestEnd(testName, result, duration, errors = []) {
    this.logger.info('Test Completed', {
      testName,
      result, // 'passed' | 'failed' | 'skipped'
      duration_ms: duration,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    });

    // 失敗テストの詳細ログ
    if (result === 'failed' && errors.length > 0) {
      errors.forEach(error => {
        this.logger.error('Test Failure Details', {
          testName,
          error
        });
      });
    }
  }

  logBrowserError(browserType, error) {
    this.logger.warn('Browser Error Detected', {
      browserType,
      error: {
        message: error.message || error.text,
        type: error.type,
        location: error.location,
        timestamp: new Date().toISOString()
      }
    });
  }
}

// グローバルエラートラッカー
const errorTracker = new ErrorTracker();

// プロセス終了時の統計出力
process.on('SIGTERM', () => {
  const stats = errorTracker.getStats();
  logger.info('Application Shutdown Stats', stats);
});

process.on('SIGINT', () => {
  const stats = errorTracker.getStats();
  logger.info('Application Shutdown Stats', stats);
  process.exit(0);
});

// 未処理エラーの自動ログ
process.on('uncaughtException', (error) => {
  errorTracker.logError(error, { type: 'uncaughtException' });
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
});

process.on('unhandledRejection', (reason, promise) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  errorTracker.logError(error, { type: 'unhandledRejection' });
  logger.error('Unhandled Rejection', { reason: String(reason) });
});

// メイン関数（テスト用）
async function main() {
  const testLogger = createServiceLogger('test-service');
  const playwrightLogger = new PlaywrightLogger();
  
  console.log('🚀 Winston Logger System Test Started');
  
  // 各種ログレベルテスト
  testLogger.debug('This is a debug message');
  testLogger.info('This is an info message');
  testLogger.warn('This is a warning message');
  testLogger.error('This is an error message');
  
  // エラー追跡テスト
  const testError = new Error('Test error for tracking');
  errorTracker.logError(testError, { component: 'test-component' });
  
  // パフォーマンス測定テスト
  const operationStart = Date.now();
  await new Promise(resolve => setTimeout(resolve, 100)); // 100ms待機
  errorTracker.measurePerformance('test-operation', operationStart, { 
    operation_type: 'async_test' 
  });
  
  // Playwrightログテスト
  playwrightLogger.logTestStart('browser-error-detection');
  playwrightLogger.logTestEnd('browser-error-detection', 'passed', 1500);
  
  // 統計表示
  const stats = errorTracker.getStats();
  testLogger.info('Error Tracker Stats', stats);
  
  console.log('✅ Winston Logger System Test Completed');
  console.log(`📁 Logs saved to: ${logsDir}`);
}

// スクリプト直接実行時
if (require.main === module) {
  main().catch(error => {
    console.error('Logger test failed:', error);
    process.exit(1);
  });
}

module.exports = {
  logger,
  createServiceLogger,
  ErrorTracker,
  errorTracker,
  requestLoggerMiddleware,
  PlaywrightLogger
};