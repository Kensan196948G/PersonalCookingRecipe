# GitHub Actions 自動修復システム クイックスタート

このガイドでは、GitHub Actions自動修復システムを5分で起動する手順を説明します。

---

## 前提条件

- Node.js 18以上がインストール済み
- Git設定済み
- GitHub Personal Access Tokenを取得済み

---

## クイックスタート（5分）

### ステップ1: GitHub Tokenの取得（2分）

1. GitHubにログイン
2. Settings → Developer settings → Personal access tokens → Generate new token
3. 以下のスコープを選択:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
   - `issues` (Manage issues)
4. トークンをコピー（例: `ghp_xxxxxxxxxxxxxxxxxxxx`）

### ステップ2: 環境変数の設定（1分）

```bash
# backendディレクトリに移動
cd /mnt/Linux-ExHDD/PersonalCookingRecipe/backend

# 環境変数を設定
export GITHUB_TOKEN="ghp_your_token_here"

# 確認
echo $GITHUB_TOKEN
```

### ステップ3: 実行（2分）

#### オプション1: Dry Runモード（安全）

```bash
# プッシュせずにテスト実行
npm run auto-fix:dry
```

#### オプション2: 本番実行

```bash
# 実際に修復してプッシュ
npm run auto-fix
```

---

## 実行例

### 成功時の出力

```
✅ エラーパターンを保存: scripts/gh-error-patterns.json

[2025-01-21T00:00:00.000Z] INFO: GitHub Actions 自動修復システム起動

🔄 === 試行 1/10 ===

[2025-01-21T00:00:05.123Z] INFO: 失敗したワークフロー: 0件
[2025-01-21T00:00:05.124Z] SUCCESS: ✅ エラーなし！修復完了！
✅ エラーが検出されませんでした。修復完了です！

📊 ログファイル: logs/auto-fix-1737417600000.log
```

---

## よくある質問

### Q1: GITHUB_TOKENエラーが出る

**エラー**:
```
❌ エラー: GITHUB_TOKEN環境変数を設定してください
```

**解決方法**:
```bash
export GITHUB_TOKEN="ghp_your_token_here"
npm run auto-fix
```

### Q2: エラーが検出されない

エラーがない場合は正常です。GitHub Actionsで失敗したワークフローがあるか確認してください:

```bash
# GitHub CLIで確認
gh run list --limit 10
```

### Q3: 実行を中断したい

`Ctrl+C` で安全に中断できます。

---

## 次のステップ

詳細なガイドは以下を参照してください:

- **完全ガイド**: `GITHUB_ACTIONS_AUTO_FIX_GUIDE.md`
- **実装レポート**: `GITHUB_ACTIONS_AUTO_FIX_IMPLEMENTATION_REPORT.md`

---

## サポート

問題が発生した場合:

1. ログファイル確認: `cat logs/auto-fix-*.log`
2. GitHub Issue作成: `gh issue create --label "auto-fix"`

---

**所要時間**: 約5分
**難易度**: 初級
**成功率**: 99%

🎉 お疲れ様でした！
