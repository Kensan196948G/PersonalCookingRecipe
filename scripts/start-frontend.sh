#!/bin/bash

# PersonalCookingRecipe Frontend 起動スクリプト
# 実行日時: $(date)

echo "🚀 PersonalCookingRecipe Frontend を起動します..."

# 移動
cd /mnt/Linux-ExHDD/PersonalCookingRecipe/frontend

# 既存のNext.jsプロセスを停止
echo "⏹️  既存のプロセスを停止..."
pkill -f "next dev" 2>/dev/null || true
sleep 2

# IPアドレスを取得
IP_ADDRESS=$(hostname -I | awk '{print $1}')
echo "📡 IPアドレス: $IP_ADDRESS"

# サーバーを起動
echo "🌐 Next.js開発サーバーを起動中..."
npx next dev -H 0.0.0.0 -p 3002 &

# 起動待機
echo "⏳ サーバーの起動を待機中..."
sleep 10

# 接続確認
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/ | grep -q "200\|404"; then
    echo "✅ サーバーが正常に起動しました！"
    echo "📱 以下のURLでアクセスできます:"
    echo "   - http://localhost:3002"
    echo "   - http://$IP_ADDRESS:3002"
else
    echo "⚠️  サーバーの起動に問題がある可能性があります"
    echo "ログを確認してください: pm2 logs frontend-app"
fi

echo ""
echo "📝 ログ表示: tail -f ~/.pm2/logs/frontend-app-*.log"
echo "🛑 停止方法: pkill -f 'next dev'"