#!/bin/bash

# PersonalCookingRecipe Frontend 修復スクリプト

echo "🔧 PersonalCookingRecipe Frontend 修復開始..."

# 現在のディレクトリを保存
CURRENT_DIR=$(pwd)
FRONTEND_DIR="/mnt/Linux-ExHDD/PersonalCookingRecipe/frontend"

cd "$FRONTEND_DIR"

echo "📦 クリーンアップ中..."
# node_modulesとキャッシュをクリア
rm -rf node_modules
rm -rf .next
rm -f package-lock.json
rm -rf .npm

echo "📥 依存関係の再インストール..."
# npm キャッシュクリア
npm cache clean --force

# 依存関係を再インストール
npm install --legacy-peer-deps

# html-webpack-pluginが明示的に必要な場合は追加
if ! npm list html-webpack-plugin > /dev/null 2>&1; then
    echo "📦 html-webpack-plugin をインストール中..."
    npm install --save-dev html-webpack-plugin --legacy-peer-deps
fi

echo "🔍 インストール確認..."
npm list html-webpack-plugin

echo "✅ 修復完了"

# Next.js開発サーバーの起動テスト
echo "🚀 開発サーバーの起動テスト..."
npm run dev &
SERVER_PID=$!

# 5秒待って確認
sleep 5

if ps -p $SERVER_PID > /dev/null; then
    echo "✅ サーバー起動成功"
    echo "📍 http://192.168.3.135:3000 でアクセス可能"
    kill $SERVER_PID
else
    echo "❌ サーバー起動失敗"
    echo "ログを確認してください: $FRONTEND_DIR/install.log"
fi

# 元のディレクトリに戻る
cd "$CURRENT_DIR"

echo "🎉 PersonalCookingRecipe Frontend の修復が完了しました"