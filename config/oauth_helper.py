#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OAuth認証ヘルパー
PersonalCookRecipe - 3チャンネル統合レシピ監視システム

このモジュールはGmail OAuth認証の自動化とmacOS固有機能を提供します。
macOSブラウザとの連携、Keychain統合、トークン管理を行います。
"""

import os
import json
import logging
import webbrowser
import subprocess
import socket
import threading
from pathlib import Path
from typing import Dict, Optional, Any, Tuple
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from keychain_manager import MacOSKeychainManager


class MacOSBrowserHandler:
    """macOSブラウザ連携ハンドラー
    
    macOSの`open`コマンドを使用してデフォルトブラウザを起動し、
    OAuth認証フローを処理します。
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def open_url(self, url: str) -> bool:
        """
        macOSデフォルトブラウザでURL開く
        
        Args:
            url (str): 開くURL
        
        Returns:
            bool: 成功時True
        """
        try:
            # macOSの`open`コマンドを使用
            result = subprocess.run(
                ['open', url], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            
            if result.returncode == 0:
                self.logger.info("macOSブラウザでURL開きました")
                return True
            else:
                self.logger.error(f"ブラウザ起動失敗: {result.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            self.logger.error("ブラウザ起動タイムアウト")
            return False
        except Exception as e:
            self.logger.error(f"ブラウザ起動例外: {e}")
            return False
    
    def get_default_browser(self) -> Optional[str]:
        """
        デフォルトブラウザ取得
        
        Returns:
            Optional[str]: ブラウザ名（取得失敗時はNone）
        """
        try:
            # デフォルトブラウザの情報取得
            result = subprocess.run(
                ['defaults', 'read', 'com.apple.LaunchServices/com.apple.launchservices.secure', 'LSHandlers'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                # 簡略化: Safari、Chrome、Firefox等を検出
                output = result.stdout.lower()
                if 'safari' in output:
                    return 'Safari'
                elif 'chrome' in output:
                    return 'Chrome'
                elif 'firefox' in output:
                    return 'Firefox'
                else:
                    return 'Unknown'
            
            return None
            
        except Exception as e:
            self.logger.warning(f"デフォルトブラウザ取得エラー: {e}")
            return None


class LocalCallbackServer:
    """OAuth認証コールバック用ローカルサーバー
    
    OAuth認証のリダイレクトURLを受信するためのローカルHTTPサーバーです。
    """
    
    def __init__(self, host: str = 'localhost', port: int = 8080):
        self.host = host
        self.port = port
        self.auth_code = None
        self.error = None
        self.server = None
        self.logger = logging.getLogger(__name__)
    
    def start(self) -> Tuple[str, int]:
        """
        コールバックサーバー開始
        
        Returns:
            Tuple[str, int]: (ホスト名, ポート番号)
        """
        try:
            # 利用可能ポート検索
            for port in range(self.port, self.port + 10):
                try:
                    self.server = HTTPServer((self.host, port), self._make_handler())
                    self.port = port
                    break
                except OSError:
                    continue
            
            if not self.server:
                raise Exception("利用可能なポートが見つかりません")
            
            # サーバー開始（別スレッド）
            server_thread = threading.Thread(target=self.server.serve_forever)
            server_thread.daemon = True
            server_thread.start()
            
            self.logger.info(f"コールバックサーバー開始: http://{self.host}:{self.port}")
            return self.host, self.port
            
        except Exception as e:
            self.logger.error(f"コールバックサーバー開始エラー: {e}")
            raise
    
    def stop(self):
        """コールバックサーバー停止"""
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.logger.info("コールバックサーバー停止")
    
    def wait_for_auth_code(self, timeout: int = 300) -> Optional[str]:
        """
        認証コード待機
        
        Args:
            timeout (int): タイムアウト秒数
        
        Returns:
            Optional[str]: 認証コード（タイムアウト時はNone）
        """
        import time
        
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.auth_code:
                return self.auth_code
            elif self.error:
                raise Exception(f"OAuth認証エラー: {self.error}")
            
            time.sleep(0.5)
        
        raise TimeoutError("OAuth認証タイムアウト")
    
    def _make_handler(self):
        """HTTPリクエストハンドラー作成"""
        server_instance = self
        
        class CallbackHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                # URLパラメータ解析
                parsed_url = urlparse(self.path)
                params = parse_qs(parsed_url.query)
                
                if 'code' in params:
                    server_instance.auth_code = params['code'][0]
                    self.send_response(200)
                    self.send_header('Content-type', 'text/html')
                    self.end_headers()
                    self.wfile.write('''
                    <html>
                    <body>
                        <h1>Authentication Success</h1>
                        <p>OAuth authentication completed. You can close this window.</p>
                        <script>setTimeout(function(){window.close();}, 3000);</script>
                    </body>
                    </html>
                    '''.encode('utf-8'))
                elif 'error' in params:
                    server_instance.error = params['error'][0]
                    self.send_response(400)
                    self.send_header('Content-type', 'text/html')
                    self.end_headers()
                    self.wfile.write('''
                    <html>
                    <body>
                        <h1>Authentication Error</h1>
                        <p>OAuth authentication error occurred.</p>
                    </body>
                    </html>
                    '''.encode('utf-8'))
                else:
                    self.send_response(400)
                    self.end_headers()
            
            def log_message(self, format, *args):
                # ログ出力を抑制
                pass
        
        return CallbackHandler


class GmailOAuthHelper:
    """Gmail OAuth認証ヘルパー（macOS対応）
    
    Gmail APIのOAuth認証をmacOS環境で自動化します。
    ブラウザ自動起動、Keychain統合、トークン管理を提供します。
    """
    
    SCOPES = ['https://www.googleapis.com/auth/gmail.send']
    
    def __init__(self, config_dir: Path, keychain_manager: MacOSKeychainManager):
        """
        Gmail OAuth認証ヘルパー初期化
        
        Args:
            config_dir (Path): 設定ディレクトリのパス
            keychain_manager (MacOSKeychainManager): Keychain管理クラス
        """
        self.config_dir = config_dir
        self.credentials_file = config_dir / "gmail_credentials.json"
        self.token_file = config_dir / "gmail_token.json"
        self.keychain_manager = keychain_manager
        
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
        
        # macOSブラウザハンドラー
        self.browser_handler = MacOSBrowserHandler()
        
        # 設定ディレクトリ作成
        config_dir.mkdir(parents=True, exist_ok=True)
        
        self.logger.info("GmailOAuthHelper初期化完了")
    
    def initialize_oauth(self, client_credentials: Dict[str, str]) -> bool:
        """
        OAuth初期化（macOSブラウザ自動起動）
        
        Args:
            client_credentials (Dict[str, str]): クライアント認証情報
        
        Returns:
            bool: 初期化成功時True
        """
        try:
            self.logger.info("Gmail OAuth初期化開始")
            
            # クライアント認証情報を一時ファイルに保存
            temp_credentials = {
                "installed": {
                    "client_id": client_credentials.get('client_id'),
                    "client_secret": client_credentials.get('client_secret'),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"]
                }
            }
            
            # 一時認証情報ファイル作成
            temp_cred_file = self.config_dir / "temp_gmail_credentials.json"
            with open(temp_cred_file, 'w', encoding='utf-8') as f:
                json.dump(temp_credentials, f, indent=2)
            
            # ファイル権限設定
            os.chmod(temp_cred_file, 0o600)
            
            # OAuth フロー実行
            flow = InstalledAppFlow.from_client_secrets_file(
                temp_cred_file, 
                self.SCOPES
            )
            
            # コールバックサーバー開始
            callback_server = LocalCallbackServer()
            host, port = callback_server.start()
            
            try:
                # リダイレクトURIをローカルサーバーに設定
                flow.redirect_uri = f"http://{host}:{port}/callback"
                
                # 認証URLを取得
                auth_url, _ = flow.authorization_url(prompt='consent')
                
                self.logger.info(f"認証URL生成: {auth_url}")
                
                # macOSブラウザで認証URL開く
                if not self.browser_handler.open_url(auth_url):
                    self.logger.error("ブラウザ起動失敗")
                    return False
                
                # 認証コード待機
                auth_code = callback_server.wait_for_auth_code(timeout=300)
                
                if auth_code:
                    # 認証コードでトークン取得
                    flow.fetch_token(code=auth_code)
                    credentials = flow.credentials
                    
                    # 認証情報保存
                    success = self.save_credentials(credentials)
                    
                    if success:
                        self.logger.info("Gmail OAuth初期化成功")
                        return True
                    else:
                        self.logger.error("認証情報保存失敗")
                        return False
                else:
                    self.logger.error("認証コード取得失敗")
                    return False
                    
            finally:
                callback_server.stop()
                # 一時ファイル削除
                if temp_cred_file.exists():
                    temp_cred_file.unlink()
        
        except Exception as e:
            self.logger.error(f"Gmail OAuth初期化エラー: {e}")
            return False
    
    def load_credentials(self) -> Optional[Credentials]:
        """
        認証情報読み込み（Keychain優先）
        
        Returns:
            Optional[Credentials]: 認証情報（読み込み失敗時はNone）
        """
        try:
            # 1. Keychainから読み込み試行
            gmail_token_json = self.keychain_manager.get_password('GMAIL_TOKEN_JSON')
            
            if gmail_token_json:
                self.logger.info("KeychainからGmail認証情報読み込み")
                token_data = json.loads(gmail_token_json)
                
                credentials = Credentials(
                    token=token_data.get('token'),
                    refresh_token=token_data.get('refresh_token'),
                    token_uri=token_data.get('token_uri'),
                    client_id=token_data.get('client_id'),
                    client_secret=token_data.get('client_secret'),
                    scopes=token_data.get('scopes')
                )
                
                return credentials
            
            # 2. ファイルから読み込み（フォールバック）
            if self.token_file.exists():
                self.logger.info("ファイルからGmail認証情報読み込み")
                
                with open(self.token_file, 'r', encoding='utf-8') as f:
                    token_data = json.load(f)
                
                credentials = Credentials(
                    token=token_data.get('token'),
                    refresh_token=token_data.get('refresh_token'),
                    token_uri=token_data.get('token_uri'),
                    client_id=token_data.get('client_id'),
                    client_secret=token_data.get('client_secret'),
                    scopes=token_data.get('scopes')
                )
                
                return credentials
            
            self.logger.warning("Gmail認証情報が見つかりません")
            return None
            
        except Exception as e:
            self.logger.error(f"Gmail認証情報読み込みエラー: {e}")
            return None
    
    def refresh_credentials(self) -> bool:
        """
        認証情報更新
        
        Returns:
            bool: 更新成功時True
        """
        try:
            self.logger.info("Gmail認証情報更新開始")
            
            credentials = self.load_credentials()
            if not credentials:
                self.logger.error("更新対象の認証情報が見つかりません")
                return False
            
            if credentials.expired and credentials.refresh_token:
                # トークン更新
                credentials.refresh(Request())
                
                # 更新された認証情報を保存
                success = self.save_credentials(credentials)
                
                if success:
                    self.logger.info("Gmail認証情報更新成功")
                    return True
                else:
                    self.logger.error("更新後の認証情報保存失敗")
                    return False
            else:
                self.logger.info("Gmail認証情報は有効です（更新不要）")
                return True
                
        except Exception as e:
            self.logger.error(f"Gmail認証情報更新エラー: {e}")
            return False
    
    def save_credentials(self, credentials: Credentials) -> bool:
        """
        認証情報保存（Keychainとファイル両方）
        
        Args:
            credentials (Credentials): 保存する認証情報
        
        Returns:
            bool: 保存成功時True
        """
        try:
            # 認証情報をJSON形式に変換
            token_data = {
                'token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'token_uri': credentials.token_uri,
                'client_id': credentials.client_id,
                'client_secret': credentials.client_secret,
                'scopes': credentials.scopes
            }
            
            # Keychainに保存
            token_json_str = json.dumps(token_data)
            keychain_success = self.keychain_manager.add_password(
                'GMAIL_TOKEN_JSON', 
                token_json_str
            )
            
            # ファイルにバックアップ保存
            with open(self.token_file, 'w', encoding='utf-8') as f:
                json.dump(token_data, f, indent=2, ensure_ascii=False)
            
            # ファイル権限設定
            os.chmod(self.token_file, 0o600)
            
            if keychain_success:
                self.logger.info("Gmail認証情報をKeychainとファイルに保存成功")
                return True
            else:
                self.logger.warning("Keychain保存失敗、ファイル保存のみ成功")
                return True  # ファイル保存成功なので継続
                
        except Exception as e:
            self.logger.error(f"Gmail認証情報保存エラー: {e}")
            return False
    
    def test_gmail_service(self) -> bool:
        """
        Gmail サービステスト
        
        Returns:
            bool: テスト成功時True
        """
        try:
            credentials = self.load_credentials()
            if not credentials:
                self.logger.error("Gmail認証情報が見つかりません")
                return False
            
            # Gmail APIサービス構築
            service = build('gmail', 'v1', credentials=credentials)
            
            # プロフィール取得テスト
            profile = service.users().getProfile(userId='me').execute()
            
            email_address = profile.get('emailAddress')
            self.logger.info(f"Gmailサービステスト成功: {email_address}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"Gmailサービステストエラー: {e}")
            return False
    
    def revoke_credentials(self) -> bool:
        """
        認証情報取り消し
        
        Returns:
            bool: 取り消し成功時True
        """
        try:
            self.logger.info("Gmail認証情報取り消し開始")
            
            credentials = self.load_credentials()
            if credentials and credentials.token:
                # Googleに対してトークン無効化要求
                import httpx
                
                revoke_url = "https://oauth2.googleapis.com/revoke"
                params = {'token': credentials.token}
                
                response = httpx.post(revoke_url, params=params, timeout=30)
                if response.status_code == 200:
                    self.logger.info("Googleトークン無効化成功")
                else:
                    self.logger.warning(f"Googleトークン無効化失敗: {response.status_code}")
            
            # Keychainから削除
            keychain_success = self.keychain_manager.delete_password('GMAIL_TOKEN_JSON')
            
            # ファイル削除
            file_success = True
            if self.token_file.exists():
                try:
                    self.token_file.unlink()
                except Exception as e:
                    self.logger.error(f"トークンファイル削除エラー: {e}")
                    file_success = False
            
            if keychain_success and file_success:
                self.logger.info("Gmail認証情報取り消し完了")
                return True
            else:
                self.logger.warning("Gmail認証情報取り消し部分的成功")
                return True
                
        except Exception as e:
            self.logger.error(f"Gmail認証情報取り消しエラー: {e}")
            return False


class NotionConnectionHelper:
    """Notion接続ヘルパー
    
    Notion APIの接続テストとデータベース検証を行います。
    """
    
    def __init__(self, token: str, database_id: str):
        """
        Notion接続ヘルパー初期化
        
        Args:
            token (str): Notion統合トークン
            database_id (str): データベースID
        """
        self.token = token
        self.database_id = database_id
        self.logger = logging.getLogger(__name__)
    
    async def test_connection(self) -> Dict[str, Any]:
        """
        Notion接続テスト
        
        Returns:
            Dict[str, Any]: テスト結果
        """
        result = {
            'success': False,
            'database_accessible': False,
            'response_time': 0,
            'error': None
        }
        
        try:
            import time
            import httpx
            
            start_time = time.time()
            
            # Notion API テストリクエスト
            test_url = f"https://api.notion.com/v1/databases/{self.database_id}"
            headers = {
                'Authorization': f"Bearer {self.token}",
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
                    result['database_title'] = data.get('title', [{}])[0].get('plain_text', 'Unknown')
                    
                    self.logger.info("Notion接続テスト成功")
                else:
                    result['error'] = f"HTTP {response.status_code}: {response.text}"
                    self.logger.error(f"Notion接続テスト失敗: {result['error']}")
        
        except Exception as e:
            result['error'] = str(e)
            self.logger.error(f"Notion接続テスト例外: {e}")
        
        return result
    
    async def validate_database_structure(self) -> Dict[str, Any]:
        """
        データベース構造検証
        
        Returns:
            Dict[str, Any]: 検証結果
        """
        result = {
            'valid_structure': False,
            'required_properties': [],
            'missing_properties': [],
            'error': None
        }
        
        try:
            import httpx
            
            # 必要なプロパティ
            required_props = {
                '料理名': 'title',
                'YouTube URL': 'url',
                '調理時間': 'number',
                '人数': 'number',
                '難易度': 'select',
                'メイン食材': 'multi_select',
                'チャンネル': 'select',
                '登録日': 'date'
            }
            
            # データベース情報取得
            test_url = f"https://api.notion.com/v1/databases/{self.database_id}"
            headers = {
                'Authorization': f"Bearer {self.token}",
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(test_url, headers=headers, timeout=30)
                
                if response.status_code == 200:
                    data = response.json()
                    properties = data.get('properties', {})
                    
                    # プロパティ存在確認
                    for prop_name, prop_type in required_props.items():
                        if prop_name in properties:
                            actual_type = properties[prop_name].get('type')
                            if actual_type == prop_type:
                                result['required_properties'].append(prop_name)
                            else:
                                result['missing_properties'].append(
                                    f"{prop_name} (期待: {prop_type}, 実際: {actual_type})"
                                )
                        else:
                            result['missing_properties'].append(prop_name)
                    
                    # 構造有効性判定
                    result['valid_structure'] = len(result['missing_properties']) == 0
                    
                    self.logger.info(f"データベース構造検証完了: 有効={result['valid_structure']}")
                else:
                    result['error'] = f"HTTP {response.status_code}: {response.text}"
        
        except Exception as e:
            result['error'] = str(e)
            self.logger.error(f"データベース構造検証エラー: {e}")
        
        return result
    
    async def create_test_page(self) -> Dict[str, Any]:
        """
        テストページ作成
        
        Returns:
            Dict[str, Any]: 作成結果
        """
        result = {
            'success': False,
            'page_id': None,
            'error': None
        }
        
        try:
            import httpx
            import datetime
            
            # テストページデータ
            test_page_data = {
                "parent": {"database_id": self.database_id},
                "properties": {
                    "料理名": {
                        "title": [
                            {
                                "text": {
                                    "content": "テスト料理レシピ"
                                }
                            }
                        ]
                    },
                    "YouTube URL": {
                        "url": "https://www.youtube.com/watch?v=test"
                    },
                    "調理時間": {
                        "number": 30
                    },
                    "人数": {
                        "number": 4
                    },
                    "難易度": {
                        "select": {
                            "name": "初級"
                        }
                    },
                    "メイン食材": {
                        "multi_select": [
                            {"name": "牛肉"},
                            {"name": "テスト"}
                        ]
                    },
                    "チャンネル": {
                        "select": {
                            "name": "テストチャンネル"
                        }
                    },
                    "登録日": {
                        "date": {
                            "start": datetime.datetime.now().isoformat()
                        }
                    }
                }
            }
            
            # ページ作成リクエスト
            create_url = "https://api.notion.com/v1/pages"
            headers = {
                'Authorization': f"Bearer {self.token}",
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    create_url, 
                    json=test_page_data, 
                    headers=headers, 
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    result['success'] = True
                    result['page_id'] = data.get('id')
                    
                    self.logger.info(f"テストページ作成成功: {result['page_id']}")
                else:
                    result['error'] = f"HTTP {response.status_code}: {response.text}"
                    self.logger.error(f"テストページ作成失敗: {result['error']}")
        
        except Exception as e:
            result['error'] = str(e)
            self.logger.error(f"テストページ作成例外: {e}")
        
        return result
    
    async def cleanup_test_data(self, page_id: str) -> bool:
        """
        テストデータクリーンアップ
        
        Args:
            page_id (str): 削除するページID
        
        Returns:
            bool: 削除成功時True
        """
        try:
            import httpx
            
            # ページアーカイブ（削除）
            archive_url = f"https://api.notion.com/v1/pages/{page_id}"
            headers = {
                'Authorization': f"Bearer {self.token}",
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            }
            
            archive_data = {"archived": True}
            
            async with httpx.AsyncClient() as client:
                response = await client.patch(
                    archive_url, 
                    json=archive_data, 
                    headers=headers, 
                    timeout=30
                )
                
                if response.status_code == 200:
                    self.logger.info(f"テストページ削除成功: {page_id}")
                    return True
                else:
                    self.logger.error(f"テストページ削除失敗: HTTP {response.status_code}")
                    return False
        
        except Exception as e:
            self.logger.error(f"テストページ削除例外: {e}")
            return False


# 使用例
def example_usage():
    """OAuth認証ヘルパーの使用例"""
    
    from pathlib import Path
    
    # 設定ディレクトリ
    config_dir = Path.home() / "Developer" / "tasty-recipe-monitor" / "config"
    
    # Keychain管理クラス
    keychain_manager = MacOSKeychainManager()
    
    # Gmail OAuth認証ヘルパー
    gmail_oauth = GmailOAuthHelper(config_dir, keychain_manager)
    
    # 認証情報読み込みテスト
    credentials = gmail_oauth.load_credentials()
    print(f"Gmail認証情報: {'設定済み' if credentials else '未設定'}")
    
    # Gmailサービステスト
    if credentials:
        test_result = gmail_oauth.test_gmail_service()
        print(f"Gmailサービステスト: {'成功' if test_result else '失敗'}")


if __name__ == "__main__":
    import asyncio
    logging.basicConfig(level=logging.INFO)
    
    # 使用例実行
    example_usage()