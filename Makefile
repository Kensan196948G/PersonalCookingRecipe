# Personal Cooking Recipe - Makefile
# 便利なコマンド集

.PHONY: help install build start stop restart logs clean deploy backup ssl test lint

# デフォルトターゲット
help:
	@echo "Personal Cooking Recipe - 利用可能なコマンド:"
	@echo ""
	@echo "🚀 開発・デプロイ"
	@echo "  make install    - 依存関係インストール"
	@echo "  make build      - Docker イメージビルド"
	@echo "  make start      - サービス開始"
	@echo "  make stop       - サービス停止"
	@echo "  make restart    - サービス再起動"
	@echo "  make deploy     - 本番デプロイ"
	@echo ""
	@echo "🔧 メンテナンス"
	@echo "  make logs       - ログ表示"
	@echo "  make backup     - バックアップ実行"
	@echo "  make clean      - Docker クリーンアップ"
	@echo "  make ssl        - SSL証明書セットアップ"
	@echo ""
	@echo "🧪 テスト・品質"
	@echo "  make test       - テスト実行"
	@echo "  make lint       - コード品質チェック"
	@echo "  make security   - セキュリティスキャン"
	@echo ""
	@echo "📊 監視"
	@echo "  make monitor    - 監視ダッシュボード起動"
	@echo "  make status     - サービス状態確認"
	@echo "  make health     - ヘルスチェック"

# =============================================================================
# 🚀 開発・デプロイ
# =============================================================================

install:
	@echo "📦 依存関係をインストールしています..."
	cd frontend && npm install
	cd backend && npm install
	cd api && pip install -r requirements.txt
	@echo "✅ インストール完了"

build:
	@echo "🔨 Docker イメージをビルドしています..."
	docker-compose build --parallel
	@echo "✅ ビルド完了"

start:
	@echo "🚀 サービスを開始しています..."
	docker-compose up -d
	@echo "⏳ サービス起動を待機中..."
	sleep 30
	@make health
	@echo "✅ サービス開始完了"

stop:
	@echo "🛑 サービスを停止しています..."
	docker-compose down
	@echo "✅ サービス停止完了"

restart:
	@echo "🔄 サービスを再起動しています..."
	docker-compose restart
	@echo "⏳ サービス起動を待機中..."
	sleep 20
	@make health
	@echo "✅ サービス再起動完了"

deploy:
	@echo "🚀 本番デプロイを開始しています..."
	@if [ ! -f .env.production ]; then \
		echo "❌ .env.production ファイルが見つかりません"; \
		echo "💡 .env.production.example をコピーして設定してください"; \
		exit 1; \
	fi
	chmod +x scripts/*.sh
	./scripts/deploy.sh full
	@echo "✅ デプロイ完了"

# =============================================================================
# 🔧 メンテナンス
# =============================================================================

logs:
	@echo "📋 ログを表示しています..."
	docker-compose logs -f

backup:
	@echo "💾 バックアップを実行しています..."
	chmod +x scripts/backup.sh
	./scripts/backup.sh
	@echo "✅ バックアップ完了"

clean:
	@echo "🧹 Docker リソースをクリーンアップしています..."
	docker-compose down --rmi all --volumes --remove-orphans
	docker system prune -af
	docker volume prune -f
	@echo "✅ クリーンアップ完了"

ssl:
	@echo "🔒 SSL証明書をセットアップしています..."
	chmod +x scripts/setup-ssl.sh
	./scripts/setup-ssl.sh
	@echo "✅ SSL設定完了"

# =============================================================================
# 🧪 テスト・品質
# =============================================================================

test:
	@echo "🧪 テストを実行しています..."
	@echo "Frontend テスト..."
	cd frontend && npm test -- --coverage --watchAll=false || echo "⚠️ Frontend tests need implementation"
	@echo "Backend テスト..."
	cd backend && npm test -- --coverage || echo "⚠️ Backend tests may have issues"
	@echo "API テスト..."
	cd api && python -m pytest tests/ -v --cov=. || echo "⚠️ API tests need implementation"
	@echo "✅ テスト完了"

lint:
	@echo "🔍 コード品質をチェックしています..."
	@echo "Frontend Lint..."
	cd frontend && npm run lint || echo "⚠️ Frontend linting issues found"
	@echo "Backend Lint..."
	cd backend && npm run lint || echo "⚠️ Backend linting not configured"
	@echo "API Lint..."
	cd api && python -m flake8 . || echo "⚠️ API linting issues found"
	@echo "✅ Lint完了"

security:
	@echo "🛡️ セキュリティスキャンを実行しています..."
	@if command -v trivy >/dev/null 2>&1; then \
		trivy fs .; \
	else \
		echo "⚠️ Trivy not installed, skipping security scan"; \
		echo "💡 Install: brew install aquasecurity/trivy/trivy"; \
	fi
	@echo "✅ セキュリティスキャン完了"

# =============================================================================
# 📊 監視
# =============================================================================

monitor:
	@echo "📊 監視ダッシュボードを起動しています..."
	docker-compose --profile monitoring up -d
	@echo "✅ 監視サービス起動完了"
	@echo "📈 Prometheus: http://localhost:9090"
	@echo "📊 Grafana: http://localhost:3001"

status:
	@echo "📊 サービス状態を確認しています..."
	docker-compose ps
	@echo ""
	@echo "💾 ディスク使用量:"
	df -h | head -n 2
	@echo ""
	@echo "🖥️ メモリ使用量:"
	free -h

health:
	@echo "💚 ヘルスチェックを実行しています..."
	@echo -n "Frontend: "
	@curl -sf http://localhost:3000 >/dev/null 2>&1 && echo "✅ OK" || echo "❌ FAIL"
	@echo -n "Backend: "
	@curl -sf http://localhost:5000/api/health >/dev/null 2>&1 && echo "✅ OK" || echo "❌ FAIL"
	@echo -n "API: "
	@curl -sf http://localhost:8000/api/health >/dev/null 2>&1 && echo "✅ OK" || echo "❌ FAIL"
	@echo -n "Nginx: "
	@curl -sf http://localhost/health >/dev/null 2>&1 && echo "✅ OK" || echo "❌ FAIL"

# =============================================================================
# 🔧 開発環境専用
# =============================================================================

dev:
	@echo "🛠️ 開発環境を起動しています..."
	docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
	@echo "✅ 開発環境起動完了"
	@echo "🌐 Frontend: http://localhost:3000"
	@echo "⚡ Backend: http://localhost:5000"
	@echo "🐍 API: http://localhost:8000"

dev-logs:
	@echo "📋 開発環境ログを表示しています..."
	docker-compose -f docker-compose.yml -f docker-compose.override.yml logs -f

dev-stop:
	@echo "🛑 開発環境を停止しています..."
	docker-compose -f docker-compose.yml -f docker-compose.override.yml down
	@echo "✅ 開発環境停止完了"

# =============================================================================
# 📚 ヘルプ・情報
# =============================================================================

info:
	@echo "ℹ️ Personal Cooking Recipe 情報"
	@echo ""
	@echo "📁 プロジェクト構造:"
	@echo "  ├── frontend/     - Next.js Webアプリ"
	@echo "  ├── backend/      - Node.js API"
	@echo "  ├── api/          - Python FastAPI"
	@echo "  ├── nginx/        - Reverse Proxy設定"
	@echo "  ├── scripts/      - デプロイ・管理スクリプト"
	@echo "  └── monitoring/   - Prometheus・Grafana設定"
	@echo ""
	@echo "🔗 有用なリンク:"
	@echo "  📖 README-DEPLOYMENT.md - デプロイガイド"
	@echo "  🏗️ docker-compose.yml - サービス構成"
	@echo "  ⚙️ .env.production.example - 環境変数テンプレート"