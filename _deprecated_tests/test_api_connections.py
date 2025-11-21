#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API接続テスト
PersonalCookRecipe - 3チャンネル統合レシピ監視システム

このモジュールは全API（YouTube、Claude、Notion、Gmail）の接続テストと
macOS Keychain統合テストを提供します。
"""

import os
import sys
import asyncio
import pytest
import logging
import json
import tempfile
from pathlib import Path
from typing import Dict, Any, List, Optional
from unittest.mock import Mock, patch, AsyncMock

# プロジェクトのモジュールをインポート
sys.path.append(str(Path(__file__).parent.parent / "config"))

try:
    from api_manager import APIManager, APIConnectionTester
    from keychain_manager import MacOSKeychainManager
    from oauth_helper import GmailOAuthHelper, NotionConnectionHelper
except ImportError as e:
    print(f"❌ インポートエラー: {e}")
    print("config/内の必要なモジュールが見つかりません。")
    sys.exit(1)


class TestAPIConnections:
    """API接続統合テストクラス
    
    全API（YouTube、Claude、Notion、Gmail）の接続テストと
    macOS Keychain統合テストを実行します。
    """
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """テスト前セットアップ"""
        # ログ設定
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        # テスト用ディレクトリ
        self.test_base_dir = Path.home() / "Developer" / "tasty-recipe-monitor"
        self.test_config_dir = self.test_base_dir / "config"
        self.test_config_dir.mkdir(parents=True, exist_ok=True)
        
        # テスト用APIマネージャー初期化
        self.api_manager = APIManager(self.test_config_dir)
        self.connection_tester = APIConnectionTester(self.api_manager)
        self.keychain_manager = MacOSKeychainManager()
        
        self.logger.info("テストセットアップ完了")
    
    def test_keychain_manager_basic_operations(self):
        """Keychain管理クラスの基本操作テスト"""
        test_account = "TEST_API_KEY"
        test_password = "test_password_12345"
        
        try:
            # 既存のテストデータクリーンアップ
            self.keychain_manager.delete_password(test_account)
            
            # 書き込みテスト
            success = self.keychain_manager.add_password(test_account, test_password)
            assert success, "Keychainへの書き込みが失敗しました"
            
            # 読み込みテスト
            retrieved_password = self.keychain_manager.get_password(test_account)
            assert retrieved_password == test_password, "Keychainからの読み込み結果が一致しません"
            
            # 削除テスト
            delete_success = self.keychain_manager.delete_password(test_account)
            assert delete_success, "Keychainからの削除が失敗しました"
            
            # 削除確認
            deleted_password = self.keychain_manager.get_password(test_account)
            assert deleted_password is None, "削除後にパスワードが残っています"
            
            self.logger.info("✅ Keychain基本操作テスト成功")
            
        except Exception as e:
            # クリーンアップ
            self.keychain_manager.delete_password(test_account)
            pytest.fail(f"Keychain基本操作テスト失敗: {e}")
    
    def test_keychain_health_check(self):
        """Keychainヘルスチェックテスト"""
        health_result = self.keychain_manager.health_check()
        
        # 必須フィールドの存在確認
        required_fields = ['keychain_accessible', 'service_available', 'credentials_count', 'last_check']
        for field in required_fields:
            assert field in health_result, f"ヘルスチェック結果に{field}が含まれていません"
        
        # Keychainアクセス可能性確認
        assert health_result['keychain_accessible'] is True, "Keychainにアクセスできません"
        
        self.logger.info("✅ Keychainヘルスチェックテスト成功")
    
    def test_api_manager_initialization(self):
        """APIマネージャー初期化テスト"""
        assert self.api_manager is not None, "APIマネージャーの初期化が失敗しました"
        assert hasattr(self.api_manager, 'keychain_manager'), "Keychain管理クラスが初期化されていません"
        assert hasattr(self.api_manager, 'api_keys'), "API認証情報が初期化されていません"
        
        self.logger.info("✅ APIマネージャー初期化テスト成功")
    
    def test_api_credentials_validation(self):
        """API認証情報検証テスト"""
        validation_results = self.api_manager.validate_all_credentials()
        
        # 検証結果の構造確認
        expected_apis = ['youtube', 'claude', 'notion', 'gmail', 'all_valid']
        for api in expected_apis:
            assert api in validation_results, f"{api} APIの検証結果がありません"
        
        self.logger.info(f"API認証情報検証結果: {validation_results}")
        self.logger.info("✅ API認証情報検証テスト成功")
    
    @pytest.mark.asyncio
    async def test_youtube_api_connection(self):
        """YouTube API接続テスト"""
        # モック使用による接続テスト
        with patch('httpx.AsyncClient') as mock_client:
            # モックレスポンス設定
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'items': [{'snippet': {'title': 'Test Channel'}}]
            }
            
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            # 実際のAPI Keyが設定されている場合のみ実際のテスト実行
            youtube_key = self.api_manager.get_youtube_credentials()
            if youtube_key:
                result = await self.connection_tester.test_youtube_connection()
                
                # 結果検証
                assert 'success' in result, "YouTube APIテスト結果にsuccessフィールドがありません"
                assert 'response_time' in result, "YouTube APIテスト結果にresponse_timeフィールドがありません"
                
                if result['success']:
                    self.logger.info("✅ YouTube API接続テスト成功")
                else:
                    self.logger.warning(f"⚠️ YouTube API接続テスト失敗: {result.get('error', '不明なエラー')}")
            else:
                self.logger.info("⏭️ YouTube API Keyが未設定のためテストスキップ")
    
    @pytest.mark.asyncio
    async def test_claude_api_connection(self):
        """Claude API接続テスト"""
        # モック使用による接続テスト
        with patch('httpx.AsyncClient') as mock_client:
            # モックレスポンス設定
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'content': [{'text': 'テスト応答'}]
            }
            
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            
            # 実際のAPI Keyが設定されている場合のみ実際のテスト実行
            claude_key = self.api_manager.get_claude_credentials()
            if claude_key:
                result = await self.connection_tester.test_claude_connection()
                
                # 結果検証
                assert 'success' in result, "Claude APIテスト結果にsuccessフィールドがありません"
                assert 'response_time' in result, "Claude APIテスト結果にresponse_timeフィールドがありません"
                
                if result['success']:
                    self.logger.info("✅ Claude API接続テスト成功")
                else:
                    self.logger.warning(f"⚠️ Claude API接続テスト失敗: {result.get('error', '不明なエラー')}")
            else:
                self.logger.info("⏭️ Claude API Keyが未設定のためテストスキップ")
    
    @pytest.mark.asyncio
    async def test_notion_api_connection(self):
        """Notion API接続テスト"""
        # モック使用による接続テスト
        with patch('httpx.AsyncClient') as mock_client:
            # モックレスポンス設定
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'object': 'database',
                'title': [{'plain_text': 'Test Database'}]
            }
            
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            # 実際の認証情報が設定されている場合のみ実際のテスト実行
            notion_creds = self.api_manager.get_notion_credentials()
            if notion_creds['token'] and notion_creds['database_id']:
                result = await self.connection_tester.test_notion_connection()
                
                # 結果検証
                assert 'success' in result, "Notion APIテスト結果にsuccessフィールドがありません"
                assert 'response_time' in result, "Notion APIテスト結果にresponse_timeフィールドがありません"
                
                if result['success']:
                    self.logger.info("✅ Notion API接続テスト成功")
                else:
                    self.logger.warning(f"⚠️ Notion API接続テスト失敗: {result.get('error', '不明なエラー')}")
            else:
                self.logger.info("⏭️ Notion認証情報が未設定のためテストスキップ")
    
    @pytest.mark.asyncio
    async def test_gmail_api_connection(self):
        """Gmail API接続テスト"""
        # モック使用による接続テスト
        with patch('googleapiclient.discovery.build') as mock_build:
            # モックサービス設定
            mock_service = Mock()
            mock_profile = {'emailAddress': 'test@example.com'}
            mock_service.users().getProfile().execute.return_value = mock_profile
            mock_build.return_value = mock_service
            
            # 実際の認証情報が設定されている場合のみ実際のテスト実行
            gmail_creds = self.api_manager.get_gmail_credentials()
            if gmail_creds:
                result = await self.connection_tester.test_gmail_connection()
                
                # 結果検証
                assert 'success' in result, "Gmail APIテスト結果にsuccessフィールドがありません"
                assert 'credentials_valid' in result, "Gmail APIテスト結果にcredentials_validフィールドがありません"
                
                if result['success']:
                    self.logger.info("✅ Gmail API接続テスト成功")
                else:
                    self.logger.warning(f"⚠️ Gmail API接続テスト失敗: {result.get('error', '不明なエラー')}")
            else:
                self.logger.info("⏭️ Gmail認証情報が未設定のためテストスキップ")
    
    @pytest.mark.asyncio
    async def test_all_apis_integration(self):
        """全API統合テスト"""
        results = await self.connection_tester.test_all_connections()
        
        # 結果構造確認
        expected_apis = ['youtube', 'claude', 'notion', 'gmail']
        for api in expected_apis:
            assert api in results, f"{api} APIのテスト結果がありません"
            assert 'success' in results[api], f"{api} APIの結果にsuccessフィールドがありません"
        
        # 成功率計算
        successful_tests = sum(1 for result in results.values() if result['success'])
        total_tests = len(results)
        success_rate = successful_tests / total_tests if total_tests > 0 else 0
        
        self.logger.info(f"全API統合テスト結果: {successful_tests}/{total_tests} ({success_rate:.1%})")
        
        # レポート生成テスト
        report = self.connection_tester.generate_test_report(results)
        assert isinstance(report, str), "テストレポートが文字列で生成されていません"
        assert len(report) > 100, "テストレポートが短すぎます"
        
        self.logger.info("✅ 全API統合テスト成功")
    
    def test_keychain_integration(self):
        """Keychain統合テスト"""
        # API認証情報の保存・取得テスト
        test_credentials = {
            'TEST_YOUTUBE_KEY': 'test_youtube_api_key_12345',
            'TEST_CLAUDE_KEY': 'sk-test_claude_key_67890',
            'TEST_NOTION_TOKEN': 'secret_test_notion_token_abcde'
        }
        
        try:
            # 一括保存テスト
            save_success = self.keychain_manager.store_api_credentials(test_credentials)
            assert save_success, "Keychainへの一括保存が失敗しました"
            
            # 一括取得テスト
            retrieved_credentials = self.keychain_manager.retrieve_all_credentials()
            
            # 保存した認証情報が取得できることを確認
            for key, value in test_credentials.items():
                assert key in retrieved_credentials, f"{key}がKeychainから取得できません"
                assert retrieved_credentials[key] == value, f"{key}の値が一致しません"
            
            self.logger.info("✅ Keychain統合テスト成功")
            
        finally:
            # テストデータクリーンアップ
            for key in test_credentials.keys():
                self.keychain_manager.delete_password(key)
    
    def test_api_key_security(self):
        """API認証情報セキュリティテスト"""
        # ファイル権限確認
        config_files = [
            self.test_config_dir / "api_keys.env",
            self.test_config_dir / "oauth_tokens.json",
            self.test_config_dir / "gmail_token.json"
        ]
        
        for file_path in config_files:
            if file_path.exists():
                # ファイル権限取得（macOS）
                import stat
                file_stat = file_path.stat()
                file_permissions = stat.filemode(file_stat.st_mode)
                
                # 所有者のみ読み書き可能であることを確認（-rw-------）
                assert file_stat.st_mode & 0o077 == 0, f"{file_path}の権限が適切ではありません: {file_permissions}"
                
                self.logger.info(f"✅ {file_path}の権限確認: {file_permissions}")
        
        # Git除外設定確認
        gitignore_path = self.test_base_dir / ".gitignore"
        if gitignore_path.exists():
            with open(gitignore_path, 'r', encoding='utf-8') as f:
                gitignore_content = f.read()
            
            # 重要なファイルがGit除外されていることを確認
            security_patterns = [
                "config/api_keys.env",
                "config/*.json",
                "logs/*.log"
            ]
            
            for pattern in security_patterns:
                assert pattern in gitignore_content, f"Git除外設定に{pattern}が含まれていません"
            
            self.logger.info("✅ Git除外設定確認成功")
        
        self.logger.info("✅ API認証情報セキュリティテスト成功")
    
    def test_oauth_helper_initialization(self):
        """OAuth認証ヘルパー初期化テスト"""
        gmail_oauth = GmailOAuthHelper(self.test_config_dir, self.keychain_manager)
        
        assert gmail_oauth is not None, "GmailOAuthHelperの初期化が失敗しました"
        assert hasattr(gmail_oauth, 'keychain_manager'), "Keychain管理クラスが設定されていません"
        assert hasattr(gmail_oauth, 'browser_handler'), "ブラウザハンドラーが初期化されていません"
        
        self.logger.info("✅ OAuth認証ヘルパー初期化テスト成功")
    
    @pytest.mark.asyncio
    async def test_notion_connection_helper(self):
        """Notion接続ヘルパーテスト"""
        # テスト用の認証情報（実際の値でなくても構造テストのため）
        test_token = "secret_test_token_12345"
        test_database_id = "12345678-1234-1234-1234-123456789abc"
        
        notion_helper = NotionConnectionHelper(test_token, test_database_id)
        
        # モック使用による接続テスト
        with patch('httpx.AsyncClient') as mock_client:
            # モックレスポンス設定
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'object': 'database',
                'title': [{'plain_text': 'Test Database'}]
            }
            
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            # 接続テスト実行
            result = await notion_helper.test_connection()
            
            # 結果検証
            assert 'success' in result, "Notion接続テスト結果にsuccessフィールドがありません"
            assert 'database_accessible' in result, "Notion接続テスト結果にdatabase_accessibleフィールドがありません"
            
            self.logger.info("✅ Notion接続ヘルパーテスト成功")
    
    def test_api_status_monitoring(self):
        """API状態監視テスト"""
        api_status = self.api_manager.get_api_status()
        
        # 必要なフィールドの存在確認
        required_fields = [
            'keychain_health',
            'credentials_validation',
            'total_keys',
            'oauth_tokens',
            'config_files'
        ]
        
        for field in required_fields:
            assert field in api_status, f"API状態に{field}フィールドがありません"
        
        # Keychainヘルス状態確認
        keychain_health = api_status['keychain_health']
        assert isinstance(keychain_health, dict), "Keychainヘルス情報が辞書形式ではありません"
        assert 'keychain_accessible' in keychain_health, "Keychainアクセス可能性情報がありません"
        
        self.logger.info(f"API状態監視結果: {api_status}")
        self.logger.info("✅ API状態監視テスト成功")


class TestRealAPIConnections:
    """実際のAPI接続テスト（認証情報が設定されている場合のみ）
    
    このクラスは実際のAPI認証情報が設定されている場合に
    本物のAPI接続テストを実行します。
    """
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """実API接続テスト前セットアップ"""
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        self.test_config_dir = Path.home() / "Developer" / "tasty-recipe-monitor" / "config"
        self.api_manager = APIManager(self.test_config_dir)
        self.connection_tester = APIConnectionTester(self.api_manager)
        
        # 認証情報の存在確認
        self.credentials_available = self._check_credentials_availability()
        
        if not any(self.credentials_available.values()):
            pytest.skip("実際のAPI認証情報が設定されていないため、実API接続テストをスキップします")
    
    def _check_credentials_availability(self) -> Dict[str, bool]:
        """実際の認証情報の利用可能性確認"""
        return {
            'youtube': bool(self.api_manager.get_youtube_credentials()),
            'claude': bool(self.api_manager.get_claude_credentials()),
            'notion': bool(self.api_manager.get_notion_credentials()['token']),
            'gmail': bool(self.api_manager.get_gmail_credentials())
        }
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_real_youtube_api(self):
        """実際のYouTube API接続テスト"""
        if not self.credentials_available['youtube']:
            pytest.skip("YouTube API認証情報が未設定")
        
        result = await self.connection_tester.test_youtube_connection()
        
        if result['success']:
            self.logger.info("🎉 実YouTube API接続テスト成功")
            assert result['quota_used'] > 0, "クォータ使用量が記録されていません"
        else:
            self.logger.error(f"❌ 実YouTube API接続テスト失敗: {result.get('error')}")
            pytest.fail(f"YouTube API接続テスト失敗: {result.get('error')}")
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_real_claude_api(self):
        """実際のClaude API接続テスト"""
        if not self.credentials_available['claude']:
            pytest.skip("Claude API認証情報が未設定")
        
        result = await self.connection_tester.test_claude_connection()
        
        if result['success']:
            self.logger.info("🎉 実Claude API接続テスト成功")
            assert result['model_available'] is not None, "利用可能モデル情報がありません"
        else:
            self.logger.error(f"❌ 実Claude API接続テスト失敗: {result.get('error')}")
            pytest.fail(f"Claude API接続テスト失敗: {result.get('error')}")
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_real_notion_api(self):
        """実際のNotion API接続テスト"""
        if not self.credentials_available['notion']:
            pytest.skip("Notion API認証情報が未設定")
        
        result = await self.connection_tester.test_notion_connection()
        
        if result['success']:
            self.logger.info("🎉 実Notion API接続テスト成功")
            assert result['database_accessible'], "データベースにアクセスできません"
        else:
            self.logger.error(f"❌ 実Notion API接続テスト失敗: {result.get('error')}")
            pytest.fail(f"Notion API接続テスト失敗: {result.get('error')}")
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_real_gmail_api(self):
        """実際のGmail API接続テスト"""
        if not self.credentials_available['gmail']:
            pytest.skip("Gmail API認証情報が未設定")
        
        result = await self.connection_tester.test_gmail_connection()
        
        if result['success']:
            self.logger.info("🎉 実Gmail API接続テスト成功")
            assert result['credentials_valid'], "Gmail認証情報が無効です"
        else:
            self.logger.error(f"❌ 実Gmail API接続テスト失敗: {result.get('error')}")
            pytest.fail(f"Gmail API接続テスト失敗: {result.get('error')}")


def run_comprehensive_test():
    """包括的なテスト実行"""
    print("=== PersonalCookRecipe API接続テスト実行 ===")
    
    # テスト実行
    pytest_args = [
        __file__,
        "-v",
        "--tb=short",
        "--strict-markers",
        "-m", "not integration"  # デフォルトでは統合テストを除外
    ]
    
    # 統合テスト実行確認
    import sys
    if "--integration" in sys.argv:
        print("統合テスト（実API接続）も含めて実行します")
        pytest_args = [arg for arg in pytest_args if arg != "not integration"]
        pytest_args.extend(["-m", "integration or not integration"])
    
    return pytest.main(pytest_args)


if __name__ == "__main__":
    # ログ設定
    logging.basicConfig(level=logging.INFO)
    
    # 単体実行時は包括的テストを実行
    exit_code = run_comprehensive_test()
    sys.exit(exit_code)