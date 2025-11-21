#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
レシピサービス - データ取得・管理を担当
既存のJSONファイルとの統合、検索・フィルタリング機能

Author: Recipe-DevUI Agent
Date: 2025-08-08
"""

import json
import asyncio
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
import logging

from models.recipe_models import (
    Recipe, RecipeFilters, ChannelStats, ChannelType, 
    DashboardSummary, VideoData, DifficultyLevel
)

logger = logging.getLogger(__name__)

class RecipeService:
    """レシピデータ管理サービス"""
    
    def __init__(self, data_dir: Optional[Path] = None):
        """初期化"""
        self.data_dir = data_dir or Path("../data")
        self.data_dir.mkdir(exist_ok=True)
        
        # データファイルパス
        self.processed_videos_file = self.data_dir / "processed_videos.json"
        self.failed_videos_file = self.data_dir / "failed_videos.json"
        self.metrics_file = self.data_dir / "metrics.json"
        
        # キャッシュ
        self._recipe_cache: List[Recipe] = []
        self._cache_last_updated: Optional[datetime] = None
        self._cache_ttl = timedelta(minutes=5)
        
        logger.info(f"🍳 RecipeService initialized with data_dir: {self.data_dir}")
    
    async def _load_recipes_from_file(self) -> List[Recipe]:
        """ファイルからレシピデータを読み込み"""
        try:
            if not self.processed_videos_file.exists():
                logger.warning("processed_videos.json not found, returning empty list")
                return []
            
            with open(self.processed_videos_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            recipes = []
            for video_id, video_data in data.items():
                try:
                    recipe = self._convert_to_recipe_model(video_id, video_data)
                    if recipe:
                        recipes.append(recipe)
                except Exception as e:
                    logger.error(f"Error converting video {video_id} to recipe: {e}")
            
            logger.info(f"📚 Loaded {len(recipes)} recipes from file")
            return recipes
            
        except Exception as e:
            logger.error(f"Error loading recipes from file: {e}")
            return []
    
    def _convert_to_recipe_model(self, video_id: str, video_data: Dict[str, Any]) -> Optional[Recipe]:
        """JSONデータをRecipeモデルに変換"""
        try:
            # VideoData作成
            video = VideoData(
                video_id=video_id,
                title=video_data.get('title', ''),
                description=video_data.get('description', ''),
                channel_id=video_data.get('channel_id', ''),
                channel_name=video_data.get('channel_name', ''),
                published_at=datetime.fromisoformat(
                    video_data.get('published_at', datetime.now(timezone.utc).isoformat())
                ),
                duration=video_data.get('duration', 'PT0S'),
                thumbnail_url=video_data.get('thumbnail_url', ''),
                view_count=video_data.get('view_count', 0),
                like_count=video_data.get('like_count', 0),
                url=video_data.get('youtube_url', f'https://www.youtube.com/watch?v={video_id}')
            )
            
            # チャンネル種別を判定
            channel_map = {
                'UC8C7QblJwCHsYrftuLjGKig': ChannelType.SAM_COOKING,
                'UCJFp8uSYCjXOMnkUyb3CQ3Q': ChannelType.TASTY,
                'UChBEbMKI1eCcejTtmI32UEw': ChannelType.JOSHUA
            }
            channel = channel_map.get(video.channel_id, ChannelType.SAM_COOKING)
            
            # Recipe作成
            recipe = Recipe(
                recipe_id=video_data.get('recipe_id', video_id),
                source_video=video,
                title_ja=video_data.get('title_ja', video_data.get('title', '')),
                description_ja=video_data.get('description_ja', video_data.get('description', '')),
                ingredients=video_data.get('ingredients', ['材料情報を解析中...']),
                instructions=video_data.get('instructions', ['手順情報を解析中...']),
                cooking_time=video_data.get('cooking_time'),
                difficulty=DifficultyLevel(video_data.get('difficulty', 3)),
                tags=video_data.get('tags', []),
                category=video_data.get('category', '肉料理'),
                quality_score=video_data.get('quality_score', 0.8),
                processed_at=datetime.fromisoformat(
                    video_data.get('processed_at', datetime.now(timezone.utc).isoformat())
                ),
                notion_url=video_data.get('notion_url'),
                notion_page_id=video_data.get('notion_page_id'),
                channel=channel
            )
            
            return recipe
            
        except Exception as e:
            logger.error(f"Error converting video data to recipe: {e}")
            return None
    
    async def _get_cached_recipes(self) -> List[Recipe]:
        """キャッシュされたレシピを取得（必要に応じて更新）"""
        now = datetime.now(timezone.utc)
        
        if (not self._recipe_cache or 
            not self._cache_last_updated or 
            now - self._cache_last_updated > self._cache_ttl):
            
            logger.debug("🔄 Refreshing recipe cache")
            self._recipe_cache = await self._load_recipes_from_file()
            self._cache_last_updated = now
        
        return self._recipe_cache
    
    async def get_recipes(self, filters: RecipeFilters) -> List[Recipe]:
        """フィルタリング条件に基づいてレシピを取得"""
        try:
            recipes = await self._get_cached_recipes()
            
            # フィルタリング適用
            filtered = recipes
            
            # チャンネルフィルタ
            if filters.channel:
                filtered = [r for r in filtered if r.channel == filters.channel]
            
            # 検索クエリフィルタ
            if filters.search_query:
                query = filters.search_query.lower()
                filtered = [
                    r for r in filtered 
                    if (query in r.title_ja.lower() or 
                        query in r.description_ja.lower() or
                        any(query in tag.lower() for tag in r.tags))
                ]
            
            # 難易度フィルタ
            if filters.difficulty:
                filtered = [r for r in filtered if r.difficulty == filters.difficulty]
            
            # 品質スコアフィルタ
            if filters.min_quality_score:
                filtered = [r for r in filtered if r.quality_score >= filters.min_quality_score]
            
            # 日付フィルタ
            if filters.date_from:
                filtered = [r for r in filtered if r.processed_at >= filters.date_from]
            if filters.date_to:
                filtered = [r for r in filtered if r.processed_at <= filters.date_to]
            
            # タグフィルタ
            if filters.tags:
                filtered = [
                    r for r in filtered 
                    if any(tag in r.tags for tag in filters.tags)
                ]
            
            # ソート（最新順）
            filtered.sort(key=lambda r: r.processed_at, reverse=True)
            
            # ページネーション
            start = filters.offset
            end = start + filters.limit
            result = filtered[start:end]
            
            logger.info(f"🔍 Found {len(result)} recipes (filtered from {len(recipes)} total)")
            return result
            
        except Exception as e:
            logger.error(f"Error getting recipes: {e}")
            return []
    
    async def get_recipe_by_id(self, recipe_id: str) -> Optional[Recipe]:
        """レシピIDで特定のレシピを取得"""
        try:
            recipes = await self._get_cached_recipes()
            
            for recipe in recipes:
                if recipe.recipe_id == recipe_id:
                    return recipe
            
            logger.warning(f"Recipe not found: {recipe_id}")
            return None
            
        except Exception as e:
            logger.error(f"Error getting recipe by ID: {e}")
            return None
    
    async def get_dashboard_summary(self) -> DashboardSummary:
        """ダッシュボード用サマリー情報を取得"""
        try:
            recipes = await self._get_cached_recipes()
            
            now = datetime.now(timezone.utc)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            week_start = today_start - timedelta(days=7)
            
            # 基本統計
            total_recipes = len(recipes)
            today_processed = len([r for r in recipes if r.processed_at >= today_start])
            weekly_processed = len([r for r in recipes if r.processed_at >= week_start])
            
            # 品質統計
            if recipes:
                avg_quality = sum(r.quality_score for r in recipes) / len(recipes)
                high_quality_count = len([r for r in recipes if r.quality_score > 0.8])
            else:
                avg_quality = 0.0
                high_quality_count = 0
            
            # チャンネル別分布
            channel_distribution = {}
            for recipe in recipes:
                channel_name = recipe.source_video.channel_name
                channel_distribution[channel_name] = channel_distribution.get(channel_name, 0) + 1
            
            # 最近のレシピ（最大5件）
            recent_recipes = sorted(recipes, key=lambda r: r.processed_at, reverse=True)[:5]
            
            # 日別トレンド（過去7日間）
            daily_trend = []
            for i in range(7):
                date = today_start - timedelta(days=i)
                next_date = date + timedelta(days=1)
                day_count = len([
                    r for r in recipes 
                    if date <= r.processed_at < next_date
                ])
                daily_trend.append({
                    "date": date.isoformat(),
                    "count": day_count
                })
            
            summary = DashboardSummary(
                total_recipes=total_recipes,
                today_processed=today_processed,
                weekly_processed=weekly_processed,
                avg_processing_time=5.2,  # TODO: 実際の処理時間を計算
                high_quality_count=high_quality_count,
                avg_quality_score=avg_quality,
                channel_distribution=channel_distribution,
                recent_recipes=recent_recipes,
                daily_trend=list(reversed(daily_trend))  # 古い順にソート
            )
            
            logger.info(f"📊 Generated dashboard summary: {total_recipes} total recipes")
            return summary
            
        except Exception as e:
            logger.error(f"Error generating dashboard summary: {e}")
            return DashboardSummary()  # 空のサマリーを返す
    
    async def get_channel_statistics(self) -> List[ChannelStats]:
        """チャンネル別統計情報を取得"""
        try:
            recipes = await self._get_cached_recipes()
            
            # チャンネル別にグループ化
            channels: Dict[ChannelType, List[Recipe]] = {}
            for recipe in recipes:
                if recipe.channel not in channels:
                    channels[recipe.channel] = []
                channels[recipe.channel].append(recipe)
            
            now = datetime.now(timezone.utc)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            stats_list = []
            
            for channel_type, channel_recipes in channels.items():
                if not channel_recipes:
                    continue
                
                # 統計計算
                total_recipes = len(channel_recipes)
                today_added = len([r for r in channel_recipes if r.processed_at >= today_start])
                avg_quality = sum(r.quality_score for r in channel_recipes) / total_recipes
                last_processed = max(r.processed_at for r in channel_recipes)
                
                # チャンネル名取得
                channel_name = channel_recipes[0].source_video.channel_name
                
                # 週間トレンド
                weekly_trend = []
                for i in range(7):
                    date = today_start - timedelta(days=i)
                    next_date = date + timedelta(days=1)
                    day_count = len([
                        r for r in channel_recipes 
                        if date <= r.processed_at < next_date
                    ])
                    weekly_trend.append(day_count)
                
                stats = ChannelStats(
                    channel=channel_type,
                    channel_name=channel_name,
                    total_recipes=total_recipes,
                    today_added=today_added,
                    avg_quality_score=avg_quality,
                    last_processed=last_processed,
                    success_rate=95.0,  # TODO: 実際の成功率を計算
                    weekly_trend=list(reversed(weekly_trend))
                )
                
                stats_list.append(stats)
            
            # チャンネルタイプ順にソート
            stats_list.sort(key=lambda s: s.channel.value)
            
            logger.info(f"📈 Generated channel statistics for {len(stats_list)} channels")
            return stats_list
            
        except Exception as e:
            logger.error(f"Error generating channel statistics: {e}")
            return []
    
    async def invalidate_cache(self):
        """キャッシュを無効化"""
        logger.info("🗑️ Invalidating recipe cache")
        self._recipe_cache.clear()
        self._cache_last_updated = None
    
    async def get_total_count(self) -> int:
        """総レシピ数を取得"""
        recipes = await self._get_cached_recipes()
        return len(recipes)