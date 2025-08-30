#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pytest Configuration
PersonalCookingRecipe - 3チャンネル統合レシピ監視システム

テストフレームワークの共通設定とフィクスチャを定義します。
"""

import os
import sys
import pytest
import asyncio
import tempfile
import logging
from pathlib import Path
from typing import Generator, Dict, Any
from unittest.mock import Mock, AsyncMock

# プロジェクトのモジュールをテストパスに追加
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "config"))

# テストマーカー定義
pytest_plugins = []

def pytest_configure(config):
    """pytest設定"""
    # カスタムマーカー登録
    config.addinivalue_line(
        "markers", "integration: 実際のAPI接続テスト（認証情報必要）"
    )
    config.addinivalue_line(
        "markers", "slow: 時間のかかるテスト（パフォーマンステスト等）"
    )
    config.addinivalue_line(
        "markers", "macos: macOS固有機能テスト"
    )
    config.addinivalue_line(
        "markers", "security: セキュリティ関連テスト"
    )
    config.addinivalue_line(
        "markers", "ui: UI関連テスト"
    )
    config.addinivalue_line(
        "markers", "e2e: エンドツーエンドテスト"
    )

@pytest.fixture(scope="session")
def event_loop():
    """セッションレベルのイベントループ"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
def test_config_dir():
    """テスト用設定ディレクトリ"""
    with tempfile.TemporaryDirectory(prefix="test_recipe_monitor_") as temp_dir:
        config_dir = Path(temp_dir) / "config"
        config_dir.mkdir(parents=True, exist_ok=True)
        yield config_dir

@pytest.fixture
def mock_keychain_manager():
    """モックKeychainManagerフィクスチャ"""
    from keychain_manager import MacOSKeychainManager
    
    mock_manager = Mock(spec=MacOSKeychainManager)
    mock_manager.add_password.return_value = True
    mock_manager.get_password.return_value = "mock_api_key"
    mock_manager.delete_password.return_value = True
    mock_manager.health_check.return_value = {
        'keychain_accessible': True,
        'service_available': True,
        'credentials_count': 5,
        'last_check': '2024-01-01T12:00:00',
        'errors': []
    }
    mock_manager.retrieve_all_credentials.return_value = {
        'YOUTUBE_API_KEY': 'mock_youtube_key',
        'CLAUDE_API_KEY': 'sk-mock_claude_key',
        'NOTION_TOKEN': 'secret_mock_notion_token',
        'NOTION_DATABASE_ID': 'mock_database_id'
    }
    return mock_manager

@pytest.fixture
def mock_api_manager():
    """モックAPIManagerフィクスチャ"""
    from api_manager import APIManager
    
    mock_manager = Mock(spec=APIManager)
    mock_manager.get_youtube_credentials.return_value = "mock_youtube_key"
    mock_manager.get_claude_credentials.return_value = "sk-mock_claude_key" 
    mock_manager.get_notion_credentials.return_value = {
        'token': 'secret_mock_notion_token',
        'database_id': 'mock_database_id'
    }
    mock_manager.get_gmail_credentials.return_value = Mock()
    mock_manager.validate_all_credentials.return_value = {
        'youtube': True,
        'claude': True,
        'notion': True,
        'gmail': True,
        'all_valid': True
    }
    return mock_manager

@pytest.fixture
def sample_youtube_response():
    """サンプルYouTube APIレスポンス"""
    return {
        "items": [
            {
                "id": "UC8C7QblJwCHsYrftuLjGKig",
                "snippet": {
                    "title": "Sam The Cooking Guy",
                    "description": "Cooking videos and recipes",
                    "thumbnails": {
                        "default": {
                            "url": "https://example.com/thumbnail.jpg"
                        }
                    }
                }
            }
        ]
    }

@pytest.fixture
def sample_claude_response():
    """サンプルClaude APIレスポンス"""
    return {
        "content": [
            {
                "type": "text",
                "text": "これは美味しそうなレシピですね！"
            }
        ],
        "model": "claude-3-5-sonnet-20241022",
        "usage": {
            "input_tokens": 10,
            "output_tokens": 25
        }
    }

@pytest.fixture
def sample_notion_response():
    """サンプルNotion APIレスポンス"""
    return {
        "object": "database",
        "id": "mock_database_id",
        "title": [
            {
                "type": "text",
                "text": {
                    "content": "Recipe Database"
                }
            }
        ],
        "properties": {
            "Name": {
                "id": "title",
                "type": "title"
            },
            "URL": {
                "id": "url",
                "type": "url"
            },
            "Channel": {
                "id": "select",
                "type": "select"
            }
        }
    }

@pytest.fixture
def test_logger():
    """テスト用ログ設定"""
    logger = logging.getLogger("test_recipe_monitor")
    logger.setLevel(logging.DEBUG)
    
    # 既存のハンドラーをクリア
    logger.handlers.clear()
    
    # テスト用ハンドラー追加
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        '%(asctime)s - TEST - %(levelname)s - %(message)s'
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    
    return logger

@pytest.fixture
def mock_http_responses():
    """モックHTTPレスポンスのコレクション"""
    return {
        'youtube_success': Mock(status_code=200, json=lambda: {
            "items": [{"snippet": {"title": "Test Video"}}]
        }),
        'claude_success': Mock(status_code=200, json=lambda: {
            "content": [{"text": "Test response"}]
        }),
        'notion_success': Mock(status_code=200, json=lambda: {
            "object": "database",
            "title": [{"plain_text": "Test Database"}]
        }),
        'error_401': Mock(status_code=401, text="Unauthorized"),
        'error_403': Mock(status_code=403, text="Forbidden"),
        'error_500': Mock(status_code=500, text="Internal Server Error"),
        'timeout_error': Mock(side_effect=asyncio.TimeoutError("Request timeout"))
    }

@pytest.fixture
def temp_files():
    """テスト用一時ファイル管理"""
    files = []
    
    def create_temp_file(content="", suffix=".txt", prefix="test_"):
        """一時ファイル作成"""
        temp_file = tempfile.NamedTemporaryFile(
            mode='w',
            suffix=suffix,
            prefix=prefix,
            delete=False,
            encoding='utf-8'
        )
        temp_file.write(content)
        temp_file.close()
        
        file_path = Path(temp_file.name)
        files.append(file_path)
        return file_path
    
    yield create_temp_file
    
    # クリーンアップ
    for file_path in files:
        try:
            if file_path.exists():
                file_path.unlink()
        except Exception:
            pass

@pytest.fixture
def performance_monitor():
    """パフォーマンス監視用フィクスチャ"""
    import time
    import psutil
    import threading
    
    class PerformanceMonitor:
        def __init__(self):
            self.start_time = None
            self.end_time = None
            self.start_memory = None
            self.end_memory = None
            self.peak_memory = None
            self.monitoring = False
            self._monitor_thread = None
        
        def start(self):
            self.start_time = time.time()
            self.start_memory = psutil.Process().memory_info().rss
            self.peak_memory = self.start_memory
            self.monitoring = True
            self._monitor_thread = threading.Thread(target=self._monitor_memory)
            self._monitor_thread.start()
        
        def stop(self):
            self.end_time = time.time()
            self.end_memory = psutil.Process().memory_info().rss
            self.monitoring = False
            if self._monitor_thread:
                self._monitor_thread.join()
        
        def _monitor_memory(self):
            while self.monitoring:
                current_memory = psutil.Process().memory_info().rss
                self.peak_memory = max(self.peak_memory, current_memory)
                time.sleep(0.1)
        
        @property
        def elapsed_time(self):
            if self.start_time and self.end_time:
                return self.end_time - self.start_time
            return None
        
        @property
        def memory_usage(self):
            if self.start_memory and self.end_memory:
                return self.end_memory - self.start_memory
            return None
        
        @property
        def peak_memory_usage(self):
            if self.start_memory and self.peak_memory:
                return self.peak_memory - self.start_memory
            return None
    
    return PerformanceMonitor()

@pytest.fixture
def security_test_data():
    """セキュリティテスト用データ"""
    return {
        'sql_injection_payloads': [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "'; INSERT INTO users VALUES('hacker'); --",
            "' UNION SELECT * FROM sensitive_data --"
        ],
        'xss_payloads': [
            "<script>alert('XSS')</script>",
            "javascript:alert('XSS')",
            "<img src=x onerror=alert('XSS')>",
            "<svg onload=alert('XSS')>"
        ],
        'file_inclusion_payloads': [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
            "/etc/shadow",
            "C:\\Windows\\System32\\config\\SAM"
        ],
        'command_injection_payloads': [
            "; cat /etc/passwd",
            "| ls -la",
            "&& rm -rf /",
            "; echo 'pwned' > /tmp/test"
        ]
    }

class TestDataFactory:
    """テストデータファクトリー"""
    
    @staticmethod
    def create_recipe_data(title="Test Recipe", channel="Test Channel", url="https://example.com"):
        """レシピデータ生成"""
        return {
            "title": title,
            "channel": channel,
            "url": url,
            "description": f"Description for {title}",
            "duration": "10:30",
            "thumbnail": "https://example.com/thumb.jpg",
            "published_at": "2024-01-01T12:00:00Z",
            "view_count": 1000,
            "like_count": 50
        }
    
    @staticmethod
    def create_api_credentials():
        """テスト用API認証情報生成"""
        return {
            "YOUTUBE_API_KEY": "AIza_test_youtube_key_12345",
            "CLAUDE_API_KEY": "sk-test_claude_key_67890", 
            "NOTION_TOKEN": "secret_test_notion_token_abcde",
            "NOTION_DATABASE_ID": "12345678-1234-1234-1234-123456789abc",
            "GMAIL_CLIENT_ID": "test_gmail_client_id",
            "GMAIL_CLIENT_SECRET": "test_gmail_client_secret"
        }
    
    @staticmethod
    def create_keychain_health():
        """Keychainヘルスチェックデータ生成"""
        return {
            "keychain_accessible": True,
            "service_available": True,
            "credentials_count": 6,
            "last_check": "2024-01-01T12:00:00",
            "errors": []
        }

@pytest.fixture
def test_data_factory():
    """テストデータファクトリーフィクスチャ"""
    return TestDataFactory

# グローバルテスト設定
def pytest_collection_modifyitems(config, items):
    """テストアイテムの修正"""
    for item in items:
        # 統合テストマークの自動追加
        if "integration" in item.nodeid or "real_" in item.name:
            item.add_marker(pytest.mark.integration)
        
        # 低速テストマークの自動追加
        if "performance" in item.name or "load" in item.name:
            item.add_marker(pytest.mark.slow)
        
        # macOSテストマークの自動追加
        if "keychain" in item.name or "launchdaemon" in item.name:
            item.add_marker(pytest.mark.macos)

def pytest_runtest_setup(item):
    """テスト実行前セットアップ"""
    # macOSでないプラットフォームではmacOSテストをスキップ
    if item.get_closest_marker("macos") and sys.platform != "darwin":
        pytest.skip("macOS専用テストです")
    
    # 統合テストの条件チェック
    if item.get_closest_marker("integration"):
        # 環境変数または設定ファイルで統合テスト有効化を確認
        if not os.getenv("RUN_INTEGRATION_TESTS"):
            pytest.skip("統合テストが無効です。RUN_INTEGRATION_TESTS=1 で有効化してください")

# テストレポート設定
def pytest_terminal_summary(terminalreporter, exitstatus, config):
    """テスト結果サマリー"""
    if hasattr(terminalreporter, '_session'):
        session = terminalreporter._session
        if hasattr(session, 'testscollected'):
            print(f"\n📊 テスト実行統計:")
            print(f"   収集されたテスト: {session.testscollected}")
            print(f"   実行結果: {terminalreporter.stats}")