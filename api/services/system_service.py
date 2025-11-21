#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
システムサービス - ヘルスチェック、設定管理、メトリクス収集

Author: Recipe-DevUI Agent
Date: 2025-08-08
"""

import json
import psutil
import asyncio
import aiohttp
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import logging
import socket
from urllib.parse import urlparse

from models.recipe_models import SystemStatus, SystemHealth, SystemMetrics, APIStatus
from models.api_models import SystemConfig, ChannelConfig, MonitoringConfig, NotificationConfig, APISettings, LogLevel

logger = logging.getLogger(__name__)

class SystemService:
    """システム管理サービス"""
    
    def __init__(self, config_dir: Optional[Path] = None):
        """初期化"""
        self.config_dir = config_dir or Path("../config")
        self.config_dir.mkdir(exist_ok=True)
        
        self.config_file = self.config_dir / "system_config.json"
        self.start_time = datetime.now(timezone.utc)
        
        # システム設定キャッシュ
        self._system_config: Optional[SystemConfig] = None
        self._config_last_loaded: Optional[datetime] = None
        
        logger.info(f"⚙️ SystemService initialized with config_dir: {self.config_dir}")
    
    async def get_system_status(self) -> SystemStatus:
        """システム全体の状態を取得"""
        try:
            # システムメトリクス取得
            metrics = await self._get_system_metrics()
            
            # API状態チェック
            api_statuses = await self._check_api_health()
            
            # 全体ヘルス判定
            overall_health = self._determine_overall_health(metrics, api_statuses)
            
            # 稼働時間計算
            uptime = (datetime.now(timezone.utc) - self.start_time).total_seconds()
            
            # レシピ統計（概算）
            total_recipes, today_processed = await self._get_recipe_stats()
            
            status = SystemStatus(
                overall_health=overall_health,
                uptime_seconds=int(uptime),
                last_updated=datetime.now(timezone.utc),
                api_status=api_statuses,
                metrics=metrics,
                total_recipes=total_recipes,
                today_processed=today_processed,
                success_rate=self._calculate_success_rate(),
                recent_errors=await self._get_recent_errors()
            )
            
            logger.debug(f"🏥 System health: {overall_health}")
            return status
            
        except Exception as e:
            logger.error(f"Error getting system status: {e}")
            return SystemStatus(
                overall_health=SystemHealth.ERROR,
                uptime_seconds=0,
                metrics=SystemMetrics(
                    cpu_usage=0.0,
                    memory_usage=0.0,
                    disk_usage=0.0
                ),
                recent_errors=[str(e)]
            )
    
    async def _get_system_metrics(self) -> SystemMetrics:
        """システムメトリクス取得"""
        try:
            # CPU使用率
            cpu_usage = psutil.cpu_percent(interval=1)
            
            # メモリ使用率
            memory = psutil.virtual_memory()
            memory_usage = memory.percent
            
            # ディスク使用率
            disk = psutil.disk_usage('/')
            disk_usage = disk.percent
            
            # ネットワーク統計
            net_io = psutil.net_io_counters()
            network_in = net_io.bytes_recv / (1024 * 1024)  # MB
            network_out = net_io.bytes_sent / (1024 * 1024)  # MB
            
            return SystemMetrics(
                cpu_usage=cpu_usage,
                memory_usage=memory_usage,
                disk_usage=disk_usage,
                network_in=network_in,
                network_out=network_out
            )
            
        except Exception as e:
            logger.error(f"Error getting system metrics: {e}")
            return SystemMetrics(
                cpu_usage=0.0,
                memory_usage=0.0,
                disk_usage=0.0
            )
    
    async def _check_api_health(self) -> List[APIStatus]:
        """外部API接続状態チェック"""
        apis_to_check = [
            {
                "name": "YouTube API",
                "url": "https://www.googleapis.com/youtube/v3/channels",
                "method": "GET"
            },
            {
                "name": "Claude API", 
                "url": "https://api.anthropic.com/v1/messages",
                "method": "OPTIONS"  # OPTIONSで接続確認
            },
            {
                "name": "Notion API",
                "url": "https://api.notion.com/v1/users/me",
                "method": "GET"
            },
            {
                "name": "Gmail API",
                "url": "https://gmail.googleapis.com/gmail/v1/users/me/profile", 
                "method": "GET"
            }
        ]
        
        api_statuses = []
        
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
            for api_info in apis_to_check:
                status = await self._check_single_api(session, api_info)
                api_statuses.append(status)
        
        return api_statuses
    
    async def _check_single_api(self, session: aiohttp.ClientSession, api_info: Dict[str, str]) -> APIStatus:
        """個別API接続チェック"""
        start_time = datetime.now(timezone.utc)
        
        try:
            if api_info["method"] == "GET":
                async with session.get(api_info["url"]) as response:
                    # 認証エラー（401）は接続OKとみなす
                    if response.status in [200, 401, 403]:
                        health = SystemHealth.HEALTHY
                        error_message = None
                    else:
                        health = SystemHealth.WARNING
                        error_message = f"HTTP {response.status}"
                        
            elif api_info["method"] == "OPTIONS":
                async with session.options(api_info["url"]) as response:
                    health = SystemHealth.HEALTHY if response.status < 500 else SystemHealth.WARNING
                    error_message = None if response.status < 500 else f"HTTP {response.status}"
            else:
                # デフォルトはHEADリクエスト
                async with session.head(api_info["url"]) as response:
                    health = SystemHealth.HEALTHY if response.status < 500 else SystemHealth.WARNING
                    error_message = None if response.status < 500 else f"HTTP {response.status}"
                    
        except asyncio.TimeoutError:
            health = SystemHealth.WARNING
            error_message = "タイムアウト"
        except aiohttp.ClientConnectionError:
            health = SystemHealth.ERROR
            error_message = "接続エラー"
        except Exception as e:
            health = SystemHealth.ERROR
            error_message = str(e)
        
        response_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        
        return APIStatus(
            name=api_info["name"],
            status=health,
            last_check=datetime.now(timezone.utc),
            response_time=response_time,
            error_message=error_message
        )
    
    def _determine_overall_health(self, metrics: SystemMetrics, api_statuses: List[APIStatus]) -> SystemHealth:
        """全体ヘルス状態の判定"""
        # システムリソースチェック
        if metrics.cpu_usage > 90 or metrics.memory_usage > 90 or metrics.disk_usage > 95:
            return SystemHealth.ERROR
        elif metrics.cpu_usage > 70 or metrics.memory_usage > 80 or metrics.disk_usage > 85:
            return SystemHealth.WARNING
        
        # APIステータスチェック
        error_apis = [api for api in api_statuses if api.status == SystemHealth.ERROR]
        warning_apis = [api for api in api_statuses if api.status == SystemHealth.WARNING]
        
        if error_apis:
            # 重要なAPIがエラーの場合
            critical_apis = ["YouTube API", "Claude API"]
            if any(api.name in critical_apis for api in error_apis):
                return SystemHealth.ERROR
            else:
                return SystemHealth.WARNING
        elif warning_apis:
            return SystemHealth.WARNING
        
        return SystemHealth.HEALTHY
    
    async def _get_recipe_stats(self) -> tuple[int, int]:
        """レシピ統計の取得（概算）"""
        try:
            # データファイルから概算値を取得
            data_dir = Path("../data")
            processed_file = data_dir / "processed_videos.json"
            
            if not processed_file.exists():
                return 0, 0
            
            with open(processed_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            total_recipes = len(data)
            
            # 今日処理されたレシピ数（簡易計算）
            today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            today_processed = 0
            
            for video_data in data.values():
                try:
                    processed_at = datetime.fromisoformat(
                        video_data.get('processed_at', '2000-01-01T00:00:00Z')
                    )
                    if processed_at >= today_start:
                        today_processed += 1
                except:
                    continue
            
            return total_recipes, today_processed
            
        except Exception as e:
            logger.error(f"Error getting recipe stats: {e}")
            return 0, 0
    
    def _calculate_success_rate(self) -> float:
        """成功率計算（仮実装）"""
        # TODO: 実際のログから成功率を計算
        return 95.0
    
    async def _get_recent_errors(self) -> List[str]:
        """最近のエラーを取得"""
        try:
            # エラーログファイルから最新のエラーを取得
            log_dir = Path("../logs")
            error_file = log_dir / "error.log"
            
            if not error_file.exists():
                return []
            
            # 簡易的に最後の3行を取得
            with open(error_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                recent_lines = lines[-3:] if len(lines) >= 3 else lines
                return [line.strip() for line in recent_lines if line.strip()]
            
        except Exception:
            return []
    
    async def get_system_config(self) -> SystemConfig:
        """システム設定を取得"""
        try:
            # キャッシュチェック
            now = datetime.now(timezone.utc)
            if (self._system_config and self._config_last_loaded and 
                now - self._config_last_loaded < timedelta(minutes=5)):
                return self._system_config
            
            # ファイルから読み込み
            if self.config_file.exists():
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    config = SystemConfig(**data)
            else:
                # デフォルト設定を作成
                config = self._create_default_config()
                await self.update_system_config(config)
            
            self._system_config = config
            self._config_last_loaded = now
            
            logger.info("⚙️ System configuration loaded")
            return config
            
        except Exception as e:
            logger.error(f"Error loading system config: {e}")
            return self._create_default_config()
    
    async def update_system_config(self, config: SystemConfig) -> bool:
        """システム設定を更新"""
        try:
            config.last_updated = datetime.now(timezone.utc)
            config.updated_by = "webui"
            
            # ファイルに保存
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config.model_dump(), f, ensure_ascii=False, indent=2, default=str)
            
            # キャッシュ更新
            self._system_config = config
            self._config_last_loaded = datetime.now(timezone.utc)
            
            logger.info("💾 System configuration updated")
            return True
            
        except Exception as e:
            logger.error(f"Error updating system config: {e}")
            return False
    
    def _create_default_config(self) -> SystemConfig:
        """デフォルトシステム設定を作成"""
        return SystemConfig(
            channels=[
                ChannelConfig(
                    channel_id="UC8C7QblJwCHsYrftuLjGKig",
                    channel_name="SAM THE COOKING GUY",
                    enabled=True,
                    priority=3,
                    check_interval=3600,
                    keywords=["meat", "beef", "pork", "chicken", "肉"],
                    exclude_keywords=["vegetarian", "vegan"]
                ),
                ChannelConfig(
                    channel_id="UCJFp8uSYCjXOMnkUyb3CQ3Q", 
                    channel_name="Tasty Recipes",
                    enabled=True,
                    priority=2,
                    check_interval=3600,
                    keywords=["meat", "recipe", "cooking", "肉料理"],
                    exclude_keywords=["dessert", "sweet"]
                ),
                ChannelConfig(
                    channel_id="UChBEbMKI1eCcejTtmI32UEw",
                    channel_name="Joshua Weissman",
                    enabled=True,
                    priority=1,  # 最高優先度
                    check_interval=1800,  # 30分間隔
                    keywords=["meat", "protein", "cooking", "chef"],
                    exclude_keywords=["bread", "baking"]
                )
            ],
            monitoring=MonitoringConfig(
                enabled=True,
                check_interval=3600,
                max_videos_per_run=20,
                quality_threshold=0.6,
                retry_attempts=3,
                timeout_seconds=300
            ),
            notification=NotificationConfig(
                email_enabled=True,
                macos_notification_enabled=True,
                notification_levels=[LogLevel.ERROR, LogLevel.CRITICAL],
                daily_summary=True
            ),
            api_settings=APISettings(
                youtube_quota_limit=10000,
                claude_model="claude-3-haiku-20240307",
                claude_max_tokens=1000,
                notion_page_template="default",
                request_timeout=30
            ),
            log_level=LogLevel.INFO,
            data_retention_days=180,
            backup_enabled=True
        )