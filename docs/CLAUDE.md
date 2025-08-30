# PersonalCookRecipe - ClaudeCode Agents 自動開発システム

project_name: PersonalCookRecipe - 3チャンネル統合レシピ監視システム

description: |
  macOS環境で動作する自動レシピ監視システム。YouTube（SAM THE COOKING GUY、Tasty Recipes、Joshua Weissman）から
  肉料理レシピを自動収集し、Claude AIで解析・翻訳してNotionデータベースに登録、Gmail通知を送信する
  完全自動化システム。ClaudeCode + agents構成による並列自動開発・自動確認・自動修復ループシステム。

## 🤖 Agent構成（5名体制）

### @cto (最高技術責任者)
- macOS環境システム設計とアーキテクチャ策定
- API仕様確認と著作権・利用規約チェック
- macOS Keychainセキュリティ設計
- LaunchDaemon統合戦略

### @dev (統合開発者)
- macOS環境準備スクリプト実装
- 3チャンネル監視システム構築
- Claude/Notion/Gmail API統合
- LaunchDaemon自動化実装

### @nlp (自然言語処理専門家)
- Claude API活用とプロンプト設計
- チャンネル別特化解析実装
- 肉料理検出エンジン構築
- 重複除去・品質スコアリング

### @qa (品質保証)
- macOS環境動作確認
- API接続テスト実行
- Keychain統合検証
- エラーハンドリング品質チェック

### @manager (プロジェクト管理者)
- 4段階実装フェーズ管理
- Agent間タスク調整
- 開発ループ制御
- システムヘルス監視

## 🎯 開発目標

development_goals:
  - macOS LaunchDaemonによる24時間自動監視
  - 3チャンネルからの肉料理レシピ自動収集（1日10-17件）
  - Claude AIによるチャンネル特化解析・日本語翻訳
  - Notionデータベース自動登録・検索最適化
  - Gmail/macOS通知による即座な情報配信
  - macOS Keychainによるセキュアな認証情報管理
  - agents機能による並列自動開発・品質保証

## 📱 技術スタック

platform: macOS 12 (Monterey) 以降
core_tech:
  - Python 3.10+ (仮想環境)
  - LaunchDaemon (自動実行)
  - macOS Keychain (認証管理)

apis:
  - YouTube Data API v3 (動画メタデータ)
  - Claude API (レシピ解析・翻訳)
  - Notion API (データベース連携)
  - Gmail API (通知送信)

monitoring_channels:
  - Sam The Cooking Guy (UC8C7QblJwCHsYrftuLjGKig)
  - Tasty Recipes (UCJFp8uSYCjXOMnkUyb3CQ3Q)
  - Joshua Weissman (UChBEbMKI1eCcejTtmI32UEw)

## 🔧 開発ルール

rules:
  - macOS固有機能を最大限活用（Keychain、LaunchDaemon、通知）
  - 全てのコードに日本語コメントを必須で付ける
  - エラーハンドリングとリトライ機能を全API呼び出しに実装
  - 非同期処理（asyncio）による効率的な並列実行
  - ログ出力は詳細レベル（DEBUG/INFO/WARNING/ERROR/CRITICAL）で管理
  - API認証情報はmacOS Keychainで管理、.envファイルはフォールバック用
  - セキュリティを最優先、機密情報の平文保存禁止

## 📁 ディレクトリ構成

base_directory: ~/Developer/tasty-recipe-monitor/

structure:
  config/:
    - settings.py (プロジェクト設定)
    - channels.py (3チャンネル設定)
    - keychain_manager.py (macOS Keychain管理)
    - api_keys.env (フォールバック用)
  
  services/:
    - integrated_monitor.py (統合監視コントローラー)
    - channel_monitors.py (チャンネル個別監視)
    - meat_recipe_detector.py (肉料理検出エンジン)
    - channel_specific_analyzer.py (Claude特化解析)
    - notion_client.py (Notion統合)
    - gmail_notifier.py (Gmail通知)
  
  scripts/:
    - install.sh (自動インストール)
    - setup_launchd.sh (LaunchDaemon設定)
    - monitor_channels.sh (メイン実行)
    - health_check.sh (ヘルスチェック)
  
  data/:
    - processed_videos.json (処理済み動画)
    - metrics.json (統計データ)
    - cache/ (キャッシュディレクトリ)
  
  logs/:
    - application.log (アプリケーションログ)
    - launchd.log (LaunchDaemon実行ログ)
    - error.log (エラーログ)

## 🚀 実装フェーズ

### Phase 1: macOS環境基盤構築
- システム要件確認スクリプト
- 自動インストールスクリプト
- ディレクトリ構造作成
- Python仮想環境構築
- LaunchDaemon設定

### Phase 2: API認証システム
- macOS Keychain管理実装
- API認証情報管理
- OAuth認証ヘルパー
- セキュリティ設定適用

### Phase 3: 3チャンネル監視システム
- 統合監視コントローラー
- チャンネル個別監視クラス
- 肉料理検出エンジン
- Claude特化解析エンジン
- 重複除去・品質管理

### Phase 4: Notion統合システム
- Notion統合クライアント
- レシピページ生成エンジン
- データベース管理システム
- メディア統合機能

## 🎯 ClaudeCode実行コマンド

```bash
claudecode run \
  --agents docs/agents.yaml \
  --no-context \
  --max-iterations 4 \
  --dangerously-skip-permissions
```

## 🔄 Agent並列自動開発フロー

```
@cto (仕様策定) → @dev (実装) → @nlp (AI処理) → @qa (品質確認) → @manager (統合判定)
     ↓              ↓            ↓             ↓                ↓
  設計完了      → 実装完了    → 解析完了     → テスト完了      → 次フェーズ移行
     ↑              ↑            ↑             ↑                ↑
  フィードバック ← 修正依頼   ← 改善提案    ← 不具合報告     ← 品質判定
```

agents機能により、各専門分野のAgentが並列で作業し、自動的に品質チェック・修正・再実行を行います。
