#!/bin/bash
################################################################################
# PostgreSQL監視システムセットアップスクリプト
# PersonalCookingRecipe - Docker非依存ネイティブ監視システム
#
# 使用方法:
#   ./scripts/setup-postgresql-monitoring.sh
#
# 前提条件:
#   - PostgreSQL 14以上がインストール済み
#   - Redis 6以上がインストール済み
#   - recipe_db データベースが作成済み
################################################################################

set -e  # エラーで即座に終了

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
MIGRATION_FILE="$BACKEND_DIR/src/monitoring/migrations/001-create-metrics-tables.sql"

log_info "=========================================="
log_info "PostgreSQL監視システムセットアップ開始"
log_info "=========================================="
echo ""

# 1. PostgreSQL接続確認
log_info "1. PostgreSQL接続確認..."
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    log_success "PostgreSQL接続OK"
else
    log_error "PostgreSQLサーバーが起動していません"
    log_info "以下のコマンドでPostgreSQLを起動してください:"
    echo "  sudo systemctl start postgresql"
    echo "  または"
    echo "  sudo service postgresql start"
    exit 1
fi

# 2. PostgreSQL認証情報の確認
log_info "2. PostgreSQL認証情報確認..."
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-recipe_db}"
DB_USER="${DB_USER:-recipe_user}"

log_info "  接続先: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"

# パスワードプロンプト（必要な場合）
if [ -z "$PGPASSWORD" ]; then
    read -sp "PostgreSQLパスワードを入力してください: " DB_PASSWORD
    echo ""
    export PGPASSWORD="$DB_PASSWORD"
fi

# 接続テスト
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
    log_success "データベース接続成功"
else
    log_error "データベース接続失敗"
    log_info "以下を確認してください:"
    echo "  1. データベース '$DB_NAME' が存在するか"
    echo "  2. ユーザー '$DB_USER' の権限が正しいか"
    echo "  3. pg_hba.conf の設定が正しいか"
    exit 1
fi

# 3. マイグレーションファイルの確認
log_info "3. マイグレーションファイル確認..."
if [ ! -f "$MIGRATION_FILE" ]; then
    log_error "マイグレーションファイルが見つかりません: $MIGRATION_FILE"
    exit 1
fi
log_success "マイグレーションファイル確認OK"

# 4. マイグレーション実行
log_info "4. マイグレーション実行..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE" > /dev/null 2>&1; then
    log_success "マイグレーション実行成功"
else
    log_warning "マイグレーション実行時に警告が発生しました（既存テーブルがある場合は正常です）"
fi

# 5. テーブル確認
log_info "5. 作成されたテーブル確認..."
TABLES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "\dt" | grep -E "(system_metrics|metrics_raw|metrics_hourly|daily_summaries|alert_history)" | wc -l)

if [ "$TABLES" -ge 5 ]; then
    log_success "全テーブル作成完了 ($TABLES テーブル)"

    # テーブル一覧表示
    echo ""
    log_info "作成されたテーブル:"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt" | grep -E "(system_metrics|metrics_raw|metrics_hourly|daily_summaries|alert_history)"
else
    log_warning "一部のテーブルが作成されていない可能性があります ($TABLES / 5 テーブル)"
fi

# 6. ビュー確認
log_info "6. 作成されたビュー確認..."
VIEWS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "\dv" | grep -E "(metrics_last_24h|latest_metrics|active_alerts)" | wc -l)

if [ "$VIEWS" -ge 3 ]; then
    log_success "全ビュー作成完了 ($VIEWS ビュー)"
else
    log_warning "一部のビューが作成されていない可能性があります ($VIEWS / 3 ビュー)"
fi

# 7. 関数確認
log_info "7. 作成された関数確認..."
FUNCTIONS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "\df" | grep -E "(cleanup_old_metrics|get_metric_stats|refresh_metrics_views)" | wc -l)

if [ "$FUNCTIONS" -ge 3 ]; then
    log_success "全関数作成完了 ($FUNCTIONS 関数)"
else
    log_warning "一部の関数が作成されていない可能性があります ($FUNCTIONS / 3 関数)"
fi

# 8. Redis接続確認
log_info "8. Redis接続確認..."
if redis-cli -h "${REDIS_HOST:-localhost}" -p "${REDIS_PORT:-6379}" ping > /dev/null 2>&1; then
    log_success "Redis接続OK"
else
    log_warning "Redisサーバーが起動していません（監視システムは動作しますが、リアルタイムメトリクスは無効になります）"
    log_info "Redisを起動する場合:"
    echo "  sudo systemctl start redis-server"
fi

# 9. Node.js依存パッケージ確認
log_info "9. Node.js依存パッケージ確認..."
cd "$BACKEND_DIR"

if [ ! -d "node_modules" ]; then
    log_warning "node_modules が見つかりません。npm install を実行します..."
    npm install
fi

# 必須パッケージの確認
REQUIRED_PACKAGES=("pg" "ioredis" "node-cron" "winston")
MISSING_PACKAGES=()

for pkg in "${REQUIRED_PACKAGES[@]}"; do
    if ! npm list "$pkg" > /dev/null 2>&1; then
        MISSING_PACKAGES+=("$pkg")
    fi
done

if [ ${#MISSING_PACKAGES[@]} -eq 0 ]; then
    log_success "全依存パッケージインストール済み"
else
    log_warning "以下のパッケージが不足しています: ${MISSING_PACKAGES[*]}"
    log_info "インストールを実行します..."
    npm install "${MISSING_PACKAGES[@]}"
fi

# 10. ログディレクトリ作成
log_info "10. ログディレクトリ作成..."
mkdir -p "$BACKEND_DIR/logs"
log_success "ログディレクトリ作成完了"

# 11. セットアップ完了確認
echo ""
log_info "=========================================="
log_success "PostgreSQL監視システムセットアップ完了"
log_info "=========================================="
echo ""

# セットアップ結果サマリー
log_info "セットアップ結果サマリー:"
echo "  データベース: $DB_NAME"
echo "  テーブル数:   $TABLES"
echo "  ビュー数:     $VIEWS"
echo "  関数数:       $FUNCTIONS"
echo ""

# 次のステップ
log_info "次のステップ:"
echo ""
echo "1. 監視システムのテスト:"
echo "   cd $BACKEND_DIR"
echo "   node src/monitoring/test-monitoring.js"
echo ""
echo "2. PM2で監視システムを起動:"
echo "   pm2 start ecosystem.config.js --only recipe-monitoring-collector"
echo ""
echo "3. 監視ダッシュボードへアクセス:"
echo "   http://localhost:5000/monitoring/dashboard"
echo ""
echo "4. メトリクスの確認:"
echo "   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c 'SELECT * FROM latest_metrics;'"
echo ""

# 環境変数の保存（.envファイル）
ENV_FILE="$BACKEND_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    log_info "環境変数ファイル作成..."
    cat > "$ENV_FILE" <<EOF
# PostgreSQL監視システム設定
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Redis設定
REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6379}

# 監視設定
MONITORING_ENABLED=true
METRICS_RETENTION_DAYS=30
EOF
    log_success ".env ファイル作成完了"
    log_warning "重要: .env ファイルは .gitignore に追加してください"
fi

log_success "全セットアップ完了しました！"
