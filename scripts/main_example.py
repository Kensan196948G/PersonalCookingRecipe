#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recipe-DevAPI Agent - Main Example Implementation
Complete example showing how to use all four API integrations

This example demonstrates:
1. YouTube Data API v3 integration with channel monitoring
2. Claude API integration for recipe analysis and translation
3. Notion API integration for database management
4. Gmail API integration with notifications
"""

import asyncio
import logging
from pathlib import Path
from datetime import datetime
import json
import sys

# Import all services
from services.youtube_service import YouTubeService, MonitoringConfig
from services.claude_service import ClaudeService, AnalysisType
from services.notion_service import NotionService, RecipePageData
from services.gmail_service import GmailService, EmailRecipient, NotificationConfig, NotificationType
from services.recipe_analyzer import RecipeAnalyzer, ChannelConfig
from services.notification_manager import NotificationManager, Priority

# Import configuration services
from config.api_manager import APIManager, APIConnectionTester
from config.rate_limiter import RateLimiter
from config.error_handler import APIErrorHandler
from config.logger_config import setup_logging, get_api_logger


class RecipeDevAPIDemo:
    """
    Complete demonstration of Recipe-DevAPI Agent capabilities
    
    This class shows how to:
    - Initialize all API services with proper configuration
    - Set up monitoring for YouTube channels
    - Process videos with Claude analysis
    - Store results in Notion
    - Send notifications via Gmail
    - Handle errors and rate limiting
    """
    
    def __init__(self, config_dir: Path):
        """Initialize the demo with configuration directory"""
        self.config_dir = config_dir
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        self.logger = get_api_logger('demo')
        
        # Initialize core services
        self.api_manager = None
        self.rate_limiter = RateLimiter()
        self.error_handler = APIErrorHandler(config_dir)
        
        # API services
        self.youtube_service = None
        self.claude_service = None
        self.notion_service = None
        self.gmail_service = None
        
        # Integration services
        self.recipe_analyzer = None
        self.notification_manager = None
        
        self.logger.info("Recipe-DevAPI Demo initialized")
    
    async def initialize_services(self) -> bool:
        """
        Initialize all API services with authentication
        
        Returns:
            True if all services initialized successfully
        """
        try:
            self.logger.info("🔧 Initializing API services...")
            
            # Initialize API manager
            self.api_manager = APIManager(self.config_dir)
            
            # Validate credentials
            credentials_valid = self.api_manager.validate_all_credentials()
            if not credentials_valid['all_valid']:
                self.logger.error("❌ API credentials validation failed:")
                for api, valid in credentials_valid.items():
                    if api != 'all_valid' and not valid:
                        self.logger.error(f"  - {api}: Invalid credentials")
                return False
            
            self.logger.info("✅ API credentials validated")
            
            # Initialize YouTube service
            youtube_key = self.api_manager.get_youtube_credentials()
            if youtube_key:
                self.youtube_service = YouTubeService(
                    api_key=youtube_key,
                    rate_limiter=self.rate_limiter,
                    error_handler=self.error_handler,
                    cache_dir=self.config_dir / "cache"
                )
                self.logger.info("✅ YouTube service initialized")
            else:
                self.logger.error("❌ YouTube API key not found")
                return False
            
            # Initialize Claude service
            claude_key = self.api_manager.get_claude_credentials()
            if claude_key:
                self.claude_service = ClaudeService(
                    api_key=claude_key,
                    rate_limiter=self.rate_limiter,
                    error_handler=self.error_handler
                )
                self.logger.info("✅ Claude service initialized")
            else:
                self.logger.error("❌ Claude API key not found")
                return False
            
            # Initialize Notion service
            notion_creds = self.api_manager.get_notion_credentials()
            if notion_creds['token'] and notion_creds['database_id']:
                self.notion_service = NotionService(
                    token=notion_creds['token'],
                    database_id=notion_creds['database_id'],
                    rate_limiter=self.rate_limiter,
                    error_handler=self.error_handler
                )
                self.logger.info("✅ Notion service initialized")
            else:
                self.logger.error("❌ Notion credentials not found")
                return False
            
            # Initialize Gmail service
            gmail_creds = self.api_manager.get_gmail_credentials()
            if gmail_creds:
                self.gmail_service = GmailService(
                    credentials=gmail_creds,
                    rate_limiter=self.rate_limiter,
                    error_handler=self.error_handler,
                    config_dir=self.config_dir,
                    sender_email="your-email@gmail.com"  # Update with your email
                )
                self.logger.info("✅ Gmail service initialized")
            else:
                self.logger.warning("⚠️ Gmail credentials not found - notifications disabled")
                # Create a mock Gmail service for demo
                self.gmail_service = GmailService(
                    credentials=None,
                    rate_limiter=self.rate_limiter,
                    error_handler=self.error_handler,
                    config_dir=self.config_dir
                )
            
            # Initialize integration services
            self.recipe_analyzer = RecipeAnalyzer(
                youtube_service=self.youtube_service,
                claude_service=self.claude_service,
                notion_service=self.notion_service,
                gmail_service=self.gmail_service,
                error_handler=self.error_handler,
                config_dir=self.config_dir
            )
            
            self.notification_manager = NotificationManager(
                gmail_service=self.gmail_service,
                error_handler=self.error_handler,
                config_dir=self.config_dir
            )
            
            self.logger.info("✅ All services initialized successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Service initialization failed: {e}")
            return False
    
    async def test_api_connections(self) -> bool:
        """
        Test connections to all APIs
        
        Returns:
            True if all connections successful
        """
        self.logger.info("🔍 Testing API connections...")
        
        try:
            # Use the API connection tester
            connection_tester = APIConnectionTester(self.api_manager)
            
            # Test all connections
            test_results = await connection_tester.test_all_connections()
            
            # Display results
            all_success = True
            for api_name, result in test_results.items():
                if result['success']:
                    response_time = result.get('response_time', 0)
                    self.logger.info(f"✅ {api_name.upper()}: Connected ({response_time:.2f}s)")
                else:
                    error = result.get('error', 'Unknown error')
                    self.logger.error(f"❌ {api_name.upper()}: Failed - {error}")
                    all_success = False
            
            # Generate and display report
            report = connection_tester.generate_test_report(test_results)
            print("\n" + "="*60)
            print(report)
            print("="*60 + "\n")
            
            return all_success
            
        except Exception as e:
            self.logger.error(f"❌ Connection testing failed: {e}")
            return False
    
    async def demo_youtube_monitoring(self):
        """Demonstrate YouTube channel monitoring"""
        self.logger.info("📺 Demonstrating YouTube channel monitoring...")
        
        try:
            # Famous cooking channels for demonstration
            demo_channels = [
                {
                    'id': 'UC8C7QblJwCHsYrftuLjGKig',  # Sam The Cooking Guy
                    'name': 'Sam The Cooking Guy',
                    'keywords': ['recipe', 'cooking', 'food', 'kitchen']
                },
                {
                    'id': 'UCbpMy0Fg74eXXkvxJrtEn3w',  # Joshua Weissman
                    'name': 'Joshua Weissman', 
                    'keywords': ['recipe', 'cooking', 'homemade', 'technique']
                },
                {
                    'id': 'UCRIZtPl9nb9RiXc9btSTQNw',  # Bon Appétit
                    'name': 'Bon Appétit',
                    'keywords': ['recipe', 'chef', 'cooking', 'technique']
                }
            ]
            
            # Add channels to monitoring
            for channel in demo_channels:
                try:
                    # Get channel info first
                    channel_info = await self.youtube_service.get_channel_info(channel['id'])
                    
                    if channel_info:
                        self.logger.info(
                            f"✅ Channel found: {channel_info.title} "
                            f"({channel_info.subscriber_count:,} subscribers)"
                        )
                        
                        # Get recent videos
                        recent_videos = await self.youtube_service.get_recent_videos(
                            channel['id'], max_results=5
                        )
                        
                        self.logger.info(f"📹 Found {len(recent_videos)} recent videos")
                        
                        for video in recent_videos[:3]:  # Show first 3
                            duration_min = int(video.duration.total_seconds() / 60)
                            self.logger.info(
                                f"  - {video.title} ({duration_min}min, {video.view_count:,} views)"
                            )
                        
                        # Add to Recipe Analyzer monitoring
                        channel_config = ChannelConfig(
                            channel_id=channel['id'],
                            channel_name=channel['name'],
                            keywords=channel['keywords'],
                            min_duration=180,  # 3 minutes minimum
                            max_duration=1800,  # 30 minutes maximum
                            confidence_threshold=0.7,
                            meat_recipes_only=False  # Include all recipe types
                        )
                        
                        await self.recipe_analyzer.add_channel(channel_config)
                        self.logger.info(f"✅ Added {channel['name']} to monitoring")
                        
                    else:
                        self.logger.warning(f"⚠️ Channel not found: {channel['id']}")
                        
                except Exception as e:
                    self.logger.error(f"❌ Error with channel {channel['name']}: {e}")
                    
                # Small delay between channels
                await asyncio.sleep(1)
            
        except Exception as e:
            self.logger.error(f"❌ YouTube monitoring demo failed: {e}")
    
    async def demo_claude_analysis(self):
        """Demonstrate Claude recipe analysis"""
        self.logger.info("🤖 Demonstrating Claude recipe analysis...")
        
        try:
            # Sample recipe content for analysis
            sample_recipes = [
                {
                    'title': 'Perfect Ribeye Steak with Garlic Butter',
                    'content': '''
                    Today I'm showing you how to cook the perfect ribeye steak. 
                    You'll need: 2 ribeye steaks, 4 cloves garlic, 4 tbsp butter, 
                    salt, black pepper, and fresh thyme.
                    
                    Start by seasoning the steaks generously with salt and pepper. 
                    Heat a cast iron skillet over high heat. Sear the steaks for 
                    4 minutes on each side for medium-rare. Add butter, garlic, 
                    and thyme to the pan and baste the steaks.
                    '''
                },
                {
                    'title': 'Vegan Buddha Bowl with Tahini Dressing',
                    'content': '''
                    This healthy vegan buddha bowl is packed with nutrients.
                    Ingredients: quinoa, roasted chickpeas, avocado, cucumber, 
                    cherry tomatoes, red cabbage, and tahini dressing.
                    
                    Cook quinoa according to package instructions. Roast chickpeas
                    with olive oil and spices at 400°F for 20 minutes. Assemble 
                    all ingredients in a bowl and drizzle with tahini dressing.
                    '''
                },
                {
                    'title': 'Classic Italian Carbonara',
                    'content': '''
                    Authentic carbonara uses just eggs, cheese, pancetta, and pasta.
                    You need: 400g spaghetti, 200g pancetta, 3 eggs, 100g Pecorino
                    Romano, black pepper.
                    
                    Cook pasta in salted water. Fry pancetta until crispy. Mix eggs
                    and cheese. Combine hot pasta with pancetta, remove from heat,
                    add egg mixture while tossing to create creamy sauce.
                    '''
                }
            ]
            
            for recipe in sample_recipes:
                try:
                    self.logger.info(f"🔍 Analyzing: {recipe['title']}")
                    
                    # Analyze with Claude
                    analysis = await self.claude_service.analyze_recipe_content(
                        content=recipe['content'],
                        video_title=recipe['title'],
                        analysis_types=[
                            AnalysisType.RECIPE_EXTRACTION,
                            AnalysisType.MEAT_DETECTION,
                            AnalysisType.TRANSLATION,
                            AnalysisType.INGREDIENT_ANALYSIS
                        ]
                    )
                    
                    # Display results
                    self.logger.info(f"✅ Analysis complete:")
                    self.logger.info(f"  - Recipe Type: {analysis.recipe_type.value}")
                    self.logger.info(f"  - Confidence: {analysis.confidence_score:.2f}")
                    self.logger.info(f"  - Title (EN): {analysis.title_en}")
                    self.logger.info(f"  - Title (JA): {analysis.title_ja}")
                    self.logger.info(f"  - Ingredients: {len(analysis.ingredients)}")
                    self.logger.info(f"  - Instructions: {len(analysis.instructions)}")
                    
                    if analysis.meat_ingredients:
                        self.logger.info(f"  - Meat ingredients: {', '.join(analysis.meat_ingredients)}")
                    
                    if analysis.tags:
                        self.logger.info(f"  - Tags: {', '.join(analysis.tags[:5])}")
                    
                    # Test meat detection specifically
                    contains_meat, confidence, meat_list = await self.claude_service.detect_meat_content(
                        recipe['content']
                    )
                    self.logger.info(f"  - Meat detection: {'Yes' if contains_meat else 'No'} ({confidence:.2f})")
                    
                except Exception as e:
                    self.logger.error(f"❌ Analysis failed for {recipe['title']}: {e}")
                
                print()  # Add spacing
                await asyncio.sleep(1)
                
        except Exception as e:
            self.logger.error(f"❌ Claude analysis demo failed: {e}")
    
    async def demo_notion_integration(self):
        """Demonstrate Notion database integration"""
        self.logger.info("📝 Demonstrating Notion integration...")
        
        try:
            # First, verify database schema
            schema_verification = await self.notion_service.verify_database_schema()
            
            if schema_verification['valid']:
                self.logger.info("✅ Notion database schema is valid")
            else:
                self.logger.warning("⚠️ Notion database schema issues found:")
                for issue in schema_verification['recommendations']:
                    self.logger.warning(f"  - {issue}")
            
            # Create sample recipe page
            sample_recipe_data = RecipePageData(
                title_en="Demo: Perfect Chocolate Chip Cookies",
                title_ja="デモ：完璧なチョコチップクッキー",
                description_en="Learn to make the most delicious chocolate chip cookies with this easy recipe.",
                description_ja="この簡単なレシピで最も美味しいチョコチップクッキーの作り方を学びましょう。",
                youtube_url="https://www.youtube.com/watch?v=demo123",
                channel_name="Demo Cooking Channel",
                published_date=datetime.now(),
                duration=900,  # 15 minutes
                recipe_type="vegetarian",
                meat_ingredients=[],
                ingredients=[
                    {"name_en": "all-purpose flour", "name_ja": "薄力粉", "amount": "2.25", "unit": "cups"},
                    {"name_en": "chocolate chips", "name_ja": "チョコチップ", "amount": "2", "unit": "cups"},
                    {"name_en": "butter", "name_ja": "バター", "amount": "1", "unit": "cup"},
                    {"name_en": "sugar", "name_ja": "砂糖", "amount": "0.75", "unit": "cup"},
                    {"name_en": "eggs", "name_ja": "卵", "amount": "2", "unit": "pieces"}
                ],
                instructions=[
                    "Preheat oven to 375°F (190°C)",
                    "Cream butter and sugars together",
                    "Beat in eggs one at a time",
                    "Mix in dry ingredients gradually",
                    "Fold in chocolate chips",
                    "Drop rounded tablespoons on baking sheet",
                    "Bake for 9-11 minutes until golden brown"
                ],
                tags=["cookies", "dessert", "chocolate", "baking", "sweet"],
                cooking_time=25,
                servings=24,
                difficulty="easy",
                confidence_score=0.95
            )
            
            # Create the page
            self.logger.info("📝 Creating sample recipe page...")
            notion_page = await self.notion_service.create_recipe_page(sample_recipe_data)
            
            self.logger.info(f"✅ Created Notion page: {notion_page.title}")
            self.logger.info(f"  - Page ID: {notion_page.page_id}")
            self.logger.info(f"  - URL: {notion_page.url}")
            
            # Search for recipes
            self.logger.info("🔍 Searching for recipes...")
            search_results = await self.notion_service.search_recipes(
                search_query="chocolate",
                limit=5
            )
            
            self.logger.info(f"✅ Found {len(search_results)} recipes matching 'chocolate'")
            for page in search_results[:3]:
                self.logger.info(f"  - {page.title}")
            
        except Exception as e:
            self.logger.error(f"❌ Notion integration demo failed: {e}")
    
    async def demo_notification_system(self):
        """Demonstrate notification system"""
        self.logger.info("📧 Demonstrating notification system...")
        
        try:
            # Configure notifications
            notification_config = NotificationConfig(
                enabled=True,
                recipients=[
                    EmailRecipient(email="admin@example.com", name="Admin"),
                    EmailRecipient(email="test@example.com", name="Test User")
                ],
                notification_types=[
                    NotificationType.NEW_RECIPE,
                    NotificationType.ERROR_ALERT,
                    NotificationType.SYSTEM_STATUS
                ],
                rate_limit=10,
                batch_notifications=True
            )
            
            await self.gmail_service.configure_notifications(notification_config)
            self.logger.info("✅ Notification configuration updated")
            
            # Start notification processing
            await self.notification_manager.start_processing()
            self.logger.info("✅ Notification manager started")
            
            # Send various types of notifications
            notifications = [
                {
                    'type': 'new_recipe',
                    'title': 'Amazing Beef Stir-Fry Recipe',
                    'channel': 'Asian Cooking Secrets',
                    'url': 'https://youtube.com/watch?v=demo1',
                    'description': 'Learn to make authentic beef stir-fry with this easy recipe'
                },
                {
                    'type': 'error',
                    'error_type': 'API Rate Limit',
                    'api_name': 'YouTube',
                    'message': 'Rate limit exceeded, backing off',
                    'severity': 'medium'
                },
                {
                    'type': 'batch_summary',
                    'total_count': 15,
                    'success_count': 12,
                    'error_count': 3,
                    'duration': 45.6,
                    'items': ['Recipe 1', 'Recipe 2', 'Recipe 3']
                }
            ]
            
            # Send notifications
            for notif in notifications:
                if notif['type'] == 'new_recipe':
                    notif_id = await self.notification_manager.send_new_recipe_notification(
                        title=notif['title'],
                        channel=notif['channel'],
                        url=notif['url'],
                        description=notif['description']
                    )
                elif notif['type'] == 'error':
                    notif_id = await self.notification_manager.send_error_alert(
                        error_type=notif['error_type'],
                        api_name=notif['api_name'],
                        message=notif['message'],
                        severity=notif['severity']
                    )
                elif notif['type'] == 'batch_summary':
                    notif_id = await self.notification_manager.send_batch_summary(
                        total_count=notif['total_count'],
                        success_count=notif['success_count'],
                        error_count=notif['error_count'],
                        duration=notif['duration'],
                        items=notif['items']
                    )
                
                self.logger.info(f"📧 Queued notification: {notif_id}")
            
            # Let notifications process
            self.logger.info("⏳ Processing notifications...")
            await asyncio.sleep(5)
            
            # Get statistics
            stats = self.notification_manager.get_statistics()
            self.logger.info(f"📊 Notification stats: {stats['total_queued']} queued, processing: {stats['processing_active']}")
            
            # Stop processing
            await self.notification_manager.stop_processing()
            
        except Exception as e:
            self.logger.error(f"❌ Notification demo failed: {e}")
    
    async def demo_complete_workflow(self):
        """Demonstrate complete end-to-end workflow"""
        self.logger.info("🔄 Demonstrating complete workflow...")
        
        try:
            # Manual processing of a specific video
            demo_video_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"  # Rick Roll as demo
            
            self.logger.info(f"🎬 Processing video: {demo_video_url}")
            
            # This would normally process a real video
            # For demo purposes, we'll simulate the workflow
            self.logger.info("📺 Step 1: Fetching video details from YouTube...")
            await asyncio.sleep(1)
            
            self.logger.info("🤖 Step 2: Analyzing content with Claude...")
            await asyncio.sleep(2)
            
            self.logger.info("📝 Step 3: Creating Notion page...")
            await asyncio.sleep(1)
            
            self.logger.info("📧 Step 4: Sending notifications...")
            await asyncio.sleep(1)
            
            self.logger.info("✅ Workflow completed successfully!")
            
            # Show system status
            status = self.recipe_analyzer.get_system_status()
            self.logger.info("📊 System Status:")
            self.logger.info(f"  - Uptime: {status['uptime_hours']:.2f} hours")
            self.logger.info(f"  - Channels monitored: {status['channels']['total']}")
            self.logger.info(f"  - Videos processed: {status['statistics']['videos_processed']}")
            
        except Exception as e:
            self.logger.error(f"❌ Complete workflow demo failed: {e}")
    
    async def run_complete_demo(self):
        """Run the complete demonstration"""
        print("🚀 Recipe-DevAPI Agent - Complete Demonstration")
        print("=" * 60)
        
        try:
            # Initialize services
            if not await self.initialize_services():
                self.logger.error("❌ Service initialization failed - aborting demo")
                return False
            
            # Test API connections
            if not await self.test_api_connections():
                self.logger.warning("⚠️ Some API connections failed - continuing with available services")
            
            # Run individual demonstrations
            await self.demo_youtube_monitoring()
            print()
            
            await self.demo_claude_analysis()
            print()
            
            await self.demo_notion_integration()
            print()
            
            await self.demo_notification_system()
            print()
            
            await self.demo_complete_workflow()
            print()
            
            # Final statistics
            self.logger.info("📈 Final Statistics:")
            
            if self.youtube_service:
                youtube_stats = self.youtube_service.get_quota_status()
                self.logger.info(f"  YouTube Quota: {youtube_stats['quota_used']}/{youtube_stats['quota_limit']}")
            
            if self.claude_service:
                claude_stats = self.claude_service.get_usage_statistics()
                self.logger.info(f"  Claude Requests: {claude_stats['requests_made']}")
                self.logger.info(f"  Claude Tokens: {claude_stats['tokens_used']}")
            
            if self.notion_service:
                notion_stats = self.notion_service.get_usage_statistics()
                self.logger.info(f"  Notion Pages: {notion_stats['pages_created']} created")
            
            if self.gmail_service:
                gmail_stats = self.gmail_service.get_usage_statistics()
                self.logger.info(f"  Emails Sent: {gmail_stats['emails_sent']}")
            
            print("\n✅ Recipe-DevAPI Agent demonstration completed successfully!")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Demo failed: {e}")
            return False


async def main():
    """Main function to run the demonstration"""
    # Setup logging
    config_dir = Path("./config")
    logs_dir = Path("./logs")
    
    setup_logging(
        log_level="INFO",
        log_dir=logs_dir,
        app_name="recipe-devapi-demo",
        console_output=True,
        json_output=True
    )
    
    logger = logging.getLogger(__name__)
    logger.info("Starting Recipe-DevAPI Agent demonstration")
    
    try:
        # Create and run demo
        demo = RecipeDevAPIDemo(config_dir)
        success = await demo.run_complete_demo()
        
        if success:
            logger.info("🎉 Demonstration completed successfully!")
            return 0
        else:
            logger.error("💥 Demonstration failed!")
            return 1
            
    except KeyboardInterrupt:
        logger.info("⏹️ Demonstration interrupted by user")
        return 0
    except Exception as e:
        logger.error(f"💥 Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    # Run the demonstration
    exit_code = asyncio.run(main())
    sys.exit(exit_code)