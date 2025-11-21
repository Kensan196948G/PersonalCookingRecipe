#!/usr/bin/env python3
"""
Claude Code エージェント選択・プロンプトカスタマイザー
@agent-recipe-cto のような表示を実現
"""

import os
import sys
import json
from pathlib import Path

# エージェント定義
AGENTS = {
    "recipe-cto": {
        "name": "CTO (Chief Technical Officer)",
        "role": "Linux環境技術戦略・設計・セキュリティ統括",
        "color": "\033[1;36m"  # シアン
    },
    "recipe-dev": {
        "name": "Developer (統合開発者)",
        "role": "Linux特化システム・API統合・自動化実装",
        "color": "\033[1;32m"  # 緑
    },
    "recipe-nlp": {
        "name": "NLP Specialist",
        "role": "Claude AI活用・レシピ構造化・多言語対応",
        "color": "\033[1;35m"  # マゼンタ
    },
    "recipe-qa": {
        "name": "QA Engineer",
        "role": "Linux環境テスト・UI/UX・システム品質管理",
        "color": "\033[1;33m"  # 黄色
    },
    "recipe-manager": {
        "name": "Project Manager",
        "role": "開発進行管理・品質管理・自動化調整",
        "color": "\033[1;31m"  # 赤
    }
}

class AgentPromptManager:
    def __init__(self):
        self.config_file = Path(".claude-agent-config.json")
        self.load_config()
    
    def load_config(self):
        """設定ファイルを読み込み"""
        if self.config_file.exists():
            with open(self.config_file, 'r', encoding='utf-8') as f:
                self.config = json.load(f)
        else:
            self.config = {"active_agent": "recipe-cto"}
            self.save_config()
    
    def save_config(self):
        """設定ファイルを保存"""
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)
    
    def list_agents(self):
        """利用可能なエージェントリストを表示"""
        print("\n🤖 利用可能なエージェント:")
        print("=" * 60)
        
        for agent_id, agent_info in AGENTS.items():
            is_active = "★ " if agent_id == self.config.get("active_agent") else "  "
            color = agent_info["color"]
            reset = "\033[0m"
            
            print(f"{is_active}{color}@agent-{agent_id}{reset}")
            print(f"   名前: {agent_info['name']}")
            print(f"   役割: {agent_info['role']}")
            print()
    
    def switch_agent(self, agent_id):
        """エージェントを切り替え"""
        if agent_id not in AGENTS:
            print(f"❌ エラー: エージェント '{agent_id}' が見つかりません")
            self.list_agents()
            return False
        
        self.config["active_agent"] = agent_id
        self.save_config()
        
        agent_info = AGENTS[agent_id]
        color = agent_info["color"]
        reset = "\033[0m"
        
        print(f"✅ エージェントを {color}@agent-{agent_id}{reset} に切り替えました")
        print(f"   役割: {agent_info['role']}")
        return True
    
    def get_current_prompt(self):
        """現在のプロンプト形式を取得"""
        active_agent = self.config.get("active_agent", "recipe-cto")
        agent_info = AGENTS.get(active_agent, AGENTS["recipe-cto"])
        
        color = agent_info["color"]
        reset = "\033[0m"
        path_color = "\033[1;37m"  # 白
        
        current_dir = os.path.basename(os.getcwd())
        return f"{color}@agent-{active_agent}{reset}:{path_color}{current_dir}{reset}$ "
    
    def show_prompt(self):
        """現在のプロンプトを表示"""
        print(self.get_current_prompt(), end="")
    
    def export_bash_config(self):
        """Bash設定用のエクスポート"""
        active_agent = self.config.get("active_agent", "recipe-cto")
        agent_info = AGENTS.get(active_agent, AGENTS["recipe-cto"])
        
        bash_config = f"""
# Claude Code エージェントプロンプト設定
export CLAUDE_ACTIVE_AGENT="{active_agent}"
export CLAUDE_AGENT_COLOR="{agent_info['color']}"
export CLAUDE_RESET_COLOR="\\033[0m"
export CLAUDE_PATH_COLOR="\\033[1;37m"

# プロンプト設定
export PS1="${{CLAUDE_AGENT_COLOR}}@agent-${{CLAUDE_ACTIVE_AGENT}}${{CLAUDE_RESET_COLOR}}:${{CLAUDE_PATH_COLOR}}\\W${{CLAUDE_RESET_COLOR}}$ "
"""
        
        with open(".claude-prompt-export.sh", "w") as f:
            f.write(bash_config.strip())
        
        print("✅ Bash設定を .claude-prompt-export.sh に出力しました")
        print("使用方法: source .claude-prompt-export.sh")

def main():
    manager = AgentPromptManager()
    
    if len(sys.argv) == 1:
        manager.list_agents()
        return
    
    command = sys.argv[1]
    
    if command == "list" or command == "ls":
        manager.list_agents()
    elif command == "switch" and len(sys.argv) > 2:
        agent_id = sys.argv[2]
        manager.switch_agent(agent_id)
    elif command == "prompt":
        manager.show_prompt()
    elif command == "export":
        manager.export_bash_config()
    elif command == "current":
        active_agent = manager.config.get("active_agent", "recipe-cto")
        agent_info = AGENTS[active_agent]
        print(f"現在のエージェント: @agent-{active_agent}")
        print(f"役割: {agent_info['role']}")
    else:
        print("使用方法:")
        print("  python agent-selector.py list           - エージェント一覧")
        print("  python agent-selector.py switch <ID>    - エージェント切り替え")
        print("  python agent-selector.py prompt         - プロンプト表示")
        print("  python agent-selector.py current        - 現在のエージェント")
        print("  python agent-selector.py export         - Bash設定エクスポート")

if __name__ == "__main__":
    main()