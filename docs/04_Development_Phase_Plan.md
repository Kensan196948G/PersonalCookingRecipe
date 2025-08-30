# PersonalCookingRecipe 開発フェーズ計画書

## 文書情報
- **プロジェクト名**: PersonalCookingRecipe
- **文書タイトル**: 開発フェーズ計画書
- **版数**: 1.0
- **作成日**: 2025-08-07
- **作成者**: Recipe-CTO Agent

---

## 1. 開発計画概要

### 1.1 プロジェクト目標

**主要目標:**
- macOS環境での3チャンネル統合レシピ監視システム構築
- Claude AIによる高品質レシピ解析・翻訳システム実装
- Notionデータベース自動管理システム構築
- 24時間365日の安定した自動運用システム実現

**成功指標:**
- システム稼働率: 99.5%以上
- 1日あたりレシピ処理数: 10-17件
- API成功率: 95%以上
- 処理時間: 1動画あたり5分以内

### 1.2 開発方法論

**採用フレームワーク: SPARC (Specification, Pseudocode, Architecture, Refinement, Completion)**

1. **Specification**: 詳細要件定義
2. **Pseudocode**: アルゴリズム設計  
3. **Architecture**: システム設計
4. **Refinement**: TDD実装・改善
5. **Completion**: 統合・本番化

**開発原則:**
- テスト駆動開発 (TDD)
- macOS固有機能最大活用
- セキュリティファースト設計
- 継続的統合・継続的デプロイ

---

## 2. フェーズ別開発計画

### 2.1 Phase 1: 基盤構築フェーズ (Week 1)

#### 目標
macOS環境でのシステム基盤構築と認証システム実装

#### 主要成果物

**1.1 環境構築・設定 (Day 1-2)**
```bash
# 自動セットアップスクリプト開発
./scripts/install.sh
├── Homebrew環境確認・インストール
├── Python 3.11+ 仮想環境構築
├── 依存関係自動インストール
├── ディレクトリ構造自動生成
└── macOS権限設定確認
```

**1.2 セキュリティ基盤実装 (Day 2-3)**
```python
# macOS Keychain統合実装
config/keychain_manager.py
├── SecKeychainAddGenericPassword 実装
├── SecKeychainFindGenericPassword 実装  
├── 暗号化キー管理機能
├── アクセス制御設定
└── エラーハンドリング・ログ機能
```

**1.3 設定管理システム (Day 3-4)**
```python
# 統合設定管理
config/settings.py
├── チャンネル設定管理
├── API認証設定
├── 監視間隔・制限設定
├── ログレベル・出力設定
└── macOS通知設定
```

**1.4 基盤テスト・検証 (Day 5-7)**
```python
# 基盤機能テスト実装
tests/test_foundation.py
├── Keychain読み書きテスト
├── 設定読み込みテスト
├── 権限確認テスト
├── macOS通知テスト
└── 統合テストスイート
```

#### 受入基準
- [ ] 自動セットアップが完全動作する
- [ ] Keychainへの認証情報保存・取得が動作する
- [ ] macOSネイティブ通知が正常表示される
- [ ] 基盤テストが全てパスする
- [ ] 設定ファイルの読み込みが正常動作する

---

### 2.2 Phase 2: コアサービス開発フェーズ (Week 2-3)

#### 目標  
YouTube監視、AI解析、Notion連携の各コアサービス実装

#### 2.2.1 YouTube Monitor Service 開発 (Week 2 前半)

**アーキテクチャ設計**
```python
services/youtube_monitor.py
├── ChannelManager: チャンネル管理
├── VideoFetcher: 動画取得・メタデータ抽出
├── ContentFilter: 肉料理フィルタリング
├── CacheManager: キャッシュ管理
└── RateLimitManager: API制限管理
```

**実装スケジュール (5日間)**

**Day 1-2: Core Implementation**
```python
# YouTube API統合実装
async def fetch_channel_videos(channel_id: str, max_results: int = 50):
    """チャンネルの新動画取得"""
    youtube = build('youtube', 'v3', developerKey=await get_api_key())
    
    # 最新動画取得
    search_response = youtube.search().list(
        channelId=channel_id,
        part='snippet',
        order='date',
        type='video',
        maxResults=max_results
    ).execute()
    
    return process_video_list(search_response['items'])

async def filter_meat_recipes(videos: List[dict]) -> List[dict]:
    """肉料理レシピフィルタリング"""
    meat_keywords = [
        'beef', 'pork', 'chicken', 'steak', 'bbq', 'grill',
        'meat', 'ribs', 'burger', 'sausage', 'bacon'
    ]
    
    filtered_videos = []
    for video in videos:
        if any(keyword in video['title'].lower() or 
               keyword in video['description'].lower() 
               for keyword in meat_keywords):
            filtered_videos.append(video)
    
    return filtered_videos
```

**Day 3-4: Advanced Features**
```python
# 重複検出・品質フィルタリング
async def detect_duplicates(new_videos: List[dict]) -> List[dict]:
    """重複動画検出・除去"""
    processed_videos = load_processed_videos()
    unique_videos = []
    
    for video in new_videos:
        if not is_duplicate(video, processed_videos):
            unique_videos.append(video)
    
    return unique_videos

# キャッシュ管理システム
class VideoCache:
    def __init__(self, cache_dir: Path):
        self.cache_dir = cache_dir
        self.memory_cache = {}
        self.cache_ttl = 3600  # 1時間
    
    async def get_cached_data(self, cache_key: str):
        # メモリキャッシュ → ディスクキャッシュ → API
        pass
```

**Day 5: Testing & Integration**
```python
# 包括的テストスイート
@pytest.mark.asyncio
async def test_youtube_monitor_integration():
    monitor = YouTubeMonitor()
    
    # API接続テスト
    videos = await monitor.fetch_new_videos('UC8C7QblJwCHsYrftuLjGKig')
    assert len(videos) > 0
    
    # フィルタリングテスト
    filtered = await monitor.filter_meat_recipes(videos)
    assert all('meat' in v['title'].lower() for v in filtered[:5])
    
    # 重複検出テスト
    unique = await monitor.detect_duplicates(filtered)
    assert len(unique) <= len(filtered)
```

#### 2.2.2 AI Analysis Engine 開発 (Week 2 後半)

**アーキテクチャ設計**
```python
services/claude_analyzer.py
├── PromptManager: チャンネル特化プロンプト管理
├── ClaudeClient: Claude API通信
├── LanguageProcessor: 翻訳・構造化処理
├── RecipeExtractor: レシピ情報抽出
└── QualityValidator: 解析品質検証
```

**実装スケジュール (5日間)**

**Day 1-2: Claude API統合**
```python
import anthropic
from typing import Dict, List

class ClaudeAnalyzer:
    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-3-haiku-20240307"
        
    async def analyze_video_content(self, video_data: dict, channel_type: str) -> dict:
        """チャンネル特化レシピ解析"""
        prompt = self.build_channel_specific_prompt(video_data, channel_type)
        
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=2000,
            temperature=0.1,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )
        
        return self.parse_analysis_response(response.content[0].text)

    def build_channel_specific_prompt(self, video_data: dict, channel_type: str) -> str:
        """チャンネル別解析プロンプト生成"""
        base_prompt = f"""
動画情報:
タイトル: {video_data['title']}
説明: {video_data['description']}
チャンネル: {video_data['channel_name']}

以下の形式で日本語レシピを構造化してください:
"""
        
        if channel_type == "sam_cooking_guy":
            return base_prompt + self.SAM_SPECIFIC_INSTRUCTIONS
        elif channel_type == "tasty_recipes":
            return base_prompt + self.TASTY_SPECIFIC_INSTRUCTIONS
        elif channel_type == "joshua_weissman":
            return base_prompt + self.JOSHUA_SPECIFIC_INSTRUCTIONS
```

**Day 3-4: 高度な解析機能**
```python
# レシピ構造化・品質評価
async def extract_recipe_components(self, analysis_text: str) -> dict:
    """解析テキストからレシピ要素抽出"""
    return {
        'title_ja': self.extract_japanese_title(analysis_text),
        'ingredients': self.extract_ingredients_list(analysis_text),
        'instructions': self.extract_cooking_steps(analysis_text),
        'cooking_time': self.extract_cooking_time(analysis_text),
        'difficulty': self.assess_difficulty(analysis_text),
        'tips': self.extract_cooking_tips(analysis_text),
        'quality_score': self.calculate_quality_score(analysis_text)
    }

def calculate_quality_score(self, analysis_text: str) -> float:
    """レシピ品質スコア算出"""
    score = 0.0
    
    # 要素完全性評価
    if self.has_complete_ingredients(analysis_text): score += 0.3
    if self.has_clear_instructions(analysis_text): score += 0.3
    if self.has_timing_information(analysis_text): score += 0.2
    if self.has_cooking_tips(analysis_text): score += 0.2
    
    return min(score, 1.0)
```

**Day 5: Testing & Optimization**
```python
@pytest.mark.asyncio
async def test_claude_analysis_quality():
    analyzer = ClaudeAnalyzer(test_api_key)
    
    # 各チャンネルタイプでの解析テスト
    for channel_type in ['sam_cooking_guy', 'tasty_recipes', 'joshua_weissman']:
        result = await analyzer.analyze_video_content(sample_video_data, channel_type)
        
        assert result['quality_score'] > 0.7
        assert len(result['ingredients']) > 0
        assert len(result['instructions']) > 0
        assert result['title_ja'] is not None
```

#### 2.2.3 Notion Publisher Service 開発 (Week 3)

**アーキテクチャ設計**
```python
services/notion_client.py
├── TemplateEngine: チャンネル別テンプレート管理
├── NotionClient: Notion API統合
├── DatabaseManager: データベース操作
├── MediaEmbedder: YouTube動画埋め込み
└── PropertyManager: プロパティ管理
```

**実装スケジュール (7日間)**

**Day 1-3: Notion API統合**
```python
from notion_client import Client
from typing import Dict, List, Optional

class NotionPublisher:
    def __init__(self, notion_token: str, database_id: str):
        self.notion = Client(auth=notion_token)
        self.database_id = database_id
        
    async def create_recipe_page(self, recipe_data: dict) -> str:
        """レシピページ作成"""
        page_template = self.generate_page_template(recipe_data)
        
        page = self.notion.pages.create(
            parent={"database_id": self.database_id},
            properties=page_template['properties'],
            children=page_template['content_blocks']
        )
        
        return page['id']

    def generate_page_template(self, recipe_data: dict) -> dict:
        """チャンネル特化テンプレート生成"""
        channel = recipe_data['source_video']['channel_name']
        
        if 'Sam The Cooking Guy' in channel:
            return self.create_sam_template(recipe_data)
        elif 'Tasty' in channel:
            return self.create_tasty_template(recipe_data)
        elif 'Joshua Weissman' in channel:
            return self.create_joshua_template(recipe_data)

    def create_sam_template(self, recipe_data: dict) -> dict:
        """Sam専用ページテンプレート"""
        return {
            'properties': {
                'Name': {
                    'title': [{'text': {'content': f"🍖 {recipe_data['title_ja']}"}}]
                },
                'Channel': {'select': {'name': 'Sam The Cooking Guy'}},
                'Difficulty': {'select': {'name': '★★☆ 実用派'}},
                'Cook Time': {'rich_text': [{'text': {'content': recipe_data['cooking_time']}}]},
                'Quality Score': {'number': recipe_data['quality_score']},
                'Tags': {'multi_select': [
                    {'name': '家庭料理'}, {'name': '実用的'}, {'name': 'BBQ'}
                ]}
            },
            'content_blocks': self.build_sam_content_blocks(recipe_data)
        }
```

**Day 4-5: リッチコンテンツ生成**
```python
# YouTube動画埋め込み・リッチテキスト生成
def build_sam_content_blocks(self, recipe_data: dict) -> List[dict]:
    """Sam用コンテンツブロック構築"""
    blocks = []
    
    # YouTube動画埋め込み
    blocks.append({
        'object': 'block',
        'type': 'video',
        'video': {
            'type': 'external',
            'external': {'url': recipe_data['source_video']['url']}
        }
    })
    
    # レシピ概要
    blocks.append({
        'object': 'block',
        'type': 'heading_2',
        'heading_2': {
            'rich_text': [{'text': {'content': '🏠 家庭での再現ポイント'}}]
        }
    })
    
    # 材料リスト
    blocks.append({
        'object': 'block', 
        'type': 'bulleted_list_item',
        'bulleted_list_item': {
            'rich_text': [{'text': {'content': ingredient}}]
        }
    } for ingredient in recipe_data['ingredients'])
    
    return blocks

# データベース管理機能
async def setup_database_schema(self) -> bool:
    """Notionデータベース構造設定"""
    try:
        database = self.notion.databases.update(
            database_id=self.database_id,
            properties={
                'Name': {'title': {}},
                'Channel': {
                    'select': {
                        'options': [
                            {'name': 'Sam The Cooking Guy', 'color': 'orange'},
                            {'name': 'Tasty Recipes', 'color': 'pink'},
                            {'name': 'Joshua Weissman', 'color': 'purple'}
                        ]
                    }
                },
                'Difficulty': {
                    'select': {
                        'options': [
                            {'name': '★☆☆ 初心者', 'color': 'green'},
                            {'name': '★★☆ 実用派', 'color': 'yellow'},
                            {'name': '★★★ プロ級', 'color': 'red'}
                        ]
                    }
                },
                'Quality Score': {'number': {}},
                'Cook Time': {'rich_text': {}},
                'Tags': {'multi_select': {}}
            }
        )
        return True
    except Exception as e:
        logger.error("Database setup failed", error=str(e))
        return False
```

**Day 6-7: Testing & Optimization**
```python
@pytest.mark.asyncio
async def test_notion_integration():
    publisher = NotionPublisher(test_notion_token, test_database_id)
    
    # データベース設定テスト
    assert await publisher.setup_database_schema()
    
    # ページ作成テスト
    page_id = await publisher.create_recipe_page(sample_recipe_data)
    assert page_id is not None
    
    # テンプレート品質テスト
    for channel in ['sam', 'tasty', 'joshua']:
        template = publisher.generate_page_template({
            **sample_recipe_data,
            'source_video': {'channel_name': channel}
        })
        assert len(template['content_blocks']) > 0
        assert 'properties' in template
```

#### 受入基準 Phase 2
- [ ] 3チャンネル全てから動画取得が正常動作する
- [ ] Claude AIによる解析品質スコア0.7以上を達成
- [ ] Notionページが適切なテンプレートで作成される
- [ ] 各サービスの統合テストが全てパス
- [ ] API エラーハンドリングが正常動作する

---

### 2.3 Phase 3: 統合・運用システム開発フェーズ (Week 4)

#### 目標
サービス統合、自動運用システム実装、本番化準備

#### 3.1 メインオーケストレーションシステム (Day 1-2)

```python
# main.py - メイン処理オーケストレーション
import asyncio
from typing import List, Dict
from services.youtube_monitor import YouTubeMonitor
from services.claude_analyzer import ClaudeAnalyzer
from services.notion_client import NotionPublisher
from services.notification_service import NotificationService

class RecipeMonitorOrchestrator:
    def __init__(self):
        self.youtube_monitor = YouTubeMonitor()
        self.claude_analyzer = ClaudeAnalyzer()
        self.notion_publisher = NotionPublisher()
        self.notification_service = NotificationService()
        
    async def run_monitoring_cycle(self) -> Dict[str, int]:
        """メイン監視サイクル実行"""
        logger.info("Starting monitoring cycle")
        results = {'processed': 0, 'failed': 0, 'skipped': 0}
        
        try:
            # 1. 各チャンネル並行監視
            channel_results = await asyncio.gather(*[
                self.process_channel('sam_cooking_guy'),
                self.process_channel('tasty_recipes'),
                self.process_channel('joshua_weissman')
            ], return_exceptions=True)
            
            # 2. 結果統合・重複除去
            all_videos = self.merge_channel_results(channel_results)
            unique_videos = await self.remove_duplicates(all_videos)
            
            # 3. 優先度順処理
            priority_videos = self.sort_by_priority(unique_videos)
            
            # 4. バッチ処理実行
            for video in priority_videos[:20]:  # 上位20件
                try:
                    await self.process_single_video(video)
                    results['processed'] += 1
                except Exception as e:
                    logger.error("Video processing failed", video_id=video['id'], error=str(e))
                    results['failed'] += 1
            
            # 5. サマリー通知
            await self.send_summary_notification(results)
            
        except Exception as e:
            logger.error("Monitoring cycle failed", error=str(e))
            await self.send_error_notification(str(e))
        
        return results

    async def process_single_video(self, video_data: dict):
        """単一動画の完全処理パイプライン"""
        # AI解析
        analysis = await self.claude_analyzer.analyze_video_content(
            video_data, 
            video_data['channel_type']
        )
        
        # 品質チェック
        if analysis['quality_score'] < 0.6:
            logger.warning("Low quality analysis", video_id=video_data['id'])
            return
        
        # Notion登録
        page_id = await self.notion_publisher.create_recipe_page(analysis)
        
        # 通知送信
        await self.notification_service.send_new_recipe_notification(analysis)
        
        # キャッシュ更新
        await self.update_processed_cache(video_data['id'], page_id)
        
        logger.info("Video processed successfully", 
                   video_id=video_data['id'], 
                   page_id=page_id)
```

#### 3.2 macOS LaunchDaemon統合 (Day 2-3)

```xml
<!-- launchd/com.tasty.recipe.monitor.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" 
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.tasty.recipe.monitor</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/Users/USERNAME/Developer/tasty-recipe-monitor/venv/bin/python</string>
        <string>/Users/USERNAME/Developer/tasty-recipe-monitor/main.py</string>
        <string>--mode=production</string>
    </array>
    
    <key>StartInterval</key>
    <integer>3600</integer>  <!-- 1時間毎実行 -->
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <false/>
    
    <key>StandardOutPath</key>
    <string>/Users/USERNAME/Developer/tasty-recipe-monitor/logs/application.log</string>
    
    <key>StandardErrorPath</key>
    <string>/Users/USERNAME/Developer/tasty-recipe-monitor/logs/error.log</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
        <key>PYTHONPATH</key>
        <string>/Users/USERNAME/Developer/tasty-recipe-monitor</string>
    </dict>
    
    <key>ProcessType</key>
    <string>Background</string>
    
    <key>LimitLoadToSessionType</key>
    <string>Aqua</string>
</dict>
</plist>
```

```python
# scripts/setup_launchd.py - LaunchDaemon自動セットアップ
import os
import shutil
from pathlib import Path
import subprocess

def setup_launchd_service():
    """LaunchDaemon自動設定"""
    username = os.getenv('USER')
    home_dir = Path.home()
    
    # plistファイルのパス設定
    source_plist = Path('launchd/com.tasty.recipe.monitor.plist')
    target_plist = home_dir / 'Library/LaunchAgents/com.tasty.recipe.monitor.plist'
    
    # USERNAME置換
    with open(source_plist) as f:
        plist_content = f.read().replace('USERNAME', username)
    
    with open(target_plist, 'w') as f:
        f.write(plist_content)
    
    # LaunchDaemon読み込み
    subprocess.run(['launchctl', 'load', str(target_plist)], check=True)
    
    # 動作確認
    result = subprocess.run(['launchctl', 'list'], 
                           capture_output=True, text=True)
    
    if 'com.tasty.recipe.monitor' in result.stdout:
        print("✅ LaunchDaemon setup successful")
        return True
    else:
        print("❌ LaunchDaemon setup failed")
        return False
```

#### 3.3 通知システム統合 (Day 3-4)

```python
# services/notification_service.py
import subprocess
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, List

class NotificationService:
    def __init__(self):
        self.gmail_client = self.setup_gmail_client()
    
    async def send_new_recipe_notification(self, recipe_data: dict):
        """新レシピ通知送信"""
        # macOSネイティブ通知
        await self.send_macos_notification(
            title=f"新しいレシピ: {recipe_data['title_ja'][:30]}...",
            message=f"チャンネル: {recipe_data['channel_name']}",
            sound="Glass"
        )
        
        # Gmail HTML通知
        await self.send_gmail_notification(recipe_data)
    
    async def send_macos_notification(self, title: str, message: str, sound: str = "Glass"):
        """macOSネイティブ通知"""
        command = [
            'osascript', '-e',
            f'display notification "{message}" with title "{title}" sound name "{sound}"'
        ]
        
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()
    
    async def send_gmail_notification(self, recipe_data: dict):
        """Gmail HTML形式通知"""
        html_content = self.generate_recipe_email_html(recipe_data)
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"新しいレシピが追加されました: {recipe_data['title_ja']}"
        msg['From'] = self.gmail_settings['sender_email']
        msg['To'] = self.gmail_settings['recipient_email']
        
        html_part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(html_part)
        
        # Gmail API経由送信
        await self.gmail_client.send_message(msg)
    
    def generate_recipe_email_html(self, recipe_data: dict) -> str:
        """レシピ通知HTML生成"""
        return f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ background: #2ecc71; color: white; padding: 20px; }}
                .content {{ padding: 20px; border: 1px solid #ddd; }}
                .video-embed {{ margin: 20px 0; }}
                .ingredients {{ background: #f8f9fa; padding: 15px; }}
                .instructions {{ margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🍖 {recipe_data['title_ja']}</h1>
                <p>チャンネル: {recipe_data['channel_name']}</p>
            </div>
            
            <div class="content">
                <div class="video-embed">
                    <a href="{recipe_data['source_video']['url']}" target="_blank">
                        <img src="{recipe_data['source_video']['thumbnail']}" 
                             alt="Recipe Video" style="max-width: 100%;">
                    </a>
                </div>
                
                <div class="ingredients">
                    <h3>材料:</h3>
                    <ul>
                        {''.join(f'<li>{ingredient}</li>' for ingredient in recipe_data['ingredients'])}
                    </ul>
                </div>
                
                <div class="instructions">
                    <h3>手順:</h3>
                    <ol>
                        {''.join(f'<li>{step}</li>' for step in recipe_data['instructions'])}
                    </ol>
                </div>
                
                <p><strong>調理時間:</strong> {recipe_data['cooking_time']}</p>
                <p><strong>品質スコア:</strong> {recipe_data['quality_score']:.1f}/1.0</p>
            </div>
        </body>
        </html>
        """
```

#### 3.4 監視・ヘルスチェックシステム (Day 4-5)

```python
# services/health_monitor.py
import psutil
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List

class HealthMonitor:
    def __init__(self):
        self.health_checks = [
            self.check_system_resources,
            self.check_api_connectivity,
            self.check_keychain_access,
            self.check_file_permissions,
            self.check_cache_health
        ]
    
    async def run_comprehensive_health_check(self) -> Dict[str, bool]:
        """包括的システムヘルスチェック"""
        results = {}
        
        for check_func in self.health_checks:
            try:
                check_name = check_func.__name__.replace('check_', '')
                results[check_name] = await check_func()
                logger.info(f"Health check passed: {check_name}")
            except Exception as e:
                results[check_name] = False
                logger.error(f"Health check failed: {check_name}", error=str(e))
        
        # 総合健康状態評価
        overall_health = all(results.values())
        await self.send_health_report(results, overall_health)
        
        return results
    
    async def check_system_resources(self) -> bool:
        """システムリソース確認"""
        # CPU使用率確認 (50%以下)
        cpu_percent = psutil.cpu_percent(interval=1)
        if cpu_percent > 50:
            return False
        
        # メモリ使用量確認 (500MB以下)
        memory = psutil.virtual_memory()
        if memory.used > 500 * 1024 * 1024:
            return False
        
        # ディスク容量確認 (10GB以上の空き)
        disk = psutil.disk_usage('/')
        if disk.free < 10 * 1024 * 1024 * 1024:
            return False
        
        return True
    
    async def check_api_connectivity(self) -> bool:
        """API接続性確認"""
        apis_to_check = [
            ('YouTube', 'https://www.googleapis.com/youtube/v3/channels'),
            ('Claude', 'https://api.anthropic.com/v1/messages'),
            ('Notion', 'https://api.notion.com/v1/databases'),
            ('Gmail', 'https://gmail.googleapis.com/gmail/v1/users/me/profile')
        ]
        
        for api_name, api_url in apis_to_check:
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(api_url, timeout=10) as response:
                        if response.status not in [200, 401]:  # 401は認証エラーだが接続OK
                            logger.warning(f"API connectivity issue: {api_name}")
                            return False
            except Exception as e:
                logger.error(f"API connectivity failed: {api_name}", error=str(e))
                return False
        
        return True
    
    async def check_keychain_access(self) -> bool:
        """Keychain アクセス確認"""
        try:
            keychain_manager = MacOSKeychainManager()
            
            # テストキー保存・取得
            test_key = f"health_check_{int(datetime.now().timestamp())}"
            test_value = "test_value_123"
            
            if not keychain_manager.save_password("test_service", test_key, test_value):
                return False
            
            retrieved_value = keychain_manager.get_password("test_service", test_key)
            if retrieved_value != test_value:
                return False
            
            # テストキー削除
            keychain_manager.delete_password("test_service", test_key)
            return True
            
        except Exception as e:
            logger.error("Keychain access failed", error=str(e))
            return False

# scripts/health_check.sh
#!/bin/bash
# 包括的ヘルスチェックスクリプト

set -e

echo "🔍 PersonalCookingRecipe ヘルスチェック開始"

# Python環境確認
echo "📋 Python環境確認..."
source venv/bin/activate
python --version

# 依存関係確認
echo "📚 依存関係確認..."
pip check

# 設定ファイル確認  
echo "⚙️ 設定ファイル確認..."
if [ ! -f "config/settings.py" ]; then
    echo "❌ 設定ファイルが見つかりません"
    exit 1
fi

# Keychain確認
echo "🔐 Keychain確認..."
python -c "
from config.keychain_manager import MacOSKeychainManager
km = MacOSKeychainManager()
print('✅ Keychain接続OK' if km.test_connection() else '❌ Keychain接続NG')
"

# LaunchDaemon確認
echo "⏰ LaunchDaemon確認..."
if launchctl list | grep -q "com.tasty.recipe.monitor"; then
    echo "✅ LaunchDaemon登録済み"
else
    echo "❌ LaunchDaemon未登録"
fi

# API接続確認
echo "🌐 API接続確認..."
python tests/test_api_connections.py

# 総合ヘルスチェック実行
echo "🏥 総合ヘルスチェック実行..."
python -c "
import asyncio
from services.health_monitor import HealthMonitor

async def main():
    hm = HealthMonitor()
    results = await hm.run_comprehensive_health_check()
    
    if all(results.values()):
        print('🎉 全てのヘルスチェックに合格しました！')
    else:
        failed_checks = [k for k, v in results.items() if not v]
        print(f'⚠️ 以下のチェックが失敗しました: {failed_checks}')

asyncio.run(main())
"

echo "✅ ヘルスチェック完了"
```

#### 3.5 本番化・最終テスト (Day 5-7)

```python
# tests/test_integration.py - 統合テストスイート
import pytest
import asyncio
from main import RecipeMonitorOrchestrator

@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_monitoring_cycle():
    """フル監視サイクル統合テスト"""
    orchestrator = RecipeMonitorOrchestrator()
    
    # 完全サイクル実行
    results = await orchestrator.run_monitoring_cycle()
    
    # 結果検証
    assert results['processed'] > 0
    assert results['failed'] < results['processed'] * 0.1  # 失敗率10%以下
    
    # ログ確認
    with open('logs/application.log') as f:
        log_content = f.read()
        assert 'Starting monitoring cycle' in log_content
        assert 'processed successfully' in log_content

@pytest.mark.integration  
@pytest.mark.asyncio
async def test_error_recovery():
    """エラー回復テスト"""
    orchestrator = RecipeMonitorOrchestrator()
    
    # API障害シミュレート
    with patch('services.youtube_monitor.YouTubeMonitor.fetch_new_videos') as mock_fetch:
        mock_fetch.side_effect = Exception("API Error")
        
        results = await orchestrator.run_monitoring_cycle()
        
        # 正常に回復して他チャンネル処理継続
        assert 'processed' in results
        assert results['failed'] > 0

# 本番環境設定
# config/production.py
PRODUCTION_CONFIG = {
    'DEBUG': False,
    'LOG_LEVEL': 'INFO',
    'MAX_VIDEOS_PER_CYCLE': 20,
    'API_TIMEOUT': 30,
    'RETRY_COUNT': 3,
    'CACHE_TTL': 3600,
    'HEALTH_CHECK_INTERVAL': 1800,  # 30分毎
    'NOTIFICATION_ENABLED': True,
    'MACOS_INTEGRATION': True
}

# 本番起動スクリプト  
# scripts/start_production.sh
#!/bin/bash

echo "🚀 本番環境起動中..."

# 環境変数設定
export RECIPE_MONITOR_ENV=production
export PYTHONPATH=/Users/$(whoami)/Developer/tasty-recipe-monitor

# 仮想環境アクティベート
source venv/bin/activate

# 本番設定確認
python -c "
from config.settings import PRODUCTION_CONFIG
print('✅ 本番設定読み込み完了')
print(f'Debug Mode: {PRODUCTION_CONFIG[\"DEBUG\"]}')
"

# LaunchDaemon開始
launchctl load ~/Library/LaunchAgents/com.tasty.recipe.monitor.plist

# 初回実行
echo "🎬 初回監視サイクル実行..."
python main.py --mode=production

echo "✅ 本番環境起動完了"
echo "ログ確認: tail -f logs/application.log"
echo "状態確認: launchctl list | grep com.tasty.recipe.monitor"
```

#### 受入基準 Phase 3
- [ ] 統合テストスイートが全てパスする
- [ ] LaunchDaemonが正常に動作する  
- [ ] ヘルスチェックが全項目パスする
- [ ] 本番環境で24時間安定動作する
- [ ] エラー回復機能が正常動作する
- [ ] 通知システムが正常動作する

---

## 3. 品質保証計画

### 3.1 テスト戦略

#### テスト種別と対象
```
テストピラミッド構成:
├── 統合テスト (20%)
│   ├── エンドツーエンドテスト
│   ├── API統合テスト  
│   └── macOS統合テスト
├── 単体テスト (70%)
│   ├── サービスクラステスト
│   ├── ユーティリティ関数テスト
│   └── エラーハンドリングテスト
└── 手動テスト (10%)
    ├── UIテスト (通知)
    ├── パフォーマンステスト
    └── セキュリティテスト
```

#### テストカバレッジ目標
- **単体テスト**: 80%以上
- **統合テスト**: 主要機能100%
- **API統合**: 全API接続テスト
- **macOS統合**: 全固有機能テスト

### 3.2 継続的品質改善

```python
# 品質ゲート設定
QUALITY_GATES = {
    'code_coverage': 80,
    'api_success_rate': 95,
    'processing_time_max': 300,  # 5分
    'memory_usage_max': 500,     # 500MB  
    'error_rate_max': 5          # 5%
}

# 自動品質チェック
async def validate_quality_gates() -> bool:
    """品質ゲート検証"""
    results = {}
    
    # カバレッジチェック
    coverage_result = subprocess.run(['pytest', '--cov=services', '--cov-report=json'], 
                                   capture_output=True)
    coverage_data = json.loads(Path('coverage.json').read_text())
    results['coverage'] = coverage_data['totals']['percent_covered']
    
    # パフォーマンステスト
    results['performance'] = await run_performance_tests()
    
    # 品質判定
    return all(
        results[metric] >= threshold 
        for metric, threshold in QUALITY_GATES.items()
        if metric in results
    )
```

---

## 4. リスク管理・緩和策

### 4.1 技術的リスク

| リスク | 発生確率 | 影響度 | 緩和策 |
|--------|---------|-------|--------|
| YouTube API制限超過 | 中 | 高 | レート制限監視・キャッシュ活用 |
| Claude API障害 | 低 | 高 | フォールバック機構・エラー回復 |
| macOS権限問題 | 中 | 中 | 詳細なセットアップガイド |
| Keychain アクセス障害 | 低 | 高 | 代替認証手段準備 |

### 4.2 運用リスク

| リスク | 発生確率 | 影響度 | 緩和策 |
|--------|---------|-------|--------|
| システム過負荷 | 中 | 中 | リソース監視・制限設定 |
| ログファイル肥大化 | 高 | 低 | 自動ローテーション実装 |
| ネットワーク障害 | 中 | 高 | 自動再試行・オフライン対応 |
| データ破損 | 低 | 高 | バックアップ・復旧機能 |

### 4.3 スケジュールリスク

**リスク要因:**
- API仕様変更による実装変更
- macOS固有機能の学習コスト
- 外部サービスの不安定性

**緩和策:**
- 各フェーズに20%のバッファ時間設定
- 早期プロトタイプによる技術検証
- 外部依存関係の最小化設計

---

## 5. 成功指標・検収基準

### 5.1 機能的成功指標

**必須機能:**
- [ ] 3チャンネルからの動画自動取得
- [ ] Claude AIによる品質スコア0.7以上の解析
- [ ] Notionページの自動生成・更新
- [ ] macOSネイティブ通知表示
- [ ] Gmail HTML通知送信
- [ ] 24時間自動運用

**性能指標:**
- [ ] システム稼働率 99.5%以上
- [ ] 1動画処理時間 5分以内
- [ ] API成功率 95%以上
- [ ] 1日処理レシピ数 10-17件

### 5.2 品質指標

**コード品質:**
- [ ] テストカバレッジ 80%以上
- [ ] 静的解析エラー 0件
- [ ] セキュリティ脆弱性 0件
- [ ] PEP 8準拠率 100%

**運用品質:**
- [ ] 自動セットアップ成功率 100%
- [ ] エラー自動回復率 90%以上
- [ ] ログ出力適切性 100%
- [ ] ドキュメント完整性 100%

### 5.3 ユーザー受入基準

**使用性:**
- [ ] セットアップ時間 30分以内
- [ ] 通知の適切性・読みやすさ
- [ ] エラー発生時の分かりやすいメッセージ
- [ ] システム状態の透明性

**信頼性:**
- [ ] データ損失 0件
- [ ] 重大障害 0件
- [ ] セキュリティ事故 0件
- [ ] パフォーマンス劣化 0件

---

## 6. 今後の拡張計画

### 6.1 短期拡張 (3ヶ月以内)

**機能拡張:**
- チャンネル追加機能 (設定ベース)
- フィルタリング精度向上 (機械学習導入)
- Web管理インターフェース追加
- レシピトレンド分析機能

### 6.2 中期拡張 (6ヶ月以内)

**技術拡張:**
- マルチプラットフォーム対応 (Linux/Windows)
- データベース移行 (SQLite→PostgreSQL)  
- API レート制限自動調整機能
- 高度な重複検出 (画像解析活用)

### 6.3 長期拡張 (1年以内)

**システム拡張:**
- クラウド対応 (AWS/Azure)
- モバイルアプリケーション開発
- レシピ推薦システム構築
- 商用サービス化検討

---

**承認**
- プロジェクト管理責任者: Recipe-CTO Agent  
- 開発責任者: 未定
- 品質責任者: 未定
- 版数: 1.0
- 承認日: 2025-08-07

---

この開発フェーズ計画書に基づき、高品質で安定した PersonalCookingRecipe システムを段階的に構築してまいります。各フェーズの成功基準を明確にし、リスクを適切に管理しながら、効率的な開発を進行いたします。