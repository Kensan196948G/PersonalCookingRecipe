# CI/CDトラブルシューティングガイド

PersonalCookingRecipeプロジェクトのCI/CDパイプラインで発生する可能性のある問題と解決方法をまとめたガイドです。

## 📋 目次

1. [ビルドエラー](#ビルドエラー)
2. [テスト失敗](#テスト失敗)
3. [デプロイエラー](#デプロイエラー)
4. [パフォーマンス問題](#パフォーマンス問題)
5. [セキュリティ問題](#セキュリティ問題)
6. [環境別問題](#環境別問題)

---

## 🔨 ビルドエラー

### 問題1: Node modules インストール失敗

**エラーメッセージ**:
```
npm ERR! code EINTEGRITY
npm ERR! sha512-... integrity checksum failed
```

**原因**:
- package-lock.json が破損している
- npm キャッシュが古い

**解決方法**:
```bash
# 1. ローカルで再生成
rm -rf node_modules package-lock.json
npm install

# 2. GitHub Actions でキャッシュクリア
# Settings → Actions → Caches から該当キャッシュを削除

# 3. ワークフロー再実行
```

---

### 問題2: TypeScript型エラー

**エラーメッセージ**:
```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'
```

**原因**:
- 型定義ファイルが不足している
- tsconfig.json の設定ミス

**解決方法**:
```bash
# 1. 型定義ファイルインストール
cd frontend
npm install --save-dev @types/node @types/react @types/react-dom

# 2. 型チェック実行
npm run type-check

# 3. tsconfig.json 確認
cat tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true,  // 外部ライブラリの型チェックスキップ
    ...
  }
}
```

---

### 問題3: Dockerビルド失敗

**エラーメッセージ**:
```
ERROR [build 5/8] RUN npm ci
ERROR: process "/bin/sh -c npm ci" did not complete successfully: exit code: 1
```

**原因**:
- Dockerfile内でpackage-lock.jsonが見つからない
- メモリ不足

**解決方法**:
```dockerfile
# 1. .dockerignore 確認
cat .dockerignore
# node_modules がリストにあることを確認

# 2. Dockerfile修正
FROM node:18-alpine AS builder
WORKDIR /app

# package.json と package-lock.json を先にコピー
COPY package*.json ./
RUN npm ci --only=production

# その後、残りをコピー
COPY . .
RUN npm run build

# 3. ビルドキャッシュクリア
docker builder prune -af

# 4. メモリ増量
docker build --memory=4g -t myapp .
```

---

## 🧪 テスト失敗

### 問題4: テストカバレッジ不足

**エラーメッセージ**:
```
❌ カバレッジ要件未達成: 37.36% < 50%
```

**原因**:
- テストファイルが不足している
- 重要なファイルがテスト対象外

**解決方法**:
```bash
# 1. カバレッジレポート確認
cd backend
npm test -- --coverage
open coverage/lcov-report/index.html

# 2. カバーされていないファイル特定
cat coverage/coverage-summary.json | jq 'to_entries | map(select(.value.lines.pct < 50)) | .[].key'

# 3. 優先順位をつけてテスト作成
# 例: src/middleware/auth-optimized.js のテスト
cat > tests/middleware/auth-optimized.test.js << 'EOF'
const auth = require('../../src/middleware/auth-optimized');

describe('Auth Middleware', () => {
  test('generateToken should create valid JWT', async () => {
    const user = { id: 1, username: 'test', email: 'test@example.com' };
    const token = await auth.generateToken(user);
    expect(token).toBeDefined();
  });

  test('verifyToken should validate JWT', async () => {
    const user = { id: 1, username: 'test', email: 'test@example.com' };
    const token = await auth.generateToken(user);
    const decoded = await auth.verifyToken(token);
    expect(decoded.id).toBe(user.id);
  });
});
EOF

# 4. テスト実行
npm test -- --coverage

# 5. カバレッジ確認
echo "Current coverage:"
cat coverage/coverage-summary.json | jq '.total.lines.pct'
```

---

### 問題5: APIパフォーマンステスト失敗

**エラーメッセージ**:
```
🚨 パフォーマンス要件未達成: 650ms > 500ms
```

**原因**:
- データベースクエリが遅い
- Redisキャッシュが機能していない
- N+1問題が発生している

**解決方法**:
```bash
# 1. ベンチマーク詳細確認
node scripts/benchmark-api.js > benchmark-report.txt
cat benchmark-report.txt

# 2. 遅いエンドポイント特定
grep "P95:" benchmark-report.txt | sort -k2 -n -r | head -5

# 3. データベースクエリ最適化
# 例: レシピ取得クエリ
# Before (N+1問題あり)
const recipes = await Recipe.findAll();
for (const recipe of recipes) {
  recipe.category = await Category.findByPk(recipe.categoryId);
}

# After (JOIN使用)
const recipes = await Recipe.findAll({
  include: [{ model: Category }]
});

# 4. Redisキャッシュ確認
redis-cli
> KEYS recipe:*
> GET recipe:list:0:10

# 5. インデックス追加
# migration/add-indexes.sql
CREATE INDEX idx_recipes_category_id ON recipes(category_id);
CREATE INDEX idx_recipes_created_at ON recipes(created_at);

# 6. 再ベンチマーク
node scripts/benchmark-api.js
```

---

### 問題6: E2Eテスト失敗 (Playwright)

**エラーメッセージ**:
```
Error: page.click: Timeout 30000ms exceeded
```

**原因**:
- フロントエンドのレンダリングが遅い
- セレクタが見つからない
- サーバーが起動していない

**解決方法**:
```bash
# 1. タイムアウト延長
# playwright.config.js
module.exports = {
  timeout: 60000,  // 30秒 → 60秒
  expect: {
    timeout: 10000,
  },
};

# 2. セレクタ確認
npx playwright codegen http://localhost:3000
# → 正しいセレクタをコピー

# 3. デバッグモードで実行
npx playwright test --debug

# 4. スクリーンショット追加
# tests/e2e/recipe.spec.ts
test('should display recipe list', async ({ page }) => {
  await page.goto('http://localhost:3000/recipes');
  await page.screenshot({ path: 'screenshots/recipe-list.png' });

  await expect(page.locator('h1')).toContainText('Recipes');
});

# 5. ヘッドレスモード無効化 (ローカルデバッグ)
npx playwright test --headed
```

---

## 🚀 デプロイエラー

### 問題7: SSH接続失敗

**エラーメッセージ**:
```
ssh: connect to host staging.example.com port 22: Connection refused
```

**原因**:
- SSH鍵が正しく設定されていない
- サーバーのファイアウォール設定

**解決方法**:
```bash
# 1. SSH鍵確認
# GitHub Secrets に STAGING_SSH_KEY が設定されているか確認

# 2. SSH鍵の形式確認
# 秘密鍵の先頭が以下のいずれかであることを確認:
# -----BEGIN OPENSSH PRIVATE KEY-----
# -----BEGIN RSA PRIVATE KEY-----
# -----BEGIN EC PRIVATE KEY-----

# 3. 公開鍵がサーバーに登録されているか確認
ssh -i deploy_key user@staging.example.com
cat ~/.ssh/authorized_keys | grep "github-actions"

# 4. ファイアウォール確認
sudo ufw status
sudo ufw allow 22/tcp

# 5. SSH設定確認
cat ~/.ssh/config
Host staging.example.com
  Port 22
  User deploy
  IdentityFile ~/.ssh/deploy_key
```

---

### 問題8: Docker Composeデプロイ失敗

**エラーメッセージ**:
```
ERROR: Service 'backend' failed to build: error getting credentials
```

**原因**:
- Dockerレジストリへのログインが失敗している
- イメージのタグが間違っている

**解決方法**:
```bash
# 1. レジストリログイン確認
echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_ACTOR --password-stdin

# 2. イメージの存在確認
docker pull ghcr.io/your-org/personalcookingrecipe-backend:main

# 3. docker-compose.yml のイメージタグ確認
cat docker-compose.yml
services:
  backend:
    image: ghcr.io/your-org/personalcookingrecipe-backend:${TAG:-main}

# 4. 環境変数設定
export TAG=main
docker-compose pull

# 5. ログ確認
docker-compose logs backend
```

---

### 問題9: ヘルスチェック失敗

**エラーメッセージ**:
```
❌ Health check failed, rolling back...
curl: (7) Failed to connect to localhost port 8080: Connection refused
```

**原因**:
- サービスが起動していない
- ポートが間違っている
- ヘルスチェックエンドポイントが存在しない

**解決方法**:
```bash
# 1. サービス状態確認
docker-compose ps

# 2. ログ確認
docker-compose logs -f backend

# 3. ポート確認
netstat -tlnp | grep 8080
# または
ss -tlnp | grep 8080

# 4. コンテナ内から確認
docker-compose exec backend curl http://localhost:3001/health

# 5. ヘルスチェックエンドポイント実装確認
# backend/src/routes/health.js
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

# 6. 待機時間延長
# deploy.yml
- name: Health check
  run: |
    sleep 60  # 30秒 → 60秒
    curl -f http://localhost/health || exit 1
```

---

## ⚡ パフォーマンス問題

### 問題10: ワークフロー実行時間が長い

**症状**:
- ワークフロー実行に60分以上かかる
- タイムアウトエラーが発生する

**原因**:
- キャッシュが効いていない
- 並列実行されていない
- 不要なステップが多い

**解決方法**:
```yaml
# 1. タイムアウト設定追加
jobs:
  test:
    timeout-minutes: 30

# 2. キャッシュヒット率確認
- name: Check cache
  uses: actions/cache@v3
  id: cache
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}

- name: Install dependencies
  if: steps.cache.outputs.cache-hit != 'true'
  run: npm ci

# 3. 並列実行最適化
strategy:
  matrix:
    service: [frontend, backend, api]
  max-parallel: 3  # 並列実行数制限

# 4. 不要なステップをスキップ
- name: Build
  if: github.event_name != 'pull_request'  # PRでは不要
  run: npm run build

# 5. アクションのバージョン更新
# actions/checkout@v2 → actions/checkout@v4
```

---

### 問題11: キャッシュが効かない

**症状**:
- 毎回依存関係を再インストールしている
- ビルド時間が改善しない

**原因**:
- キャッシュキーが毎回変わっている
- キャッシュサイズの上限を超えている

**解決方法**:
```yaml
# 1. キャッシュキーの設計見直し
- uses: actions/cache@v3
  with:
    path: |
      ~/.npm
      node_modules
    # 正しいキー設計
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

# 2. キャッシュサイズ確認
# Settings → Actions → Caches
# 上限: 10GB (超過すると古いキャッシュが削除される)

# 3. 不要なファイルをキャッシュしない
path: |
  ~/.npm
  # node_modules は大きすぎる場合は除外

# 4. キャッシュクリア
# 手動: Settings → Actions → Caches → 該当キャッシュ削除
# 自動: 7日間使用されないキャッシュは自動削除
```

---

## 🔒 セキュリティ問題

### 問題12: 脆弱性検出

**エラーメッセージ**:
```
found 5 vulnerabilities (3 moderate, 2 high)
```

**原因**:
- 依存パッケージに既知の脆弱性がある

**解決方法**:
```bash
# 1. 脆弱性詳細確認
npm audit

# 2. 自動修正
npm audit fix

# 3. 破壊的変更を含む修正
npm audit fix --force

# 4. 特定パッケージの更新
npm update <package-name>

# 5. package-lock.json 再生成
rm package-lock.json
npm install

# 6. Python依存関係
pip-audit
pip install --upgrade <package-name>

# 7. Trivyで詳細確認
trivy fs --severity CRITICAL,HIGH .

# 8. GitHub Dependabotを有効化
# Settings → Security → Dependabot alerts → Enable
```

---

### 問題13: シークレット漏洩

**エラーメッセージ**:
```
❌ ハードコードされたシークレットが検出されました
```

**原因**:
- コード内にパスワードやAPIキーが直接書かれている

**解決方法**:
```bash
# 1. シークレットスキャン実行
grep -r "password\s*=\s*['\"][^'\"]\+" --include="*.js" --include="*.py" .

# 2. 環境変数に移行
# Before
const password = "my-secret-password";

# After
const password = process.env.DB_PASSWORD;

# 3. .env ファイル使用 (ローカル開発)
# .env
DB_PASSWORD=my-secret-password
REDIS_PASSWORD=redis-secret

# 4. .gitignore に追加
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore

# 5. GitHub Secrets設定
# Settings → Secrets and variables → Actions → New repository secret

# 6. ワークフロー内で使用
env:
  DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
  REDIS_PASSWORD: ${{ secrets.REDIS_PASSWORD }}

# 7. 既にコミット済みの場合
# git-secrets でスキャン
git secrets --scan

# 8. 履歴から削除 (慎重に!)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch path/to/secret-file' \
  --prune-empty --tag-name-filter cat -- --all
```

---

## 🌍 環境別問題

### 問題14: ローカルとCI環境での挙動の違い

**症状**:
- ローカルではテストが通るのにCI環境で失敗する

**原因**:
- 環境変数の違い
- タイムゾーンの違い
- ファイルパスの違い (Windows vs Linux)

**解決方法**:
```bash
# 1. 環境変数確認
# CI環境
env | sort

# ローカル
printenv | sort

# 2. タイムゾーン統一
# CI環境で日本時刻を使用する場合
env:
  TZ: Asia/Tokyo

# 3. ファイルパスの違い
# パスセパレータを path モジュールで統一
const path = require('path');
const filePath = path.join(__dirname, 'data', 'recipes.json');

# 4. CI環境をローカルで再現
# act を使用してGitHub Actionsをローカル実行
brew install act
act -j test

# 5. Docker環境で統一
docker run --rm -v $(pwd):/app node:18 npm test
```

---

### 問題15: ステージングと本番の違い

**症状**:
- ステージングではデプロイ成功するが、本番で失敗する

**原因**:
- 環境変数の違い
- データベースの違い
- ネットワーク設定の違い

**解決方法**:
```bash
# 1. 環境変数比較
# ステージング
ssh staging.example.com 'printenv | grep -E "DB_|REDIS_"'

# 本番
ssh production.example.com 'printenv | grep -E "DB_|REDIS_"'

# 2. データベース接続確認
# ステージング
psql -h staging-db.example.com -U recipe_user -d recipe_db -c "SELECT version();"

# 本番
psql -h production-db.example.com -U recipe_user -d recipe_db -c "SELECT version();"

# 3. ネットワーク確認
# ステージング
curl -v https://staging.example.com/health

# 本番
curl -v https://production.example.com/health

# 4. 設定ファイル比較
diff /opt/recipe-app/.env.staging /opt/recipe-app/.env.production

# 5. ログレベル統一
# 本番環境でもデバッグログを一時的に有効化
LOG_LEVEL=debug docker-compose up -d
```

---

## 📊 診断チェックリスト

CI/CDパイプラインで問題が発生した場合は、以下のチェックリストを確認してください。

### ビルドエラーの場合

- [ ] package-lock.json が最新か
- [ ] Node.js / Python のバージョンが一致しているか
- [ ] 依存関係に脆弱性がないか
- [ ] Dockerfileの構文は正しいか
- [ ] .dockerignore が適切に設定されているか

### テスト失敗の場合

- [ ] テスト実行に必要なサービス (DB, Redis) が起動しているか
- [ ] 環境変数が正しく設定されているか
- [ ] テストデータが準備されているか
- [ ] タイムアウト設定は適切か
- [ ] テストカバレッジ基準を満たしているか

### デプロイエラーの場合

- [ ] SSH鍵が正しく設定されているか
- [ ] サーバーにアクセス可能か
- [ ] Dockerイメージがビルドされているか
- [ ] 環境変数が設定されているか
- [ ] ヘルスチェックエンドポイントが応答しているか

### パフォーマンス問題の場合

- [ ] キャッシュが効いているか
- [ ] 並列実行が有効になっているか
- [ ] タイムアウト設定は適切か
- [ ] 不要なステップがないか
- [ ] リソース使用量は適切か

### セキュリティ問題の場合

- [ ] シークレットがハードコードされていないか
- [ ] 依存関係に脆弱性がないか
- [ ] Trivyスキャンが通っているか
- [ ] CodeQL分析が通っているか
- [ ] .env ファイルが .gitignore に含まれているか

---

## 🆘 サポート

上記で解決しない場合は、以下の手順でサポートを受けてください。

1. **GitHubイシュー作成**
   - リポジトリ: https://github.com/your-org/PersonalCookingRecipe
   - テンプレート: Bug Report
   - 必須情報:
     - ワークフロー名
     - エラーメッセージ
     - 実行ログのスクリーンショット

2. **ログ収集**
   ```bash
   # CI/CDログダウンロード
   # GitHub Actions → 該当ワークフロー → ... → Download log archive

   # ローカルログ収集
   npm test 2>&1 | tee test-output.log
   node scripts/benchmark-api.js 2>&1 | tee benchmark-output.log
   ```

3. **再現手順**
   - 問題が発生する最小限のステップ
   - 期待される動作
   - 実際の動作

---

**最終更新**: 2025-11-21
**バージョン**: Phase 2.0
**メンテナ**: PersonalCookingRecipe CI/CD Team
