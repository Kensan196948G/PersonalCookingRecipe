#!/bin/bash

# Claude Code Configuration Auto-Repair Script
# エラー自動検知・修復システム

set -euo pipefail

PROJECT_ROOT="/mnt/Linux-ExHDD/PersonalCookingRecipe"
CLAUDE_DIR="$PROJECT_ROOT/.claude"
LOG_FILE="$CLAUDE_DIR/logs/auto-repair.log"

# Create logs directory
mkdir -p "$CLAUDE_DIR/logs"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_and_repair_settings() {
    local settings_file="$CLAUDE_DIR/settings.json"
    
    log "🔍 設定ファイルチェック中..."
    
    if [[ ! -f "$settings_file" ]]; then
        log "❌ settings.jsonが見つかりません"
        return 1
    fi
    
    # JSON syntax check
    if ! jq '.' "$settings_file" >/dev/null 2>&1; then
        log "❌ settings.json: JSON構文エラー"
        return 1
    fi
    
    # Check permissions format
    if jq -r '.permissions.allow[]' "$settings_file" 2>/dev/null | grep -q 'Bash([^)]*\*[^)]*:'; then
        log "❌ permissions: 不正なワイルドカード形式を検出"
        return 1
    fi
    
    log "✅ settings.json: OK"
    return 0
}

check_and_repair_agents() {
    local agents_dir="$CLAUDE_DIR/agents"
    local error_count=0
    
    log "🔍 エージェントファイルチェック中..."
    
    # Check for missing frontmatter
    while IFS= read -r -d '' file; do
        if [[ -f "$file" && "$file" == *.md ]]; then
            if ! head -1 "$file" | grep -q "^---$"; then
                log "❌ $file: フロントマター不足"
                ((error_count++))
            fi
        fi
    done < <(find "$agents_dir" -type f -name "*.md" -print0 2>/dev/null)
    
    # Check for ._ duplicate files
    local duplicate_count
    duplicate_count=$(find "$agents_dir" -name "._*" -type f 2>/dev/null | wc -l)
    if [[ "$duplicate_count" -gt 0 ]]; then
        log "❌ $duplicate_count 個の重複ファイル(._ prefixed)を検出"
        error_count=$((error_count + duplicate_count))
    fi
    
    if [[ "$error_count" -eq 0 ]]; then
        log "✅ エージェントファイル: OK"
        return 0
    else
        log "❌ エージェントファイル: $error_count 個のエラー"
        return 1
    fi
}

check_claude_flow() {
    log "🔍 Claude Flow availability check..."
    
    if command -v npx >/dev/null 2>&1; then
        if npx claude-flow@alpha --help >/dev/null 2>&1; then
            log "✅ Claude Flow: 利用可能"
            return 0
        else
            log "⚠️  Claude Flow: インストールされていません"
            return 1
        fi
    else
        log "❌ npx: 見つかりません"
        return 1
    fi
}

auto_repair_loop() {
    local max_iterations=3
    local iteration=0
    local all_checks_passed=false
    
    log "🔧 自動修復ループ開始..."
    
    while [[ "$iteration" -lt "$max_iterations" && "$all_checks_passed" == false ]]; do
        iteration=$((iteration + 1))
        log "🔄 反復 $iteration/$max_iterations"
        
        local settings_ok=true
        local agents_ok=true
        local claude_flow_ok=true
        
        # Settings check
        if ! check_and_repair_settings; then
            settings_ok=false
            log "🔧 settings.json 修復をスキップ（手動修正が必要）"
        fi
        
        # Agents check
        if ! check_and_repair_agents; then
            agents_ok=false
            # Auto-repair duplicate files
            local duplicates
            duplicates=$(find "$CLAUDE_DIR/agents" -name "._*" -type f 2>/dev/null)
            if [[ -n "$duplicates" ]]; then
                log "🔧 重複ファイル削除中..."
                find "$CLAUDE_DIR/agents" -name "._*" -type f -delete 2>/dev/null || true
                find "$CLAUDE_DIR/agents" -name "._*" -type d -exec rm -rf {} + 2>/dev/null || true
            fi
        fi
        
        # Claude Flow check
        if ! check_claude_flow; then
            claude_flow_ok=false
        fi
        
        # Check if all passed
        if [[ "$settings_ok" == true && "$agents_ok" == true ]]; then
            all_checks_passed=true
            log "✅ 全ての検証がパスしました"
        else
            log "⚠️  一部の検証が失敗、次の反復へ..."
        fi
        
        sleep 1
    done
    
    if [[ "$all_checks_passed" == true ]]; then
        log "🎉 自動修復完了: 全てのエラーが解決されました"
        return 0
    else
        log "⚠️  自動修復完了: 一部のエラーが未解決です"
        return 1
    fi
}

# Main execution
main() {
    log "🚀 Claude Code 設定自動修復開始"
    
    if auto_repair_loop; then
        log "✅ 自動修復成功"
        exit 0
    else
        log "⚠️  手動修正が必要な項目があります"
        exit 1
    fi
}

# Run main function
main "$@"