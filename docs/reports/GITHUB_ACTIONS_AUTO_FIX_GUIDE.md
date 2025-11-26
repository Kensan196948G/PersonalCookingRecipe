# GitHub Actions 自動修復システム 完全ガイド

## 📋 目次

1. [概要](#概要)
2. [システム構成](#システム構成)
3. [自動修復パターン](#自動修復パターン)
4. [セットアップ](#セットアップ)
5. [使用方法](#使用方法)
6. [設定オプション](#設定オプション)
7. [トラブルシューティング](#トラブルシューティング)
8. [実行例](#実行例)

---

## 概要

GitHub Actions 自動修復システムは、CI/CDパイプラインの失敗を自動的に検知・分析・修復する完全自動化システムです。

### 主な機能

- ✅ **自動エラー検知**: GitHub Actions APIでワークフロー実行状況を監視
- ✅ **エラー分析**: 10種類以上のエラーパターンを自動識別
- ✅ **自動修復**: 検出したエラーを自動的に修正
- ✅ **繰り返し実行**: 最大10回、30分間隔で自動修復を試行
- ✅ **Issue統合**: 修復状況をGitHub Issueに自動報告
- ✅ **最終報告**: 全修復完了後に最終コミット & PR作成

### システムアーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                 GitHub Actions Auto-Fix System               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
         ┌────────────────────────────────────────┐
         │  1. エラー検知 (GitHub API)             │
         │     - ワークフロー実行状況取得           │
         │     - 失敗ジョブのログ取得               │
         └────────────────┬───────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────────┐
         │  2. エラー分析                          │
         │     - パターンマッチング                 │
         │     - エラー分類                         │
         └────────────────┬───────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────────┐
         │  3. 自動修復 (最大10件)                  │
         │     - ファイル修正                       │
         │     - 設定変更                           │
         └────────────────┬───────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────────┐
         │  4. コミット & プッシュ                  │
         │     - 変更をコミット                     │
         │     - リモートリポジトリにプッシュ        │
         └────────────────┬───────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────────┐
         │  5. Issue報告                           │
         │     - 修復状況を報告                     │
         │     - ラベル付与                         │
         └────────────────┬───────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────────┐
         │  6. 30分待機 & 再試行                    │
         │     (最大10回繰り返し)                   │
         └────────────────┬───────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────────┐
         │  7. 最終コミット & PR                    │
         │     - 全修復完了報告                     │
         └────────────────────────────────────────┘
```

---

## システム構成

### ファイル構成

```
backend/
├── scripts/
│   ├── github-actions-auto-fix.js    # メインスクリプト
│   └── gh-error-patterns.json        # エラーパターン定義
├── .github/
│   └── workflows/
│       └── auto-fix.yml              # 自動修復ワークフロー
├── logs/
│   └── auto-fix-*.log                # 実行ログ
└── GITHUB_ACTIONS_AUTO_FIX_GUIDE.md  # 本ガイド
```

### コンポーネント

#### 1. **github-actions-auto-fix.js** (メインスクリプト)

主要クラス:
- `GitHubAPI`: GitHub API通信
- `Logger`: ログ記録
- `autoFixLoop`: メイン実行ループ

主要関数:
- `analyzeErrors`: エラー分析
- `createOrUpdateIssue`: Issue作成/更新
- `commitAndPush`: Git操作
- `finalCommitAndPR`: 最終処理

#### 2. **gh-error-patterns.json** (エラーパターン定義)

10種類のエラーパターンを定義:
- パターンマッチング正規表現
- 修復戦略
- 重要度レベル
- 自動修復可否

#### 3. **auto-fix.yml** (ワークフローファイル)

実行トリガー:
- スケジュール実行 (毎日UTC 00:00)
- 手動実行 (workflow_dispatch)

---

## 自動修復パターン

### 1. キャッシュパスエラー

**検出パターン**:
```regex
/cache-dependency-path|Dependency file.*not found/i
```

**修復戦略**:
1. `package-lock.json` の存在確認
2. 存在しない場合は `npm install --package-lock-only` で生成
3. ワークフローファイルの `cache-dependency-path` を修正

**修正例**:
```yaml
# 修正前
cache-dependency-path: 'package-lock.json'

# 修正後
cache-dependency-path: '**/package-lock.json'
```

---

### 2. モジュール未検出エラー

**検出パターン**:
```regex
/Module not found|Cannot find module|ERR_MODULE_NOT_FOUND/i
```

**修復戦略**:
1. `npm ci` で依存関係を再インストール
2. `node_modules` ディレクトリの存在確認

**実行コマンド**:
```bash
npm ci
```

---

### 3. PostgreSQL接続エラー

**検出パターン**:
```regex
/ECONNREFUSED.*5432|PostgreSQL.*connection|database.*not.*ready/i
```

**修復戦略**:
1. PostgreSQLサービス設定に `POSTGRES_HOST_AUTH_METHOD: trust` を追加
2. ヘルスチェック設定を追加

**修正例**:
```yaml
services:
  postgres:
    image: postgres:14
    env:
      POSTGRES_PASSWORD: postgres
      POSTGRES_HOST_AUTH_METHOD: trust  # 追加
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

---

### 4. Redis接続エラー

**検出パターン**:
```regex
/ECONNREFUSED.*6379|Redis.*connection|redis.*not.*ready/i
```

**修復戦略**:
1. Redisサービスにヘルスチェック設定を追加

**修正例**:
```yaml
services:
  redis:
    image: redis:7
    options: >-
      --health-cmd "redis-cli ping"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

---

### 5. タイムアウトエラー

**検出パターン**:
```regex
/ETIMEDOUT|timeout|timed out|Test timeout/i
```

**修復戦略**:
1. `package.json` の `testTimeout` を2倍に増加（最大60秒）
2. ワークフローの `timeout-minutes` を2倍に増加（最大60分）

**修正例**:
```json
// package.json
{
  "jest": {
    "testTimeout": 30000  // 15000 → 30000
  }
}
```

```yaml
# workflow.yml
jobs:
  test:
    timeout-minutes: 30  # 15 → 30
```

---

### 6. テスト失敗

**検出パターン**:
```regex
/Test failed|FAIL|AssertionError|Expected.*Received/i
```

**修復戦略**:
1. `NODE_ENV=test` 環境変数を追加
2. テスト環境変数の確認・追加

**修正例**:
```yaml
env:
  NODE_ENV: test
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
```

---

### 7. ビルドエラー

**検出パターン**:
```regex
/Build failed|ERROR in|Compilation failed/i
```

**修復戦略**:
1. `npm ci` で依存関係を再インストール
2. TypeScriptの場合は型チェック実行

**実行コマンド**:
```bash
npm ci
npm run type-check  # TypeScriptの場合
```

---

### 8. 環境変数未設定エラー

**検出パターン**:
```regex
/Environment variable.*not.*set|Missing.*environment.*variable/i
```

**修復戦略**:
1. `.env.example` から必要な環境変数を確認
2. ワークフローファイルに環境変数を追加

**追加される環境変数**:
```yaml
env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
  REDIS_URL: redis://localhost:6379
  NODE_ENV: test
  JWT_SECRET: test-secret-key
```

---

### 9. 権限エラー

**検出パターン**:
```regex
/EACCES|Permission denied|permission.*error/i
```

**修復戦略**:
1. `scripts/` ディレクトリ内の `.sh` ファイルに実行権限を付与

**実行コマンド**:
```bash
chmod +x scripts/*.sh
```

---

### 10. ポート競合エラー

**検出パターン**:
```regex
/EADDRINUSE|port.*already.*in.*use|address.*already.*in.*use/i
```

**修復戦略**:
1. ポート番号を動的に割り当て（3000-9000のランダムポート）

**修正例**:
```yaml
env:
  PORT: $(shuf -i 3000-9000 -n 1)
```

---

## セットアップ

### 前提条件

- Node.js 18以上
- Git設定済み
- GitHub Personal Access Token (repo, workflow, issuesスコープ)

### インストール手順

#### 1. 依存関係のインストール

```bash
cd backend
npm install
```

#### 2. GitHub Tokenの設定

```bash
# 環境変数として設定
export GITHUB_TOKEN="your_github_personal_access_token"

# または .env ファイルに追加
echo "GITHUB_TOKEN=your_github_personal_access_token" >> .env
```

#### 3. スクリプトに実行権限を付与

```bash
chmod +x scripts/github-actions-auto-fix.js
```

#### 4. ログディレクトリの作成

```bash
mkdir -p logs
```

---

## 使用方法

### 手動実行

#### 基本実行

```bash
cd backend
node scripts/github-actions-auto-fix.js
```

#### 環境変数付き実行

```bash
GITHUB_TOKEN=your_token \
MAX_ATTEMPTS=10 \
INTERVAL_MINUTES=30 \
node scripts/github-actions-auto-fix.js
```

#### Dry Runモード（実際にはプッシュしない）

```bash
DRY_RUN=true \
GITHUB_TOKEN=your_token \
node scripts/github-actions-auto-fix.js
```

### GitHub Actionsでの自動実行

#### スケジュール実行

ワークフローは毎日UTC 00:00（JST 09:00）に自動実行されます。

#### 手動実行

1. GitHubリポジトリの「Actions」タブを開く
2. 「GitHub Actions Auto-Fix」ワークフローを選択
3. 「Run workflow」ボタンをクリック
4. パラメータを設定:
   - **max_attempts**: 最大試行回数（デフォルト: 10）
   - **interval_minutes**: 試行間隔（デフォルト: 30分）
   - **dry_run**: Dry Runモード（デフォルト: false）
5. 「Run workflow」をクリック

---

## 設定オプション

### 環境変数

| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|--------------|------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | - | ✅ |
| `GITHUB_OWNER` | リポジトリオーナー名 | `Kensan196948G` | ❌ |
| `GITHUB_REPO` | リポジトリ名 | `PersonalCookingRecipe` | ❌ |
| `MAX_ATTEMPTS` | 最大試行回数 | `10` | ❌ |
| `INTERVAL_MINUTES` | 試行間隔（分） | `30` | ❌ |
| `DRY_RUN` | Dry Runモード | `false` | ❌ |

### スクリプト設定

`scripts/github-actions-auto-fix.js` の `CONFIG` オブジェクトで設定可能:

```javascript
const CONFIG = {
  owner: process.env.GITHUB_OWNER || 'Kensan196948G',
  repo: process.env.GITHUB_REPO || 'PersonalCookingRecipe',
  token: process.env.GITHUB_TOKEN,
  maxAttempts: parseInt(process.env.MAX_ATTEMPTS || '10'),
  intervalMinutes: parseInt(process.env.INTERVAL_MINUTES || '30'),
  maxFixesPerRun: 10,  // 1回あたりの最大修復数
  dryRun: process.env.DRY_RUN === 'true',
  logDir: path.join(__dirname, '../logs'),
  errorsFile: path.join(__dirname, 'gh-error-patterns.json'),
};
```

---

## トラブルシューティング

### 問題1: GITHUB_TOKENエラー

**症状**:
```
❌ エラー: GITHUB_TOKEN環境変数を設定してください
```

**解決方法**:
1. GitHub Personal Access Tokenを生成
2. 必要なスコープ: `repo`, `workflow`, `issues`
3. 環境変数として設定:
   ```bash
   export GITHUB_TOKEN="your_token"
   ```

---

### 問題2: GitHub API レート制限

**症状**:
```
HTTP 403: API rate limit exceeded
```

**解決方法**:
1. 認証済みリクエストは5000回/時まで可能
2. `GITHUB_TOKEN` が正しく設定されているか確認
3. レート制限リセット時刻を確認:
   ```bash
   curl -H "Authorization: token $GITHUB_TOKEN" \
        https://api.github.com/rate_limit
   ```

---

### 問題3: ワークフロー実行が見つからない

**症状**:
```
✅ エラーが検出されませんでした。修復完了です！
```
（実際にはエラーがあるのに検出されない）

**解決方法**:
1. ワークフロー実行履歴を確認:
   ```bash
   gh run list --limit 10
   ```
2. 失敗したワークフローが存在するか確認
3. `status=failure` のフィルタが正しく動作しているか確認

---

### 問題4: コミット/プッシュ失敗

**症状**:
```
コミット/プッシュ失敗: ...
```

**解決方法**:
1. Git設定を確認:
   ```bash
   git config user.name
   git config user.email
   ```
2. リモートリポジトリへのアクセス権限を確認
3. `GITHUB_TOKEN` に `contents: write` 権限があるか確認

---

### 問題5: Issue作成失敗

**症状**:
```
Issue作成/更新失敗: ...
```

**解決方法**:
1. `GITHUB_TOKEN` に `issues: write` 権限があるか確認
2. リポジトリのIssue機能が有効か確認
3. Issue作成権限があるか確認

---

## 実行例

### 実行例1: 成功ケース（エラーなし）

```bash
$ node scripts/github-actions-auto-fix.js

✅ エラーパターンを保存: scripts/gh-error-patterns.json

[2025-01-21T00:00:00.000Z] INFO: GitHub Actions 自動修復システム起動

🔄 === 試行 1/10 ===

[2025-01-21T00:00:01.234Z] INFO: 失敗したワークフロー: 0件
[2025-01-21T00:00:01.235Z] SUCCESS: ✅ エラーなし！修復完了！
✅ エラーが検出されませんでした。修復完了です！

📊 ログファイル: logs/auto-fix-1737417600000.log
```

---

### 実行例2: エラー検出 & 自動修復

```bash
$ GITHUB_TOKEN=ghp_xxx node scripts/github-actions-auto-fix.js

✅ エラーパターンを保存: scripts/gh-error-patterns.json

[2025-01-21T00:00:00.000Z] INFO: GitHub Actions 自動修復システム起動

🔄 === 試行 1/10 ===

[2025-01-21T00:00:05.123Z] INFO: 失敗したワークフロー: 3件
[2025-01-21T00:00:07.456Z] INFO: 検出されたエラー: 5件

🔧 修復中 (1/5): キャッシュ依存パスエラー
[2025-01-21T00:00:08.123Z] INFO: キャッシュパスエラーを修復中...
[2025-01-21T00:00:08.789Z] SUCCESS: 修正完了: phase1-emergency-stabilization.yml
✅ キャッシュパス修正完了

🔧 修復中 (2/5): PostgreSQL接続エラー
[2025-01-21T00:00:09.456Z] INFO: PostgreSQL接続エラーを修復中...
[2025-01-21T00:00:10.123Z] SUCCESS: PostgreSQL設定を修正: qa-pipeline.yml
✅ PostgreSQL設定修正完了

🔧 修復中 (3/5): タイムアウトエラー
[2025-01-21T00:00:11.789Z] INFO: タイムアウト設定を修正中...
[2025-01-21T00:00:12.456Z] SUCCESS: タイムアウト設定を修正: deploy.yml
✅ タイムアウト設定修正完了

Issue作成完了: #123

[main 7a8b9c0] 🔧 GitHub Actions 自動修復 3件 (試行1/10)

修復内容:
- キャッシュ依存パスエラー
- PostgreSQL接続エラー
- タイムアウトエラー

🤖 Generated with Claude Code Auto-Fix System
 3 files changed, 15 insertions(+), 5 deletions(-)

✅ 修正をプッシュしました

⏳ 30分待機します...

🔄 === 試行 2/10 ===

[2025-01-21T00:30:05.789Z] INFO: 失敗したワークフロー: 0件
[2025-01-21T00:30:05.790Z] SUCCESS: ✅ エラーなし！修復完了！
✅ エラーが検出されませんでした。修復完了です！

🎉 === 修復完了 ===
合計修復数: 3件
実行時間: 31分

[main 8b9c0d1] 🎉 GitHub Actions 自動修復完了

全エラーを自動検知・修復しました。

- 修復回数: 3件
- 実行時間: 31分
- エラー残存: 0件

🤖 Generated with Claude Code Auto-Fix System

Co-Authored-By: Claude <noreply@anthropic.com>
 1 file changed, 5 insertions(+), 2 deletions(-)

✅ 最終修正をプッシュしました

📊 ログファイル: logs/auto-fix-1737417600000.log
```

---

### 実行例3: Dry Runモード

```bash
$ DRY_RUN=true GITHUB_TOKEN=ghp_xxx node scripts/github-actions-auto-fix.js

✅ エラーパターンを保存: scripts/gh-error-patterns.json

[2025-01-21T00:00:00.000Z] INFO: GitHub Actions 自動修復システム起動

🔄 === 試行 1/10 ===

[2025-01-21T00:00:05.123Z] INFO: 失敗したワークフロー: 2件
[2025-01-21T00:00:07.456Z] INFO: 検出されたエラー: 3件

🔧 修復中 (1/3): モジュール未検出エラー
[2025-01-21T00:00:08.123Z] INFO: モジュール未検出エラーを修復中...
[2025-01-21T00:00:20.789Z] SUCCESS: モジュール再インストール完了
✅ モジュール再インストール完了

Issue作成完了: #124

[main 9c0d1e2] 🔧 GitHub Actions 自動修復 1件 (試行1/10)
 10 files changed, 0 insertions(+), 0 deletions(-)

🔍 DRY RUN: プッシュはスキップされました

⏳ 30分待機します...

^C  # Ctrl+C で中断
```

---

### ログファイル形式

```json
{"timestamp":"2025-01-21T00:00:00.000Z","level":"INFO","message":"GitHub Actions 自動修復システム起動","data":{...},"elapsed":0}
{"timestamp":"2025-01-21T00:00:05.123Z","level":"INFO","message":"失敗したワークフロー: 3件","data":null,"elapsed":5123}
{"timestamp":"2025-01-21T00:00:08.123Z","level":"INFO","message":"キャッシュパスエラーを修復中...","data":{...},"elapsed":8123}
{"timestamp":"2025-01-21T00:00:08.789Z","level":"SUCCESS","message":"修正完了: phase1-emergency-stabilization.yml","data":null,"elapsed":8789}
...
```

---

## 拡張・カスタマイズ

### 新しいエラーパターンの追加

#### 1. `ERROR_PATTERNS` に追加

```javascript
// scripts/github-actions-auto-fix.js

const ERROR_PATTERNS = {
  // 既存のパターン...

  'new-error-pattern': {
    pattern: /Your error pattern regex/i,
    type: 'NEW_ERROR_TYPE',
    fix: (error) => fixNewError(error),
    description: '新しいエラーパターン',
  },
};
```

#### 2. 修復関数を実装

```javascript
function fixNewError(error) {
  const logger = new Logger(path.join(CONFIG.logDir, 'auto-fix.log'));
  logger.info('新しいエラーを修復中...', { error });

  try {
    // 修復ロジックをここに実装

    return { success: true, message: '修復完了' };
  } catch (err) {
    logger.error('修復失敗', { error: err.message });
    return { success: false, message: err.message };
  }
}
```

#### 3. `gh-error-patterns.json` に追加

```json
{
  "id": "new-error-pattern",
  "type": "NEW_ERROR_TYPE",
  "description": "新しいエラーパターン",
  "pattern": "Your error pattern regex",
  "fixStrategy": "修復戦略の説明",
  "severity": "medium",
  "autoFixable": true
}
```

---

## まとめ

GitHub Actions 自動修復システムは、以下を提供します:

- ✅ **完全自動化**: エラー検知から修復、報告まで全自動
- ✅ **高い柔軟性**: 10種類以上のエラーパターンに対応
- ✅ **安全性**: Dry Runモードとログ記録で安全に運用
- ✅ **拡張性**: 新しいエラーパターンを簡単に追加可能
- ✅ **透明性**: GitHub Issueとログで全プロセスを可視化

このシステムにより、CI/CDパイプラインの安定性と開発生産性が大幅に向上します。

---

## サポート

問題が発生した場合:

1. ログファイル (`logs/auto-fix-*.log`) を確認
2. GitHub Issue (#auto-fix ラベル) を確認
3. 本ガイドのトラブルシューティングセクションを参照
4. 新しいIssueを作成して報告

---

## ライセンス

MIT License

---

**最終更新**: 2025-01-21
**バージョン**: 1.0.0
**作成者**: Claude Code Auto-Fix System
