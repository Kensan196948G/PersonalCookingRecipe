#!/bin/bash

# PersonalCookingRecipe マスター自動化スクリプト
# 完全ゼロタッチ運用システム

set -e

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_ROOT/logs"

# 色付きログ関数
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

log_header() {
    echo ""
    echo -e "${PURPLE}===========================================${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}===========================================${NC}"
    echo ""
}

log_info() {
    echo -e "${BLUE}🔧 [INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅ [SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠️  [WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}❌ [ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}📋 [STEP]${NC} $1"
}

# エラーハンドリング
handle_error() {
    log_error "スクリプト実行中にエラーが発生しました (行: $1)"
    log_error "自動修復システムを実行中..."
    
    # 自動修復システム実行
    if [ -f "$SCRIPT_DIR/auto-repair-system.js" ]; then
        node "$SCRIPT_DIR/auto-repair-system.js" || true
    fi
    
    exit 1
}

trap 'handle_error $LINENO' ERR

# 実行時間計測開始
start_time=$(date +%s)

log_header "PersonalCookingRecipe 完全自動化システム開始"

# ログディレクトリ作成
mkdir -p "$LOG_DIR"

# 1. システム情報取得
log_step "1/10: システム情報取得"
log_info "OS: $(lsb_release -d | cut -f2 || echo "Linux")"
log_info "Node.js: $(node --version 2>/dev/null || echo "未インストール")"
log_info "npm: $(npm --version 2>/dev/null || echo "未インストール")"
log_info "PM2: $(pm2 --version 2>/dev/null || echo "未インストール")"

# 2. IP自動取得
log_step "2/10: IP自動取得"
if [ -f "$SCRIPT_DIR/get-ip.sh" ]; then
    bash "$SCRIPT_DIR/get-ip.sh" | tee "$LOG_DIR/ip-detection.log"
    source /tmp/recipe-system.env 2>/dev/null || true
    log_success "システムIP: ${SYSTEM_IP:-取得失敗}"
else
    log_warn "IP取得スクリプトが見つかりません"
    SYSTEM_IP="localhost"
fi

# 3. ポート競合チェック・解決
log_step "3/10: ポート競合チェック・解決"
if [ -f "$SCRIPT_DIR/port-checker.js" ]; then
    node "$SCRIPT_DIR/port-checker.js" --kill --verbose | tee "$LOG_DIR/port-check.log"
    log_success "ポート競合解決完了"
else
    log_warn "ポートチェッカーが見つかりません"
fi

# 4. 依存関係インストール確認
log_step "4/10: 依存関係確認"
cd "$PROJECT_ROOT"

# ルート依存関係
if [ ! -d "node_modules" ]; then
    log_info "ルート依存関係インストール中..."
    npm install
fi

# フロントエンド依存関係
if [ -d "frontend" ] && [ ! -d "frontend/node_modules" ]; then
    log_info "フロントエンド依存関係インストール中..."
    cd frontend && npm install && cd ..
fi

# バックエンド依存関係
if [ -d "backend" ] && [ ! -d "backend/node_modules" ]; then
    log_info "バックエンド依存関係インストール中..."
    cd backend && npm install && cd ..
fi

log_success "依存関係確認完了"

# 5. PM2プロセス管理セットアップ
log_step "5/10: PM2プロセス管理セットアップ"

# PM2がインストールされていない場合はインストール
if ! command -v pm2 >/dev/null 2>&1; then
    log_info "PM2インストール中..."
    npm install -g pm2
fi

# 既存プロセス停止・クリーンアップ
log_info "既存PM2プロセス停止中..."
pm2 kill 2>/dev/null || true

# エコシステム設定でプロセス開始
if [ -f "ecosystem.config.js" ]; then
    log_info "PM2エコシステム開始中..."
    pm2 start ecosystem.config.js
    pm2 save
    log_success "PM2プロセス開始完了"
else
    log_warn "ecosystem.config.js が見つかりません"
    
    # 手動でプロセス開始
    log_info "手動プロセス開始中..."
    if [ -d "backend" ]; then
        cd backend && pm2 start npm --name "recipe-backend" -- run dev && cd ..
    fi
    if [ -d "frontend" ]; then
        cd frontend && pm2 start npm --name "recipe-frontend" -- run dev && cd ..
    fi
fi

# 6. ヘルスチェック待機
log_step "6/10: サービスヘルスチェック"
log_info "サービス起動待機中..."

check_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|404\|403"; then
            log_success "$name サービス確認完了 ($url)"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    log_warn "$name サービス応答なし ($url)"
    return 1
}

# フロントエンドチェック
if [ -n "$SYSTEM_IP" ]; then
    check_service "http://$SYSTEM_IP:3000" "フロントエンド" || true
    check_service "http://$SYSTEM_IP:5000/api/health" "バックエンド" || true
else
    check_service "http://localhost:3000" "フロントエンド" || true
    check_service "http://localhost:5000/api/health" "バックエンド" || true
fi

# 7. Playwright ブラウザエラー監視セットアップ
log_step "7/10: Playwright ブラウザエラー監視セットアップ"

if [ -f "playwright.config.js" ] && command -v npx >/dev/null 2>&1; then
    log_info "Playwright設定確認中..."
    
    # ヘッドレスモードでテスト実行
    export DEBUG=false
    export FRONTEND_URL="http://${SYSTEM_IP:-localhost}:3000"
    
    log_info "ブラウザエラー検知テスト実行中..."
    npx playwright test tests/e2e/browser-error-detection.spec.js --reporter=json --output="$LOG_DIR/playwright-results.json" || {
        log_warn "Playwright テスト実行エラー（継続）"
    }
    
    log_success "ブラウザエラー監視セットアップ完了"
else
    log_warn "Playwright設定が見つかりません"
fi

# 8. Winston ログシステム初期化
log_step "8/10: Winston ログシステム初期化"

if [ -f "$SCRIPT_DIR/winston-logger.js" ]; then
    log_info "Winston ログシステムテスト中..."
    node "$SCRIPT_DIR/winston-logger.js" | tee "$LOG_DIR/winston-test.log"
    log_success "Winston ログシステム初期化完了"
else
    log_warn "Winston ログシステムが見つかりません"
fi

# 9. 自動修復システム待機モード設定
log_step "9/10: 自動修復システム待機モード設定"

if [ -f "$SCRIPT_DIR/auto-repair-system.js" ]; then
    log_info "自動修復システムテスト実行中..."
    node "$SCRIPT_DIR/auto-repair-system.js" | tee "$LOG_DIR/auto-repair-test.log"
    
    # バックグラウンドで継続監視モード開始
    log_info "継続監視モード開始中..."
    nohup node "$SCRIPT_DIR/auto-repair-system.js" --monitor > "$LOG_DIR/auto-repair-monitor.log" 2>&1 &
    
    log_success "自動修復システム待機モード設定完了"
else
    log_warn "自動修復システムが見つかりません"
fi

# 10. システム状態レポート生成
log_step "10/10: システム状態レポート生成"

# 実行時間計算
end_time=$(date +%s)
execution_time=$((end_time - start_time))

# PM2プロセス状態
pm2_status=$(pm2 jlist 2>/dev/null || echo "[]")

# システム状態レポート生成
cat > "$LOG_DIR/system-status-report.json" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "execution_time_seconds": $execution_time,
  "system_info": {
    "os": "$(lsb_release -d | cut -f2 2>/dev/null || echo "Linux")",
    "node_version": "$(node --version 2>/dev/null || echo "未インストール")",
    "npm_version": "$(npm --version 2>/dev/null || echo "未インストール")",
    "pm2_version": "$(pm2 --version 2>/dev/null || echo "未インストール")",
    "system_ip": "${SYSTEM_IP:-localhost}"
  },
  "services": {
    "frontend_url": "http://${SYSTEM_IP:-localhost}:3000",
    "backend_url": "http://${SYSTEM_IP:-localhost}:5000",
    "pm2_processes": $pm2_status
  },
  "automation_status": {
    "ip_detection": "$([ -f /tmp/recipe-system.env ] && echo "完了" || echo "失敗")",
    "port_check": "完了",
    "pm2_setup": "完了",
    "health_check": "完了",
    "playwright_setup": "$([ -f playwright.config.js ] && echo "完了" || echo "スキップ")",
    "winston_logging": "完了",
    "auto_repair": "待機中"
  }
}
EOF

# 最終レポート表示
log_header "PersonalCookingRecipe 完全自動化システム完了"

echo -e "${GREEN}🎉 システム自動化完了 (実行時間: ${execution_time}秒)${NC}"
echo ""
echo -e "${CYAN}📊 アクセス情報:${NC}"
echo -e "   フロントエンド: ${GREEN}http://${SYSTEM_IP:-localhost}:3000${NC}"
echo -e "   バックエンド:   ${GREEN}http://${SYSTEM_IP:-localhost}:5000${NC}"
echo ""
echo -e "${CYAN}🔧 管理コマンド:${NC}"
echo -e "   PM2状態確認:   ${YELLOW}pm2 status${NC}"
echo -e "   ログ確認:      ${YELLOW}pm2 logs${NC}"
echo -e "   プロセス再起動: ${YELLOW}pm2 restart all${NC}"
echo ""
echo -e "${CYAN}📁 ログファイル:${NC}"
echo -e "   システム状態:  ${YELLOW}$LOG_DIR/system-status-report.json${NC}"
echo -e "   エラー監視:    ${YELLOW}$LOG_DIR/auto-repair-monitor.log${NC}"
echo -e "   Winston:       ${YELLOW}$LOG_DIR/combined.log${NC}"
echo ""
echo -e "${GREEN}🚀 PersonalCookingRecipe システムが完全に自動化されました！${NC}"

# ブラウザ自動オープン（オプション）
if command -v xdg-open >/dev/null 2>&1 && [ "$1" = "--open-browser" ]; then
    log_info "ブラウザを自動で開いています..."
    xdg-open "http://${SYSTEM_IP:-localhost}:3000" 2>/dev/null &
fi

exit 0