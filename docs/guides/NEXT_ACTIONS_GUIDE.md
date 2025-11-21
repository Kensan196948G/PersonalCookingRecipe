# 次のアクション実行ガイド

**作成日**: 2025-11-21
**Phase**: Phase 2 Week 2完了 → Week 3準備
**対象**: PersonalCookingRecipe監視システム起動とLighthouse実行

---

## 🎯 実行が必要なアクション

Phase 2 Week 1-2の実装は95%完了しました。残り5%を完了させるため、以下のアクションを実施してください。

---

## 🔴 Priority 1: PostgreSQL監視システムセットアップ

### Step 1: PostgreSQL起動・データベース作成

**実行コマンド** (sudo権限が必要):

```bash
# PostgreSQL起動
sudo systemctl start postgresql
sudo systemctl enable postgresql

# PostgreSQL接続テスト
sudo -u postgres psql -c "SELECT version();"
```

**期待される出力**:
```
PostgreSQL 14.x (Ubuntu 14.x-xUbuntu)
```

### Step 2: データベースとユーザー作成

```bash
sudo -u postgres psql << 'EOF'
-- データベース作成
CREATE DATABASE recipe_db;

-- ユーザー作成
CREATE USER recipe_user WITH PASSWORD 'recipe_secure_password_2024';

-- 権限付与
GRANT ALL PRIVILEGES ON DATABASE recipe_db TO recipe_user;
GRANT ALL ON SCHEMA public TO recipe_user;

-- 確認
\l recipe_db
\du recipe_user
\q
EOF
```

**期待される出力**:
```
CREATE DATABASE
CREATE ROLE
GRANT
GRANT
```

### Step 3: 監視テーブル作成

```bash
# recipe_dbに接続
sudo -u postgres psql -d recipe_db

# マイグレーション実行
\i /mnt/Linux-ExHDD/PersonalCookingRecipe/backend/src/monitoring/migrations/001-create-metrics-tables.sql

# テーブル確認
\dt
\dv
\df

# 終了
\q
```

**期待される出力**:
```
CREATE TABLE (×5)
CREATE VIEW (×3)
CREATE FUNCTION (×3)
```

### Step 4: 接続テスト

```bash
# アプリケーションユーザーで接続テスト
psql -h localhost -U recipe_user -d recipe_db -c "SELECT NOW();"
# パスワード: recipe_secure_password_2024
```

**成功すれば**: 現在時刻が表示される

### Step 5: 動作確認テスト

```bash
cd /mnt/Linux-ExHDD/PersonalCookingRecipe/backend
node src/monitoring/test-monitoring.js
```

**期待される出力**:
```
✅ PostgreSQL接続テスト - 成功
✅ Redis接続テスト - 成功
✅ テーブル存在確認 - 成功 (5テーブル)
✅ ビュー存在確認 - 成功 (3ビュー)
...
🎉 全15項目のテストが成功しました!
```

---

## 🟡 Priority 2: PM2起動と監視システム稼働

### Step 1: PM2プロセス起動

```bash
cd /mnt/Linux-ExHDD/PersonalCookingRecipe

# 既存プロセス確認
pm2 status

# 新規起動 (または再起動)
pm2 start ecosystem.config.js

# プロセス確認
pm2 status

# ログ確認
pm2 logs --lines 20
```

**期待されるプロセス**:
- recipe-backend (online)
- recipe-monitoring-collector (online)
- recipe-monitoring-dashboard (online) ※オプション

### Step 2: 自動起動設定

```bash
# システム起動時の自動起動
pm2 startup systemd

# 上記コマンドが出力したコマンドを実行 (sudo必要)
# 例: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u kensan --hp /home/kensan

# 現在の状態を保存
pm2 save
```

### Step 3: 監視ダッシュボード確認

**アクセス**:
```
http://localhost:5000/monitoring/dashboard
```

**または独立ダッシュボード**:
```
http://localhost:5001
```

**確認項目**:
- [ ] システムメトリクスが表示される
- [ ] グラフが更新される
- [ ] アラート一覧が表示される
- [ ] エラーがない

---

## 🟢 Priority 3: Lighthouse CI実行

### Step 1: フロントエンドビルド

```bash
cd /mnt/Linux-ExHDD/PersonalCookingRecipe/frontend

# 本番ビルド
npm run build

# ビルド結果確認
# Route (app)のサイズを確認
```

**期待される出力**:
```
Route (app)                    Size     First Load JS
┌ ○ /                         29.5 kB      196 kB
```

### Step 2: 本番モード起動

```bash
# 本番サーバー起動
npm run start

# または PM2で起動
pm2 start ecosystem.config.js --only recipe-frontend
```

**アクセス確認**:
```
http://localhost:3000
```

ブラウザでアクセスし、正常に表示されることを確認。

### Step 3: Lighthouse CI実行

**別ターミナルで実行**:

```bash
cd /mnt/Linux-ExHDD/PersonalCookingRecipe

# Lighthouse実行
node scripts/lighthouse-ci.js

# または、npx lighthouse直接実行
npx lighthouse http://localhost:3000 --view
```

**期待される出力**:
```
🚀 Lighthouse CI実行中...
📊 Performance: 92
📊 Accessibility: 98
📊 Best Practices: 95
📊 SEO: 100
📊 PWA: 87
✅ 全カテゴリが目標スコア90以上を達成!
```

**レポート確認**:
```bash
# HTMLレポート
open frontend/.lighthouseci/report.html

# JSONレポート
cat frontend/.lighthouseci/report.json | jq '.categories'
```

---

## 🔧 Priority 4: Critical Issues修正開始

### Issue 1: キャッシュポイズニング対策 (SEC-001)

**ファイル**: `backend/src/services/cacheService.js`

**現状**:
```javascript
const parsed = JSON.parse(value);  // 検証なし
```

**修正**:
```javascript
const parsed = JSON.parse(value);

// スキーマ検証追加
if (!this.validateCacheData(parsed, key)) {
    throw new Error('Invalid cache data');
}
```

### Issue 2: ハッシュ衝突対策 (SEC-002)

**ファイル**: `backend/src/middleware/cache-enhanced.js`

**現状**:
```javascript
const hash = crypto.createHash('md5')
    .update(cacheKey)
    .digest('hex')
    .substring(0, 16);  // 16文字のみ使用
```

**修正**:
```javascript
const hash = crypto.createHash('sha256')
    .update(cacheKey)
    .digest('hex');  // 64文字全て使用
```

### Issue 3: SQL インジェクション対策 (SEC-003)

**ファイル**: `backend/src/models/Recipe.js`

**修正**: パラメータ化クエリの徹底

```javascript
// Before
db.query(`SELECT * FROM recipes WHERE id = ${id}`);

// After
db.query('SELECT * FROM recipes WHERE id = $1', [id]);
```

### Issue 4: KEYS → SCAN 移行 (PERF-001)

**ファイル**: `backend/src/middleware/cache-enhanced.js`

**現状**:
```javascript
const keys = await this.client.keys(pattern);  // O(N) 全キー走査
```

**修正**:
```javascript
const keys = [];
let cursor = '0';
do {
    const [newCursor, matches] = await this.client.scan(
        cursor, 'MATCH', pattern, 'COUNT', 100
    );
    keys.push(...matches);
    cursor = newCursor;
} while (cursor !== '0');
```

### Issue 5: メモリリーク対策 (MEM-001)

**ファイル**: `backend/src/middleware/cache-enhanced.js`

**現状**:
```javascript
while (this.queue.length >= this.MAX_QUEUE_SIZE) {
    this.queue.shift();  // 配列先頭削除(遅い)
}
```

**修正**:
```javascript
// 循環バッファパターン使用
if (this.writeIndex >= this.MAX_QUEUE_SIZE) {
    this.writeIndex = 0;
}
this.queue[this.writeIndex++] = key;
```

---

## 📋 実行チェックリスト

### PostgreSQL監視システム

- [ ] PostgreSQL起動 (`sudo systemctl start postgresql`)
- [ ] データベース作成 (上記Step 2)
- [ ] 監視テーブル作成 (上記Step 3)
- [ ] 接続テスト (上記Step 4)
- [ ] 動作確認テスト (上記Step 5)
- [ ] PM2起動 (`pm2 start ecosystem.config.js`)
- [ ] ダッシュボード確認 (`http://localhost:5000/monitoring/dashboard`)

### Lighthouse CI

- [ ] フロントエンドビルド (`npm run build`)
- [ ] 本番モード起動 (`npm run start`)
- [ ] Lighthouse実行 (`node scripts/lighthouse-ci.js`)
- [ ] スコア確認 (全カテゴリ≥90)
- [ ] HTMLレポート確認

### Critical Issues修正

- [ ] Issue 1: キャッシュポイズニング対策
- [ ] Issue 2: ハッシュ衝突対策
- [ ] Issue 3: SQL インジェクション対策
- [ ] Issue 4: KEYS → SCAN 移行
- [ ] Issue 5: メモリリーク対策

---

## 🚨 トラブルシューティング

### PostgreSQLが起動しない

```bash
# ステータス確認
sudo systemctl status postgresql

# エラーログ確認
sudo journalctl -u postgresql -n 50

# 手動起動
sudo pg_ctlcluster 14 main start
```

### データベース作成エラー

```bash
# 既存確認
sudo -u postgres psql -l | grep recipe_db

# 既存の場合は削除して再作成
sudo -u postgres psql -c "DROP DATABASE IF EXISTS recipe_db;"
```

### PM2起動エラー

```bash
# PM2リセット
pm2 kill
pm2 start ecosystem.config.js

# ログ確認
pm2 logs --lines 50
```

### Lighthouse実行エラー

```bash
# ポート確認
lsof -i :3000

# プロセス確認
ps aux | grep next

# フロントエンド再起動
pkill -f "next"
npm run start
```

---

## 📊 期待される成果

### PostgreSQL監視システム

**稼働状態**:
- PM2プロセス: `online`
- PostgreSQLテーブル: 5個作成済み
- メトリクス収集: 1分毎
- ダッシュボード: アクセス可能

### Lighthouse CI

**スコア**:
- Performance: ≥90
- Accessibility: ≥90
- Best Practices: ≥90
- SEO: ≥90
- PWA: ≥80

### Critical Issues

**修正完了**: 5件 → 0件

---

## 📝 次のステップ (Week 3)

上記のアクションが完了したら、Week 3に進みます:

**Week 3目標**:
- カバレッジ 30%達成
- SLI/SLO測定開始
- High Priority Issues 8件修正

**実施事項**:
1. 追加テスト実装 (categoryController, mealPlanController)
2. Modelテスト実装 (User, Recipe, Category)
3. 統合テスト強化
4. パフォーマンステスト自動化

---

**このガイドに従って実行してください!** 🚀

**問題が発生した場合**:
1. エラーメッセージを確認
2. 該当セクションのトラブルシューティングを参照
3. レポート (`POSTGRESQL_MONITORING_SETUP_REPORT.md`等) を確認

**完了したら**:
次のWeek 3タスクに進む準備が整います!
