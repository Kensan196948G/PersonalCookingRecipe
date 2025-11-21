// PersonalCookingRecipe Playwright設定
// ブラウザエラー自動検知・スクリーンショット・録画対応

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // テストディレクトリ
  testDir: './tests/e2e',
  
  // テスト並列実行設定
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  
  // レポート設定
  reporter: [
    ['html', { outputFolder: './logs/playwright-report' }],
    ['json', { outputFile: './logs/playwright-results.json' }],
    ['junit', { outputFile: './logs/playwright-junit.xml' }],
    ['list']
  ],
  
  // グローバル設定
  use: {
    // ベースURL（動的IP対応）
    baseURL: process.env.FRONTEND_URL || 'http://localhost:3000',
    
    // ブラウザ設定
    headless: true, // X server対応のため強制ヘッドレスモード
    viewport: { width: 1280, height: 720 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    
    // ネットワーク設定
    ignoreHTTPSErrors: true,
    
    // スクリーンショット設定
    screenshot: {
      mode: 'on-failure',
      fullPage: true
    },
    
    // 録画設定
    video: {
      mode: 'retain-on-failure',
      size: { width: 1280, height: 720 }
    },
    
    // トレース設定
    trace: 'on-failure',
    
    // タイムアウト設定
    actionTimeout: 10000,
    navigationTimeout: 30000
  },
  
  // テスト実行プロジェクト設定
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox'
          ]
        }
      }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] }
    }
  ],
  
  // Webサーバー設定（開発時）
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    port: 3000,
    timeout: 120000,
    reuseExistingServer: true
  },
  
  // テスト設定
  timeout: 60000,
  expect: {
    timeout: 15000,
    toHaveScreenshot: { threshold: 0.3 }
  },
  
  // 出力ディレクトリ
  outputDir: './logs/test-results'
});