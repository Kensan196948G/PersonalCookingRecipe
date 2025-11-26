# PostgreSQL監視システム移行ガイド

**PersonalCookingRecipe - SQLiteからPostgreSQLへの完全移行手順**

作成日: 2025-11-21
対象: sudo権限を持つユーザー向け

---

## 目次

1. [現状確認](#現状確認)
2. [PostgreSQL設定変更](#postgresql設定変更)
3. [データベース作成](#データベース作成)
4. [テーブル作成](#テーブル作成)
5. [メトリクスコレクター設定変更](#メトリクスコレクター設定変更)
6. [動作確認](#動作確認)
7. [データ移行（オプション）](#データ移行オプション)
8. [トラブルシューティング](#トラブルシューティング)

---

## 現状確認

### 現在のシステム構成

```bash
# PM2プロセス確認
pm2 list

# 現在はSQLiteで稼働中
sqlite3 /mnt/Linux-ExHDD/PersonalCookingRecipe/backend/data/monitoring.db ".tables"

# 監視コレクター設定確認
pm2 env recipe-monitoring-collector | grep MONITORING_DB
# 出力: MONITORING_DB=sqlite
```

### SQLite vs PostgreSQL比較

| 項目 | SQLite | PostgreSQL |
|------|--------|------------|
| パフォーマンス | 軽量・高速（小規模） | 高性能（大規模対応） |
| 同時アクセス | 制限あり | 優れた並行処理 |
| 管理 | ファイルベース（簡単） | サーバーベース |
| 機能 | 基本的なSQL | 高度なSQL・拡張機能 |
| バックアップ | ファイルコピー | pg_dump等 |
| sudo権限 | 不要 | 必要 |

---

## PostgreSQL設定変更

### 1. PostgreSQL設定ファイル編集

#### postgresql.confの編集

```bash
# PostgreSQL設定ファイル場所確認
sudo -u postgres psql -c "SHOW config_file;"

# 設定ファイル編集
sudo nano /etc/postgresql/16/main/postgresql.conf
```

以下の設定を変更:

```ini
# 接続設定
listen_addresses = 'localhost'         # ローカル接続のみ
port = 5432                            # デフォルトポート

# 接続数
max_connections = 100                  # 同時接続数

# メモリ設定
shared_buffers = 256MB                 # 共有バッファ（推奨: RAM の 25%）
effective_cache_size = 1GB             # キャッシュサイズ

# ログ設定
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
```

#### pg_hba.confの編集

```bash
# 認証設定ファイル編集
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

以下の行を追加（既存の設定の前に）:

```conf
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# ローカル接続（Unixソケット）
local   all             postgres                                peer
local   recipe_db       recipe_user                             md5

# TCP/IP接続（localhost）
host    recipe_db       recipe_user     127.0.0.1/32            md5
host    recipe_db       recipe_user     ::1/128                 md5
```

### 2. PostgreSQL再起動

```bash
# 設定確認
sudo -u postgres psql -c "SELECT name, setting FROM pg_settings WHERE name IN ('listen_addresses', 'port', 'max_connections');"

# PostgreSQL再起動
sudo systemctl restart postgresql

# 再起動確認
sudo systemctl status postgresql
```

---

## データベース作成

### 1. PostgreSQLユーザー作成

```bash
# postgresユーザーとしてログイン
sudo -u postgres psql
```

PostgreSQLシェル内で実行:

```sql
-- 監視システム用ユーザー作成
CREATE USER recipe_user WITH PASSWORD 'your_secure_password_here';

-- ユーザー確認
\du
```

### 2. データベース作成

```sql
-- データベース作成
CREATE DATABASE recipe_db OWNER recipe_user;

-- 権限付与
GRANT ALL PRIVILEGES ON DATABASE recipe_db TO recipe_user;

-- データベース一覧確認
\l

-- 終了
\q
```

### 3. 接続テスト

```bash
# 作成したユーザーでログイン
psql -U recipe_user -d recipe_db -h localhost

# ログイン成功したら
\conninfo
\q
```

---

## テーブル作成

### 1. マイグレーションSQL実行

```bash
# recipe_userとしてマイグレーション実行
psql -U recipe_user -d recipe_db -h localhost -f \
  /mnt/Linux-ExHDD/PersonalCookingRecipe/backend/src/monitoring/migrations/001-create-metrics-tables.sql
```

期待される出力:

```
CREATE TABLE
CREATE INDEX
CREATE INDEX
...
NOTICE: メトリクステーブル作成完了
```

### 2. テーブル確認

```bash
psql -U recipe_user -d recipe_db -h localhost
```

PostgreSQLシェル内で:

```sql
-- テーブル一覧
\dt

-- テーブル構造確認
\d system_metrics
\d metrics_raw
\d alert_history

-- ビュー確認
\dv

-- 関数確認
\df

-- 初期データ確認
SELECT * FROM system_metrics;

-- 終了
\q
```

---

## メトリクスコレクター設定変更

### 1. 環境変数設定

ecosystem.config.jsを編集:

```bash
nano /mnt/Linux-ExHDD/PersonalCookingRecipe/ecosystem.config.js
```

`recipe-monitoring-collector`の`env`セクションを以下に変更:

```javascript
env: {
  NODE_ENV: 'production',
  MONITORING_DB: 'postgresql',  // sqlite → postgresql
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_NAME: 'recipe_db',
  DB_USER: 'recipe_user',
  DB_PASSWORD: 'your_secure_password_here',  // ★パスワード設定
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  MONITORING_ENABLED: 'true',
  METRICS_RETENTION_DAYS: 30
},
```

### 2. パスワード安全管理（推奨）

環境変数ファイルを使用:

```bash
# .envファイル作成
cat > /mnt/Linux-ExHDD/PersonalCookingRecipe/backend/.env.monitoring << 'EOF'
MONITORING_DB=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=recipe_db
DB_USER=recipe_user
DB_PASSWORD=your_secure_password_here
REDIS_HOST=localhost
REDIS_PORT=6379
MONITORING_ENABLED=true
METRICS_RETENTION_DAYS=30
EOF

# パーミッション設定（重要）
chmod 600 /mnt/Linux-ExHDD/PersonalCookingRecipe/backend/.env.monitoring
```

ecosystem.config.jsで.envを読み込む:

```javascript
const dotenv = require('dotenv');
dotenv.config({ path: './backend/.env.monitoring' });

// ...

env: process.env  // 環境変数を全て引き継ぐ
```

### 3. コレクター再起動

```bash
# PM2プロセス再起動
pm2 restart recipe-monitoring-collector

# ログ確認
pm2 logs recipe-monitoring-collector --lines 50
```

期待されるログ:

```
info: メトリクスコレクター起動開始 {"databaseType":"postgresql",...}
info: PostgreSQL接続成功
info: メトリクスコレクター起動完了
```

---

## 動作確認

### 1. データベース接続確認

```bash
# PostgreSQLに直接問い合わせ
psql -U recipe_user -d recipe_db -h localhost -c "SELECT COUNT(*) FROM system_metrics;"
```

### 2. メトリクス収集確認

```bash
# 1分待機
sleep 60

# メトリクス確認
psql -U recipe_user -d recipe_db -h localhost << 'EOF'
-- メトリクス数確認
SELECT COUNT(*) as total_metrics FROM system_metrics;

-- メトリクス種類確認
SELECT metric_name, COUNT(*) as count
FROM system_metrics
GROUP BY metric_name
ORDER BY count DESC;

-- 最新メトリクス確認
SELECT * FROM latest_metrics;

-- 時間別集約確認
SELECT * FROM metrics_hourly ORDER BY hour DESC LIMIT 10;
EOF
```

### 3. パフォーマンス確認

```bash
# データベースサイズ
psql -U recipe_user -d recipe_db -h localhost -c \
  "SELECT pg_size_pretty(pg_database_size('recipe_db'));"

# 接続数確認
psql -U recipe_user -d recipe_db -h localhost -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname = 'recipe_db';"

# クエリパフォーマンス
psql -U recipe_user -d recipe_db -h localhost -c \
  "SELECT query, calls, total_exec_time, mean_exec_time
   FROM pg_stat_statements
   ORDER BY total_exec_time DESC
   LIMIT 10;"
```

### 4. アラート確認

```bash
psql -U recipe_user -d recipe_db -h localhost << 'EOF'
-- アラート履歴
SELECT * FROM alert_history ORDER BY timestamp DESC LIMIT 10;

-- アクティブアラート
SELECT * FROM active_alerts;
EOF
```

---

## データ移行（オプション）

既存のSQLiteデータをPostgreSQLに移行する場合:

### 移行スクリプト作成

```bash
cat > /tmp/migrate-monitoring-data.sh << 'EOF'
#!/bin/bash

SQLITE_DB="/mnt/Linux-ExHDD/PersonalCookingRecipe/backend/data/monitoring.db"
PG_HOST="localhost"
PG_PORT="5432"
PG_DB="recipe_db"
PG_USER="recipe_user"

echo "SQLiteからPostgreSQLへデータ移行開始"

# system_metrics移行
sqlite3 $SQLITE_DB << SQL | psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DB
.mode insert system_metrics
SELECT * FROM system_metrics;
SQL

echo "system_metrics移行完了"

# metrics_raw移行
sqlite3 $SQLITE_DB << SQL | psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DB
.mode insert metrics_raw
SELECT * FROM metrics_raw;
SQL

echo "metrics_raw移行完了"

# alert_history移行
sqlite3 $SQLITE_DB << SQL | psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DB
.mode insert alert_history
SELECT * FROM alert_history;
SQL

echo "alert_history移行完了"
echo "データ移行完了"
EOF

chmod +x /tmp/migrate-monitoring-data.sh
```

### 移行実行

```bash
# ドライラン（確認のみ）
# /tmp/migrate-monitoring-data.sh --dry-run

# 本番移行
/tmp/migrate-monitoring-data.sh
```

---

## トラブルシューティング

### PostgreSQL接続エラー

#### エラー: "could not connect to server"

```bash
# PostgreSQL起動確認
sudo systemctl status postgresql

# 起動していない場合
sudo systemctl start postgresql

# ポート確認
sudo netstat -tlnp | grep 5432
```

#### エラー: "FATAL: Peer authentication failed"

pg_hba.confを確認:

```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf

# 以下を確認
local   recipe_db   recipe_user   md5  # 'peer' → 'md5'に変更

# PostgreSQL再起動
sudo systemctl restart postgresql
```

#### エラー: "password authentication failed"

```bash
# パスワードリセット
sudo -u postgres psql << EOF
ALTER USER recipe_user WITH PASSWORD 'new_secure_password';
EOF

# .env.monitoringのパスワード更新
nano /mnt/Linux-ExHDD/PersonalCookingRecipe/backend/.env.monitoring

# PM2再起動
pm2 restart recipe-monitoring-collector
```

### テーブル作成エラー

#### エラー: "permission denied for schema public"

```bash
sudo -u postgres psql -d recipe_db << EOF
GRANT ALL ON SCHEMA public TO recipe_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO recipe_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO recipe_user;
EOF
```

#### エラー: "relation already exists"

```bash
# 既存テーブル削除（注意: データが消えます）
psql -U recipe_user -d recipe_db -h localhost << EOF
DROP TABLE IF EXISTS system_metrics CASCADE;
DROP TABLE IF EXISTS metrics_raw CASCADE;
DROP TABLE IF EXISTS metrics_hourly CASCADE;
DROP TABLE IF EXISTS daily_summaries CASCADE;
DROP TABLE IF EXISTS alert_history CASCADE;
DROP MATERIALIZED VIEW IF EXISTS metrics_last_24h;
EOF

# マイグレーション再実行
psql -U recipe_user -d recipe_db -h localhost -f \
  /mnt/Linux-ExHDD/PersonalCookingRecipe/backend/src/monitoring/migrations/001-create-metrics-tables.sql
```

### メトリクス収集エラー

#### ログに "PostgreSQL接続エラー" が出る場合

```bash
# PM2環境変数確認
pm2 env recipe-monitoring-collector | grep DB_

# 環境変数が正しいか確認
# DB_PASSWORD が設定されているか確認

# 手動接続テスト
psql -U recipe_user -d recipe_db -h localhost
```

#### メトリクスが保存されない

```bash
# テーブル確認
psql -U recipe_user -d recipe_db -h localhost -c "\dt"

# 手動INSERT テスト
psql -U recipe_user -d recipe_db -h localhost << EOF
INSERT INTO system_metrics (metric_name, metric_value, labels)
VALUES ('test_metric', 42.0, '{"test": true}');

SELECT * FROM system_metrics WHERE metric_name = 'test_metric';
EOF

# 成功したら、PM2ログ確認
pm2 logs recipe-monitoring-collector --err
```

### パフォーマンス問題

#### メトリクスが遅い

```bash
# インデックス確認
psql -U recipe_user -d recipe_db -h localhost << EOF
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE tablename LIKE '%metrics%';
EOF

# マテリアライズドビュー更新
psql -U recipe_user -d recipe_db -h localhost -c \
  "REFRESH MATERIALIZED VIEW CONCURRENTLY metrics_last_24h;"

# VACUUM ANALYZE実行
psql -U recipe_user -d recipe_db -h localhost -c "VACUUM ANALYZE;"
```

---

## ベストプラクティス

### 定期メンテナンス

#### 日次クリーンアップ（Cron設定）

```bash
# Cron編集
crontab -e

# 以下を追加（毎日午前3時にクリーンアップ）
0 3 * * * psql -U recipe_user -d recipe_db -h localhost -c "SELECT * FROM cleanup_old_metrics(30);" >> /var/log/monitoring-cleanup.log 2>&1
```

#### 週次VACUUM

```bash
# Cron追加（毎週日曜午前4時）
0 4 * * 0 psql -U recipe_user -d recipe_db -h localhost -c "VACUUM ANALYZE;" >> /var/log/monitoring-vacuum.log 2>&1
```

### バックアップ

#### 自動バックアップ設定

```bash
# バックアップスクリプト作成
cat > /usr/local/bin/backup-monitoring-db.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/mnt/Linux-ExHDD/PersonalCookingRecipe/backups/monitoring"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

pg_dump -U recipe_user -h localhost recipe_db \
  | gzip > $BACKUP_DIR/monitoring_db_$DATE.sql.gz

# 7日以上前のバックアップ削除
find $BACKUP_DIR -name "monitoring_db_*.sql.gz" -mtime +7 -delete

echo "バックアップ完了: monitoring_db_$DATE.sql.gz"
EOF

chmod +x /usr/local/bin/backup-monitoring-db.sh

# Cron設定（毎日午前2時）
crontab -e
# 追加:
0 2 * * * /usr/local/bin/backup-monitoring-db.sh >> /var/log/monitoring-backup.log 2>&1
```

#### リストア方法

```bash
# バックアップからリストア
gunzip < /path/to/monitoring_db_20251121_020000.sql.gz | \
  psql -U recipe_user -h localhost -d recipe_db
```

---

## セキュリティ考慮事項

### 1. パスワード管理

```bash
# 強力なパスワード生成
openssl rand -base64 32

# パスワードファイル作成（推奨）
cat > ~/.pgpass << EOF
localhost:5432:recipe_db:recipe_user:your_secure_password_here
EOF

chmod 600 ~/.pgpass
```

### 2. SSL接続（推奨）

```bash
# PostgreSQL SSL設定
sudo nano /etc/postgresql/16/main/postgresql.conf

# 以下を有効化
ssl = on
ssl_cert_file = '/etc/ssl/certs/ssl-cert-snakeoil.pem'
ssl_key_file = '/etc/ssl/private/ssl-cert-snakeoil.key'

# pg_hba.conf でSSL必須化
sudo nano /etc/postgresql/16/main/pg_hba.conf

# hostssl を使用
hostssl recipe_db recipe_user 127.0.0.1/32 md5

# PostgreSQL再起動
sudo systemctl restart postgresql
```

### 3. ファイアウォール設定

```bash
# ローカルのみ許可（デフォルトで推奨）
sudo ufw allow from 127.0.0.1 to any port 5432

# 特定IPからのみ許可する場合
sudo ufw allow from 192.168.1.0/24 to any port 5432
```

---

## まとめ

### 移行チェックリスト

- [ ] PostgreSQL設定変更（postgresql.conf, pg_hba.conf）
- [ ] PostgreSQL再起動
- [ ] recipe_userユーザー作成
- [ ] recipe_dbデータベース作成
- [ ] テーブル・ビュー・関数作成
- [ ] 接続テスト
- [ ] ecosystem.config.js設定変更
- [ ] PM2再起動
- [ ] メトリクス収集確認
- [ ] パフォーマンス確認
- [ ] バックアップ設定
- [ ] 定期メンテナンス設定

### ロールバック方法

PostgreSQLに問題がある場合、SQLiteに戻す:

```bash
# ecosystem.config.js 編集
nano /mnt/Linux-ExHDD/PersonalCookingRecipe/ecosystem.config.js

# MONITORING_DB を sqlite に戻す
env: {
  MONITORING_DB: 'sqlite',
  SQLITE_DB_PATH: '/mnt/Linux-ExHDD/PersonalCookingRecipe/backend/data/monitoring.db',
  ...
}

# PM2再起動
pm2 restart recipe-monitoring-collector
```

---

## 参考資料

- [PostgreSQL公式ドキュメント](https://www.postgresql.org/docs/)
- [SQLiteからPostgreSQLへの移行ガイド](https://wiki.postgresql.org/wiki/Converting_from_other_Databases_to_PostgreSQL#SQLite)
- [PM2ドキュメント](https://pm2.keymetrics.io/docs/)
- [backend/src/monitoring/migrations/001-create-metrics-tables.sql](backend/src/monitoring/migrations/001-create-metrics-tables.sql)

---

**作成者**: Claude (Anthropic)
**プロジェクト**: PersonalCookingRecipe
**最終更新**: 2025-11-21
