# ClaudeCode + /agents 構成による自動開発ループシステム仕様書（最終版）

---

## 🎯 目的

本仕様書は、ClaudeCode v1.0.59 以降の `/agents` 機能と GitHub Actions を活用し、最大 4 時間／日 の開発時間内で、料理レシピ動画収集システム（PersonalCookRecipe）を対象とした「自動開発ループ環境」の構築および運用指針を明文化するものである。

---

## 🧩 システム概要

- **対象システム**：料理レシピ動画収集システム（WebUIベース）
- **機能**：
  - 複数チャンネル（Tasty, Kurashiru, DELISH KITCHEN）からのレシピ動画情報の収集・解析
  - NLPによるレシピの構造化（食材・分量・手順）
  - WebUIでの検索・閲覧機能
  - GitHub Actions による自動デプロイとCIチェック
- **運用制限**：開発作業は最大1日4時間まで（トークン消費を考慮）

---

## ⚙️ ClaudeCode 実行構成

### 起動コマンド

```bash
claudecode run \
  --agents agents.yaml \
  --no-context \
  --max-iterations 4 \
  --dangerously-skip-permissions
```

- `--no-context`：Context7無効化によるトークン節約
- `--max-iterations 4`：1開発サイクルの最大繰り返し数を制限
- `--dangerously-skip-permissions`：開発途中での再確認省略（信頼環境下）

---

## 👥 ClaudeCode Agent構成（最終版）

| Agent | 役割 | 担当範囲 |
|-------|------|----------|
| `@cto` | 企画・設計・セキュリティ | 機能仕様定義、セキュリティ・著作権チェック |
| `@dev` | 実装統合 | Flask API, React UI, GitHub Actions Workflow 実装 |
| `@manager` | ログ・制御 | 出力要約、ループ制御、品質評価と進行管理 |
| `@nlp` | 自然言語処理 | 字幕・動画説明文からのレシピ構造化処理 |
| `@qa` | 品質保証 | UI/UXの一貫性、用語チェック、ユーザー視点レビュー |

---

## 🗂 プロジェクト構成例

```
project-root/
├── Claude.md               # 共通仕様・ルール定義
├── agents.yaml             # ClaudeCode用エージェント定義
├── input.md                # 起動入力プロンプト（任意）
├── src/
│   ├── backend/            # Flask実装
│   ├── frontend/           # React実装
│   └── nlp/                # レシピ解析処理
├── github/
│   └── workflows/          # GitHub Actions
├── output/
├── logs/
└── docs/
    ├── 01_システム仕様書.md
    ├── 02_開発環境仕様書.md
    ├── 03_API仕様書.md
    └── 04_運用設計書.md
```

---

## 🔐 開発環境要件

- OS：macOS Ventura または Ubuntu 22.04 LTS
- 開発時間制限：1日最大4時間（ClaudeCodeループ1〜2回想定）
- 言語／フレームワーク：
  - Python 3.11（Flask, spaCy）
  - Node.js 20（React）
  - SQLite（軽量DB）
- ClaudeCode v1.0.59 以降（`--agents` 構成対応）
- GitHub Actions：導入済み、CI/CD自動化済み

---

## 🔁 開発サイクルの自動化イメージ

1. `@cto`：要件と方針提示
2. `@dev`：実装（API/UI/CI）
3. `@nlp`：データ解析・整形
4. `@qa`：UI・文言チェック
5. `@manager`：全体評価、再実行の判断

（※ `--max-iterations 4` により最大4サイクルで終了）

---

## ✅ 補足

- 長文・過去ログは `Claude.md` にまとめることで Context7 を無効化しても十分な指示が可能
- Agentの役割が明確なため、ClaudeCodeが自律的に実装・評価を行いやすい構成

---

## 📝 関連ドキュメント（既存）

- `github-actions-setup-complete.md`
- `PersonalCookRecipe-API認証設定仕様書.md`
- `Tasty Recipe Monitor.md`
- `MacOS環境設定仕様書.md`
- `Notion統合設定仕様書.md`
- `3チャンネル監視仕様書.md`
- `選定3チャンネル統合仕様.md`

---

以上。
