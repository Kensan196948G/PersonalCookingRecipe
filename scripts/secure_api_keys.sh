#!/bin/bash
# secure_api_keys.sh
# PersonalCookRecipe - 3チャンネル統合レシピ監視システム
#
# このスクリプトはAPI認証情報ファイルのセキュリティ設定を自動化します。
# ファイル権限設定、Git除外設定、macOS固有のセキュリティ確認を行います。

set -euo pipefail  # エラー時に即座に終了

# =============================================================================
# 設定・定数
# =============================================================================

SCRIPT_NAME="$(basename "$0")"
PROJECT_NAME="PersonalCookRecipe"
BASE_DIR="$HOME/Developer/tasty-recipe-monitor"
CONFIG_DIR="$BASE_DIR/config"
SCRIPTS_DIR="$BASE_DIR/scripts"
LOGS_DIR="$BASE_DIR/logs"
DATA_DIR="$BASE_DIR/data"

# ログファイル
LOG_FILE="$LOGS_DIR/security_setup.log"

# セキュリティ対象ファイル
SECURITY_FILES=(
    "$CONFIG_DIR/api_keys.env"
    "$CONFIG_DIR/gmail_credentials.json"
    "$CONFIG_DIR/gmail_token.json"
    "$CONFIG_DIR/oauth_tokens.json"
    "$CONFIG_DIR/temp_gmail_credentials.json"
)

# セキュリティ対象ディレクトリ
SECURITY_DIRS=(
    "$CONFIG_DIR"
    "$LOGS_DIR"
    "$DATA_DIR"
)

# Git除外対象パターン
GITIGNORE_PATTERNS=(
    "# === API認証情報（セキュリティ重要） ==="
    "config/api_keys.env"
    "config/gmail_credentials.json"
    "config/gmail_token.json"
    "config/oauth_tokens.json"
    "config/temp_*.json"
    ""
    "# === ログファイル ==="
    "logs/*.log"
    "logs/*.out"
    "logs/*.err"
    ""
    "# === データファイル ==="
    "data/*.json"
    "data/cache/*"
    "data/processed_videos.json"
    "data/metrics.json"
    ""
    "# === Python ==="
    "__pycache__/"
    "*.pyc"
    "*.pyo"
    "*.pyd"
    ".Python"
    "venv/"
    ".venv/"
    "env/"
    ".env"
    "pip-log.txt"
    "pip-delete-this-directory.txt"
    "dist/"
    "build/"
    "*.egg-info/"
    ""
    "# === macOS システムファイル ==="
    ".DS_Store"
    ".AppleDouble"
    ".LSOverride"
    "Icon"
    "._*"
    ".DocumentRevisions-V100"
    ".fseventsd"
    ".Spotlight-V100"
    ".TemporaryItems"
    ".Trashes"
    ".VolumeIcon.icns"
    ".com.apple.timemachine.donotpresent"
    ".AppleDB"
    ".AppleDesktop"
    "Network Trash Folder"
    "Temporary Items"
    ".apdisk"
    ""
    "# === IDE・エディタ ==="
    ".vscode/"
    ".idea/"
    "*.swp"
    "*.swo"
    "*~"
    ""
    "# === その他 ==="
    "*.tmp"
    "*.temp"
    "*.backup"
    "*.bak"
    ".coverage"
    "htmlcov/"
    "*.pid"
)

# =============================================================================
# ユーティリティ関数
# =============================================================================

# ログ出力関数
log() {
    local level="$1"
    local message="$2"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# 情報ログ
log_info() {
    log "INFO" "$1"
}

# 警告ログ
log_warn() {
    log "WARN" "$1"
}

# エラーログ
log_error() {
    log "ERROR" "$1"
}

# 成功ログ
log_success() {
    log "SUCCESS" "$1"
}

# エラーで終了
die() {
    log_error "$1"
    exit 1
}

# ディレクトリ作成（権限設定付き）
create_secure_dir() {
    local dir="$1"
    local permissions="$2"
    
    if [[ ! -d "$dir" ]]; then
        mkdir -p "$dir" || die "ディレクトリ作成失敗: $dir"
        log_info "ディレクトリ作成: $dir"
    fi
    
    chmod "$permissions" "$dir" || log_warn "権限設定失敗: $dir"
    log_info "ディレクトリ権限設定: $dir ($permissions)"
}

# ファイル権限設定
secure_file() {
    local file="$1"
    local permissions="$2"
    
    if [[ -f "$file" ]]; then
        chmod "$permissions" "$file" || log_warn "ファイル権限設定失敗: $file"
        log_info "ファイル権限設定: $file ($permissions)"
        
        # 所有者確認・修正
        if [[ "$(stat -f '%Su' "$file")" != "$(whoami)" ]]; then
            chown "$(whoami):staff" "$file" 2>/dev/null || log_warn "所有者変更失敗: $file"
        fi
    else
        log_info "ファイル未存在（権限設定スキップ）: $file"
    fi
}

# macOS固有のセキュリティ確認
check_macos_security() {
    log_info "macOS固有セキュリティ確認開始"
    
    # SIP（System Integrity Protection）状態確認
    if command -v csrutil >/dev/null 2>&1; then
        sip_status="$(csrutil status 2>/dev/null || echo 'unknown')"
        log_info "SIP状態: $sip_status"
    fi
    
    # Gatekeeper状態確認
    if command -v spctl >/dev/null 2>&1; then
        gatekeeper_status="$(spctl --status 2>/dev/null || echo 'unknown')"
        log_info "Gatekeeper状態: $gatekeeper_status"
    fi
    
    # XProtect（Apple malware scanner）確認
    if [[ -d "/System/Library/CoreServices/XProtect.bundle" ]]; then
        log_info "XProtect: 有効"
    else
        log_warn "XProtect: 状態不明"
    fi
    
    # FileVault（ディスク暗号化）状態確認
    if command -v fdesetup >/dev/null 2>&1; then
        if fdesetup isactive 2>/dev/null; then
            log_success "FileVault: 有効（ディスク暗号化済み）"
        else
            log_warn "FileVault: 無効（ディスク暗号化推奨）"
        fi
    fi
}

# Keychain統合確認
check_keychain_integration() {
    log_info "Keychain統合確認開始"
    
    local service_name="com.tasty.recipe.monitor"
    
    # Keychainアクセス可能性確認
    if command -v security >/dev/null 2>&1; then
        # テスト用エントリの作成・削除でKeychain動作確認
        local test_account="security_test_$(date +%s)"
        local test_password="test_password_123"
        
        if security add-generic-password -a "$test_account" -s "$service_name" -w "$test_password" 2>/dev/null; then
            log_success "Keychain書き込み: 正常"
            
            # 読み込みテスト
            if security find-generic-password -a "$test_account" -s "$service_name" -w 2>/dev/null >/dev/null; then
                log_success "Keychain読み込み: 正常"
            else
                log_warn "Keychain読み込み: 失敗"
            fi
            
            # テストエントリ削除
            security delete-generic-password -a "$test_account" -s "$service_name" 2>/dev/null || log_warn "テストエントリ削除失敗"
        else
            log_error "Keychain書き込み: 失敗"
        fi
    else
        log_error "security コマンドが見つかりません"
    fi
}

# =============================================================================
# メイン処理
# =============================================================================

# 初期化
init_security_setup() {
    log_info "=== $PROJECT_NAME セキュリティ設定開始 ==="
    log_info "実行ユーザー: $(whoami)"
    log_info "実行日時: $(date)"
    log_info "macOSバージョン: $(sw_vers -productVersion)"
    
    # 必要ディレクトリ作成
    create_secure_dir "$BASE_DIR" 755
    create_secure_dir "$CONFIG_DIR" 700
    create_secure_dir "$LOGS_DIR" 755
    create_secure_dir "$DATA_DIR" 755
    create_secure_dir "$(dirname "$LOG_FILE")" 755
}

# ファイル権限設定
setup_file_permissions() {
    log_info "=== ファイル権限設定開始 ==="
    
    # API認証情報ファイル（600 = 所有者のみ読み書き）
    for file in "${SECURITY_FILES[@]}"; do
        secure_file "$file" 600
    done
    
    # スクリプトファイル（755 = 所有者:全権限、グループ・その他:読み込み・実行）
    if [[ -d "$SCRIPTS_DIR" ]]; then
        find "$SCRIPTS_DIR" -name "*.sh" -type f -exec chmod 755 {} \; 2>/dev/null || true
        find "$SCRIPTS_DIR" -name "*.py" -type f -exec chmod 755 {} \; 2>/dev/null || true
        log_info "スクリプトファイル権限設定完了"
    fi
    
    # ディレクトリ権限設定
    for dir in "${SECURITY_DIRS[@]}"; do
        if [[ "$dir" == "$CONFIG_DIR" ]]; then
            secure_file "$dir" 700  # config: 所有者のみアクセス
        else
            secure_file "$dir" 755  # その他: 一般的な権限
        fi
    done
    
    log_success "ファイル権限設定完了"
}

# Git除外設定
setup_gitignore() {
    log_info "=== Git除外設定開始 ==="
    
    local gitignore_file="$BASE_DIR/.gitignore"
    
    # 既存.gitignoreのバックアップ
    if [[ -f "$gitignore_file" ]]; then
        cp "$gitignore_file" "$gitignore_file.backup.$(date +%Y%m%d_%H%M%S)" || log_warn ".gitignoreバックアップ失敗"
        log_info "既存.gitignoreをバックアップしました"
    fi
    
    # .gitignoreヘッダー追加
    {
        echo "# ============================================="
        echo "# $PROJECT_NAME - Git除外設定"
        echo "# 自動生成日時: $(date)"
        echo "# ⚠️ このファイルは機密情報保護のため重要です"
        echo "# ============================================="
        echo ""
    } > "$gitignore_file"
    
    # 除外パターン追加
    for pattern in "${GITIGNORE_PATTERNS[@]}"; do
        echo "$pattern" >> "$gitignore_file"
    done
    
    # .gitignore自体の権限設定
    chmod 644 "$gitignore_file"
    
    log_success "Git除外設定完了: $gitignore_file"
    
    # Git初期化確認
    if [[ ! -d "$BASE_DIR/.git" ]]; then
        log_warn "Gitリポジトリが初期化されていません"
        echo "推奨コマンド: cd '$BASE_DIR' && git init"
    else
        log_info "Gitリポジトリ確認済み"
    fi
}

# セキュリティ検証
verify_security_settings() {
    log_info "=== セキュリティ検証開始 ==="
    
    local security_issues=0
    
    # ファイル権限検証
    for file in "${SECURITY_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            local permissions="$(stat -f '%A' "$file" 2>/dev/null || echo '000')"
            if [[ "$permissions" != "600" ]]; then
                log_error "権限不正: $file (現在: $permissions, 期待: 600)"
                ((security_issues++))
            else
                log_info "権限正常: $file ($permissions)"
            fi
        fi
    done
    
    # ディレクトリ権限検証
    local config_perms="$(stat -f '%A' "$CONFIG_DIR" 2>/dev/null || echo '000')"
    if [[ "$config_perms" != "700" ]]; then
        log_error "ディレクトリ権限不正: $CONFIG_DIR (現在: $config_perms, 期待: 700)"
        ((security_issues++))
    fi
    
    # .gitignore検証
    local gitignore_file="$BASE_DIR/.gitignore"
    if [[ -f "$gitignore_file" ]]; then
        local missing_patterns=()
        
        # 重要パターンの存在確認
        local critical_patterns=("config/api_keys.env" "config/*.json" "logs/*.log")
        for pattern in "${critical_patterns[@]}"; do
            if ! grep -q "$pattern" "$gitignore_file"; then
                missing_patterns+=("$pattern")
            fi
        done
        
        if [[ ${#missing_patterns[@]} -gt 0 ]]; then
            log_error ".gitignoreに重要パターンが不足: ${missing_patterns[*]}"
            ((security_issues++))
        else
            log_success ".gitignore設定確認済み"
        fi
    else
        log_error ".gitignoreファイルが存在しません"
        ((security_issues++))
    fi
    
    # 総合判定
    if [[ $security_issues -eq 0 ]]; then
        log_success "=== セキュリティ検証: 全て正常 ==="
    else
        log_error "=== セキュリティ検証: $security_issues 件の問題を検出 ==="
        return 1
    fi
}

# セキュリティレポート生成
generate_security_report() {
    log_info "=== セキュリティレポート生成 ==="
    
    local report_file="$LOGS_DIR/security_report_$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "============================================="
        echo "$PROJECT_NAME - セキュリティレポート"
        echo "生成日時: $(date)"
        echo "実行ユーザー: $(whoami)"
        echo "============================================="
        echo ""
        
        echo "【ファイル権限状態】"
        for file in "${SECURITY_FILES[@]}"; do
            if [[ -f "$file" ]]; then
                local perms="$(stat -f '%A' "$file" 2>/dev/null || echo 'unknown')"
                local owner="$(stat -f '%Su:%Sg' "$file" 2>/dev/null || echo 'unknown')"
                echo "  $file: $perms ($owner)"
            else
                echo "  $file: 未存在"
            fi
        done
        echo ""
        
        echo "【ディレクトリ権限状態】"
        for dir in "${SECURITY_DIRS[@]}"; do
            if [[ -d "$dir" ]]; then
                local perms="$(stat -f '%A' "$dir" 2>/dev/null || echo 'unknown')"
                local owner="$(stat -f '%Su:%Sg' "$dir" 2>/dev/null || echo 'unknown')"
                echo "  $dir: $perms ($owner)"
            else
                echo "  $dir: 未存在"
            fi
        done
        echo ""
        
        echo "【Keychain統合状態】"
        if command -v security >/dev/null 2>&1; then
            echo "  security コマンド: 利用可能"
            echo "  Keychain デフォルト: $(security default-keychain 2>/dev/null || echo 'unknown')"
        else
            echo "  security コマンド: 利用不可"
        fi
        echo ""
        
        echo "【Git除外設定】"
        local gitignore_file="$BASE_DIR/.gitignore"
        if [[ -f "$gitignore_file" ]]; then
            echo "  .gitignore: 存在"
            echo "  サイズ: $(wc -l < "$gitignore_file") 行"
        else
            echo "  .gitignore: 未存在"
        fi
        echo ""
        
        echo "【macOSセキュリティ状態】"
        echo "  macOSバージョン: $(sw_vers -productVersion)"
        if command -v csrutil >/dev/null 2>&1; then
            echo "  SIP: $(csrutil status 2>/dev/null || echo 'unknown')"
        fi
        if fdesetup isactive 2>/dev/null; then
            echo "  FileVault: 有効"
        else
            echo "  FileVault: 無効"
        fi
        
    } > "$report_file"
    
    log_success "セキュリティレポート生成: $report_file"
}

# クリーンアップ
cleanup_temp_files() {
    log_info "=== 一時ファイルクリーンアップ ==="
    
    # 一時認証情報ファイル削除
    local temp_files=(
        "$CONFIG_DIR/temp_gmail_credentials.json"
        "$CONFIG_DIR/*.tmp"
        "$CONFIG_DIR/*.temp"
        "$CONFIG_DIR/*.backup"
    )
    
    for pattern in "${temp_files[@]}"; do
        # shellcheck disable=SC2086
        rm -f $pattern 2>/dev/null || true
    done
    
    log_info "一時ファイルクリーンアップ完了"
}

# メイン実行関数
main() {
    # 引数解析
    local force_mode=false
    local verify_only=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force|-f)
                force_mode=true
                shift
                ;;
            --verify|-v)
                verify_only=true
                shift
                ;;
            --help|-h)
                echo "使用方法: $SCRIPT_NAME [オプション]"
                echo "オプション:"
                echo "  --force, -f    強制実行（確認スキップ）"
                echo "  --verify, -v   検証のみ実行"
                echo "  --help, -h     このヘルプを表示"
                exit 0
                ;;
            *)
                echo "❌ 無効なオプション: $1"
                echo "ヘルプ: $SCRIPT_NAME --help"
                exit 1
                ;;
        esac
    done
    
    # 検証のみモード
    if [[ "$verify_only" == true ]]; then
        init_security_setup
        verify_security_settings
        exit $?
    fi
    
    # 実行確認
    if [[ "$force_mode" != true ]]; then
        echo "🔐 $PROJECT_NAME セキュリティ設定を実行します。"
        echo ""
        echo "実行内容:"
        echo "• ファイル・ディレクトリ権限設定"
        echo "• Git除外設定"
        echo "• macOSセキュリティ確認"
        echo "• Keychain統合確認"
        echo ""
        read -p "実行しますか？ (y/n): " -n 1 -r
        echo
        
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "セキュリティ設定をキャンセルしました。"
            exit 0
        fi
    fi
    
    # メイン処理実行
    init_security_setup
    setup_file_permissions
    setup_gitignore
    check_macos_security
    check_keychain_integration
    cleanup_temp_files
    
    # 検証
    if verify_security_settings; then
        generate_security_report
        log_success "=== セキュリティ設定完了 ==="
        echo ""
        echo "🎉 セキュリティ設定が正常に完了しました！"
        echo "📋 詳細ログ: $LOG_FILE"
    else
        log_error "=== セキュリティ設定で問題が発生しました ==="
        echo ""
        echo "❌ セキュリティ設定で問題が発生しました。"
        echo "📋 詳細ログを確認してください: $LOG_FILE"
        exit 1
    fi
}

# スクリプト実行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi