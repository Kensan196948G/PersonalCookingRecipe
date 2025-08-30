#!/bin/bash

# Claude Code Enhanced 起動スクリプト - SPARC開発環境 (Batchtools最適化対応)
# 全SubAgent機能・Claude-flow・Context7・日本語対応・自動並列開発有効化

set -euo pipefail  # エラーハンドリング強化

# ログファイル設定
LOG_FILE="$HOME/.claude/launch-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOG_FILE")"

# ログ関数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "$LOG_FILE" >&2
}

# 成功時の表示関数
show_success() {
    echo "✅ $1"
    log "SUCCESS: $1"
}

# エラーハンドリング
error_handler() {
    log_error "スクリプト実行中にエラーが発生しました (行: $1)"
    echo "❌ 起動に失敗しました。ログファイルを確認してください: $LOG_FILE"
    exit 1
}

trap 'error_handler ${LINENO}' ERR

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ヘッダー表示
echo -e "${PURPLE}"
echo "██████╗ ██╗      █████╗ ██╗   ██╗██████╗ ███████╗     ██████╗ ██████╗ ██████╗ ███████╗"
echo "██╔══██╗██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝    ██╔════╝██╔═══██╗██╔══██╗██╔════╝"
echo "██║  ██║██║     ███████║██║   ██║██║  ██║█████╗      ██║     ██║   ██║██║  ██║█████╗  "
echo "██║  ██║██║     ██╔══██║██║   ██║██║  ██║██╔══╝      ██║     ██║   ██║██║  ██║██╔══╝  "
echo "██████╔╝███████╗██║  ██║╚██████╔╝██████╔╝███████╗    ╚██████╗╚██████╔╝██████╔╝███████╗"
echo "╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝     ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝"
echo ""
echo "Enhanced SPARC Development Environment with Batchtools Optimization"
echo "全SubAgent機能・Claude-flow・Context7・日本語対応・自動並列開発対応"
echo -e "${NC}"

log "Claude Code Enhanced 起動スクリプトを開始"

# 必要なコマンドの確認
check_dependencies() {
    log "依存関係を確認中..."
    local missing_deps=()
    
    for cmd in node npm npx; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "以下のコマンドが見つかりません: ${missing_deps[*]}"
        echo "Node.jsをインストールしてください: https://nodejs.org/"
        exit 1
    fi
    
    show_success "依存関係確認完了"
}

# Claude Code設定ディレクトリの準備
setup_claude_config() {
    log "Claude Code設定ディレクトリを準備中..."
    
    local config_dir="$HOME/.claude"
    mkdir -p "$config_dir/commands" "$config_dir/hooks" "$config_dir/templates"
    
    # 日本語対応の環境変数設定
    cat > "$config_dir/env.sh" << 'ENV_EOF'
export LANG=ja_JP.UTF-8
export LC_ALL=ja_JP.UTF-8
export CLAUDE_LANG=japanese
export CLAUDE_PARALLEL_MODE=enabled
export CLAUDE_FLOW_ENABLED=true
export CONTEXT7_ENABLED=true
export SPARC_ENHANCED=true
export BATCHTOOLS_OPTIMIZATION=true
export SWARM_AUTO_SPAWN=true
ENV_EOF
    
    show_success "Claude Code設定準備完了"
}

# Claude-flowのインストールと設定
install_claude_flow() {
    log "Claude-flowをインストール中..."
    
    # バージョン確認とインストール
    if ! npx claude-flow@alpha version &> /dev/null; then
        log "Claude-flowを新規インストール中..."
        if npm install -g claude-flow@alpha 2>&1 | tee -a "$LOG_FILE"; then
            show_success "Claude-flow新規インストール完了"
        else
            log "グローバルインストールに失敗、ローカルで試行中..."
            if npm install claude-flow@alpha 2>&1 | tee -a "$LOG_FILE"; then
                show_success "Claude-flowローカルインストール完了"
            else
                log_error "Claude-flowインストールに失敗しました"
                return 1
            fi
        fi
    else
        log "Claude-flowは既にインストールされています"
        local current_version=$(npx claude-flow@alpha version 2>/dev/null || echo "不明")
        log "現在のバージョン: $current_version"
        show_success "Claude-flow準備完了"
    fi
}

# MCP設定の自動化
configure_mcp() {
    log "MCP設定を修復/統一中..."
    
    # プロジェクト直下 .mcp.json を無効化
    if [ -f "$PWD/.mcp.json" ]; then
        mv -v "$PWD/.mcp.json" "$PWD/.mcp.json.disabled.$(date +%Y%m%d%H%M%S)" | tee -a "$LOG_FILE"
        log ".mcp.json を無効化しました"
    fi
    
    # Claude-flow MCP サーバーの設定
    if command -v claude &> /dev/null; then
        log "Claude Code MCPサーバーを設定中..."
        
        # 全スコープから誤登録を除去
        for scope in project local user; do
            claude mcp remove "ruv-swarm" -s "$scope" >/dev/null 2>&1 || true
            claude mcp remove "context7" -s "$scope" >/dev/null 2>&1 || true
            claude mcp remove "claude-flow" -s "$scope" >/dev/null 2>&1 || true
        done
        log "既存の誤った設定をクリーンアップしました"
        
        # 正しい定義を user スコープにのみ登録
        log "claude-flow MCPサーバーを user スコープに追加中..."
        if claude mcp add-json "claude-flow" -s user \
            '{ "command": "npx", "args": ["claude-flow@alpha", "mcp", "start"] }' 2>&1 | tee -a "$LOG_FILE"; then
            log "claude-flow MCPサーバー追加成功"
        else
            log "claude-flow MCPサーバー追加をスキップ（既に存在するか、エラーが発生）"
        fi
        
        log "context7 MCPサーバーを user スコープに追加中..."
        if claude mcp add-json "context7" -s user \
            '{ "command": "npx", "args": ["-y", "@upstash/context7-mcp@1.0.14"] }' 2>&1 | tee -a "$LOG_FILE"; then
            log "context7 MCPサーバー追加成功"
        else
            log "context7 MCPサーバー追加をスキップ（既に存在するか、エラーが発生）"
        fi
        
        show_success "MCP修復完了（userスコープへ統一）"
    else
        log "Claude Codeが見つからないため、MCPは後で手動設定してください"
        log "手動設定コマンド:"
        log "  claude mcp add-json \"claude-flow\" -s user '{ \"command\": \"npx\", \"args\": [\"claude-flow@alpha\", \"mcp\", \"start\"] }'"
        log "  claude mcp add-json \"context7\" -s user '{ \"command\": \"npx\", \"args\": [\"-y\", \"@upstash/context7-mcp@1.0.14\"] }'"
        show_success "MCP設定情報準備完了（手動設定が必要）"
    fi
}

# 全SubAgent機能の有効化設定
enable_all_subagents() {
    log "全SubAgent機能を有効化中..."
    
    local config_file="$HOME/.claude/settings.json"
    
    # settings.jsonの作成/更新
    cat > "$config_file" << 'SETTINGS_EOF'
{
  "subAgents": {
    "enabled": true,
    "types": [
      "general-purpose", "statusline-setup", "api-docs", "coder", "reviewer",
      "researcher", "planner", "tester", "collective-intelligence-coordinator",
      "swarm-memory-manager", "consensus-builder", "system-architect",
      "security-manager", "performance-benchmarker", "raft-manager",
      "byzantine-coordinator", "crdt-synchronizer", "quorum-manager",
      "gossip-coordinator", "base-template-generator", "workflow-automation",
      "pr-manager", "swarm-pr", "sync-coordinator", "project-board-sync",
      "release-swarm", "multi-repo-swarm", "issue-tracker", "release-manager",
      "code-review-swarm", "repo-architect", "github-modes", "swarm-issue",
      "cicd-engineer", "tdd-london-swarm", "refinement", "pseudocode",
      "specification", "architecture", "production-validator", "ml-developer",
      "mobile-dev", "memory-coordinator", "migration-planner", "sparc-coord",
      "perf-analyzer", "swarm-init", "smart-agent", "adaptive-coordinator",
      "task-orchestrator", "sparc-coder", "hierarchical-coordinator",
      "mesh-coordinator", "code-analyzer", "backend-dev"
    ],
    "autoSpawn": true,
    "maxAgents": 12,
    "defaultTopology": "hierarchical"
  },
  "sparc": {
    "enabled": true,
    "phases": ["specification", "pseudocode", "architecture", "refinement", "completion"],
    "autoOptimize": true,
    "parallelExecution": true,
    "batchtools": true
  },
  "parallel": {
    "enabled": true,
    "maxConcurrent": 8,
    "autoBalance": true,
    "priorityQueue": true
  },
  "memory": {
    "persistent": true,
    "crossSession": true,
    "autoSync": true,
    "maxSize": "100MB"
  },
  "hooks": {
    "preTask": true,
    "postEdit": true,
    "sessionEnd": true,
    "autoFormat": true,
    "neuralTrain": true
  },
  "github": {
    "integration": true,
    "autoSync": true,
    "prManagement": true,
    "issueTracking": true
  },
  "ui": {
    "theme": "dark",
    "language": "japanese",
    "shortcuts": true,
    "visualFeedback": true
  },
  "performance": {
    "caching": true,
    "lazyLoading": true,
    "tokenOptimization": true,
    "compressionEnabled": true
  },
  "experimental": {
    "swarmMode": true,
    "neuralNetworks": true,
    "wasmAcceleration": true,
    "quantumInspired": false
  }
}
SETTINGS_EOF
    
    show_success "全SubAgent機能有効化完了"
}

# SPARC拡張フック設定
setup_sparc_hooks() {
    log "SPARC拡張フックを設定中..."
    
    local hooks_dir="$HOME/.claude/hooks"
    
    # Pre-taskフック
    cat > "$hooks_dir/pre-task.sh" << 'HOOK_EOF'
#!/bin/bash
# 事前タスクフック - 自動エージェント割り当てと並列準備
npx claude-flow@alpha hooks pre-task --description "$1" --auto-spawn-agents true
npx claude-flow@alpha hooks session-restore --session-id "sparc-$(date +%Y%m%d)" --load-memory true
HOOK_EOF
    
    # Post-editフック
    cat > "$hooks_dir/post-edit.sh" << 'HOOK_EOF'
#!/bin/bash
# 編集後フック - 自動フォーマットとニューラル学習
npx claude-flow@alpha hooks post-edit --file "$1" --auto-format true --train-neural true
npx claude-flow@alpha hooks notify --message "File edited: $1" --telemetry true
HOOK_EOF
    
    # Session-endフック
    cat > "$hooks_dir/session-end.sh" << 'HOOK_EOF'
#!/bin/bash
# セッション終了フック - パフォーマンス分析と要約生成
npx claude-flow@alpha hooks session-end --export-metrics true --generate-summary true
npx claude-flow@alpha hooks post-task --analyze-performance true
HOOK_EOF
    
    chmod +x "$hooks_dir"/*.sh
    show_success "SPARC拡張フック設定完了"
}

# プロジェクトテンプレート生成
create_project_templates() {
    log "プロジェクトテンプレートを生成中..."
    
    local templates_dir="$HOME/.claude/templates"
    
    # SPARC拡張テンプレート
    cat > "$templates_dir/sparc-enhanced.md" << 'TEMPLATE_EOF'
# SPARC Enhanced Development Template

## 🚀 自動並列開発モード有効

### Phase 1: Specification (仕様策定)
- [ ] 要件分析 (並列実行)
- [ ] 制約条件確認
- [ ] パフォーマンス目標設定

### Phase 2: Pseudocode (擬似コード)
- [ ] アルゴリズム設計
- [ ] データ構造定義
- [ ] インターフェース設計

### Phase 3: Architecture (アーキテクチャ)
- [ ] システム設計
- [ ] コンポーネント分割
- [ ] 統合ポイント定義

### Phase 4: Refinement (洗練)
- [ ] TDD実装
- [ ] コード最適化
- [ ] レビューと改善

### Phase 5: Completion (完成)
- [ ] 統合テスト
- [ ] ドキュメント生成
- [ ] デプロイ準備

## 並列実行コマンド

    # スワーム初期化
    npx claude-flow@alpha swarm init --topology hierarchical --agents 8

    # SPARC実行
    npx claude-flow@alpha sparc pipeline "<タスク>"

    # バッチ実行
    npx claude-flow@alpha sparc batch spec-pseudocode "<タスク>"
TEMPLATE_EOF
    
    show_success "プロジェクトテンプレート生成完了"
}

# Claude Codeのインストール確認と提案
check_claude_installation() {
    log "Claude Codeのインストール状態を確認中..."
    
    if ! command -v claude &> /dev/null; then
        echo -e "${YELLOW}⚠️  Claude Codeがインストールされていません${NC}"
        echo -e "${CYAN}インストール方法:${NC}"
        echo -e "  ${GREEN}npm install -g @anthropic-ai/claude${NC}"
        echo ""
        echo -e "${CYAN}または公式サイトからダウンロード:${NC}"
        echo -e "  ${GREEN}https://claude.ai/code${NC}"
        echo ""
        
        read -p "今すぐClaude Codeをインストールしますか？ (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log "Claude Codeをインストール中..."
            if npm install -g @anthropic-ai/claude 2>&1 | tee -a "$LOG_FILE"; then
                show_success "Claude Codeインストール完了"
            else
                log_error "Claude Codeのインストールに失敗しました"
                echo "手動でインストールしてください"
                return 1
            fi
        else
            log "Claude Codeのインストールをスキップしました"
            return 1
        fi
    else
        local claude_version=$(claude --version 2>/dev/null || echo "不明")
        log "Claude Code検出: バージョン $claude_version"
        show_success "Claude Code確認完了"
    fi
}

# スワーム初期化情報の表示
show_swarm_info() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}🐝 スワーム並列開発機能${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${GREEN}利用可能なエージェント (54種類):${NC}"
    echo -e "  ${BLUE}開発系:${NC} coder, reviewer, tester, planner, researcher"
    echo -e "  ${BLUE}協調系:${NC} hierarchical-coordinator, mesh-coordinator, adaptive-coordinator"
    echo -e "  ${BLUE}GitHub:${NC} pr-manager, issue-tracker, release-manager, code-review-swarm"
    echo -e "  ${BLUE}SPARC:${NC} specification, pseudocode, architecture, refinement, sparc-coder"
    echo ""
    echo -e "${GREEN}推奨コマンド:${NC}"
    echo -e "  ${YELLOW}# 階層型スワーム初期化 (推奨)${NC}"
    echo -e "  npx claude-flow@alpha swarm init --topology hierarchical --agents 8"
    echo -e "  ${YELLOW}# メッシュ型スワーム (小規模プロジェクト)${NC}"
    echo -e "  npx claude-flow@alpha swarm init --topology mesh --agents 4"
    echo -e "  ${YELLOW}# SPARC完全パイプライン${NC}"
    echo -e "  npx claude-flow@alpha sparc pipeline \"<タスク>\""
    echo -e "  ${YELLOW}# 自動並列実行${NC}"
    echo -e "  npx claude-flow@alpha sparc batch spec-pseudocode \"<タスク>\""
    echo -e "  ${YELLOW}# スワーム初期化${NC}"
    echo -e "  npx claude-flow@alpha swarm init --topology hierarchical --agents 8"
    echo ""
}

# Claude Code起動
launch_claude_code() {
    # 起動履歴を記録
    echo "---" >> "$HOME/.claude/launch-history.log"
    echo "起動時刻: $(date)" >> "$HOME/.claude/launch-history.log"
    echo "作業ディレクトリ: $PWD" >> "$HOME/.claude/launch-history.log"
    echo "設定完了時刻: $(date)" >> "$HOME/.claude/launch-history.log"
    echo "ログファイル: $LOG_FILE" >> "$HOME/.claude/launch-history.log"
    echo "---" >> "$HOME/.claude/launch-history.log"
    
    # Claude Code起動（バックグラウンドでログ記録）
    {
        echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Claude Code launch started" >> "$LOG_FILE"
        echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Command: claude --dangerously-skip-permissions" >> "$LOG_FILE"
    } &
    
    # Claude Code実行
    exec claude --dangerously-skip-permissions
}

# メイン実行部分
main() {
    echo -e "${GREEN}🚀 Claude Code Enhanced 起動プロセスを開始します...${NC}"
    echo ""
    
    # 各段階を実行
    check_dependencies
    setup_claude_config
    install_claude_flow
    configure_mcp
    enable_all_subagents
    setup_sparc_hooks
    create_project_templates
    
    # Claude Codeの確認
    if check_claude_installation; then
        echo ""
        show_swarm_info
        
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${PURPLE}📊 Personal Cooking Recipe Manager${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}プロジェクトパス:${NC} $PWD"
        echo ""
        echo -e "${GREEN}クイックコマンド:${NC}"
        echo -e "  ${YELLOW}サーバー起動:${NC} npm start"
        echo -e "  ${YELLOW}開発モード:${NC} npm run dev"
        echo -e "  ${YELLOW}テスト実行:${NC} npm test"
        echo ""
        echo -e "${CYAN}📄 ログファイル: ${YELLOW}$LOG_FILE${NC}"
        echo -e "${CYAN}⚙️  設定ファイル: ${YELLOW}$HOME/.claude/settings.json${NC}"
        echo ""
        echo -e "${PURPLE}🎉 Enhanced parallel development ready!${NC}"
        echo ""
        
        # 起動オプションの確認
        if [ "${1:-}" = "--no-launch" ]; then
            echo -e "${YELLOW}セットアップ完了（--no-launchフラグにより起動をスキップ）${NC}"
        else
            echo -e "${GREEN}🚀 Claude Codeを起動中...${NC}"
            launch_claude_code
        fi
    else
        echo -e "${YELLOW}Claude Codeがインストールされていないため、設定のみ完了しました${NC}"
        echo -e "${CYAN}Claude Codeをインストール後、再度このスクリプトを実行してください${NC}"
    fi
}

# スクリプト実行
main "$@"

# 実行権限の設定
chmod +x "$0"