# Claude Code エージェントプロンプト設定
export CLAUDE_ACTIVE_AGENT="recipe-nlp"
export CLAUDE_AGENT_COLOR="[1;35m"
export CLAUDE_RESET_COLOR="\033[0m"
export CLAUDE_PATH_COLOR="\033[1;37m"

# プロンプト設定
export PS1="${CLAUDE_AGENT_COLOR}@agent-${CLAUDE_ACTIVE_AGENT}${CLAUDE_RESET_COLOR}:${CLAUDE_PATH_COLOR}\W${CLAUDE_RESET_COLOR}$ "