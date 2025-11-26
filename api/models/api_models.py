#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API共通データモデル定義
レスポンス形式、ログ、設定等の汎用モデル

Author: Recipe-DevUI Agent
Date: 2025-08-08
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Generic, TypeVar, Optional, Dict, Any, List, Union, Literal
from datetime import datetime
from enum import Enum

# ==============================================================================
# 汎用型変数
# ==============================================================================

T = TypeVar('T')

# ==============================================================================
# API レスポンスモデル
# ==============================================================================

class APIResponse(BaseModel, Generic[T]):
    """標準APIレスポンス形式"""
    model_config = ConfigDict(
        extra="forbid",
        validate_assignment=True
    )
    
    data: T = Field(..., description="レスポンスデータ")
    status: Literal["success", "error"] = Field(..., description="処理状態")
    message: Optional[str] = Field(None, description="メッセージ")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat(), description="タイムスタンプ")
    request_id: Optional[str] = Field(None, description="リクエストID（トレーシング用）")

class ErrorResponse(BaseModel):
    """エラーレスポンス形式"""
    error_code: str = Field(..., description="エラーコード")
    error_message: str = Field(..., description="エラーメッセージ")
    details: Optional[Dict[str, Any]] = Field(None, description="エラー詳細情報")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    request_id: Optional[str] = Field(None, description="リクエストID")

class PaginationMeta(BaseModel):
    """ページネーション情報"""
    total_count: int = Field(..., description="総件数", ge=0)
    page_size: int = Field(..., description="ページサイズ", ge=1)
    current_page: int = Field(..., description="現在ページ", ge=1)
    total_pages: int = Field(..., description="総ページ数", ge=1)
    has_next: bool = Field(..., description="次ページ存在フラグ")
    has_previous: bool = Field(..., description="前ページ存在フラグ")

class PaginatedResponse(BaseModel, Generic[T]):
    """ページネーション付きレスポンス"""
    items: List[T] = Field(..., description="データアイテム一覧")
    meta: PaginationMeta = Field(..., description="ページネーション情報")

# ==============================================================================
# ログ関連モデル  
# ==============================================================================

class LogLevel(str, Enum):
    """ログレベル定義"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class LogComponent(str, Enum):
    """ログコンポーネント種別"""
    SYSTEM = "system"
    YOUTUBE = "youtube"
    CLAUDE = "claude"
    NOTION = "notion"
    GMAIL = "gmail"
    API = "api"
    SCHEDULER = "scheduler"
    KEYCHAIN = "keychain"

class LogEntry(BaseModel):
    """ログエントリ"""
    model_config = ConfigDict(
        extra="forbid",
        validate_assignment=True
    )
    
    id: Optional[str] = Field(None, description="ログID")
    timestamp: datetime = Field(..., description="ログ出力時刻")
    level: LogLevel = Field(..., description="ログレベル")
    component: LogComponent = Field(..., description="コンポーネント")
    message: str = Field(..., description="ログメッセージ", min_length=1, max_length=1000)
    
    # 詳細情報（構造化データ）
    metadata: Optional[Dict[str, Any]] = Field(None, description="メタデータ")
    
    # エラー情報
    exception_type: Optional[str] = Field(None, description="例外種別")
    stack_trace: Optional[str] = Field(None, description="スタックトレース")
    
    # 関連情報
    user_id: Optional[str] = Field(None, description="ユーザーID")
    session_id: Optional[str] = Field(None, description="セッションID")
    request_id: Optional[str] = Field(None, description="リクエストID")

class LogFilters(BaseModel):
    """ログフィルタリング条件"""
    model_config = ConfigDict(extra="forbid")
    
    level: Optional[LogLevel] = None
    component: Optional[LogComponent] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    search_query: Optional[str] = Field(None, max_length=100)
    limit: int = Field(100, ge=1, le=1000)
    offset: int = Field(0, ge=0)

# ==============================================================================
# 設定関連モデル
# ==============================================================================

class ChannelConfig(BaseModel):
    """チャンネル設定"""
    channel_id: str = Field(..., description="チャンネルID")
    channel_name: str = Field(..., description="チャンネル名")
    enabled: bool = Field(True, description="監視有効フラグ")
    priority: int = Field(1, description="優先度（1-5）", ge=1, le=5)
    check_interval: int = Field(3600, description="チェック間隔（秒）", ge=300)
    keywords: List[str] = Field(default_factory=list, description="検索キーワード")
    exclude_keywords: List[str] = Field(default_factory=list, description="除外キーワード")

class MonitoringConfig(BaseModel):
    """監視設定"""
    enabled: bool = Field(True, description="監視有効フラグ")
    check_interval: int = Field(3600, description="基本チェック間隔（秒）")
    max_videos_per_run: int = Field(20, description="1回あたり最大処理動画数")
    quality_threshold: float = Field(0.6, description="品質スコア閾値", ge=0.0, le=1.0)
    retry_attempts: int = Field(3, description="リトライ回数", ge=1, le=10)
    timeout_seconds: int = Field(300, description="タイムアウト（秒）", ge=30)

class NotificationConfig(BaseModel):
    """通知設定"""
    email_enabled: bool = Field(True, description="メール通知有効フラグ")
    macos_notification_enabled: bool = Field(True, description="macOS通知有効フラグ")
    notification_levels: List[LogLevel] = Field(
        default_factory=lambda: [LogLevel.ERROR, LogLevel.CRITICAL],
        description="通知対象ログレベル"
    )
    email_recipients: List[str] = Field(default_factory=list, description="通知先メールアドレス")
    daily_summary: bool = Field(True, description="日次サマリー送信フラグ")

class APISettings(BaseModel):
    """API設定（機密情報は除く）"""
    youtube_quota_limit: int = Field(10000, description="YouTube APIクォータ上限")
    claude_model: str = Field("claude-3-haiku-20240307", description="使用Claudeモデル")
    claude_max_tokens: int = Field(1000, description="Claude最大トークン数")
    notion_page_template: str = Field("default", description="Notionページテンプレート")
    request_timeout: int = Field(30, description="APIリクエストタイムアウト（秒）")

class SystemConfig(BaseModel):
    """システム全体設定"""
    model_config = ConfigDict(
        extra="forbid",
        validate_assignment=True
    )
    
    channels: List[ChannelConfig] = Field(..., description="チャンネル設定一覧")
    monitoring: MonitoringConfig = Field(..., description="監視設定")
    notification: NotificationConfig = Field(..., description="通知設定")
    api_settings: APISettings = Field(..., description="API設定")
    
    # システム設定
    log_level: LogLevel = Field(LogLevel.INFO, description="ログレベル")
    data_retention_days: int = Field(180, description="データ保持期間（日）", ge=30)
    backup_enabled: bool = Field(True, description="バックアップ有効フラグ")
    
    # 更新情報
    last_updated: datetime = Field(default_factory=datetime.utcnow, description="最終更新日時")
    updated_by: str = Field("system", description="更新者")

# ==============================================================================
# WebSocket関連モデル
# ==============================================================================

class WebSocketMessage(BaseModel):
    """WebSocketメッセージ基底クラス"""
    type: str = Field(..., description="メッセージタイプ")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class LogWebSocketMessage(WebSocketMessage):
    """ログ用WebSocketメッセージ"""
    type: Literal["new_log"] = "new_log"
    data: LogEntry = Field(..., description="ログデータ")

class SystemWebSocketMessage(WebSocketMessage):
    """システム状態用WebSocketメッセージ"""
    type: Literal["health_update", "metrics_update"] = Field(..., description="更新タイプ")
    data: Dict[str, Any] = Field(..., description="システムデータ")

class NotificationWebSocketMessage(WebSocketMessage):
    """通知用WebSocketメッセージ"""
    type: Literal["notification"] = "notification"
    level: LogLevel = Field(..., description="通知レベル")
    title: str = Field(..., description="通知タイトル")
    message: str = Field(..., description="通知メッセージ")
    data: Optional[Dict[str, Any]] = Field(None, description="追加データ")

# ==============================================================================
# バリデーション・変換ヘルパー
# ==============================================================================

class ValidationHelper:
    """バリデーション補助関数群"""
    
    @staticmethod
    def is_valid_email(email: str) -> bool:
        """メールアドレス形式検証"""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None
    
    @staticmethod
    def sanitize_log_message(message: str) -> str:
        """ログメッセージサニタイズ（機密情報除去）"""
        # APIキーやトークンなどの機密情報をマスキング
        import re
        
        patterns = [
            (r'api[_-]?key["\s]*[:=]["\s]*([a-zA-Z0-9]{20,})', r'api_key="***"'),
            (r'token["\s]*[:=]["\s]*([a-zA-Z0-9.-]{20,})', r'token="***"'),
            (r'password["\s]*[:=]["\s]*([^\s"]+)', r'password="***"'),
            (r'secret["\s]*[:=]["\s]*([^\s"]+)', r'secret="***"')
        ]
        
        sanitized = message
        for pattern, replacement in patterns:
            sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)
        
        return sanitized
    
    @staticmethod
    def format_duration(seconds: float) -> str:
        """秒数を読みやすい形式に変換"""
        if seconds < 60:
            return f"{seconds:.1f}秒"
        elif seconds < 3600:
            minutes = seconds / 60
            return f"{minutes:.1f}分"
        else:
            hours = seconds / 3600
            return f"{hours:.1f}時間"