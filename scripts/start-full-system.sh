#!/bin/bash

# PersonalCookingRecipe Full System Startup Script
# フロントエンド + バックエンド + API + 監視システムの同時起動
# 実行日時: $(date)

echo "🚀 PersonalCookingRecipe Full System を起動します..."
echo "📅 実行日時: $(date)"

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 既存プロセスのクリーンアップ
echo "🧹 既存プロセスをクリーンアップ..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "nodemon" 2>/dev/null || true
pkill -f "uvicorn" 2>/dev/null || true
pm2 delete all 2>/dev/null || true
sleep 3

# IPアドレス取得
IP_ADDRESS=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
echo "📡 IPアドレス: $IP_ADDRESS"

# 環境変数チェック
echo "🔧 環境変数をチェック..."
if [ ! -f ".env" ]; then
    echo "⚠️  .envファイルが見つからないため、.env.exampleからコピーします"
    cp .env.example .env 2>/dev/null || echo "⚠️  .env.exampleが見つかりません"
fi

# Dockerコンテナの起動（PostgreSQL, Redis等）
echo "🐳 Dockerコンテナを起動..."
if command -v docker-compose &> /dev/null; then
    docker-compose up -d postgres redis 2>/dev/null || echo "⚠️  Dockerコンテナ起動に失敗（スキップ）"
    sleep 5
else
    echo "⚠️  docker-composeが見つからないためスキップ"
fi

# バックエンド起動
echo "🔧 バックエンドサーバーを起動..."
cd backend
if [ -f "package.json" ]; then
    npm install --silent 2>/dev/null || echo "⚠️  npm install失敗"
    npm run dev > ../logs/backend.log 2>&1 &
    BACKEND_PID=$!
    echo "📝 バックエンドPID: $BACKEND_PID"
else
    echo "⚠️  backend/package.jsonが見つかりません"
fi
cd ..

# APIサーバー起動（FastAPI）
echo "🔌 APIサーバー（FastAPI）を起動..."
cd api
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt --quiet 2>/dev/null || echo "⚠️  pip install失敗"
    python main.py > ../logs/api.log 2>&1 &
    API_PID=$!
    echo "📝 APIサーバーPID: $API_PID"
else
    echo "⚠️  api/requirements.txtが見つかりません"
fi
cd ..

# フロントエンド起動
echo "🌐 フロントエンドサーバーを起動..."
cd frontend
if [ -f "package.json" ]; then
    npm install --silent 2>/dev/null || echo "⚠️  npm install失敗"
    npm run dev > ../logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "📝 フロントエンドPID: $FRONTEND_PID"
else
    echo "⚠️  frontend/package.jsonが見つかりません"
fi
cd ..

# 起動待機
echo "⏳ 各サービスの起動を待機中..."
sleep 15

# サービス状態確認
echo "🔍 サービス状態を確認..."

# バックエンドチェック
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health 2>/dev/null | grep -q "200"; then
    echo "✅ バックエンド: http://localhost:5000 (正常)"
else
    echo "⚠️  バックエンド: 起動中または接続不可"
fi

# APIチェック
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs 2>/dev/null | grep -q "200"; then
    echo "✅ APIサーバー: http://localhost:8000 (正常)"
else
    echo "⚠️  APIサーバー: 起動中または接続不可"
fi

# フロントエンドチェック
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3002 2>/dev/null | grep -q "200\|404"; then
    echo "✅ フロントエンド: http://localhost:3002 (正常)"
else
    echo "⚠️  フロントエンド: 起動中または接続不可"
fi

echo ""
echo "🎉 PersonalCookingRecipe Full System 起動完了！"
echo "📱 アクセスURL:"
echo "   🌐 フロントエンド: http://localhost:3002 or http://$IP_ADDRESS:3002"
echo "   🔧 バックエンド: http://localhost:5000"
echo "   🔌 API: http://localhost:8000/docs"
echo ""
echo "📊 ログファイル:"
echo "   📝 バックエンド: logs/backend.log"
echo "   📝 API: logs/api.log"
echo "   📝 フロントエンド: logs/frontend.log"
echo ""
echo "🛑 全サービス停止: ./stop-full-system.sh"
echo "📈 システム監視: ./scripts/monitoring/export-daily-report.sh"
echo ""
echo "💡 トラブルシューティング:"
echo "   - ポート競合時は: pkill -f 'node|python' && ./start-full-system.sh"
echo "   - ログ確認: tail -f logs/*.log"
echo "   - プロセス確認: ps aux | grep -E '(node|python|next)'"

# プロセス監視（バックグラウンドで）
(
    while true; do
        # プロセス生存確認
        if ! kill -0 $BACKEND_PID 2>/dev/null; then
            echo "⚠️  バックエンドプロセスが停止しました"
        fi
        if ! kill -0 $API_PID 2>/dev/null; then
            echo "⚠️  APIプロセスが停止しました"
        fi
        if ! kill -0 $FRONTEND_PID 2>/dev/null; then
            echo "⚠️  フロントエンドプロセスが停止しました"
        fi
        sleep 30
    done
) &

echo "🔄 プロセス監視を開始しました"