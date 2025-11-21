# Recipe-DevAPI Agent Implementation (Linux版)

A comprehensive Python implementation of the Recipe-DevAPI Agent with 4 complete API integrations for Linux environments.

## 🚀 Overview

This implementation provides a complete recipe monitoring and analysis system that integrates:

1. **YouTube Data API v3** - Channel monitoring and video detection
2. **Claude API** - Recipe analysis, translation, and meat detection
3. **Notion API** - Database management and page creation  
4. **Gmail API** - Notification system with OAuth authentication

## 📋 Features Implemented

### ✅ Core Functionality
- **YouTube Channel Monitoring**: Real-time detection of new recipe videos
- **Recipe Analysis**: AI-powered content analysis with Claude
- **Meat Detection**: Intelligent detection of meat-based recipes
- **Translation**: English to Japanese recipe translation
- **Database Management**: Automated Notion page creation and management
- **Email Notifications**: HTML email notifications with templates
- **Error Handling**: Comprehensive error tracking and retry logic
- **Rate Limiting**: API-specific rate limiting with multiple strategies
- **Async Processing**: Full asyncio implementation for performance

### ✅ Advanced Features
- **Linux Environment Variable Integration**: Secure credential storage
- **Encrypted Configuration Files**: Additional security layer
- **Caching System**: Intelligent caching for improved performance
- **Batch Processing**: Efficient bulk operations
- **Monitoring Dashboard**: System status and statistics
- **Configuration Management**: JSON-based configuration with validation
- **Logging System**: Structured logging with multiple outputs
- **Testing Suite**: Comprehensive test coverage with integration tests
- **systemd Integration**: Linux service management

## 🏗️ Architecture

```
Recipe-DevAPI Agent
├── config/                    # Configuration management
│   ├── api_manager.py        # Centralized API credential management
│   ├── keychain_manager.py   # macOS Keychain integration
│   ├── rate_limiter.py       # Multi-strategy rate limiting
│   ├── error_handler.py      # Comprehensive error handling
│   └── logger_config.py      # Advanced logging configuration
├── services/                  # Individual API services
│   ├── youtube_service.py    # YouTube Data API v3 integration
│   ├── claude_service.py     # Claude API for analysis/translation
│   ├── notion_service.py     # Notion API for database operations
│   ├── gmail_service.py      # Gmail API with OAuth flow
│   ├── recipe_analyzer.py    # Main orchestration hub
│   └── notification_manager.py # Centralized notification system
└── tests/                     # Comprehensive test suite
    └── test_integration.py   # Integration tests
```

## 🔧 Installation & Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. API Configuration

#### YouTube Data API v3
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable YouTube Data API v3
4. Create API key credentials
5. Store using Linux credential manager:
```python
from config.credentials_manager import LinuxCredentialsManager
creds_manager = LinuxCredentialsManager()
creds_manager.store_credential('YOUTUBE_API_KEY', 'your_api_key_here')
```

#### Claude API
1. Get API key from [Anthropic Console](https://console.anthropic.com/)
2. Store credentials:
```python
creds_manager.store_credential('CLAUDE_API_KEY', 'your_claude_api_key')
```

#### Notion API
1. Create integration at [Notion Integrations](https://www.notion.so/my-integrations)
2. Get Internal Integration Token
3. Create a database and get Database ID
4. Store credentials:
```python
creds_manager.store_credential('NOTION_TOKEN', 'your_notion_token')
creds_manager.store_credential('NOTION_DATABASE_ID', 'your_database_id')
```

#### Gmail API (OAuth)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Gmail API
3. Create OAuth 2.0 credentials
4. Download credentials JSON to `/config/gmail_credentials.json`
5. Run OAuth flow:
```python
from services.gmail_service import initialize_gmail_oauth
credentials = await initialize_gmail_oauth(
    client_id='your_client_id',
    client_secret='your_client_secret',
    scopes=['https://www.googleapis.com/auth/gmail.send'],
    config_dir=Path('./config')
)
```

## 🎯 Usage Examples

### Basic Usage
```python
import asyncio
from main_example import RecipeDevAPIDemo
from pathlib import Path

async def main():
    demo = RecipeDevAPIDemo(Path("./config"))
    await demo.run_complete_demo()

asyncio.run(main())
```

### Individual Service Usage

#### YouTube Service
```python
from services.youtube_service import YouTubeService, MonitoringConfig
from config.rate_limiter import RateLimiter
from config.error_handler import APIErrorHandler

rate_limiter = RateLimiter()
error_handler = APIErrorHandler(Path("./config"))

youtube_service = YouTubeService(
    api_key="your_api_key",
    rate_limiter=rate_limiter,
    error_handler=error_handler
)

# Get channel information
channel = await youtube_service.get_channel_info("UC8C7QblJwCHsYrftuLjGKig")
print(f"Channel: {channel.title} ({channel.subscriber_count:,} subscribers)")

# Get recent videos
videos = await youtube_service.get_recent_videos("UC8C7QblJwCHsYrftuLjGKig", max_results=10)
print(f"Found {len(videos)} recent videos")
```

#### Claude Service
```python
from services.claude_service import ClaudeService, AnalysisType

claude_service = ClaudeService(
    api_key="your_api_key",
    rate_limiter=rate_limiter,
    error_handler=error_handler
)

# Analyze recipe content
analysis = await claude_service.analyze_recipe_content(
    content="Today I'm making beef steak with garlic butter...",
    video_title="Perfect Steak Recipe",
    analysis_types=[
        AnalysisType.RECIPE_EXTRACTION,
        AnalysisType.MEAT_DETECTION,
        AnalysisType.TRANSLATION
    ]
)

print(f"Recipe Type: {analysis.recipe_type.value}")
print(f"Confidence: {analysis.confidence_score}")
print(f"Title (JA): {analysis.title_ja}")
```

#### Notion Service
```python
from services.notion_service import NotionService, RecipePageData
from datetime import datetime

notion_service = NotionService(
    token="your_token",
    database_id="your_database_id",
    rate_limiter=rate_limiter,
    error_handler=error_handler
)

# Create recipe page
recipe_data = RecipePageData(
    title_en="Amazing Pasta Recipe",
    title_ja="素晴らしいパスタレシピ",
    description_en="Learn to make delicious pasta",
    description_ja="美味しいパスタの作り方を学ぶ",
    youtube_url="https://youtube.com/watch?v=example",
    channel_name="Cooking Channel",
    published_date=datetime.now(),
    duration=900,
    recipe_type="vegetarian",
    meat_ingredients=[],
    ingredients=[
        {"name_en": "pasta", "name_ja": "パスタ", "amount": "400", "unit": "g"}
    ],
    instructions=["Boil water", "Cook pasta", "Add sauce"],
    tags=["pasta", "italian", "easy"]
)

page = await notion_service.create_recipe_page(recipe_data)
print(f"Created page: {page.title} ({page.page_id})")
```

#### Gmail Service
```python
from services.gmail_service import GmailService, EmailRecipient

gmail_service = GmailService(
    credentials=your_credentials,
    rate_limiter=rate_limiter,
    error_handler=error_handler,
    config_dir=Path("./config")
)

# Send notification
result = await gmail_service.send_new_recipe_notification(
    {
        'title': 'New Recipe: Chocolate Cake',
        'channel': 'Baking Channel',
        'url': 'https://youtube.com/watch?v=example',
        'description': 'Learn to bake the perfect chocolate cake'
    }
)
print(f"Notification sent: {result.get('success')}")
```

### Complete Integration
```python
from services.recipe_analyzer import RecipeAnalyzer, ChannelConfig

# Initialize all services (see main_example.py for details)
recipe_analyzer = RecipeAnalyzer(
    youtube_service=youtube_service,
    claude_service=claude_service,
    notion_service=notion_service,
    gmail_service=gmail_service,
    error_handler=error_handler,
    config_dir=Path("./config")
)

# Add channel for monitoring
channel_config = ChannelConfig(
    channel_id="UC8C7QblJwCHsYrftuLjGKig",
    channel_name="Sam The Cooking Guy",
    keywords=["recipe", "cooking", "food"],
    confidence_threshold=0.8,
    meat_recipes_only=False
)

await recipe_analyzer.add_channel(channel_config)

# Start monitoring
await recipe_analyzer.start_monitoring()
```

## 📊 Features Detail

### Rate Limiting
- **YouTube**: Sliding window (100 req/s with burst)
- **Claude**: Token bucket (5 req/s with burst capacity)
- **Notion**: Fixed window (3 req/s)
- **Gmail**: Conservative sliding window (2 req/s)

### Error Handling
- Automatic categorization of errors
- Intelligent retry with exponential backoff
- Escalation rules for critical errors
- Comprehensive logging and reporting

### Caching
- YouTube channel info: 5 minutes TTL
- Claude analysis results: 1 hour TTL  
- Notion database schemas: 1 hour TTL

### Notifications
- HTML email templates for different notification types
- Priority-based queuing system
- Rate limiting and quiet hours
- Batch processing capabilities

## 🧪 Testing

### Run Tests
```bash
# Install test dependencies
pip install pytest pytest-asyncio pytest-cov

# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=services --cov=config --cov-report=html
```

### Integration Tests
```bash
# Run integration tests (requires API credentials)
pytest tests/test_integration.py::TestAPIConnections -v

# Run complete workflow tests
pytest tests/test_integration.py::TestFullWorkflow -v -s
```

### Manual Testing
```bash
# Run the complete demonstration
python main_example.py
```

## 📈 Performance Characteristics

- **YouTube API**: Quota-aware with intelligent caching
- **Claude API**: Token usage optimization with result caching
- **Notion API**: Batch operations for efficiency
- **Gmail API**: Template-based generation for speed
- **Overall**: Async processing with configurable concurrency limits

## 🔒 Security Features

- **Credential Storage**: Linux environment variables + encrypted configuration files
- **OAuth Flow**: Complete OAuth 2.0 implementation for Gmail
- **Error Masking**: Sensitive data filtering in logs
- **Rate Limiting**: Protection against API abuse
- **Input Validation**: Comprehensive data validation throughout
- **File Permissions**: Restricted access to configuration files (600)

## 📝 Configuration

### Channel Configuration (`config/channels.json`)
```json
{
  "UC8C7QblJwCHsYrftuLjGKig": {
    "channel_name": "Sam The Cooking Guy",
    "enabled": true,
    "keywords": ["recipe", "cooking", "food"],
    "min_duration": 180,
    "max_duration": 1800,
    "check_interval": 300,
    "meat_recipes_only": false,
    "confidence_threshold": 0.7
  }
}
```

### Notification Configuration (`config/notification_config.json`)
```json
{
  "enabled": true,
  "recipients": [
    {"email": "admin@example.com", "name": "Admin", "type": "to"}
  ],
  "notification_types": ["new_recipe", "error_alert"],
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "08:00",
  "rate_limit": 10,
  "batch_notifications": true
}
```

## 🚨 Error Handling Examples

The system handles various error scenarios:

- **API Authentication Errors**: Automatic credential refresh
- **Rate Limiting**: Intelligent backoff and retry
- **Network Errors**: Exponential retry with circuit breaking
- **Data Validation**: Graceful handling of malformed responses
- **Service Outages**: Fallback mechanisms and error reporting

## 📊 Monitoring & Analytics

### System Status
```python
status = recipe_analyzer.get_system_status()
print(f"Videos processed: {status['statistics']['videos_processed']}")
print(f"Recipes detected: {status['statistics']['recipes_detected']}")
print(f"Success rate: {status['success_rate']:.1%}")
```

### API Usage Statistics
```python
# YouTube quota tracking
youtube_stats = youtube_service.get_quota_status()
print(f"Quota used: {youtube_stats['quota_used']}/{youtube_stats['quota_limit']}")

# Claude token usage
claude_stats = claude_service.get_usage_statistics()
print(f"Tokens used: {claude_stats['tokens_used']}")

# Notion API calls
notion_stats = notion_service.get_usage_statistics()
print(f"Pages created: {notion_stats['pages_created']}")
```

## 🔧 Troubleshooting

### Common Issues

1. **API Credentials Not Found**
   - Verify credentials are stored in macOS Keychain
   - Check credential format (API keys, OAuth tokens)

2. **Rate Limiting**
   - Check rate limit status: `rate_limiter.get_status()`
   - Adjust rate limits in configuration

3. **YouTube Quota Exceeded**
   - Monitor quota usage: `youtube_service.get_quota_status()`
   - Implement quota management strategies

4. **Claude API Errors**
   - Check API key validity
   - Monitor token usage
   - Review request format

5. **Notion Database Issues**
   - Verify database schema: `notion_service.verify_database_schema()`
   - Check integration permissions

6. **Gmail Authentication**
   - Refresh OAuth credentials
   - Check scope permissions
   - Verify client configuration

### Debug Mode
```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Enable detailed logging for specific services
youtube_logger = logging.getLogger('services.youtube')
youtube_logger.setLevel(logging.DEBUG)
```

## 🎯 Next Steps

This implementation provides a solid foundation for recipe monitoring and analysis. Potential enhancements:

1. **Web Interface**: Add Flask/FastAPI web interface
2. **Database Storage**: Add persistent storage for analytics
3. **Machine Learning**: Enhance recipe classification
4. **Multi-language**: Support additional languages
5. **Webhooks**: Add webhook support for real-time notifications
6. **Monitoring**: Add Prometheus/Grafana monitoring
7. **Deployment**: Containerization and cloud deployment

## 📄 License

This implementation is provided as an educational example. Please ensure compliance with all API terms of service when using in production.

## 🤝 Contributing

This is a demonstration implementation. For production use, consider:
- Additional error handling scenarios
- Performance optimizations
- Security hardening
- Comprehensive monitoring
- Load testing and scaling considerations