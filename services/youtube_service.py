#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
YouTube Data API v3 Service
Recipe-DevAPI Agent

This module provides comprehensive YouTube API integration with channel monitoring,
video detection, and metadata extraction capabilities.
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Any, Set, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import json
from pathlib import Path

import httpx
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import isodate

from config.rate_limiter import RateLimiter, APIRateLimitDecorator
from config.error_handler import APIErrorHandler, handle_api_errors
from config.logger_config import get_api_logger


@dataclass
class YouTubeVideo:
    """YouTube video data structure"""
    video_id: str
    title: str
    description: str
    channel_id: str
    channel_title: str
    published_at: datetime
    duration: timedelta
    view_count: int
    like_count: Optional[int]
    thumbnail_url: str
    tags: List[str] = field(default_factory=list)
    category_id: str = ""
    default_language: Optional[str] = None
    captions_available: bool = False
    definition: str = "sd"  # sd or hd
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'video_id': self.video_id,
            'title': self.title,
            'description': self.description[:1000],  # Truncate for storage
            'channel_id': self.channel_id,
            'channel_title': self.channel_title,
            'published_at': self.published_at.isoformat(),
            'duration_seconds': int(self.duration.total_seconds()),
            'view_count': self.view_count,
            'like_count': self.like_count,
            'thumbnail_url': self.thumbnail_url,
            'tags': self.tags[:10],  # Limit tags
            'category_id': self.category_id,
            'default_language': self.default_language,
            'captions_available': self.captions_available,
            'definition': self.definition
        }


@dataclass
class YouTubeChannel:
    """YouTube channel data structure"""
    channel_id: str
    title: str
    description: str
    subscriber_count: int
    video_count: int
    view_count: int
    published_at: datetime
    thumbnail_url: str
    country: Optional[str] = None
    default_language: Optional[str] = None
    uploads_playlist_id: Optional[str] = None


@dataclass
class MonitoringConfig:
    """Channel monitoring configuration"""
    channel_id: str
    check_interval: int = 300  # 5 minutes
    max_videos_per_check: int = 50
    keywords: List[str] = field(default_factory=list)
    language_filter: Optional[str] = None
    min_duration: Optional[int] = None  # seconds
    max_duration: Optional[int] = None  # seconds
    last_check: Optional[datetime] = None
    last_video_id: Optional[str] = None


class YouTubeService:
    """
    Comprehensive YouTube Data API v3 service
    
    Features:
    - Channel monitoring with configurable intervals
    - New video detection with smart filtering
    - Video metadata extraction and enrichment
    - Quota-aware rate limiting
    - Robust error handling and retry logic
    - Caching for improved performance
    """
    
    def __init__(
        self,
        api_key: str,
        rate_limiter: RateLimiter,
        error_handler: APIErrorHandler,
        cache_dir: Optional[Path] = None
    ):
        """
        Initialize YouTube service
        
        Args:
            api_key: YouTube Data API v3 key
            rate_limiter: Rate limiting manager
            error_handler: Error handling manager
            cache_dir: Optional cache directory
        """
        self.api_key = api_key
        self.rate_limiter = rate_limiter
        self.error_handler = error_handler
        self.logger = get_api_logger('youtube')
        
        # Cache configuration
        self.cache_dir = cache_dir
        self.cache_ttl = 300  # 5 minutes
        self._cache: Dict[str, Tuple[Any, float]] = {}
        
        if cache_dir:
            cache_dir.mkdir(parents=True, exist_ok=True)
        
        # YouTube API client
        self.youtube = build('youtube', 'v3', developerKey=api_key)
        
        # Monitoring state
        self.monitoring_configs: Dict[str, MonitoringConfig] = {}
        self.monitoring_active = False
        self.monitoring_task: Optional[asyncio.Task] = None
        
        # Video cache for duplicate detection
        self.processed_videos: Set[str] = set()
        
        # API quota tracking
        self.quota_used = 0
        self.quota_reset_time = time.time() + 86400  # Daily reset
        self.daily_quota_limit = 10000
        
        self.logger.info("YouTube service initialized")
    
    @handle_api_errors(None, 'youtube', 'get_channel_info')  # Will be set in __post_init__
    async def get_channel_info(self, channel_id: str, use_cache: bool = True) -> Optional[YouTubeChannel]:
        """
        Get comprehensive channel information
        
        Args:
            channel_id: YouTube channel ID
            use_cache: Whether to use cached data
            
        Returns:
            YouTubeChannel object or None if not found
        """
        cache_key = f"channel_{channel_id}"
        
        # Check cache first
        if use_cache and self._is_cached_valid(cache_key):
            cached_data = self._get_cached(cache_key)
            if cached_data:
                self.logger.debug(f"Using cached channel info for {channel_id}")
                return YouTubeChannel(**cached_data)
        
        await self.rate_limiter.wait_if_needed('youtube', 'channels')
        
        try:
            # Request channel details
            request = self.youtube.channels().list(
                part='snippet,statistics,contentDetails',
                id=channel_id,
                maxResults=1
            )
            
            response = request.execute()
            self.quota_used += 1  # channels.list costs 1 quota unit
            
            if not response.get('items'):
                self.logger.warning(f"Channel not found: {channel_id}")
                return None
            
            item = response['items'][0]
            snippet = item['snippet']
            statistics = item['statistics']
            content_details = item.get('contentDetails', {})
            
            # Parse channel data
            channel = YouTubeChannel(
                channel_id=channel_id,
                title=snippet['title'],
                description=snippet.get('description', ''),
                subscriber_count=int(statistics.get('subscriberCount', 0)),
                video_count=int(statistics.get('videoCount', 0)),
                view_count=int(statistics.get('viewCount', 0)),
                published_at=datetime.fromisoformat(snippet['publishedAt'].replace('Z', '+00:00')),
                thumbnail_url=snippet['thumbnails']['default']['url'],
                country=snippet.get('country'),
                default_language=snippet.get('defaultLanguage'),
                uploads_playlist_id=content_details.get('relatedPlaylists', {}).get('uploads')
            )
            
            # Cache the result
            if use_cache:
                self._set_cache(cache_key, channel.__dict__)
            
            self.logger.info(f"Retrieved channel info: {channel.title} ({channel.subscriber_count} subscribers)")
            return channel
            
        except HttpError as e:
            self.logger.error(f"YouTube API error getting channel {channel_id}: {e}")
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error getting channel {channel_id}: {e}")
            raise
    
    @handle_api_errors(None, 'youtube', 'get_recent_videos')
    async def get_recent_videos(
        self,
        channel_id: str,
        max_results: int = 50,
        published_after: Optional[datetime] = None,
        use_cache: bool = True
    ) -> List[YouTubeVideo]:
        """
        Get recent videos from a channel
        
        Args:
            channel_id: YouTube channel ID
            max_results: Maximum number of videos to retrieve
            published_after: Only get videos published after this time
            use_cache: Whether to use cached data
            
        Returns:
            List of YouTubeVideo objects
        """
        cache_key = f"recent_videos_{channel_id}_{max_results}"
        
        # Check cache first
        if use_cache and self._is_cached_valid(cache_key, ttl=60):  # Shorter cache for recent videos
            cached_data = self._get_cached(cache_key)
            if cached_data:
                self.logger.debug(f"Using cached recent videos for {channel_id}")
                return [YouTubeVideo(**video_data) for video_data in cached_data]
        
        # Get channel's uploads playlist
        channel_info = await self.get_channel_info(channel_id)
        if not channel_info or not channel_info.uploads_playlist_id:
            self.logger.error(f"Could not get uploads playlist for channel {channel_id}")
            return []
        
        await self.rate_limiter.wait_if_needed('youtube', 'playlist_items')
        
        try:
            # Build the request
            request_params = {
                'part': 'snippet,contentDetails',
                'playlistId': channel_info.uploads_playlist_id,
                'maxResults': min(max_results, 50)  # YouTube API limit
            }
            
            if published_after:
                request_params['publishedAfter'] = published_after.strftime('%Y-%m-%dT%H:%M:%SZ')
            
            request = self.youtube.playlistItems().list(**request_params)
            response = request.execute()
            self.quota_used += 1  # playlistItems.list costs 1 quota unit
            
            video_ids = []
            video_snippets = {}
            
            for item in response.get('items', []):
                video_id = item['contentDetails']['videoId']
                video_ids.append(video_id)
                video_snippets[video_id] = item['snippet']
            
            if not video_ids:
                return []
            
            # Get detailed video information
            videos = await self._get_video_details(video_ids, video_snippets)
            
            # Cache the result
            if use_cache:
                self._set_cache(cache_key, [video.to_dict() for video in videos])
            
            self.logger.info(f"Retrieved {len(videos)} recent videos from {channel_info.title}")
            return videos
            
        except HttpError as e:
            self.logger.error(f"YouTube API error getting recent videos for {channel_id}: {e}")
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error getting recent videos for {channel_id}: {e}")
            raise
    
    async def _get_video_details(self, video_ids: List[str], snippets: Dict[str, Any]) -> List[YouTubeVideo]:
        """
        Get detailed information for multiple videos
        
        Args:
            video_ids: List of video IDs
            snippets: Dict mapping video IDs to snippet data
            
        Returns:
            List of YouTubeVideo objects
        """
        if not video_ids:
            return []
        
        await self.rate_limiter.wait_if_needed('youtube', 'videos')
        
        try:
            # Request video details in batches (API allows up to 50 IDs per request)
            all_videos = []
            
            for i in range(0, len(video_ids), 50):
                batch_ids = video_ids[i:i+50]
                
                request = self.youtube.videos().list(
                    part='snippet,contentDetails,statistics',
                    id=','.join(batch_ids)
                )
                
                response = request.execute()
                self.quota_used += 1  # videos.list costs 1 quota unit
                
                for item in response.get('items', []):
                    video = self._parse_video_item(item)
                    if video:
                        all_videos.append(video)
                
                # Small delay between batches
                if i + 50 < len(video_ids):
                    await asyncio.sleep(0.1)
            
            return all_videos
            
        except HttpError as e:
            self.logger.error(f"YouTube API error getting video details: {e}")
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error getting video details: {e}")
            raise
    
    def _parse_video_item(self, item: Dict[str, Any]) -> Optional[YouTubeVideo]:
        """
        Parse YouTube API video item into YouTubeVideo object
        
        Args:
            item: Video item from YouTube API
            
        Returns:
            YouTubeVideo object or None if parsing fails
        """
        try:
            snippet = item['snippet']
            content_details = item['contentDetails']
            statistics = item.get('statistics', {})
            
            # Parse duration
            duration_str = content_details.get('duration', 'PT0S')
            duration = isodate.parse_duration(duration_str)
            
            # Parse published date
            published_at = datetime.fromisoformat(snippet['publishedAt'].replace('Z', '+00:00'))
            
            # Get thumbnail URL (best available quality)
            thumbnails = snippet.get('thumbnails', {})
            thumbnail_url = ''
            for quality in ['maxres', 'standard', 'high', 'medium', 'default']:
                if quality in thumbnails:
                    thumbnail_url = thumbnails[quality]['url']
                    break
            
            video = YouTubeVideo(
                video_id=item['id'],
                title=snippet['title'],
                description=snippet.get('description', ''),
                channel_id=snippet['channelId'],
                channel_title=snippet['channelTitle'],
                published_at=published_at,
                duration=duration,
                view_count=int(statistics.get('viewCount', 0)),
                like_count=int(statistics.get('likeCount', 0)) if statistics.get('likeCount') else None,
                thumbnail_url=thumbnail_url,
                tags=snippet.get('tags', []),
                category_id=snippet.get('categoryId', ''),
                default_language=snippet.get('defaultLanguage'),
                captions_available=content_details.get('caption') == 'true',
                definition=content_details.get('definition', 'sd')
            )
            
            return video
            
        except Exception as e:
            self.logger.error(f"Error parsing video item {item.get('id', 'unknown')}: {e}")
            return None
    
    def add_channel_monitor(self, channel_id: str, config: MonitoringConfig) -> bool:
        """
        Add a channel to monitoring
        
        Args:
            channel_id: YouTube channel ID
            config: Monitoring configuration
            
        Returns:
            True if successfully added
        """
        try:
            self.monitoring_configs[channel_id] = config
            self.logger.info(f"Added channel {channel_id} to monitoring")
            
            # Start monitoring if not already active
            if not self.monitoring_active:
                asyncio.create_task(self.start_monitoring())
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error adding channel monitor for {channel_id}: {e}")
            return False
    
    def remove_channel_monitor(self, channel_id: str) -> bool:
        """
        Remove a channel from monitoring
        
        Args:
            channel_id: YouTube channel ID
            
        Returns:
            True if successfully removed
        """
        try:
            if channel_id in self.monitoring_configs:
                del self.monitoring_configs[channel_id]
                self.logger.info(f"Removed channel {channel_id} from monitoring")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Error removing channel monitor for {channel_id}: {e}")
            return False
    
    async def start_monitoring(self) -> None:
        """Start the channel monitoring loop"""
        if self.monitoring_active:
            self.logger.warning("Monitoring already active")
            return
        
        self.monitoring_active = True
        self.monitoring_task = asyncio.create_task(self._monitoring_loop())
        self.logger.info("Started YouTube channel monitoring")
    
    async def stop_monitoring(self) -> None:
        """Stop the channel monitoring loop"""
        self.monitoring_active = False
        
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
        
        self.logger.info("Stopped YouTube channel monitoring")
    
    async def _monitoring_loop(self) -> None:
        """Main monitoring loop"""
        self.logger.info("YouTube monitoring loop started")
        
        try:
            while self.monitoring_active:
                current_time = datetime.now()
                
                for channel_id, config in self.monitoring_configs.items():
                    try:
                        # Check if it's time to monitor this channel
                        if (config.last_check and 
                            (current_time - config.last_check).total_seconds() < config.check_interval):
                            continue
                        
                        # Check for new videos
                        new_videos = await self.check_for_new_videos(channel_id, config)
                        
                        if new_videos:
                            self.logger.info(f"Found {len(new_videos)} new videos from {channel_id}")
                            
                            # Process new videos (this would trigger notifications, analysis, etc.)
                            await self._process_new_videos(channel_id, new_videos, config)
                        
                        # Update last check time
                        config.last_check = current_time
                        
                    except Exception as e:
                        self.logger.error(f"Error monitoring channel {channel_id}: {e}")
                        await asyncio.sleep(10)  # Wait before continuing
                
                # Wait before next monitoring cycle
                await asyncio.sleep(60)  # Check every minute
                
        except asyncio.CancelledError:
            self.logger.info("Monitoring loop cancelled")
            raise
        except Exception as e:
            self.logger.error(f"Monitoring loop error: {e}")
        finally:
            self.monitoring_active = False
    
    async def check_for_new_videos(
        self,
        channel_id: str,
        config: MonitoringConfig
    ) -> List[YouTubeVideo]:
        """
        Check for new videos from a channel
        
        Args:
            channel_id: YouTube channel ID
            config: Monitoring configuration
            
        Returns:
            List of new YouTubeVideo objects
        """
        try:
            # Get videos published after last check
            published_after = None
            if config.last_check:
                published_after = config.last_check - timedelta(minutes=5)  # Small overlap
            
            recent_videos = await self.get_recent_videos(
                channel_id,
                max_results=config.max_videos_per_check,
                published_after=published_after,
                use_cache=False  # Always fetch fresh data for monitoring
            )
            
            # Filter for truly new videos
            new_videos = []
            for video in recent_videos:
                if video.video_id not in self.processed_videos:
                    # Apply filters
                    if self._video_matches_filters(video, config):
                        new_videos.append(video)
                        self.processed_videos.add(video.video_id)
            
            return new_videos
            
        except Exception as e:
            self.logger.error(f"Error checking for new videos from {channel_id}: {e}")
            return []
    
    def _video_matches_filters(self, video: YouTubeVideo, config: MonitoringConfig) -> bool:
        """
        Check if video matches monitoring filters
        
        Args:
            video: YouTube video to check
            config: Monitoring configuration
            
        Returns:
            True if video matches filters
        """
        # Duration filters
        duration_seconds = int(video.duration.total_seconds())
        
        if config.min_duration and duration_seconds < config.min_duration:
            return False
        
        if config.max_duration and duration_seconds > config.max_duration:
            return False
        
        # Language filter
        if config.language_filter and video.default_language != config.language_filter:
            return False
        
        # Keyword filters
        if config.keywords:
            text_to_search = f"{video.title} {video.description}".lower()
            if not any(keyword.lower() in text_to_search for keyword in config.keywords):
                return False
        
        return True
    
    async def _process_new_videos(
        self,
        channel_id: str,
        videos: List[YouTubeVideo],
        config: MonitoringConfig
    ) -> None:
        """
        Process newly detected videos
        
        Args:
            channel_id: YouTube channel ID
            videos: List of new videos
            config: Monitoring configuration
        """
        for video in videos:
            self.logger.info(
                f"Processing new video: {video.title} "
                f"({video.channel_title}) - {video.duration}"
            )
            
            # Here you would typically:
            # 1. Send to Claude for analysis
            # 2. Create Notion database entry
            # 3. Send notifications via Gmail
            # 4. Update monitoring state
            
            # For now, just log the detection
            await asyncio.sleep(0.1)  # Prevent tight loop
    
    # Cache management methods
    def _is_cached_valid(self, key: str, ttl: Optional[int] = None) -> bool:
        """Check if cached data is still valid"""
        if key not in self._cache:
            return False
        
        _, timestamp = self._cache[key]
        age = time.time() - timestamp
        cache_ttl = ttl or self.cache_ttl
        
        return age < cache_ttl
    
    def _get_cached(self, key: str) -> Optional[Any]:
        """Get cached data"""
        if self._is_cached_valid(key):
            data, _ = self._cache[key]
            return data
        return None
    
    def _set_cache(self, key: str, data: Any) -> None:
        """Set cached data"""
        self._cache[key] = (data, time.time())
    
    def get_quota_status(self) -> Dict[str, Any]:
        """
        Get current API quota status
        
        Returns:
            Dictionary containing quota information
        """
        return {
            'quota_used': self.quota_used,
            'quota_limit': self.daily_quota_limit,
            'quota_remaining': self.daily_quota_limit - self.quota_used,
            'quota_reset_time': self.quota_reset_time,
            'usage_percentage': (self.quota_used / self.daily_quota_limit) * 100
        }
    
    def get_monitoring_status(self) -> Dict[str, Any]:
        """
        Get monitoring status
        
        Returns:
            Dictionary containing monitoring information
        """
        return {
            'monitoring_active': self.monitoring_active,
            'monitored_channels': len(self.monitoring_configs),
            'channels': {
                channel_id: {
                    'last_check': config.last_check.isoformat() if config.last_check else None,
                    'check_interval': config.check_interval,
                    'keywords': config.keywords
                }
                for channel_id, config in self.monitoring_configs.items()
            },
            'processed_videos': len(self.processed_videos)
        }


# Example usage
async def example_usage():
    """Example usage of YouTube service"""
    from config.rate_limiter import RateLimiter
    from config.error_handler import APIErrorHandler
    from pathlib import Path
    
    # Initialize dependencies
    rate_limiter = RateLimiter()
    error_handler = APIErrorHandler(Path("./config"))
    
    # Initialize YouTube service (replace with real API key)
    youtube_service = YouTubeService(
        api_key="YOUR_YOUTUBE_API_KEY",
        rate_limiter=rate_limiter,
        error_handler=error_handler,
        cache_dir=Path("./cache")
    )
    
    # Example channel monitoring
    channel_id = "UC8C7QblJwCHsYrftuLjGKig"  # Sam The Cooking Guy
    
    # Get channel info
    channel_info = await youtube_service.get_channel_info(channel_id)
    if channel_info:
        print(f"Channel: {channel_info.title} ({channel_info.subscriber_count} subscribers)")
        
        # Get recent videos
        recent_videos = await youtube_service.get_recent_videos(channel_id, max_results=10)
        print(f"Found {len(recent_videos)} recent videos")
        
        # Add to monitoring
        monitoring_config = MonitoringConfig(
            channel_id=channel_id,
            check_interval=300,  # 5 minutes
            keywords=['recipe', 'cooking', 'food'],
            min_duration=180,  # 3 minutes
            max_duration=1800  # 30 minutes
        )
        
        youtube_service.add_channel_monitor(channel_id, monitoring_config)
        
        # Start monitoring
        await youtube_service.start_monitoring()
        
        # Let it run for a bit
        await asyncio.sleep(10)
        
        # Stop monitoring
        await youtube_service.stop_monitoring()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(example_usage())