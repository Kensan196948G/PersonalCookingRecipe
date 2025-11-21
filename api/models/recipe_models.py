#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
レシピ関連データモデル定義
Pydantic v2使用による厳格な型定義

Author: Recipe-DevUI Agent
Date: 2025-08-08
"""

from pydantic import BaseModel, Field, ConfigDict, validator
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime
from enum import Enum
import uuid

# ==============================================================================
# 基本データモデル
# ==============================================================================

class ChannelType(str, Enum):
    """監視対象チャンネル種別"""
    SAM_COOKING = "sam_cooking"
    TASTY = "tasty"
    JOSHUA = "joshua"

class DifficultyLevel(int, Enum):
    """レシピ難易度レベル"""
    BEGINNER = 1
    EASY = 2
    MEDIUM = 3
    HARD = 4
    EXPERT = 5

class VideoData(BaseModel):
    """YouTube動画データ"""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid"
    )
    
    video_id: str = Field(..., description="YouTube動画ID", min_length=11, max_length=11)
    title: str = Field(..., description="動画タイトル", min_length=1, max_length=500)
    description: str = Field(..., description="動画説明")
    channel_id: str = Field(..., description="チャンネルID")
    channel_name: str = Field(..., description="チャンネル名")
    published_at: datetime = Field(..., description="公開日時")
    duration: str = Field(..., description="動画時間（ISO8601形式）")
    thumbnail_url: str = Field(..., description="サムネイルURL")
    view_count: int = Field(0, description="再生数", ge=0)
    like_count: int = Field(0, description="高評価数", ge=0)
    url: str = Field(..., description="YouTube URL")

    @validator('video_id')
    def validate_video_id(cls, v):
        if not v.replace('-', '').replace('_', '').isalnum():
            raise ValueError('Invalid YouTube video ID format')
        return v

class Recipe(BaseModel):
    """レシピデータモデル"""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid"
    )
    
    # 基本情報
    recipe_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="レシピ一意ID")
    source_video: VideoData = Field(..., description="元動画データ")
    
    # 日本語化データ
    title_ja: str = Field(..., description="日本語タイトル", min_length=1, max_length=200)
    description_ja: str = Field(..., description="日本語説明", max_length=2000)
    
    # レシピ構造化データ
    ingredients: List[str] = Field(..., description="材料リスト", min_items=1)
    instructions: List[str] = Field(..., description="手順リスト", min_items=1)
    
    # メタデータ
    cooking_time: Optional[str] = Field(None, description="調理時間")
    difficulty: DifficultyLevel = Field(DifficultyLevel.MEDIUM, description="難易度（1-5）")
    tags: List[str] = Field(default_factory=list, description="タグリスト")
    category: str = Field("肉料理", description="カテゴリ")
    
    # 品質・処理情報
    quality_score: float = Field(..., description="品質スコア", ge=0.0, le=1.0)
    processed_at: datetime = Field(default_factory=datetime.utcnow, description="処理日時")
    
    # 外部連携情報
    notion_url: Optional[str] = Field(None, description="NotionページURL")
    notion_page_id: Optional[str] = Field(None, description="NotionページID")
    
    # チャンネル特定
    channel: ChannelType = Field(..., description="チャンネル種別")

    @validator('ingredients')
    def validate_ingredients(cls, v):
        if not all(len(ingredient.strip()) > 0 for ingredient in v):
            raise ValueError('All ingredients must be non-empty')
        return [ingredient.strip() for ingredient in v]
    
    @validator('instructions')  
    def validate_instructions(cls, v):
        if not all(len(instruction.strip()) > 0 for instruction in v):
            raise ValueError('All instructions must be non-empty')
        return [instruction.strip() for instruction in v]

class RecipeFilters(BaseModel):
    """レシピフィルタリング条件"""
    model_config = ConfigDict(extra="forbid")
    
    channel: Optional[ChannelType] = None
    search_query: Optional[str] = Field(None, max_length=100)
    difficulty: Optional[DifficultyLevel] = None
    min_quality_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    tags: Optional[List[str]] = None
    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0)

# ==============================================================================
# システム状態モデル
# ==============================================================================

class SystemHealth(str, Enum):
    """システムヘルス状態"""
    HEALTHY = "healthy"
    WARNING = "warning"
    ERROR = "error"
    MAINTENANCE = "maintenance"

class APIStatus(BaseModel):
    """API接続状態"""
    name: str = Field(..., description="API名")
    status: SystemHealth = Field(..., description="接続状態")
    last_check: datetime = Field(..., description="最終確認時刻")
    response_time: Optional[float] = Field(None, description="応答時間（秒）")
    error_message: Optional[str] = Field(None, description="エラーメッセージ")

class SystemMetrics(BaseModel):
    """システムメトリクス"""
    cpu_usage: float = Field(..., description="CPU使用率", ge=0.0, le=100.0)
    memory_usage: float = Field(..., description="メモリ使用率", ge=0.0, le=100.0)  
    disk_usage: float = Field(..., description="ディスク使用率", ge=0.0, le=100.0)
    network_in: float = Field(0.0, description="ネットワーク受信(MB/s)", ge=0.0)
    network_out: float = Field(0.0, description="ネットワーク送信(MB/s)", ge=0.0)

class SystemStatus(BaseModel):
    """システム全体状態"""
    overall_health: SystemHealth = Field(..., description="全体ヘルス状態")
    uptime_seconds: int = Field(..., description="稼働時間（秒）", ge=0)
    last_updated: datetime = Field(default_factory=datetime.utcnow, description="最終更新時刻")
    
    # API状態
    api_status: List[APIStatus] = Field(default_factory=list, description="API接続状態一覧")
    
    # システムメトリクス
    metrics: SystemMetrics = Field(..., description="システムメトリクス")
    
    # 処理統計
    total_recipes: int = Field(0, description="総レシピ数", ge=0)
    today_processed: int = Field(0, description="今日の処理数", ge=0)
    success_rate: float = Field(0.0, description="成功率", ge=0.0, le=100.0)
    
    # エラー情報
    recent_errors: List[str] = Field(default_factory=list, description="最近のエラー")

class ChannelStats(BaseModel):
    """チャンネル統計情報"""
    channel: ChannelType = Field(..., description="チャンネル種別")
    channel_name: str = Field(..., description="チャンネル名")
    total_recipes: int = Field(0, description="総レシピ数", ge=0)
    today_added: int = Field(0, description="今日追加分", ge=0)
    avg_quality_score: float = Field(0.0, description="平均品質スコア", ge=0.0, le=1.0)
    last_processed: Optional[datetime] = Field(None, description="最終処理日時")
    success_rate: float = Field(0.0, description="処理成功率", ge=0.0, le=100.0)
    
    # 週間統計
    weekly_trend: List[int] = Field(default_factory=list, description="週間追加数推移")

# ==============================================================================
# ダッシュボード用集計モデル
# ==============================================================================

class DashboardSummary(BaseModel):
    """ダッシュボード表示用サマリー"""
    total_recipes: int = Field(0, description="総レシピ数", ge=0)
    today_processed: int = Field(0, description="今日処理数", ge=0)
    weekly_processed: int = Field(0, description="週間処理数", ge=0)
    avg_processing_time: float = Field(0.0, description="平均処理時間（分）", ge=0.0)
    
    # 品質統計
    high_quality_count: int = Field(0, description="高品質レシピ数（>0.8）", ge=0)
    avg_quality_score: float = Field(0.0, description="平均品質スコア", ge=0.0, le=1.0)
    
    # チャンネル別統計
    channel_distribution: Dict[str, int] = Field(default_factory=dict, description="チャンネル別分布")
    
    # 最近の活動
    recent_recipes: List[Recipe] = Field(default_factory=list, description="最近のレシピ（最大5件）")
    
    # トレンド情報
    daily_trend: List[Dict[str, Any]] = Field(default_factory=list, description="日別処理トレンド")

# ==============================================================================
# バリデーション用ヘルパー
# ==============================================================================

class RecipeValidation:
    """レシピデータバリデーション補助クラス"""
    
    @staticmethod
    def validate_youtube_url(url: str) -> bool:
        """YouTube URL形式チェック"""
        valid_patterns = [
            "youtube.com/watch?v=",
            "youtu.be/",
            "youtube.com/embed/"
        ]
        return any(pattern in url for pattern in valid_patterns)
    
    @staticmethod
    def validate_notion_url(url: str) -> bool:
        """Notion URL形式チェック"""
        return url.startswith("https://www.notion.so/") or url.startswith("https://notion.so/")
    
    @staticmethod
    def extract_video_id(url: str) -> Optional[str]:
        """YouTube URLからビデオIDを抽出"""
        import re
        
        patterns = [
            r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([^&\n?#]+)',
            r'youtube\.com/watch\?.*v=([^&\n?#]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None