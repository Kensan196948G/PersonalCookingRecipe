#!/usr/bin/env python3
"""
SQLite → PostgreSQL データ移行スクリプト
PersonalCookingRecipe Phase 1 → Phase 2 移行対応

Author: Recipe Migration Specialist
Date: 2025-08-30
"""

import sqlite3
import psycopg2
import json
import sys
import os
from datetime import datetime
import logging

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('../logs/migration.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SQLiteToPostgreSQLMigrator:
    def __init__(self):
        # SQLite設定
        self.sqlite_path = '../backend/data/recipes.db'
        
        # PostgreSQL設定 (環境変数から取得)
        self.pg_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': int(os.getenv('DB_PORT', '5432')),
            'database': os.getenv('DB_NAME', 'recipe_db'),
            'user': os.getenv('DB_USER', 'recipe_user'),
            'password': os.getenv('DB_PASSWORD', 'recipe_secure_password_2024')
        }
        
        self.sqlite_conn = None
        self.pg_conn = None
        
    def connect_databases(self):
        """データベース接続確立"""
        try:
            # SQLite接続
            if not os.path.exists(self.sqlite_path):
                logger.warning(f"⚠️ SQLiteファイル未見つけ: {self.sqlite_path}")
                logger.info("🆕 新規インストールとして続行します")
                return True
                
            self.sqlite_conn = sqlite3.connect(self.sqlite_path)
            self.sqlite_conn.row_factory = sqlite3.Row
            logger.info("✅ SQLite接続成功")
            
            # PostgreSQL接続
            self.pg_conn = psycopg2.connect(**self.pg_config)
            self.pg_conn.autocommit = False
            logger.info("✅ PostgreSQL接続成功")
            
            return True
        except Exception as e:
            logger.error(f"❌ データベース接続エラー: {e}")
            return False

    def analyze_sqlite_data(self):
        """SQLiteデータ分析"""
        if not self.sqlite_conn:
            logger.info("📊 SQLiteデータなし - 新規セットアップ")
            return {
                'users': 0,
                'recipes': 0, 
                'categories': 0,
                'has_data': False
            }
            
        try:
            cursor = self.sqlite_conn.cursor()
            
            # テーブル存在確認
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
            """)
            tables = [row[0] for row in cursor.fetchall()]
            
            analysis = {'tables': tables, 'has_data': len(tables) > 0}
            
            # データ件数確認
            for table in ['users', 'recipes', 'categories']:
                if table in tables:
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    count = cursor.fetchone()[0]
                    analysis[table] = count
                    logger.info(f"📊 {table}: {count}件")
                else:
                    analysis[table] = 0
                    
            return analysis
        except Exception as e:
            logger.error(f"❌ SQLite分析エラー: {e}")
            return {'has_data': False}

    def migrate_users(self):
        """ユーザーデータ移行"""
        if not self.sqlite_conn:
            return True
            
        try:
            sqlite_cursor = self.sqlite_conn.cursor()
            pg_cursor = self.pg_conn.cursor()
            
            # SQLiteからユーザーデータ取得
            sqlite_cursor.execute("SELECT * FROM users")
            users = sqlite_cursor.fetchall()
            
            if not users:
                logger.info("📝 ユーザーデータなし - スキップ")
                return True
                
            logger.info(f"👥 ユーザーデータ移行開始: {len(users)}件")
            
            for user in users:
                pg_cursor.execute("""
                    INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                """, (
                    user['id'],
                    user['username'],
                    user['email'], 
                    user['password_hash'],
                    user.get('created_at', datetime.now()),
                    user.get('updated_at', datetime.now())
                ))
                
            self.pg_conn.commit()
            logger.info("✅ ユーザーデータ移行完了")
            return True
            
        except Exception as e:
            logger.error(f"❌ ユーザー移行エラー: {e}")
            self.pg_conn.rollback()
            return False

    def migrate_categories(self):
        """カテゴリデータ移行"""
        if not self.sqlite_conn:
            return True
            
        try:
            sqlite_cursor = self.sqlite_conn.cursor()
            pg_cursor = self.pg_conn.cursor()
            
            sqlite_cursor.execute("SELECT * FROM categories")
            categories = sqlite_cursor.fetchall()
            
            if not categories:
                logger.info("📝 カテゴリデータなし - デフォルト使用")
                return True
                
            logger.info(f"🏷️ カテゴリデータ移行開始: {len(categories)}件")
            
            for category in categories:
                pg_cursor.execute("""
                    INSERT INTO categories (id, name, description, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                """, (
                    category['id'],
                    category['name'],
                    category.get('description'),
                    category.get('created_at', datetime.now()),
                    category.get('updated_at', datetime.now())
                ))
                
            self.pg_conn.commit()
            logger.info("✅ カテゴリデータ移行完了")
            return True
            
        except Exception as e:
            logger.error(f"❌ カテゴリ移行エラー: {e}")
            self.pg_conn.rollback()
            return False

    def migrate_recipes(self):
        """レシピデータ移行（JSON対応）"""
        if not self.sqlite_conn:
            return True
            
        try:
            sqlite_cursor = self.sqlite_conn.cursor()
            pg_cursor = self.pg_conn.cursor()
            
            sqlite_cursor.execute("SELECT * FROM recipes")
            recipes = sqlite_cursor.fetchall()
            
            if not recipes:
                logger.info("📝 レシピデータなし - スキップ")
                return True
                
            logger.info(f"🍽️ レシピデータ移行開始: {len(recipes)}件")
            
            for recipe in recipes:
                # JSONデータの変換処理
                ingredients = recipe['ingredients']
                instructions = recipe['instructions']
                
                if isinstance(ingredients, str):
                    try:
                        ingredients = json.loads(ingredients)
                    except:
                        ingredients = [ingredients]  # フォールバック
                        
                if isinstance(instructions, str):
                    try:
                        instructions = json.loads(instructions)
                    except:
                        instructions = [instructions]  # フォールバック
                
                pg_cursor.execute("""
                    INSERT INTO recipes (
                        id, title, description, ingredients, instructions,
                        prep_time, cook_time, servings, difficulty_level,
                        category_id, user_id, image_url, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                """, (
                    recipe['id'],
                    recipe['title'],
                    recipe.get('description'),
                    json.dumps(ingredients),
                    json.dumps(instructions),
                    recipe.get('prep_time'),
                    recipe.get('cook_time'),
                    recipe.get('servings'),
                    recipe.get('difficulty_level'),
                    recipe.get('category_id'),
                    recipe.get('user_id'),
                    recipe.get('image_url'),
                    recipe.get('created_at', datetime.now()),
                    recipe.get('updated_at', datetime.now())
                ))
                
            self.pg_conn.commit()
            logger.info("✅ レシピデータ移行完了")
            return True
            
        except Exception as e:
            logger.error(f"❌ レシピ移行エラー: {e}")
            self.pg_conn.rollback()
            return False

    def verify_migration(self):
        """移行データ検証"""
        try:
            pg_cursor = self.pg_conn.cursor()
            
            # データ件数確認
            tables = ['users', 'categories', 'recipes']
            verification_results = {}
            
            for table in tables:
                pg_cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = pg_cursor.fetchone()[0]
                verification_results[table] = count
                logger.info(f"✅ {table}: {count}件 (PostgreSQL)")
                
            # JSON列データ検証
            pg_cursor.execute("""
                SELECT title, ingredients, instructions 
                FROM recipes 
                LIMIT 3
            """)
            sample_recipes = pg_cursor.fetchall()
            
            logger.info("🔍 レシピデータサンプル検証:")
            for recipe in sample_recipes:
                title, ingredients, instructions = recipe
                logger.info(f"   📄 {title[:30]}...")
                
                # JSON構造確認
                try:
                    json.loads(ingredients)
                    json.loads(instructions)
                    logger.info("   ✅ JSON構造正常")
                except:
                    logger.warning("   ⚠️ JSON構造に問題あり")
                    
            return verification_results
            
        except Exception as e:
            logger.error(f"❌ 検証エラー: {e}")
            return {}

    def run_migration(self):
        """完全移行実行"""
        logger.info("🚀 SQLite → PostgreSQL移行開始")
        
        try:
            # 1. データベース接続
            if not self.connect_databases():
                return False
                
            # 2. SQLiteデータ分析
            analysis = self.analyze_sqlite_data()
            logger.info(f"📊 移行対象データ: {analysis}")
            
            if not analysis['has_data']:
                logger.info("✅ 新規セットアップ - 移行不要")
                return True
                
            # 3. データ移行実行
            migration_steps = [
                ('ユーザー', self.migrate_users),
                ('カテゴリ', self.migrate_categories), 
                ('レシピ', self.migrate_recipes)
            ]
            
            for step_name, step_func in migration_steps:
                logger.info(f"🔄 {step_name}移行中...")
                if not step_func():
                    logger.error(f"❌ {step_name}移行失敗")
                    return False
                    
            # 4. 移行データ検証
            verification = self.verify_migration()
            logger.info(f"✅ 移行完了: {verification}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ 移行処理エラー: {e}")
            return False
            
        finally:
            # 接続クリーンアップ
            if self.sqlite_conn:
                self.sqlite_conn.close()
            if self.pg_conn:
                self.pg_conn.close()

def main():
    """メイン実行"""
    logger.info("=" * 60)
    logger.info("PersonalCookingRecipe データベース移行ツール")
    logger.info("SQLite → PostgreSQL Phase 1 完成版")
    logger.info("=" * 60)
    
    migrator = SQLiteToPostgreSQLMigrator()
    
    if migrator.run_migration():
        logger.info("🎉 データベース移行成功")
        sys.exit(0)
    else:
        logger.error("💥 データベース移行失敗")
        sys.exit(1)

if __name__ == "__main__":
    main()