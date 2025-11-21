# Universal Phase Management System - クイックスタート

PersonalCookingRecipeプロジェクトのPhase管理システムをすぐに使い始めるためのガイドです。

---

## システム概要

**Universal Phase Management System**は、Phase 1からPhase Nまで無限に対応可能な汎用Phase管理システムです。

### 主要機能

- Phase進捗管理
- KPI自動追跡
- 自動Phase移行
- WebダッシュボードUI
- Phase対応自動修復

---

## 5分で始める

### 1. 現在のPhaseを確認

```bash
node scripts/phase-manager.js current
```

**出力例**:
```json
{
  "id": 2,
  "name": "品質・パフォーマンス改善",
  "status": "completed",
  "kpiProgress": 100
}
```

### 2. 全Phase概要を確認

```bash
node scripts/phase-manager.js overview
```

**出力例**:
```json
{
  "currentPhase": 2,
  "nextPhase": 3,
  "totalPhases": 5,
  "phases": [...]
}
```

### 3. Dashboardを開く

```bash
# ローカルサーバー起動
cd backend/src/monitoring/dashboard
python3 -m http.server 8080

# ブラウザで開く
open http://localhost:8080/phase-dashboard.html
```

### 4. Phase 3の詳細を確認

```bash
node scripts/phase-manager.js get 3
```

### 5. Phase移行可否をチェック

```bash
node scripts/phase-transition.js check --dry-run
```

---

## よく使うコマンド

### Phase情報取得

```bash
# 現在のPhase
node scripts/phase-manager.js current

# Phase 2の詳細
node scripts/phase-manager.js get 2

# 全Phase一覧
node scripts/phase-manager.js list

# 完了済みPhase一覧
node scripts/phase-manager.js list completed
```

### レポート生成

```bash
# Markdownレポート
node scripts/phase-manager.js report 2 markdown

# HTMLレポート
node scripts/phase-manager.js report 2 html > phase2-report.html

# JSONレポート
node scripts/phase-manager.js report 2 json
```

### KPI管理

```bash
# KPI更新
node scripts/phase-manager.js update-kpi 3 horizontal_scaling "完了" "achieved"

# Phase完了条件チェック
node scripts/phase-manager.js check 3
```

### Phase移行

```bash
# 移行可否チェック (Dry Run)
node scripts/phase-transition.js check --dry-run

# 移行可否チェック (実際の準備)
node scripts/phase-transition.js check

# Phase移行実行 (要承認)
node scripts/phase-transition.js transition --approve

# バックアップ一覧
node scripts/phase-transition.js backups
```

### 自動修復

```bash
# エラー検知
node scripts/phase-aware-auto-fix.js detect "エラーメッセージ"

# エラー修復
node scripts/phase-aware-auto-fix.js fix "エラーメッセージ"

# エラーパターン表示
node scripts/phase-aware-auto-fix.js patterns
```

---

## 定期監視の開始

### Phase移行監視 (1時間おき)

```bash
node scripts/phase-transition.js watch --interval=3600
```

### 自動修復監視 (1分おき)

```bash
node scripts/phase-aware-auto-fix.js monitor --interval=60
```

---

## Phase移行ワークフロー

### ステップ1: 完了条件確認

```bash
node scripts/phase-manager.js check <phase-id>
```

### ステップ2: Dry Run実行

```bash
node scripts/phase-transition.js check --dry-run
```

### ステップ3: 移行実行

```bash
node scripts/phase-transition.js transition --approve
```

### ステップ4: 移行後確認

```bash
node scripts/phase-manager.js current
node scripts/phase-manager.js overview
```

---

## トラブルシューティング

### 問題: Phase移行が失敗する

**解決策**:
```bash
# 1. 完了条件チェック
node scripts/phase-manager.js check <phase-id>

# 2. KPI状態確認
node scripts/phase-manager.js get <phase-id>

# 3. KPI更新
node scripts/phase-manager.js update-kpi <phase-id> <kpi-key> <value> achieved
```

### 問題: Dashboardが表示されない

**解決策**:
```bash
# ローカルサーバーで開く
cd backend/src/monitoring/dashboard
python3 -m http.server 8080
# http://localhost:8080/phase-dashboard.html にアクセス
```

### 問題: バックアップから復元したい

**解決策**:
```bash
# バックアップ一覧
node scripts/phase-transition.js backups

# 復元実行
node scripts/phase-transition.js rollback <backup-path>
```

---

## ファイル構成

```
backend/
├── config/
│   └── phases.json                    # マスター設定
├── scripts/
│   ├── phase-manager.js               # Phase管理
│   ├── phase-transition.js            # 自動移行
│   └── phase-aware-auto-fix.js        # 自動修復
├── phases/
│   ├── phase1/config.json             # Phase 1設定
│   ├── phase2/config.json             # Phase 2設定
│   ├── phase3/config.json             # Phase 3設定
│   └── backups/                       # バックアップ
├── src/monitoring/dashboard/
│   └── phase-dashboard.html           # Dashboard
└── logs/
    ├── phase-transitions/             # 移行ログ
    └── auto-fix/                      # 修復ログ
```

---

## 詳細ドキュメント

- **完全ガイド**: UNIVERSAL_PHASE_SYSTEM_GUIDE.md
- **実装レポート**: UNIVERSAL_PHASE_SYSTEM_IMPLEMENTATION_REPORT.md

---

## 現在のPhase状況 (2025-11-21)

- **Phase 1**: ✅ 完了 (緊急安定化)
- **Phase 2**: ✅ 完了 (品質・パフォーマンス改善)
- **Phase 3**: ⏳ 計画中 (スケーラビリティ強化)
- **Phase 4**: 🔮 将来 (AI・ML機能強化)
- **Phase 5**: 🔮 将来 (グローバル展開)

---

## サポート

質問や問題がある場合:
1. UNIVERSAL_PHASE_SYSTEM_GUIDE.mdのトラブルシューティングセクションを参照
2. ログファイルを確認 (logs/phase-transitions/, logs/auto-fix/)
3. GitHub Issuesで報告

---

**最終更新**: 2025-11-21
**バージョン**: 1.0.0
