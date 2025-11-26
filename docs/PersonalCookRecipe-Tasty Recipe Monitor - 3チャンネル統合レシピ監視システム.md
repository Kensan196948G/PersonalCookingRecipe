#PersonalCookRecipe-Tasty Recipe Monitor - 3チャンネル統合レシピ監視システム
# Tasty Recipe Monitor - 3チャンネル統合レシピ監視システム

## 🎯 プロジェクト概要

macOS環境で動作する自動レシピ監視システム。YouTube（SAM THE COOKING GUY、Tasty Recipes、Joshua Weissman）から肉料理レシピを自動収集し、Claude AIで解析・翻訳してNotionデータベースに登録、Gmail通知を送信する完全自動化システム。

## 🏗️ アーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   YouTube API    │───▶│  Claude 解析     │───▶│    Notion API   │
│   (3チャンネル)   │    │  (レシピ構造化)   │    │   (自動登録)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
           │                                              │
           ▼                                              ▼
┌─────────────────┐                            ┌─────────────────┐
│  LaunchDaemon   │                            │   Gmail 通知     │
│  (macOS自動実行)  │                            │  (HTML形式)      │
└─────────────────┘                            └─────────────────┘
           │
           ▼
┌─────────────────┐
│  macOS通知      │
│  (ネイティブ)    │
└─────────────────┘
```

## 📁 プロジェクト構造

```
~/Developer/tasty-recipe-monitor/
├── claude.md                 # このファイル
├── main.py                   # メインエントリーポイント
├── requirements.txt          # Python依存関係
├── README.md                 # ユーザー向け説明
├── .env.example             # 環境変数テンプレート
├── config/                  # 設定ファイル群
│   ├── __init__.py
│   ├── settings.py          # プロジェクト設定
│   ├── channels.py          # チャンネル設定
│   ├── logging.conf         # ログ設定
│   ├── api_keys.env         # API認証情報（Keychain優先）
│   └── keychain_manager.py  # macOS Keychain管理
├── services/                # コアサービス
│   ├── __init__.py
│   ├── base_monitor.py      # 基底監視クラス
│   ├── youtube_monitor.py   # YouTube API処理
│   ├── claude_analyzer.py   # Claude AI解析
│   ├── notion_client.py     # Notion API連携
│   └── gmail_notifier.py    # Gmail通知機能
├── data/                    # データ保存
│   ├── processed_videos.json
│   ├── failed_videos.json
│   ├── metrics.json
│   └── cache/
├── logs/                    # ログファイル
│   ├── application.log
│   ├── error.log
│   ├── launchd.log
│   └── debug.log
├── scripts/                 # 運用スクリプト
│   ├── install.sh           # 自動インストール
│   ├── run_monitor.sh       # メイン実行
│   ├── setup_launchd.sh     # LaunchDaemon設定
│   ├── health_check.sh      # ヘルスチェック
│   └── log_rotate.sh        # ログローテーション
├── tests/                   # テストファイル
│   ├── test_youtube.py
│   ├── test_claude.py
│   └── test_notion.py
├── launchd/                 # LaunchDaemon設定
│   └── com.tasty.recipe.monitor.plist
└── venv/                    # Python仮想環境
```

## 🎬 監視対象チャンネル

### 1. SAM THE COOKING GUY
- **ID**: UC8C7QblJwCHsYrftuLjGKig
- **特徴**: 実用的な家庭料理、BBQ、コスパ重視
- **監視間隔**: 2時間毎
- **期待レシピ数**: 3-5件/日

### 2. Tasty Recipes  
- **ID**: UCJFp8uSYCjXOMnkUyb3CQ3Q
- **特徴**: 時短レシピ、初心者向け、視覚的魅力
- **監視間隔**: 1時間毎
- **期待レシピ数**: 5-8件/日

### 3. Joshua Weissman
- **ID**: UChBEbMKI1eCcejTtmI32UEw
- **特徴**: プロ技術、詳細解説、"But Better"シリーズ
- **監視間隔**: 1.5時間毎
- **期待レシピ数**: 2-4件/日

## 🛠️ 技術スタック

### Core Technologies
- **OS**: macOS 12 (Monterey) 以降
- **Language**: Python 3.10+
- **Scheduler**: LaunchDaemon
- **AI**: Claude API (Anthropic)
- **Security**: macOS Keychain

### APIs & Services
- **YouTube Data API v3**: 動画メタデータ取得
- **Claude API**: レシピ解析・翻訳
- **Notion API**: データベース連携
- **Gmail API**: 通知送信
- **macOS通知**: ネイティブ通知

### Python Libraries
- **google-api-python-client**: YouTube API
- **anthropic**: Claude AI
- **notion-client**: Notion連携
- **requests**: HTTP通信
- **asyncio**: 非同期処理
- **pyobjc-core**: macOS統合

## ⚙️ 主要機能

### 1. 自動監視機能
- 3チャンネルの新動画検知
- 肉料理レシピの自動フィルタリング
- 重複除去・品質チェック
- LaunchDaemonによる自動実行

### 2. AI解析機能
- Claude AIによる動画内容解析
- 英語→日本語自動翻訳
- レシピ構造化（材料・手順・コツ）
- チャンネル特化型解析

### 3. データベース連携
- Notionページ自動生成
- YouTube動画埋め込み
- 検索・フィルタ可能な構造
- 品質スコア自動評価

### 4. 通知機能
- 新レシピ登録のGmail通知
- HTML形式の美しい通知
- macOSネイティブ通知
- エラー・アラート通知

### 5. セキュリティ機能
- macOS Keychainによる認証情報管理
- API認証の安全な保存
- 暗号化された設定管理

## 🔧 開発ガイドライン

### コード品質
- **型ヒント**: 全関数に型アノテーション必須
- **エラーハンドリング**: try-except による堅牢性確保
- **ログ出力**: 詳細な処理ログとエラーログ
- **非同期処理**: asyncio による効率的処理

### ファイル命名規則
- **Python**: snake_case (例: youtube_monitor.py)
- **設定**: UPPER_CASE (例: API_KEYS)
- **ログ**: lowercase.log (例: application.log)
- **スクリプト**: kebab-case.sh (例: health-check.sh)

### エラーハンドリング方針
```python
import logging
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def api_call_with_retry():
    try:
        # API呼び出し処理
        pass
    except Exception as e:
        logging.error(f"API呼び出し失敗: {e}")
        # macOS通知送信
        await send_macos_notification("エラー", str(e))
        raise
```

## 📋 実装タスク（優先順）

### Phase 1: 基盤構築
1. **システム要件確認** (`check_system_requirements.py`)
2. **環境構築** (`scripts/install.sh`)
3. **Keychain設定** (`config/keychain_manager.py`)
4. **依存関係** (`requirements.txt`)

### Phase 2: コアサービス
1. **YouTube監視** (`services/youtube_monitor.py`)
2. **Claude解析** (`services/claude_analyzer.py`)
3. **Notion連携** (`services/notion_client.py`)
4. **Gmail通知** (`services/gmail_notifier.py`)

### Phase 3: 統合・運用
1. **メインロジック** (`main.py`)
2. **LaunchDaemon設定** (`scripts/setup_launchd.sh`)
3. **テスト実装** (`tests/*.py`)
4. **本格運用開始**

## 🧪 テスト戦略

### 単体テスト
- 各サービスクラスの機能テスト
- API接続テスト（Keychain統合）
- エラーケーステスト

### 統合テスト
- エンドツーエンドの動作確認
- 実際のAPI連携テスト
- LaunchDaemon動作テスト
- 長時間実行テスト

### テスト実行
```bash
# 仮想環境で実行
source venv/bin/activate
python -m pytest tests/ -v

# macOS通知テスト
python tests/test_macos_notifications.py
```

## 📊 ログ・監視

### ログレベル
- **DEBUG**: 詳細な処理情報
- **INFO**: 一般的な処理状況
- **WARNING**: 注意が必要な状況
- **ERROR**: エラー発生時
- **CRITICAL**: システム停止レベル

### メトリクス収集
- 処理済み動画数
- 成功/失敗率
- API使用量
- システムリソース使用状況

### macOS通知統合
```python
import subprocess

def send_macos_notification(title: str, message: str):
    """macOSネイティブ通知送信"""
    subprocess.run([
        'osascript', '-e',
        f'display notification "{message}" with title "{title}" sound name "Glass"'
    ])
```

## 🚀 デプロイメント

### 自動インストール
```bash
# 1. リポジトリクローン
git clone <repository-url>
cd tasty-recipe-monitor

# 2. Homebrew確認
brew --version || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 3. 自動インストール実行
chmod +x scripts/install.sh
./scripts/install.sh

# 4. Keychain設定
python scripts/setup_keychain.py

# 5. LaunchDaemon設定
./scripts/setup_launchd.sh

# 6. 動作確認
./scripts/health_check.sh
```

### 本格運用
```bash
# メイン監視開始
./scripts/run_monitor.sh

# LaunchDaemon管理
launchctl load ~/Library/LaunchAgents/com.tasty.recipe.monitor.plist
launchctl list | grep com.tasty.recipe.monitor

# ヘルスチェック
./scripts/health_check.sh

# ログ確認
tail -f logs/application.log
```

## 🔒 セキュリティ

### macOS Keychain統合
```python
# Keychainへの保存
security add-generic-password -a "YOUTUBE_API_KEY" -s "com.tasty.recipe.monitor" -w "your-api-key"

# Keychainからの取得
from config.keychain_manager import MacOSKeychainManager
keychain = MacOSKeychainManager()
api_key = keychain.get_password("YOUTUBE_API_KEY")
```

### システムセキュリティ
- macOS Gatekeeperへの対応
- コード署名（必要に応じて）
- プライバシー設定の確認
- 定期的なセキュリティアップデート

## 📈 パフォーマンス

### 最適化方針
- **非同期処理**: asyncio による並列実行
- **キャッシュ活用**: 重複処理の回避
- **バッチ処理**: 効率的なAPI使用
- **リソース管理**: メモリ・CPU使用量の最適化

### 期待性能
- **処理速度**: 1動画あたり2-5分
- **同時処理**: 最大5動画並列
- **リソース**: CPU 50%以下、メモリ 500MB以下
- **macOS省電力対応**: App Nap対応

## 🔄 運用・保守

### 日次運用
- ログ確認とエラーチェック
- メトリクス確認
- ディスク使用量確認
- macOS通知の動作確認

### 週次運用
- システムヘルスチェック
- API使用量確認
- パフォーマンス分析
- LaunchDaemon動作確認

### 月次運用
- ログローテーション
- システムアップデート（Homebrew含む）
- バックアップ確認
- Keychain整理

## 🐛 トラブルシューティング

### よくある問題
1. **API制限超過**: レート制限の調整
2. **Keychain権限エラー**: アクセス権限確認
3. **LaunchDaemon不動作**: plist設定確認
4. **通知が届かない**: システム環境設定確認

### 解決手順
1. **ログ確認**: エラーログの詳細確認
2. **Keychain確認**: 認証情報の存在確認
3. **LaunchDaemon状態**: `launchctl list`で確認
4. **再起動**: サービス再起動

### macOS固有の問題
```bash
# LaunchDaemon再読み込み
launchctl unload ~/Library/LaunchAgents/com.tasty.recipe.monitor.plist
launchctl load ~/Library/LaunchAgents/com.tasty.recipe.monitor.plist

# Keychain権限リセット
security delete-generic-password -s "com.tasty.recipe.monitor"
python scripts/setup_keychain.py

# 通知権限確認
osascript -e 'display notification "Test" with title "Test Notification"'
```

## 📞 サポート

### ドキュメント
- `docs/API_SETUP.md`: API設定詳細
- `docs/TROUBLESHOOTING.md`: 問題解決
- `docs/MAINTENANCE.md`: 保守手順
- `docs/MACOS_GUIDE.md`: macOS固有の設定

### 設定例
```python
# config/settings.py 基本設定例
import os
from pathlib import Path
from config.keychain_manager import MacOSKeychainManager

class Settings:
    PROJECT_NAME = "Tasty Recipe Monitor"
    VERSION = "1.0.0"
    DEBUG = False
    
    # パス設定（macOS）
    BASE_DIR = Path.home() / "Developer" / "tasty-recipe-monitor"
    DATA_DIR = BASE_DIR / "data"
    LOG_DIR = BASE_DIR / "logs"
    
    # Keychain統合
    keychain = MacOSKeychainManager()
    
    # API設定（Keychain優先）
    YOUTUBE_API_KEY = keychain.get_password("YOUTUBE_API_KEY") or os.getenv("YOUTUBE_API_KEY")
    CLAUDE_API_KEY = keychain.get_password("CLAUDE_API_KEY") or os.getenv("CLAUDE_API_KEY")
    NOTION_TOKEN = keychain.get_password("NOTION_TOKEN") or os.getenv("NOTION_TOKEN")
    
    # 処理設定
    MAX_VIDEOS_PER_RUN = 20
    RETRY_COUNT = 3
    TIMEOUT_SECONDS = 300
    
    # macOS通知設定
    ENABLE_NOTIFICATIONS = True
    NOTIFICATION_SOUND = "Glass"
```

## 📝 開発者向け情報

### macOS開発環境
```bash
# Xcode Command Line Tools
xcode-select --install

# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Python (Homebrew経由)
brew install python@3.11

# 必須パッケージ
brew install git wget

# 仮想環境作成
python3 -m venv venv
source venv/bin/activate
```

### 新機能追加
1. **機能設計**: 要件定義と設計
2. **実装**: コード実装とテスト
3. **Keychain対応**: 認証情報の安全な管理
4. **LaunchDaemon統合**: 自動実行設定
5. **統合テスト**: 総合テスト実行

### コントリビューション
1. **Issue作成**: 機能要求・バグ報告
2. **Fork & Branch**: 開発ブランチ作成
3. **Pull Request**: レビュー依頼
4. **Merge**: メインブランチ統合

---

## 🎯 Claude Code実装指示

このプロジェクトの実装時は以下の順序で進めてください：

1. **環境構築**: macOS環境準備・設定
2. **Keychain設定**: 認証情報の安全な管理
3. **API設定**: 各種API認証設定
4. **コアサービス**: YouTube監視・Claude解析・Notion連携
5. **LaunchDaemon**: 自動実行設定
6. **統合テスト**: 全体動作確認

各段階で動作確認を行い、次の段階に進んでください。エラー発生時は詳細ログを確認し、必要に応じて設定調整を行ってください。

macOS固有の機能（Keychain、LaunchDaemon、ネイティブ通知）を最大限活用し、セキュアで使いやすいシステムを構築してください。