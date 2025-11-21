#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Linux認証情報管理クラス（環境変数 + 暗号化ファイル）
PersonalCookingRecipe - 3チャンネル統合レシピ監視システム

このモジュールはLinux環境で安全にAPI認証情報を保存・取得する機能を提供します。
環境変数を優先し、暗号化されたファイルをフォールバックとして使用します。
"""

import os
import json
import logging
from typing import Optional, Dict, Any, List
from pathlib import Path
from cryptography.fernet import Fernet
import base64
import hashlib
import stat


class LinuxCredentialsManager:
    """
    Linux認証情報管理クラス
    
    API認証情報を環境変数と暗号化ファイルで安全に保存・取得・削除する機能を提供します。
    環境変数を優先し、暗号化ファイルをフォールバックとして使用します。
    """
    
    def __init__(self, service_name: str = "personal-cooking-recipe", config_dir: Optional[Path] = None):
        """
        Linux認証管理クラスの初期化
        
        Args:
            service_name (str): サービス識別名
            config_dir (Path): 設定ディレクトリパス
        """
        self.service_name = service_name
        self.config_dir = config_dir or Path.home() / ".config" / service_name
        self.config_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        
        # 暗号化ファイルのパス
        self.credentials_file = self.config_dir / "credentials.enc"
        self.key_file = self.config_dir / "key.enc"
        
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.INFO)
        
        # ログハンドラーの設定
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
        
        # 暗号化キーの初期化
        self._initialize_encryption()
        
        self.logger.info(f"LinuxCredentialsManager初期化完了: サービス名={service_name}")
    
    def _initialize_encryption(self) -> None:
        """
        暗号化キーの初期化
        キーファイルが存在しない場合は新規作成
        """
        try:
            if not self.key_file.exists():
                # 新しい暗号化キーを生成
                key = Fernet.generate_key()
                # キーファイルに保存（600権限）
                with open(self.key_file, 'wb') as f:
                    f.write(key)
                os.chmod(self.key_file, stat.S_IRUSR | stat.S_IWUSR)  # 600
                self.logger.info("New encryption key created")
            
            # キーを読み込み
            with open(self.key_file, 'rb') as f:
                key = f.read()
            self.cipher = Fernet(key)
            
        except Exception as e:
            self.logger.error(f"Failed to initialize encryption: {e}")
            raise
    
    def _load_encrypted_credentials(self) -> Dict[str, str]:
        """
        暗号化ファイルから認証情報を読み込み
        
        Returns:
            Dict[str, str]: 復号化された認証情報
        """
        try:
            if not self.credentials_file.exists():
                return {}
            
            with open(self.credentials_file, 'rb') as f:
                encrypted_data = f.read()
            
            decrypted_data = self.cipher.decrypt(encrypted_data)
            credentials = json.loads(decrypted_data.decode('utf-8'))
            
            return credentials
            
        except Exception as e:
            self.logger.error(f"Failed to load encrypted credentials: {e}")
            return {}
    
    def _save_encrypted_credentials(self, credentials: Dict[str, str]) -> bool:
        """
        認証情報を暗号化してファイルに保存
        
        Args:
            credentials (Dict[str, str]): 保存する認証情報
            
        Returns:
            bool: 保存成功時True
        """
        try:
            # JSONシリアライズして暗号化
            json_data = json.dumps(credentials, ensure_ascii=False, indent=2)
            encrypted_data = self.cipher.encrypt(json_data.encode('utf-8'))
            
            # ファイルに保存（600権限）
            with open(self.credentials_file, 'wb') as f:
                f.write(encrypted_data)
            os.chmod(self.credentials_file, stat.S_IRUSR | stat.S_IWUSR)  # 600
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to save encrypted credentials: {e}")
            return False
    
    def store_credential(self, account: str, credential: str) -> bool:
        """
        認証情報を保存（環境変数優先、暗号化ファイルにバックアップ）
        
        Args:
            account (str): アカウント名（例: "YOUTUBE_API_KEY"）
            credential (str): 認証情報/API キー
            
        Returns:
            bool: 保存に成功した場合True
        """
        try:
            # 環境変数に設定
            env_key = f"{self.service_name.upper().replace('-', '_')}_{account}"
            os.environ[env_key] = credential
            
            # 暗号化ファイルにもバックアップ保存
            credentials_data = self._load_encrypted_credentials()
            credentials_data[account] = credential
            self._save_encrypted_credentials(credentials_data)
            
            self.logger.info(f"Credential stored for account: {account}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to store credential for {account}: {e}")
            return False
    
    def get_credential(self, account: str) -> Optional[str]:
        """
        認証情報を取得（環境変数優先、暗号化ファイルをフォールバック）
        
        Args:
            account (str): アカウント名
            
        Returns:
            Optional[str]: 認証情報、見つからない場合はNone
        """
        try:
            # まず環境変数を確認
            env_key = f"{self.service_name.upper().replace('-', '_')}_{account}"
            credential = os.environ.get(env_key)
            
            if credential:
                self.logger.debug(f"Credential retrieved from environment variable: {account}")
                return credential
            
            # 環境変数にない場合は暗号化ファイルから取得
            credentials_data = self._load_encrypted_credentials()
            credential = credentials_data.get(account)
            
            if credential:
                self.logger.debug(f"Credential retrieved from encrypted file: {account}")
                return credential
            
            self.logger.warning(f"Credential not found for account: {account}")
            return None
            
        except Exception as e:
            self.logger.error(f"Failed to retrieve credential for {account}: {e}")
            return None
    
    def delete_credential(self, account: str) -> bool:
        """
        認証情報を削除（環境変数と暗号化ファイル両方から）
        
        Args:
            account (str): アカウント名
            
        Returns:
            bool: 削除に成功した場合True
        """
        try:
            # 環境変数から削除
            env_key = f"{self.service_name.upper().replace('-', '_')}_{account}"
            if env_key in os.environ:
                del os.environ[env_key]
            
            # 暗号化ファイルからも削除
            credentials_data = self._load_encrypted_credentials()
            if account in credentials_data:
                del credentials_data[account]
                self._save_encrypted_credentials(credentials_data)
            
            self.logger.info(f"Credential deleted for account: {account}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to delete credential for {account}: {e}")
            return False
    
    def list_accounts(self) -> Dict[str, bool]:
        """
        保存されている認証情報一覧を取得
        
        Returns:
            Dict[str, bool]: アカウント名と存在状況の辞書
        """
        accounts = {
            "YOUTUBE_API_KEY": False,
            "CLAUDE_API_KEY": False,
            "NOTION_TOKEN": False,
            "NOTION_DATABASE_ID": False,
            "GMAIL_CLIENT_ID": False,
            "GMAIL_CLIENT_SECRET": False,
            "GMAIL_REFRESH_TOKEN": False
        }
        
        # 各アカウントの存在確認
        for account in accounts.keys():
            try:
                credential = self.get_credential(account)
                accounts[account] = credential is not None
            except Exception:
                accounts[account] = False
        
        return accounts
    
    def store_api_credentials(self, api_credentials: Dict[str, str]) -> bool:
        """
        全API認証情報を一括保存
        
        Args:
            api_credentials (Dict[str, str]): API認証情報の辞書
        
        Returns:
            bool: 全て成功時True、一つでも失敗時False
        """
        success_count = 0
        total_count = len(api_credentials)
        
        self.logger.info(f"API認証情報一括保存開始: {total_count}件")
        
        for key, value in api_credentials.items():
            if value and value.strip():  # 空でない値のみ保存
                if self.store_credential(key, value):
                    success_count += 1
                    self.logger.info(f"保存成功: {key}")
                else:
                    self.logger.error(f"保存失敗: {key}")
            else:
                self.logger.warning(f"空の値のため保存スキップ: {key}")
        
        success_rate = success_count / total_count if total_count > 0 else 0
        self.logger.info(f"API認証情報保存完了: {success_count}/{total_count} ({success_rate:.1%})")
        
        return success_count == total_count
    
    def retrieve_all_credentials(self) -> Dict[str, str]:
        """
        全認証情報を取得
        
        Returns:
            Dict[str, str]: 取得された認証情報の辞書
        """
        # 認識されているAPI Key名のリスト
        known_keys = [
            'YOUTUBE_API_KEY',
            'CLAUDE_API_KEY', 
            'NOTION_TOKEN',
            'NOTION_DATABASE_ID',
            'GMAIL_CLIENT_ID',
            'GMAIL_CLIENT_SECRET',
            'GMAIL_REFRESH_TOKEN'
        ]
        
        credentials = {}
        
        self.logger.info("全認証情報取得開始")
        
        for key in known_keys:
            credential = self.get_credential(key)
            if credential:
                credentials[key] = credential
                self.logger.debug(f"取得成功: {key}")
            else:
                self.logger.warning(f"取得失敗または未設定: {key}")
        
        self.logger.info(f"認証情報取得完了: {len(credentials)}/{len(known_keys)}件")
        return credentials
    
    def migrate_from_env_file(self, env_file: Path) -> bool:
        """
        環境変数ファイルから暗号化ストレージへ移行
        
        Args:
            env_file (Path): 環境変数ファイルのパス
        
        Returns:
            bool: 移行成功時True、失敗時False
        """
        try:
            if not env_file.exists():
                self.logger.error(f"環境変数ファイルが見つかりません: {env_file}")
                return False
            
            self.logger.info(f"環境変数ファイルから移行開始: {env_file}")
            
            # .envファイル読み込み
            env_vars = {}
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip().strip('"\'')  # クオート除去
                        
                        # API認証情報のみ対象
                        if any(api_key in key for api_key in ['API_KEY', 'TOKEN', 'CLIENT_ID', 'CLIENT_SECRET']):
                            env_vars[key] = value
            
            # 暗号化ストレージに保存
            if env_vars:
                success = self.store_api_credentials(env_vars)
                if success:
                    self.logger.info(f"移行成功: {len(env_vars)}件")
                    return True
                else:
                    self.logger.error("移行中にエラーが発生")
                    return False
            else:
                self.logger.warning("移行対象のAPI認証情報が見つかりません")
                return False
                
        except Exception as e:
            self.logger.error(f"移行例外: {e}")
            return False
    
    def export_to_env_format(self) -> str:
        """
        認証情報を環境変数形式でエクスポート（開発・デバッグ用）
        
        Returns:
            str: 環境変数形式の文字列（値は一部マスク）
        """
        credentials = self.retrieve_all_credentials()
        
        env_lines = [
            "# API認証情報 (暗号化ストレージからエクスポート)",
            "# ⚠️ この情報は機密です。共有・コミットしないでください",
            ""
        ]
        
        for key, value in credentials.items():
            # 値の一部をマスク（デバッグ用）
            if len(value) > 8:
                masked_value = value[:4] + "*" * (len(value) - 8) + value[-4:]
            else:
                masked_value = "*" * len(value)
            
            env_lines.append(f"{key}={masked_value}")
        
        env_content = "\n".join(env_lines)
        
        self.logger.info("環境変数形式エクスポート完了（マスク済み）")
        return env_content
    
    def health_check(self) -> Dict[str, Any]:
        """
        認証システムヘルスチェック
        
        Returns:
            Dict[str, Any]: ヘルスチェック結果
        """
        health_result = {
            'storage_accessible': False,
            'encryption_working': False,
            'credentials_count': 0,
            'config_dir_permissions': None,
            'last_check': None,
            'errors': []
        }
        
        try:
            # 設定ディレクトリの権限確認
            dir_stat = self.config_dir.stat()
            health_result['config_dir_permissions'] = oct(dir_stat.st_mode)[-3:]
            
            # テスト用の値でストレージ操作テスト
            test_account = 'HEALTH_CHECK_TEST'
            test_credential = 'test_value_123'
            
            # 書き込みテスト
            if self.store_credential(test_account, test_credential):
                health_result['storage_accessible'] = True
                
                # 読み込みテスト
                retrieved = self.get_credential(test_account)
                if retrieved == test_credential:
                    health_result['encryption_working'] = True
                
                # テストデータクリーンアップ
                self.delete_credential(test_account)
            
            # 実際の認証情報数をカウント
            credentials = self.retrieve_all_credentials()
            health_result['credentials_count'] = len(credentials)
            
            import datetime
            health_result['last_check'] = datetime.datetime.now().isoformat()
            
            self.logger.info(f"認証システムヘルスチェック完了: OK={health_result['encryption_working']}")
            
        except Exception as e:
            error_msg = f"認証システムヘルスチェック例外: {e}"
            health_result['errors'].append(error_msg)
            self.logger.error(error_msg)
        
        return health_result
    
    def secure_cleanup(self) -> bool:
        """
        セキュアクリーンアップ（テストデータや古い認証情報を削除）
        
        Returns:
            bool: クリーンアップ成功時True
        """
        try:
            self.logger.info("認証システムセキュアクリーンアップ開始")
            
            # 削除対象のパターン
            cleanup_patterns = [
                'TEST_',
                'TEMP_',
                'OLD_',
                'BACKUP_',
                'HEALTH_CHECK_'
            ]
            
            credentials_data = self._load_encrypted_credentials()
            cleanup_count = 0
            
            # パターンマッチする項目を削除
            keys_to_delete = []
            for key in credentials_data.keys():
                for pattern in cleanup_patterns:
                    if key.startswith(pattern):
                        keys_to_delete.append(key)
                        break
            
            for key in keys_to_delete:
                if self.delete_credential(key):
                    cleanup_count += 1
            
            self.logger.info(f"認証システムクリーンアップ完了: {cleanup_count}件削除")
            return True
            
        except Exception as e:
            self.logger.error(f"認証システムクリーンアップ例外: {e}")
            return False


# 使用例とテスト関数
def example_usage():
    """認証管理クラスの使用例"""
    
    # 認証管理クラスの初期化
    creds_manager = LinuxCredentialsManager()
    
    # API認証情報の保存例
    api_credentials = {
        'YOUTUBE_API_KEY': 'your_youtube_api_key_here',
        'CLAUDE_API_KEY': 'your_claude_api_key_here',
        'NOTION_TOKEN': 'your_notion_token_here'
    }
    
    # 一括保存
    success = creds_manager.store_api_credentials(api_credentials)
    print(f"一括保存結果: {success}")
    
    # 個別取得
    youtube_key = creds_manager.get_credential('YOUTUBE_API_KEY')
    print(f"YouTube API Key: {'設定済み' if youtube_key else '未設定'}")
    
    # 全認証情報取得
    all_credentials = creds_manager.retrieve_all_credentials()
    print(f"保存されている認証情報数: {len(all_credentials)}")
    
    # ヘルスチェック
    health = creds_manager.health_check()
    print(f"認証システムヘルス: {health}")


if __name__ == "__main__":
    # ログレベル設定
    logging.basicConfig(level=logging.INFO)
    
    # 使用例実行
    example_usage()