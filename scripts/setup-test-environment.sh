#!/bin/bash
# PersonalCookingRecipe テスト環境セットアップスクリプト
# Linux環境最適化版

set -e  # エラー時に停止

# カラー出力設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ロギング関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# プロジェクトルート取得
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

log_info "PersonalCookingRecipe テスト環境セットアップ開始"
log_info "プロジェクトルート: $PROJECT_ROOT"

# システム要件チェック
check_system_requirements() {
    log_info "システム要件をチェック中..."
    
    # Node.js バージョンチェック
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | sed 's/v//')
        log_success "Node.js: $NODE_VERSION"
        
        # Node.js 16以上を要求
        if [[ $(echo "$NODE_VERSION" | cut -d'.' -f1) -lt 16 ]]; then
            log_error "Node.js 16以上が必要です。現在: $NODE_VERSION"
            exit 1
        fi
    else
        log_error "Node.jsがインストールされていません"
        exit 1
    fi
    
    # Python バージョンチェック
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | awk '{print $2}')
        log_success "Python: $PYTHON_VERSION"
        
        # Python 3.8以上を要求
        if [[ $(echo "$PYTHON_VERSION" | cut -d'.' -f2) -lt 8 ]]; then
            log_error "Python 3.8以上が必要です。現在: $PYTHON_VERSION"
            exit 1
        fi
    else
        log_error "Python3がインストールされていません"
        exit 1
    fi
    
    # SQLite チェック
    if command -v sqlite3 &> /dev/null; then
        SQLITE_VERSION=$(sqlite3 --version | awk '{print $1}')
        log_success "SQLite: $SQLITE_VERSION"
    else
        log_warning "SQLiteがインストールされていません。インストールを試行します..."
        sudo apt-get update && sudo apt-get install -y sqlite3
    fi
    
    # Git チェック
    if command -v git &> /dev/null; then
        GIT_VERSION=$(git --version | awk '{print $3}')
        log_success "Git: $GIT_VERSION"
    else
        log_error "Gitがインストールされていません"
        exit 1
    fi
}

# データベースディレクトリ設定
setup_database_directories() {
    log_info "データベースディレクトリを設定中..."
    
    # テスト用データベースディレクトリ
    TEST_DB_DIRS=(
        "backend/data"
        "backend/tests/fixtures"
        "api/tests/fixtures"
        "/tmp/test-db"
        "/tmp/integration-db"
        "/tmp/e2e-db"
    )
    
    for dir in "${TEST_DB_DIRS[@]}"; do
        if [[ "$dir" == /tmp/* ]]; then
            # /tmpディレクトリの処理
            if [ ! -d "$dir" ]; then
                sudo mkdir -p "$dir"
                sudo chmod 777 "$dir"
                log_success "作成: $dir (権限: 777)"
            else
                sudo chmod 777 "$dir"
                log_success "権限更新: $dir (権限: 777)"
            fi
        else
            # プロジェクト内ディレクトリの処理
            if [ ! -d "$dir" ]; then
                mkdir -p "$dir"
                chmod 755 "$dir"
                log_success "作成: $dir (権限: 755)"
            else
                chmod 755 "$dir"
                log_success "権限更新: $dir (権限: 755)"
            fi
        fi
    done
    
    # 既存DBファイルの権限修正
    log_info "既存データベースファイルの権限を修正中..."
    find . -name "*.db" -type f -exec chmod 664 {} \; 2>/dev/null || true
    log_success "データベースファイル権限修正完了"
}

# 依存関係インストール
install_dependencies() {
    log_info "依存関係をインストール中..."
    
    # Backend依存関係
    if [ -f "backend/package.json" ]; then
        log_info "Backendの依存関係をインストール中..."
        cd backend
        
        # npmキャッシュクリア（権限問題回避）
        npm cache clean --force 2>/dev/null || true
        
        # 依存関係インストール
        npm ci --no-optional
        
        # テスト用追加パッケージ
        npm install --save-dev \
            jest-environment-node \
            supertest \
            cross-env \
            sqlite3
        
        cd ..
        log_success "Backend依存関係インストール完了"
    fi
    
    # Frontend依存関係
    if [ -f "src/frontend/package.json" ]; then
        log_info "Frontendの依存関係をインストール中..."
        cd src/frontend
        
        npm cache clean --force 2>/dev/null || true
        npm ci --no-optional
        
        # テスト用追加パッケージ
        npm install --save-dev \
            vitest \
            @testing-library/react \
            @testing-library/jest-dom \
            jsdom
        
        cd ../..
        log_success "Frontend依存関係インストール完了"
    fi
    
    # API依存関係（Python）
    if [ -f "api/requirements.txt" ]; then
        log_info "API（Python）の依存関係をインストール中..."
        cd api
        
        # 仮想環境作成（存在しない場合）
        if [ ! -d "venv" ]; then
            python3 -m venv venv
            log_success "Python仮想環境作成完了"
        fi
        
        # 仮想環境アクティベート
        source venv/bin/activate
        
        # pip更新
        pip install --upgrade pip
        
        # 依存関係インストール
        pip install -r requirements.txt
        
        # テスト用追加パッケージ
        pip install \
            pytest-cov \
            pytest-asyncio \
            pytest-mock \
            httpx \
            pytest-html
        
        deactivate
        cd ..
        log_success "API依存関係インストール完了"
    fi
    
    # E2Eテスト用依存関係
    if [ -f "e2e/package.json" ]; then
        log_info "E2Eテストの依存関係をインストール中..."
        cd e2e
        
        npm ci --no-optional
        npx playwright install --with-deps
        
        cd ..
        log_success "E2Eテスト依存関係インストール完了"
    fi
}

# テスト設定ファイル生成
generate_test_configs() {
    log_info "テスト設定ファイルを生成中..."
    
    # Backend Jest設定
    cat > backend/jest.config.js << 'EOF'
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/src/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/server.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  testTimeout: 10000,
  verbose: true
};
EOF
    
    # Backend テストセットアップファイル
    mkdir -p backend/tests
    cat > backend/tests/setup.js << 'EOF'
// Jest テストセットアップ
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:/tmp/test-db/test.db';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.PORT = '3001';

// テスト前データベースクリーンアップ
const fs = require('fs');
const path = require('path');

beforeAll(async () => {
  // テストDBファイル削除
  const testDbPath = '/tmp/test-db/test.db';
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

afterAll(async () => {
  // クリーンアップ
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});
EOF
    
    # Frontend Vitest設定
    if [ -d "src/frontend" ]; then
        cat > src/frontend/vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      reporter: ['text', 'html', 'lcov'],
      threshold: {
        global: {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75
        }
      }
    }
  },
})
EOF
    fi
    
    # Python pytest設定
    cat > pytest.ini << 'EOF'
[tool:pytest]
testpaths = tests api/tests
python_files = test_*.py *_test.py
python_classes = Test*
python_functions = test_*
addopts = 
    --verbose
    --tb=short
    --cov=.
    --cov-report=term-missing
    --cov-report=html:htmlcov
    --cov-report=xml
    --cov-fail-under=80
    --maxfail=3
filterwarnings =
    ignore::DeprecationWarning
    ignore::PendingDeprecationWarning
markers =
    integration: Integration tests requiring external services
    slow: Slow running tests
    security: Security-related tests
    e2e: End-to-end tests
EOF
    
    log_success "テスト設定ファイル生成完了"
}

# 環境変数ファイル設定
setup_environment_files() {
    log_info "環境変数ファイルを設定中..."
    
    # テスト用.env.test
    cat > .env.test << 'EOF'
NODE_ENV=test
PORT=3001
DATABASE_URL=file:/tmp/test-db/test.db
JWT_SECRET=test-jwt-secret-key-for-testing
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=test-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d

# テスト用API設定
API_URL=http://localhost:8001
FRONTEND_URL=http://localhost:3000

# テスト用認証設定
SKIP_AUTH=false
MOCK_AUTH=true

# ログレベル
LOG_LEVEL=debug
EOF
    
    # Backend用.env.test
    cp .env.test backend/.env.test
    
    # API用.env.test
    if [ -d "api" ]; then
        cat > api/.env.test << 'EOF'
ENVIRONMENT=test
DATABASE_URL=sqlite:////tmp/test-db/api-test.db
SECRET_KEY=test-secret-key-for-api-testing
DEBUG=true
TESTING=true

# 外部API設定（テスト用）
YOUTUBE_API_KEY=test_youtube_key
CLAUDE_API_KEY=test_claude_key
NOTION_TOKEN=test_notion_token
EOF
    fi
    
    log_success "環境変数ファイル設定完了"
}

# データベース初期化
initialize_databases() {
    log_info "データベースを初期化中..."
    
    # Backend データベース
    if [ -f "backend/package.json" ]; then
        cd backend
        
        # 環境変数読み込み
        export $(cat .env.test | xargs)
        
        # データベースマイグレーション（存在する場合）
        if [ -f "migrations/init.sql" ]; then
            sqlite3 /tmp/test-db/test.db < migrations/init.sql
            log_success "Backend データベースマイグレーション実行完了"
        fi
        
        cd ..
    fi
    
    # API データベース
    if [ -d "api" ]; then
        cd api
        
        # 仮想環境アクティベート
        source venv/bin/activate
        
        # データベース初期化スクリプト実行（存在する場合）
        if [ -f "scripts/init_db.py" ]; then
            python scripts/init_db.py
            log_success "API データベース初期化完了"
        fi
        
        deactivate
        cd ..
    fi
    
    log_success "データベース初期化完了"
}

# テスト実行
run_tests() {
    log_info "テストを実行中..."
    
    # Backend単体テスト
    if [ -f "backend/package.json" ]; then
        log_info "Backend単体テストを実行中..."
        cd backend
        npm test -- --maxWorkers=2 --silent
        cd ..
        log_success "Backend単体テスト完了"
    fi
    
    # Frontend単体テスト
    if [ -f "src/frontend/package.json" ]; then
        log_info "Frontend単体テストを実行中..."
        cd src/frontend
        npm run test
        cd ../..
        log_success "Frontend単体テスト完了"
    fi
    
    # API単体テスト
    if [ -d "api" ]; then
        log_info "API単体テストを実行中..."
        cd api
        source venv/bin/activate
        python -m pytest tests/ -v --tb=short
        deactivate
        cd ..
        log_success "API単体テスト完了"
    fi
    
    log_success "全テスト実行完了"
}

# パフォーマンス監視セットアップ
setup_performance_monitoring() {
    log_info "パフォーマンス監視を設定中..."
    
    # 監視ディレクトリ作成
    mkdir -p monitoring/logs
    mkdir -p monitoring/metrics
    
    # パフォーマンス監視スクリプト
    cat > monitoring/performance-monitor.sh << 'EOF'
#!/bin/bash
# パフォーマンス監視スクリプト

LOG_FILE="monitoring/logs/performance-$(date +%Y%m%d).log"

while true; do
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    memory_usage=$(free -m | awk 'NR==2{printf "%.1f", $3*100/$2}')
    disk_usage=$(df -h / | awk 'NR==2{print $5}' | cut -d'%' -f1)
    
    echo "$timestamp,CPU:${cpu_usage}%,MEM:${memory_usage}%,DISK:${disk_usage}%" >> "$LOG_FILE"
    
    sleep 10
done
EOF
    
    chmod +x monitoring/performance-monitor.sh
    log_success "パフォーマンス監視セットアップ完了"
}

# メイン処理実行
main() {
    log_info "=== PersonalCookingRecipe テスト環境セットアップ ==="
    
    # 各ステップを実行
    check_system_requirements
    setup_database_directories
    install_dependencies
    generate_test_configs
    setup_environment_files
    initialize_databases
    setup_performance_monitoring
    
    log_info "=== セットアップ完了確認 ==="
    
    # セットアップ確認
    log_info "テスト実行を確認中..."
    if run_tests; then
        log_success "✅ テスト環境セットアップ完全完了！"
        log_success "🚀 次のコマンドでテストを実行できます:"
        echo ""
        echo -e "${GREEN}  Backend:${NC}   cd backend && npm test"
        echo -e "${GREEN}  Frontend:${NC}  cd src/frontend && npm run test"
        echo -e "${GREEN}  API:${NC}       cd api && source venv/bin/activate && pytest"
        echo -e "${GREEN}  全テスト:${NC}    npm run test:all"
        echo ""
        log_success "📊 カバレッジレポート: backend/coverage/lcov-report/index.html"
        log_success "🔍 パフォーマンス監視: ./monitoring/performance-monitor.sh"
    else
        log_warning "⚠️ テスト実行で問題が発生しましたが、環境セットアップは完了しました"
        log_info "個別にテストを実行して問題を確認してください"
    fi
    
    log_success "=== セットアップ処理完了 ==="
}

# スクリプト実行
main "$@"