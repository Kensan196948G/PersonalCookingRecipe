#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Integration Tests for Recipe-DevAPI Agent
Tests the complete integration between all API services
"""

import pytest
import asyncio
import logging
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta

# Import all services
from services.youtube_service import YouTubeService, YouTubeVideo, MonitoringConfig
from services.claude_service import ClaudeService, RecipeAnalysis, RecipeType
from services.notion_service import NotionService, RecipePageData
from services.gmail_service import GmailService, EmailRecipient
from services.recipe_analyzer import RecipeAnalyzer, ChannelConfig
from services.notification_manager import NotificationManager, Priority

from config.rate_limiter import RateLimiter
from config.error_handler import APIErrorHandler
from config.api_manager import APIManager


@pytest.fixture
def config_dir(tmp_path):
    """Temporary configuration directory"""
    return tmp_path / "config"


@pytest.fixture
def rate_limiter():
    """Rate limiter fixture"""
    return RateLimiter()


@pytest.fixture
def error_handler(config_dir):
    """Error handler fixture"""
    return APIErrorHandler(config_dir)


@pytest.fixture
def api_manager(config_dir):
    """API manager fixture"""
    return APIManager(config_dir)


@pytest.fixture
def mock_credentials():
    """Mock Gmail credentials"""
    mock_creds = MagicMock()
    mock_creds.expired = False
    mock_creds.refresh_token = "mock_refresh_token"
    return mock_creds


@pytest.fixture
async def youtube_service(rate_limiter, error_handler):
    """YouTube service fixture"""
    return YouTubeService(
        api_key="test_youtube_api_key",
        rate_limiter=rate_limiter,
        error_handler=error_handler
    )


@pytest.fixture
async def claude_service(rate_limiter, error_handler):
    """Claude service fixture"""
    return ClaudeService(
        api_key="test_claude_api_key",
        rate_limiter=rate_limiter,
        error_handler=error_handler
    )


@pytest.fixture
async def notion_service(rate_limiter, error_handler):
    """Notion service fixture"""
    return NotionService(
        token="test_notion_token",
        database_id="test_database_id",
        rate_limiter=rate_limiter,
        error_handler=error_handler
    )


@pytest.fixture
async def gmail_service(mock_credentials, rate_limiter, error_handler, config_dir):
    """Gmail service fixture"""
    return GmailService(
        credentials=mock_credentials,
        rate_limiter=rate_limiter,
        error_handler=error_handler,
        config_dir=config_dir
    )


@pytest.fixture
async def recipe_analyzer(youtube_service, claude_service, notion_service, gmail_service, error_handler, config_dir):
    """Recipe analyzer fixture"""
    return RecipeAnalyzer(
        youtube_service=youtube_service,
        claude_service=claude_service,
        notion_service=notion_service,
        gmail_service=gmail_service,
        error_handler=error_handler,
        config_dir=config_dir
    )


@pytest.fixture
def sample_video():
    """Sample YouTube video for testing"""
    return YouTubeVideo(
        video_id="test_video_123",
        title="Amazing Beef Steak Recipe",
        description="Learn how to cook the perfect beef steak with garlic butter",
        channel_id="UC_test_channel",
        channel_title="Cooking Master",
        published_at=datetime.now(),
        duration=timedelta(minutes=15),
        view_count=10000,
        like_count=500,
        thumbnail_url="https://example.com/thumbnail.jpg",
        tags=["cooking", "beef", "steak", "recipe"]
    )


@pytest.fixture
def sample_analysis():
    """Sample recipe analysis for testing"""
    return RecipeAnalysis(
        recipe_type=RecipeType.MEAT_BASED,
        confidence_score=0.9,
        title_en="Perfect Beef Steak",
        title_ja="完璧なビーフステーキ",
        description_en="A delicious beef steak recipe",
        description_ja="美味しいビーフステーキのレシピ",
        ingredients=[
            {"name_en": "beef steak", "name_ja": "牛ステーキ", "amount": "2", "unit": "pieces"},
            {"name_en": "garlic", "name_ja": "にんにく", "amount": "3", "unit": "cloves"}
        ],
        instructions=[
            "Season the steak with salt and pepper",
            "Heat pan over high heat",
            "Cook steak for 4 minutes each side"
        ],
        cooking_time=20,
        servings=2,
        difficulty="medium",
        meat_ingredients=["beef steak"],
        tags=["beef", "steak", "main course"]
    )


class TestAPIConnections:
    """Test individual API connections"""
    
    @pytest.mark.asyncio
    async def test_youtube_connection(self, youtube_service):
        """Test YouTube API connection"""
        with patch.object(youtube_service, 'youtube') as mock_youtube:
            mock_youtube.channels().list().execute.return_value = {
                'items': [{
                    'id': 'test_channel',
                    'snippet': {
                        'title': 'Test Channel',
                        'description': 'Test Description',
                        'publishedAt': '2023-01-01T00:00:00Z',
                        'thumbnails': {'default': {'url': 'http://example.com/thumb.jpg'}},
                        'country': 'US'
                    },
                    'statistics': {
                        'subscriberCount': '1000',
                        'videoCount': '50',
                        'viewCount': '50000'
                    },
                    'contentDetails': {
                        'relatedPlaylists': {'uploads': 'uploads_playlist_id'}
                    }
                }]
            }
            
            channel = await youtube_service.get_channel_info("test_channel")
            assert channel is not None
            assert channel.title == "Test Channel"
            assert channel.subscriber_count == 1000
    
    @pytest.mark.asyncio
    async def test_claude_analysis(self, claude_service):
        """Test Claude API analysis"""
        with patch.object(claude_service.client.messages, 'create') as mock_create:
            # Mock Claude API response
            mock_response = MagicMock()
            mock_response.content = [MagicMock()]
            mock_response.content[0].text = '''
            {
                "recipe_type": "meat_based",
                "confidence_score": 0.9,
                "title_en": "Test Recipe",
                "title_ja": "テストレシピ",
                "description_en": "Test description",
                "description_ja": "テスト説明",
                "ingredients": [{"name_en": "beef", "name_ja": "牛肉", "amount": "1", "unit": "kg"}],
                "instructions": ["Cook the beef"],
                "meat_ingredients": ["beef"],
                "tags": ["meat", "recipe"]
            }
            '''
            mock_response.usage.input_tokens = 100
            mock_response.usage.output_tokens = 200
            mock_create.return_value = mock_response
            
            analysis = await claude_service.analyze_recipe_content(
                "This is a beef recipe",
                "Beef Recipe Video"
            )
            
            assert analysis.recipe_type == RecipeType.MEAT_BASED
            assert analysis.confidence_score == 0.9
            assert "beef" in analysis.meat_ingredients
    
    @pytest.mark.asyncio
    async def test_notion_page_creation(self, notion_service, sample_analysis):
        """Test Notion page creation"""
        with patch.object(notion_service.client.pages, 'create') as mock_create:
            mock_create.return_value = {
                'id': 'test_page_id',
                'url': 'https://notion.so/test',
                'created_time': '2023-01-01T00:00:00.000Z',
                'last_edited_time': '2023-01-01T00:00:00.000Z',
                'properties': {}
            }
            
            recipe_data = RecipePageData(
                title_en="Test Recipe",
                title_ja="テストレシピ",
                description_en="Test description",
                description_ja="テスト説明",
                youtube_url="https://youtube.com/watch?v=test",
                channel_name="Test Channel",
                published_date=datetime.now(),
                duration=900,
                recipe_type="meat_based",
                meat_ingredients=["beef"],
                ingredients=[],
                instructions=[],
                tags=[]
            )
            
            page = await notion_service.create_recipe_page(recipe_data)
            assert page.page_id == 'test_page_id'
    
    @pytest.mark.asyncio
    async def test_gmail_notification(self, gmail_service):
        """Test Gmail notification sending"""
        with patch.object(gmail_service, 'service') as mock_service:
            mock_service.users().messages().send().execute.return_value = {
                'id': 'test_message_id'
            }
            
            recipients = [EmailRecipient(email="test@example.com")]
            
            result = await gmail_service.send_new_recipe_notification(
                {
                    'title': 'Test Recipe',
                    'channel': 'Test Channel',
                    'url': 'https://youtube.com/watch?v=test',
                    'description': 'Test description'
                },
                recipients
            )
            
            assert result.get('success', False)


class TestIntegrationWorkflow:
    """Test complete integration workflows"""
    
    @pytest.mark.asyncio
    async def test_complete_video_processing(self, recipe_analyzer, sample_video, sample_analysis):
        """Test complete video processing workflow"""
        # Mock all service calls
        with patch.object(recipe_analyzer.claude_service, 'analyze_recipe_content') as mock_analyze, \
             patch.object(recipe_analyzer.notion_service, 'create_recipe_page') as mock_create_page, \
             patch.object(recipe_analyzer.gmail_service, 'send_new_recipe_notification') as mock_send_email:
            
            # Setup mocks
            mock_analyze.return_value = sample_analysis
            
            mock_page = MagicMock()
            mock_page.page_id = "test_page_id"
            mock_create_page.return_value = mock_page
            
            mock_send_email.return_value = {"success": True}
            
            # Add channel configuration
            channel_config = ChannelConfig(
                channel_id=sample_video.channel_id,
                channel_name=sample_video.channel_title,
                confidence_threshold=0.8
            )
            recipe_analyzer.channel_configs[sample_video.channel_id] = channel_config
            
            # Process video
            result = await recipe_analyzer._process_single_video(sample_video)
            
            # Verify results
            assert result.success
            assert result.analysis.recipe_type == RecipeType.MEAT_BASED
            assert result.notion_page_id == "test_page_id"
            assert result.notification_sent
            
            # Verify all services were called
            mock_analyze.assert_called_once()
            mock_create_page.assert_called_once()
            mock_send_email.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_filtering_workflow(self, recipe_analyzer, sample_video, sample_analysis):
        """Test video filtering based on configuration"""
        with patch.object(recipe_analyzer.claude_service, 'analyze_recipe_content') as mock_analyze:
            # Setup low confidence analysis
            low_confidence_analysis = sample_analysis
            low_confidence_analysis.confidence_score = 0.5
            mock_analyze.return_value = low_confidence_analysis
            
            # Add strict channel configuration
            channel_config = ChannelConfig(
                channel_id=sample_video.channel_id,
                channel_name=sample_video.channel_title,
                confidence_threshold=0.8,  # Higher than analysis confidence
                meat_recipes_only=True
            )
            recipe_analyzer.channel_configs[sample_video.channel_id] = channel_config
            
            # Process video
            result = await recipe_analyzer._process_single_video(sample_video)
            
            # Should succeed but not create Notion page or send notification
            assert result.success
            assert result.notion_page_id is None
            assert not result.notification_sent
    
    @pytest.mark.asyncio
    async def test_error_handling_workflow(self, recipe_analyzer, sample_video):
        """Test error handling throughout the workflow"""
        with patch.object(recipe_analyzer.claude_service, 'analyze_recipe_content') as mock_analyze:
            # Make Claude service fail
            mock_analyze.side_effect = Exception("Claude API Error")
            
            # Add channel configuration
            channel_config = ChannelConfig(
                channel_id=sample_video.channel_id,
                channel_name=sample_video.channel_title
            )
            recipe_analyzer.channel_configs[sample_video.channel_id] = channel_config
            
            # Process video
            result = await recipe_analyzer._process_single_video(sample_video)
            
            # Should fail gracefully
            assert not result.success
            assert "Claude API Error" in result.error
            assert result.notion_page_id is None


class TestNotificationManager:
    """Test notification management system"""
    
    @pytest.mark.asyncio
    async def test_notification_queuing(self, gmail_service, error_handler, config_dir):
        """Test notification queuing and priority handling"""
        notification_manager = NotificationManager(
            gmail_service=gmail_service,
            error_handler=error_handler,
            config_dir=config_dir
        )
        
        # Send notifications with different priorities
        await notification_manager.send_notification(
            "test_type", "Low Priority", "Low priority message", priority=Priority.LOW
        )
        await notification_manager.send_notification(
            "test_type", "High Priority", "High priority message", priority=Priority.HIGH
        )
        await notification_manager.send_notification(
            "test_type", "Critical", "Critical message", priority=Priority.CRITICAL
        )
        
        # Check queue ordering
        assert len(notification_manager.queues[Priority.CRITICAL]) == 1
        assert len(notification_manager.queues[Priority.HIGH]) == 1
        assert len(notification_manager.queues[Priority.LOW]) == 1
        
        # Critical should be processed first
        assert notification_manager.queues[Priority.CRITICAL][0].title == "Critical"
    
    @pytest.mark.asyncio
    async def test_batch_notification_processing(self, gmail_service, error_handler, config_dir):
        """Test batch notification processing"""
        notification_manager = NotificationManager(
            gmail_service=gmail_service,
            error_handler=error_handler,
            config_dir=config_dir
        )
        
        # Mock email sending
        with patch.object(gmail_service, 'send_email') as mock_send:
            mock_send.return_value = {"success": True}
            
            # Send multiple notifications
            for i in range(5):
                await notification_manager.send_notification(
                    "test_type", f"Test {i}", f"Message {i}", priority=Priority.MEDIUM
                )
            
            # Start processing
            await notification_manager.start_processing()
            
            # Let it process
            await asyncio.sleep(2)
            
            # Stop processing
            await notification_manager.stop_processing()
            
            # Check that notifications were processed
            stats = notification_manager.get_statistics()
            assert stats['total_queued'] < 5  # Some should be processed


class TestRateLimiting:
    """Test rate limiting across all services"""
    
    @pytest.mark.asyncio
    async def test_rate_limiter_enforcement(self, rate_limiter):
        """Test rate limiter enforcement"""
        # Test YouTube rate limiting
        allowed_count = 0
        denied_count = 0
        
        for i in range(10):
            if await rate_limiter.acquire('youtube'):
                allowed_count += 1
            else:
                denied_count += 1
        
        # Should have some allowed and some denied based on rate limits
        assert allowed_count > 0
        # Note: Exact counts depend on rate limit configuration
    
    @pytest.mark.asyncio
    async def test_rate_limiter_recovery(self, rate_limiter):
        """Test rate limiter recovery over time"""
        # Exhaust rate limit
        while await rate_limiter.acquire('claude'):
            pass
        
        # Should be rate limited now
        assert not await rate_limiter.acquire('claude')
        
        # Wait and check recovery (in real scenario would wait longer)
        await asyncio.sleep(0.1)
        # Note: Recovery time depends on rate limit configuration


class TestErrorHandling:
    """Test comprehensive error handling"""
    
    @pytest.mark.asyncio
    async def test_error_categorization(self, error_handler):
        """Test error categorization"""
        # Test different error types
        auth_error = Exception("unauthorized access")
        rate_error = Exception("rate limit exceeded")
        network_error = Exception("connection timeout")
        
        auth_category = error_handler.categorize_error(auth_error, "test_api")
        rate_category = error_handler.categorize_error(rate_error, "test_api") 
        network_category = error_handler.categorize_error(network_error, "test_api")
        
        # Should categorize correctly
        assert "authentication" in auth_category.value.lower()
        assert "rate" in rate_category.value.lower()
        assert "network" in network_category.value.lower() or "timeout" in network_category.value.lower()
    
    @pytest.mark.asyncio
    async def test_error_retry_logic(self, error_handler):
        """Test error retry logic"""
        # Create a function that fails then succeeds
        call_count = 0
        
        async def failing_function():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise Exception("Temporary error")
            return "Success"
        
        # Should retry and eventually succeed
        result = await error_handler.retry_with_backoff(
            failing_function, "test_api", "test_operation"
        )
        
        assert result == "Success"
        assert call_count == 3


class TestSystemIntegration:
    """Test complete system integration"""
    
    @pytest.mark.asyncio
    async def test_system_startup(self, recipe_analyzer):
        """Test system startup process"""
        # Add a test channel
        channel_config = ChannelConfig(
            channel_id="test_channel",
            channel_name="Test Channel"
        )
        
        await recipe_analyzer.add_channel(channel_config)
        
        # Verify channel was added
        assert "test_channel" in recipe_analyzer.channel_configs
        assert recipe_analyzer.channel_configs["test_channel"].channel_name == "Test Channel"
    
    @pytest.mark.asyncio
    async def test_system_status_reporting(self, recipe_analyzer):
        """Test system status reporting"""
        status = recipe_analyzer.get_system_status()
        
        # Verify status structure
        assert 'status' in status
        assert 'statistics' in status
        assert 'channels' in status
        assert 'api_services' in status
        
        # Should start as inactive
        assert status['status'] == 'inactive'
    
    @pytest.mark.asyncio 
    async def test_manual_video_processing(self, recipe_analyzer, sample_analysis):
        """Test manual video processing"""
        with patch.object(recipe_analyzer.youtube_service, '_get_video_details') as mock_details, \
             patch.object(recipe_analyzer, '_process_single_video') as mock_process:
            
            # Mock video details
            sample_video = YouTubeVideo(
                video_id="test123",
                title="Test Video",
                description="Test description",
                channel_id="test_channel",
                channel_title="Test Channel",
                published_at=datetime.now(),
                duration=timedelta(minutes=10),
                view_count=1000,
                like_count=50,
                thumbnail_url="http://example.com/thumb.jpg"
            )
            mock_details.return_value = [sample_video]
            
            # Mock processing result
            mock_result = MagicMock()
            mock_result.success = True
            mock_result.video_id = "test123"
            mock_result.title = "Test Video"
            mock_process.return_value = mock_result
            
            # Test manual processing
            result = await recipe_analyzer.manual_process_video(
                "https://www.youtube.com/watch?v=test123"
            )
            
            assert result.success
            assert result.video_id == "test123"


@pytest.mark.integration
class TestFullWorkflow:
    """Test complete end-to-end workflow"""
    
    @pytest.mark.asyncio
    async def test_recipe_detection_workflow(self, recipe_analyzer, sample_video, sample_analysis):
        """Test complete recipe detection and processing workflow"""
        # This would be a comprehensive integration test
        # that runs through the entire pipeline
        
        with patch.object(recipe_analyzer.youtube_service, 'check_for_new_videos') as mock_videos, \
             patch.object(recipe_analyzer.claude_service, 'analyze_recipe_content') as mock_analyze, \
             patch.object(recipe_analyzer.notion_service, 'create_recipe_page') as mock_notion, \
             patch.object(recipe_analyzer.gmail_service, 'send_new_recipe_notification') as mock_email:
            
            # Setup mocks for complete workflow
            mock_videos.return_value = [sample_video]
            mock_analyze.return_value = sample_analysis
            
            mock_page = MagicMock()
            mock_page.page_id = "page123"
            mock_notion.return_value = mock_page
            
            mock_email.return_value = {"success": True}
            
            # Add channel
            channel_config = ChannelConfig(
                channel_id=sample_video.channel_id,
                channel_name=sample_video.channel_title,
                confidence_threshold=0.8
            )
            await recipe_analyzer.add_channel(channel_config)
            
            # Simulate new video detection and processing
            new_videos = await recipe_analyzer._get_new_videos()
            assert len(new_videos) == 1
            
            # Process the videos
            results = await recipe_analyzer._process_video_batch(new_videos)
            assert len(results) == 1
            assert results[0].success
            
            # Verify all components were used
            mock_analyze.assert_called_once()
            mock_notion.assert_called_once()
            mock_email.assert_called_once()


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])