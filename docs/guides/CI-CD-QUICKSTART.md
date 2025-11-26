# CI/CDパイプライン クイックスタートガイド

PersonalCookingRecipeプロジェクトのCI/CDパイプラインを今すぐ使い始めるための最短ガイドです。

## 🚀 5分で始める

### ステップ1: シークレット設定 (3分)

GitHub リポジトリ → Settings → Secrets and variables → Actions

**必須シークレット**:
```bash
# デプロイ用 (本番環境デプロイする場合)
PRODUCTION_SSH_KEY    # SSH秘密鍵
PRODUCTION_USER       # SSHユーザー名 (例: deploy)
PRODUCTION_HOST       # サーバーホスト (例: production.example.com)

# 通知用 (オプション)
SLACK_WEBHOOK         # Slack Webhook URL
```

**SSH鍵生成**:
```bash
ssh-keygen -t ed25519 -C "github-actions@your-domain.com" -f deploy_key
# → deploy_key (秘密鍵) を PRODUCTION_SSH_KEY に貼り付け
# → deploy_key.pub (公開鍵) をサーバーの ~/.ssh/authorized_keys に追加
```

---

### ステップ2: ワークフロー有効化 (1分)

GitHub リポジトリ → Actions → "I understand my workflows, go ahead and enable them"

**自動実行されるワークフロー**:
- `push` to `main`, `develop` → Phase 1, Phase 2, Deploy
- `pull_request` → Phase 1, Phase 2
- 毎日 3:00 JST → Phase 2 (品質監視)

---

### ステップ3: ローカルテスト (1分)

```bash
# APIパフォーマンステスト
npm start &
node scripts/benchmark-api.js

# Lighthouse CI
cd frontend
npm run build && npm run start &
node scripts/lighthouse-ci.js

# レポート確認
cat reports/performance-*.json | jq '.summary'
open .lighthouseci/report.html
```

---

## 📊 品質基準

| 項目 | 目標値 | 確認方法 |
|------|--------|---------|
| テストカバレッジ | Backend≥50%, Frontend≥60%, API≥70% | GitHub Actions → Coverage |
| APIパフォーマンス | P95 <500ms | `node scripts/benchmark-api.js` |
| Lighthouseスコア | ≥90 | `node scripts/lighthouse-ci.js` |
| セキュリティ | クリティカル脆弱性0件 | GitHub Security タブ |

---

## 🔍 トラブルシューティング

**問題が発生したら**:
1. `docs/CI-CD-TROUBLESHOOTING.md` を確認
2. GitHub Actions のログを確認
3. GitHubイシューで報告

**よくある問題**:
- キャッシュが効かない → Settings → Actions → Caches でクリア
- テストが失敗する → ローカルで `npm test` 実行
- デプロイエラー → SSH鍵設定を確認

---

## 📚 詳細ドキュメント

- **完全ガイド**: `docs/CI-CD-PIPELINE.md`
- **トラブルシューティング**: `docs/CI-CD-TROUBLESHOOTING.md`
- **最適化レポート**: `CI-CD-OPTIMIZATION-REPORT.md`

---

**質問があれば**: GitHubイシューで報告してください!
