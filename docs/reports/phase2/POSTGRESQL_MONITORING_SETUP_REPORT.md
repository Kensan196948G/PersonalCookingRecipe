# PostgreSQL監視システム完全セットアップレポート

**プロジェクト**: PersonalCookingRecipe
**日付**: 2025-11-21
**バージョン**: 1.0.0
**環境**: Linux ネイティブ（Docker非依存）

---

## 目次

1. [概要](#概要)
2. [システムアーキテクチャ](#システムアーキテクチャ)
3. [セットアップ手順](#セットアップ手順)
4. [データベーススキーマ](#データベーススキーマ)
5. [監視メトリクス](#監視メトリクス)
6. [ダッシュボード](#ダッシュボード)
7. [運用ガイド](#運用ガイド)
8. [トラブルシューティング](#トラブルシューティング)
9. [パフォーマンス最適化](#パフォーマンス最適化)

---

## 概要

PersonalCookingRecipeプロジェクトのネイティブ監視システムは、Docker非依存で動作する高性能な監視基盤です。PostgreSQLをメトリクスストレージとして使用し、Redisでリアルタイムキャッシングを行います。

### 主要機能

- **システムメトリクス収集**: CPU、メモリ、ディスク、ネットワーク
- **アプリケーションメトリクス**: HTTPリクエスト、レスポンスタイム、エラー率
- **ビジネスメトリクス**: ユーザー登録、レシピ作成、検索実行
- **アラート管理**: しきい値ベースのアラート自動発火
- **リアルタイムダッシュボード**: Socket.io + Chart.js
- **長期データ保持**: PostgreSQL（デフォルト30日間）
- **高速クエリ**: マテリアライズドビュー、インデックス最適化

### 技術スタック

| コンポーネント | 技術 | バージョン |
|--------------|------|----------|
| データベース | PostgreSQL | 14+ |
| キャッシュ | Redis | 6+ |
| バックエンド | Node.js | 18+ |
| プロセス管理 | PM2 | 5+ |
| 可視化 | Chart.js | 4.4+ |
| リアルタイム通信 | Socket.io | 4.7+ |

---

## システムアーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    PersonalCookingRecipe                    │
│                     監視システム全体図                         │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  Express Server  │ ← HTTPリクエスト
│   (Port 5000)    │
└────────┬─────────┘
         │
         ├─ ApplicationMetrics (ミドルウェア)
         │   ├─ リクエスト数カウント
         │   ├─ レスポンスタイム計測
         │   └─ エラー率追跡
         │
         ├─ BusinessMetrics
         │   ├─ ユーザー登録
         │   ├─ レシピ作成
         │   └─ 検索実行
         │
         └─ MonitoringIntegration
             └─ Prometheus互換エンドポイント (/metrics)

┌──────────────────┐
│ MetricsCollector │ ← Cronジョブ（独立プロセス）
│    (PM2管理)     │
└────────┬─────────┘
         │
         ├─ NativeMonitoring (システムメトリクス)
         │   ├─ CPU使用率
         │   ├─ メモリ使用率
         │   ├─ ディスク使用率
         │   └─ ネットワークトラフィック
         │
         ├─ NativeAlertManager
         │   ├─ しきい値監視
         │   ├─ アラート発火
         │   └─ アラート履歴保存
         │
         └─ スケジューラー
             ├─ 1分毎: メトリクス収集
             ├─ 5分毎: PostgreSQL保存
             ├─ 1時間毎: 集約処理
             └─ 毎日3時: クリーンアップ

┌──────────────────┐      ┌──────────────────┐
│   PostgreSQL     │      │      Redis       │
│  (Port 5432)     │      │   (Port 6379)    │
└────────┬─────────┘      └────────┬─────────┘
         │                         │
         ├─ system_metrics         ├─ metrics:current
         ├─ metrics_raw            ├─ metrics:hourly
         ├─ metrics_hourly         └─ alerts:active
         ├─ daily_summaries
         ├─ alert_history
         │
         ├─ ビュー:
         │  ├─ latest_metrics
         │  ├─ active_alerts
         │  └─ metrics_last_24h (マテリアライズド)
         │
         └─ 関数:
            ├─ cleanup_old_metrics()
            ├─ get_metric_stats()
            └─ refresh_metrics_views()

┌──────────────────┐
│    Dashboard     │ ← WebUI (Port 5001)
│   (Socket.io)    │
└────────┬─────────┘
         │
         ├─ リアルタイムグラフ (Chart.js)
         ├─ アラート一覧
         ├─ システム概要
         └─ メトリクス履歴
```

---

## セットアップ手順

### 前提条件

1. **PostgreSQL 14以上** がインストールされている
2. **Redis 6以上** がインストールされている
3. **Node.js 18以上** がインストールされている
4. **PM2** がグローバルインストールされている

```bash
# PM2インストール（未インストールの場合）
npm install -g pm2
```

### ステップ1: PostgreSQL起動確認

```bash
# PostgreSQLサービス状態確認
sudo systemctl status postgresql

# 起動していない場合
sudo systemctl start postgresql

# 接続テスト
pg_isready -h localhost -p 5432
```

### ステップ2: データベースとユーザー作成

```bash
# PostgreSQLに接続（postgres ユーザーとして）
sudo -u postgres psql

-- データベース作成
CREATE DATABASE recipe_db;

-- ユーザー作成
CREATE USER recipe_user WITH PASSWORD 'your_secure_password';

-- 権限付与
GRANT ALL PRIVILEGES ON DATABASE recipe_db TO recipe_user;

-- 終了
\q
```

### ステップ3: セットアップスクリプト実行

```bash
# プロジェクトルートへ移動
cd /mnt/Linux-ExHDD/PersonalCookingRecipe

# セットアップスクリプト実行
./backend/scripts/setup-postgresql-monitoring.sh
```

**実行内容**:
1. PostgreSQL接続確認
2. 認証情報確認（パスワード入力）
3. マイグレーションファイル実行
4. テーブル・ビュー・関数の作成確認
5. Redis接続確認
6. Node.js依存パッケージインストール
7. ログディレクトリ作成
8. `.env` ファイル作成

### ステップ4: 動作確認テスト実行

```bash
# テストスクリプト実行
cd backend
node src/monitoring/test-monitoring.js
```

**テスト項目** (15項目):
1. PostgreSQL接続テスト
2. Redis接続テスト
3. テーブル存在確認
4. ビュー存在確認
5. メトリクス書き込みテスト
6. メトリクス読み込みテスト
7. `latest_metrics` ビューテスト
8. アラート履歴書き込みテスト
9. アラート履歴読み込みテスト
10. `active_alerts` ビューテスト
11. 統計関数テスト
12. Redis書き込みテスト
13. Redis読み込みテスト
14. マテリアライズドビュー更新テスト
15. テストデータクリーンアップ

### ステップ5: PM2で監視システム起動

```bash
# 全プロセス起動
pm2 start ecosystem.config.js

# または、監視システムのみ起動
pm2 start ecosystem.config.js --only recipe-monitoring-collector
pm2 start ecosystem.config.js --only recipe-monitoring-dashboard

# プロセス確認
pm2 status

# ログ確認
pm2 logs recipe-monitoring-collector
```

### ステップ6: ダッシュボードアクセス確認

ブラウザで以下にアクセス:

```
http://localhost:5001/
```

---

## データベーススキーマ

### テーブル一覧

#### 1. system_metrics

システムメトリクスの時系列データ保存

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | BIGSERIAL | プライマリキー |
| timestamp | TIMESTAMPTZ | メトリクス取得時刻 |
| metric_name | VARCHAR(100) | メトリクス名 (cpu_usage, memory_usage等) |
| metric_value | NUMERIC | メトリクス値 |
| labels | JSONB | ラベル (JSON形式) |
| created_at | TIMESTAMPTZ | レコード作成時刻 |

**インデックス**:
- `idx_system_metrics_timestamp` (timestamp DESC)
- `idx_system_metrics_name` (metric_name)
- `idx_system_metrics_name_timestamp` (metric_name, timestamp DESC)
- `idx_system_metrics_labels` (labels GIN)

**サンプルクエリ**:
```sql
-- 直近1時間のCPU使用率
SELECT timestamp, metric_value
FROM system_metrics
WHERE metric_name = 'cpu_usage'
  AND timestamp >= NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;

-- 平均・最小・最大
SELECT
    AVG(metric_value) as avg_cpu,
    MIN(metric_value) as min_cpu,
    MAX(metric_value) as max_cpu
FROM system_metrics
WHERE metric_name = 'cpu_usage'
  AND timestamp >= NOW() - INTERVAL '24 hours';
```

#### 2. metrics_raw

生メトリクスデータ (JSON形式)

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | BIGSERIAL | プライマリキー |
| timestamp | TIMESTAMPTZ | 取得時刻 |
| metric_type | VARCHAR(50) | タイプ (system, application, business) |
| data | JSONB | メトリクスデータ (JSON) |
| created_at | TIMESTAMPTZ | レコード作成時刻 |

#### 3. metrics_hourly

時間別集約メトリクス

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | BIGSERIAL | プライマリキー |
| hour | TIMESTAMPTZ | 集約時間 (1時間単位) |
| metric_name | VARCHAR(100) | メトリクス名 |
| avg_value | NUMERIC | 平均値 |
| min_value | NUMERIC | 最小値 |
| max_value | NUMERIC | 最大値 |
| count | INTEGER | データポイント数 |
| created_at | TIMESTAMPTZ | レコード作成時刻 |

**UNIQUE制約**: (hour, metric_name)

#### 4. daily_summaries

日次サマリー

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | BIGSERIAL | プライマリキー |
| date | DATE | 日付 (UNIQUE) |
| summary_data | JSONB | サマリーデータ (JSON) |
| created_at | TIMESTAMPTZ | レコード作成時刻 |
| updated_at | TIMESTAMPTZ | レコード更新時刻 |

#### 5. alert_history

アラート履歴

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | BIGSERIAL | プライマリキー |
| timestamp | TIMESTAMPTZ | アラート発火時刻 |
| rule_name | VARCHAR(100) | ルール名 |
| severity | VARCHAR(20) | 重大度 (critical, warning, info) |
| category | VARCHAR(50) | カテゴリ |
| message | TEXT | メッセージ |
| metrics_snapshot | JSONB | メトリクススナップショット |
| resolved | BOOLEAN | 解決済みフラグ |
| resolved_at | TIMESTAMPTZ | 解決時刻 |
| created_at | TIMESTAMPTZ | レコード作成時刻 |

**サンプルクエリ**:
```sql
-- 未解決アラート一覧
SELECT rule_name, severity, message, timestamp
FROM alert_history
WHERE resolved = FALSE
ORDER BY timestamp DESC;

-- 過去24時間のアラート統計
SELECT
    severity,
    COUNT(*) as count
FROM alert_history
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY severity;
```

### ビュー一覧

#### 1. latest_metrics (View)

各メトリクスの最新値

```sql
SELECT metric_name, metric_value, labels, timestamp
FROM latest_metrics
ORDER BY metric_name;
```

#### 2. active_alerts (View)

未解決アラート一覧

```sql
SELECT rule_name, severity, message, age_seconds
FROM active_alerts
ORDER BY timestamp DESC;
```

#### 3. metrics_last_24h (Materialized View)

直近24時間のメトリクス統計

```sql
SELECT metric_name, avg_value, p50, p95, p99
FROM metrics_last_24h
ORDER BY metric_name;

-- 更新
SELECT refresh_metrics_views();
```

### 関数一覧

#### 1. cleanup_old_metrics(retention_days)

古いメトリクスデータ削除

```sql
-- 30日以上前のデータを削除
SELECT * FROM cleanup_old_metrics(30);
```

#### 2. get_metric_stats(metric_name, hours)

指定メトリクスの統計情報取得

```sql
-- CPU使用率の過去24時間統計
SELECT * FROM get_metric_stats('cpu_usage', 24);
```

#### 3. refresh_metrics_views()

マテリアライズドビュー更新

```sql
SELECT refresh_metrics_views();
```

---

## 監視メトリクス

### システムメトリクス

| メトリクス名 | 説明 | 単位 | 収集間隔 |
|------------|------|------|---------|
| cpu_usage | CPU使用率 | % | 10秒 |
| memory_usage | メモリ使用率 | % | 10秒 |
| disk_usage | ディスク使用率 | % | 10秒 |
| network_rx | ネットワーク受信バイト | bytes | 10秒 |
| network_tx | ネットワーク送信バイト | bytes | 10秒 |
| load_average_1m | ロードアベレージ (1分) | - | 10秒 |
| load_average_5m | ロードアベレージ (5分) | - | 10秒 |
| load_average_15m | ロードアベレージ (15分) | - | 10秒 |

### アプリケーションメトリクス

| メトリクス名 | 説明 | 単位 | 収集間隔 |
|------------|------|------|---------|
| http_requests_total | HTTPリクエスト総数 | count | リアルタイム |
| http_request_duration_seconds | リクエスト処理時間 | seconds | リアルタイム |
| http_error_rate | HTTPエラー率 | % | 5秒 |
| response_time_p50 | レスポンスタイム中央値 | ms | 5秒 |
| response_time_p95 | レスポンスタイム95パーセンタイル | ms | 5秒 |
| response_time_p99 | レスポンスタイム99パーセンタイル | ms | 5秒 |
| active_connections | アクティブ接続数 | count | 5秒 |

### ビジネスメトリクス

| メトリクス名 | 説明 | 単位 | 収集間隔 |
|------------|------|------|---------|
| user_registrations_daily | 日次ユーザー登録数 | count | 1分 |
| recipes_created_daily | 日次レシピ作成数 | count | 1分 |
| search_executions_daily | 日次検索実行数 | count | 1分 |
| recipe_views_daily | 日次レシピ閲覧数 | count | 1分 |
| recipe_ratings_daily | 日次レシピ評価数 | count | 1分 |

### アラートルール

| ルール名 | 条件 | 重大度 | アクション |
|---------|------|--------|----------|
| HighCPU | CPU使用率 > 80% (5分間継続) | warning | ログ記録 |
| CriticalCPU | CPU使用率 > 95% (1分間継続) | critical | 即座に通知 |
| HighMemory | メモリ使用率 > 85% | warning | ログ記録 |
| CriticalMemory | メモリ使用率 > 95% | critical | 即座に通知 |
| HighDisk | ディスク使用率 > 90% | warning | ログ記録 |
| CriticalDisk | ディスク使用率 > 95% | critical | 即座に通知 |
| HighErrorRate | エラー率 > 5% (5分間) | warning | ログ記録 |
| CriticalErrorRate | エラー率 > 10% (1分間) | critical | 即座に通知 |
| SlowResponse | P95レスポンスタイム > 1000ms | warning | ログ記録 |
| DatabaseConnectionLost | DB接続エラー | critical | 即座に通知 |
| RedisConnectionLost | Redis接続エラー | warning | ログ記録 |

---

## ダッシュボード

### アクセス方法

```
http://localhost:5001/
```

### ダッシュボード構成

#### 1. システム概要パネル

- **現在時刻**
- **システム稼働時間**
- **CPU使用率** (リアルタイムグラフ)
- **メモリ使用率** (リアルタイムグラフ)
- **ディスク使用率** (プログレスバー)
- **ロードアベレージ** (1分/5分/15分)

#### 2. アプリケーションメトリクスパネル

- **リクエスト数** (過去1時間の推移)
- **エラー率** (折れ線グラフ)
- **レスポンスタイム分布** (ヒストグラム)
- **P50/P95/P99** (折れ線グラフ)
- **アクティブ接続数**

#### 3. ビジネスメトリクスパネル

- **今日のユーザー登録数**
- **今日のレシピ作成数**
- **今日の検索実行数**
- **週間トレンドグラフ**

#### 4. アラートパネル

- **アクティブアラート一覧** (リアルタイム更新)
  - 重大度別色分け (Critical: 赤, Warning: 黄色, Info: 青)
  - 発火時刻
  - 経過時間
  - メッセージ
- **過去24時間のアラート統計** (円グラフ)

#### 5. データベースパネル

- **PostgreSQL接続プール状態**
  - アイドル接続数
  - アクティブ接続数
  - 待機中クエリ数
- **Redis接続状態**
- **クエリパフォーマンス** (直近のスロークエリ)

### リアルタイム更新

**Socket.io** を使用してサーバーからクライアントへメトリクスをプッシュ:

- **更新間隔**: 2秒
- **イベント**:
  - `metrics:system` - システムメトリクス
  - `metrics:application` - アプリケーションメトリクス
  - `metrics:business` - ビジネスメトリクス
  - `alert:new` - 新規アラート
  - `alert:resolved` - アラート解決

---

## 運用ガイド

### 日常運用

#### PM2コマンド

```bash
# 全プロセス状態確認
pm2 status

# 監視コレクター状態確認
pm2 describe recipe-monitoring-collector

# ログ確認（リアルタイム）
pm2 logs recipe-monitoring-collector

# ログ確認（過去ログ）
pm2 logs recipe-monitoring-collector --lines 100

# プロセス再起動
pm2 restart recipe-monitoring-collector

# プロセス停止
pm2 stop recipe-monitoring-collector

# プロセス削除
pm2 delete recipe-monitoring-collector
```

#### PostgreSQLクエリ

```sql
-- 最新メトリクス確認
SELECT * FROM latest_metrics ORDER BY metric_name;

-- アクティブアラート確認
SELECT * FROM active_alerts ORDER BY timestamp DESC;

-- 過去24時間のCPU使用率統計
SELECT * FROM get_metric_stats('cpu_usage', 24);

-- マテリアライズドビュー更新
SELECT refresh_metrics_views();

-- 古いデータクリーンアップ（30日以上前）
SELECT * FROM cleanup_old_metrics(30);
```

#### Redisコマンド

```bash
# Redis接続
redis-cli -h localhost -p 6379

# 監視システムのキー一覧
KEYS metrics:*

# 現在のメトリクス確認
GET metrics:system:current

# キャッシュクリア
FLUSHDB
```

### 定期メンテナンス

#### 週次

```bash
# ログローテーション確認
ls -lh /mnt/Linux-ExHDD/PersonalCookingRecipe/logs/

# ディスク使用量確認
df -h

# PostgreSQLバキューム
psql -U recipe_user -d recipe_db -c "VACUUM ANALYZE;"
```

#### 月次

```sql
-- データベースサイズ確認
SELECT
    pg_size_pretty(pg_database_size('recipe_db')) as db_size;

-- テーブルサイズ確認
SELECT
    table_name,
    pg_size_pretty(pg_total_relation_size(quote_ident(table_name)::regclass)) as size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(quote_ident(table_name)::regclass) DESC;

-- 古いデータクリーンアップ
SELECT * FROM cleanup_old_metrics(30);

-- マテリアライズドビュー再構築
REFRESH MATERIALIZED VIEW CONCURRENTLY metrics_last_24h;
```

### バックアップ

#### PostgreSQLバックアップ

```bash
# 監視データベース全体バックアップ
pg_dump -U recipe_user -d recipe_db -F c -f backup_$(date +%Y%m%d).dump

# 復元
pg_restore -U recipe_user -d recipe_db -c backup_20251121.dump
```

#### Redisバックアップ

```bash
# RDBスナップショット作成
redis-cli BGSAVE

# スナップショットコピー
cp /var/lib/redis/dump.rdb /path/to/backup/dump_$(date +%Y%m%d).rdb
```

---

## トラブルシューティング

### 問題1: PostgreSQL接続エラー

**症状**:
```
PostgreSQL接続エラー: connection refused
```

**原因**:
- PostgreSQLサービスが起動していない
- `pg_hba.conf` の認証設定が不正

**解決方法**:

```bash
# PostgreSQL起動確認
sudo systemctl status postgresql

# 起動
sudo systemctl start postgresql

# pg_hba.conf 確認
sudo cat /etc/postgresql/14/main/pg_hba.conf

# 以下を追加（必要に応じて）
# host    recipe_db    recipe_user    127.0.0.1/32    md5
```

### 問題2: Redis接続エラー

**症状**:
```
Redis接続エラー: ECONNREFUSED
```

**解決方法**:

```bash
# Redis起動確認
sudo systemctl status redis-server

# 起動
sudo systemctl start redis-server

# 接続テスト
redis-cli ping
```

### 問題3: メトリクスが保存されない

**症状**:
```
SELECT * FROM latest_metrics;
(0 rows)
```

**診断**:

```bash
# PM2プロセス確認
pm2 status recipe-monitoring-collector

# ログ確認
pm2 logs recipe-monitoring-collector --lines 50
```

**解決方法**:

```bash
# プロセス再起動
pm2 restart recipe-monitoring-collector

# マイグレーション再実行
psql -U recipe_user -d recipe_db -f backend/src/monitoring/migrations/001-create-metrics-tables.sql
```

### 問題4: ダッシュボードにアクセスできない

**症状**:
```
http://localhost:5001/ が開けない
```

**解決方法**:

```bash
# ダッシュボードプロセス確認
pm2 status recipe-monitoring-dashboard

# ポート使用確認
sudo netstat -tuln | grep 5001

# プロセス起動
pm2 start ecosystem.config.js --only recipe-monitoring-dashboard
```

### 問題5: ディスク容量不足

**症状**:
```
ERROR: could not extend file "base/16384/16389": No space left on device
```

**解決方法**:

```sql
-- 古いデータを大量削除
SELECT * FROM cleanup_old_metrics(7);  -- 7日以上前のデータ削除

-- 不要なログ削除
```

```bash
# ログファイル削除
cd /mnt/Linux-ExHDD/PersonalCookingRecipe/logs
rm -f *.log.old

# PostgreSQL VACUUM FULL
psql -U recipe_user -d recipe_db -c "VACUUM FULL;"
```

---

## パフォーマンス最適化

### PostgreSQL最適化

#### 1. インデックスチューニング

```sql
-- インデックス使用状況確認
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan;

-- 未使用インデックス削除（慎重に）
-- DROP INDEX IF EXISTS idx_name;
```

#### 2. クエリパフォーマンス分析

```sql
-- スロークエリ確認
SELECT
    query,
    mean_exec_time,
    calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

#### 3. 接続プール最適化

`backend/src/config/database-postgresql.js`:

```javascript
max: 50,  // 最大接続数（負荷に応じて調整）
min: 10,  // 最小接続数
idleTimeoutMillis: 30000  // アイドルタイムアウト
```

### Redis最適化

#### 1. メモリ使用量確認

```bash
redis-cli INFO memory
```

#### 2. キャッシュTTL調整

```javascript
// MetricsCollector.js
await this.saveToRedis('integrated:current', metrics, 300);  // TTL: 5分
```

### メトリクス収集間隔調整

`backend/src/monitoring/MetricsCollector.js`:

```javascript
systemMetricsInterval: 10000,      // 10秒 → 20秒に変更してCPU負荷軽減
applicationMetricsInterval: 5000,  // 5秒 → 10秒に変更
businessMetricsInterval: 60000     // 1分 → 5分に変更
```

### パーティショニング（大規模環境）

```sql
-- system_metrics を月別パーティション化
CREATE TABLE system_metrics_2025_11 PARTITION OF system_metrics
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE system_metrics_2025_12 PARTITION OF system_metrics
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
```

---

## セキュリティ

### 認証情報管理

**`.env` ファイル** (機密情報):

```bash
# .gitignore に追加
echo ".env" >> .gitignore

# パーミッション設定
chmod 600 backend/.env
```

### PostgreSQL接続暗号化

```javascript
// database-postgresql.js
ssl: {
    rejectUnauthorized: false  // 開発環境
    // rejectUnauthorized: true,  // 本番環境
    // ca: fs.readFileSync('/path/to/ca-cert.pem')
}
```

### Redis認証

```bash
# redis.conf
requirepass your_strong_password
```

```javascript
// .env
REDIS_PASSWORD=your_strong_password
```

---

## まとめ

### セットアップ完了チェックリスト

- [ ] PostgreSQL起動確認
- [ ] データベース `recipe_db` 作成
- [ ] ユーザー `recipe_user` 作成・権限付与
- [ ] マイグレーション実行
- [ ] テーブル・ビュー・関数作成確認
- [ ] Redis起動確認
- [ ] Node.js依存パッケージインストール
- [ ] `.env` ファイル作成
- [ ] テストスクリプト実行・全テスト成功
- [ ] PM2プロセス起動
- [ ] ダッシュボードアクセス確認

### 次のステップ

1. **カスタマイズ**:
   - アラートルールの調整
   - メトリクス収集間隔の最適化
   - ダッシュボードのカスタマイズ

2. **拡張**:
   - Grafana統合（高度な可視化）
   - Prometheus Alertmanager統合（アラート通知）
   - Slack/Discord通知統合

3. **本番環境対応**:
   - SSL/TLS有効化
   - 認証・認可の追加
   - バックアップ自動化

---

## 参考リソース

### ドキュメント

- [PostgreSQL公式ドキュメント](https://www.postgresql.org/docs/)
- [Redis公式ドキュメント](https://redis.io/docs/)
- [PM2公式ドキュメント](https://pm2.keymetrics.io/docs/)
- [Chart.js公式ドキュメント](https://www.chartjs.org/docs/)
- [Socket.io公式ドキュメント](https://socket.io/docs/)

### プロジェクトファイル

- **マイグレーション**: `backend/src/monitoring/migrations/001-create-metrics-tables.sql`
- **セットアップスクリプト**: `backend/scripts/setup-postgresql-monitoring.sh`
- **テストスクリプト**: `backend/src/monitoring/test-monitoring.js`
- **PM2設定**: `ecosystem.config.js`
- **監視システム**: `backend/src/monitoring/`

### サポート

問題が発生した場合:

1. ログを確認: `pm2 logs recipe-monitoring-collector`
2. テストスクリプト実行: `node backend/src/monitoring/test-monitoring.js`
3. PostgreSQLログ確認: `/var/log/postgresql/postgresql-14-main.log`

---

**作成日**: 2025-11-21
**バージョン**: 1.0.0
**作成者**: Claude Code (Backend API Developer Agent)
