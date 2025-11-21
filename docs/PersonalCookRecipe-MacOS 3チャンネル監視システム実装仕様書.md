#PersonalCookRecipe-MacOS 3チャンネル監視システム実装仕様書
# MacOS 3チャンネル監視システム実装仕様書

**仕様書ID**: 03_CHANNEL_MONITORING_SYSTEM  
**作成日**: 2025年7月24日  
**対象**: Claude Code実装  
**プロジェクト**: 3チャンネル統合レシピ監視システム  
**前提条件**: 01_MacOS環境準備設定、02_API認証設定 完了  

---

## 📋 概要

### 🎯 目的
- SAM THE COOKING GUY、Tasty Recipes、Joshua Weissmanの3チャンネル統合監視
- 肉料理レシピの自動検出・収集・解析
- チャンネル特性に応じた差別化処理
- 重複除去・品質フィルタリング機能
- 効率的なAPIクォータ管理

### 📺 対象チャンネル詳細
- **Sam The Cooking Guy** (UC8C7QblJwCHsYrftuLjGKig): 実用家庭料理
- **Tasty Recipes** (UCJFp8uSYCjXOMnkUyb3CQ3Q): 時短・初心者向け
- **Joshua Weissman** (UChBEbMKI1eCcejTtmI32UEw): プロ技術・詳細解説

### 🛠️ 技術要件
- YouTube Data API v3 統合
- Claude API チャンネル特化解析
- 非同期並列処理（asyncio）
- インテリジェント重複検出
- 適応的スケジューリング
- macOS LaunchDaemon統合

---

## 🏗️ システムアーキテクチャ

### 📐 監視システム構成
```
┌─────────────────────────────────────────────────────────┐
│                 統合監視コントローラー                    │
│                    (macOS最適化)                        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │    Sam      │  │   Tasty     │  │  Joshua     │   │
│  │  Monitor    │  │  Monitor    │  │  Monitor    │   │
│  └─────────────┘  └─────────────┘  └─────────────┘   │
│         │                │                │           │
│         ▼                ▼                ▼           │
│  ┌─────────────────────────────────────────────────┐ │
│  │           統合フィルタリング・品質管理           │ │
│  └─────────────────────────────────────────────────┘ │
│         │                                              │
│         ▼                                              │
│  ┌─────────────────────────────────────────────────┐ │
│  │             Claude特化解析エンジン              │ │
│  └─────────────────────────────────────────────────┘ │
│         │                                              │
│         ▼                                              │
│  ┌─────────────────────────────────────────────────┐ │
│  │          結果統合・macOS通知システム            │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 🔄 データフロー
```
YouTube API → 生動画データ → 肉料理フィルタ → 重複除去 
    ↓
品質評価 → チャンネル特化解析 → 構造化データ → 統合出力
    ↓
macOS通知 → データ永続化 → LaunchDaemon連携
```

---

## 🔧 Claude Code実装タスク

### 📝 タスク1: 統合監視コントローラー
- **ファイル名**: `services/integrated_monitor.py`
- **機能**: 3チャンネル統合監視の中央制御（macOS対応）
- **実装内容**: 並列監視、スケジューリング、品質管理、通知

### 🎬 タスク2: チャンネル個別監視クラス
- **ファイル名**: `services/channel_monitors.py`
- **機能**: 各チャンネル特化の監視ロジック
- **実装内容**: Sam、Tasty、Joshua専用監視クラス

### 🥩 タスク3: 肉料理検出エンジン
- **ファイル名**: `services/meat_recipe_detector.py`
- **機能**: 動画から肉料理レシピの自動検出
- **実装内容**: キーワード解析、機械学習フィルタ

### 🤖 タスク4: Claude特化解析エンジン
- **ファイル名**: `services/channel_specific_analyzer.py`
- **機能**: チャンネル特性に応じたレシピ解析
- **実装内容**: Sam/Tasty/Joshua専用プロンプト・解析

### ✅ タスク5: 重複除去・品質管理
- **ファイル名**: `services/quality_controller.py`
- **機能**: レシピの重複検出と品質フィルタリング
- **実装内容**: 類似度計算、品質スコアリング

### 📊 タスク6: APIクォータ管理
- **ファイル名**: `services/quota_manager.py`
- **機能**: YouTube/Claude APIの効率的使用管理
- **実装内容**: 使用量監視、適応的制限、優先度制御

---

## 🔍 詳細実装仕様

### 🛠️ 統合監視コントローラー仕様

**ファイル**: `services/integrated_monitor.py`

```python
# 実装要件:
import asyncio
import logging
import subprocess
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from .channel_monitors import SamMonitor, TastyMonitor, JoshuaMonitor
from .meat_recipe_detector import MeatRecipeDetector
from .channel_specific_analyzer import ChannelSpecificAnalyzer
from .quality_controller import QualityController
from .quota_manager import QuotaManager

class ChannelPriority(Enum):
    """チャンネル優先度"""
    CRITICAL = 1  # Joshua (詳細解説重要)
    HIGH = 2      # Sam, Tasty (実用性重要)
    NORMAL = 3    # その他

@dataclass
class MonitoringConfig:
    """監視設定"""
    max_videos_per_cycle: int = 20
    max_concurrent_analyses: int = 5
    quality_threshold: float = 0.7
    duplicate_threshold: float = 0.8
    api_quota_buffer: float = 0.2  # 20%のバッファ保持
    enable_notifications: bool = True

class IntegratedChannelMonitor:
    """3チャンネル統合監視システム（macOS対応）"""
    
    def __init__(self, config: MonitoringConfig):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # macOSパス設定
        self.base_dir = Path.home() / "Developer" / "tasty-recipe-monitor"
        self.data_dir = self.base_dir / "data"
        self.log_dir = self.base_dir / "logs"
        
        # 各チャンネル監視インスタンス
        self.sam_monitor = SamMonitor()
        self.tasty_monitor = TastyMonitor()
        self.joshua_monitor = JoshuaMonitor()
        
        # 支援サービス
        self.meat_detector = MeatRecipeDetector()
        self.analyzer = ChannelSpecificAnalyzer()
        self.quality_controller = QualityController()
        self.quota_manager = QuotaManager()
        
        # 監視状態
        self.last_check_time = {}
        self.monitoring_stats = {}
        self.failed_videos = []
    
    async def run_monitoring_cycle(self) -> Dict[str, Any]:
        """メイン監視サイクル実行"""
        cycle_start = datetime.now()
        self.logger.info("=== 3チャンネル統合監視サイクル開始 ===")
        
        try:
            # 1. APIクォータ確認
            if not await self.quota_manager.check_sufficient_quota():
                self.logger.warning("APIクォータ不足、監視スキップ")
                await self._send_macos_notification(
                    "監視スキップ",
                    "APIクォータが不足しています"
                )
                return {"status": "skipped", "reason": "quota_insufficient"}
            
            # 2. 各チャンネルから新動画取得（並列）
            raw_results = await self._collect_videos_from_all_channels()
            
            # 3. 肉料理フィルタリング
            filtered_results = await self._filter_meat_recipes(raw_results)
            
            # 4. 重複除去・品質フィルタリング
            quality_results = await self._quality_filtering(filtered_results)
            
            # 5. 優先度順ソート
            prioritized_results = self._prioritize_videos(quality_results)
            
            # 6. チャンネル特化解析（制限付き並列）
            analyzed_results = await self._analyze_videos(prioritized_results)
            
            # 7. 統計更新・保存
            cycle_stats = self._update_monitoring_stats(
                cycle_start, raw_results, analyzed_results
            )
            
            # 8. 結果保存
            await self._save_results(analyzed_results)
            
            # 9. macOS通知
            if self.config.enable_notifications and analyzed_results:
                await self._send_macos_notification(
                    "監視完了",
                    f"{len(analyzed_results)}件の新レシピを検出しました"
                )
            
            self.logger.info(f"監視サイクル完了: {len(analyzed_results)}件処理")
            return {
                "status": "success",
                "processed_count": len(analyzed_results),
                "results": analyzed_results,
                "stats": cycle_stats
            }
            
        except Exception as e:
            self.logger.error(f"監視サイクルエラー: {e}")
            await self._send_macos_notification(
                "監視エラー",
                "エラーが発生しました。ログを確認してください"
            )
            return {"status": "error", "error": str(e)}
    
    async def _collect_videos_from_all_channels(self) -> Dict[str, List[Dict]]:
        """全チャンネルから動画収集"""
        tasks = [
            self.sam_monitor.get_recent_videos(),
            self.tasty_monitor.get_recent_videos(),
            self.joshua_monitor.get_recent_videos()
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        return {
            "sam": results[0] if not isinstance(results[0], Exception) else [],
            "tasty": results[1] if not isinstance(results[1], Exception) else [],
            "joshua": results[2] if not isinstance(results[2], Exception) else []
        }
    
    async def _filter_meat_recipes(self, raw_results: Dict) -> Dict[str, List[Dict]]:
        """肉料理レシピフィルタリング"""
        filtered = {}
        
        for channel, videos in raw_results.items():
            channel_filtered = []
            for video in videos:
                if await self.meat_detector.is_meat_recipe(video, channel):
                    video['channel'] = channel
                    video['detection_confidence'] = await self.meat_detector.get_confidence_score(video)
                    channel_filtered.append(video)
            
            filtered[channel] = channel_filtered
            self.logger.info(f"{channel}: {len(videos)} → {len(channel_filtered)} 件フィルタ後")
        
        return filtered
    
    async def _quality_filtering(self, filtered_results: Dict) -> List[Dict]:
        """品質フィルタリングと重複除去"""
        # 全チャンネルの結果を統合
        all_videos = []
        for channel_videos in filtered_results.values():
            all_videos.extend(channel_videos)
        
        # 重複除去
        unique_videos = await self.quality_controller.remove_duplicates(all_videos)
        
        # 品質フィルタリング
        quality_videos = await self.quality_controller.quality_filter(
            unique_videos, self.config.quality_threshold
        )
        
        self.logger.info(f"品質フィルタ: {len(all_videos)} → {len(quality_videos)} 件")
        return quality_videos
    
    def _prioritize_videos(self, videos: List[Dict]) -> List[Dict]:
        """動画の優先度付け"""
        def get_priority_score(video):
            channel = video['channel']
            base_score = video.get('detection_confidence', 0.5)
            
            # チャンネル別重み付け
            if channel == 'joshua':
                return base_score * 1.3  # Joshua最優先
            elif channel in ['sam', 'tasty']:
                return base_score * 1.0
            else:
                return base_score * 0.8
        
        sorted_videos = sorted(videos, key=get_priority_score, reverse=True)
        return sorted_videos[:self.config.max_videos_per_cycle]
    
    async def _analyze_videos(self, videos: List[Dict]) -> List[Dict]:
        """動画のチャンネル特化解析"""
        semaphore = asyncio.Semaphore(self.config.max_concurrent_analyses)
        
        async def analyze_single_video(video):
            async with semaphore:
                try:
                    return await self.analyzer.analyze_video(video)
                except Exception as e:
                    self.logger.error(f"動画解析エラー {video.get('title', 'Unknown')}: {e}")
                    self.failed_videos.append(video)
                    return None
        
        tasks = [analyze_single_video(video) for video in videos]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 成功した解析結果のみ返す
        successful_results = [r for r in results if r is not None and not isinstance(r, Exception)]
        
        self.logger.info(f"解析完了: {len(successful_results)}/{len(videos)} 件成功")
        return successful_results
    
    def _update_monitoring_stats(self, start_time, raw_results, final_results):
        """監視統計更新"""
        duration = datetime.now() - start_time
        
        stats = {
            "cycle_duration": duration.total_seconds(),
            "raw_video_count": sum(len(videos) for videos in raw_results.values()),
            "final_recipe_count": len(final_results),
            "success_rate": len(final_results) / max(sum(len(videos) for videos in raw_results.values()), 1),
            "channel_breakdown": {
                channel: len(videos) for channel, videos in raw_results.items()
            },
            "timestamp": start_time.isoformat()
        }
        
        self.monitoring_stats[start_time.strftime("%Y%m%d_%H%M")] = stats
        
        # 統計ファイル保存
        stats_file = self.data_dir / "monitoring_stats.json"
        import json
        with open(stats_file, 'w', encoding='utf-8') as f:
            json.dump(self.monitoring_stats, f, ensure_ascii=False, indent=2)
        
        return stats
    
    async def _save_results(self, results: List[Dict]):
        """結果保存"""
        try:
            import json
            results_file = self.data_dir / f"results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            
            with open(results_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            
            self.logger.info(f"結果保存完了: {results_file}")
            
        except Exception as e:
            self.logger.error(f"結果保存エラー: {e}")
    
    async def _send_macos_notification(self, title: str, message: str):
        """macOS通知送信"""
        if not self.config.enable_notifications:
            return
        
        try:
            subprocess.run([
                'osascript', '-e',
                f'display notification "{message}" with title "{title}" sound name "Glass"'
            ])
        except Exception as e:
            self.logger.debug(f"通知送信エラー: {e}")
    
    async def get_monitoring_health(self) -> Dict[str, Any]:
        """監視システムヘルス状況"""
        quota_status = await self.quota_manager.get_quota_status()
        
        return {
            "system_status": "healthy" if quota_status['youtube']['remaining'] > 100 else "warning",
            "api_quotas": quota_status,
            "failed_videos_count": len(self.failed_videos),
            "last_cycle_stats": list(self.monitoring_stats.values())[-1] if self.monitoring_stats else None,
            "uptime": datetime.now().isoformat()
        }
    
    async def cleanup_failed_videos(self) -> int:
        """失敗動画のクリーンアップ"""
        cleaned_count = len(self.failed_videos)
        self.failed_videos.clear()
        return cleaned_count


class MonitoringScheduler:
    """監視スケジューラー（macOS LaunchDaemon対応）"""
    
    def __init__(self, monitor: IntegratedChannelMonitor):
        self.monitor = monitor
        self.logger = logging.getLogger(__name__)
        self.running = False
        self.plist_path = Path.home() / "Library" / "LaunchAgents" / "com.tasty.recipe.monitor.plist"
    
    async def start_scheduled_monitoring(self):
        """スケジュール監視開始"""
        self.running = True
        self.logger.info("スケジュール監視開始")
        
        while self.running:
            try:
                # メイン監視サイクル実行
                result = await self.monitor.run_monitoring_cycle()
                
                if result['status'] == 'success':
                    await asyncio.sleep(3600)  # 1時間待機
                elif result['status'] == 'skipped':
                    await asyncio.sleep(1800)  # 30分待機（クォータ回復待ち）
                else:
                    await asyncio.sleep(900)   # 15分待機（エラー時）
                    
            except Exception as e:
                self.logger.error(f"スケジューラーエラー: {e}")
                await asyncio.sleep(600)  # 10分待機
    
    def stop_monitoring(self):
        """監視停止"""
        self.running = False
        self.logger.info("監視停止要求")
    
    def install_launchd_service(self):
        """LaunchDaemonサービスインストール"""
        try:
            plist_content = self._generate_plist()
            with open(self.plist_path, 'w') as f:
                f.write(plist_content)
            
            subprocess.run(['launchctl', 'load', str(self.plist_path)], check=True)
            self.logger.info("LaunchDaemonサービスインストール完了")
            
        except Exception as e:
            self.logger.error(f"LaunchDaemonインストールエラー: {e}")
    
    def _generate_plist(self) -> str:
        """plistファイル生成"""
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" 
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.tasty.recipe.monitor</string>
    <key>ProgramArguments</key>
    <array>
        <string>{Path.home()}/Developer/tasty-recipe-monitor/venv/bin/python</string>
        <string>{Path.home()}/Developer/tasty-recipe-monitor/main.py</string>
    </array>
    <key>StartInterval</key>
    <integer>3600</integer>
    <key>WorkingDirectory</key>
    <string>{Path.home()}/Developer/tasty-recipe-monitor</string>
    <key>StandardOutPath</key>
    <string>{Path.home()}/Developer/tasty-recipe-monitor/logs/launchd.log</string>
    <key>StandardErrorPath</key>
    <string>{Path.home()}/Developer/tasty-recipe-monitor/logs/launchd_error.log</string>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>"""
```

### 🎬 チャンネル個別監視クラス仕様

**ファイル**: `services/channel_monitors.py`

```python
# 実装要件:
import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from pathlib import Path
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# macOS環境設定
from config.keychain_manager import MacOSKeychainManager

class BaseChannelMonitor(ABC):
    """チャンネル監視基底クラス（macOS対応）"""
    
    def __init__(self, channel_id: str, channel_name: str):
        self.channel_id = channel_id
        self.channel_name = channel_name
        self.logger = logging.getLogger(f"{__name__}.{channel_name}")
        self.youtube_service = None
        self.last_check_time = None
        
        # macOSキャッシュディレクトリ
        self.cache_dir = Path.home() / "Developer" / "tasty-recipe-monitor" / "data" / "cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
    
    @abstractmethod
    def get_meat_keywords(self) -> List[str]:
        """チャンネル特有の肉料理キーワード"""
        pass
    
    @abstractmethod
    def get_channel_specific_config(self) -> Dict[str, Any]:
        """チャンネル固有設定"""
        pass
    
    async def get_recent_videos(self, max_results: int = 10) -> List[Dict]:
        """最新動画取得"""
        try:
            if not self.youtube_service:
                self.youtube_service = await self._initialize_youtube_service()
            
            search_response = self.youtube_service.search().list(
                channelId=self.channel_id,
                part='id,snippet',
                order='date',
                type='video',
                maxResults=max_results,
                publishedAfter=self._get_search_start_time()
            ).execute()
            
            videos = []
            for item in search_response.get('items', []):
                video_data = await self._enrich_video_data(item)
                if video_data:
                    videos.append(video_data)
            
            # キャッシュ保存
            await self._cache_videos(videos)
            
            self.last_check_time = datetime.now()
            self.logger.info(f"{len(videos)}件の動画を取得")
            return videos
            
        except HttpError as e:
            self.logger.error(f"YouTube API エラー: {e}")
            return []
        except Exception as e:
            self.logger.error(f"動画取得エラー: {e}")
            return []
    
    async def _initialize_youtube_service(self):
        """YouTube API サービス初期化（macOS Keychain使用）"""
        keychain = MacOSKeychainManager()
        api_key = keychain.get_password("YOUTUBE_API_KEY")
        
        if not api_key:
            raise ValueError("YouTube APIキーがKeychainに見つかりません")
        
        return build('youtube', 'v3', developerKey=api_key)
    
    def _get_search_start_time(self) -> str:
        """検索開始時刻算出"""
        if self.last_check_time:
            start_time = self.last_check_time
        else:
            start_time = datetime.now() - timedelta(hours=24)
        
        return start_time.strftime('%Y-%m-%dT%H:%M:%SZ')
    
    async def _enrich_video_data(self, item: Dict) -> Optional[Dict]:
        """動画データ拡張"""
        try:
            video_id = item['id']['videoId']
            
            # 詳細情報取得
            video_response = self.youtube_service.videos().list(
                part='statistics,contentDetails,snippet',
                id=video_id
            ).execute()
            
            if not video_response['items']:
                return None
                
            video_info = video_response['items'][0]
            
            return {
                'video_id': video_id,
                'title': item['snippet']['title'],
                'description': item['snippet']['description'],
                'published_at': item['snippet']['publishedAt'],
                'channel_name': self.channel_name,
                'channel_id': self.channel_id,
                'url': f"https://www.youtube.com/watch?v={video_id}",
                'thumbnail_url': item['snippet']['thumbnails']['high']['url'],
                'view_count': int(video_info['statistics'].get('viewCount', 0)),
                'like_count': int(video_info['statistics'].get('likeCount', 0)),
                'duration': video_info['contentDetails']['duration'],
                'tags': video_info['snippet'].get('tags', []),
                'channel_config': self.get_channel_specific_config()
            }
            
        except Exception as e:
            self.logger.error(f"動画データ拡張エラー: {e}")
            return None
    
    async def _cache_videos(self, videos: List[Dict]):
        """動画データキャッシュ（macOS）"""
        try:
            import json
            cache_file = self.cache_dir / f"{self.channel_name}_latest.json"
            
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(videos, f, ensure_ascii=False, indent=2)
                
        except Exception as e:
            self.logger.debug(f"キャッシュ保存エラー: {e}")


class SamMonitor(BaseChannelMonitor):
    """Sam The Cooking Guy 監視クラス"""
    
    def __init__(self):
        super().__init__(
            channel_id="UC8C7QblJwCHsYrftuLjGKig",
            channel_name="Sam The Cooking Guy"
        )
    
    def get_meat_keywords(self) -> List[str]:
        return [
            # BBQ関連
            "bbq", "grill", "grilled", "grilling", "smoker", "smoked",
            "barbecue", "brisket", "ribs", "pulled pork",
            
            # 肉料理一般
            "beef", "steak", "chicken", "pork", "bacon", "sausage",
            "burger", "meatball", "roast", "chops", "wings",
            
            # Sam特有
            "easy", "simple", "family", "backyard", "weekend",
            "comfort food", "hearty", "filling"
        ]
    
    def get_channel_specific_config(self) -> Dict[str, Any]:
        return {
            "difficulty_focus": "practical",
            "time_range": "30-60min",
            "equipment_level": "home_kitchen",
            "specialty": ["bbq", "comfort_food", "family_cooking"],
            "analysis_weight": {
                "practicality": 1.5,
                "cost_effectiveness": 1.3,
                "equipment_simplicity": 1.2,
                "family_friendliness": 1.4
            },
            "meat_keyword_weight": 1.2
        }


class TastyMonitor(BaseChannelMonitor):
    """Tasty Recipes 監視クラス"""
    
    def __init__(self):
        super().__init__(
            channel_id="UCJFp8uSYCjXOMnkUyb3CQ3Q",
            channel_name="Tasty Recipes"
        )
    
    def get_meat_keywords(self) -> List[str]:
        return [
            # 時短肉料理
            "quick", "easy", "fast", "30 minutes", "15 minutes",
            "one pot", "sheet pan", "skillet", "instant",
            
            # 肉料理
            "chicken", "beef", "pork", "turkey", "bacon",
            "ground meat", "meatballs", "stir fry", "tacos",
            
            # Tasty特有
            "tasty", "buzzfeed", "viral", "trending", "popular",
            "beginner", "simple", "minimal ingredients"
        ]
    
    def get_channel_specific_config(self) -> Dict[str, Any]:
        return {
            "difficulty_focus": "beginner",
            "time_range": "15-30min",
            "equipment_level": "minimal",
            "specialty": ["quick_meals", "visual_appeal", "simple_techniques"],
            "analysis_weight": {
                "simplicity": 1.5,
                "speed": 1.4,
                "visual_appeal": 1.3,
                "ingredient_accessibility": 1.4
            },
            "meat_keyword_weight": 1.0
        }


class JoshuaMonitor(BaseChannelMonitor):
    """Joshua Weissman 監視クラス"""
    
    def __init__(self):
        super().__init__(
            channel_id="UChBEbMKI1eCcejTtmI32UEw",
            channel_name="Joshua Weissman"
        )
    
    def get_meat_keywords(self) -> List[str]:
        return [
            # プロ技術肉料理
            "but better", "homemade", "from scratch", "technique",
            "professional", "restaurant", "gourmet", "advanced",
            
            # 肉料理高度
            "beef", "steak", "dry aged", "sous vide", "braised",
            "confit", "charcuterie", "cured", "smoked", "aged",
            
            # Joshua特有
            "joshua", "papa", "technique", "why", "science",
            "method", "proper", "correct", "better way"
        ]
    
    def get_channel_specific_config(self) -> Dict[str, Any]:
        return {
            "difficulty_focus": "advanced",
            "time_range": "45-120min",
            "equipment_level": "home_plus",
            "specialty": ["technique_focus", "but_better", "professional_tips"],
            "analysis_weight": {
                "technique_depth": 1.5,
                "scientific_explanation": 1.4,
                "professional_quality": 1.3,
                "skill_development": 1.5
            },
            "meat_keyword_weight": 1.3
        }


class ChannelMonitorFactory:
    """チャンネル監視ファクトリー"""
    
    @staticmethod
    def create_monitor(channel_name: str) -> BaseChannelMonitor:
        monitors = {
            "sam": SamMonitor,
            "tasty": TastyMonitor,
            "joshua": JoshuaMonitor
        }
        
        if channel_name not in monitors:
            raise ValueError(f"未対応チャンネル: {channel_name}")
        
        return monitors[channel_name]()
    
    @staticmethod
    def get_all_monitors() -> List[BaseChannelMonitor]:
        return [
            SamMonitor(),
            TastyMonitor(), 
            JoshuaMonitor()
        ]
```

### 🥩 肉料理検出エンジン仕様

**ファイル**: `services/meat_recipe_detector.py`

```python
# 実装要件:
import re
import logging
from typing import Dict, List, Optional, Tuple, Set
from dataclasses import dataclass
from pathlib import Path
import asyncio
import json

@dataclass
class DetectionWeights:
    """検出重み設定"""
    title_weight: float = 0.4
    description_weight: float = 0.3
    tags_weight: float = 0.2
    thumbnail_weight: float = 0.1

class MeatRecipeDetector:
    """肉料理レシピ自動検出エンジン（macOS対応）"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.weights = DetectionWeights()
        
        # macOSキャッシュディレクトリ
        self.cache_dir = Path.home() / "Developer" / "tasty-recipe-monitor" / "data" / "detector_cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # 肉料理関連キーワード辞書
        self.meat_keywords = self._build_meat_keyword_dict()
        self.cooking_method_keywords = self._build_cooking_method_dict()
        self.negative_keywords = self._build_negative_keyword_list()
        
        # チャンネル別重み調整
        self.channel_adjustments = {
            "sam": 1.2,      # BBQ・肉料理多め
            "tasty": 1.0,    # バランス型
            "joshua": 1.3    # 高度な肉料理多め
        }
        
        # 検出履歴
        self.detection_history = self._load_detection_history()
    
    def _build_meat_keyword_dict(self) -> Dict[str, float]:
        """肉料理キーワード辞書構築"""
        return {
            # 直接的な肉の種類（高スコア）
            "beef": 1.0, "steak": 1.0, "brisket": 1.0, "chuck": 0.9,
            "chicken": 1.0, "turkey": 0.9, "duck": 0.9, "wings": 0.9,
            "pork": 1.0, "bacon": 1.0, "ham": 0.9, "sausage": 0.9,
            "lamb": 1.0, "mutton": 0.8, "venison": 0.8, "game": 0.7,
            
            # 部位（中スコア）
            "ribs": 0.9, "chops": 0.8, "tenderloin": 0.8, "sirloin": 0.8,
            "thigh": 0.7, "breast": 0.7, "drumstick": 0.7, "wing": 0.7,
            
            # 調理済み肉料理（高スコア）
            "meatball": 0.9, "meatloaf": 0.9, "burger": 0.8, "bbq": 0.9,
            "roast": 0.8, "grilled": 0.8, "smoked": 0.8, "braised": 0.7,
            
            # 料理名（中〜高スコア）
            "carnitas": 0.9, "pulled pork": 1.0, "fried chicken": 1.0,
            "stir fry": 0.6, "curry": 0.5, "stew": 0.7, "chili": 0.6
        }
    
    def _build_cooking_method_dict(self) -> Dict[str, float]:
        """調理法キーワード辞書"""
        return {
            # 肉に適した調理法
            "grill": 0.8, "grilled": 0.8, "grilling": 0.8,
            "smoke": 0.9, "smoked": 0.9, "smoking": 0.9,
            "bbq": 1.0, "barbecue": 1.0, "barbecued": 1.0,
            "roast": 0.7, "roasted": 0.7, "roasting": 0.7,
            "braise": 0.8, "braised": 0.8, "braising": 0.8,
            "fry": 0.6, "fried": 0.6, "frying": 0.6,
            "sear": 0.7, "seared": 0.7, "searing": 0.7,
            "slow cook": 0.8, "slow cooker": 0.8, "crockpot": 0.7
        }
    
    def _build_negative_keyword_list(self) -> Set[str]:
        """除外キーワードリスト"""
        return {
            # 完全にベジタリアン・ビーガン
            "vegan", "vegetarian", "plant based", "plant-based",
            "meatless", "no meat", "meat free", "meat-free",
            
            # 海鮮系（肉料理ではない）
            "fish", "salmon", "tuna", "shrimp", "crab", "lobster",
            "seafood", "sushi", "sashimi",
            
            # デザート・スイーツ
            "dessert", "cake", "cookie", "ice cream", "chocolate",
            "sweet", "candy", "pastry", "pie" 
        }
    
    def _load_detection_history(self) -> Dict[str, float]:
        """検出履歴読み込み"""
        history_file = self.cache_dir / "detection_history.json"
        
        if history_file.exists():
            try:
                with open(history_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}
    
    def _save_detection_history(self):
        """検出履歴保存"""
        history_file = self.cache_dir / "detection_history.json"
        
        try:
            with open(history_file, 'w', encoding='utf-8') as f:
                json.dump(self.detection_history, f, ensure_ascii=False, indent=2)
        except Exception as e:
            self.logger.debug(f"履歴保存エラー: {e}")
    
    async def is_meat_recipe(self, video: Dict, channel: str) -> bool:
        """動画が肉料理レシピかどうか判定"""
        try:
            # 履歴チェック
            video_id = video.get('video_id')
            if video_id in self.detection_history:
                return self.detection_history[video_id] >= 0.6
            
            confidence_score = await self.get_confidence_score(video, channel)
            threshold = 0.6  # 60%以上で肉料理と判定
            
            is_meat = confidence_score >= threshold
            
            # 履歴に保存
            if video_id:
                self.detection_history[video_id] = confidence_score
                self._save_detection_history()
            
            self.logger.debug(
                f"肉料理判定: {video['title'][:50]}... "
                f"スコア: {confidence_score:.2f} → {'肉料理' if is_meat else '対象外'}"
            )
            
            return is_meat
            
        except Exception as e:
            self.logger.error(f"肉料理判定エラー: {e}")
            return False
    
    async def get_confidence_score(self, video: Dict, channel: str = None) -> float:
        """肉料理確信度スコア算出"""
        try:
            # 各要素のスコア計算
            title_score = self._analyze_text_content(video.get('title', ''))
            description_score = self._analyze_text_content(video.get('description', ''))
            tags_score = self._analyze_tags(video.get('tags', []))
            
            # 重み付き合計スコア
            weighted_score = (
                title_score * self.weights.title_weight +
                description_score * self.weights.description_weight +
                tags_score * self.weights.tags_weight
            )
            
            # 除外キーワードチェック
            if self._has_negative_keywords(video):
                weighted_score *= 0.3  # 大幅減点
            
            # チャンネル別調整
            if channel and channel in self.channel_adjustments:
                weighted_score *= self.channel_adjustments[channel]
            
            # 0-1の範囲に正規化
            return min(1.0, max(0.0, weighted_score))
            
        except Exception as e:
            self.logger.error(f"確信度スコア計算エラー: {e}")
            return 0.0
    
    def _analyze_text_content(self, text: str) -> float:
        """テキスト内容の肉料理関連度分析"""
        if not text:
            return 0.0
        
        text_lower = text.lower()
        total_score = 0.0
        word_count = 0
        
        # 肉キーワードスコア
        for keyword, weight in self.meat_keywords.items():
            if keyword in text_lower:
                # キーワードの出現回数も考慮
                count = text_lower.count(keyword)
                total_score += weight * count * 0.3
                word_count += count
        
        # 調理法キーワードスコア
        for keyword, weight in self.cooking_method_keywords.items():
            if keyword in text_lower:
                count = text_lower.count(keyword)
                total_score += weight * count * 0.2
                word_count += count
        
        # 正規化（単語数で割る）
        if word_count > 0:
            return min(1.0, total_score / word_count)
        else:
            return 0.0
    
    def _analyze_tags(self, tags: List[str]) -> float:
        """タグの肉料理関連度分析"""
        if not tags:
            return 0.0
        
        total_score = 0.0
        relevant_tags = 0
        
        for tag in tags:
            tag_lower = tag.lower()
            tag_score = 0.0
            
            # 肉キーワードチェック
            for keyword, weight in self.meat_keywords.items():
                if keyword in tag_lower:
                    tag_score = max(tag_score, weight)
            
            # 調理法キーワードチェック
            for keyword, weight in self.cooking_method_keywords.items():
                if keyword in tag_lower:
                    tag_score = max(tag_score, weight * 0.8)
            
            if tag_score > 0:
                total_score += tag_score
                relevant_tags += 1
        
        return total_score / len(tags) if tags else 0.0
    
    def _has_negative_keywords(self, video: Dict) -> bool:
        """除外キーワードの存在チェック"""
        text_content = " ".join([
            video.get('title', ''),
            video.get('description', ''),
            " ".join(video.get('tags', []))
        ]).lower()
        
        return any(keyword in text_content for keyword in self.negative_keywords)
    
    async def batch_detect_meat_recipes(self, videos: List[Dict], channel: str = None) -> List[Tuple[Dict, float]]:
        """バッチ肉料理検出"""
        results = []
        
        for video in videos:
            confidence = await self.get_confidence_score(video, channel)
            if confidence >= 0.6:  # 閾値以上のみ
                results.append((video, confidence))
        
        # 確信度順にソート
        results.sort(key=lambda x: x[1], reverse=True)
        
        self.logger.info(f"バッチ検出完了: {len(videos)}件中{len(results)}件が肉料理")
        return results
    
    def get_detection_stats(self) -> Dict[str, Any]:
        """検出統計情報"""
        return {
            "meat_keyword_count": len(self.meat_keywords),
            "cooking_method_count": len(self.cooking_method_keywords),
            "negative_keyword_count": len(self.negative_keywords),
            "detection_weights": {
                "title": self.weights.title_weight,
                "description": self.weights.description_weight,
                "tags": self.weights.tags_weight
            },
            "channel_adjustments": self.channel_adjustments,
            "history_count": len(self.detection_history),
            "cache_directory": str(self.cache_dir)
        }
```

---

## ✅ 実行チェックリスト

### 🔍 Claude Code実装前準備
- [ ] 01_MacOS環境準備設定 完了確認
- [ ] 02_API認証設定 完了確認
- [ ] YouTube Data API v3 接続テスト成功
- [ ] Claude API 接続テスト成功
- [ ] macOS Keychain統合確認

### 🚀 実装順序
1. `services/integrated_monitor.py` の実装
2. `services/channel_monitors.py` の実装
3. `services/meat_recipe_detector.py` の実装
4. テストスクリプトでの動作確認
5. LaunchDaemon設定
6. 統合テスト実行

### ✅ 実装後検証項目
- [ ] 3チャンネルすべてから動画取得可能
- [ ] 肉料理検出ロジックが正常動作
- [ ] 重複除去機能が動作
- [ ] APIクォータ管理が機能
- [ ] macOS通知が正常動作
- [ ] LaunchDaemonが正常稼働
- [ ] エラーハンドリングが適切
- [ ] ログ出力が詳細

---

## 🔄 次のステップ

**次の仕様書**: 04_Notion統合設定仕様書  
この仕様書完了後に04番の仕様書を要求してください

---

*macOSに最適化された高度な3チャンネル監視システムを構築しましょう！*