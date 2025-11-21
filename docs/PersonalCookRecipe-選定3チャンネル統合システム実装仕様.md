#PersonalCookRecipe-選定3チャンネル統合システム実装仕様
# 選定3チャンネル統合システム実装仕様

## 🎯 選定チャンネル構成

### **✅ 確定監視チャンネル**

#### 1. **SAM THE COOKING GUY**
- **チャンネルID**: `UC8C7QblJwCHsYrftuLjGKig`
- **登録者**: 2.8M+
- **特徴**: 実用的な家庭料理、手軽なBBQ、リアルな調理環境
- **監視優先度**: 高（Priority 1）

#### 2. **Tasty Recipes**
- **チャンネルID**: `UCJFp8uSYCjXOMnkUyb3CQ3Q`
- **登録者**: 21M+
- **特徴**: 短時間レシピ、初心者向け、視覚的に魅力的
- **監視優先度**: 高（Priority 1）

#### 3. **Joshua Weissman Recipes**
- **チャンネルID**: `UChBEbMKI1eCcejTtmI32UEw`
- **登録者**: 10M+
- **特徴**: 詳細な技術解説、"But Better"シリーズ、プロ級指導
- **監視優先度**: 最高（Priority 1+）

---

## 🎭 3チャンネルの相互補完効果

### **📊 特徴比較マトリックス**

| 要素 | Sam the Cooking Guy | Tasty Recipes | Joshua Weissman | 統合効果 |
|------|---------------------|---------------|-----------------|----------|
| **難易度** | 初心者〜中級者 | 初心者 | 中級者〜上級者 | **全レベル対応** |
| **調理時間** | 30分〜1時間 | 15分〜30分 | 45分〜2時間 | **時間帯選択自由** |
| **設備要求** | 家庭用 | 最小限 | 家庭用+α | **環境適応力高** |
| **エンターテイメント性** | 高 | 非常に高 | 高 | **楽しく学習** |
| **実用性** | 非常に高 | 高 | 非常に高 | **実生活直結** |
| **技術教育** | 中 | 低 | 非常に高 | **段階的スキルアップ** |

### **🎯 3チャンネル統合の利点**

#### **1. 完璧な難易度グラデーション**
```
Tasty (入門) → Sam (実用) → Joshua (マスター)
```

#### **2. シチュエーション別対応**
- **平日の時短**: Tasty の15分レシピ
- **週末の家族料理**: Sam の実用レシピ  
- **特別な日**: Joshua の本格料理

#### **3. 学習進化パス**
1. **Tasty で料理に慣れる**
2. **Sam で実用技術を覚える**
3. **Joshua でプロ技術を習得**

---

## ⚙️ 技術実装仕様

### **チャンネル設定（config/channels.py）**

```python
from pathlib import Path
from config.keychain_manager import MacOSKeychainManager

# macOS環境設定
BASE_DIR = Path.home() / "Developer" / "tasty-recipe-monitor"

SELECTED_CHANNELS = {
    "sam_cooking_guy": {
        "id": "UC8C7QblJwCHsYrftuLjGKig",
        "name": "Sam The Cooking Guy",
        "priority": 1,
        "check_interval": 120,  # 2時間毎
        "max_videos_per_check": 8,
        "meat_keywords_weight": 1.2,  # BBQ・肉料理多め
        "difficulty_tag": "practical",
        "avg_cook_time": "30-60min",
        "specialty": ["BBQ", "comfort_food", "family_cooking"],
        "notification_enabled": True,
        "enabled": True
    },
    "tasty_recipes": {
        "id": "UCJFp8uSYCjXOMnkUyb3CQ3Q", 
        "name": "Tasty Recipes",
        "priority": 1,
        "check_interval": 60,   # 1時間毎（更新頻度高い）
        "max_videos_per_check": 12,
        "meat_keywords_weight": 1.0,
        "difficulty_tag": "beginner",
        "avg_cook_time": "15-30min",
        "specialty": ["quick_meals", "visual_appeal", "simple_techniques"],
        "notification_enabled": True,
        "enabled": True
    },
    "joshua_weissman": {
        "id": "UChBEbMKI1eCcejTtmI32UEw",
        "name": "Joshua Weissman Recipes", 
        "priority": 1,  # 最優先（詳細度最高）
        "check_interval": 90,   # 1.5時間毎
        "max_videos_per_check": 6,
        "meat_keywords_weight": 1.3,  # "But Better"シリーズ多い
        "difficulty_tag": "advanced",
        "avg_cook_time": "45-120min", 
        "specialty": ["technique_focus", "but_better", "professional_tips"],
        "notification_enabled": True,
        "enabled": True
    }
}

# 統合監視設定
MONITORING_STRATEGY = {
    "total_max_videos_per_cycle": 20,  # 全チャンネル合計上限
    "channel_rotation": True,          # チャンネル順次処理
    "priority_weighting": True,        # 優先度重み付け
    "duplicate_detection": True,       # 類似レシピ検出
    "quality_filtering": True,         # 品質フィルタリング
    "macos_notifications": True,       # macOSネイティブ通知
    "cache_directory": BASE_DIR / "data" / "cache"
}
```

### **LaunchDaemon実行スケジュール**

```xml
<!-- ~/Library/LaunchAgents/com.tasty.recipe.monitor.channels.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" 
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.tasty.recipe.monitor.channels</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/Users/USERNAME/Developer/tasty-recipe-monitor/venv/bin/python</string>
        <string>/Users/USERNAME/Developer/tasty-recipe-monitor/scripts/monitor_selected_channels.py</string>
    </array>
    
    <key>StartInterval</key>
    <integer>3600</integer> <!-- 1時間ごと -->
    
    <key>StandardOutPath</key>
    <string>/Users/USERNAME/Developer/tasty-recipe-monitor/logs/channels.log</string>
    
    <key>StandardErrorPath</key>
    <string>/Users/USERNAME/Developer/tasty-recipe-monitor/logs/channels_error.log</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

### **macOS用監視スクリプト**

```bash
#!/bin/bash
# scripts/monitor_selected_channels.sh

# macOS環境設定
PROJECT_DIR="$HOME/Developer/tasty-recipe-monitor"
VENV_PATH="$PROJECT_DIR/venv"
LOG_DIR="$PROJECT_DIR/logs"

# 仮想環境起動
source "$VENV_PATH/bin/activate"

# Pythonパス設定
export PYTHONPATH="$PROJECT_DIR:$PYTHONPATH"

# ログファイル名（日付付き）
LOG_FILE="$LOG_DIR/monitor_$(date +%Y%m%d).log"

# メイン監視実行
echo "=== 3チャンネル統合監視開始 $(date) ===" >> "$LOG_FILE"
python "$PROJECT_DIR/main.py" --channels all >> "$LOG_FILE" 2>&1

# macOS通知送信
if [ $? -eq 0 ]; then
    osascript -e 'display notification "3チャンネル監視完了" with title "Recipe Monitor" sound name "Glass"'
else
    osascript -e 'display notification "監視中にエラーが発生しました" with title "Recipe Monitor" sound name "Basso"'
fi

# チャンネル別個別監視（バックアップ）
python "$PROJECT_DIR/scripts/monitor_individual.py" --channel sam >> "$LOG_FILE" 2>&1
python "$PROJECT_DIR/scripts/monitor_individual.py" --channel tasty >> "$LOG_FILE" 2>&1
python "$PROJECT_DIR/scripts/monitor_individual.py" --channel joshua >> "$LOG_FILE" 2>&1

# ログローテーション（7日以上前のログ削除）
find "$LOG_DIR" -name "monitor_*.log" -mtime +7 -delete

deactivate
```

---

## 🔍 チャンネル特化型解析設定

### **1. Sam The Cooking Guy 解析特化**

```python
SAM_ANALYSIS_PROMPT = """
Sam The Cooking Guyの動画を解析し、以下に重点を置いてレシピを抽出してください：

重点項目：
1. 家庭で再現しやすい実用的な手法
2. 特別な器具を使わない調理方法
3. 材料の代替案や節約のコツ
4. BBQ・グリル技術の詳細
5. 失敗しにくい確実な手順

出力形式：
- 難易度: ★★☆（実用重視）
- 調理時間: 30-60分
- 特徴: 家庭向け、コスパ良好
- 代替材料案も含める
"""
```

### **2. Tasty Recipes 解析特化**

```python
TASTY_ANALYSIS_PROMPT = """
Tastyの動画を解析し、以下に重点を置いてレシピを抽出してください：

重点項目：
1. 15-30分で完成する時短レシピ
2. 最小限の材料と器具で作れる手順
3. 視覚的に美しい仕上がりのコツ
4. 初心者でも失敗しない簡単手法
5. SNS映えするプレゼンテーション

出力形式：
- 難易度: ★☆☆（初心者向け）
- 調理時間: 15-30分
- 特徴: 時短、簡単、見た目良し
- 材料は最小限に
"""
```

### **3. Joshua Weissman 解析特化**

```python
JOSHUA_ANALYSIS_PROMPT = """
Joshua Weissmanの動画を解析し、以下に重点を置いてレシピを抽出してください：

重点項目：
1. 各工程の科学的理由と技術的背景
2. プロ級の技術とコツの詳細解説
3. "But Better"シリーズの改良ポイント
4. 温度・時間の精密な管理方法
5. よくある失敗例とその回避策

出力形式：
- 難易度: ★★★（上級者向け）
- 調理時間: 45-120分
- 特徴: 技術重視、プロ級、詳細解説
- 科学的根拠も含める
"""
```

---

## 📊 統合処理フロー

### **1. 統合監視サイクル（macOS対応）**

```python
import asyncio
import subprocess
from pathlib import Path
from config.keychain_manager import MacOSKeychainManager

async def integrated_monitoring_cycle():
    """3チャンネル統合監視（macOS最適化）"""
    
    # Keychain認証
    keychain = MacOSKeychainManager()
    
    results = {
        "sam": [],
        "tasty": [], 
        "joshua": []
    }
    
    # 1. 各チャンネルから新動画取得
    for channel_key, config in SELECTED_CHANNELS.items():
        videos = await get_channel_videos(config)
        filtered_videos = filter_meat_recipes(videos, config)
        results[channel_key] = filtered_videos
        
        # チャンネル別キャッシュ保存
        cache_file = MONITORING_STRATEGY["cache_directory"] / f"{channel_key}_latest.json"
        save_to_cache(filtered_videos, cache_file)
    
    # 2. 重複除去・品質フィルタリング
    unique_recipes = remove_duplicates(results)
    quality_filtered = quality_filter(unique_recipes)
    
    # 3. 優先度順に処理
    priority_sorted = sort_by_priority(quality_filtered)
    
    # 4. チャンネル特化解析
    processed_count = 0
    for recipe in priority_sorted[:20]:  # 上位20件
        analyzed_recipe = await channel_specific_analysis(recipe)
        await create_notion_page(analyzed_recipe)
        await send_notification(analyzed_recipe)
        processed_count += 1
    
    # 5. macOS通知送信
    if MONITORING_STRATEGY["macos_notifications"]:
        await send_macos_summary_notification(processed_count, results)
    
    return processed_count

async def send_macos_summary_notification(count: int, results: dict):
    """macOSサマリー通知送信"""
    sam_count = len(results["sam"])
    tasty_count = len(results["tasty"])
    joshua_count = len(results["joshua"])
    
    message = f"Sam: {sam_count}件, Tasty: {tasty_count}件, Joshua: {joshua_count}件"
    
    subprocess.run([
        'osascript', '-e',
        f'display notification "{message}" with title "レシピ監視完了 ({count}件処理)" sound name "Glass"'
    ])
```

### **2. 重複検出ロジック（macOS最適化）**

```python
import hashlib
from pathlib import Path

def detect_recipe_similarity(recipe1, recipe2):
    """レシピの類似度判定（キャッシュ付き）"""
    
    # キャッシュキー生成
    cache_key = hashlib.md5(
        f"{recipe1['title']}:{recipe2['title']}".encode()
    ).hexdigest()
    
    # キャッシュチェック
    cache_file = MONITORING_STRATEGY["cache_directory"] / "similarity_cache.json"
    if cache_file.exists():
        cache = load_json(cache_file)
        if cache_key in cache:
            return cache[cache_key]
    
    # タイトル類似度
    title_similarity = calculate_text_similarity(
        recipe1['title'], recipe2['title']
    )
    
    # 材料類似度  
    ingredient_similarity = calculate_ingredient_similarity(
        recipe1['description'], recipe2['description']
    )
    
    # 調理法類似度
    method_similarity = detect_cooking_method_similarity(
        recipe1, recipe2
    )
    
    # 総合判定
    overall_similarity = (
        title_similarity * 0.4 +
        ingredient_similarity * 0.4 + 
        method_similarity * 0.2
    )
    
    is_duplicate = overall_similarity > 0.75  # 75%以上で重複判定
    
    # キャッシュ保存
    save_to_similarity_cache(cache_key, is_duplicate)
    
    return is_duplicate
```

---

## 🎨 Notion統合カスタマイズ（macOS対応）

### **チャンネル別ページテンプレート**

```python
def generate_channel_specific_page(recipe_data):
    """チャンネル特性に応じたページ生成（macOS最適化）"""
    
    channel = recipe_data['channel']
    
    # macOSクリップボード連携
    copy_to_clipboard(recipe_data['url'])
    
    if channel == "sam_cooking_guy":
        return generate_sam_page_template(recipe_data)
    elif channel == "tasty_recipes":
        return generate_tasty_page_template(recipe_data)
    elif channel == "joshua_weissman":
        return generate_joshua_page_template(recipe_data)

def generate_sam_page_template(recipe):
    """Sam専用テンプレート"""
    return {
        "title": f"🍖 {recipe['title']} (Sam流)",
        "properties": {
            "難易度": "★★☆ 実用派",
            "調理時間": recipe['cook_time'],
            "チャンネル": "Sam The Cooking Guy",
            "タグ": ["家庭料理", "実用的", "BBQ"]
        },
        "content": [
            "## 🏠 家庭での再現ポイント",
            recipe['practical_tips'],
            "## 💰 コスト削減のコツ", 
            recipe['cost_saving_tips'],
            "## 🔄 材料の代替案",
            recipe['ingredient_alternatives']
        ]
    }

def generate_joshua_page_template(recipe):
    """Joshua専用テンプレート"""
    return {
        "title": f"⭐ {recipe['title']} (プロ技術)",
        "properties": {
            "難易度": "★★★ プロ級", 
            "調理時間": recipe['cook_time'],
            "チャンネル": "Joshua Weissman",
            "タグ": ["プロ技術", "詳細解説", "But Better"]
        },
        "content": [
            "## 🧪 科学的根拠",
            recipe['scientific_explanation'],
            "## 🎯 プロのコツ",
            recipe['professional_tips'],
            "## ⚠️ 失敗回避法",
            recipe['failure_prevention']
        ]
    }

def copy_to_clipboard(text: str):
    """macOSクリップボードにコピー"""
    subprocess.run(['pbcopy'], input=text.encode(), check=True)
```

---

## 📈 期待される効果

### **🎯 レシピ収集量（推定）**
- **Sam The Cooking Guy**: 1日3-5レシピ
- **Tasty Recipes**: 1日5-8レシピ  
- **Joshua Weissman**: 1日2-4レシピ
- **合計**: **1日10-17レシピ**

### **📚 コンテンツの多様性**
- **時短料理**: Tasty（15-30分）
- **実用料理**: Sam（30-60分）
- **本格料理**: Joshua（45-120分）

### **🎓 学習効果**
- **入門**: Tastyで料理の楽しさを知る
- **実践**: Samで実用技術を身に付ける
- **上達**: Joshuaでプロ技術を習得

---

## 🚀 実装ロードマップ

### **Week 1: 基盤構築**
- [ ] macOS環境設定完了
- [ ] Keychain統合実装
- [ ] 3チャンネル設定完了
- [ ] 基本監視機能実装
- [ ] LaunchDaemon設定

### **Week 2: 特化機能開発**
- [ ] チャンネル別解析ロジック
- [ ] 重複検出機能（キャッシュ付き）
- [ ] 品質フィルタリング
- [ ] macOS通知統合

### **Week 3: 統合・最適化**
- [ ] 3チャンネル統合処理
- [ ] Notion特化テンプレート
- [ ] パフォーマンス最適化
- [ ] キャッシュ管理実装

### **Week 4: 本格運用開始**
- [ ] 24時間自動監視開始
- [ ] 品質監視・調整
- [ ] macOS省電力対応
- [ ] 追加機能検討

---

## 🛠️ macOS固有の実装ポイント

### **Keychain統合**
```bash
# APIキー保存例
security add-generic-password \
    -a "YOUTUBE_API_KEY" \
    -s "com.tasty.recipe.monitor" \
    -w "your-api-key"
```

### **LaunchDaemon管理**
```bash
# サービス読み込み
launchctl load ~/Library/LaunchAgents/com.tasty.recipe.monitor.channels.plist

# サービス状態確認
launchctl list | grep com.tasty.recipe.monitor

# ログ確認
tail -f ~/Developer/tasty-recipe-monitor/logs/channels.log
```

### **通知権限設定**
```bash
# システム環境設定 > 通知 で権限付与
osascript -e 'display notification "テスト通知" with title "Recipe Monitor"'
```

---

この3チャンネル構成により、**macOS環境で最適化された、初心者から上級者まで段階的にスキルアップできる完璧なレシピ収集システム**が完成します！

実装を開始しましょうか？まずはどの部分から着手したいですか？