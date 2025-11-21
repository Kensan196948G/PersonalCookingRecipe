#!/bin/bash
# PersonalCookRecipe - Linux環境自動インストールスクリプト
# ClaudeCode Agents自動開発システム用（10名体制）

set -euo pipefail  # エラー時即座に終了、未定義変数使用禁止

# 🎯 環境変数設定
PROJECT_NAME="PersonalCookingRecipe"
PROJECT_DIR="$HOME/PersonalCookingRecipe"
PYTHON_VERSION="3.10"
USER_NAME=$(whoami)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# 🎨 色付きログ関数
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}ℹ️  [INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}✅ [SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠️  [WARNING]${NC} $1"; }
log_error() { echo -e "${RED}❌ [ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}🚀 [STEP]${NC} $1"; }

# 📋 事前チェック機能
check_prerequisites() {
    log_step "Linux環境事前チェック実行中..."
    
    # Linux確認
    if [[ "$(uname)" != "Linux" ]]; then
        log_error "このスクリプトはLinux専用です"
        exit 1
    fi
    
    # ディストリビューション検出
    if [ -f /etc/os-release ]; then
        source /etc/os-release
        log_info "検出されたディストリビューション: $PRETTY_NAME"
        
        case "$ID" in
            ubuntu|debian)
                PACKAGE_MANAGER="apt"
                ;;
            rhel|centos|fedora)
                PACKAGE_MANAGER="yum"
                if command -v dnf &> /dev/null; then
                    PACKAGE_MANAGER="dnf"
                fi
                ;;
            *)
                log_warning "未テストのディストリビューション: $ID"
                PACKAGE_MANAGER="apt"  # デフォルト
                ;;
        esac
    else
        log_error "ディストリビューション情報を取得できませんでした"
        exit 1
    fi
    
    # システム要件確認スクリプト実行
    if [[ -f "$BASE_DIR/check_system_requirements.py" ]]; then
        log_info "システム要件確認スクリプト実行中..."
        if ! python3 "$BASE_DIR/check_system_requirements.py"; then
            log_error "システム要件を満たしていません。先に問題を解決してください。"
            exit 1
        fi
    else
        log_warning "システム要件確認スクリプトが見つかりません"
    fi
    
    log_success "事前チェック完了"
}

# 📦 システムパッケージインストール
install_system_packages() {
    log_step "必要なシステムパッケージをインストール中..."
    
    # パッケージリスト（共通）
    local packages=(
        "python3"
        "python3-pip" 
        "python3-venv"
        "python3-dev"
        "git"
        "curl"
        "wget"
        "build-essential"
        "libssl-dev"
        "libffi-dev"
        "pkg-config"
    )
    
    # ディストリビューション別パッケージマネージャー
    case "$PACKAGE_MANAGER" in
        apt)
            log_info "APTパッケージアップデート中..."
            sudo apt update
            
            # Python 3.10+ 確認・インストール
            python_version=$(python3 --version 2>&1 | cut -d' ' -f2)
            if [[ "${python_version:0:4}" < "3.10" ]]; then
                log_info "Python 3.10+ をインストール中..."
                sudo apt install -y software-properties-common
                sudo add-apt-repository -y ppa:deadsnakes/ppa
                sudo apt update
                packages+=("python3.10" "python3.10-venv" "python3.10-dev")
            fi
            
            # パッケージインストール
            sudo apt install -y "${packages[@]}"
            ;;
            
        yum|dnf)
            log_info "$PACKAGE_MANAGER パッケージアップデート中..."
            sudo $PACKAGE_MANAGER update -y
            
            # RHEL/CentOS/Fedora用パッケージ
            packages=(
                "python3"
                "python3-pip"
                "python3-venv"
                "python3-devel"
                "git"
                "curl"
                "wget"
                "gcc"
                "gcc-c++"
                "make"
                "openssl-devel"
                "libffi-devel"
                "pkgconfig"
            )
            
            sudo $PACKAGE_MANAGER install -y "${packages[@]}"
            ;;
    esac
    
    log_success "システムパッケージインストール完了"
}

# 📁 ディレクトリ構造作成
create_directories() {
    log_step "プロジェクトディレクトリ構造作成中..."
    
    local directories=(
        "$PROJECT_DIR"
        "$PROJECT_DIR/config"
        "$PROJECT_DIR/services"
        "$PROJECT_DIR/scripts"
        "$PROJECT_DIR/api"
        "$PROJECT_DIR/api/models"
        "$PROJECT_DIR/api/services"
        "$PROJECT_DIR/src/frontend"
        "$PROJECT_DIR/webui"
        "$PROJECT_DIR/data"
        "$PROJECT_DIR/data/cache"
        "$PROJECT_DIR/logs"
        "$PROJECT_DIR/logs/agents"
        "$PROJECT_DIR/logs/services"
        "$PROJECT_DIR/tests"
        "$PROJECT_DIR/docs"
        "$PROJECT_DIR/systemd"
        "$PROJECT_DIR/.github/workflows"
    )
    
    for dir in "${directories[@]}"; do
        if mkdir -p "$dir"; then
            log_info "ディレクトリ作成: $dir"
        else
            log_error "ディレクトリ作成失敗: $dir"
            exit 1
        fi
    done
    
    log_success "ディレクトリ構造作成完了"
}

# 🐍 Python仮想環境構築
setup_python_environment() {
    log_step "Python仮想環境構築中..."
    
    cd "$PROJECT_DIR" || { log_error "プロジェクトディレクトリに移動できません"; exit 1; }
    
    # 既存の仮想環境削除（再構築）
    if [[ -d "venv" ]]; then
        log_info "既存の仮想環境を削除中..."
        rm -rf venv
    fi
    
    # Python3で仮想環境作成
    log_info "仮想環境作成中..."
    if python3 -m venv venv; then
        log_success "仮想環境作成完了"
    else
        log_error "仮想環境作成失敗"
        exit 1
    fi
    
    # 仮想環境アクティベート
    log_info "仮想環境アクティベート中..."
    source venv/bin/activate
    
    # pipアップグレード
    log_info "pipアップグレード中..."
    pip install --upgrade pip setuptools wheel
    
    # requirements.txtからパッケージインストール
    if [[ -f "$BASE_DIR/requirements.txt" ]]; then
        log_info "Pythonパッケージインストール中..."
        if pip install -r "$BASE_DIR/requirements.txt"; then
            log_success "Pythonパッケージインストール完了"
        else
            log_error "Pythonパッケージインストール失敗"
            exit 1
        fi
    else
        log_warning "requirements.txtが見つかりません"
    fi
    
    log_success "Python仮想環境構築完了"
}

# ⚙️ 設定ファイル配置
deploy_config_files() {
    log_step "設定ファイル配置中..."
    
    # 基本ファイルをプロジェクトディレクトリにコピー
    local files_to_copy=(
        "check_system_requirements.py"
        "requirements.txt"
        "docs/agents.yaml"
        "CLAUDE.md"
        "api/main.py"
        "config/credentials_manager.py"
    )
    
    for file in "${files_to_copy[@]}"; do
        if [[ -f "$BASE_DIR/$file" ]]; then
            local target_dir="$PROJECT_DIR/$(dirname "$file")"
            mkdir -p "$target_dir"
            cp "$BASE_DIR/$file" "$target_dir/"
            log_info "コピー完了: $file"
        else
            log_warning "ファイルが見つかりません: $file"
        fi
    done
    
    # .env.exampleファイル作成
    cat > "$PROJECT_DIR/.env.example" << 'EOF'
# PersonalCookRecipe - Linux環境変数テンプレート
# 実際の値を設定してから環境変数として設定してください
# 重要: 認証情報は環境変数 + 暗号化ファイルに保存

# ============================================
# YouTube Data API v3 設定
# ============================================
PERSONAL_COOKING_RECIPE_YOUTUBE_API_KEY=your_youtube_api_key_here

# ============================================
# Claude API (Anthropic) 設定
# ============================================
PERSONAL_COOKING_RECIPE_CLAUDE_API_KEY=your_claude_api_key_here

# ============================================
# Notion API 設定
# ============================================
PERSONAL_COOKING_RECIPE_NOTION_TOKEN=your_notion_integration_token_here
PERSONAL_COOKING_RECIPE_NOTION_DATABASE_ID=your_notion_database_id_here

# ============================================
# Gmail API 設定
# ============================================
PERSONAL_COOKING_RECIPE_GMAIL_CLIENT_ID=your_gmail_client_id_here
PERSONAL_COOKING_RECIPE_GMAIL_CLIENT_SECRET=your_gmail_client_secret_here
NOTIFICATION_EMAIL=your_notification_email@example.com

# ============================================
# 一般設定
# ============================================
DEBUG=false
LOG_LEVEL=INFO
ENVIRONMENT=production
EOF
    
    # systemd用ユニットファイル作成
    cat > "$PROJECT_DIR/systemd/personal-cooking-recipe.service" << EOF
[Unit]
Description=PersonalCookingRecipe - 3チャンネル統合レシピ監視システム
After=network.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$PROJECT_DIR
Environment=PATH=$PROJECT_DIR/venv/bin
ExecStart=$PROJECT_DIR/venv/bin/python -m api.main
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    log_success "設定ファイル配置完了"
}

# 🔐 権限設定
set_permissions() {
    log_step "ファイル・ディレクトリ権限設定中..."
    
    # スクリプトディレクトリの実行権限
    find "$PROJECT_DIR/scripts" -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true
    
    # データディレクトリの書き込み権限
    chmod -R 755 "$PROJECT_DIR/data" 2>/dev/null || true
    chmod -R 755 "$PROJECT_DIR/logs" 2>/dev/null || true
    
    # 設定ファイルの保護
    chmod 600 "$PROJECT_DIR/.env.example" 2>/dev/null || true
    
    # 認証設定ディレクトリの保護
    chmod 700 "$HOME/.config/personal-cooking-recipe" 2>/dev/null || true
    
    # プロジェクト全体の所有者設定
    chown -R "$USER_NAME:$USER_NAME" "$PROJECT_DIR" 2>/dev/null || true
    
    log_success "権限設定完了"
}

# 📊 初期データファイル作成
initialize_data_files() {
    log_step "初期データファイル作成中..."
    
    # 処理済み動画JSON
    echo '{"processed_videos": [], "last_update": null}' > "$PROJECT_DIR/data/processed_videos.json"
    
    # 失敗動画ログJSON
    echo '{"failed_videos": [], "retry_count": {}}' > "$PROJECT_DIR/data/failed_videos.json"
    
    # メトリクスJSON  
    echo '{"total_processed": 0, "success_rate": 0.0, "last_metrics_update": null}' > "$PROJECT_DIR/data/metrics.json"
    
    # 初期ログファイル
    touch "$PROJECT_DIR/logs/application.log"
    touch "$PROJECT_DIR/logs/error.log"
    touch "$PROJECT_DIR/logs/debug.log"
    
    log_success "初期データファイル作成完了"
}

# systemd サービス設定
setup_systemd_service() {
    log_step "systemdサービス設定中..."
    
    local service_file="$PROJECT_DIR/systemd/personal-cooking-recipe.service"
    local target_service="/etc/systemd/system/personal-cooking-recipe.service"
    
    if [[ -f "$service_file" ]]; then
        log_info "systemdユニットファイルをシステムにコピー中..."
        sudo cp "$service_file" "$target_service"
        
        log_info "systemdリロード中..."
        sudo systemctl daemon-reload
        
        log_info "サービスを有効化中..."
        sudo systemctl enable personal-cooking-recipe.service
        
        log_success "systemdサービス設定完了"
        log_info "サービス開始: sudo systemctl start personal-cooking-recipe"
        log_info "サービス状態確認: sudo systemctl status personal-cooking-recipe"
    else
        log_warning "systemdユニットファイルが見つかりません"
    fi
}

# ✅ インストール完了確認
verify_installation() {
    log_step "インストール完了確認中..."
    
    # 仮想環境の確認
    if [[ -f "$PROJECT_DIR/venv/bin/python" ]]; then
        log_success "Python仮想環境: OK"
    else
        log_error "Python仮想環境: NG"
        return 1
    fi
    
    # 必要なディレクトリ確認
    local required_dirs=("config" "services" "data" "logs" "scripts" "api")
    for dir in "${required_dirs[@]}"; do
        if [[ -d "$PROJECT_DIR/$dir" ]]; then
            log_success "ディレクトリ $dir: OK"
        else
            log_error "ディレクトリ $dir: NG"
            return 1
        fi
    done
    
    # Pythonパッケージ確認
    cd "$PROJECT_DIR" && source venv/bin/activate
    if pip list | grep -q "anthropic\|google-api-python-client\|notion-client\|fastapi"; then
        log_success "必要パッケージ: OK"
    else
        log_warning "一部パッケージが見つかりません（継続可能）"
    fi
    
    # systemdサービス確認
    if systemctl list-unit-files | grep -q "personal-cooking-recipe.service"; then
        log_success "systemdサービス: OK"
    else
        log_warning "systemdサービスが登録されていません"
    fi
    
    log_success "インストール確認完了"
}

# 🎯 メイン実行フロー
main() {
    echo "=============================================="
    echo "🍖 $PROJECT_NAME インストール開始 (Linux)"
    echo "3チャンネル統合レシピ監視システム（10名体制）"
    echo "=============================================="
    echo
    
    # インストール手順実行
    check_prerequisites
    install_system_packages
    create_directories
    setup_python_environment
    deploy_config_files
    set_permissions
    initialize_data_files
    setup_systemd_service
    verify_installation
    
    echo
    echo "=============================================="
    echo "🎉 インストール完了！"
    echo "=============================================="
    echo
    echo "📍 プロジェクトディレクトリ: $PROJECT_DIR"
    echo "🐍 Python仮想環境: $PROJECT_DIR/venv"
    echo "🔧 systemdサービス: personal-cooking-recipe"
    echo
    echo "🚀 次のステップ:"
    echo "   1. API認証情報の設定:"
    echo "      $PROJECT_DIR/scripts/setup_credentials.py"
    echo "   2. systemdサービス開始:"
    echo "      sudo systemctl start personal-cooking-recipe"
    echo "   3. 動作確認:"
    echo "      sudo systemctl status personal-cooking-recipe"
    echo
    echo "📖 詳細は docs/ ディレクトリの仕様書を参照してください"
    echo
}

# スクリプトが直接実行された場合のみmain実行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi