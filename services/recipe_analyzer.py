#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recipe Analyzer - Main Integration Hub
Recipe-DevAPI Agent

This module provides the main orchestration for the Recipe-DevAPI agent,
coordinating between all API services to provide comprehensive recipe
monitoring and analysis capabilities.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
import json

from .youtube_service import YouTubeService, YouTubeVideo, MonitoringConfig
from .claude_service import ClaudeService, RecipeAnalysis, RecipeType
from .notion_service import NotionService, RecipePageData
from .gmail_service import GmailService, EmailRecipient, NotificationType

from config.rate_limiter import RateLimiter
from config.error_handler import APIErrorHandler
from config.logger_config import get_api_logger, setup_logging


@dataclass
class ProcessingResult:
    """Result of processing a video"""
    success: bool
    video_id: str
    title: str
    error: Optional[str] = None
    analysis: Optional[RecipeAnalysis] = None
    notion_page_id: Optional[str] = None
    notification_sent: bool = False
    processing_time: float = 0.0


@dataclass
class ChannelConfig:
    """Channel monitoring configuration"""
    channel_id: str
    channel_name: str
    enabled: bool = True
    keywords: List[str] = field(default_factory=list)
    min_duration: int = 180  # 3 minutes
    max_duration: int = 3600  # 1 hour
    check_interval: int = 300  # 5 minutes
    meat_recipes_only: bool = False
    confidence_threshold: float = 0.7


class RecipeAnalyzer:
    """
    Main Recipe-DevAPI Agent orchestrator
    
    This class coordinates all API services to provide:
    - YouTube channel monitoring
    - Recipe content analysis with Claude
    - Notion database management
    - Email notifications
    - Comprehensive error handling
    - Performance monitoring
    """
    
    def __init__(
        self,
        youtube_service: YouTubeService,
        claude_service: ClaudeService,
        notion_service: NotionService,
        gmail_service: GmailService,
        error_handler: APIErrorHandler,
        config_dir: Path
    ):
        """
        Initialize Recipe Analyzer
        
        Args:
            youtube_service: YouTube API service
            claude_service: Claude API service
            notion_service: Notion API service
            gmail_service: Gmail service
            error_handler: Error handling service
            config_dir: Configuration directory
        """
        self.youtube_service = youtube_service
        self.claude_service = claude_service
        self.notion_service = notion_service
        self.gmail_service = gmail_service
        self.error_handler = error_handler
        self.config_dir = config_dir
        self.logger = get_api_logger('recipe_analyzer')
        
        # Channel configurations
        self.channel_configs: Dict[str, ChannelConfig] = {}
        self._load_channel_configs()
        
        # Processing statistics
        self.stats = {
            'videos_processed': 0,
            'recipes_detected': 0,
            'meat_recipes': 0,
            'vegetarian_recipes': 0,
            'errors_encountered': 0,
            'notifications_sent': 0,
            'start_time': datetime.now()
        }
        
        # Processing queue
        self.processing_queue: List[YouTubeVideo] = []
        self.processing_active = False
        
        self.logger.info("Recipe Analyzer initialized")
    
    def _load_channel_configs(self) -> None:
        """Load channel configurations from file"""
        try:
            config_file = self.config_dir / "channels.json"
            
            if config_file.exists():
                with open(config_file, 'r', encoding='utf-8') as f:
                    configs_data = json.load(f)
                
                for channel_id, config_data in configs_data.items():
                    self.channel_configs[channel_id] = ChannelConfig(
                        channel_id=channel_id,
                        channel_name=config_data.get('channel_name', ''),
                        enabled=config_data.get('enabled', True),
                        keywords=config_data.get('keywords', []),
                        min_duration=config_data.get('min_duration', 180),
                        max_duration=config_data.get('max_duration', 3600),
                        check_interval=config_data.get('check_interval', 300),
                        meat_recipes_only=config_data.get('meat_recipes_only', False),
                        confidence_threshold=config_data.get('confidence_threshold', 0.7)
                    )
                    
                self.logger.info(f"Loaded {len(self.channel_configs)} channel configurations")
            else:
                self.logger.warning("No channel configuration file found")
                
        except Exception as e:
            self.logger.error(f"Error loading channel configurations: {e}")
    
    async def add_channel(self, config: ChannelConfig) -> bool:
        """
        Add a new channel for monitoring
        
        Args:
            config: Channel configuration
            
        Returns:
            True if successfully added
        """
        try:
            # Verify channel exists
            channel_info = await self.youtube_service.get_channel_info(config.channel_id)
            if not channel_info:
                self.logger.error(f"Channel not found: {config.channel_id}")
                return False
            
            # Update channel name if not provided
            if not config.channel_name:
                config.channel_name = channel_info.title
            
            # Add to YouTube monitoring
            monitoring_config = MonitoringConfig(
                channel_id=config.channel_id,
                check_interval=config.check_interval,
                keywords=config.keywords,
                min_duration=config.min_duration,
                max_duration=config.max_duration
            )
            
            success = self.youtube_service.add_channel_monitor(config.channel_id, monitoring_config)
            
            if success:
                self.channel_configs[config.channel_id] = config
                await self._save_channel_configs()
                self.logger.info(f"Added channel: {config.channel_name} ({config.channel_id})")
            
            return success
            
        except Exception as e:
            self.logger.error(f"Error adding channel {config.channel_id}: {e}")
            return False
    
    async def remove_channel(self, channel_id: str) -> bool:
        """
        Remove a channel from monitoring
        
        Args:
            channel_id: YouTube channel ID
            
        Returns:
            True if successfully removed
        """
        try:
            # Remove from YouTube monitoring
            self.youtube_service.remove_channel_monitor(channel_id)
            
            # Remove from configurations
            if channel_id in self.channel_configs:
                del self.channel_configs[channel_id]
                await self._save_channel_configs()
                self.logger.info(f"Removed channel: {channel_id}")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Error removing channel {channel_id}: {e}")
            return False
    
    async def _save_channel_configs(self) -> None:
        """Save channel configurations to file"""
        try:
            config_file = self.config_dir / "channels.json"
            
            configs_data = {}
            for channel_id, config in self.channel_configs.items():
                configs_data[channel_id] = {
                    'channel_name': config.channel_name,
                    'enabled': config.enabled,
                    'keywords': config.keywords,
                    'min_duration': config.min_duration,
                    'max_duration': config.max_duration,
                    'check_interval': config.check_interval,
                    'meat_recipes_only': config.meat_recipes_only,
                    'confidence_threshold': config.confidence_threshold
                }
            
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(configs_data, f, indent=2, ensure_ascii=False)
                
        except Exception as e:
            self.logger.error(f"Error saving channel configurations: {e}")
    
    async def start_monitoring(self) -> None:
        """Start the complete monitoring and processing pipeline"""
        try:
            self.logger.info("Starting Recipe-DevAPI monitoring pipeline")
            
            # Start YouTube monitoring
            await self.youtube_service.start_monitoring()
            
            # Start processing loop
            self.processing_active = True
            processing_task = asyncio.create_task(self._processing_loop())
            
            # Start periodic status reporting
            status_task = asyncio.create_task(self._status_reporting_loop())
            
            # Wait for tasks
            await asyncio.gather(processing_task, status_task)
            
        except Exception as e:
            self.logger.error(f"Error in monitoring pipeline: {e}")
            await self.error_handler.handle_error(
                e, 'recipe_analyzer', 'start_monitoring'
            )
    
    async def stop_monitoring(self) -> None:
        """Stop monitoring pipeline"""
        try:
            self.processing_active = False
            await self.youtube_service.stop_monitoring()
            self.logger.info("Stopped Recipe-DevAPI monitoring pipeline")
            
        except Exception as e:
            self.logger.error(f"Error stopping monitoring: {e}")
    
    async def _processing_loop(self) -> None:
        """Main processing loop for detected videos"""
        self.logger.info("Started video processing loop")
        
        try:
            while self.processing_active:
                # Check for new videos from YouTube service
                new_videos = await self._get_new_videos()
                
                if new_videos:
                    self.logger.info(f"Processing {len(new_videos)} new videos")
                    
                    # Process videos in batches
                    batch_size = 3  # Process 3 videos concurrently
                    for i in range(0, len(new_videos), batch_size):
                        batch = new_videos[i:i + batch_size]
                        
                        # Process batch
                        results = await self._process_video_batch(batch)
                        
                        # Update statistics
                        for result in results:
                            if result.success:
                                self.stats['videos_processed'] += 1
                                if result.analysis:
                                    self.stats['recipes_detected'] += 1
                                    if result.analysis.recipe_type == RecipeType.MEAT_BASED:
                                        self.stats['meat_recipes'] += 1
                                    elif result.analysis.recipe_type in [RecipeType.VEGETARIAN, RecipeType.VEGAN]:
                                        self.stats['vegetarian_recipes'] += 1
                                    if result.notification_sent:
                                        self.stats['notifications_sent'] += 1
                            else:
                                self.stats['errors_encountered'] += 1
                
                # Wait before next check
                await asyncio.sleep(60)  # Check every minute
                
        except asyncio.CancelledError:
            self.logger.info("Processing loop cancelled")
            raise
        except Exception as e:
            self.logger.error(f"Error in processing loop: {e}")
            await self.error_handler.handle_error(
                e, 'recipe_analyzer', 'processing_loop'
            )
    
    async def _get_new_videos(self) -> List[YouTubeVideo]:
        """Get new videos from all monitored channels"""
        new_videos = []
        
        for channel_id, config in self.channel_configs.items():
            if not config.enabled:
                continue
            
            try:
                # Check for new videos
                monitoring_config = self.youtube_service.monitoring_configs.get(channel_id)
                if monitoring_config:
                    channel_videos = await self.youtube_service.check_for_new_videos(
                        channel_id, monitoring_config
                    )
                    new_videos.extend(channel_videos)
                    
            except Exception as e:
                self.logger.error(f"Error getting new videos from {channel_id}: {e}")
        
        return new_videos
    
    async def _process_video_batch(self, videos: List[YouTubeVideo]) -> List[ProcessingResult]:
        """Process a batch of videos"""
        tasks = [self._process_single_video(video) for video in videos]
        return await asyncio.gather(*tasks, return_exceptions=False)
    
    async def _process_single_video(self, video: YouTubeVideo) -> ProcessingResult:
        """
        Process a single video through the complete pipeline
        
        Args:
            video: YouTube video to process
            
        Returns:
            ProcessingResult with outcomes
        """
        start_time = asyncio.get_event_loop().time()
        
        try:
            self.logger.info(f"Processing video: {video.title} ({video.video_id})")
            
            # Get channel configuration
            channel_config = self.channel_configs.get(video.channel_id)
            if not channel_config:
                return ProcessingResult(
                    success=False,
                    video_id=video.video_id,
                    title=video.title,
                    error="Channel configuration not found"
                )
            
            # Step 1: Analyze content with Claude
            self.logger.debug(f"Analyzing content with Claude: {video.video_id}")
            
            content_to_analyze = f"{video.title}\n\n{video.description}"
            analysis = await self.claude_service.analyze_recipe_content(
                content=content_to_analyze,
                video_title=video.title,
                video_description=video.description
            )
            
            # Step 2: Apply filtering based on configuration
            if not self._should_process_video(video, analysis, channel_config):
                self.logger.info(f"Video filtered out: {video.title}")
                return ProcessingResult(
                    success=True,
                    video_id=video.video_id,
                    title=video.title,
                    analysis=analysis,
                    processing_time=asyncio.get_event_loop().time() - start_time
                )
            
            # Step 3: Create Notion page
            self.logger.debug(f"Creating Notion page: {video.video_id}")
            
            recipe_data = self._build_recipe_page_data(video, analysis)
            notion_page = await self.notion_service.create_recipe_page(recipe_data)
            
            # Step 4: Send notification
            notification_sent = False
            try:
                notification_data = {
                    'title': analysis.title_en or video.title,
                    'channel': video.channel_title,
                    'url': f"https://www.youtube.com/watch?v={video.video_id}",
                    'description': analysis.description_en or video.description[:200],
                    'thumbnail_url': video.thumbnail_url
                }
                
                result = await self.gmail_service.send_new_recipe_notification(notification_data)
                notification_sent = result.get('success', False)
                
            except Exception as e:
                self.logger.warning(f"Failed to send notification for {video.video_id}: {e}")
            
            processing_time = asyncio.get_event_loop().time() - start_time
            
            self.logger.info(
                f"Successfully processed: {video.title} "
                f"(Type: {analysis.recipe_type.value}, "
                f"Confidence: {analysis.confidence_score:.2f}, "
                f"Time: {processing_time:.1f}s)"
            )
            
            return ProcessingResult(
                success=True,
                video_id=video.video_id,
                title=video.title,
                analysis=analysis,
                notion_page_id=notion_page.page_id,
                notification_sent=notification_sent,
                processing_time=processing_time
            )
            
        except Exception as e:
            processing_time = asyncio.get_event_loop().time() - start_time
            error_message = str(e)
            
            self.logger.error(f"Error processing video {video.video_id}: {error_message}")
            
            # Handle error through error handler
            await self.error_handler.handle_error(
                e, 'recipe_analyzer', 'process_single_video',
                context=self.error_handler.error_handler.ErrorContext(
                    api_name='recipe_analyzer',
                    operation='process_single_video',
                    timestamp=datetime.now().timestamp(),
                    additional_data={
                        'video_id': video.video_id,
                        'channel_id': video.channel_id,
                        'processing_time': processing_time
                    }
                )
            )
            
            return ProcessingResult(
                success=False,
                video_id=video.video_id,
                title=video.title,
                error=error_message,
                processing_time=processing_time
            )
    
    def _should_process_video(
        self,
        video: YouTubeVideo,
        analysis: RecipeAnalysis,
        config: ChannelConfig
    ) -> bool:
        """
        Determine if video should be fully processed based on configuration
        
        Args:
            video: YouTube video
            analysis: Claude analysis result
            config: Channel configuration
            
        Returns:
            True if video should be processed
        """
        # Check confidence threshold
        if analysis.confidence_score < config.confidence_threshold:
            self.logger.debug(f"Low confidence: {analysis.confidence_score} < {config.confidence_threshold}")
            return False
        
        # Check meat-only filter
        if config.meat_recipes_only:
            if analysis.recipe_type not in [RecipeType.MEAT_BASED, RecipeType.SEAFOOD]:
                self.logger.debug(f"Non-meat recipe filtered: {analysis.recipe_type.value}")
                return False
        
        # Check if it's actually a recipe
        if analysis.recipe_type == RecipeType.UNKNOWN:
            self.logger.debug("Unknown recipe type")
            return False
        
        return True
    
    def _build_recipe_page_data(
        self,
        video: YouTubeVideo,
        analysis: RecipeAnalysis
    ) -> RecipePageData:
        """Build RecipePageData from video and analysis"""
        return RecipePageData(
            title_en=analysis.title_en or video.title,
            title_ja=analysis.title_ja or "",
            description_en=analysis.description_en or video.description[:500],
            description_ja=analysis.description_ja or "",
            youtube_url=f"https://www.youtube.com/watch?v={video.video_id}",
            channel_name=video.channel_title,
            published_date=video.published_at,
            duration=int(video.duration.total_seconds()),
            recipe_type=analysis.recipe_type.value,
            meat_ingredients=analysis.meat_ingredients,
            ingredients=analysis.ingredients,
            instructions=analysis.instructions,
            tags=analysis.tags,
            thumbnail_url=video.thumbnail_url,
            view_count=video.view_count,
            like_count=video.like_count,
            cooking_time=analysis.cooking_time,
            servings=analysis.servings,
            difficulty=analysis.difficulty,
            confidence_score=analysis.confidence_score
        )
    
    async def _status_reporting_loop(self) -> None:
        """Periodic status reporting loop"""
        try:
            while self.processing_active:
                # Wait 1 hour between status reports
                await asyncio.sleep(3600)
                
                # Generate status report
                await self._send_status_report()
                
        except asyncio.CancelledError:
            self.logger.info("Status reporting loop cancelled")
        except Exception as e:
            self.logger.error(f"Error in status reporting: {e}")
    
    async def _send_status_report(self) -> None:
        """Send periodic status report"""
        try:
            uptime = datetime.now() - self.stats['start_time']
            
            # Get API usage statistics
            youtube_stats = self.youtube_service.get_quota_status()
            claude_stats = self.claude_service.get_usage_statistics()
            notion_stats = self.notion_service.get_usage_statistics()
            gmail_stats = self.gmail_service.get_usage_statistics()
            
            status_data = {
                'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'uptime': f"{uptime.total_seconds() / 3600:.1f}",
                'processed_videos': self.stats['videos_processed'],
                'errors': self.stats['errors_encountered'],
                'success_rate': (
                    (self.stats['videos_processed'] / 
                     max(1, self.stats['videos_processed'] + self.stats['errors_encountered'])) * 100
                ),
                'statistics': json.dumps({
                    'recipe_stats': {
                        'total_recipes': self.stats['recipes_detected'],
                        'meat_recipes': self.stats['meat_recipes'],
                        'vegetarian_recipes': self.stats['vegetarian_recipes'],
                        'notifications_sent': self.stats['notifications_sent']
                    },
                    'api_usage': {
                        'youtube': youtube_stats,
                        'claude': claude_stats,
                        'notion': notion_stats,
                        'gmail': gmail_stats
                    },
                    'channels': {
                        'total': len(self.channel_configs),
                        'enabled': sum(1 for c in self.channel_configs.values() if c.enabled)
                    }
                }, indent=2)
            }
            
            # Send status report via email
            await self.gmail_service.send_email(
                message=self.gmail_service.EmailMessage(
                    recipients=self.gmail_service.notification_config.recipients,
                    subject="",
                    html_content=""
                ),
                template_id=NotificationType.SYSTEM_STATUS,
                template_variables=status_data
            )
            
            self.logger.info("Status report sent")
            
        except Exception as e:
            self.logger.error(f"Error sending status report: {e}")
    
    async def manual_process_video(self, video_url: str) -> ProcessingResult:
        """
        Manually process a specific video
        
        Args:
            video_url: YouTube video URL
            
        Returns:
            ProcessingResult
        """
        try:
            # Extract video ID from URL
            import re
            video_id_match = re.search(r'(?:v=|/)([a-zA-Z0-9_-]{11})', video_url)
            if not video_id_match:
                raise ValueError("Invalid YouTube URL")
            
            video_id = video_id_match.group(1)
            
            # Get video details
            videos = await self.youtube_service._get_video_details([video_id], {})
            if not videos:
                raise ValueError("Video not found")
            
            video = videos[0]
            
            # Process the video
            result = await self._process_single_video(video)
            
            self.logger.info(f"Manual processing completed for: {video.title}")
            return result
            
        except Exception as e:
            self.logger.error(f"Error in manual processing: {e}")
            return ProcessingResult(
                success=False,
                video_id="unknown",
                title="Manual Processing Error",
                error=str(e)
            )
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get comprehensive system status"""
        uptime = datetime.now() - self.stats['start_time']
        
        return {
            'status': 'active' if self.processing_active else 'inactive',
            'uptime_hours': uptime.total_seconds() / 3600,
            'statistics': self.stats.copy(),
            'channels': {
                'total': len(self.channel_configs),
                'enabled': sum(1 for c in self.channel_configs.values() if c.enabled),
                'configs': {
                    channel_id: {
                        'name': config.channel_name,
                        'enabled': config.enabled,
                        'meat_only': config.meat_recipes_only,
                        'confidence_threshold': config.confidence_threshold
                    }
                    for channel_id, config in self.channel_configs.items()
                }
            },
            'api_services': {
                'youtube': self.youtube_service.get_quota_status(),
                'claude': self.claude_service.get_usage_statistics(),
                'notion': self.notion_service.get_usage_statistics(),
                'gmail': self.gmail_service.get_usage_statistics()
            },
            'queue_size': len(self.processing_queue),
            'last_updated': datetime.now().isoformat()
        }


# Example usage and testing
async def example_usage():
    """Example usage of Recipe Analyzer"""
    from pathlib import Path
    from config.rate_limiter import RateLimiter
    from config.error_handler import APIErrorHandler
    from config.api_manager import APIManager
    
    # Setup
    config_dir = Path("./config")
    api_manager = APIManager(config_dir)
    rate_limiter = RateLimiter()
    error_handler = APIErrorHandler(config_dir)
    
    # Initialize services (you'd use real API keys)
    youtube_service = YouTubeService(
        api_key="YOUR_YOUTUBE_API_KEY",
        rate_limiter=rate_limiter,
        error_handler=error_handler
    )
    
    claude_service = ClaudeService(
        api_key="YOUR_CLAUDE_API_KEY",
        rate_limiter=rate_limiter,
        error_handler=error_handler
    )
    
    notion_service = NotionService(
        token="YOUR_NOTION_TOKEN",
        database_id="YOUR_DATABASE_ID",
        rate_limiter=rate_limiter,
        error_handler=error_handler
    )
    
    gmail_service = GmailService(
        credentials=None,  # Load from OAuth
        rate_limiter=rate_limiter,
        error_handler=error_handler,
        config_dir=config_dir
    )
    
    # Initialize Recipe Analyzer
    analyzer = RecipeAnalyzer(
        youtube_service=youtube_service,
        claude_service=claude_service,
        notion_service=notion_service,
        gmail_service=gmail_service,
        error_handler=error_handler,
        config_dir=config_dir
    )
    
    # Add channel for monitoring
    channel_config = ChannelConfig(
        channel_id="UC8C7QblJwCHsYrftuLjGKig",  # Sam The Cooking Guy
        channel_name="Sam The Cooking Guy",
        keywords=["recipe", "cooking", "food"],
        meat_recipes_only=False,
        confidence_threshold=0.8
    )
    
    await analyzer.add_channel(channel_config)
    
    # Start monitoring
    print("Starting Recipe-DevAPI monitoring...")
    await analyzer.start_monitoring()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(example_usage())