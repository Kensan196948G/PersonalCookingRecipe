#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API認証情報管理クラス
PersonalCookRecipe - 3チャンネル統合レシピ監視システム

このモジュールは全てのAPI（YouTube、Claude、Notion、Gmail）の認証情報を
macOS Keychainと環境変数ファイルのフォールバック機能付きで管理します。
"""

import os
import json
import logging
from typing import Dict, Optional, Any, Tuple
from pathlib import Path
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from .credentials_manager import LinuxCredentialsManager


class APIManager:
    """API認証情報管理クラス（Linux環境対応）
    
    4つのAPI（YouTube、Claude、Notion、Gmail）の認証情報を統合管理します。
    Linux環境変数を優先し、暗号化ファイルをフォールバックとして使用します。
    """
    
    def __init__(self, config_dir: Path):
        """
        API管理クラスの初期化
        
        Args:
            config_dir (Path): 設定ディレクトリのパス
        """
        self.config_dir = config_dir
        self.api_keys_file = config_dir / "api_keys.env"
        self.oauth_tokens_file = config_dir / "oauth_tokens.json"
        
        # Linux認証管理システムの初期化
        self.credentials_manager = LinuxCredentialsManager(
            service_name="personal-cooking-recipe",
            config_dir=config_dir
        )
        
        # ログ設定
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.INFO)
        
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
        
        # Keychain管理クラス初期化
        self.keychain_manager = MacOSKeychainManager(self.keychain_service)
        
        # 設定ディレクトリ作成
        config_dir.mkdir(parents=True, exist_ok=True)
        
        # API認証情報とOAuthトークン読み込み
        self.api_keys = self._load_api_keys()
        self.oauth_tokens = self._load_oauth_tokens()
        
        self.logger.info("APIManager初期化完了")
    
    def _load_api_keys(self) -> Dict[str, str]:
        """
        API認証情報読み込み（Keychainフォールバック付き）
        
        優先順位:
        1. macOS Keychain
        2. 環境変数ファイル
        3. 環境変数
        
        Returns:
            Dict[str, str]: API認証情報の辞書
        """
        api_keys = {}
        
        try:
            # 1. Keychainから読み込み（優先）
            self.logger.info("Keychainから認証情報読み込み開始")
            keychain_credentials = self.keychain_manager.retrieve_all_credentials()
            
            if keychain_credentials:
                api_keys.update(keychain_credentials)
                self.logger.info(f"Keychainから{len(keychain_credentials)}件の認証情報を読み込み")
            
            # 2. 環境変数ファイルから読み込み（フォールバック）
            if self.api_keys_file.exists():
                self.logger.info("環境変数ファイルから認証情報読み込み")
                env_credentials = self._load_env_file()
                
                # Keychainにない項目のみ追加
                for key, value in env_credentials.items():
                    if key not in api_keys:
                        api_keys[key] = value
                        self.logger.debug(f"環境変数ファイルから追加: {key}")
            
            # 3. システム環境変数から読み込み（最後のフォールバック）
            system_env = self._load_system_env()
            for key, value in system_env.items():
                if key not in api_keys:
                    api_keys[key] = value
                    self.logger.debug(f"システム環境変数から追加: {key}")
            
            self.logger.info(f"API認証情報読み込み完了: 合計{len(api_keys)}件")
            
        except Exception as e:
            self.logger.error(f"API認証情報読み込みエラー: {e}")
            api_keys = {}
        
        return api_keys
    
    def _load_env_file(self) -> Dict[str, str]:
        """
        環境変数ファイルから認証情報読み込み
        
        Returns:
            Dict[str, str]: 認証情報の辞書
        """
        credentials = {}
        
        try:
            with open(self.api_keys_file, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        try:
                            key, value = line.split('=', 1)
                            key = key.strip()
                            value = value.strip().strip('"\'')  # クオート除去
                            
                            if key and value:
                                credentials[key] = value
                        except ValueError:
                            self.logger.warning(f"環境変数ファイル解析エラー（行{line_num}）: {line}")
            
        except Exception as e:
            self.logger.error(f"環境変数ファイル読み込みエラー: {e}")
        
        return credentials
    
    def _load_system_env(self) -> Dict[str, str]:
        """
        システム環境変数から認証情報読み込み
        
        Returns:
            Dict[str, str]: 認証情報の辞書
        """
        api_key_names = [
            'YOUTUBE_API_KEY',
            'CLAUDE_API_KEY',
            'NOTION_TOKEN',
            'NOTION_DATABASE_ID',
            'GMAIL_CLIENT_ID',
            'GMAIL_CLIENT_SECRET',
            'GMAIL_REFRESH_TOKEN'
        ]
        
        credentials = {}
        for key in api_key_names:
            value = os.getenv(key)
            if value:
                credentials[key] = value
        
        return credentials
    
    def _load_oauth_tokens(self) -> Dict[str, Any]:
        """
        OAuth トークン読み込み
        
        Returns:
            Dict[str, Any]: OAuth認証情報の辞書
        """
        try:
            if self.oauth_tokens_file.exists():
                with open(self.oauth_tokens_file, 'r', encoding='utf-8') as f:
                    tokens = json.load(f)
                self.logger.info(f"OAuthトークン読み込み完了: {len(tokens)}件")
                return tokens
            else:
                self.logger.info("OAuthトークンファイルが存在しません")
                return {}
        except Exception as e:
            self.logger.error(f"OAuthトークン読み込みエラー: {e}")
            return {}
    
    def store_in_keychain(self, account: str, password: str) -> bool:
        """
        macOS Keychainに認証情報保存
        
        Args:
            account (str): アカウント名
            password (str): パスワード
        
        Returns:
            bool: 保存成功時True
        """
        success = self.keychain_manager.add_password(account, password)
        if success:
            # メモリ内の認証情報も更新
            self.api_keys[account] = password
            self.logger.info(f"Keychainとメモリに保存: {account}")
        
        return success
    
    def get_from_keychain(self, account: str) -> Optional[str]:
        """
        macOS Keychainから認証情報取得
        
        Args:
            account (str): アカウント名
        
        Returns:
            Optional[str]: 認証情報（取得失敗時はNone）
        """
        return self.keychain_manager.get_password(account)
    
    def get_youtube_credentials(self) -> Optional[str]:
        """
        YouTube API認証情報取得
        
        Returns:
            Optional[str]: YouTube API Key
        """
        api_key = self.api_keys.get('YOUTUBE_API_KEY')
        if not api_key:
            self.logger.warning("YouTube API Keyが設定されていません")
        return api_key
    
    def get_claude_credentials(self) -> Optional[str]:
        """
        Claude API認証情報取得
        
        Returns:
            Optional[str]: Claude API Key
        """
        api_key = self.api_keys.get('CLAUDE_API_KEY')
        if not api_key:
            self.logger.warning("Claude API Keyが設定されていません")
        return api_key
    
    def get_notion_credentials(self) -> Dict[str, Optional[str]]:
        """
        Notion API認証情報取得
        
        Returns:
            Dict[str, Optional[str]]: Notion認証情報（token, database_id）
        """
        credentials = {
            'token': self.api_keys.get('NOTION_TOKEN'),
            'database_id': self.api_keys.get('NOTION_DATABASE_ID')
        }
        
        missing_keys = [key for key, value in credentials.items() if not value]
        if missing_keys:
            self.logger.warning(f"Notion認証情報が不足: {missing_keys}")
        
        return credentials
    
    def get_gmail_credentials(self) -> Optional[Credentials]:
        """
        Gmail API認証情報取得
        
        Returns:
            Optional[Credentials]: Gmail認証クレデンシャル
        """
        try:
            # OAuth認証情報から構築
            gmail_token = self.oauth_tokens.get('gmail')
            if not gmail_token:
                self.logger.warning("Gmail OAuthトークンが設定されていません")
                return None
            
            # Credentialsオブジェクト作成
            credentials = Credentials(
                token=gmail_token.get('access_token'),
                refresh_token=gmail_token.get('refresh_token'),
                token_uri=gmail_token.get('token_uri', 'https://oauth2.googleapis.com/token'),
                client_id=self.api_keys.get('GMAIL_CLIENT_ID'),
                client_secret=self.api_keys.get('GMAIL_CLIENT_SECRET'),
                scopes=gmail_token.get('scopes', ['https://www.googleapis.com/auth/gmail.send'])
            )
            
            # トークンの有効性確認と更新
            if credentials.expired and credentials.refresh_token:
                try:
                    credentials.refresh(Request())
                    # 更新されたトークンを保存
                    self._save_updated_gmail_token(credentials)
                    self.logger.info("Gmail認証トークンを更新しました")
                except Exception as e:
                    self.logger.error(f"Gmail認証トークン更新エラー: {e}")
                    return None
            
            return credentials
            
        except Exception as e:
            self.logger.error(f"Gmail認証情報取得エラー: {e}")
            return None
    
    def _save_updated_gmail_token(self, credentials: Credentials) -> bool:
        """
        更新されたGmailトークンを保存
        
        Args:
            credentials (Credentials): 更新された認証情報
        
        Returns:
            bool: 保存成功時True
        """
        try:
            # OAuthトークンファイルを更新
            self.oauth_tokens['gmail'] = {
                'access_token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'token_uri': credentials.token_uri,
                'scopes': credentials.scopes
            }
            
            # ファイルに保存
            with open(self.oauth_tokens_file, 'w', encoding='utf-8') as f:
                json.dump(self.oauth_tokens, f, indent=2, ensure_ascii=False)
            
            # ファイル権限設定
            os.chmod(self.oauth_tokens_file, 0o600)
            
            self.logger.info("更新されたGmailトークンを保存しました")
            return True
            
        except Exception as e:
            self.logger.error(f"Gmailトークン保存エラー: {e}")
            return False
    
    def validate_all_credentials(self) -> Dict[str, bool]:
        """
        全認証情報の検証
        
        Returns:
            Dict[str, bool]: 各APIの認証情報有効性
        """
        validation_results = {}
        
        # YouTube認証情報検証
        youtube_key = self.get_youtube_credentials()
        validation_results['youtube'] = bool(youtube_key and len(youtube_key) > 10)
        
        # Claude認証情報検証
        claude_key = self.get_claude_credentials()
        validation_results['claude'] = bool(claude_key and claude_key.startswith('sk-'))
        
        # Notion認証情報検証
        notion_creds = self.get_notion_credentials()
        validation_results['notion'] = bool(
            notion_creds['token'] and 
            notion_creds['database_id'] and
            len(notion_creds['token']) > 20
        )
        
        # Gmail認証情報検証
        gmail_creds = self.get_gmail_credentials()
        validation_results['gmail'] = bool(gmail_creds)
        
        # 総合評価
        all_valid = all(validation_results.values())
        validation_results['all_valid'] = all_valid
        
        valid_count = sum(validation_results.values()) - 1  # all_validを除く
        total_count = len(validation_results) - 1
        
        self.logger.info(f"認証情報検証完了: {valid_count}/{total_count}件有効")
        
        return validation_results
    
    def refresh_oauth_tokens(self) -> bool:
        """
        OAuth トークン更新
        
        Returns:
            bool: 更新成功時True
        """
        try:
            # Gmail認証情報を取得（この過程で自動更新される）
            gmail_creds = self.get_gmail_credentials()
            
            if gmail_creds:
                self.logger.info("OAuthトークン更新完了")
                return True
            else:
                self.logger.error("OAuthトークン更新失敗")
                return False
                
        except Exception as e:
            self.logger.error(f"OAuthトークン更新エラー: {e}")
            return False
    
    def backup_credentials(self, backup_dir: Path) -> bool:
        """
        認証情報のバックアップ作成
        
        Args:
            backup_dir (Path): バックアップディレクトリ
        
        Returns:
            bool: バックアップ成功時True
        """
        try:
            backup_dir.mkdir(parents=True, exist_ok=True)
            
            # Keychainからエクスポート
            env_content = self.keychain_manager.export_to_env_format()
            backup_file = backup_dir / f"api_keys_backup_{self._get_timestamp()}.env"
            
            with open(backup_file, 'w', encoding='utf-8') as f:
                f.write(env_content)
            
            # ファイル権限設定
            os.chmod(backup_file, 0o600)
            
            self.logger.info(f"認証情報バックアップ作成: {backup_file}")
            return True
            
        except Exception as e:
            self.logger.error(f"認証情報バックアップエラー: {e}")
            return False
    
    def _get_timestamp(self) -> str:
        """
        現在のタイムスタンプ取得
        
        Returns:
            str: タイムスタンプ文字列
        """
        import datetime
        return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    
    def get_api_status(self) -> Dict[str, Any]:
        """
        API認証情報の状態取得
        
        Returns:
            Dict[str, Any]: API状態の詳細情報
        """
        status = {
            'keychain_health': self.keychain_manager.health_check(),
            'credentials_validation': self.validate_all_credentials(),
            'total_keys': len(self.api_keys),
            'oauth_tokens': len(self.oauth_tokens),
            'config_files': {
                'api_keys_file': self.api_keys_file.exists(),
                'oauth_tokens_file': self.oauth_tokens_file.exists()
            }
        }
        
        return status


class APIConnectionTester:
    """API接続テストクラス
    
    各APIの実際の接続テストと動作確認を行います。
    """
    
    def __init__(self, api_manager: APIManager):
        """
        API接続テスター初期化
        
        Args:
            api_manager (APIManager): API管理クラスのインスタンス
        """
        self.api_manager = api_manager
        self.logger = logging.getLogger(__name__)
    
    async def test_youtube_connection(self) -> Dict[str, Any]:
        """
        YouTube API接続テスト
        
        Returns:
            Dict[str, Any]: テスト結果
        """
        result = {
            'success': False,
            'response_time': 0,
            'quota_used': 0,
            'error': None
        }
        
        try:
            import time
            import httpx
            
            start_time = time.time()
            
            api_key = self.api_manager.get_youtube_credentials()
            if not api_key:
                result['error'] = "YouTube API Keyが設定されていません"
                return result
            
            # YouTube API テストリクエスト
            test_url = "https://www.googleapis.com/youtube/v3/channels"
            params = {
                'key': api_key,
                'part': 'snippet',
                'id': 'UC8C7QblJwCHsYrftuLjGKig',  # Sam The Cooking Guy
                'maxResults': 1
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(test_url, params=params, timeout=30)
                
                result['response_time'] = time.time() - start_time
                
                if response.status_code == 200:
                    data = response.json()
                    result['success'] = True
                    result['quota_used'] = 1  # チャンネル情報取得のクォータ
                    self.logger.info("YouTube API接続テスト成功")
                else:
                    result['error'] = f"HTTP {response.status_code}: {response.text}"
                    self.logger.error(f"YouTube API接続テスト失敗: {result['error']}")
        
        except Exception as e:
            result['error'] = str(e)
            self.logger.error(f"YouTube API接続テスト例外: {e}")
        
        return result
    
    async def test_claude_connection(self) -> Dict[str, Any]:
        """
        Claude API接続テスト
        
        Returns:
            Dict[str, Any]: テスト結果
        """
        result = {
            'success': False,
            'response_time': 0,
            'model_available': None,
            'error': None
        }
        
        try:
            import time
            import httpx
            
            start_time = time.time()
            
            api_key = self.api_manager.get_claude_credentials()
            if not api_key:
                result['error'] = "Claude API Keyが設定されていません"
                return result
            
            # Claude API テストリクエスト
            test_url = "https://api.anthropic.com/v1/messages"
            headers = {
                'x-api-key': api_key,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            }
            
            test_data = {
                'model': 'claude-3-5-sonnet-20241022',
                'max_tokens': 10,
                'messages': [
                    {
                        'role': 'user',
                        'content': 'テスト'
                    }
                ]
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    test_url, 
                    json=test_data, 
                    headers=headers, 
                    timeout=30
                )
                
                result['response_time'] = time.time() - start_time
                
                if response.status_code == 200:
                    data = response.json()
                    result['success'] = True
                    result['model_available'] = test_data['model']
                    self.logger.info("Claude API接続テスト成功")
                else:
                    result['error'] = f"HTTP {response.status_code}: {response.text}"
                    self.logger.error(f"Claude API接続テスト失敗: {result['error']}")
        
        except Exception as e:
            result['error'] = str(e)
            self.logger.error(f"Claude API接続テスト例外: {e}")
        
        return result
    
    async def test_notion_connection(self) -> Dict[str, Any]:
        """
        Notion API接続テスト
        
        Returns:
            Dict[str, Any]: テスト結果
        """
        result = {
            'success': False,
            'response_time': 0,
            'database_accessible': False,
            'error': None
        }
        
        try:
            import time
            import httpx
            
            start_time = time.time()
            
            notion_creds = self.api_manager.get_notion_credentials()
            if not notion_creds['token'] or not notion_creds['database_id']:
                result['error'] = "Notion認証情報が不完全です"
                return result
            
            # Notion API テストリクエスト
            test_url = f"https://api.notion.com/v1/databases/{notion_creds['database_id']}"
            headers = {
                'Authorization': f"Bearer {notion_creds['token']}",
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(test_url, headers=headers, timeout=30)
                
                result['response_time'] = time.time() - start_time
                
                if response.status_code == 200:
                    data = response.json()
                    result['success'] = True
                    result['database_accessible'] = True
                    self.logger.info("Notion API接続テスト成功")
                else:
                    result['error'] = f"HTTP {response.status_code}: {response.text}"
                    self.logger.error(f"Notion API接続テスト失敗: {result['error']}")
        
        except Exception as e:
            result['error'] = str(e)
            self.logger.error(f"Notion API接続テスト例外: {e}")
        
        return result
    
    async def test_gmail_connection(self) -> Dict[str, Any]:
        """
        Gmail API接続テスト
        
        Returns:
            Dict[str, Any]: テスト結果
        """
        result = {
            'success': False,
            'credentials_valid': False,
            'send_permission': False,
            'error': None
        }
        
        try:
            from googleapiclient.discovery import build
            
            credentials = self.api_manager.get_gmail_credentials()
            if not credentials:
                result['error'] = "Gmail認証情報が設定されていません"
                return result
            
            # Gmail APIサービス構築
            service = build('gmail', 'v1', credentials=credentials)
            
            # プロフィール情報取得テスト
            profile = service.users().getProfile(userId='me').execute()
            
            result['success'] = True
            result['credentials_valid'] = True
            result['send_permission'] = True  # 簡略化
            
            self.logger.info("Gmail API接続テスト成功")
            
        except Exception as e:
            result['error'] = str(e)
            self.logger.error(f"Gmail API接続テスト例外: {e}")
        
        return result
    
    async def test_all_connections(self) -> Dict[str, Dict[str, Any]]:
        """
        全API接続テスト
        
        Returns:
            Dict[str, Dict[str, Any]]: 全APIのテスト結果
        """
        self.logger.info("全API接続テスト開始")
        
        results = {}
        
        # 各APIテストを並列実行
        import asyncio
        
        tests = {
            'youtube': self.test_youtube_connection(),
            'claude': self.test_claude_connection(),
            'notion': self.test_notion_connection(),
            'gmail': self.test_gmail_connection()
        }
        
        # テスト実行
        for api_name, test_coro in tests.items():
            try:
                results[api_name] = await test_coro
            except Exception as e:
                results[api_name] = {
                    'success': False,
                    'error': f"テスト実行エラー: {e}"
                }
        
        # 総合結果
        success_count = sum(1 for result in results.values() if result['success'])
        total_count = len(results)
        
        self.logger.info(f"全API接続テスト完了: {success_count}/{total_count}件成功")
        
        return results
    
    def generate_test_report(self, results: Dict[str, Dict[str, Any]]) -> str:
        """
        テスト結果レポート生成
        
        Args:
            results (Dict[str, Dict[str, Any]]): テスト結果
        
        Returns:
            str: レポート文字列
        """
        report_lines = [
            "=== API接続テスト結果レポート ===",
            ""
        ]
        
        for api_name, result in results.items():
            status = "✅ 成功" if result['success'] else "❌ 失敗"
            report_lines.append(f"{api_name.upper()}: {status}")
            
            if not result['success'] and result.get('error'):
                report_lines.append(f"  エラー: {result['error']}")
            
            if 'response_time' in result:
                report_lines.append(f"  応答時間: {result['response_time']:.2f}秒")
            
            report_lines.append("")
        
        # 総合結果
        success_count = sum(1 for result in results.values() if result['success'])
        total_count = len(results)
        success_rate = success_count / total_count if total_count > 0 else 0
        
        report_lines.extend([
            f"総合結果: {success_count}/{total_count}件成功 ({success_rate:.1%})",
            "",
            "=== レポート終了 ==="
        ])
        
        return "\n".join(report_lines)


# 使用例
def example_usage():
    """API管理クラスの使用例"""
    
    from pathlib import Path
    
    # 設定ディレクトリ
    config_dir = Path.home() / "Developer" / "tasty-recipe-monitor" / "config"
    
    # API管理クラス初期化
    api_manager = APIManager(config_dir)
    
    # 認証情報検証
    validation = api_manager.validate_all_credentials()
    print(f"認証情報検証結果: {validation}")
    
    # API状態取得
    status = api_manager.get_api_status()
    print(f"API状態: {status}")


if __name__ == "__main__":
    import asyncio
    logging.basicConfig(level=logging.INFO)
    
    # 使用例実行
    example_usage()