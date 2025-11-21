#!/bin/bash
# PostgreSQL監視システム自動セットアップスクリプト
# PersonalCookingRecipe Project
# 作成日: 2025-11-21

set -e  # エラーで停止

echo "🚀 PostgreSQL監視システムセットアップ開始"
echo "================================================"

# カラー定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: PostgreSQL起動確認
echo ""
echo "${YELLOW}Step 1: PostgreSQL起動確認${NC}"
if systemctl is-active --quiet postgresql; then
    echo "${GREEN}✅ PostgreSQL既に起動中${NC}"
else
    echo "${YELLOW}⚠️ PostgreSQL起動中...${NC}"
    sudo systemctl start postgresql
    sleep 2
    echo "${GREEN}✅ PostgreSQL起動完了${NC}"
fi

# Step 2: PostgreSQLバージョン確認
echo ""
echo "${YELLOW}Step 2: PostgreSQLバージョン確認${NC}"
VERSION=$(sudo -u postgres psql -t -c "SELECT version();" | head -1)
echo "${GREEN}✅ $VERSION${NC}"

# Step 3: データベース存在確認
echo ""
echo "${YELLOW}Step 3: データベース存在確認${NC}"
DB_EXISTS=$(sudo -u postgres psql -t -c "SELECT 1 FROM pg_database WHERE datname='recipe_db';" | xargs)

if [ "$DB_EXISTS" = "1" ]; then
    echo "${YELLOW}⚠️ recipe_db既に存在します${NC}"
    read -p "削除して再作成しますか? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "${YELLOW}データベース削除中...${NC}"
        sudo -u postgres psql -c "DROP DATABASE IF EXISTS recipe_db;"
        sudo -u postgres psql -c "DROP USER IF EXISTS recipe_user;"
        echo "${GREEN}✅ 削除完了${NC}"
    else
        echo "${YELLOW}既存データベースを使用します${NC}"
        USER_EXISTS=$(sudo -u postgres psql -t -c "SELECT 1 FROM pg_user WHERE usename='recipe_user';" | xargs)
        if [ "$USER_EXISTS" != "1" ]; then
            echo "${YELLOW}ユーザー作成中...${NC}"
            sudo -u postgres psql -c "CREATE USER recipe_user WITH PASSWORD 'recipe_secure_password_2024';"
            sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE recipe_db TO recipe_user;"
            sudo -u postgres psql -d recipe_db -c "GRANT ALL ON SCHEMA public TO recipe_user;"
        fi
        echo "${GREEN}✅ データベース準備完了${NC}"
        SKIP_CREATE=1
    fi
fi

# Step 4: データベース作成 (必要な場合)
if [ "$SKIP_CREATE" != "1" ]; then
    echo ""
    echo "${YELLOW}Step 4: データベースとユーザー作成${NC}"

    sudo -u postgres psql << 'EOSQL'
CREATE DATABASE recipe_db;
CREATE USER recipe_user WITH PASSWORD 'recipe_secure_password_2024';
GRANT ALL PRIVILEGES ON DATABASE recipe_db TO recipe_user;
EOSQL

    sudo -u postgres psql -d recipe_db -c "GRANT ALL ON SCHEMA public TO recipe_user;"

    echo "${GREEN}✅ データベース作成完了${NC}"
fi

# Step 5: 監視テーブル作成
echo ""
echo "${YELLOW}Step 5: 監視テーブル作成${NC}"

MIGRATION_FILE="/mnt/Linux-ExHDD/PersonalCookingRecipe/backend/src/monitoring/migrations/001-create-metrics-tables.sql"

if [ -f "$MIGRATION_FILE" ]; then
    echo "${YELLOW}マイグレーション実行中...${NC}"
    sudo -u postgres psql -d recipe_db -f "$MIGRATION_FILE" 2>&1 | grep -E "(CREATE|ERROR|GRANT)" || true
    echo "${GREEN}✅ 監視テーブル作成完了${NC}"
else
    echo "${RED}❌ マイグレーションファイルが見つかりません: $MIGRATION_FILE${NC}"
    exit 1
fi

# Step 6: テーブル確認
echo ""
echo "${YELLOW}Step 6: テーブル確認${NC}"
sudo -u postgres psql -d recipe_db -c "\dt" | grep -E "(system_metrics|metrics_raw|alert_history)" || echo "${YELLOW}⚠️ テーブルが見つかりません${NC}"

# Step 7: 接続テスト
echo ""
echo "${YELLOW}Step 7: アプリケーションユーザーでの接続テスト${NC}"
PGPASSWORD='recipe_secure_password_2024' psql -h localhost -U recipe_user -d recipe_db -c "SELECT NOW() as current_time;" && echo "${GREEN}✅ 接続テスト成功${NC}" || echo "${RED}❌ 接続テスト失敗${NC}"

# Step 8: 完了
echo ""
echo "${GREEN}================================================${NC}"
echo "${GREEN}🎉 PostgreSQL監視システムセットアップ完了!${NC}"
echo "${GREEN}================================================${NC}"
echo ""
echo "次のステップ:"
echo "1. 動作確認テスト: cd backend && node src/monitoring/test-monitoring.js"
echo "2. PM2起動: pm2 start ecosystem.config.js --only recipe-monitoring-collector"
echo "3. ダッシュボードアクセス: http://localhost:5000/monitoring/dashboard"
echo ""
