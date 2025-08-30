#PersonalCookRecipe-MacOS Notion統合設定仕様書
# MacOS Notion統合設定仕様書

**仕様書ID**: 04_NOTION_INTEGRATION_SYSTEM  
**作成日**: 2025年7月24日  
**対象**: Claude Code実装  
**プロジェクト**: 3チャンネル統合レシピ監視システム  
**前提条件**: 01_MacOS環境準備設定、02_API認証設定、03_3チャンネル監視システム 完了  

---

## 📋 概要

### 🎯 目的
- Notionデータベースへの自動レシピ登録機能
- チャンネル別特化ページテンプレート生成
- YouTube動画埋め込み・メディア連携
- 検索・フィルタリング・分析機能の実装
- レシピ品質評価・タグ付け自動化

### 📊 Notionデータベース設計
- **料理名（Title）**: メインタイトル
- **YouTube URL（URL）**: 動画リンク
- **チャンネル（Select）**: Sam/Tasty/Joshua
- **調理時間（Number）**: 分数
- **人数（Number）**: 何人分
- **難易度（Select）**: ★☆☆/★★☆/★★★
- **メイン食材（Multi-select）**: 肉の種類
- **調理法（Multi-select）**: グリル/ロースト/フライ等
- **分類（Select）**: メイン/サイド/スナック
- **登録日（Date）**: 自動設定
- **品質スコア（Number）**: 0-10評価
- **ステータス（Select）**: 新規/確認済み/お気に入り

### 🛠️ 技術要件
- Notion API v2022-06-28 使用
- リッチテキスト・画像埋め込み対応
- バッチ処理によるAPIコール最適化
- エラー処理・リトライ機能
- データ整合性保証
- macOS環境での安定動作

---

## 🗄️ Notionデータベース詳細設計

### 📐 データベーススキーマ定義

```json
{
  "database_name": "🍖 肉料理レシピ収集",
  "description": "3チャンネル統合レシピ自動収集システム",
  "properties": {
    "料理名": {
      "type": "title",
      "title": {}
    },
    "YouTube_URL": {
      "type": "url",
      "url": {}
    },
    "チャンネル": {
      "type": "select",
      "select": {
        "options": [
          {"name": "🏠 Sam The Cooking Guy", "color": "blue"},
          {"name": "⚡ Tasty Recipes", "color": "yellow"},
          {"name": "⭐ Joshua Weissman", "color": "red"}
        ]
      }
    },
    "調理時間": {
      "type": "number",
      "number": {
        "format": "number"
      }
    },
    "人数": {
      "type": "number", 
      "number": {
        "format": "number"
      }
    },
    "難易度": {
      "type": "select",
      "select": {
        "options": [
          {"name": "★☆☆ 初心者", "color": "green"},
          {"name": "★★☆ 中級者", "color": "yellow"},
          {"name": "★★★ 上級者", "color": "red"}
        ]
      }
    },
    "メイン食材": {
      "type": "multi_select",
      "multi_select": {
        "options": [
          {"name": "🥩 牛肉", "color": "red"},
          {"name": "🐔 鶏肉", "color": "yellow"},
          {"name": "🐷 豚肉", "color": "pink"},
          {"name": "🐑 羊肉", "color": "purple"},
          {"name": "🦃 七面鳥", "color": "brown"},
          {"name": "🥓 ベーコン", "color": "orange"},
          {"name": "🌭 ソーセージ", "color": "default"}
        ]
      }
    },
    "調理法": {
      "type": "multi_select",
      "multi_select": {
        "options": [
          {"name": "🔥 グリル", "color": "red"},
          {"name": "🍳 フライ", "color": "yellow"},
          {"name": "🔥 ロースト", "color": "orange"},
          {"name": "💨 スモーク", "color": "gray"},
          {"name": "🥘 煮込み", "color": "blue"},
          {"name": "🍲 蒸し", "color": "green"},
          {"name": "🔪 生食", "color": "default"}
        ]
      }
    },
    "分類": {
      "type": "select",
      "select": {
        "options": [
          {"name": "🍽️ メイン", "color": "default"},
          {"name": "🥗 サイド", "color": "green"},
          {"name": "🍺 おつまみ", "color": "yellow"},
          {"name": "🎉 パーティー", "color": "red"}
        ]
      }
    },
    "登録日": {
      "type": "date",
      "date": {}
    },
    "品質スコア": {
      "type": "number",
      "number": {
        "format": "number"
      }
    },
    "ステータス": {
      "type": "select",
      "select": {
        "options": [
          {"name": "🆕 新規", "color": "blue"},
          {"name": "✅ 確認済み", "color": "green"},
          {"name": "⭐ お気に入り", "color": "yellow"},
          {"name": "🗂️ アーカイブ", "color": "gray"}
        ]
      }
    },
    "動画時間": {
      "type": "rich_text",
      "rich_text": {}
    },
    "再生回数": {
      "type": "number",
      "number": {
        "format": "number"
      }
    },
    "公開日": {
      "type": "date",
      "date": {}
    }
  }
}
```

### 📝 チャンネル別ページテンプレート設計

#### Sam The Cooking Guy テンプレート
```markdown
# 🏠 {料理名} - Sam流家庭料理

## 📺 動画情報
{YouTube動画埋め込み}
- **チャンネル**: Sam The Cooking Guy
- **公開日**: {公開日}
- **動画時間**: {動画時間}
- **再生回数**: {再生回数:,}

## 🎯 レシピ概要
- **調理時間**: {調理時間}分
- **人数**: {人数}人分
- **難易度**: ★★☆ 実用重視
- **メイン食材**: {メイン食材}

## 🏠 家庭での再現ポイント
{実用的なアドバイス}

## 💰 コスト削減のコツ
{節約方法・代替材料}

## 🔄 材料の代替案
{入手困難な材料の代替}

## 👨‍🍳 Samのアドバイス
{動画からの重要なコツ}
```

#### Tasty Recipes テンプレート
```markdown
# ⚡ {料理名} - Tasty時短レシピ

## 📺 動画情報
{YouTube動画埋め込み}
- **チャンネル**: Tasty Recipes
- **公開日**: {公開日}
- **動画時間**: {動画時間}
- **再生回数**: {再生回数:,}

## ⚡ 時短レシピ概要
- **調理時間**: {調理時間}分（超時短！）
- **人数**: {人数}人分
- **難易度**: ★☆☆ 超簡単
- **メイン食材**: {メイン食材}

## 🕐 15分で完成！手順
{ステップバイステップ}

## ✨ 見た目を良くするコツ
{プレゼンテーション技術}

## 📱 SNS映えポイント
{インスタ映えのコツ}

## 🛒 最小限の材料リスト
{本当に必要な材料のみ}
```

#### Joshua Weissman テンプレート
```markdown
# ⭐ {料理名} - Joshua流プロ技術

## 📺 動画情報
{YouTube動画埋め込み}
- **チャンネル**: Joshua Weissman
- **公開日**: {公開日}
- **動画時間**: {動画時間}
- **再生回数**: {再生回数:,}

## 🎓 プロ級レシピ概要
- **調理時間**: {調理時間}分
- **人数**: {人数}人分
- **難易度**: ★★★ プロ級
- **メイン食材**: {メイン食材}

## 🧪 科学的根拠・理論
{なぜこの手法なのか}

## 🎯 プロのテクニック
{重要な技術ポイント}

## ⚠️ 失敗を避けるポイント
{よくある失敗とその対策}

## 🌟 "But Better" 改良点
{元レシピからの改良箇所}

## 📊 温度・時間の管理
{精密な温度・時間設定}
```

---

## 🔧 Claude Code実装タスク

### 📝 タスク1: Notion統合クライアント
- **ファイル名**: `services/notion_client.py`
- **機能**: Notion APIとの統合・通信管理（macOS対応）
- **実装内容**: 認証、データベース操作、エラーハンドリング

### 🎨 タスク2: レシピページ生成エンジン
- **ファイル名**: `services/recipe_page_generator.py`
- **機能**: チャンネル別特化ページ生成
- **実装内容**: テンプレート適用、リッチコンテンツ作成

### 🗄️ タスク3: データベース管理システム
- **ファイル名**: `services/notion_database_manager.py`
- **機能**: データベース構造管理・更新
- **実装内容**: スキーマ管理、プロパティ更新、整合性チェック

### 🎬 タスク4: メディア統合機能
- **ファイル名**: `services/media_integrator.py`
- **機能**: YouTube動画・画像の埋め込み（macOS最適化）
- **実装内容**: 動画埋め込み、サムネイル処理、メディア最適化

### ⭐ タスク5: レシピ品質評価システム
- **ファイル名**: `services/recipe_quality_assessor.py`
- **機能**: レシピの品質自動評価・スコアリング
- **実装内容**: 多次元評価、スコア算出、品質保証

---

## 🔍 詳細実装仕様

### 🛠️ Notion統合クライアント仕様

**ファイル**: `services/notion_client.py`

```python
# 実装要件:
import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union
from pathlib import Path
from notion_client import Client
from notion_client.errors import APIError, APIResponseError
import json

# macOS環境設定
from config.keychain_manager import MacOSKeychainManager

class NotionRecipeClient:
    """Notion レシピデータベース統合クライアント（macOS対応）"""
    
    def __init__(self, token: str = None, database_id: str = None):
        # macOS Keychainから認証情報取得
        if not token or not database_id:
            keychain = MacOSKeychainManager()
            token = token or keychain.get_password("NOTION_TOKEN")
            database_id = database_id or keychain.get_password("NOTION_DATABASE_ID")
        
        self.client = Client(auth=token)
        self.database_id = database_id
        self.logger = logging.getLogger(__name__)
        
        # macOSパス設定
        self.base_dir = Path.home() / "Developer" / "tasty-recipe-monitor"
        self.cache_dir = self.base_dir / "data" / "cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # API制限管理
        self.rate_limit_delay = 0.34  # 3req/sec制限対応
        self.max_retries = 3
        self.last_request_time = 0
        
        # キャッシュ
        self.database_schema = None
        self.property_cache = {}
    
    async def initialize_database(self) -> bool:
        """データベース初期化・スキーマ確認"""
        try:
            await self._rate_limit_check()
            
            # データベース情報取得
            database = self.client.databases.retrieve(database_id=self.database_id)
            self.database_schema = database
            
            # プロパティキャッシュ更新
            self.property_cache = database.get('properties', {})
            
            # キャッシュファイル保存（macOS）
            cache_file = self.cache_dir / "database_schema.json"
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(database, f, ensure_ascii=False, indent=2)
            
            self.logger.info(f"Notionデータベース初期化完了: {database['title'][0]['plain_text']}")
            return True
            
        except Exception as e:
            self.logger.error(f"データベース初期化エラー: {e}")
            return False
    
    async def create_recipe_page(self, recipe_data: Dict[str, Any]) -> Optional[str]:
        """レシピページ作成"""
        try:
            await self._rate_limit_check()
            
            # ページプロパティ構築
            properties = await self._build_page_properties(recipe_data)
            
            # ページコンテンツ構築
            children = await self._build_page_content(recipe_data)
            
            # ページ作成
            response = self.client.pages.create(
                parent={"database_id": self.database_id},
                properties=properties,
                children=children
            )
            
            page_id = response['id']
            self.logger.info(f"レシピページ作成成功: {recipe_data.get('title', 'Unknown')}")
            
            # macOS通知送信
            await self._send_macos_notification(
                title="レシピ追加完了",
                message=f"{recipe_data.get('translated_title', recipe_data.get('title', ''))}をNotionに追加しました"
            )
            
            return page_id
            
        except APIError as e:
            self.logger.error(f"Notion APIエラー: {e}")
            return None
        except Exception as e:
            self.logger.error(f"ページ作成エラー: {e}")
            return None
    
    async def _build_page_properties(self, recipe_data: Dict) -> Dict[str, Any]:
        """ページプロパティ構築"""
        channel_map = {
            "sam": "🏠 Sam The Cooking Guy",
            "tasty": "⚡ Tasty Recipes", 
            "joshua": "⭐ Joshua Weissman"
        }
        
        difficulty_map = {
            "beginner": "★☆☆ 初心者",
            "practical": "★★☆ 中級者",
            "advanced": "★★★ 上級者"
        }
        
        properties = {
            "料理名": {
                "title": [
                    {
                        "text": {
                            "content": recipe_data.get('translated_title', recipe_data.get('title', ''))
                        }
                    }
                ]
            },
            "YouTube_URL": {
                "url": recipe_data.get('url', '')
            },
            "チャンネル": {
                "select": {
                    "name": channel_map.get(recipe_data.get('channel'), "🏠 Sam The Cooking Guy")
                }
            },
            "調理時間": {
                "number": recipe_data.get('cook_time_minutes', 0)
            },
            "人数": {
                "number": recipe_data.get('servings', 4)
            },
            "難易度": {
                "select": {
                    "name": difficulty_map.get(
                        recipe_data.get('channel_config', {}).get('difficulty_focus'),
                        "★★☆ 中級者"
                    )
                }
            },
            "登録日": {
                "date": {
                    "start": datetime.now(timezone.utc).isoformat()
                }
            },
            "品質スコア": {
                "number": round(recipe_data.get('quality_score', 7.0), 1)
            },
            "ステータス": {
                "select": {
                    "name": "🆕 新規"
                }
            },
            "動画時間": {
                "rich_text": [
                    {
                        "text": {
                            "content": recipe_data.get('duration', 'Unknown')
                        }
                    }
                ]
            },
            "再生回数": {
                "number": recipe_data.get('view_count', 0)
            },
            "公開日": {
                "date": {
                    "start": recipe_data.get('published_at', datetime.now().isoformat())[:10]
                }
            }
        }
        
        # メイン食材の設定
        if 'main_ingredients' in recipe_data:
            properties["メイン食材"] = {
                "multi_select": [
                    {"name": ingredient} for ingredient in recipe_data['main_ingredients'][:5]
                ]
            }
        
        # 調理法の設定
        if 'cooking_methods' in recipe_data:
            properties["調理法"] = {
                "multi_select": [
                    {"name": method} for method in recipe_data['cooking_methods'][:3]
                ]
            }
        
        return properties
    
    async def _build_page_content(self, recipe_data: Dict) -> List[Dict]:
        """ページコンテンツ構築"""
        channel = recipe_data.get('channel', 'sam')
        
        if channel == 'sam':
            return await self._build_sam_content(recipe_data)
        elif channel == 'tasty':
            return await self._build_tasty_content(recipe_data)
        elif channel == 'joshua':
            return await self._build_joshua_content(recipe_data)
        else:
            return await self._build_default_content(recipe_data)
    
    async def _build_sam_content(self, recipe_data: Dict) -> List[Dict]:
        """Sam専用コンテンツ構築"""
        content = []
        
        # YouTube動画埋め込み
        content.append({
            "object": "block",
            "type": "embed",
            "embed": {
                "url": recipe_data.get('url', '')
            }
        })
        
        # 動画情報セクション
        content.extend([
            self._create_heading_block("📺 動画情報", 2),
            self._create_bullet_block(f"**チャンネル**: Sam The Cooking Guy"),
            self._create_bullet_block(f"**公開日**: {recipe_data.get('published_at', '')[:10]}"),
            self._create_bullet_block(f"**動画時間**: {recipe_data.get('duration', 'Unknown')}"),
            self._create_bullet_block(f"**再生回数**: {recipe_data.get('view_count', 0):,}")
        ])
        
        # レシピ概要
        content.extend([
            self._create_heading_block("🎯 レシピ概要", 2),
            self._create_bullet_block(f"**調理時間**: {recipe_data.get('cook_time_minutes', 'Unknown')}分"),
            self._create_bullet_block(f"**人数**: {recipe_data.get('servings', 4)}人分"),
            self._create_bullet_block(f"**難易度**: ★★☆ 実用重視"),
            self._create_bullet_block(f"**メイン食材**: {', '.join(recipe_data.get('main_ingredients', ['不明']))}")
        ])
        
        # 家庭での再現ポイント
        if 'practical_tips' in recipe_data:
            content.extend([
                self._create_heading_block("🏠 家庭での再現ポイント", 2),
                self._create_paragraph_block(recipe_data['practical_tips'])
            ])
        
        # コスト削減のコツ
        if 'cost_saving_tips' in recipe_data:
            content.extend([
                self._create_heading_block("💰 コスト削減のコツ", 2),
                self._create_paragraph_block(recipe_data['cost_saving_tips'])
            ])
        
        # 材料の代替案
        if 'ingredient_alternatives' in recipe_data:
            content.extend([
                self._create_heading_block("🔄 材料の代替案", 2),
                self._create_paragraph_block(recipe_data['ingredient_alternatives'])
            ])
        
        # レシピ詳細
        if 'full_recipe' in recipe_data:
            content.extend([
                self._create_heading_block("📝 詳細レシピ", 2),
                self._create_paragraph_block(recipe_data['full_recipe'])
            ])
        
        return content
    
    async def _build_tasty_content(self, recipe_data: Dict) -> List[Dict]:
        """Tasty専用コンテンツ構築"""
        content = []
        
        # YouTube動画埋め込み
        content.append({
            "object": "block",
            "type": "embed", 
            "embed": {
                "url": recipe_data.get('url', '')
            }
        })
        
        # 動画情報セクション
        content.extend([
            self._create_heading_block("📺 動画情報", 2),
            self._create_bullet_block(f"**チャンネル**: Tasty Recipes"),
            self._create_bullet_block(f"**公開日**: {recipe_data.get('published_at', '')[:10]}"),
            self._create_bullet_block(f"**動画時間**: {recipe_data.get('duration', 'Unknown')}"),
            self._create_bullet_block(f"**再生回数**: {recipe_data.get('view_count', 0):,}")
        ])
        
        # 時短レシピ概要
        content.extend([
            self._create_heading_block("⚡ 時短レシピ概要", 2),
            self._create_bullet_block(f"**調理時間**: {recipe_data.get('cook_time_minutes', 'Unknown')}分（超時短！）"),
            self._create_bullet_block(f"**人数**: {recipe_data.get('servings', 4)}人分"),
            self._create_bullet_block(f"**難易度**: ★☆☆ 超簡単"),
            self._create_bullet_block(f"**メイン食材**: {', '.join(recipe_data.get('main_ingredients', ['不明']))}")
        ])
        
        # 簡単手順
        if 'quick_steps' in recipe_data:
            content.extend([
                self._create_heading_block("🕐 簡単手順", 2),
                self._create_paragraph_block(recipe_data['quick_steps'])
            ])
        
        # 見た目を良くするコツ
        if 'visual_tips' in recipe_data:
            content.extend([
                self._create_heading_block("✨ 見た目を良くするコツ", 2),
                self._create_paragraph_block(recipe_data['visual_tips'])
            ])
        
        # SNS映えポイント
        if 'social_media_tips' in recipe_data:
            content.extend([
                self._create_heading_block("📱 SNS映えポイント", 2),
                self._create_paragraph_block(recipe_data['social_media_tips'])
            ])
        
        # 最小限の材料リスト
        if 'minimal_ingredients' in recipe_data:
            content.extend([
                self._create_heading_block("🛒 最小限の材料リスト", 2),
                self._create_paragraph_block(recipe_data['minimal_ingredients'])
            ])
        
        return content
    
    async def _build_joshua_content(self, recipe_data: Dict) -> List[Dict]:
        """Joshua専用コンテンツ構築"""
        content = []
        
        # YouTube動画埋め込み
        content.append({
            "object": "block",
            "type": "embed",
            "embed": {
                "url": recipe_data.get('url', '')
            }
        })
        
        # 動画情報セクション
        content.extend([
            self._create_heading_block("📺 動画情報", 2),
            self._create_bullet_block(f"**チャンネル**: Joshua Weissman"),
            self._create_bullet_block(f"**公開日**: {recipe_data.get('published_at', '')[:10]}"),
            self._create_bullet_block(f"**動画時間**: {recipe_data.get('duration', 'Unknown')}"),
            self._create_bullet_block(f"**再生回数**: {recipe_data.get('view_count', 0):,}")
        ])
        
        # プロ級レシピ概要
        content.extend([
            self._create_heading_block("🎓 プロ級レシピ概要", 2),
            self._create_bullet_block(f"**調理時間**: {recipe_data.get('cook_time_minutes', 'Unknown')}分"),
            self._create_bullet_block(f"**人数**: {recipe_data.get('servings', 4)}人分"),
            self._create_bullet_block(f"**難易度**: ★★★ プロ級"),
            self._create_bullet_block(f"**メイン食材**: {', '.join(recipe_data.get('main_ingredients', ['不明']))}")
        ])
        
        # 科学的根拠・理論
        if 'scientific_explanation' in recipe_data:
            content.extend([
                self._create_heading_block("🧪 科学的根拠・理論", 2),
                self._create_paragraph_block(recipe_data['scientific_explanation'])
            ])
        
        # プロのテクニック
        if 'professional_techniques' in recipe_data:
            content.extend([
                self._create_heading_block("🎯 プロのテクニック", 2),
                self._create_paragraph_block(recipe_data['professional_techniques'])
            ])
        
        # 失敗を避けるポイント
        if 'failure_prevention' in recipe_data:
            content.extend([
                self._create_heading_block("⚠️ 失敗を避けるポイント", 2),
                self._create_paragraph_block(recipe_data['failure_prevention'])
            ])
        
        # "But Better" 改良点
        if 'but_better_improvements' in recipe_data:
            content.extend([
                self._create_heading_block("🌟 \"But Better\" 改良点", 2),
                self._create_paragraph_block(recipe_data['but_better_improvements'])
            ])
        
        # 温度・時間の管理
        if 'temperature_timing' in recipe_data:
            content.extend([
                self._create_heading_block("📊 温度・時間の管理", 2),
                self._create_paragraph_block(recipe_data['temperature_timing'])
            ])
        
        return content
    
    async def _build_default_content(self, recipe_data: Dict) -> List[Dict]:
        """デフォルトコンテンツ構築"""
        content = []
        
        # YouTube動画埋め込み
        content.append({
            "object": "block",
            "type": "embed",
            "embed": {
                "url": recipe_data.get('url', '')
            }
        })
        
        # 基本情報
        content.extend([
            self._create_heading_block("📝 レシピ詳細", 2),
            self._create_paragraph_block(recipe_data.get('summary', 'レシピの詳細情報を準備中です...'))
        ])
        
        return content
    
    def _create_heading_block(self, text: str, level: int = 1) -> Dict:
        """見出しブロック作成"""
        heading_type = f"heading_{level}"
        return {
            "object": "block",
            "type": heading_type,
            heading_type: {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {
                            "content": text
                        }
                    }
                ]
            }
        }
    
    def _create_paragraph_block(self, text: str) -> Dict:
        """段落ブロック作成"""
        return {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {
                            "content": text
                        }
                    }
                ]
            }
        }
    
    def _create_bullet_block(self, text: str) -> Dict:
        """箇条書きブロック作成"""
        return {
            "object": "block",
            "type": "bulleted_list_item",
            "bulleted_list_item": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {
                            "content": text
                        }
                    }
                ]
            }
        }
    
    async def _rate_limit_check(self):
        """レート制限チェック"""
        import time
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        
        if time_since_last < self.rate_limit_delay:
            sleep_time = self.rate_limit_delay - time_since_last
            await asyncio.sleep(sleep_time)
        
        self.last_request_time = time.time()
    
    async def _send_macos_notification(self, title: str, message: str):
        """macOS通知送信"""
        try:
            import subprocess
            subprocess.run([
                'osascript', '-e',
                f'display notification "{message}" with title "{title}" sound name "Glass"'
            ])
        except Exception as e:
            self.logger.debug(f"通知送信エラー: {e}")
    
    async def search_existing_recipe(self, video_url: str) -> Optional[str]:
        """既存レシピページ検索"""
        try:
            await self._rate_limit_check()
            
            response = self.client.databases.query(
                database_id=self.database_id,
                filter={
                    "property": "YouTube_URL",
                    "url": {
                        "equals": video_url
                    }
                }
            )
            
            if response['results']:
                return response['results'][0]['id']
            return None
            
        except Exception as e:
            self.logger.error(f"レシピ検索エラー: {e}")
            return None
    
    async def update_recipe_page(self, page_id: str, update_data: Dict) -> bool:
        """レシピページ更新"""
        try:
            await self._rate_limit_check()
            
            properties = await self._build_page_properties(update_data)
            
            self.client.pages.update(
                page_id=page_id,
                properties=properties
            )
            
            self.logger.info(f"レシピページ更新成功: {page_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"ページ更新エラー: {e}")
            return False
    
    async def batch_create_recipes(self, recipes: List[Dict]) -> List[str]:
        """バッチレシピ作成"""
        created_pages = []
        
        for recipe in recipes:
            # 重複チェック
            existing_page = await self.search_existing_recipe(recipe.get('url', ''))
            if existing_page:
                self.logger.info(f"既存レシピスキップ: {recipe.get('title', 'Unknown')}")
                continue
            
            # 新規作成
            page_id = await self.create_recipe_page(recipe)
            if page_id:
                created_pages.append(page_id)
            
            # API制限対応で少し待機
            await asyncio.sleep(0.5)
        
        self.logger.info(f"バッチ作成完了: {len(created_pages)}件")
        
        # 完了通知（macOS）
        if created_pages:
            await self._send_macos_notification(
                title="バッチ処理完了",
                message=f"{len(created_pages)}件のレシピを追加しました"
            )
        
        return created_pages
    
    async def get_database_stats(self) -> Dict[str, Any]:
        """データベース統計取得"""
        try:
            await self._rate_limit_check()
            
            # 全ページ数取得
            response = self.client.databases.query(
                database_id=self.database_id,
                page_size=1
            )
            total_count = len(response['results'])
            
            # チャンネル別統計
            channel_stats = {}
            for channel in ["🏠 Sam The Cooking Guy", "⚡ Tasty Recipes", "⭐ Joshua Weissman"]:
                channel_response = self.client.databases.query(
                    database_id=self.database_id,
                    filter={
                        "property": "チャンネル",
                        "select": {
                            "equals": channel
                        }
                    }
                )
                channel_stats[channel] = len(channel_response['results'])
            
            # 統計キャッシュ保存（macOS）
            stats = {
                "total_recipes": total_count,
                "channel_breakdown": channel_stats,
                "last_updated": datetime.now().isoformat()
            }
            
            stats_file = self.cache_dir / "database_stats.json"
            with open(stats_file, 'w', encoding='utf-8') as f:
                json.dump(stats, f, ensure_ascii=False, indent=2)
            
            return stats
            
        except Exception as e:
            self.logger.error(f"統計取得エラー: {e}")
            return {"error": str(e)}


class NotionDatabaseManager:
    """Notionデータベース構造管理（macOS対応）"""
    
    def __init__(self, client: NotionRecipeClient):
        self.client = client
        self.logger = logging.getLogger(__name__)
    
    async def verify_database_schema(self) -> Dict[str, Any]:
        """データベーススキーマ検証"""
        try:
            required_properties = {
                "料理名": "title",
                "YouTube_URL": "url", 
                "チャンネル": "select",
                "調理時間": "number",
                "人数": "number",
                "難易度": "select",
                "メイン食材": "multi_select",
                "調理法": "multi_select",
                "分類": "select",
                "登録日": "date",
                "品質スコア": "number",
                "ステータス": "select"
            }
            
            database = await self.client.client.databases.retrieve(
                database_id=self.client.database_id
            )
            
            existing_properties = database.get('properties', {})
            
            verification_result = {
                "schema_valid": True,
                "missing_properties": [],
                "type_mismatches": [],
                "extra_properties": []
            }
            
            # 必須プロパティチェック
            for prop_name, prop_type in required_properties.items():
                if prop_name not in existing_properties:
                    verification_result["missing_properties"].append(prop_name)
                    verification_result["schema_valid"] = False
                elif existing_properties[prop_name]["type"] != prop_type:
                    verification_result["type_mismatches"].append({
                        "property": prop_name,
                        "expected": prop_type,
                        "actual": existing_properties[prop_name]["type"]
                    })
                    verification_result["schema_valid"] = False
            
            # 余分なプロパティチェック
            for prop_name in existing_properties:
                if prop_name not in required_properties:
                    verification_result["extra_properties"].append(prop_name)
            
            return verification_result
            
        except Exception as e:
            self.logger.error(f"スキーマ検証エラー: {e}")
            return {"error": str(e)}
    
    async def create_missing_properties(self, missing_properties: List[str]) -> bool:
        """不足プロパティ作成"""
        # 注意: Notion APIでは既存データベースへのプロパティ追加は制限的
        # 手動でのデータベース設定を推奨
        self.logger.warning("データベースプロパティは手動で設定してください")
        
        # macOS通知で警告
        await self.client._send_macos_notification(
            title="Notion設定必要",
            message="データベースプロパティを手動で設定してください"
        )
        
        return False
    
    async def update_select_options(self, property_name: str, new_options: List[str]) -> bool:
        """セレクトオプション更新"""
        try:
            # 既存オプション取得
            database = await self.client.client.databases.retrieve(
                database_id=self.client.database_id
            )
            
            property_config = database['properties'].get(property_name)
            if not property_config:
                return False
            
            # 新しいオプション追加ロジック
            # (実装は複雑なため、手動設定を推奨)
            self.logger.info(f"セレクトオプション更新: {property_name}")
            return True
            
        except Exception as e:
            self.logger.error(f"オプション更新エラー: {e}")
            return False
```

### 🎨 レシピページ生成エンジン仕様

**ファイル**: `services/recipe_page_generator.py`

```python
# 実装要件:
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path

class RecipePageGenerator:
    """チャンネル特化型レシピページ生成エンジン（macOS対応）"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # macOSテンプレートディレクトリ
        self.template_dir = Path.home() / "Developer" / "tasty-recipe-monitor" / "data" / "templates"
        self.template_dir.mkdir(parents=True, exist_ok=True)
        
        # チャンネル別テンプレート設定
        self.channel_templates = {
            "sam": self._load_sam_template(),
            "tasty": self._load_tasty_template(),
            "joshua": self._load_joshua_template()
        }
    
    def _load_sam_template(self) -> Dict[str, Any]:
        """Sam用テンプレート読み込み"""
        return {
            "style": "practical",
            "focus": "home_cooking",
            "sections": [
                {"type": "video", "required": True},
                {"type": "overview", "required": True},
                {"type": "practical_tips", "required": True},
                {"type": "cost_saving", "required": False},
                {"type": "alternatives", "required": False},
                {"type": "chef_advice", "required": True}
            ]
        }
    
    def _load_tasty_template(self) -> Dict[str, Any]:
        """Tasty用テンプレート読み込み"""
        return {
            "style": "quick",
            "focus": "speed_simplicity",
            "sections": [
                {"type": "video", "required": True},
                {"type": "quick_overview", "required": True},
                {"type": "quick_steps", "required": True},
                {"type": "visual_tips", "required": False},
                {"type": "social_media", "required": False},
                {"type": "minimal_ingredients", "required": True}
            ]
        }
    
    def _load_joshua_template(self) -> Dict[str, Any]:
        """Joshua用テンプレート読み込み"""
        return {
            "style": "professional",
            "focus": "technique_perfection",
            "sections": [
                {"type": "video", "required": True},
                {"type": "pro_overview", "required": True},
                {"type": "scientific_theory", "required": True},
                {"type": "pro_techniques", "required": True},
                {"type": "failure_prevention", "required": True},
                {"type": "but_better", "required": False},
                {"type": "temperature_timing", "required": True}
            ]
        }
    
    async def generate_recipe_page(self, recipe_data: Dict, channel: str) -> Dict[str, Any]:
        """レシピページ生成"""
        try:
            # チャンネル別テンプレート取得
            template = self.channel_templates.get(channel)
            if not template:
                self.logger.warning(f"不明なチャンネル: {channel}")
                template = self.channel_templates["sam"]
            
            # ページコンテンツ生成
            page_content = await self._generate_content(recipe_data, template)
            
            # メタデータ追加
            page_content["metadata"] = {
                "generated_at": datetime.now().isoformat(),
                "channel": channel,
                "template_version": "1.0",
                "platform": "macOS"
            }
            
            return page_content
            
        except Exception as e:
            self.logger.error(f"ページ生成エラー: {e}")
            return {"error": str(e)}
    
    async def _generate_content(self, recipe_data: Dict, template: Dict) -> Dict[str, Any]:
        """コンテンツ生成"""
        content = {
            "title": recipe_data.get("translated_title", recipe_data.get("title", "")),
            "sections": []
        }
        
        for section in template["sections"]:
            section_content = await self._generate_section(
                recipe_data, 
                section["type"], 
                section["required"]
            )
            
            if section_content or section["required"]:
                content["sections"].append({
                    "type": section["type"],
                    "content": section_content or self._get_default_content(section["type"])
                })
        
        return content
    
    async def _generate_section(self, recipe_data: Dict, section_type: str, required: bool) -> Optional[str]:
        """セクション生成"""
        generators = {
            "video": self._generate_video_section,
            "overview": self._generate_overview_section,
            "quick_overview": self._generate_quick_overview_section,
            "pro_overview": self._generate_pro_overview_section,
            "practical_tips": self._generate_practical_tips,
            "cost_saving": self._generate_cost_saving_tips,
            "alternatives": self._generate_alternatives,
            "chef_advice": self._generate_chef_advice,
            "quick_steps": self._generate_quick_steps,
            "visual_tips": self._generate_visual_tips,
            "social_media": self._generate_social_media_tips,
            "minimal_ingredients": self._generate_minimal_ingredients,
            "scientific_theory": self._generate_scientific_theory,
            "pro_techniques": self._generate_pro_techniques,
            "failure_prevention": self._generate_failure_prevention,
            "but_better": self._generate_but_better,
            "temperature_timing": self._generate_temperature_timing
        }
        
        generator = generators.get(section_type)
        if generator:
            return await generator(recipe_data)
        
        return None
    
    async def _generate_video_section(self, recipe_data: Dict) -> str:
        """動画セクション生成"""
        return recipe_data.get("url", "")
    
    async def _generate_overview_section(self, recipe_data: Dict) -> str:
        """概要セクション生成"""
        return f"""
調理時間: {recipe_data.get('cook_time_minutes', 'Unknown')}分
人数: {recipe_data.get('servings', 4)}人分
メイン食材: {', '.join(recipe_data.get('main_ingredients', ['不明']))}
"""
    
    async def _generate_quick_overview_section(self, recipe_data: Dict) -> str:
        """時短概要セクション生成"""
        return f"""
⚡ 調理時間: たった{recipe_data.get('cook_time_minutes', 'Unknown')}分！
人数: {recipe_data.get('servings', 4)}人分
難易度: 超簡単！
"""
    
    async def _generate_pro_overview_section(self, recipe_data: Dict) -> str:
        """プロ概要セクション生成"""
        return f"""
調理時間: {recipe_data.get('cook_time_minutes', 'Unknown')}分（準備含む）
人数: {recipe_data.get('servings', 4)}人分
技術レベル: プロ級
"""
    
    async def _generate_practical_tips(self, recipe_data: Dict) -> str:
        """実用的なヒント生成"""
        return recipe_data.get('practical_tips', '家庭での再現ポイントを準備中...')
    
    async def _generate_cost_saving_tips(self, recipe_data: Dict) -> str:
        """コスト削減ヒント生成"""
        return recipe_data.get('cost_saving_tips', '')
    
    async def _generate_alternatives(self, recipe_data: Dict) -> str:
        """代替材料生成"""
        return recipe_data.get('ingredient_alternatives', '')
    
    async def _generate_chef_advice(self, recipe_data: Dict) -> str:
        """シェフのアドバイス生成"""
        return recipe_data.get('chef_advice', 'Samからの特別なアドバイスを準備中...')
    
    async def _generate_quick_steps(self, recipe_data: Dict) -> str:
        """簡単手順生成"""
        return recipe_data.get('quick_steps', '15分で完成する手順を準備中...')
    
    async def _generate_visual_tips(self, recipe_data: Dict) -> str:
        """見た目のヒント生成"""
        return recipe_data.get('visual_tips', '')
    
    async def _generate_social_media_tips(self, recipe_data: Dict) -> str:
        """SNS映えヒント生成"""
        return recipe_data.get('social_media_tips', '')
    
    async def _generate_minimal_ingredients(self, recipe_data: Dict) -> str:
        """最小限材料リスト生成"""
        return recipe_data.get('minimal_ingredients', '必要最小限の材料リストを準備中...')
    
    async def _generate_scientific_theory(self, recipe_data: Dict) -> str:
        """科学的理論生成"""
        return recipe_data.get('scientific_explanation', 'なぜこの調理法が最適なのか、科学的に説明します...')
    
    async def _generate_pro_techniques(self, recipe_data: Dict) -> str:
        """プロ技術生成"""
        return recipe_data.get('professional_techniques', 'プロの技術ポイントを準備中...')
    
    async def _generate_failure_prevention(self, recipe_data: Dict) -> str:
        """失敗防止ヒント生成"""
        return recipe_data.get('failure_prevention', 'よくある失敗とその防止法を準備中...')
    
    async def _generate_but_better(self, recipe_data: Dict) -> str:
        """But Better改良点生成"""
        return recipe_data.get('but_better_improvements', '')
    
    async def _generate_temperature_timing(self, recipe_data: Dict) -> str:
        """温度・時間管理生成"""
        return recipe_data.get('temperature_timing', '精密な温度と時間の管理方法を準備中...')
    
    def _get_default_content(self, section_type: str) -> str:
        """デフォルトコンテンツ取得"""
        defaults = {
            "video": "動画を読み込み中...",
            "overview": "レシピ概要を準備中...",
            "quick_overview": "時短レシピ概要を準備中...",
            "pro_overview": "プロ級レシピ概要を準備中...",
            "practical_tips": "実用的なヒントを準備中...",
            "chef_advice": "シェフからのアドバイスを準備中...",
            "quick_steps": "簡単手順を準備中...",
            "minimal_ingredients": "最小限の材料リストを準備中...",
            "scientific_theory": "科学的な説明を準備中...",
            "pro_techniques": "プロの技術を準備中...",
            "failure_prevention": "失敗防止のポイントを準備中...",
            "temperature_timing": "温度・時間管理を準備中..."
        }
        
        return defaults.get(section_type, "コンテンツを準備中...")
```

### 🎬 メディア統合機能仕様

**ファイル**: `services/media_integrator.py`

```python
# 実装要件:
import asyncio
import logging
import subprocess
from typing import Dict, List, Optional, Any
from pathlib import Path
import aiohttp
from PIL import Image
import io

class MediaIntegrator:
    """メディア統合機能（macOS最適化）"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # macOSキャッシュディレクトリ
        self.cache_dir = Path.home() / "Developer" / "tasty-recipe-monitor" / "data" / "media_cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # macOS画像最適化設定
        self.image_settings = {
            "thumbnail_size": (1280, 720),
            "quality": 85,
            "format": "JPEG"
        }
    
    async def process_youtube_video(self, video_data: Dict) -> Dict[str, Any]:
        """YouTube動画処理"""
        try:
            video_id = video_data.get('video_id', '')
            
            # サムネイル取得・最適化
            thumbnail_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
            optimized_thumbnail = await self._optimize_thumbnail(thumbnail_url, video_id)
            
            # 動画メタデータ整形
            processed_data = {
                "video_id": video_id,
                "embed_url": f"https://www.youtube.com/embed/{video_id}",
                "watch_url": f"https://www.youtube.com/watch?v={video_id}",
                "thumbnail": {
                    "original": thumbnail_url,
                    "optimized": optimized_thumbnail,
                    "cached": optimized_thumbnail is not None
                },
                "duration": video_data.get('duration', 'Unknown'),
                "view_count": video_data.get('view_count', 0),
                "published_at": video_data.get('published_at', '')
            }
            
            return processed_data
            
        except Exception as e:
            self.logger.error(f"動画処理エラー: {e}")
            return {"error": str(e)}
    
    async def _optimize_thumbnail(self, thumbnail_url: str, video_id: str) -> Optional[str]:
        """サムネイル最適化（macOS用）"""
        try:
            cache_path = self.cache_dir / f"{video_id}_thumbnail.jpg"
            
            # キャッシュチェック
            if cache_path.exists():
                return str(cache_path)
            
            # 画像ダウンロード
            async with aiohttp.ClientSession() as session:
                async with session.get(thumbnail_url) as response:
                    if response.status == 200:
                        image_data = await response.read()
                    else:
                        return None
            
            # PIL使用して最適化
            image = Image.open(io.BytesIO(image_data))
            
            # リサイズ（アスペクト比維持）
            image.thumbnail(self.image_settings["thumbnail_size"], Image.Resampling.LANCZOS)
            
            # JPEG変換・保存
            if image.mode in ('RGBA', 'P'):
                # 透明度を白背景に変換
                background = Image.new('RGB', image.size, (255, 255, 255))
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            
            image.save(
                cache_path, 
                self.image_settings["format"], 
                quality=self.image_settings["quality"],
                optimize=True
            )
            
            # macOS用メタデータ追加
            await self._add_macos_metadata(cache_path, video_id)
            
            return str(cache_path)
            
        except Exception as e:
            self.logger.error(f"サムネイル最適化エラー: {e}")
            return None
    
    async def _add_macos_metadata(self, image_path: Path, video_id: str):
        """macOSメタデータ追加"""
        try:
            # xattrコマンドでメタデータ追加
            metadata = {
                "com.tasty.video_id": video_id,
                "com.tasty.processed_date": datetime.now().isoformat()
            }
            
            for key, value in metadata.items():
                subprocess.run([
                    'xattr', '-w', key, value, str(image_path)
                ], check=False)
                
        except Exception as e:
            self.logger.debug(f"メタデータ追加エラー: {e}")
    
    async def generate_notion_embed(self, video_url: str) -> Dict[str, Any]:
        """Notion用埋め込み生成"""
        return {
            "type": "embed",
            "embed": {
                "url": video_url
            }
        }
    
    async def process_recipe_images(self, recipe_data: Dict) -> List[Dict]:
        """レシピ画像処理"""
        processed_images = []
        
        # レシピ内の画像URL抽出
        image_urls = recipe_data.get('images', [])
        
        for idx, image_url in enumerate(image_urls):
            optimized_path = await self._optimize_recipe_image(
                image_url, 
                f"{recipe_data.get('video_id', 'unknown')}_{idx}"
            )
            
            if optimized_path:
                processed_images.append({
                    "original_url": image_url,
                    "optimized_path": optimized_path,
                    "index": idx
                })
        
        return processed_images
    
    async def _optimize_recipe_image(self, image_url: str, image_id: str) -> Optional[str]:
        """レシピ画像最適化"""
        try:
            cache_path = self.cache_dir / f"{image_id}_recipe.jpg"
            
            if cache_path.exists():
                return str(cache_path)
            
            # 画像ダウンロード・最適化（サムネイルと同様の処理）
            # ... (実装省略)
            
            return str(cache_path)
            
        except Exception as e:
            self.logger.error(f"レシピ画像最適化エラー: {e}")
            return None
    
    async def cleanup_old_cache(self, days: int = 30):
        """古いキャッシュクリーンアップ"""
        try:
            import time
            current_time = time.time()
            
            for cache_file in self.cache_dir.iterdir():
                if cache_file.is_file():
                    file_age = current_time - cache_file.stat().st_mtime
                    if file_age > (days * 24 * 3600):
                        cache_file.unlink()
                        self.logger.info(f"古いキャッシュ削除: {cache_file.name}")
            
        except Exception as e:
            self.logger.error(f"キャッシュクリーンアップエラー: {e}")
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """キャッシュ統計取得"""
        try:
            total_size = 0
            file_count = 0
            
            for cache_file in self.cache_dir.iterdir():
                if cache_file.is_file():
                    total_size += cache_file.stat().st_size
                    file_count += 1
            
            return {
                "cache_directory": str(self.cache_dir),
                "total_files": file_count,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "oldest_file": self._get_oldest_file(),
                "newest_file": self._get_newest_file()
            }
            
        except Exception as e:
            self.logger.error(f"キャッシュ統計エラー: {e}")
            return {"error": str(e)}
    
    def _get_oldest_file(self) -> Optional[str]:
        """最古のファイル取得"""
        try:
            files = list(self.cache_dir.iterdir())
            if not files:
                return None
            
            oldest = min(files, key=lambda f: f.stat().st_mtime)
            return oldest.name
            
        except Exception:
            return None
    
    def _get_newest_file(self) -> Optional[str]:
        """最新のファイル取得"""
        try:
            files = list(self.cache_dir.iterdir())
            if not files:
                return None
            
            newest = max(files, key=lambda f: f.stat().st_mtime)
            return newest.name
            
        except Exception:
            return None
```

---

## ✅ 実行チェックリスト

### 🔍 Claude Code実装前準備
- [ ] 01_MacOS環境準備設定 完了確認
- [ ] 02_API認証設定 完了確認
- [ ] 03_3チャンネル監視システム 完了確認
- [ ] Notion ワークスペース準備完了
- [ ] データベーステンプレート作成準備

### 🚀 実装順序
1. Notionデータベース手動作成
2. `services/notion_client.py` の実装
3. `services/recipe_page_generator.py` の実装
4. `services/notion_database_manager.py` の実装
5. `services/media_integrator.py` の実装
6. `services/recipe_quality_assessor.py` の実装
7. 統合テストの実行

### ✅ 実装後検証項目
- [ ] データベーススキーマが正しく設定されている
- [ ] レシピページが正常に作成される
- [ ] チャンネル別テンプレートが適用される
- [ ] YouTube動画が正しく埋め込まれる
- [ ] 画像キャッシュが機能している
- [ ] macOS通知が動作する
- [ ] LaunchDaemonとの統合が確認されている

---

## ⚠️ エラーハンドリング・トラブルシューティング

### 🔧 macOS固有のエラーと対処法

#### Notion API エラー
- **rate_limited**: レート制限超過 → 待機時間を増やす
- **unauthorized**: トークン無効 → Keychainから再取得
- **validation_error**: プロパティ不一致 → スキーマ確認

#### メディア処理エラー
- **PIL ImportError**: Pillow未インストール → `pip install Pillow`
- **xattr permission**: 権限不足 → ファイル権限確認
- **cache directory full**: 容量不足 → 古いキャッシュ削除

#### macOS固有エラー
- **osascript failed**: 通知権限なし → システム環境設定で許可
- **keychain access denied**: Keychain権限 → アクセス許可
- **LaunchDaemon conflict**: 競合発生 → プロセス確認

### 🔍 診断スクリプト

**ファイル**: `scripts/diagnose_notion_integration.py`

```python
# 実装要件:
import asyncio
from pathlib import Path
from services.notion_client import NotionRecipeClient
from services.notion_database_manager import NotionDatabaseManager
from services.media_integrator import MediaIntegrator

class NotionIntegrationDiagnostics:
    """Notion統合診断クラス（macOS対応）"""
    
    def __init__(self):
        self.base_dir = Path.home() / "Developer" / "tasty-recipe-monitor"
    
    async def run_diagnostics(self):
        """総合診断実行"""
        print("=== Notion統合診断開始 ===")
        
        # 1. 認証情報確認
        auth_check = await self.check_authentication()
        
        # 2. データベース接続確認
        db_check = await self.check_database_connection()
        
        # 3. スキーマ検証
        schema_check = await self.check_database_schema()
        
        # 4. ページ作成テスト
        create_check = await self.test_page_creation()
        
        # 5. メディア処理確認
        media_check = await self.check_media_processing()
        
        # 6. キャッシュ状態確認
        cache_check = await self.check_cache_status()
        
        # レポート生成
        self.generate_diagnostic_report({
            "authentication": auth_check,
            "database_connection": db_check,
            "schema_validation": schema_check,
            "page_creation": create_check,
            "media_processing": media_check,
            "cache_status": cache_check
        })
    
    async def check_authentication(self):
        """認証確認"""
        # Keychain認証情報確認
        pass
    
    async def check_database_connection(self):
        """データベース接続確認"""
        # Notion API接続テスト
        pass
    
    async def check_database_schema(self):
        """スキーマ検証"""
        # 必須プロパティ確認
        pass
    
    async def test_page_creation(self):
        """ページ作成テスト"""
        # テストページ作成・削除
        pass
    
    async def check_media_processing(self):
        """メディア処理確認"""
        # 画像最適化テスト
        pass
    
    async def check_cache_status(self):
        """キャッシュ状態確認"""
        # キャッシュディレクトリ確認
        pass
    
    def generate_diagnostic_report(self, results):
        """診断レポート生成"""
        # 結果出力・推奨事項提示
        pass

if __name__ == "__main__":
    diagnostics = NotionIntegrationDiagnostics()
    asyncio.run(diagnostics.run_diagnostics())
```

---

## 📋 段階的設定ガイド

### ✅ Notionデータベース設定手順

#### 段階1: データベース作成
1. Notionで新規ページ作成
2. データベース（フルページ）選択
3. タイトル: "🍖 肉料理レシピ収集"

#### 段階2: プロパティ設定
1. 各プロパティを手動追加
2. タイプと名前を正確に設定
3. セレクトオプションを追加

#### 段階3: Integration共有
1. データベース右上の「...」メニュー
2. 「Add connections」選択
3. 作成したIntegrationを選択

#### 段階4: データベースID取得
1. ブラウザでデータベースを開く
2. URLから32文字のIDをコピー
3. Keychainに保存

### 🔄 自動設定スクリプト

**ファイル**: `scripts/setup_notion_integration.py`

```python
# 実装要件:
import asyncio
from pathlib import Path
from config.keychain_manager import MacOSKeychainManager
from services.notion_client import NotionRecipeClient
from services.notion_database_manager import NotionDatabaseManager

async def setup_notion_integration():
    """Notion統合自動設定（macOS）"""
    
    print("=== Notion統合設定開始 ===")
    
    # 1. Keychain確認
    keychain = MacOSKeychainManager()
    token = keychain.get_password("NOTION_TOKEN")
    database_id = keychain.get_password("NOTION_DATABASE_ID")
    
    if not token or not database_id:
        print("❌ Notion認証情報が見つかりません")
        print("scripts/setup_keychain.pyを実行してください")
        return False
    
    # 2. クライアント初期化
    client = NotionRecipeClient(token, database_id)
    manager = NotionDatabaseManager(client)
    
    # 3. データベース初期化
    print("データベース初期化中...")
    success = await client.initialize_database()
    if not success:
        print("❌ データベース初期化失敗")
        return False
    
    # 4. スキーマ検証
    print("スキーマ検証中...")
    schema_result = await manager.verify_database_schema()
    
    if not schema_result["schema_valid"]:
        print("⚠️ スキーマ不完全:")
        if schema_result["missing_properties"]:
            print(f"  不足プロパティ: {', '.join(schema_result['missing_properties'])}")
        if schema_result["type_mismatches"]:
            print(f"  タイプ不一致: {schema_result['type_mismatches']}")
        
        print("\nNotionでデータベースプロパティを手動設定してください")
        return False
    
    # 5. テストページ作成
    print("テストページ作成中...")
    test_recipe = {
        "title": "Integration Test Recipe",
        "translated_title": "統合テストレシピ",
        "url": "https://www.youtube.com/watch?v=test123",
        "channel": "sam",
        "cook_time_minutes": 30,
        "servings": 4,
        "main_ingredients": ["🥩 牛肉"],
        "cooking_methods": ["🔥 グリル"],
        "quality_score": 8.5,
        "duration": "10:30",
        "view_count": 1000,
        "published_at": "2025-07-24"
    }
    
    page_id = await client.create_recipe_page(test_recipe)
    if page_id:
        print(f"✅ テストページ作成成功: {page_id}")
        print("Notionでページを確認してください")
    else:
        print("❌ テストページ作成失敗")
        return False
    
    # 6. キャッシュディレクトリ作成
    cache_dir = Path.home() / "Developer" / "tasty-recipe-monitor" / "data" / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    media_cache_dir = Path.home() / "Developer" / "tasty-recipe-monitor" / "data" / "media_cache"
    media_cache_dir.mkdir(parents=True, exist_ok=True)
    
    print("\n=== Notion統合設定完了 ===")
    return True

if __name__ == "__main__":
    success = asyncio.run(setup_notion_integration())
    exit(0 if success else 1)
```

---

## 🎯 Claude Code実装指示

### 📋 実装順序

#### Step 1: Notionデータベースを手動作成してください
- 上記スキーマに従って正確に作成
- Integration共有を忘れずに
- データベースIDをKeychainに保存

#### Step 2: `services/notion_client.py` を実装してください
- NotionRecipeClient クラスの完全実装
- macOS Keychain統合
- エラーハンドリングとリトライ機能

#### Step 3: `services/recipe_page_generator.py` を実装してください
- チャンネル別テンプレートエンジン
- 動的コンテンツ生成
- macOS最適化

#### Step 4: `services/notion_database_manager.py` を実装してください
- スキーマ管理機能
- プロパティ検証
- 統計機能

#### Step 5: `services/media_integrator.py` を実装してください
- YouTube動画処理
- 画像最適化（PIL使用）
- macOSメタデータ統合

#### Step 6: `services/recipe_quality_assessor.py` を実装してください
- 品質評価アルゴリズム
- スコアリングシステム
- 改善提案機能

### ⚠️ 実装時の注意点
- Notion APIのレート制限を厳守（3req/sec）
- macOS通知を適切に使用
- キャッシュ管理を効率的に
- エラーハンドリングを充実

### ✅ 完了確認
- 全チャンネルでページ作成成功
- テンプレートが正しく適用
- メディアが適切に埋め込まれる
- macOS環境での安定動作

---

## 🔄 次のステップ

**次の仕様書**: 05_Gmail通知統合仕様書  
この仕様書完了後に05番の仕様書を要求してください

---

*Notionを活用した美しく整理されたレシピデータベースを構築しましょう！*