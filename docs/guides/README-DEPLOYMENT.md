# Personal Cooking Recipe - デプロイメントガイド

## 📋 概要

Personal Cooking Recipeアプリケーションの本番環境デプロイメント設定とCI/CDパイプラインの完全ガイドです。

## 🏗️ アーキテクチャ

```
[Nginx Reverse Proxy] → [Frontend (Next.js):3000]
         ↓
    [Backend API (Node.js):5000]
         ↓  
    [Python API (FastAPI):8000]
         ↓
    [SQLite Database + Uploads]
```

## 🚀 クイックスタート

### 1. 前提条件

- Docker & Docker Compose
- 本番サーバー（Ubuntu 20.04+ 推奨）
- ドメイン名（SSL用）
- メール設定（通知用、オプション）

### 2. 環境設定

```bash
# リポジトリクローン
git clone <repository-url>
cd PersonalCookingRecipe

# 本番環境変数設定
cp .env.production.example .env.production
nano .env.production  # 設定値を更新

# デプロイスクリプト実行権限
chmod +x scripts/*.sh
```

### 3. 設定項目（.env.production）

```bash
# 必須設定項目
DOMAIN_NAME=your-domain.com
LETSENCRYPT_EMAIL=your-email@domain.com
JWT_SECRET=your-super-secret-jwt-key
GRAFANA_PASSWORD=your-secure-grafana-password

# オプション設定
BACKUP_S3_BUCKET=your-backup-bucket
AWS_ACCESS_KEY_ID=your-aws-access-key
SMTP_HOST=smtp.gmail.com
NOTIFICATION_EMAIL=admin@your-domain.com
```

### 4. ワンクリックデプロイ

```bash
# フルデプロイ（推奨）
./scripts/deploy.sh full

# または段階的デプロイ
./scripts/deploy.sh build  # ローカルビルド
./scripts/deploy.sh pull   # イメージプル
```

## 📦 Docker構成

### サービス構成

- **nginx**: リバースプロキシ・SSL終端
- **frontend**: Next.js Webアプリケーション
- **backend**: Node.js Express API
- **api**: Python FastAPI サービス
- **fluentd**: ログ集約（オプション）
- **prometheus**: メトリクス収集（オプション）
- **grafana**: 監視ダッシュボード（オプション）

### Dockerfile特徴

- **Multi-stage builds**: 本番イメージサイズ最適化
- **Non-root user**: セキュリティ強化
- **Health checks**: 自動回復機能
- **Alpine Linux**: 軽量ベースイメージ

## 🔐 SSL/HTTPS設定

### Let's Encrypt自動設定

```bash
# SSL証明書自動取得・設定
./scripts/setup-ssl.sh
```

### 証明書自動更新

```bash
# Cron設定（毎週月曜3:00）
0 3 * * 1 cd /opt/recipe-app && ./scripts/renew-ssl.sh
```

## 📊 監視・ログ

### 監視スタック（オプション）

```bash
# 監視サービス有効化
docker-compose --profile monitoring up -d

# アクセス
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3001
```

### ログ管理

- **構造化ログ**: JSON形式
- **ログローテーション**: 日次・サイズ制限
- **集約**: Fluentd → ファイル
- **アラート**: Prometheus AlertManager

## 💾 バックアップ戦略

### 自動バックアップ

```bash
# 即座にバックアップ実行
./scripts/backup.sh

# Cron設定（毎日AM2:00）
0 2 * * * cd /opt/recipe-app && ./scripts/backup.sh
```

### バックアップ内容

- SQLiteデータベース（recipes.db）
- アップロードファイル（uploads/）
- 設定ファイル（nginx, ssl, env）
- 直近1週間のログ

### S3統合（オプション）

```bash
# AWS S3自動アップロード
BACKUP_S3_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

## 🔄 CI/CD パイプライン

### GitHub Actions設定

```yaml
# .github/workflows/deploy.yml
# - Pull Request時: テスト実行
# - main branch: ステージング自動デプロイ  
# - production branch: 本番手動デプロイ
# - Tag push: リリースデプロイ
```

### 必要なSecrets

```bash
# GitHub Repository Secrets
STAGING_SSH_KEY=<private-key>
STAGING_HOST=staging.your-domain.com  
STAGING_USER=deploy

PRODUCTION_SSH_KEY=<private-key>
PRODUCTION_HOST=your-domain.com
PRODUCTION_USER=deploy

SLACK_WEBHOOK=<webhook-url>  # 通知用
```

### デプロイフロー

1. **テスト**: 全サービスのユニット・統合テスト
2. **セキュリティスキャン**: Trivy脆弱性スキャン
3. **ビルド**: Docker multi-arch イメージ作成
4. **ステージング**: 自動デプロイ・スモークテスト
5. **本番**: 手動承認後 Blue-Green デプロイ
6. **検証**: ポストデプロイテスト・通知

## 🛡️ セキュリティ対策

### 実装済みセキュリティ機能

- **SSL/TLS**: Let's Encrypt自動証明書
- **Security Headers**: CSP, HSTS, X-Frame-Options
- **Rate Limiting**: API・一般アクセス制限
- **Non-root containers**: 全サービス非特権実行
- **Secret management**: 環境変数・Docker secrets
- **Vulnerability scanning**: CI/CDパイプライン組み込み

### 推奨セキュリティ設定

```bash
# ファイアウォール設定
ufw allow ssh
ufw allow http
ufw allow https
ufw enable

# 自動セキュリティアップデート
apt install unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

## 🚨 トラブルシューティング

### よくある問題

#### 1. ヘルスチェック失敗

```bash
# サービス状態確認
docker-compose ps
docker-compose logs [service-name]

# 個別サービステスト
curl http://localhost:3000  # Frontend
curl http://localhost:5000/api/health  # Backend
curl http://localhost:8000/api/health  # API
```

#### 2. データベース接続エラー

```bash
# データベースファイル確認
ls -la data/recipes.db*

# 権限修正
sudo chown -R 1001:1001 data/
```

#### 3. SSL証明書問題

```bash
# 証明書確認
openssl x509 -text -noout -in ssl/live/your-domain.com/fullchain.pem

# 手動更新
./scripts/setup-ssl.sh
```

#### 4. メモリ不足

```bash
# リソース使用状況
docker stats
free -h

# スワップ作成（4GB）
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
```

### ログ分析

```bash
# エラーログ検索
grep -r "ERROR" logs/
grep -r "FATAL" logs/

# アクセスログ分析
tail -f logs/nginx/access.log

# システムメトリクス
docker-compose exec prometheus curl localhost:9090/api/v1/query?query=up
```

## 📈 パフォーマンス最適化

### 推奨設定

```bash
# システム最適化
echo 'vm.swappiness=10' >> /etc/sysctl.conf
echo 'net.core.somaxconn=1024' >> /etc/sysctl.conf
sysctl -p
```

### モニタリング指標

- **レスポンス時間**: < 2秒目標
- **エラー率**: < 1%目標  
- **アップタイム**: > 99.5%目標
- **SSL評価**: A+評価目標

## 🔧 メンテナンス

### 定期メンテナンス

```bash
# 月次メンテナンススクリプト
# Docker イメージ更新
docker-compose pull
docker-compose up -d

# システム更新
apt update && apt upgrade -y

# ディスク容量確認
df -h
docker system df
```

### スケーリング

```bash
# 水平スケーリング（Docker Swarm）
docker swarm init
docker stack deploy -c docker-stack.yml recipe

# 垂直スケーリング（リソース制限調整）
# docker-compose.yml の resources セクション編集
```

## 📞 サポート

### 緊急時対応

1. **サービス停止**: `docker-compose down`
2. **ロールバック**: 前回バックアップから復旧
3. **ログ収集**: `docker-compose logs > emergency-logs.txt`
4. **システム管理者へ連絡**

### ドキュメント

- **API仕様**: `/docs/api/`
- **アーキテクチャ**: `/docs/architecture/`
- **運用手順書**: `/docs/operations/`

---

**🎉 Personal Cooking Recipe デプロイメント完了！**

本格的な本番環境で料理レシピ管理アプリケーションをお楽しみください。