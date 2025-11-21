#PersonalCookRecipe-MacOS環境準備・設定仕様書
# MacOS環境準備・設定仕様書

**仕様書ID**: 01_MACOS_SETUP  
**作成日**: 2025年7月24日  
**対象**: Claude Code実装  
**プロジェクト**: 3チャンネル統合レシピ監視システム  

---

## 📋 概要

### 🎯 目的
- MacOS環境でのTastyレシピ監視システム基盤構築
- Python仮想環境の構築
- 必要パッケージのインストール
- ディレクトリ構造の作成
- 基本設定ファイルの配置

### 🖥️ 対象環境
- **OS**: macOS 12 (Monterey) 以降
- **Python**: 3.8以上（推奨3.10+）
- **Homebrew**: インストール済み（推奨）
- **ディスク容量**: 最低5GB
- **メモリ**: 最低4GB

### 🛠️ 実装方針
- Claude Codeによる自動化スクリプト生成
- エラーハンドリング付きの堅牢な構築
- 段階的な検証とログ出力
- 後続仕様書との連携を考慮

---

## 📁 ディレクトリ構造設計

### 📍 プロジェクトルート
```
~/Developer/tasty-recipe-monitor/
```

### 🏗️ 完全ディレクトリ構造
```
~/Developer/tasty-recipe-monitor/
├── main.py                    # メインスクリプト
├── requirements.txt           # Python依存関係
├── README.md                  # プロジェクト説明
├── .env.example              # 環境変数テンプレート
├── config/                   # 設定ファイル
│   ├── __init__.py
│   ├── settings.py           # 基本設定
│   ├── channels.py           # チャンネル設定
│   ├── logging.conf          # ログ設定
│   └── api_keys.env          # API認証情報（後で作成）
├── services/                 # 機能モジュール
│   ├── __init__.py
│   ├── base_monitor.py       # 基底監視クラス
│   ├── youtube_monitor.py    # YouTube監視
│   ├── claude_analyzer.py    # Claude解析
│   ├── notion_client.py      # Notion連携
│   └── gmail_notifier.py     # Gmail通知
├── data/                     # データ保存
│   ├── processed_videos.json # 処理済み動画
│   ├── failed_videos.json   # 失敗動画ログ
│   ├── metrics.json         # 統計データ
│   └── cache/               # キャッシュディレクトリ
├── logs/                    # ログファイル
│   ├── application.log      # アプリケーションログ
│   ├── error.log           # エラーログ
│   ├── cron.log           # Cron実行ログ
│   └── debug.log          # デバッグログ
├── scripts/                # 運用スクリプト
│   ├── install.sh          # 自動インストール
│   ├── setup_launchd.sh    # LaunchDaemon設定
│   ├── run_monitor.sh      # メイン実行
│   ├── health_check.sh     # ヘルスチェック
│   ├── backup.sh           # バックアップ
│   └── log_rotate.sh       # ログローテーション
├── tests/                  # テストファイル
│   ├── __init__.py
│   ├── test_youtube.py     # YouTube監視テスト
│   ├── test_claude.py      # Claude解析テスト
│   └── test_notion.py      # Notion連携テスト
├── docs/                   # ドキュメント
│   ├── API_SETUP.md        # API設定手順
│   ├── TROUBLESHOOTING.md  # トラブルシューティング
│   └── MAINTENANCE.md      # 保守手順
├── launchd/                # LaunchDaemon設定
│   └── com.tasty.recipe.monitor.plist
└── venv/                   # Python仮想環境
```

---

## 🔧 Claude Code実装タスク定義

### 📝 タスク1: システム要件確認スクリプト
- **ファイル名**: `check_system_requirements.py`
- **機能**: MacOS環境の前提条件確認
- **実装内容**:
  - OSバージョン確認
  - Python版数確認
  - Homebrew確認
  - 必要コマンド存在確認
  - ディスク容量確認

### 🚀 タスク2: 自動インストールスクリプト
- **ファイル名**: `scripts/install.sh`
- **機能**: 全体環境の自動構築
- **実装内容**:
  - ディレクトリ作成
  - Homebrewパッケージインストール
  - Python仮想環境構築
  - 初期設定ファイル配置
  - LaunchDaemon設定

### ⚙️ タスク3: Python設定ファイル群
- **対象ファイル**: `config/*.py`
- **機能**: システム設定の定義
- **実装内容**:
  - 基本設定クラス
  - チャンネル設定
  - ログ設定

### 📜 タスク4: 基本スクリプト群
- **対象ファイル**: `scripts/*.sh`
- **機能**: 運用に必要なシェルスクリプト
- **実装内容**:
  - 実行スクリプト
  - LaunchDaemon設定スクリプト
  - ヘルスチェック
  - ログローテーション

---

## 🔍 詳細実装仕様

### 🖥️ システム要件確認スクリプト仕様

**ファイル**: `check_system_requirements.py`

```python
# 実装要件:
import platform
import subprocess
import sys
from pathlib import Path

class SystemChecker:
    def __init__(self):
        self.requirements = {
            'os_version': '12.0',  # macOS Monterey以降
            'python_version': '3.8',
            'disk_space_gb': 5,
            'memory_gb': 4,
            'required_commands': ['curl', 'git', 'brew'],
            'homebrew_packages': ['python@3.11', 'git', 'wget']
        }
    
    def check_all(self):
        # 全チェック実行
        pass
    
    def check_macos_version(self):
        # macOS版数確認
        # sw_vers -productVersion を使用
        pass
    
    def check_python_version(self):
        # Python版数確認
        pass
    
    def check_homebrew(self):
        # Homebrewインストール確認
        # brew --version を使用
        pass
    
    def check_disk_space(self):
        # ディスク容量確認
        # df -h を使用
        pass
    
    def check_memory(self):
        # メモリ確認
        # sysctl hw.memsize を使用
        pass
    
    def check_commands(self):
        # 必要コマンド存在確認
        pass
    
    def generate_report(self):
        # 確認結果レポート生成
        pass
```

### 🛠️ 自動インストールスクリプト仕様

**ファイル**: `scripts/install.sh`

```bash
#!/bin/bash
# 実装要件:

# 1. 環境変数設定
PROJECT_DIR="$HOME/Developer/tasty-recipe-monitor"
PYTHON_VERSION="3.11"
USER_NAME=$(whoami)

# 2. 事前チェック機能
check_prerequisites() {
    # システム要件確認
    # Homebrew確認
    # エラー時は停止
}

# 3. Homebrewパッケージインストール
install_homebrew_packages() {
    # 必要なHomebrewパッケージインストール
    # python@3.11, git, wget等
}

# 4. ディレクトリ作成機能
create_directories() {
    # 全ディレクトリ構造作成
    # 権限設定
}

# 5. Python仮想環境構築
setup_python_environment() {
    # python3 -m venv venv
    # source venv/bin/activate
    # pip upgrade
    # requirements.txtからインストール
}

# 6. 初期設定ファイル配置
deploy_config_files() {
    # 設定ファイルテンプレート配置
    # 権限設定
}

# 7. LaunchDaemon設定
setup_launchd() {
    # plistファイル作成
    # ~/Library/LaunchAgents/に配置
    # launchctl load設定
}

# 8. 初期データファイル作成
initialize_data_files() {
    # JSON初期化
    # ログファイル作成
}

# 9. 権限設定
set_permissions() {
    # ファイル・ディレクトリ権限
    # 実行権限設定
}

# 10. インストール完了確認
verify_installation() {
    # 全コンポーネント確認
    # テスト実行
}

# メイン実行フロー
main() {
    echo "=== Tasty Recipe Monitor インストール開始 (macOS) ==="
    check_prerequisites
    install_homebrew_packages
    create_directories
    setup_python_environment
    deploy_config_files
    setup_launchd
    initialize_data_files
    set_permissions
    verify_installation
    echo "=== インストール完了 ==="
}
```

### 🚀 LaunchDaemon設定ファイル仕様

**ファイル**: `launchd/com.tasty.recipe.monitor.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" 
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.tasty.recipe.monitor</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/Users/USERNAME/Developer/tasty-recipe-monitor/venv/bin/python</string>
        <string>/Users/USERNAME/Developer/tasty-recipe-monitor/main.py</string>
    </array>
    
    <key>StartInterval</key>
    <integer>3600</integer> <!-- 1時間ごと -->
    
    <key>WorkingDirectory</key>
    <string>/Users/USERNAME/Developer/tasty-recipe-monitor</string>
    
    <key>StandardOutPath</key>
    <string>/Users/USERNAME/Developer/tasty-recipe-monitor/logs/launchd.log</string>
    
    <key>StandardErrorPath</key>
    <string>/Users/USERNAME/Developer/tasty-recipe-monitor/logs/launchd_error.log</string>
    
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

### ⚙️ 基本設定ファイル仕様

**ファイル**: `config/settings.py`

```python
# 実装要件:
import os
from pathlib import Path
from typing import Dict, List, Optional

class ProjectSettings:
    def __init__(self):
        self.BASE_DIR = Path.home() / "Developer" / "tasty-recipe-monitor"
        self.setup_paths()
        self.setup_logging()
        self.setup_processing()
    
    def setup_paths(self):
        # 各ディレクトリパス設定
        self.CONFIG_DIR = self.BASE_DIR / "config"
        self.DATA_DIR = self.BASE_DIR / "data"
        self.LOG_DIR = self.BASE_DIR / "logs"
        self.CACHE_DIR = self.DATA_DIR / "cache"
    
    def setup_logging(self):
        # ログ設定
        self.LOG_LEVEL = "INFO"
        self.LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    def setup_processing(self):
        # 処理設定
        self.CHECK_INTERVAL_MINUTES = 60
        self.MAX_RETRIES = 3
        self.TIMEOUT_SECONDS = 30

class ChannelSettings:
    def __init__(self):
        self.SELECTED_CHANNELS = {
            "sam_cooking_guy": {
                "id": "UC8C7QblJwCHsYrftuLjGKig",
                "name": "Sam The Cooking Guy",
                "priority": 1,
                "check_interval": 120,
                "max_videos_per_check": 8,
                "meat_keywords_weight": 1.2,
                "enabled": True
            },
            "tasty_recipes": {
                "id": "UCJFp8uSYCjXOMnkUyb3CQ3Q",
                "name": "Tasty Recipes", 
                "priority": 1,
                "check_interval": 60,
                "max_videos_per_check": 12,
                "meat_keywords_weight": 1.0,
                "enabled": True
            },
            "joshua_weissman": {
                "id": "UChBEbMKI1eCcejTtmI32UEw",
                "name": "Joshua Weissman",
                "priority": 1,
                "check_interval": 90,
                "max_videos_per_check": 6,
                "meat_keywords_weight": 1.3,
                "enabled": True
            }
        }
```

### 📜 LaunchDaemon設定スクリプト仕様

**ファイル**: `scripts/setup_launchd.sh`

```bash
#!/bin/bash
# LaunchDaemon設定スクリプト

PROJECT_DIR="$HOME/Developer/tasty-recipe-monitor"
PLIST_NAME="com.tasty.recipe.monitor.plist"
LAUNCHD_DIR="$HOME/Library/LaunchAgents"

# plistファイルの生成とインストール
install_launchd() {
    # ユーザー名置換
    # plistファイルコピー
    # launchctl load実行
}

# LaunchDaemon停止
stop_launchd() {
    launchctl unload "$LAUNCHD_DIR/$PLIST_NAME"
}

# LaunchDaemon開始
start_launchd() {
    launchctl load "$LAUNCHD_DIR/$PLIST_NAME"
}

# ステータス確認
check_status() {
    launchctl list | grep com.tasty.recipe.monitor
}
```

### 📦 requirements.txt仕様

**ファイル**: `requirements.txt`

```
# YouTube API
google-api-python-client==2.88.0
google-auth-httplib2==0.1.0
google-auth-oauthlib==1.0.0

# Claude API
anthropic==0.25.8

# Notion API
notion-client==2.0.0

# Gmail API
google-auth==2.17.3
google-auth-oauthlib==1.0.0
google-auth-httplib2==0.1.0

# Web requests
requests==2.31.0
urllib3==1.26.16

# Configuration
python-dotenv==1.0.0
pydantic==2.0.0

# Async support
aiohttp==3.8.5
asyncio-mqtt==0.13.0

# Utility
tenacity==8.2.2
python-dateutil==2.8.2
pytz==2023.3

# Logging
structlog==23.1.0
python-json-logger==2.0.7

# Data processing
python-dateutil==2.8.2
pytz==2023.3

# Testing (optional)
pytest==7.4.0
pytest-asyncio==0.21.1

# macOS specific
pyobjc-core==9.2
pyobjc-framework-Cocoa==9.2
```

---

## ✅ 実行チェックリスト

### 🔍 Claude Code実装前チェック
- [ ] macOS 12以降の確認完了
- [ ] Homebrewインストール確認完了
- [ ] インターネット接続の確認完了
- [ ] 十分なディスク容量の確認完了

### 🚀 実装順序
1. `check_system_requirements.py` の実装・実行
2. `scripts/install.sh` の実装・実行
3. `config/*.py` ファイル群の実装
4. LaunchDaemon設定ファイルの実装
5. その他スクリプトファイルの実装
6. 全体テストの実行

### ✅ 実装後検証項目
- [ ] ディレクトリ構造が正しく作成されている
- [ ] Python仮想環境が正常に動作する
- [ ] 必要パッケージが全てインストールされている
- [ ] 設定ファイルが正しく配置されている
- [ ] 権限設定が適切である
- [ ] ログファイルが作成できる
- [ ] LaunchDaemonが正常に動作する

---

## ⚠️ エラーハンドリング要件

### 🛡️ 必須エラーハンドリング
- システム要件不足時の明確なメッセージ
- Homebrewインストール有無の確認
- Python版数不一致時の対処
- ネットワーク接続エラー時の再試行
- ディスク容量不足時の警告
- インストール失敗時のロールバック

### 📝 ログ出力要件
- 各ステップの開始・完了ログ
- エラー発生時の詳細ログ
- デバッグ情報の出力
- 実行時間の記録

---

## 🎯 Claude Code実装指示

### 📋 実装順序

#### Step 1: `check_system_requirements.py` を実装してください
- macOS向けに調整された仕様
- エラーハンドリング付き
- 実行可能形式で作成

#### Step 2: `scripts/install.sh` を実装してください  
- bash スクリプトとして実装
- Homebrew対応
- LaunchDaemon設定含む

#### Step 3: `config/settings.py` を実装してください
- macOSパス構造に対応
- Python設定クラスとして実装
- 型ヒント付き

#### Step 4: `launchd/com.tasty.recipe.monitor.plist` を作成してください
- 正確なXML形式
- ユーザー名置換可能な形式

#### Step 5: `scripts/setup_launchd.sh` を実装してください
- LaunchDaemon管理スクリプト
- 開始・停止・ステータス確認機能

### ⚠️ 実装時の注意点
- macOS固有のパス構造を使用
- Homebrewのパスを考慮
- LaunchDaemonによる自動実行対応
- コメントは日本語で詳細に記述
- エラーメッセージも日本語化

### 🧪 テスト要件
- 各コンポーネントの単体テスト
- LaunchDaemon動作テスト
- エラーケースのテスト
- 実際のmacOS環境での動作確認

---

## 🔄 次のステップ

**次の仕様書**: 02_API認証設定仕様書  
この仕様書完了後に02番の仕様書を要求してください

---

*3チャンネル統合レシピ監視システムの基盤構築を開始しましょう！*