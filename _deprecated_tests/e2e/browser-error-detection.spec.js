// PersonalCookingRecipe ブラウザエラー自動検知テスト
// console.error, console.warn, JavaScript例外, Network failures監視

const { test, expect } = require('@playwright/test');

// エラー収集システム
class ErrorCollector {
  constructor() {
    this.consoleErrors = [];
    this.consoleWarnings = [];
    this.networkFailures = [];
    this.jsExceptions = [];
    this.reactErrors = [];
  }

  reset() {
    this.consoleErrors = [];
    this.consoleWarnings = [];
    this.networkFailures = [];
    this.jsExceptions = [];
    this.reactErrors = [];
  }

  getErrorSummary() {
    return {
      consoleErrors: this.consoleErrors.length,
      consoleWarnings: this.consoleWarnings.length,
      networkFailures: this.networkFailures.length,
      jsExceptions: this.jsExceptions.length,
      reactErrors: this.reactErrors.length,
      total: this.consoleErrors.length + this.consoleWarnings.length + 
             this.networkFailures.length + this.jsExceptions.length + this.reactErrors.length
    };
  }

  hasErrors() {
    return this.getErrorSummary().total > 0;
  }
}

// グローバルエラーコレクター
const errorCollector = new ErrorCollector();

test.describe('ブラウザエラー自動検知システム', () => {
  
  test.beforeEach(async ({ page }) => {
    // エラーコレクターリセット
    errorCollector.reset();
    
    // Console Error監視
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();
      
      if (type === 'error') {
        errorCollector.consoleErrors.push({
          text,
          location,
          timestamp: new Date().toISOString()
        });
        console.log(`🔴 Console Error: ${text} at ${location.url}:${location.lineNumber}`);
      } else if (type === 'warning') {
        errorCollector.consoleWarnings.push({
          text,
          location,
          timestamp: new Date().toISOString()
        });
        console.log(`🟡 Console Warning: ${text} at ${location.url}:${location.lineNumber}`);
      }
    });
    
    // Network Failure監視
    page.on('response', (response) => {
      if (!response.ok() && response.status() >= 400) {
        const failure = {
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          timestamp: new Date().toISOString()
        };
        errorCollector.networkFailures.push(failure);
        console.log(`🔴 Network Failure: ${failure.status} ${failure.statusText} - ${failure.url}`);
      }
    });
    
    // JavaScript Exception監視
    page.on('pageerror', (exception) => {
      const error = {
        message: exception.message,
        stack: exception.stack,
        timestamp: new Date().toISOString()
      };
      errorCollector.jsExceptions.push(error);
      console.log(`🔴 JavaScript Exception: ${exception.message}`);
      
      // React特有エラー検知
      if (exception.message.includes('React') || 
          exception.message.includes('hydration') ||
          exception.message.includes('useEffect') ||
          exception.message.includes('useState')) {
        errorCollector.reactErrors.push(error);
        console.log(`🔴 React Error Detected: ${exception.message}`);
      }
    });
    
    // Request Failed監視
    page.on('requestfailed', (request) => {
      const failure = {
        url: request.url(),
        method: request.method(),
        errorText: request.failure()?.errorText || 'Unknown error',
        timestamp: new Date().toISOString()
      };
      errorCollector.networkFailures.push(failure);
      console.log(`🔴 Request Failed: ${failure.method} ${failure.url} - ${failure.errorText}`);
    });
  });
  
  test('フロントエンドページ読み込みエラー検知', async ({ page }) => {
    console.log('🧪 フロントエンドページ読み込みテスト開始');
    
    // ページ読み込み
    await page.goto('/', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // 基本要素の存在確認
    await expect(page).toHaveTitle(/Personal Cooking Recipe|Recipe/i);
    
    // DOMロード待機
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // React hydration待機
    
    // エラーサマリー
    const summary = errorCollector.getErrorSummary();
    console.log('📊 エラーサマリー:', summary);
    
    // 詳細ログ出力
    if (errorCollector.consoleErrors.length > 0) {
      console.log('🔴 Console Errors:', errorCollector.consoleErrors);
    }
    if (errorCollector.consoleWarnings.length > 0) {
      console.log('🟡 Console Warnings:', errorCollector.consoleWarnings);
    }
    if (errorCollector.networkFailures.length > 0) {
      console.log('🔴 Network Failures:', errorCollector.networkFailures);
    }
    if (errorCollector.jsExceptions.length > 0) {
      console.log('🔴 JavaScript Exceptions:', errorCollector.jsExceptions);
    }
    if (errorCollector.reactErrors.length > 0) {
      console.log('🔴 React Errors:', errorCollector.reactErrors);
    }
    
    // 許容可能エラーの除外
    const filteredErrors = errorCollector.consoleErrors.filter(error => 
      !error.text.includes('favicon.ico') &&
      !error.text.includes('DevTools') &&
      !error.text.includes('Extension')
    );
    
    // 重要なエラーのみアサーション
    expect(filteredErrors.length, `重要なConsoleエラーが${filteredErrors.length}件発生`).toBe(0);
    expect(errorCollector.jsExceptions.length, `JavaScript例外が${errorCollector.jsExceptions.length}件発生`).toBe(0);
    expect(errorCollector.reactErrors.length, `Reactエラーが${errorCollector.reactErrors.length}件発生`).toBe(0);
  });
  
  test('バックエンドAPI接続エラー検知', async ({ page }) => {
    console.log('🧪 バックエンドAPI接続テスト開始');
    
    // APIエンドポイントテスト用のJavaScript実行
    await page.goto('/');
    
    // API接続テスト
    const apiResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/health');
        return {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText
        };
      } catch (error) {
        return {
          ok: false,
          error: error.message
        };
      }
    });
    
    console.log('🔌 API接続結果:', apiResponse);
    
    // 少し待機してエラーを収集
    await page.waitForTimeout(1000);
    
    const summary = errorCollector.getErrorSummary();
    console.log('📊 API接続後エラーサマリー:', summary);
    
    // API接続に関連するネットワークエラーのみチェック
    const apiNetworkFailures = errorCollector.networkFailures.filter(failure =>
      failure.url.includes('/api/')
    );
    
    if (apiNetworkFailures.length > 0) {
      console.log('🔴 API Network Failures:', apiNetworkFailures);
    }
  });
  
  test('UIインタラクションエラー検知', async ({ page }) => {
    console.log('🧪 UIインタラクション エラー検知テスト開始');
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 基本的なUI要素の操作
    try {
      // ボタンクリック試行
      const buttons = await page.$$('button');
      if (buttons.length > 0) {
        console.log(`🔘 ${buttons.length}個のボタンを発見`);
        
        // 最初のボタンをクリック
        await buttons[0].click();
        await page.waitForTimeout(1000);
        
        // フォーム入力試行
        const inputs = await page.$$('input');
        if (inputs.length > 0) {
          console.log(`📝 ${inputs.length}個の入力フィールドを発見`);
          await inputs[0].fill('test input');
          await page.waitForTimeout(500);
        }
      }
    } catch (error) {
      console.log('🔴 UI操作エラー:', error.message);
    }
    
    await page.waitForTimeout(2000);
    
    const summary = errorCollector.getErrorSummary();
    console.log('📊 UI操作後エラーサマリー:', summary);
    
    // UI操作関連のエラーをチェック
    const interactionErrors = errorCollector.jsExceptions.filter(error =>
      error.message.includes('click') ||
      error.message.includes('input') ||
      error.message.includes('form')
    );
    
    expect(interactionErrors.length, `UI操作エラーが${interactionErrors.length}件発生`).toBe(0);
  });
  
  test.afterEach(async ({ page }, testInfo) => {
    // テスト終了時のスクリーンショット
    if (testInfo.status !== testInfo.expectedStatus) {
      const screenshot = await page.screenshot({ 
        path: `./logs/screenshots/error-${testInfo.title}-${Date.now()}.png`,
        fullPage: true 
      });
      await testInfo.attach('screenshot', { 
        body: screenshot, 
        contentType: 'image/png' 
      });
    }
    
    // エラーレポート生成
    if (errorCollector.hasErrors()) {
      const report = {
        testTitle: testInfo.title,
        timestamp: new Date().toISOString(),
        summary: errorCollector.getErrorSummary(),
        details: {
          consoleErrors: errorCollector.consoleErrors,
          consoleWarnings: errorCollector.consoleWarnings,
          networkFailures: errorCollector.networkFailures,
          jsExceptions: errorCollector.jsExceptions,
          reactErrors: errorCollector.reactErrors
        }
      };
      
      await testInfo.attach('error-report', {
        body: JSON.stringify(report, null, 2),
        contentType: 'application/json'
      });
    }
  });
});

module.exports = { ErrorCollector, errorCollector };