#PersonalCookRecipe-API認証設定仕様書
#API認証設定仕様書

**仕様書ID**: 02_API_AUTH_SETUP  
**作成日**: 2025年7月24日  
**対象**: Claude Code実装  
**プロジェクト**: 3チャンネル統合レシピ監視システム  
**前提条件**: 01_MacOS環境準備設定 完了  

---

## 📋 概要

### 🎯 目的
- 4つのAPI（YouTube、Claude、Notion、Gmail）の認証設定
- 環境変数管理システムの構築
- macOS Keychainを活用したセキュアな認証情報保存
- API接続テスト機能の実装

### 🔗 対象API
- **YouTube Data API v3**: 動画メタデータ取得
- **Claude API (Anthropic)**: レシピ解析・翻訳
- **Notion API**: データベース連携
- **Gmail API**: 通知送信

### 🔒 セキュリティ要件
- macOS Keychainによる認証情報管理
- ファイル権限600での保護
- Git除外設定
- 環境変数での管理

---

## 🔑 API認証情報取得手順

### 📺 YouTube Data API v3

#### 取得手順
1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクト作成または既存選択
3. YouTube Data API v3 を有効化
4. 認証情報 > APIキー を作成
5. APIキーの制限設定（YouTube Data API v3のみ）

#### 必要情報
- **API_KEY**: YouTube APIアクセス用キー

#### 制限設定
- **アプリケーション制限**: なし
- **API制限**: YouTube Data API v3のみ
- **1日のクォータ**: 10,000リクエスト

### 🤖 Claude API (Anthropic)

#### 取得手順
1. [Anthropic Console](https://console.anthropic.com/) にアクセス
2. アカウント作成・ログイン
3. API Keys セクションでキー生成
4. Claude Pro Max 200契約の確認

#### 必要情報
- **API_KEY**: Claude APIアクセス用キー

#### 利用可能モデル
- **claude-3-5-sonnet-20241022** (推奨)
- **claude-3-haiku-20240307** (軽量版)

### 📝 Notion API

#### 取得手順
1. [Notion Developer](https://developers.notion.com/) にアクセス
2. 新しいIntegration作成
3. Internal Integration Token取得
4. 対象データベースに統合を共有
5. データベースID取得

#### 必要情報
- **INTEGRATION_TOKEN**: Notion内部統合トークン
- **DATABASE_ID**: レシピデータベースID

#### データベース構造
- 料理名 (Title)
- YouTube URL (URL)
- 調理時間 (Number)
- 人数 (Number)
- 難易度 (Select)
- メイン食材 (Multi-select)
- チャンネル (Select)
- 登録日 (Date)

### 📧 Gmail API

#### 取得手順
1. Google Cloud Console で Gmail API を有効化
2. OAuth 2.0 認証情報作成
3. スコープ設定: gmail.send
4. 認証情報JSONダウンロード
5. OAuth同意画面設定

#### 必要情報
- **CLIENT_ID**: OAuth2.0クライアントID
- **CLIENT_SECRET**: OAuth2.0クライアントシークレット
- **REFRESH_TOKEN**: 更新トークン（初回認証後生成）

---

## 🔧 Claude Code実装タスク

### 📝 タスク1: API認証管理クラス
- **ファイル名**: `config/api_manager.py`
- **機能**: 全API認証情報の管理（macOS Keychain対応）
- **実装内容**: 認証情報読み込み、検証、更新

### 🔐 タスク2: Keychain管理
- **ファイル名**: `config/keychain_manager.py`
- **機能**: macOS Keychainとの連携
- **実装内容**: セキュアな認証情報保存・取得

### 🧪 タスク3: API接続テスト
- **ファイル名**: `tests/test_api_connections.py`
- **機能**: 全API接続の動作確認
- **実装内容**: 接続テスト、エラー診断、レポート生成

### 🔄 タスク4: OAuth認証ヘルパー
- **ファイル名**: `config/oauth_helper.py`
- **機能**: Gmail OAuth認証の自動化
- **実装内容**: 初回認証、トークン更新、認証フロー

---

## 🔍 詳細実装仕様

### 🛠️ API認証管理クラス仕様

**ファイル**: `config/api_manager.py`

```python
# 実装要件:
import os
import json
import logging
import subprocess
from typing import Dict, Optional, Any
from pathlib import Path
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

class APIManager:
    """API認証情報管理クラス（macOS Keychain対応）"""
    
    def __init__(self, config_dir: Path):
        self.config_dir = config_dir
        self.api_keys_file = config_dir / "api_keys.env"
        self.oauth_tokens_file = config_dir / "oauth_tokens.json"
        self.keychain_service = "com.tasty.recipe.monitor"
        self.logger = logging.getLogger(__name__)
        
        # API認証情報読み込み
        self.api_keys = self._load_api_keys()
        self.oauth_tokens = self._load_oauth_tokens()
    
    def _load_api_keys(self) -> Dict[str, str]:
        """API認証情報読み込み（Keychainフォールバック付き）"""
        # 環境変数から読み込み
        # Keychainからも読み込み
        pass
    
    def _load_oauth_tokens(self) -> Dict[str, Any]:
        """OAuth トークン読み込み"""
        # OAuth認証情報読み込み
        pass
    
    def store_in_keychain(self, account: str, password: str) -> bool:
        """macOS Keychainに認証情報保存"""
        # security add-generic-password コマンド使用
        pass
    
    def get_from_keychain(self, account: str) -> Optional[str]:
        """macOS Keychainから認証情報取得"""
        # security find-generic-password コマンド使用
        pass
    
    def get_youtube_credentials(self) -> str:
        """YouTube API認証情報取得"""
        pass
    
    def get_claude_credentials(self) -> str:
        """Claude API認証情報取得"""
        pass
    
    def get_notion_credentials(self) -> Dict[str, str]:
        """Notion API認証情報取得"""
        pass
    
    def get_gmail_credentials(self) -> Credentials:
        """Gmail API認証情報取得"""
        pass
    
    def validate_all_credentials(self) -> Dict[str, bool]:
        """全認証情報の検証"""
        pass
    
    def refresh_oauth_tokens(self) -> bool:
        """OAuth トークン更新"""
        pass

class KeychainManager:
    """macOS Keychain管理クラス"""
    
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.logger = logging.getLogger(__name__)
    
    def add_password(self, account: str, password: str) -> bool:
        """Keychainにパスワード追加"""
        cmd = [
            'security', 'add-generic-password',
            '-a', account,
            '-s', self.service_name,
            '-w', password,
            '-U'  # 既存の場合は更新
        ]
        # subprocess実行
        pass
    
    def get_password(self, account: str) -> Optional[str]:
        """Keychainからパスワード取得"""
        cmd = [
            'security', 'find-generic-password',
            '-a', account,
            '-s', self.service_name,
            '-w'  # パスワードのみ出力
        ]
        # subprocess実行
        pass
    
    def delete_password(self, account: str) -> bool:
        """Keychainからパスワード削除"""
        cmd = [
            'security', 'delete-generic-password',
            '-a', account,
            '-s', self.service_name
        ]
        # subprocess実行
        pass
    
    def list_accounts(self) -> List[str]:
        """保存されているアカウント一覧取得"""
        pass

class APIConnectionTester:
    """API接続テストクラス"""
    
    def __init__(self, api_manager: APIManager):
        self.api_manager = api_manager
        self.logger = logging.getLogger(__name__)
    
    async def test_youtube_connection(self) -> Dict[str, Any]:
        """YouTube API接続テスト"""
        pass
    
    async def test_claude_connection(self) -> Dict[str, Any]:
        """Claude API接続テスト"""
        pass
    
    async def test_notion_connection(self) -> Dict[str, Any]:
        """Notion API接続テスト"""
        pass
    
    async def test_gmail_connection(self) -> Dict[str, Any]:
        """Gmail API接続テスト"""
        pass
    
    async def test_all_connections(self) -> Dict[str, Dict[str, Any]]:
        """全API接続テスト"""
        pass
    
    def generate_test_report(self, results: Dict) -> str:
        """テスト結果レポート生成"""
        pass
```

### 🔐 環境変数管理仕様

**ファイル**: `config/api_keys.env`

```bash
# 実装要件:

# ============================================
# YouTube Data API v3 設定
# ============================================
YOUTUBE_API_KEY=your_youtube_api_key_here
YOUTUBE_QUOTA_LIMIT=10000

# ============================================
# Claude API (Anthropic) 設定
# ============================================
CLAUDE_API_KEY=your_claude_api_key_here
CLAUDE_MODEL=claude-3-5-sonnet-20241022
CLAUDE_MAX_TOKENS=4000
CLAUDE_TEMPERATURE=0.3

# ============================================
# Notion API 設定
# ============================================
NOTION_TOKEN=your_notion_integration_token_here
NOTION_DATABASE_ID=your_notion_database_id_here
NOTION_VERSION=2022-06-28

# ============================================
# Gmail API 設定
# ============================================
GMAIL_CLIENT_ID=your_gmail_client_id_here
GMAIL_CLIENT_SECRET=your_gmail_client_secret_here
NOTIFICATION_EMAIL=your_notification_email@example.com

# ============================================
# 一般設定
# ============================================
DEBUG=false
LOG_LEVEL=INFO
ENVIRONMENT=production

# ============================================
# システム設定
# ============================================
MAX_RETRIES=3
TIMEOUT_SECONDS=30
RATE_LIMIT_DELAY=1

# ============================================
# macOS Keychain設定
# ============================================
USE_KEYCHAIN=true
KEYCHAIN_SERVICE=com.tasty.recipe.monitor
```

### 🔐 Keychain管理仕様

**ファイル**: `config/keychain_manager.py`

```python
# 実装要件:
import subprocess
import logging
from typing import Optional, List, Dict
from pathlib import Path

class MacOSKeychainManager:
    """macOS Keychain統合管理クラス"""
    
    def __init__(self, service_name: str = "com.tasty.recipe.monitor"):
        self.service_name = service_name
        self.logger = logging.getLogger(__name__)
    
    def store_api_credentials(self, api_credentials: Dict[str, str]) -> bool:
        """全API認証情報をKeychainに保存"""
        success_count = 0
        
        for key, value in api_credentials.items():
            if self.add_password(key, value):
                success_count += 1
                self.logger.info(f"Keychainに保存: {key}")
            else:
                self.logger.error(f"Keychain保存失敗: {key}")
        
        return success_count == len(api_credentials)
    
    def retrieve_all_credentials(self) -> Dict[str, str]:
        """Keychainから全認証情報取得"""
        credentials = {}
        accounts = self.list_accounts()
        
        for account in accounts:
            password = self.get_password(account)
            if password:
                credentials[account] = password
        
        return credentials
    
    def migrate_from_env_file(self, env_file: Path) -> bool:
        """環境変数ファイルからKeychainへ移行"""
        # .envファイル読み込み
        # Keychainに保存
        # セキュリティ確認
        pass
    
    def export_to_env_format(self) -> str:
        """Keychain情報を環境変数形式でエクスポート"""
        # 開発・デバッグ用
        pass
    
    def secure_cleanup(self) -> bool:
        """セキュアクリーンアップ"""
        # 不要な認証情報削除
        pass
```

### 🔄 OAuth認証ヘルパー仕様

**ファイル**: `config/oauth_helper.py`

```python
# 実装要件:
import os
import json
import logging
import webbrowser
from pathlib import Path
from typing import Dict, Optional
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

class GmailOAuthHelper:
    """Gmail OAuth認証ヘルパー（macOS対応）"""
    
    SCOPES = ['https://www.googleapis.com/auth/gmail.send']
    
    def __init__(self, config_dir: Path, keychain_manager: MacOSKeychainManager):
        self.config_dir = config_dir
        self.credentials_file = config_dir / "gmail_credentials.json"
        self.token_file = config_dir / "gmail_token.json"
        self.keychain_manager = keychain_manager
        self.logger = logging.getLogger(__name__)
    
    def initialize_oauth(self) -> bool:
        """OAuth初期化（macOSブラウザ自動起動）"""
        # macOSデフォルトブラウザで認証
        pass
    
    def load_credentials(self) -> Optional[Credentials]:
        """認証情報読み込み（Keychain優先）"""
        # Keychainから読み込み試行
        # ファイルフォールバック
        pass
    
    def refresh_credentials(self) -> bool:
        """認証情報更新"""
        # 期限切れトークンの更新
        # Keychainに保存
        pass
    
    def save_credentials(self, credentials: Credentials) -> bool:
        """認証情報保存（Keychainとファイル両方）"""
        # Keychainに保存
        # バックアップファイル作成
        pass
    
    def test_gmail_service(self) -> bool:
        """Gmail サービステスト"""
        # 実際にGmail APIを呼び出してテスト
        pass
    
    def revoke_credentials(self) -> bool:
        """認証情報取り消し"""
        # トークン無効化
        # Keychainから削除
        pass

class NotionConnectionHelper:
    """Notion接続ヘルパー"""
    
    def __init__(self, token: str, database_id: str):
        self.token = token
        self.database_id = database_id
        self.logger = logging.getLogger(__name__)
    
    def test_connection(self) -> Dict[str, Any]:
        """Notion接続テスト"""
        pass
    
    def validate_database_structure(self) -> Dict[str, Any]:
        """データベース構造検証"""
        pass
    
    def create_test_page(self) -> Dict[str, Any]:
        """テストページ作成"""
        pass
    
    def cleanup_test_data(self) -> bool:
        """テストデータクリーンアップ"""
        pass
```

### 🧪 API接続テスト仕様

**ファイル**: `tests/test_api_connections.py`

```python
# 実装要件:
import asyncio
import pytest
import logging
from typing import Dict, Any
from pathlib import Path
from config.api_manager import APIManager, APIConnectionTester
from config.keychain_manager import MacOSKeychainManager

class TestAPIConnections:
    """API接続統合テストクラス"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        base_dir = Path.home() / "Developer" / "tasty-recipe-monitor"
        self.api_manager = APIManager(base_dir / "config")
        self.tester = APIConnectionTester(self.api_manager)
        self.keychain_manager = MacOSKeychainManager()
        self.logger = logging.getLogger(__name__)
    
    @pytest.mark.asyncio
    async def test_youtube_api_connection(self):
        """YouTube API接続テスト"""
        # 基本接続テスト
        # クォータ確認
        # レスポンス形式確認
        pass
    
    @pytest.mark.asyncio
    async def test_claude_api_connection(self):
        """Claude API接続テスト"""
        # 基本接続テスト
        # モデル利用可能性確認
        # レスポンス品質確認
        pass
    
    @pytest.mark.asyncio
    async def test_notion_api_connection(self):
        """Notion API接続テスト"""
        # 基本接続テスト
        # データベースアクセス確認
        # 読み書き権限確認
        pass
    
    @pytest.mark.asyncio
    async def test_gmail_api_connection(self):
        """Gmail API接続テスト"""
        # 基本接続テスト
        # 送信権限確認
        # OAuth有効性確認
        pass
    
    @pytest.mark.asyncio
    async def test_all_apis_integration(self):
        """全API統合テスト"""
        # 全API同時接続テスト
        # 相互連携テスト
        # パフォーマンステスト
        pass
    
    def test_keychain_integration(self):
        """Keychain統合テスト"""
        # Keychain読み書きテスト
        # セキュリティ確認
        pass
    
    def test_api_key_security(self):
        """API認証情報セキュリティテスト"""
        # ファイル権限確認
        # Keychain保存確認
        # Git除外確認
        pass
```

---

## 🔒 セキュリティ実装要件

### 🛡️ ファイル権限設定スクリプト

**ファイル**: `scripts/secure_api_keys.sh`

```bash
#!/bin/bash
# 実装要件:

# API認証情報ファイルのセキュリティ設定

API_DIR="$HOME/Developer/tasty-recipe-monitor/config"

# ファイル権限設定
chmod 600 "$API_DIR/api_keys.env" 2>/dev/null
chmod 600 "$API_DIR/gmail_credentials.json" 2>/dev/null
chmod 600 "$API_DIR/gmail_token.json" 2>/dev/null
chmod 600 "$API_DIR/oauth_tokens.json" 2>/dev/null

# ディレクトリ権限設定
chmod 700 "$API_DIR"

# 所有者確認
chown -R $(whoami):staff "$API_DIR"

# Git除外確認
GITIGNORE_FILE="$HOME/Developer/tasty-recipe-monitor/.gitignore"
if [ ! -f "$GITIGNORE_FILE" ]; then
    touch "$GITIGNORE_FILE"
fi

# 機密ファイルをGit除外に追加
cat >> "$GITIGNORE_FILE" << 'EOF'
# API認証情報
config/api_keys.env
config/gmail_credentials.json
config/gmail_token.json
config/oauth_tokens.json

# ログファイル
logs/*.log

# データファイル
data/*.json

# Python
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
venv/
.venv/

# macOS
.DS_Store
.AppleDouble
.LSOverride
Icon
._*
.DocumentRevisions-V100
.fseventsd
.Spotlight-V100
.TemporaryItems
.Trashes
.VolumeIcon.icns
.com.apple.timemachine.donotpresent
.AppleDB
.AppleDesktop
Network Trash Folder
Temporary Items
.apdisk
EOF

echo "API認証情報のセキュリティ設定完了"
```

### 🔐 Keychain設定スクリプト

**ファイル**: `scripts/setup_keychain.py`

```python
# 実装要件:
from pathlib import Path
import subprocess
import getpass
from config.keychain_manager import MacOSKeychainManager

def setup_keychain_environment():
    """Keychain環境設定"""
    
    print("=== macOS Keychain設定開始 ===")
    
    keychain_manager = MacOSKeychainManager()
    
    # 既存の環境変数ファイルチェック
    env_file = Path.home() / "Developer" / "tasty-recipe-monitor" / "config" / "api_keys.env"
    
    if env_file.exists():
        print("既存の環境変数ファイルが見つかりました。")
        migrate = input("Keychainに移行しますか？ (y/n): ")
        
        if migrate.lower() == 'y':
            # 環境変数ファイルからKeychainへ移行
            success = keychain_manager.migrate_from_env_file(env_file)
            if success:
                print("✅ Keychainへの移行完了")
                # セキュリティのため元ファイルを安全に削除
                secure_delete = input("元の環境変数ファイルを削除しますか？ (y/n): ")
                if secure_delete.lower() == 'y':
                    env_file.unlink()
                    print("✅ 環境変数ファイル削除完了")
            else:
                print("❌ Keychain移行失敗")
    
    print("=== Keychain設定完了 ===")

def interactive_keychain_setup():
    """対話型Keychain設定"""
    
    keychain_manager = MacOSKeychainManager()
    
    apis = {
        "YOUTUBE_API_KEY": "YouTube API Key",
        "CLAUDE_API_KEY": "Claude API Key",
        "NOTION_TOKEN": "Notion Integration Token",
        "NOTION_DATABASE_ID": "Notion Database ID",
        "GMAIL_CLIENT_ID": "Gmail Client ID",
        "GMAIL_CLIENT_SECRET": "Gmail Client Secret"
    }
    
    print("=== API認証情報をKeychainに保存 ===")
    
    for key, description in apis.items():
        current = keychain_manager.get_password(key)
        if current:
            print(f"{description}: 既に保存されています")
            update = input("更新しますか？ (y/n): ")
            if update.lower() != 'y':
                continue
        
        value = getpass.getpass(f"{description}を入力: ")
        if value:
            success = keychain_manager.add_password(key, value)
            if success:
                print(f"✅ {description} 保存完了")
            else:
                print(f"❌ {description} 保存失敗")

if __name__ == "__main__":
    setup_keychain_environment()
    interactive_keychain_setup()
```

---

## ✅ API設定検証スクリプト

### 🔍 設定検証メインスクリプト

**ファイル**: `scripts/verify_api_setup.py`

```python
# 実装要件:
import asyncio
import sys
from pathlib import Path
from config.api_manager import APIManager, APIConnectionTester
from config.keychain_manager import MacOSKeychainManager

async def main():
    """API設定検証メイン処理"""
    
    print("=== API認証設定検証開始 ===")
    
    try:
        # API管理クラス初期化
        base_dir = Path.home() / "Developer" / "tasty-recipe-monitor"
        api_manager = APIManager(base_dir / "config")
        tester = APIConnectionTester(api_manager)
        keychain_manager = MacOSKeychainManager()
        
        # 1. 認証情報存在確認
        print("1. 認証情報確認...")
        credential_check = await verify_credentials(api_manager, keychain_manager)
        
        # 2. API接続テスト
        print("2. API接続テスト実行...")
        connection_results = await tester.test_all_connections()
        
        # 3. セキュリティ確認
        print("3. セキュリティ設定確認...")
        security_check = verify_security_settings(base_dir)
        
        # 4. Keychain統合確認
        print("4. Keychain統合確認...")
        keychain_check = verify_keychain_integration(keychain_manager)
        
        # 5. 結果レポート生成
        print("5. 検証結果レポート生成...")
        report = generate_verification_report(
            credential_check, 
            connection_results, 
            security_check,
            keychain_check
        )
        
        print(report)
        
        # 6. 総合判定
        all_passed = all([
            credential_check['all_present'],
            all(result['success'] for result in connection_results.values()),
            security_check['all_secure'],
            keychain_check['keychain_accessible']
        ])
        
        if all_passed:
            print("✅ API認証設定検証: 成功")
            return 0
        else:
            print("❌ API認証設定検証: 失敗")
            return 1
            
    except Exception as e:
        print(f"❌ 検証中にエラー: {e}")
        return 1

async def verify_credentials(api_manager, keychain_manager):
    """認証情報確認"""
    pass

def verify_security_settings(base_dir):
    """セキュリティ設定確認"""
    pass

def verify_keychain_integration(keychain_manager):
    """Keychain統合確認"""
    pass

def generate_verification_report(credential, connection, security, keychain):
    """検証結果レポート生成"""
    pass

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
```

---

## 📋 段階的設定ガイド

### ✅ 設定手順チェックリスト

#### 段階1: YouTube Data API
- [ ] Google Cloud Console アカウント作成
- [ ] 新規プロジェクト作成
- [ ] YouTube Data API v3 有効化
- [ ] APIキー生成
- [ ] APIキー制限設定
- [ ] Keychainに保存
- [ ] 接続テスト実行

#### 段階2: Claude API
- [ ] Anthropic Console アカウント作成
- [ ] Claude Pro Max 200 契約確認
- [ ] APIキー生成
- [ ] Keychainに保存
- [ ] モデルアクセス確認
- [ ] 接続テスト実行

#### 段階3: Notion API
- [ ] Notion Developer アカウント作成
- [ ] Integration作成
- [ ] Internal Token取得
- [ ] データベース作成
- [ ] データベース共有設定
- [ ] データベースID取得
- [ ] Keychainに保存
- [ ] 接続テスト実行

#### 段階4: Gmail API
- [ ] Google Cloud Console でGmail API有効化
- [ ] OAuth 2.0 認証情報作成
- [ ] 同意画面設定
- [ ] 認証情報JSON取得
- [ ] 初回OAuth認証実行（macOSブラウザ使用）
- [ ] トークンをKeychainに保存
- [ ] 送信テスト実行

### 🔄 自動設定スクリプト

**ファイル**: `scripts/auto_api_setup.py`

```python
# 実装要件:
import asyncio
import subprocess
from pathlib import Path
from config.api_manager import APIManager
from config.oauth_helper import GmailOAuthHelper
from config.keychain_manager import MacOSKeychainManager

async def automated_api_setup():
    """API自動設定プロセス（macOS対応）"""
    
    print("=== API自動設定開始 (macOS) ===")
    
    # Keychain管理初期化
    keychain_manager = MacOSKeychainManager()
    
    # 1. 環境変数ファイル作成
    await create_env_template()
    
    # 2. Keychainを使用した認証情報設定
    await interactive_keychain_setup(keychain_manager)
    
    # 3. OAuth認証実行（macOSブラウザ自動起動）
    await setup_oauth_authentication_macos()
    
    # 4. 接続テスト実行
    await verify_all_connections()
    
    # 5. セキュリティ設定適用
    await apply_security_settings()
    
    # 6. LaunchDaemonへの認証情報統合確認
    await verify_launchd_integration()
    
    print("=== API自動設定完了 ===")

async def create_env_template():
    """環境変数テンプレート作成"""
    pass

async def interactive_keychain_setup(keychain_manager):
    """対話形式Keychain設定"""
    pass

async def setup_oauth_authentication_macos():
    """macOS用OAuth認証設定"""
    # open コマンドでブラウザ起動
    pass

async def verify_all_connections():
    """全接続確認"""
    pass

async def apply_security_settings():
    """セキュリティ設定適用"""
    pass

async def verify_launchd_integration():
    """LaunchDaemon統合確認"""
    pass

if __name__ == "__main__":
    asyncio.run(automated_api_setup())
```

---

## ⚠️ エラーハンドリング・トラブルシューティング

### 🔧 macOS固有のエラーと対処法

#### Keychain エラー
- **errSecItemNotFound**: 項目が見つからない → 新規追加
- **errSecAuthFailed**: 認証失敗 → Keychainアクセス権限確認
- **errSecDuplicateItem**: 重複項目 → 既存項目を更新

#### セキュリティ設定エラー
- **Operation not permitted**: SIP有効 → セキュリティ設定確認
- **Permission denied**: 権限不足 → chmod/chown実行

#### OAuth認証エラー（macOS）
- **Browser not opening**: ブラウザ起動失敗 → open コマンド確認
- **Callback failed**: リダイレクト失敗 → ローカルサーバー確認

### 🔍 診断スクリプト

**ファイル**: `scripts/diagnose_api_issues.py`

```python
# 実装要件:
import asyncio
import subprocess
from pathlib import Path
from config.api_manager import APIManager
from config.keychain_manager import MacOSKeychainManager

class APIDiagnostics:
    """API問題診断クラス（macOS対応）"""
    
    def __init__(self):
        base_dir = Path.home() / "Developer" / "tasty-recipe-monitor"
        self.api_manager = APIManager(base_dir / "config")
        self.keychain_manager = MacOSKeychainManager()
    
    async def diagnose_youtube_issues(self):
        """YouTube API問題診断"""
        pass
    
    async def diagnose_claude_issues(self):
        """Claude API問題診断"""
        pass
    
    async def diagnose_notion_issues(self):
        """Notion API問題診断"""
        pass
    
    async def diagnose_gmail_issues(self):
        """Gmail API問題診断"""
        pass
    
    def diagnose_keychain_issues(self):
        """Keychain問題診断"""
        # security list-keychains
        # security default-keychain
        # Keychainアクセス権限確認
        pass
    
    def diagnose_macos_permissions(self):
        """macOS権限問題診断"""
        # ファイルアクセス権限
        # プライバシー設定確認
        pass
    
    def generate_diagnostic_report(self):
        """診断レポート生成"""
        pass
```

---

## ✅ 実行チェックリスト

### 🔍 Claude Code実装前準備
- [ ] 01_MacOS環境準備設定 完了確認
- [ ] macOS Keychainアクセス可能確認
- [ ] インターネット接続確認
- [ ] 各種APIサービスアカウント準備
- [ ] Notion データベース作成準備

### 🚀 実装順序
1. `config/keychain_manager.py` の実装
2. `config/api_manager.py` の実装
3. `config/oauth_helper.py` の実装
4. `scripts/setup_keychain.py` の実装・実行
5. `config/api_keys.env` テンプレート作成
6. `scripts/auto_api_setup.py` の実装・実行
7. `tests/test_api_connections.py` の実装・実行
8. `scripts/verify_api_setup.py` の実行

### ✅ 実装後検証項目
- [ ] Keychainに認証情報が保存されている
- [ ] ファイル権限が適切に設定されている（600）
- [ ] 全API接続テストが成功する
- [ ] OAuth認証が正常に動作する（macOSブラウザ連携）
- [ ] Keychain統合が機能している
- [ ] セキュリティ設定が適用されている
- [ ] LaunchDaemonとの統合が確認されている

---

## 🎯 Claude Code実装指示

### 📋 実装順序

#### Step 1: `config/keychain_manager.py` を実装してください
- MacOSKeychainManager クラスの完全実装
- security コマンドのラッパー機能
- エラーハンドリング

#### Step 2: `config/api_manager.py` を実装してください
- Keychain統合付きAPIManager
- フォールバック機能
- 全API対応

#### Step 3: `config/oauth_helper.py` を実装してください
- macOSブラウザ連携機能
- Keychain保存機能
- トークン管理

#### Step 4: `scripts/setup_keychain.py` を実装してください
- 対話型Keychain設定
- 既存ファイルからの移行機能

#### Step 5: `scripts/auto_api_setup.py` を実装してください
- macOS対応自動設定
- ブラウザ自動起動
- Keychain統合

#### Step 6: `tests/test_api_connections.py` を実装してください
- Keychain統合テスト
- macOS固有機能テスト

### ⚠️ 実装時の注意点
- macOS Keychainを最大限活用
- セキュリティを最優先に実装
- macOS固有のエラーハンドリング
- ユーザビリティを考慮（ブラウザ自動起動等）

### ✅ 完了確認
- 全API接続テスト成功
- Keychain統合動作確認
- セキュリティ検証成功
- macOS環境での完全動作

---

## 🔄 次のステップ

**次の仕様書**: 03_システム機能実装仕様書  
この仕様書完了後に03番の仕様書を要求してください

---

*macOSのセキュリティ機能を活用した、より安全なAPI認証システムを構築しましょう！*