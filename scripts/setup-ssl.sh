#!/bin/bash
# SSL証明書セットアップスクリプト (Let's Encrypt)
# Personal Cooking Recipe SSL Configuration

set -e

# 設定読み込み
if [ -f .env.production ]; then
    source .env.production
else
    echo "❌ .env.production ファイルが見つかりません"
    exit 1
fi

# 必要な変数チェック
if [ -z "$DOMAIN_NAME" ] || [ -z "$LETSENCRYPT_EMAIL" ]; then
    echo "❌ DOMAIN_NAME と LETSENCRYPT_EMAIL を .env.production に設定してください"
    exit 1
fi

echo "🔒 SSL証明書セットアップ開始"
echo "📧 Email: $LETSENCRYPT_EMAIL"
echo "🌐 Domain: $DOMAIN_NAME"

# 必要なディレクトリ作成
mkdir -p ssl nginx/ssl
mkdir -p /var/www/certbot

# Certbotインストール確認
if ! command -v certbot &> /dev/null; then
    echo "📦 Certbot をインストールしています..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install certbot
    elif [[ -f /etc/debian_version ]]; then
        sudo apt-get update
        sudo apt-get install -y certbot python3-certbot-nginx
    elif [[ -f /etc/redhat-release ]]; then
        sudo yum install -y epel-release
        sudo yum install -y certbot python3-certbot-nginx
    fi
fi

# Docker Composeでnginxを起動（HTTP only）
echo "🚀 Nginx（HTTP）を起動しています..."
docker-compose up -d nginx

# 証明書取得前の設定確認
echo "⏳ Nginx起動待機..."
sleep 10

# Let's Encrypt証明書取得
echo "🔑 Let's Encrypt証明書を取得しています..."
if [ "$STAGING" = "true" ]; then
    echo "🧪 ステージング環境で証明書を取得"
    STAGING_FLAG="--staging"
else
    STAGING_FLAG=""
fi

docker run --rm \
    -v "${PWD}/ssl:/etc/letsencrypt" \
    -v "/var/www/certbot:/var/www/certbot" \
    --network host \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $LETSENCRYPT_EMAIL \
    --agree-tos \
    --no-eff-email \
    $STAGING_FLAG \
    -d $DOMAIN_NAME \
    -d www.$DOMAIN_NAME

# 証明書ファイルをnginxディレクトリにコピー
echo "📋 証明書ファイルをコピーしています..."
cp ssl/live/$DOMAIN_NAME/fullchain.pem nginx/ssl/
cp ssl/live/$DOMAIN_NAME/privkey.pem nginx/ssl/

# Nginx設定を更新（HTTPS有効）
echo "🔧 Nginx設定を更新しています..."
sed -i "s/your-domain.com/$DOMAIN_NAME/g" nginx/sites-enabled/recipe.conf

# Docker Composeを再起動
echo "🔄 Docker Composeを再起動しています..."
docker-compose down
docker-compose up -d

# 証明書自動更新設定
echo "⚙️ 証明書自動更新を設定しています..."
cat > scripts/renew-ssl.sh << 'EOF'
#!/bin/bash
# SSL証明書自動更新スクリプト

echo "🔄 SSL証明書更新チェック開始: $(date)"

# 証明書更新
docker run --rm \
    -v "${PWD}/ssl:/etc/letsencrypt" \
    -v "/var/www/certbot:/var/www/certbot" \
    certbot/certbot renew --quiet

# 更新された場合、nginxを再起動
if [ $? -eq 0 ]; then
    echo "✅ 証明書更新成功"
    
    # 更新された証明書をコピー
    cp ssl/live/*/fullchain.pem nginx/ssl/
    cp ssl/live/*/privkey.pem nginx/ssl/
    
    # Nginxリロード
    docker-compose exec nginx nginx -s reload
    
    echo "🔄 Nginx設定リロード完了"
else
    echo "❌ 証明書更新失敗"
fi

echo "🏁 SSL証明書更新チェック完了: $(date)"
EOF

chmod +x scripts/renew-ssl.sh

# Cron設定追加
echo "📅 Cron自動更新設定を追加..."
(crontab -l 2>/dev/null; echo "0 3 * * 1 cd $(pwd) && ./scripts/renew-ssl.sh >> logs/ssl-renewal.log 2>&1") | crontab -

# セキュリティテスト
echo "🔍 SSL設定をテストしています..."
sleep 30

if curl -sSf https://$DOMAIN_NAME/health > /dev/null; then
    echo "✅ HTTPS接続成功！"
else
    echo "⚠️  HTTPS接続テスト失敗。設定を確認してください。"
fi

# SSL評価リンク表示
echo ""
echo "🎉 SSL証明書セットアップ完了！"
echo ""
echo "🔒 SSL評価: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN_NAME"
echo "🌐 サイト: https://$DOMAIN_NAME"
echo ""
echo "📋 次の手順："
echo "1. DNS設定でドメインをサーバーIPに向ける"
echo "2. ファイアウォールでポート80,443を開放"
echo "3. 証明書は毎週月曜3:00に自動更新されます"
echo ""