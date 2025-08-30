#!/bin/bash

# Claude Code エージェントプロンプトカスタマイザー
# 使用方法: source ./scripts/claude-agent-prompt.sh

# 設定ファイルの読み込み
CONFIG_FILE=".claude-prompt-config"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# デフォルト値
CLAUDE_ACTIVE_AGENT=${CLAUDE_ACTIVE_AGENT:-"recipe-cto"}
CLAUDE_AGENT_COLOR=${CLAUDE_AGENT_COLOR:-"\033[1;36m"}
CLAUDE_PATH_COLOR=${CLAUDE_PATH_COLOR:-"\033[1;33m"}
CLAUDE_RESET_COLOR=${CLAUDE_RESET_COLOR:-"\033[0m"}

# エージェント切り替え機能
switch_agent() {
    local agent="$1"
    if [ -z "$agent" ]; then
        echo "使用可能エージェント: $CLAUDE_AGENTS"
        echo "現在のエージェント: $CLAUDE_ACTIVE_AGENT"
        return
    fi
    
    # エージェントを設定ファイルに保存
    sed -i "s/CLAUDE_ACTIVE_AGENT=\".*\"/CLAUDE_ACTIVE_AGENT=\"$agent\"/" "$CONFIG_FILE"
    CLAUDE_ACTIVE_AGENT="$agent"
    echo "エージェントを $agent に切り替えました"
    
    # プロンプトを更新
    update_prompt
}

# プロンプト更新機能
update_prompt() {
    local current_dir=$(basename "$PWD")
    export PS1="${CLAUDE_AGENT_COLOR}@agent-${CLAUDE_ACTIVE_AGENT}${CLAUDE_RESET_COLOR}:${CLAUDE_PATH_COLOR}${current_dir}${CLAUDE_RESET_COLOR}$ "
}

# プロンプト表示機能
show_agent_prompt() {
    local current_dir=$(basename "$PWD")
    echo -e "${CLAUDE_AGENT_COLOR}@agent-${CLAUDE_ACTIVE_AGENT}${CLAUDE_RESET_COLOR}:${CLAUDE_PATH_COLOR}${current_dir}${CLAUDE_RESET_COLOR}$ "
}

# エイリアス設定
alias agent="switch_agent"
alias prompt="show_agent_prompt"

# 初期プロンプト設定
update_prompt

# 使用方法を表示
echo "Claude Code エージェントプロンプト設定完了"
echo "使用方法:"
echo "  agent <エージェント名>  - エージェント切り替え"
echo "  agent                  - 現在のエージェント表示"
echo "  prompt                 - プロンプト形式表示"
echo ""
echo "現在のエージェント: $CLAUDE_ACTIVE_AGENT"