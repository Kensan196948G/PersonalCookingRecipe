# PostgreSQL監視システム 実行ガイド

**重要**: PostgreSQLが現在起動していないため、以下の手順に従ってセットアップを完了してください。

---

## 現在の状況

- PostgreSQLサーバーが起動していません
- 全ての必要なスクリプトとドキュメントは作成済みです
- セットアップの準備は完了しています

---

## セットアップ実行手順（完全版）

### フェーズ1: PostgreSQL起動とデータベース作成

#### 1-1. PostgreSQL起動

```bash
# PostgreSQL起動
sudo systemctl start postgresql

# 自動起動有効化（オプション）
sudo systemctl enable postgresql

# 状態確認
sudo systemctl status postgresql
```

#### 1-2. データベースとユーザー作成

```bash
# PostgreSQLに接続（postgresユーザーとして）
sudo -u postgres psql
```

PostgreSQL内で以下のコマンドを実行:

```sql
-- データベース作成
CREATE DATABASE recipe_db;

-- ユーザー作成（パスワードは安全なものに変更してください）
CREATE USER recipe_user WITH PASSWORD 'your_secure_password_here';

-- 権限付与
GRANT ALL PRIVILEGES ON DATABASE recipe_db TO recipe_user;

-- 接続確認
\c recipe_db

-- recipe_userにスキーマ権限を付与
GRANT ALL ON SCHEMA public TO recipe_user;

-- 終了
\q
```

#### 1-3. 接続テスト

```bash
# パスワード入力を求められます
psql -h localhost -p 5432 -U recipe_user -d recipe_db -c "SELECT NOW();"
```

成功すれば「現在時刻」が表示されます。

---

### フェーズ2: セットアップスクリプト実行

```bash
cd /mnt/Linux-ExHDD/PersonalCookingRecipe

# セットアップスクリプト実行
./backend/scripts/setup-postgresql-monitoring.sh
```

**実行される内容**:
1. PostgreSQL接続確認
2. パスワード入力プロンプト
3. マイグレーションSQL実行
4. テーブル・ビュー・関数作成
5. Redis接続確認
6. Node.js依存パッケージインストール
7. ログディレクトリ作成
8. `.env` ファイル作成

**所要時間**: 約2-3分

---

### フェーズ3: 動作確認テスト

```bash
cd /mnt/Linux-ExHDD/PersonalCookingRecipe/backend

# テストスクリプト実行
node src/monitoring/test-monitoring.js
```

**実行される15のテスト**:
1. PostgreSQL接続テスト
2. Redis接続テスト
3. テーブル存在確認
4. ビュー存在確認
5. メトリクス書き込みテスト
6. メトリクス読み込みテスト
7. latest_metricsビューテスト
8. アラート履歴書き込みテスト
9. アラート履歴読み込みテスト
10. active_alertsビューテスト
11. 統計関数テスト
12. Redis書き込みテスト
13. Redis読み込みテスト
14. マテリアライズドビュー更新テスト
15. テストデータクリーンアップ

**期待される結果**: 全テスト成功（警告は許容）

---

### フェーズ4: 監視システム起動

```bash
# PM2で監視コレクター起動
pm2 start ecosystem.config.js --only recipe-monitoring-collector

# 状態確認
pm2 status

# ログ確認（リアルタイム）
pm2 logs recipe-monitoring-collector
```

**起動確認ポイント**:
- ステータスが `online` になっている
- エラーログが出ていない
- メトリクス収集ログが流れている

---

### フェーズ5: ダッシュボード起動（オプション）

```bash
# ダッシュボードサーバー起動
pm2 start ecosystem.config.js --only recipe-monitoring-dashboard

# 状態確認
pm2 status
```

ブラウザでアクセス:
```
http://localhost:5001/
```

---

## セットアップ後の確認

### PostgreSQLメトリクス確認

```bash
psql -h localhost -p 5432 -U recipe_user -d recipe_db
```

```sql
-- 最新メトリクス確認
SELECT metric_name, metric_value, timestamp
FROM latest_metrics
ORDER BY metric_name;

-- メトリクス数確認
SELECT COUNT(*) FROM system_metrics;

-- アラート履歴確認
SELECT COUNT(*) FROM alert_history;
```

### PM2プロセス確認

```bash
# 全プロセス状態
pm2 status

# 監視コレクター詳細
pm2 describe recipe-monitoring-collector

# メモリ・CPU使用状況
pm2 monit
```

---

## トラブルシューティング

### ケース1: PostgreSQL起動失敗

```bash
# エラーログ確認
sudo journalctl -u postgresql -n 50

# 設定ファイル確認
sudo cat /etc/postgresql/14/main/postgresql.conf | grep -E "port|listen"

# ポート確認
sudo netstat -tuln | grep 5432
```

### ケース2: パスワード認証エラー

```bash
# pg_hba.conf 確認
sudo cat /etc/postgresql/14/main/pg_hba.conf

# 以下の行が存在することを確認:
# host    all    all    127.0.0.1/32    md5

# 存在しない場合は追加して再起動
sudo systemctl restart postgresql
```

### ケース3: Redis未起動

```bash
# Redis起動
sudo systemctl start redis-server

# 接続テスト
redis-cli ping
# 応答: PONG
```

### ケース4: テーブル作成失敗

```bash
# マイグレーション再実行
psql -h localhost -p 5432 -U recipe_user -d recipe_db \
  -f /mnt/Linux-ExHDD/PersonalCookingRecipe/backend/src/monitoring/migrations/001-create-metrics-tables.sql
```

---

## 完了チェックリスト

セットアップが完了したら、以下をすべてチェックしてください:

- [ ] PostgreSQLが起動している (`sudo systemctl status postgresql`)
- [ ] Redisが起動している (`sudo systemctl status redis-server`)
- [ ] データベース `recipe_db` が存在する
- [ ] ユーザー `recipe_user` が作成されている
- [ ] 5つのテーブルが作成されている (`\dt` で確認)
- [ ] 3つのビューが作成されている (`\dv` で確認)
- [ ] テストスクリプトが全て成功している
- [ ] PM2で `recipe-monitoring-collector` が `online` 状態
- [ ] メトリクスがPostgreSQLに保存されている (`SELECT COUNT(*) FROM system_metrics;`)
- [ ] ログにエラーが出ていない (`pm2 logs recipe-monitoring-collector`)

---

## 次のステップ

1. **メトリクス収集の確認**（5分後）:
   ```sql
   SELECT metric_name, COUNT(*) as count
   FROM system_metrics
   WHERE timestamp >= NOW() - INTERVAL '10 minutes'
   GROUP BY metric_name
   ORDER BY metric_name;
   ```

2. **ダッシュボード確認**:
   - http://localhost:5001/ にアクセス
   - リアルタイムグラフが更新されているか確認

3. **アラート動作確認**:
   ```sql
   SELECT * FROM active_alerts;
   ```

4. **詳細ドキュメント参照**:
   - `/mnt/Linux-ExHDD/PersonalCookingRecipe/POSTGRESQL_MONITORING_SETUP_REPORT.md`

---

## サポート情報

### 作成されたファイル一覧

| ファイル | パス | 説明 |
|---------|------|------|
| セットアップスクリプト | `backend/scripts/setup-postgresql-monitoring.sh` | 自動セットアップ |
| テストスクリプト | `backend/src/monitoring/test-monitoring.js` | 動作確認テスト |
| マイグレーションSQL | `backend/src/monitoring/migrations/001-create-metrics-tables.sql` | DB初期化 |
| PM2設定 | `ecosystem.config.js` | プロセス管理 |
| 詳細レポート | `POSTGRESQL_MONITORING_SETUP_REPORT.md` | 完全ドキュメント |
| クイックスタート | `backend/MONITORING_QUICKSTART.md` | 簡易ガイド |

### 環境変数ファイル (.env)

セットアップスクリプト実行後、`backend/.env` が自動生成されます:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=recipe_db
DB_USER=recipe_user
DB_PASSWORD=your_password

REDIS_HOST=localhost
REDIS_PORT=6379

MONITORING_ENABLED=true
METRICS_RETENTION_DAYS=30
```

### PM2プロセス一覧

| プロセス名 | 説明 | ポート |
|-----------|------|--------|
| recipe-frontend | Next.js フロントエンド | 3000 |
| recipe-backend | Express バックエンド | 5000 |
| recipe-monitoring-collector | メトリクス収集 | - |
| recipe-monitoring-dashboard | 監視ダッシュボード | 5001 |

---

## よくある質問（FAQ）

### Q1: PostgreSQLのパスワードを忘れました

```bash
# パスワードリセット
sudo -u postgres psql
```

```sql
ALTER USER recipe_user WITH PASSWORD 'new_password';
```

### Q2: メトリクスが保存されていません

```bash
# PM2ログ確認
pm2 logs recipe-monitoring-collector --lines 100

# PostgreSQL接続エラーがないか確認
# Redisエラーは無視してOK（フォールバック動作）
```

### Q3: ディスク容量が不足しています

```sql
-- 古いメトリクス削除（7日以上前）
SELECT * FROM cleanup_old_metrics(7);

-- テーブルサイズ確認
SELECT
    pg_size_pretty(pg_total_relation_size('system_metrics')) as size;
```

### Q4: ダッシュボードが表示されません

```bash
# プロセス確認
pm2 status recipe-monitoring-dashboard

# 起動していない場合
pm2 start ecosystem.config.js --only recipe-monitoring-dashboard

# ポート確認
sudo netstat -tuln | grep 5001
```

---

## 緊急時の対応

### 全プロセス停止

```bash
pm2 stop all
```

### 全プロセス再起動

```bash
pm2 restart all
```

### PM2リセット

```bash
pm2 delete all
pm2 start ecosystem.config.js
```

### PostgreSQL再起動

```bash
sudo systemctl restart postgresql
```

### Redis再起動

```bash
sudo systemctl restart redis-server
```

---

**最終更新**: 2025-11-21
**バージョン**: 1.0.0
**作成者**: Claude Code (Backend API Developer)

**注意**: このガイドはLinuxネイティブ環境用です。Docker環境では動作しません。
