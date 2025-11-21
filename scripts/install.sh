#!/bin/bash
# PersonalCookRecipe - 自動インストールスクリプト (macOS専用)
# 3チャンネル統合レシピ監視システムの環境構築を自動化

set -euo pipefail  # エラー時即座に終了、未定義変数使用禁止

# 🎯 環境変数設定
PROJECT_NAME="PersonalCookRecipe"
PROJECT_DIR="$HOME/Developer/tasty-recipe-monitor"
PYTHON_VERSION="3.11"
USER_NAME=$(whoami)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# 🎨 色付きログ関数
log_info() { echo "ℹ️  $1"; }
log_success() { echo "✅ $1"; }
log_warning() { echo "⚠️  $1"; }
log_error() { echo "❌ $1"; }
log_step() { echo "🚀 $1"; }

# 📋 事前チェック機能
check_prerequisites() {
    log_step "事前チェック実行中..."
    
    # macOS確認
    if [[ "$(uname)" != "Darwin" ]]; then
        log_error "このスクリプトはmacOS専用です"
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

# 📦 Homebrewパッケージインストール
install_homebrew_packages() {
    log_step "必要なHomebrewパッケージをインストール中..."
    
    local packages=("python@$PYTHON_VERSION" "git" "wget")
    
    # Homebrewアップデート
    log_info "Homebrewアップデート中..."
    brew update || log_warning "Homebrewアップデートに失敗しました（継続）"
    
    # 各パッケージインストール
    for package in "${packages[@]}"; do
        log_info "$package インストール確認中..."
        if brew list "$package" &>/dev/null; then
            log_info "$package は既にインストール済み"
        else
            log_info "$package をインストール中..."
            if brew install "$package"; then
                log_success "$package インストール完了"
            else
                log_error "$package インストール失敗"
                exit 1
            fi
        fi
    done
    
    # Pythonリンク確認
    if ! command -v python3 &>/dev/null; then
        log_info "Python3リンク作成中..."
        brew link --overwrite python@"$PYTHON_VERSION" || log_warning "Pythonリンク作成に問題がありました"
    fi
    
    log_success "Homebrewパッケージインストール完了"
}

# 📁 ディレクトリ構造作成
create_directories() {
    log_step "プロジェクトディレクトリ構造作成中..."
    
    local directories=(
        "$PROJECT_DIR"
        "$PROJECT_DIR/config"
        "$PROJECT_DIR/services"
        "$PROJECT_DIR/scripts"
        "$PROJECT_DIR/data"
        "$PROJECT_DIR/data/cache"
        "$PROJECT_DIR/logs"
        "$PROJECT_DIR/logs/agents"
        "$PROJECT_DIR/logs/pids"
        "$PROJECT_DIR/logs/services"
        "$PROJECT_DIR/tests"
        "$PROJECT_DIR/docs"
        "$PROJECT_DIR/launchd"
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
        "docs/Claude.md"
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
# PersonalCookRecipe - 環境変数テンプレート
# 実際の値を設定してから .env にリネームしてください
# 重要: 認証情報はmacOS Keychainに保存することを推奨

# ============================================
# YouTube Data API v3 設定
# ============================================
YOUTUBE_API_KEY=your_youtube_api_key_here

# ============================================
# Claude API (Anthropic) 設定
# ============================================
CLAUDE_API_KEY=your_claude_api_key_here

# ============================================
# Notion API 設定
# ============================================
NOTION_TOKEN=your_notion_integration_token_here
NOTION_DATABASE_ID=your_notion_database_id_here

# ============================================
# Gmail API 設定
# ============================================
GMAIL_CLIENT_ID=your_gmail_client_id_here
GMAIL_CLIENT_SECRET=your_gmail_client_secret_here
NOTIFICATION_EMAIL=your_notification_email@example.com

# ============================================
# 一般設定
# ============================================
DEBUG=false
LOG_LEVEL=INFO
ENVIRONMENT=production
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
    
    # プロジェクト全体の所有者設定
    chown -R "$USER_NAME:staff" "$PROJECT_DIR" 2>/dev/null || true
    
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
    local required_dirs=("config" "services" "data" "logs" "scripts")
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
    if pip list | grep -q "anthropic\|google-api-python-client\|notion-client"; then
        log_success "必要パッケージ: OK"
    else
        log_warning "一部パッケージが見つかりません（継続可能）"
    fi
    
    log_success "インストール確認完了"
}

# 🎯 メイン実行フロー
main() {
    echo "=============================================="
    echo "🍖 $PROJECT_NAME インストール開始 (macOS)"
    echo "3チャンネル統合レシピ監視システム"
    echo "=============================================="
    echo
    
    # インストール手順実行
    check_prerequisites
    install_homebrew_packages  
    create_directories
    setup_python_environment
    deploy_config_files
    set_permissions
    initialize_data_files
    verify_installation
    
    echo
    echo "=============================================="
    echo "🎉 インストール完了！"
    echo "=============================================="
    echo
    echo "📍 プロジェクトディレクトリ: $PROJECT_DIR"
    echo "🐍 Python仮想環境: $PROJECT_DIR/venv"
    echo
    echo "🚀 次のステップ:"
    echo "   1. API認証情報の設定 (Keychain推奨)"
    echo "   2. LaunchDaemon設定: ./scripts/setup_launchd.sh"
    echo "   3. 動作確認: ./scripts/health_check.sh"
    echo
    echo "📖 詳細は docs/ ディレクトリの仕様書を参照してください"
    echo
}

# スクリプトが直接実行された場合のみmain実行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi