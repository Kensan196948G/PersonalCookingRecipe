/**
 * エラー検知・自動修復システム統合テスト
 * PersonalCookingRecipe統合開発環境
 */

const request = require('supertest');
const ErrorDetectionSystem = require('../src/monitoring/ErrorDetectionSystem');
const DatabaseMonitor = require('../src/monitoring/DatabaseMonitor');
const RedisMonitor = require('../src/monitoring/RedisMonitor');
const MemoryMonitor = require('../src/monitoring/MemoryMonitor');
const AlertSystem = require('../src/monitoring/AlertSystem');
const SafetyController = require('../src/monitoring/SafetyController');

describe('エラー検知・自動修復システム統合テスト', () => {
  let errorDetectionSystem;
  let alertSystem;
  let safetyController;

  beforeAll(async () => {
    // テスト用の設定でシステムを初期化
    alertSystem = new AlertSystem({
      console: { enabled: true },
      email: { enabled: false },
      slack: { enabled: false },
      discord: { enabled: false }
    });

    safetyController = new SafetyController({
      maxRetries: {
        database: 2,
        redis: 2,
        api: 3,
        memory: 1
      },
      backupEnabled: true,
      backupDirectory: '/tmp/test-backups'
    });

    errorDetectionSystem = new ErrorDetectionSystem({
      monitors: {
        database: false, // テスト環境では無効
        redis: false,    // テスト環境では無効
        memory: true,
        api: false
      },
      autoRepair: {
        level1: true,
        level2: true,
        level3: false
      }
    });

    await alertSystem.initialize();
    await safetyController.initialize();
    await errorDetectionSystem.initialize();
  });

  afterAll(async () => {
    await errorDetectionSystem.shutdown();
    await alertSystem.shutdown();
    await safetyController.shutdown();
  });

  describe('システム初期化テスト', () => {
    test('エラー検知システムが正常に初期化される', () => {
      expect(errorDetectionSystem).toBeDefined();
      const status = errorDetectionSystem.getStatus();
      expect(status.healthy).toBe(true);
    });

    test('アラートシステムが正常に初期化される', () => {
      expect(alertSystem).toBeDefined();
      const status = alertSystem.getStatus();
      expect(status.channels.console).toBe(true);
    });

    test('安全コントローラーが正常に初期化される', () => {
      expect(safetyController).toBeDefined();
      const status = safetyController.getStatus();
      expect(status.safeMode).toBe(false);
    });
  });

  describe('エラー処理テスト', () => {
    test('エラーが正常に検出・記録される', async () => {
      const errorInfo = {
        type: 'test',
        severity: 'warning',
        message: 'テストエラー',
        details: { testCase: 'error_detection' }
      };

      await errorDetectionSystem.handleError(errorInfo);

      const status = errorDetectionSystem.getStatus();
      expect(status.activeErrors).toBeGreaterThan(0);
    });

    test('アラートが正常に送信される', async () => {
      const alert = {
        title: 'テストアラート',
        message: 'これはテスト用のアラートです',
        severity: 'info',
        source: 'test'
      };

      const result = await alertSystem.sendAlert(alert);
      expect(result.success).toBe(true);
    });
  });

  describe('安全対策テスト', () => {
    test('修復試行回数が制限される', async () => {
      const componentType = 'test-component';
      const errorInfo = { type: 'test', severity: 'warning' };

      // 最初の試行
      let result = safetyController.canAttemptRepair(componentType, errorInfo);
      expect(result.allowed).toBe(true);

      // 試行を記録
      safetyController.recordRepairAttempt(componentType, false, errorInfo);
      safetyController.recordRepairAttempt(componentType, false, errorInfo);

      // 制限に達した後
      result = safetyController.canAttemptRepair(componentType, errorInfo);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('max_retries');
    });

    test('バックアップが正常に作成される', async () => {
      const testData = { test: 'data', timestamp: new Date() };
      const backup = await safetyController.createBackup('test', testData);
      
      expect(backup).toBeDefined();
      expect(backup.id).toContain('test_');
    });
  });

  describe('監視モジュールテスト', () => {
    test('メモリ監視が動作する', async () => {
      const memoryMonitor = new MemoryMonitor({
        checkInterval: 1000,
        leakThreshold: 0.1, // テスト用に低い値
        autoGcEnabled: false // テスト環境ではGCを無効
      });

      await memoryMonitor.initialize();

      // しばらく待機してメモリチェックが実行されることを確認
      await new Promise(resolve => setTimeout(resolve, 1500));

      const status = memoryMonitor.getStatus();
      expect(status.healthy).toBeDefined();
      expect(status.currentUsage).toBeDefined();

      await memoryMonitor.shutdown();
    });

    test('データベース監視モックテスト', async () => {
      // モック用の設定
      const dbMonitor = new DatabaseMonitor({
        connectionString: 'postgresql://test:test@localhost:5432/test'
      });

      // 接続が失敗することを期待（テスト環境では実際のDBがない）
      const status = dbMonitor.getStatus();
      expect(status).toBeDefined();

      await dbMonitor.shutdown();
    });
  });

  describe('統合テスト', () => {
    test('エラーから修復までの完全なフロー', async () => {
      const errorInfo = {
        type: 'integration_test',
        severity: 'warning',
        message: '統合テストエラー',
        consecutiveFailures: 1
      };

      // エラーを発生させる
      await errorDetectionSystem.handleError(errorInfo);

      // システム状態を確認
      const systemStatus = errorDetectionSystem.getStatus();
      expect(systemStatus.activeErrors).toBeGreaterThan(0);

      // アラート履歴を確認
      const alertHistory = alertSystem.getAlertHistory(10);
      expect(alertHistory.length).toBeGreaterThan(0);

      // 最新のアラートがテストエラーに関連することを確認
      const latestAlert = alertHistory[0];
      expect(latestAlert.source).toBe('integration_test');
    });

    test('システム全体の診断情報が取得できる', async () => {
      const diagnostics = {
        errorDetection: errorDetectionSystem.getStatus(),
        alerts: alertSystem.getStatus(),
        safety: safetyController.getStatus()
      };

      expect(diagnostics.errorDetection).toBeDefined();
      expect(diagnostics.alerts).toBeDefined();
      expect(diagnostics.safety).toBeDefined();

      // ヘルス状態の確認
      expect(diagnostics.errorDetection.healthy).toBe(true);
      expect(diagnostics.alerts.channels.console).toBe(true);
      expect(diagnostics.safety.safeMode).toBe(false);
    });
  });

  describe('パフォーマンステスト', () => {
    test('大量のエラー処理が適切に処理される', async () => {
      const startTime = Date.now();
      const errorCount = 50;

      const promises = [];
      for (let i = 0; i < errorCount; i++) {
        promises.push(errorDetectionSystem.handleError({
          type: 'performance_test',
          severity: 'info',
          message: `パフォーマンステストエラー ${i}`,
          details: { index: i }
        }));
      }

      await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 50個のエラーを5秒以内に処理できることを確認
      expect(duration).toBeLessThan(5000);

      const status = errorDetectionSystem.getStatus();
      expect(status.metrics.totalErrors).toBeGreaterThanOrEqual(errorCount);
    });

    test('アラートレート制限が機能する', async () => {
      const rapidAlerts = [];
      
      // 短時間で大量のアラートを送信
      for (let i = 0; i < 15; i++) {
        rapidAlerts.push(alertSystem.sendAlert({
          title: `高速アラート ${i}`,
          message: 'レート制限テスト',
          severity: 'info',
          source: 'rate_limit_test'
        }));
      }

      const results = await Promise.all(rapidAlerts);
      
      // 一部のアラートがレート制限により拒否されることを確認
      const rejected = results.filter(r => !r.success && r.reason === 'rate_limited');
      expect(rejected.length).toBeGreaterThan(0);
    });
  });
});

// Express統合テスト
describe('Express統合テスト', () => {
  let app;

  beforeAll(() => {
    // テスト用のExpressアプリを作成
    const express = require('express');
    app = express();
    
    const ErrorDetectionMiddleware = require('../src/middleware/errorDetectionMiddleware');
    const errorDetection = new ErrorDetectionMiddleware({
      enabled: true,
      monitors: { database: false, redis: false, memory: true, api: true },
      alerts: { console: { enabled: true } }
    });

    errorDetection.initialize().then(() => {
      errorDetection.integrate(app);
    });

    // テスト用ルート
    app.get('/test', (req, res) => {
      res.json({ message: 'Test endpoint' });
    });

    app.get('/test/error', (req, res) => {
      throw new Error('テストエラー');
    });

    app.get('/test/slow', (req, res) => {
      setTimeout(() => {
        res.json({ message: 'Slow response' });
      }, 3000);
    });
  });

  test('ヘルスチェックエンドポイントが動作する', async () => {
    const response = await request(app)
      .get('/api/health/monitoring')
      .expect(200);

    expect(response.body.overall).toBeDefined();
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.systems).toBeDefined();
  });

  test('メトリクスエンドポイントが動作する', async () => {
    const response = await request(app)
      .get('/api/metrics')
      .expect(200);

    expect(response.header['content-type']).toMatch(/text\/plain/);
    expect(response.text).toContain('# HELP');
  });

  test('通常のリクエストが正常に処理される', async () => {
    const response = await request(app)
      .get('/test')
      .expect(200);

    expect(response.body.message).toBe('Test endpoint');
  });
});

// 設定テスト
describe('設定テスト', () => {
  test('環境変数が正しく読み込まれる', () => {
    // テスト用環境変数設定
    process.env.ERROR_DETECTION_ENABLED = 'true';
    process.env.MONITOR_DATABASE = 'false';
    process.env.ALERT_CONSOLE_ENABLED = 'true';

    const ErrorDetectionMiddleware = require('../src/middleware/errorDetectionMiddleware');
    const middleware = new ErrorDetectionMiddleware();

    expect(middleware.config.enabled).toBe(true);
    expect(middleware.config.monitors.database).toBe(false);
  });

  test('デフォルト設定が適用される', () => {
    const ErrorDetectionSystem = require('../src/monitoring/ErrorDetectionSystem');
    const system = new ErrorDetectionSystem();

    expect(system.config.maxRetries).toBe(3);
    expect(system.config.healthCheckInterval).toBe(30000);
    expect(system.config.memoryThreshold).toBe(0.85);
  });
});

console.log('✅ エラー検知・自動修復システム統合テスト定義完了');
console.log('🧪 テスト実行: npm test');
console.log('📊 詳細テスト: npm test -- --verbose');