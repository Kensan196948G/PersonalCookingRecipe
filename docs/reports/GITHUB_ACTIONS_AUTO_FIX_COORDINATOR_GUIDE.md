# GitHub Actions 自動修復調整・監視システムガイド

## 📋 概要

PersonalCookingRecipeプロジェクトのGitHub Actions自動修復システムを最適化する調整・監視システムです。

### 主要機能

1. **エラー優先順位付け** - エラーの深刻度に基づいた自動分類
2. **修復成功率監視** - 各修復パターンの効果を追跡
3. **タイムアウト管理** - 30分間隔の自動実行制御
4. **GitHub Issue統合** - エラーと修復の自動Issue管理
5. **実行レポート生成** - 詳細な統計とトレンド分析

---

## 🚀 クイックスタート

### 1. 環境変数の設定

```bash
# GitHub認証トークン
export GITHUB_TOKEN="your_github_token"

# リポジトリ情報
export GITHUB_REPO_OWNER="your-username"
export GITHUB_REPO_NAME="PersonalCookingRecipe"

# 実行間隔（分）
export AUTO_FIX_INTERVAL=30
```

### 2. システムの起動

```bash
# 調整システムを初期化して実行
node scripts/github-actions-coordinator.js

# 修復成功率レポートを表示
node scripts/fix-success-monitor.js report
```

### 3. 統計情報の確認

```bash
# 全体統計を表示
node scripts/fix-success-monitor.js stats

# 成功率トップ10を表示
node scripts/fix-success-monitor.js top

# 要改善パターンを表示
node scripts/fix-success-monitor.js worst
```

---

## 🎯 エラー優先順位付けシステム

### 優先順位レベル

| レベル | スコア | 説明 | 例 |
|--------|--------|------|-----|
| **CRITICAL** | 100+ | システム全体に影響 | ビルド失敗、デプロイ失敗 |
| **HIGH** | 75-99 | 重要な機能に影響 | テスト失敗、セキュリティ脆弱性 |
| **MEDIUM** | 50-74 | 軽微な影響 | 警告、パフォーマンス問題 |
| **LOW** | 0-49 | 影響小 | ドキュメント、スタイル |

### 優先順位計算ロジック

```javascript
優先順位 = 基本優先順位 + 調整値

調整値の要素:
- 修復成功率が高い: +10
- 頻繁に発生: +15
- ブロッキングエラー: +50
```

### エラータイプ別デフォルト優先順位

```json
{
  "build-failure": "CRITICAL",
  "deploy-failure": "CRITICAL",
  "test-failure": "HIGH",
  "security-vulnerability": "HIGH",
  "dependency-error": "HIGH",
  "linting-error": "MEDIUM",
  "warning": "MEDIUM",
  "performance-issue": "MEDIUM",
  "documentation": "LOW",
  "style-issue": "LOW"
}
```

---

## 📊 修復成功率監視

### FixSuccessMonitor の使い方

#### プログラムから使用

```javascript
const FixSuccessMonitor = require('./scripts/fix-success-monitor');

const monitor = new FixSuccessMonitor();
await monitor.load();

// 修復試行を記録
await monitor.recordFix('npm-build-error', true, {
  duration: 3456,
  errorMessage: 'Build failed',
  fixApplied: 'npm install --legacy-peer-deps'
});

// 成功率を取得
const successRate = monitor.getSuccessRate('npm-build-error');
console.log(`成功率: ${(successRate * 100).toFixed(2)}%`);

// 再試行すべきか判定
const shouldRetry = monitor.shouldRetry('npm-build-error');
console.log(`再試行: ${shouldRetry ? 'はい' : 'いいえ'}`);
```

#### CLIから使用

```bash
# 統計レポート生成
node scripts/fix-success-monitor.js report

# 全体統計表示
node scripts/fix-success-monitor.js stats

# 成功率トップ10
node scripts/fix-success-monitor.js top

# 要改善パターン
node scripts/fix-success-monitor.js worst

# 最近の修復履歴（20件）
node scripts/fix-success-monitor.js history 20

# 統計データをクリア
node scripts/fix-success-monitor.js clear
```

### 統計データ構造

```json
{
  "patterns": {
    "npm-build-error": {
      "attempts": 15,
      "successes": 12,
      "failures": 3,
      "successRate": 0.8,
      "avgDuration": 3456.7,
      "durations": [3200, 3450, 3789, ...],
      "lastAttempt": "2025-11-21T15:00:00.000Z",
      "firstSeen": "2025-11-15T10:00:00.000Z"
    }
  },
  "overall": {
    "totalAttempts": 115,
    "totalSuccesses": 95,
    "totalFailures": 20,
    "lastUpdated": "2025-11-21T15:00:00.000Z"
  },
  "history": [...]
}
```

---

## ⏰ タイムアウト管理

### スケジューリング機能

```javascript
// 30分間隔で実行をスケジュール
await coordinator.scheduleNextRun(30);

// 次回実行時刻をログに記録
// logs/auto-fix-schedule.log に保存
```

### スケジュールログ形式

```
Next run: 2025-11-21T16:00:00.000Z (in 30 minutes)
Next run: 2025-11-21T16:30:00.000Z (in 30 minutes)
Next run: 2025-11-21T17:00:00.000Z (in 30 minutes)
```

### 連続実行ループ

```javascript
// エラー検出関数を定義
async function detectErrors() {
  // GitHub Actionsから最新のエラーを取得
  return [
    { type: 'build-failure', message: '...' },
    { type: 'test-failure', message: '...' }
  ];
}

// ループを開始
await coordinator.startLoop(detectErrors);
```

---

## 🔗 GitHub Issue統合

### 自動Issue管理

システムは以下の操作を自動的に実行します:

1. **新規Issue作成** - 未修復のエラーを検出時
2. **Issue更新** - 修復進捗を更新
3. **Issue クローズ** - 修復完了時

### Issue作成例

```markdown
## エラー情報

- **タイプ**: build-failure
- **パターン**: npm-build-error
- **優先順位**: 100
- **検出日時**: 2025-11-21T15:00:00.000Z

## エラーメッセージ

```
Build failed due to missing dependency
```

## 適用された修復

1. npm install --legacy-peer-deps
   - 成功: ✅
   - 実行時間: 3456ms

## 統計情報

- 修復成功率: 80.00%
- 再試行推奨: はい
```

### Issue検索・更新

```javascript
// Issueを検索
const issue = await coordinator.findIssue('🤖 Auto-Fix: build-failure');

// Issueを更新
await coordinator.updateIssue(issue.number, {
  body: updatedBody,
  state: 'closed'
});

// 新規Issueを作成
await coordinator.createIssue(title, errorInfo);
```

---

## 📈 実行レポート生成

### レポート構造

```json
{
  "timestamp": "2025-11-21T15:00:00.000Z",
  "attempt": 1,
  "errorsDetected": 4,
  "errorsFixed": 3,
  "errorsFailed": 1,
  "successRate": 0.75,
  "duration": 12345,
  "nextRun": "2025-11-21T15:30:00.000Z",
  "priorityBreakdown": {
    "critical": 1,
    "high": 2,
    "medium": 1,
    "low": 0
  },
  "errors": [...],
  "fixes": [...]
}
```

### 実行サマリー表示

```
============================================================
  GitHub Actions 自動修復実行サマリー
============================================================

実行日時: 2025-11-21 15:00:00
実行回数: 1

【エラー検出】
  総数: 4件
  - CRITICAL: 1件
  - HIGH: 2件
  - MEDIUM: 1件
  - LOW: 0件

【修復結果】
  成功: 3件
  失敗: 1件
  成功率: 75.00%

【実行時間】
  総実行時間: 12.35秒
  次回実行: 2025-11-21 15:30:00

============================================================
```

---

## 🔧 高度な使用方法

### カスタム優先順位設定

```javascript
const coordinator = new GitHubActionsCoordinator({
  // エラータイプ別優先順位をカスタマイズ
  errorPriorities: {
    'custom-error': 'CRITICAL',
    'my-warning': 'LOW'
  }
});
```

### 成功率閾値の調整

```javascript
// 成功率40%以上で再試行
const shouldRetry = monitor.shouldRetry('pattern-name', 0.4);

// 成功率80%以上で再試行
const shouldRetry = monitor.shouldRetry('pattern-name', 0.8);
```

### カスタムエラー検出器

```javascript
async function myErrorDetector() {
  // 独自のロジックでエラーを検出
  const errors = [];

  // GitHub API から Workflow runs を取得
  const runs = await getWorkflowRuns();

  for (const run of runs) {
    if (run.conclusion === 'failure') {
      errors.push({
        type: 'workflow-failure',
        pattern: run.name,
        message: run.message,
        blocking: true,
        frequency: getErrorFrequency(run.name)
      });
    }
  }

  return errors;
}

// カスタム検出器でループ開始
await coordinator.startLoop(myErrorDetector);
```

---

## 📊 統計ダッシュボード

### 主要メトリクス

1. **全体成功率**: 全修復試行の成功割合
2. **パターン別成功率**: 各エラーパターンの効果
3. **平均実行時間**: 修復にかかる時間
4. **修復トレンド**: 時系列での改善状況

### ダッシュボード表示

```bash
# 詳細レポート生成
node scripts/fix-success-monitor.js report

# 出力例:
# 自動修復統計レポート
#
# 生成日時: 2025-11-21 15:00:00
#
# 全体統計
# - 総試行回数: 115
# - 成功回数: 95
# - 失敗回数: 20
# - 成功率: 82.61%
# - パターン数: 8
#
# 成功率トップ5
# 1. security-vulnerability
#    - 成功率: 100.00%
#    - 試行回数: 3
#    - 平均実行時間: 4567.80ms
# ...
```

---

## 🔍 トラブルシューティング

### Issue: GitHub API認証エラー

**症状**: Issue作成・更新時に401エラー

**解決方法**:
```bash
# トークンを確認
echo $GITHUB_TOKEN

# トークンを設定
export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"

# トークンの権限を確認
# - repo (full access)
# - workflow
```

### Issue: 統計データが保存されない

**症状**: `logs/auto-fix-stats.json`が更新されない

**解決方法**:
```bash
# logsディレクトリの権限を確認
ls -la logs/

# 書き込み権限を付与
chmod 755 logs/
chmod 644 logs/auto-fix-stats.json

# ディレクトリが存在しない場合は作成
mkdir -p logs/
```

### Issue: 修復が実行されない

**症状**: エラー検出後に修復が試行されない

**確認事項**:
1. 成功率が閾値を下回っていないか
2. `shouldRetry`の判定結果を確認
3. エラーパターンが正しく記録されているか

```javascript
// デバッグログを有効化
const shouldRetry = monitor.shouldRetry('pattern-name');
console.log('Should retry:', shouldRetry);
console.log('Success rate:', monitor.getSuccessRate('pattern-name'));
```

---

## 📝 ベストプラクティス

### 1. 適切な実行間隔

```javascript
// 本番環境: 30分間隔
export AUTO_FIX_INTERVAL=30

// 開発環境: 5分間隔（テスト用）
export AUTO_FIX_INTERVAL=5

// CI/CD: 60分間隔
export AUTO_FIX_INTERVAL=60
```

### 2. 成功率の監視

```bash
# 定期的に統計を確認
*/30 * * * * node scripts/fix-success-monitor.js report > /var/log/auto-fix-report.txt
```

### 3. Issue管理の最適化

- 重複Issueを避けるため、既存Issueを必ず検索
- Issueタイトルは一貫したフォーマットを使用
- ラベルで優先順位を視覚化

### 4. ログローテーション

```bash
# 古いレポートを定期的にアーカイブ
find logs/ -name "auto-fix-report-*.json" -mtime +30 -exec gzip {} \;
```

---

## 🔄 統合ワークフロー

### GitHub Actionsとの統合

```yaml
# .github/workflows/auto-fix.yml
name: Auto Fix System

on:
  schedule:
    - cron: '*/30 * * * *'  # 30分毎
  workflow_dispatch:

jobs:
  auto-fix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run Auto Fix Coordinator
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPO_OWNER: ${{ github.repository_owner }}
          GITHUB_REPO_NAME: ${{ github.event.repository.name }}
        run: node scripts/github-actions-coordinator.js
```

---

## 📚 API リファレンス

### FixSuccessMonitor

#### `load()`
統計データをファイルからロード

#### `save()`
統計データをファイルに保存

#### `recordFix(pattern, success, metadata)`
修復試行を記録

**パラメータ**:
- `pattern` (string): エラーパターン
- `success` (boolean): 成功/失敗
- `metadata` (object): メタデータ
  - `duration` (number): 実行時間(ms)
  - `errorMessage` (string): エラーメッセージ
  - `fixApplied` (string): 適用された修復

#### `getSuccessRate(pattern)`
パターンの成功率を取得

**戻り値**: number (0-1)

#### `shouldRetry(pattern, threshold)`
再試行すべきか判定

**パラメータ**:
- `pattern` (string): エラーパターン
- `threshold` (number): 成功率閾値 (デフォルト: 0.3)

**戻り値**: boolean

#### `getTopPatterns(topN)`
成功率上位のパターンを取得

#### `getWorstPatterns(topN)`
失敗率上位のパターンを取得

#### `generateReport()`
統計レポートを生成

### GitHubActionsCoordinator

#### `initialize()`
システムを初期化

#### `prioritizeErrors(errors)`
エラーを優先順位付け

**パラメータ**:
- `errors` (Array): エラー配列

**戻り値**: Array (優先順位付けされたエラー)

#### `scheduleNextRun(intervalMinutes)`
次回実行をスケジュール

**パラメータ**:
- `intervalMinutes` (number): 実行間隔（分）

#### `manageIssues(errors, fixes)`
GitHub Issueを自動管理

#### `run(errors)`
調整システムを実行

**パラメータ**:
- `errors` (Array): 検出されたエラー

**戻り値**: object (実行レポート)

#### `startLoop(errorDetector)`
連続実行ループを開始

**パラメータ**:
- `errorDetector` (Function): エラー検出関数

---

## 📊 現在の統計情報

### 全体統計 (2025-11-21時点)

- **総試行回数**: 115件
- **成功回数**: 95件
- **失敗回数**: 20件
- **全体成功率**: 82.61%
- **追跡パターン数**: 8種類

### 成功率トップ3

1. **security-vulnerability**: 100.00% (3/3)
2. **eslint-error**: 95.20% (40/42)
3. **missing-docs**: 91.70% (11/12)

### 要改善パターン

1. **docker-build-error**: 40.00% (2/5)
2. **dependency-error**: 62.50% (5/8)
3. **performance-issue**: 66.70% (4/6)

---

## 🎓 次のステップ

1. **監視の強化**
   - Prometheus/Grafanaと統合
   - アラート設定
   - リアルタイムダッシュボード

2. **機械学習の導入**
   - エラーパターン予測
   - 最適な修復戦略の学習
   - 異常検知

3. **自動修復の拡張**
   - より多くのエラーパターンに対応
   - 複雑な修復シナリオのサポート
   - マルチステップ修復

---

## 📞 サポート

問題が発生した場合は、以下を確認してください:

1. ログファイル: `logs/auto-fix-*.log`
2. 統計データ: `logs/auto-fix-stats.json`
3. レポート: `logs/auto-fix-report-*.json`

---

## 📄 ライセンス

MIT License

---

**最終更新**: 2025-11-21
**バージョン**: 1.0.0
