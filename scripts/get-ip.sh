#!/bin/bash

# PersonalCookingRecipe IP自動取得スクリプト
# DHCP環境での動的IPアドレス取得

set -e

# 色付きログ出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# IP取得関数
get_system_ip() {
    local ip=""
    
    log_info "システムIPアドレス取得開始..."
    
    # Method 1: hostname -I (最優先)
    if command -v hostname >/dev/null 2>&1; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}' | tr -d '\n')
        if [[ -n "$ip" && "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            log_success "hostname -I による IP取得: $ip"
            echo "$ip"
            return 0
        fi
    fi
    
    # Method 2: ifconfig (バックアップ)
    if command -v ifconfig >/dev/null 2>&1; then
        # 有線接続 (eth0, enp*)
        ip=$(ifconfig 2>/dev/null | grep -E "inet (192\.168\.|10\.|172\.)" | head -1 | awk '{print $2}' | cut -d: -f2)
        if [[ -n "$ip" && "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            log_success "ifconfig (有線) による IP取得: $ip"
            echo "$ip"
            return 0
        fi
        
        # 無線接続 (wlan0, wlp*)
        ip=$(ifconfig wlan0 2>/dev/null | grep "inet " | awk '{print $2}' | cut -d: -f2)
        if [[ -n "$ip" && "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            log_success "ifconfig (無線) による IP取得: $ip"
            echo "$ip"
            return 0
        fi
    fi
    
    # Method 3: ip command (Modern Linux)
    if command -v ip >/dev/null 2>&1; then
        ip=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'src \K[^\s]+' | head -1)
        if [[ -n "$ip" && "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            log_success "ip route による IP取得: $ip"
            echo "$ip"
            return 0
        fi
    fi
    
    log_error "IPアドレス取得に失敗しました"
    return 1
}

# ポート使用状況チェック
check_port_usage() {
    local port=$1
    local service_name=$2
    
    if command -v netstat >/dev/null 2>&1; then
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            log_warn "ポート $port は既に使用中です ($service_name)"
            return 1
        fi
    elif command -v ss >/dev/null 2>&1; then
        if ss -tuln 2>/dev/null | grep -q ":$port "; then
            log_warn "ポート $port は既に使用中です ($service_name)"
            return 1
        fi
    fi
    
    log_success "ポート $port は利用可能です ($service_name)"
    return 0
}

# 主処理
main() {
    log_info "=== PersonalCookingRecipe IP取得システム ==="
    
    # IP取得
    local system_ip
    system_ip=$(get_system_ip)
    if [ $? -ne 0 ]; then
        log_error "システムIPの取得に失敗しました"
        exit 1
    fi
    
    # ポートチェック
    check_port_usage 3000 "Frontend"
    frontend_port_available=$?
    
    check_port_usage 5000 "Backend"
    backend_port_available=$?
    
    # 結果出力
    echo ""
    log_success "=== 取得結果 ==="
    echo "システムIP: $system_ip"
    echo "フロントエンド: http://$system_ip:3000"
    echo "バックエンド: http://$system_ip:5000"
    
    # 環境変数用出力
    echo ""
    echo "# 環境変数設定用"
    echo "export SYSTEM_IP=\"$system_ip\""
    echo "export FRONTEND_URL=\"http://$system_ip:3000\""
    echo "export BACKEND_URL=\"http://$system_ip:5000\""
    
    # JSONファイル出力
    local config_file="/tmp/recipe-system-config.json"
    cat > "$config_file" << EOF
{
  "system_ip": "$system_ip",
  "frontend_url": "http://$system_ip:3000",
  "backend_url": "http://$system_ip:5000",
  "ports": {
    "frontend": {
      "port": 3000,
      "available": $([ $frontend_port_available -eq 0 ] && echo "true" || echo "false")
    },
    "backend": {
      "port": 5000,
      "available": $([ $backend_port_available -eq 0 ] && echo "true" || echo "false")
    }
  },
  "timestamp": "$(date -Iseconds)"
}
EOF
    
    log_success "設定ファイル出力: $config_file"
    
    # .envファイル用出力
    local env_file="/tmp/recipe-system.env"
    cat > "$env_file" << EOF
# PersonalCookingRecipe システム設定
SYSTEM_IP=$system_ip
FRONTEND_URL=http://$system_ip:3000
BACKEND_URL=http://$system_ip:5000
VITE_API_URL=http://$system_ip:5000
REACT_APP_API_URL=http://$system_ip:5000
NODE_ENV=development
EOF
    
    log_success "環境変数ファイル出力: $env_file"
    
    return 0
}

# スクリプト実行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi