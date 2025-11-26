#!/bin/bash

# Claude Code エージェントプロンプト セットアップスクリプト

echo "🤖 Claude Code エージェントプロンプト セットアップ"
echo "================================================="

# 1. エージェント選択
echo ""
echo "利用可能なエージェント:"
python scripts/agent-selector.py list

echo ""
read -p "使用するエージェントID（例: recipe-cto）: " agent_id

if [ -n "$agent_id" ]; then
    python scripts/agent-selector.py switch "$agent_id"
fi

# 2. Bash設定をエクスポート
python scripts/agent-selector.py export

echo ""
echo "✅ セットアップ完了!"
echo ""
echo "📋 使用方法:"
echo "1. プロンプトを適用: source .claude-prompt-export.sh"
echo "2. エージェント切り替え: python scripts/agent-selector.py switch <エージェントID>"
echo "3. 現在のプロンプト表示: python scripts/agent-selector.py prompt"
echo ""
echo "🔄 自動適用（推奨）:"
echo "echo 'source ~/.claude-prompt-export.sh' >> ~/.bashrc"
echo "cp .claude-prompt-export.sh ~/.claude-prompt-export.sh"
echo ""

# 3. オプション：自動適用の提案
read -p "Bashプロファイルに自動適用しますか？ (y/n): " auto_setup

if [ "$auto_setup" = "y" ] || [ "$auto_setup" = "Y" ]; then
    # ホームディレクトリにコピー
    cp .claude-prompt-export.sh ~/.claude-prompt-export.sh
    
    # .bashrcに追加（重複チェック）
    if ! grep -q "source ~/.claude-prompt-export.sh" ~/.bashrc; then
        echo "source ~/.claude-prompt-export.sh" >> ~/.bashrc
        echo "✅ ~/.bashrcに自動読み込みを追加しました"
    else
        echo "ℹ️  既に ~/.bashrc に設定済みです"
    fi
    
    echo "🔄 新しいターミナルセッションで自動的に適用されます"
fi

echo ""
echo "🎯 テスト実行:"
echo "source .claude-prompt-export.sh && python scripts/agent-selector.py prompt"