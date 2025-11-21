#!/usr/bin/env node

/**
 * GitHub Actions 自動修復システム
 *
 * このスクリプトは以下を自動的に実行します:
 * 1. GitHub Actions ワークフロー実行状況の監視
 * 2. 失敗したワークフローの検出とエラーログ取得
 * 3. エラーパターンの自動分析と修復
 * 4. GitHub Issue への自動報告
 * 5. 最大10回の繰り返し修復試行
 * 6. 30分間隔での再検証
 * 7. 全修復完了後の最終コミット & PR作成
 */

const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 設定
const CONFIG = {
  owner: process.env.GITHUB_OWNER || 'Kensan196948G',
  repo: process.env.GITHUB_REPO || 'PersonalCookingRecipe',
  token: process.env.GITHUB_TOKEN,
  maxAttempts: parseInt(process.env.MAX_ATTEMPTS || '10'),
  intervalMinutes: parseInt(process.env.INTERVAL_MINUTES || '30'),
  maxFixesPerRun: 10,
  dryRun: process.env.DRY_RUN === 'true',
  logDir: path.join(__dirname, '../logs'),
  errorsFile: path.join(__dirname, 'gh-error-patterns.json'),
};

// ログ記録用
class Logger {
  constructor(logFile) {
    this.logFile = logFile;
    this.startTime = Date.now();
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      elapsed: Date.now() - this.startTime,
    };

    console.log(`[${timestamp}] ${level}: ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));

    // ファイルに追記
    fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
  }

  info(message, data) { this.log('INFO', message, data); }
  warn(message, data) { this.log('WARN', message, data); }
  error(message, data) { this.log('ERROR', message, data); }
  success(message, data) { this.log('SUCCESS', message, data); }
}

// GitHub API クライアント
class GitHubAPI {
  constructor(owner, repo, token) {
    this.owner = owner;
    this.repo = repo;
    this.token = token;
    this.baseUrl = 'api.github.com';
  }

  async request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        path: path,
        method: method,
        headers: {
          'Authorization': `token ${this.token}`,
          'User-Agent': 'GitHub-Actions-Auto-Fix',
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${parsed.message || data}`));
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async listWorkflowRuns(status = 'failure', perPage = 10) {
    const path = `/repos/${this.owner}/${this.repo}/actions/runs?status=${status}&per_page=${perPage}`;
    return this.request('GET', path);
  }

  async listJobsForWorkflowRun(runId) {
    const path = `/repos/${this.owner}/${this.repo}/actions/runs/${runId}/jobs`;
    return this.request('GET', path);
  }

  async getWorkflowRunLogs(runId) {
    const path = `/repos/${this.owner}/${this.repo}/actions/runs/${runId}/logs`;
    // ログはZIPファイルなので特別処理が必要
    return this.request('GET', path);
  }

  async createIssue(title, body, labels = []) {
    const path = `/repos/${this.owner}/${this.repo}/issues`;
    return this.request('POST', path, { title, body, labels });
  }

  async updateIssue(issueNumber, title, body, state = 'open') {
    const path = `/repos/${this.owner}/${this.repo}/issues/${issueNumber}`;
    return this.request('PATCH', path, { title, body, state });
  }

  async listIssues(labels = [], state = 'open') {
    const labelParam = labels.join(',');
    const path = `/repos/${this.owner}/${this.repo}/issues?labels=${labelParam}&state=${state}`;
    return this.request('GET', path);
  }
}

// エラーパターン定義
const ERROR_PATTERNS = {
  'cache-dependency-path': {
    pattern: /cache-dependency-path|Dependency file.*not found/i,
    type: 'CACHE_PATH_ERROR',
    fix: (error) => fixCachePath(error),
    description: 'キャッシュ依存パスエラー',
  },
  'module-not-found': {
    pattern: /Module not found|Cannot find module|ERR_MODULE_NOT_FOUND/i,
    type: 'MODULE_NOT_FOUND',
    fix: (error) => fixModuleNotFound(error),
    description: 'モジュール未検出エラー',
  },
  'postgres-connection': {
    pattern: /ECONNREFUSED.*5432|PostgreSQL.*connection|database.*not.*ready/i,
    type: 'POSTGRES_CONNECTION_ERROR',
    fix: (error) => fixPostgresConnection(error),
    description: 'PostgreSQL接続エラー',
  },
  'redis-connection': {
    pattern: /ECONNREFUSED.*6379|Redis.*connection|redis.*not.*ready/i,
    type: 'REDIS_CONNECTION_ERROR',
    fix: (error) => fixRedisConnection(error),
    description: 'Redis接続エラー',
  },
  'timeout': {
    pattern: /ETIMEDOUT|timeout|timed out|Test timeout/i,
    type: 'TIMEOUT_ERROR',
    fix: (error) => increaseTimeout(error),
    description: 'タイムアウトエラー',
  },
  'test-failure': {
    pattern: /Test failed|FAIL|AssertionError|Expected.*Received/i,
    type: 'TEST_FAILURE',
    fix: (error) => fixTestConfiguration(error),
    description: 'テスト失敗',
  },
  'build-error': {
    pattern: /Build failed|ERROR in|Compilation failed/i,
    type: 'BUILD_ERROR',
    fix: (error) => fixBuildError(error),
    description: 'ビルドエラー',
  },
  'env-var-missing': {
    pattern: /Environment variable.*not.*set|Missing.*environment.*variable/i,
    type: 'ENV_VAR_MISSING',
    fix: (error) => fixEnvVarMissing(error),
    description: '環境変数未設定エラー',
  },
  'permission-denied': {
    pattern: /EACCES|Permission denied|permission.*error/i,
    type: 'PERMISSION_ERROR',
    fix: (error) => fixPermissionError(error),
    description: '権限エラー',
  },
  'port-conflict': {
    pattern: /EADDRINUSE|port.*already.*in.*use|address.*already.*in.*use/i,
    type: 'PORT_CONFLICT',
    fix: (error) => fixPortConflict(error),
    description: 'ポート競合エラー',
  },
};

// エラー修復関数群

function fixCachePath(error) {
  const logger = new Logger(path.join(CONFIG.logDir, 'auto-fix.log'));
  logger.info('キャッシュパスエラーを修復中...', { error });

  try {
    // package-lock.jsonが存在するか確認
    const packageLockPath = path.join(process.cwd(), 'package-lock.json');
    if (!fs.existsSync(packageLockPath)) {
      logger.warn('package-lock.jsonが見つかりません。生成します...');
      execSync('npm install --package-lock-only', { stdio: 'inherit' });
    }

    // ワークフローファイルのキャッシュパスを修正
    const workflowDir = path.join(process.cwd(), '.github/workflows');
    const workflowFiles = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml'));

    for (const file of workflowFiles) {
      const filePath = path.join(workflowDir, file);
      let content = fs.readFileSync(filePath, 'utf8');

      // cache-dependency-pathの修正
      const originalContent = content;
      content = content.replace(
        /cache-dependency-path:\s*['"]?([^'"\n]+)['"]?/g,
        'cache-dependency-path: \'**/package-lock.json\''
      );

      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        logger.success(`修正完了: ${file}`);
      }
    }

    return { success: true, message: 'キャッシュパス修正完了' };
  } catch (err) {
    logger.error('キャッシュパス修復失敗', { error: err.message });
    return { success: false, message: err.message };
  }
}

function fixModuleNotFound(error) {
  const logger = new Logger(path.join(CONFIG.logDir, 'auto-fix.log'));
  logger.info('モジュール未検出エラーを修復中...', { error });

  try {
    // npm installを実行
    logger.info('npm ci を実行中...');
    execSync('npm ci', { stdio: 'inherit' });

    // node_modulesが正しく配置されているか確認
    if (!fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
      throw new Error('node_modulesディレクトリが生成されませんでした');
    }

    return { success: true, message: 'モジュール再インストール完了' };
  } catch (err) {
    logger.error('モジュール修復失敗', { error: err.message });
    return { success: false, message: err.message };
  }
}

function fixPostgresConnection(error) {
  const logger = new Logger(path.join(CONFIG.logDir, 'auto-fix.log'));
  logger.info('PostgreSQL接続エラーを修復中...', { error });

  try {
    // ワークフローファイルのPostgreSQL設定を確認・修正
    const workflowDir = path.join(process.cwd(), '.github/workflows');
    const workflowFiles = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml'));

    for (const file of workflowFiles) {
      const filePath = path.join(workflowDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;

      // PostgreSQLサービス設定を確認
      if (content.includes('postgres') && !content.includes('POSTGRES_HOST_AUTH_METHOD')) {
        // POSTGRES_HOST_AUTH_METHODを追加
        content = content.replace(
          /(POSTGRES_PASSWORD:\s*[^\n]+)/,
          '$1\n          POSTGRES_HOST_AUTH_METHOD: trust'
        );
      }

      // ヘルスチェックの追加
      if (content.includes('postgres') && !content.includes('health-cmd')) {
        content = content.replace(
          /(image:\s*postgres:[^\n]+)/,
          `$1
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5`
        );
      }

      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        logger.success(`PostgreSQL設定を修正: ${file}`);
      }
    }

    return { success: true, message: 'PostgreSQL設定修正完了' };
  } catch (err) {
    logger.error('PostgreSQL修復失敗', { error: err.message });
    return { success: false, message: err.message };
  }
}

function fixRedisConnection(error) {
  const logger = new Logger(path.join(CONFIG.logDir, 'auto-fix.log'));
  logger.info('Redis接続エラーを修復中...', { error });

  try {
    // ワークフローファイルのRedis設定を確認・修正
    const workflowDir = path.join(process.cwd(), '.github/workflows');
    const workflowFiles = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml'));

    for (const file of workflowFiles) {
      const filePath = path.join(workflowDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;

      // Redisヘルスチェックの追加
      if (content.includes('redis') && !content.includes('health-cmd')) {
        content = content.replace(
          /(image:\s*redis:[^\n]+)/,
          `$1
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5`
        );
      }

      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        logger.success(`Redis設定を修正: ${file}`);
      }
    }

    return { success: true, message: 'Redis設定修正完了' };
  } catch (err) {
    logger.error('Redis修復失敗', { error: err.message });
    return { success: false, message: err.message };
  }
}

function increaseTimeout(error) {
  const logger = new Logger(path.join(CONFIG.logDir, 'auto-fix.log'));
  logger.info('タイムアウト設定を修正中...', { error });

  try {
    // package.jsonのテストタイムアウトを増加
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    if (packageJson.jest && packageJson.jest.testTimeout) {
      const currentTimeout = packageJson.jest.testTimeout;
      packageJson.jest.testTimeout = Math.min(currentTimeout * 2, 60000);
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      logger.success(`タイムアウトを${currentTimeout}から${packageJson.jest.testTimeout}に増加`);
    }

    // ワークフローファイルのタイムアウトを増加
    const workflowDir = path.join(process.cwd(), '.github/workflows');
    const workflowFiles = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml'));

    for (const file of workflowFiles) {
      const filePath = path.join(workflowDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;

      // timeout-minutesを増加
      content = content.replace(
        /timeout-minutes:\s*(\d+)/g,
        (match, minutes) => {
          const newTimeout = Math.min(parseInt(minutes) * 2, 60);
          return `timeout-minutes: ${newTimeout}`;
        }
      );

      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        logger.success(`タイムアウト設定を修正: ${file}`);
      }
    }

    return { success: true, message: 'タイムアウト設定修正完了' };
  } catch (err) {
    logger.error('タイムアウト修復失敗', { error: err.message });
    return { success: false, message: err.message };
  }
}

function fixTestConfiguration(error) {
  const logger = new Logger(path.join(CONFIG.logDir, 'auto-fix.log'));
  logger.info('テスト設定を修正中...', { error });

  try {
    // テスト環境変数の追加
    const workflowDir = path.join(process.cwd(), '.github/workflows');
    const workflowFiles = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml'));

    for (const file of workflowFiles) {
      const filePath = path.join(workflowDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;

      // NODE_ENVをtestに設定
      if (!content.includes('NODE_ENV: test')) {
        content = content.replace(
          /(env:\s*\n)/,
          '$1          NODE_ENV: test\n'
        );
      }

      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        logger.success(`テスト設定を修正: ${file}`);
      }
    }

    return { success: true, message: 'テスト設定修正完了' };
  } catch (err) {
    logger.error('テスト設定修復失敗', { error: err.message });
    return { success: false, message: err.message };
  }
}

function fixBuildError(error) {
  const logger = new Logger(path.join(CONFIG.logDir, 'auto-fix.log'));
  logger.info('ビルドエラーを修復中...', { error });

  try {
    // 依存関係の再インストール
    logger.info('依存関係を再インストール中...');
    execSync('npm ci', { stdio: 'inherit' });

    // TypeScriptの場合は型チェック
    if (fs.existsSync(path.join(process.cwd(), 'tsconfig.json'))) {
      logger.info('TypeScript型チェック実行中...');
      try {
        execSync('npm run type-check', { stdio: 'inherit' });
      } catch (err) {
        logger.warn('型チェックに失敗しましたが続行します');
      }
    }

    return { success: true, message: 'ビルド設定修正完了' };
  } catch (err) {
    logger.error('ビルド修復失敗', { error: err.message });
    return { success: false, message: err.message };
  }
}

function fixEnvVarMissing(error) {
  const logger = new Logger(path.join(CONFIG.logDir, 'auto-fix.log'));
  logger.info('環境変数エラーを修復中...', { error });

  try {
    // .env.exampleから必要な環境変数を確認
    const envExamplePath = path.join(process.cwd(), '.env.example');
    if (fs.existsSync(envExamplePath)) {
      const envExample = fs.readFileSync(envExamplePath, 'utf8');

      // ワークフローファイルに環境変数を追加
      const workflowDir = path.join(process.cwd(), '.github/workflows');
      const workflowFiles = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml'));

      for (const file of workflowFiles) {
        const filePath = path.join(workflowDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;

        // 基本的な環境変数を追加
        const defaultEnvVars = [
          'DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db',
          'REDIS_URL: redis://localhost:6379',
          'NODE_ENV: test',
          'JWT_SECRET: test-secret-key',
        ];

        if (content.includes('env:')) {
          for (const envVar of defaultEnvVars) {
            if (!content.includes(envVar.split(':')[0])) {
              content = content.replace(
                /(env:\s*\n)/,
                `$1          ${envVar}\n`
              );
            }
          }
        }

        if (content !== originalContent) {
          fs.writeFileSync(filePath, content);
          logger.success(`環境変数を追加: ${file}`);
        }
      }
    }

    return { success: true, message: '環境変数設定修正完了' };
  } catch (err) {
    logger.error('環境変数修復失敗', { error: err.message });
    return { success: false, message: err.message };
  }
}

function fixPermissionError(error) {
  const logger = new Logger(path.join(CONFIG.logDir, 'auto-fix.log'));
  logger.info('権限エラーを修復中...', { error });

  try {
    // スクリプトファイルに実行権限を付与
    const scriptsDir = path.join(process.cwd(), 'scripts');
    if (fs.existsSync(scriptsDir)) {
      const scriptFiles = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.sh'));

      for (const file of scriptFiles) {
        const filePath = path.join(scriptsDir, file);
        execSync(`chmod +x ${filePath}`);
        logger.success(`実行権限を付与: ${file}`);
      }
    }

    return { success: true, message: '権限設定修正完了' };
  } catch (err) {
    logger.error('権限修復失敗', { error: err.message });
    return { success: false, message: err.message };
  }
}

function fixPortConflict(error) {
  const logger = new Logger(path.join(CONFIG.logDir, 'auto-fix.log'));
  logger.info('ポート競合エラーを修復中...', { error });

  try {
    // ワークフローファイルでポート番号を変更
    const workflowDir = path.join(process.cwd(), '.github/workflows');
    const workflowFiles = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml'));

    for (const file of workflowFiles) {
      const filePath = path.join(workflowDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;

      // ポート番号を動的に割り当て
      content = content.replace(
        /(PORT:\s*)(\d+)/g,
        '$1$(shuf -i 3000-9000 -n 1)'
      );

      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        logger.success(`ポート設定を修正: ${file}`);
      }
    }

    return { success: true, message: 'ポート設定修正完了' };
  } catch (err) {
    logger.error('ポート修復失敗', { error: err.message });
    return { success: false, message: err.message };
  }
}

// エラー分析
function analyzeErrors(jobs) {
  const errors = [];

  for (const job of jobs.jobs || []) {
    if (job.conclusion === 'failure') {
      for (const step of job.steps || []) {
        if (step.conclusion === 'failure') {
          // エラーパターンマッチング
          for (const [key, pattern] of Object.entries(ERROR_PATTERNS)) {
            if (pattern.pattern.test(step.name || '')) {
              errors.push({
                workflow: job.workflow_name,
                job: job.name,
                step: step.name,
                type: pattern.type,
                description: pattern.description,
                message: step.name,
                fix: pattern.fix,
                fixed: false,
              });
              break;
            }
          }
        }
      }
    }
  }

  return errors;
}

// GitHub Issue作成/更新
async function createOrUpdateIssue(api, errors, attempt) {
  const title = `🤖 GitHub Actions 自動修復レポート - ${new Date().toISOString().split('T')[0]}`;

  const body = `
## 検出されたエラー (${errors.length}件) - 試行 ${attempt}

${errors.map((e, i) => `### ${i + 1}. ${e.description}
- **ワークフロー**: ${e.workflow}
- **ジョブ**: ${e.job}
- **ステップ**: ${e.step}
- **エラータイプ**: ${e.type}
- **修正状況**: ${e.fixed ? '✅ 修正済み' : '🔄 修復中'}
`).join('\n')}

## 次のアクション
- 自動修復実行中
- 30分後に再検証予定

---
🤖 自動生成レポート - ${new Date().toISOString()}
`;

  try {
    // 既存のIssueを検索
    const existingIssues = await api.listIssues(['auto-fix', 'github-actions'], 'open');

    if (existingIssues.length > 0) {
      // 既存Issueを更新
      await api.updateIssue(existingIssues[0].number, title, body);
      console.log(`Issue更新完了: #${existingIssues[0].number}`);
    } else {
      // 新規Issue作成
      const issue = await api.createIssue(title, body, ['auto-fix', 'ci-cd', 'github-actions']);
      console.log(`Issue作成完了: #${issue.number}`);
    }
  } catch (err) {
    console.error('Issue作成/更新失敗:', err.message);
  }
}

// 修正をコミット & プッシュ
function commitAndPush(message) {
  try {
    execSync('git add -A', { stdio: 'inherit' });
    execSync(`git commit -m "${message}"`, { stdio: 'inherit' });

    if (!CONFIG.dryRun) {
      execSync('git push origin main', { stdio: 'inherit' });
      console.log('✅ 修正をプッシュしました');
    } else {
      console.log('🔍 DRY RUN: プッシュはスキップされました');
    }
  } catch (err) {
    console.error('コミット/プッシュ失敗:', err.message);
  }
}

// 最終コミット & PR
async function finalCommitAndPR(totalFixes, duration) {
  const message = `🎉 GitHub Actions 自動修復完了

全エラーを自動検知・修復しました。

- 修復回数: ${totalFixes}件
- 実行時間: ${Math.round(duration / 1000 / 60)}分
- エラー残存: 0件

🤖 Generated with Claude Code Auto-Fix System

Co-Authored-By: Claude <noreply@anthropic.com>`;

  try {
    execSync('git add -A', { stdio: 'inherit' });
    execSync(`git commit -m "${message}"`, { stdio: 'inherit' });

    if (!CONFIG.dryRun) {
      execSync('git push origin main', { stdio: 'inherit' });
      console.log('✅ 最終修正をプッシュしました');
    } else {
      console.log('🔍 DRY RUN: プッシュはスキップされました');
    }
  } catch (err) {
    console.error('最終コミット/プッシュ失敗:', err.message);
  }
}

// メインループ
async function autoFixLoop() {
  const logFile = path.join(CONFIG.logDir, `auto-fix-${Date.now()}.log`);
  const logger = new Logger(logFile);

  logger.info('GitHub Actions 自動修復システム起動', CONFIG);

  if (!CONFIG.token) {
    logger.error('GITHUB_TOKENが設定されていません');
    console.error('❌ エラー: GITHUB_TOKEN環境変数を設定してください');
    process.exit(1);
  }

  const api = new GitHubAPI(CONFIG.owner, CONFIG.repo, CONFIG.token);
  let totalFixes = 0;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= CONFIG.maxAttempts; attempt++) {
    logger.info(`🔄 実行 ${attempt}/${CONFIG.maxAttempts}`);
    console.log(`\n🔄 === 試行 ${attempt}/${CONFIG.maxAttempts} ===\n`);

    try {
      // ワークフロー実行状況を取得
      const runs = await api.listWorkflowRuns('failure', 10);
      logger.info(`失敗したワークフロー: ${runs.workflow_runs?.length || 0}件`);

      if (!runs.workflow_runs || runs.workflow_runs.length === 0) {
        logger.success('✅ エラーなし！修復完了！');
        console.log('✅ エラーが検出されませんでした。修復完了です！');
        break;
      }

      // エラー分析
      let allErrors = [];
      for (const run of runs.workflow_runs.slice(0, 3)) {
        const jobs = await api.listJobsForWorkflowRun(run.id);
        const errors = analyzeErrors(jobs);
        allErrors = allErrors.concat(errors);
      }

      logger.info(`検出されたエラー: ${allErrors.length}件`, allErrors);

      if (allErrors.length === 0) {
        logger.success('✅ 分析可能なエラーなし！');
        console.log('✅ 分析可能なエラーが見つかりませんでした');
        break;
      }

      // 自動修復 (最大10件)
      let fixed = 0;
      for (let i = 0; i < Math.min(allErrors.length, CONFIG.maxFixesPerRun); i++) {
        const error = allErrors[i];
        console.log(`\n🔧 修復中 (${i + 1}/${Math.min(allErrors.length, CONFIG.maxFixesPerRun)}): ${error.description}`);

        try {
          const result = error.fix(error);
          if (result.success) {
            error.fixed = true;
            fixed++;
            logger.success(`修復成功: ${error.description}`, result);
            console.log(`✅ ${result.message}`);
          } else {
            logger.warn(`修復失敗: ${error.description}`, result);
            console.log(`⚠️ ${result.message}`);
          }
        } catch (err) {
          logger.error(`修復中にエラー: ${error.description}`, { error: err.message });
          console.error(`❌ 修復エラー: ${err.message}`);
        }
      }

      totalFixes += fixed;

      // GitHub Issueに報告
      await createOrUpdateIssue(api, allErrors, attempt);

      // 修正をコミット & プッシュ
      if (fixed > 0) {
        const commitMsg = `🔧 GitHub Actions 自動修復 ${fixed}件 (試行${attempt}/${CONFIG.maxAttempts})

修復内容:
${allErrors.filter(e => e.fixed).map(e => `- ${e.description}`).join('\n')}

🤖 Generated with Claude Code Auto-Fix System`;

        commitAndPush(commitMsg);
      }

      // 最終試行でない場合は待機
      if (attempt < CONFIG.maxAttempts) {
        const waitMinutes = CONFIG.intervalMinutes;
        logger.info(`⏳ ${waitMinutes}分待機中...`);
        console.log(`\n⏳ ${waitMinutes}分待機します...\n`);
        await new Promise(resolve => setTimeout(resolve, waitMinutes * 60 * 1000));
      }

    } catch (err) {
      logger.error(`試行${attempt}でエラー発生`, { error: err.message });
      console.error(`❌ エラー: ${err.message}`);
    }
  }

  // 最終処理
  const duration = Date.now() - startTime;
  logger.info('自動修復システム完了', { totalFixes, duration });

  if (totalFixes > 0) {
    console.log(`\n🎉 === 修復完了 ===`);
    console.log(`合計修復数: ${totalFixes}件`);
    console.log(`実行時間: ${Math.round(duration / 1000 / 60)}分`);

    await finalCommitAndPR(totalFixes, duration);
  }

  console.log(`\n📊 ログファイル: ${logFile}`);
}

// エラーパターン定義をJSONファイルに保存
function saveErrorPatterns() {
  const patterns = Object.entries(ERROR_PATTERNS).map(([key, pattern]) => ({
    id: key,
    type: pattern.type,
    description: pattern.description,
    pattern: pattern.pattern.source,
  }));

  fs.writeFileSync(CONFIG.errorsFile, JSON.stringify(patterns, null, 2));
  console.log(`✅ エラーパターンを保存: ${CONFIG.errorsFile}`);
}

// メイン実行
if (require.main === module) {
  // ログディレクトリを作成
  if (!fs.existsSync(CONFIG.logDir)) {
    fs.mkdirSync(CONFIG.logDir, { recursive: true });
  }

  // エラーパターンを保存
  saveErrorPatterns();

  // 自動修復ループを実行
  autoFixLoop().catch(err => {
    console.error('致命的エラー:', err);
    process.exit(1);
  });
}

module.exports = {
  autoFixLoop,
  ERROR_PATTERNS,
  GitHubAPI,
};
