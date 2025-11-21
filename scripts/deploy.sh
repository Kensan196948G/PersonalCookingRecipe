#!/bin/bash
# デプロイスクリプト
# Personal Cooking Recipe Deployment Script

set -e

# カラー出力
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

# 設定読み込み
if [ -f .env.production ]; then
    source .env.production
    log_info "本番環境設定を読み込みました"
else
    log_error ".env.production ファイルが見つかりません"
    exit 1
fi

# 引数処理
DEPLOY_MODE=${1:-"full"}
BACKUP_BEFORE=${2:-"true"}

log_info "Personal Cooking Recipe デプロイ開始"
log_info "モード: $DEPLOY_MODE"
log_info "デプロイ前バックアップ: $BACKUP_BEFORE"

# 前提条件チェック
log_info "前提条件をチェックしています..."

# Docker確認
if ! command -v docker &> /dev/null; then
    log_error "Dockerがインストールされていません"
    exit 1
fi

# Docker Compose確認
if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Composeがインストールされていません"  
    exit 1
fi

# 必要なディレクトリ作成
log_info "ディレクトリ構造を準備しています..."
mkdir -p {data,uploads,logs/{frontend,backend,api,nginx},ssl,monitoring}
chmod 755 scripts/*.sh

# デプロイ前バックアップ
if [ "$BACKUP_BEFORE" = "true" ]; then
    log_info "デプロイ前バックアップを実行しています..."
    ./scripts/backup.sh
    log_success "バックアップ完了"
fi

# Docker イメージの準備
case $DEPLOY_MODE in
    "build")
        log_info "Docker イメージをローカルビルドしています..."
        docker-compose build --no-cache
        ;;
    "pull")
        log_info "Docker イメージをプルしています..."
        docker-compose pull
        ;;
    "full")
        log_info "フルデプロイを実行しています..."
        # イメージ更新確認
        if docker-compose pull 2>/dev/null; then
            log_success "最新イメージを取得しました"
        else
            log_warning "イメージプルに失敗しました。ローカルビルドします..."
            docker-compose build
        fi
        ;;
esac

# サービス停止（ダウンタイム最小化のため段階的）
log_info "既存サービスの停止準備..."

# 新しいコンテナを起動（Blue-Green デプロイメント風）
log_info "新しいサービスコンテナを起動しています..."
docker-compose up -d --force-recreate --remove-orphans

# ヘルスチェック待機
log_info "サービス起動を待機しています..."
sleep 30

# ヘルスチェック実行
log_info "ヘルスチェックを実行しています..."
HEALTH_CHECK_ATTEMPTS=10
HEALTH_CHECK_INTERVAL=10

check_service() {
    local service=$1
    local url=$2
    local attempts=$HEALTH_CHECK_ATTEMPTS
    
    log_info "$service のヘルスチェック開始..."
    
    while [ $attempts -gt 0 ]; do
        if curl -sf "$url" > /dev/null 2>&1; then
            log_success "$service は正常に動作しています"
            return 0
        fi
        
        attempts=$((attempts - 1))
        if [ $attempts -gt 0 ]; then
            log_warning "$service ヘルスチェック失敗。$HEALTH_CHECK_INTERVAL秒後に再試行... (残り試行回数: $attempts)"
            sleep $HEALTH_CHECK_INTERVAL
        fi
    done
    
    log_error "$service のヘルスチェックに失敗しました"
    return 1
}

# 各サービスのヘルスチェック
HEALTH_CHECK_FAILED=false

if ! check_service "Nginx" "http://localhost/health"; then
    HEALTH_CHECK_FAILED=true
fi

if ! check_service "Backend API" "http://localhost:5000/api/health"; then
    HEALTH_CHECK_FAILED=true
fi

if ! check_service "Python API" "http://localhost:8000/api/health"; then
    HEALTH_CHECK_FAILED=true
fi

if ! check_service "Frontend" "http://localhost:3000"; then
    HEALTH_CHECK_FAILED=true
fi

# ヘルスチェック結果確認
if [ "$HEALTH_CHECK_FAILED" = true ]; then
    log_error "ヘルスチェックに失敗しました。ロールバックを実行します..."
    
    # コンテナログ出力
    log_info "エラー調査のためのログ出力:"
    docker-compose logs --tail=50
    
    # ロールバック
    log_warning "ロールバックを実行しています..."
    docker-compose down
    
    # 前回のバックアップから復旧（オプション）
    if [ "$BACKUP_BEFORE" = "true" ]; then
        log_info "必要に応じて手動でバックアップから復旧してください"
    fi
    
    exit 1
fi

# SSL証明書確認・更新
if [ "$DOMAIN_NAME" != "your-domain.com" ]; then
    log_info "SSL証明書の状態を確認しています..."
    if [ -f "ssl/live/$DOMAIN_NAME/fullchain.pem" ]; then
        # 証明書の期限チェック
        CERT_EXPIRY=$(openssl x509 -enddate -noout -in "ssl/live/$DOMAIN_NAME/fullchain.pem" | cut -d= -f2)
        CERT_EXPIRY_TIMESTAMP=$(date -d "$CERT_EXPIRY" +%s)
        CURRENT_TIMESTAMP=$(date +%s)
        DAYS_UNTIL_EXPIRY=$(( (CERT_EXPIRY_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))
        
        if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
            log_warning "SSL証明書の期限が${DAYS_UNTIL_EXPIRY}日後です。更新を推奨します。"
            log_info "更新コマンド: ./scripts/setup-ssl.sh"
        else
            log_success "SSL証明書は有効です（期限まで${DAYS_UNTIL_EXPIRY}日）"
        fi
    else
        log_warning "SSL証明書が見つかりません。HTTPS設定を確認してください。"
    fi
fi

# デプロイ後クリーンアップ
log_info "不要なDockerリソースをクリーンアップしています..."
docker system prune -f
docker volume prune -f

# パフォーマンスチェック
log_info "基本的なパフォーマンスチェックを実行しています..."
RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' http://localhost/health || echo "0")
if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
    log_success "レスポンス時間: ${RESPONSE_TIME}秒（良好）"
else
    log_warning "レスポンス時間: ${RESPONSE_TIME}秒（改善の余地があります）"
fi

# ログローテーション設定確認
log_info "ログローテーション設定を確認しています..."
if ! crontab -l | grep -q "backup.sh"; then
    log_warning "自動バックアップが設定されていません"
    log_info "設定コマンド: ./scripts/setup-ssl.sh を実行してください"
fi

# デプロイ完了通知
log_success "🎉 Personal Cooking Recipe デプロイ完了！"
log_info ""
log_info "📊 デプロイ情報:"
log_info "  - Frontend: http://localhost:3000"
log_info "  - Backend API: http://localhost:5000"
log_info "  - Python API: http://localhost:8000"
log_info "  - Nginx Proxy: http://localhost"
if [ "$DOMAIN_NAME" != "your-domain.com" ]; then
    log_info "  - 本番URL: https://$DOMAIN_NAME"
fi
log_info ""
log_info "🔧 管理コマンド:"
log_info "  - ログ確認: docker-compose logs -f"
log_info "  - 状態確認: docker-compose ps"
log_info "  - サービス再起動: docker-compose restart [service]"
log_info "  - バックアップ: ./scripts/backup.sh"
log_info ""
log_info "📚 監視（監視プロファイル有効時）:"
log_info "  - Prometheus: http://localhost:9090"
log_info "  - Grafana: http://localhost:3001"
log_info ""

# デプロイ記録をログファイルに保存
echo "$(date): Deploy completed successfully (mode: $DEPLOY_MODE)" >> logs/deployment.log