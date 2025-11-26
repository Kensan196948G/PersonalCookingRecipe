# PersonalCookingRecipe - ネイティブ監視システム実装レポート

**プロジェクト**: PersonalCookingRecipe
**実装日**: 2025-11-21
**バージョン**: v1.0.0
**システムアーキテクト**: Claude Code (Sonnet 4.5)

---

## 目次

1. [エグゼクティブサマリー](#1-エグゼクティブサマリー)
2. [システムアーキテクチャ](#2-システムアーキテクチャ)
3. [実装されたコンポーネント](#3-実装されたコンポーネント)
4. [メトリクス一覧](#4-メトリクス一覧)
5. [Webダッシュボード](#5-webダッシュボード)
6. [PM2統合](#6-pm2統合)
7. [運用開始ガイド](#7-運用開始ガイド)
8. [Prometheus API互換性](#8-prometheus-api互換性)
9. [トラブルシューティング](#9-トラブルシューティング)
10. [今後の拡張](#10-今後の拡張)

---

## 1. エグゼクティブサマリー

### 実装概要

PersonalCookingRecipeプロジェクトにDocker非依存のネイティブ監視システムを実装しました。本システムは、Linux環境でNode.js/Python/PostgreSQL/Redisのネイティブ監視を実現し、リアルタイムメトリクス収集、アラート管理、Webダッシュボード可視化を提供します。

### 主要成果

- **Docker非依存**: 全てNode.jsネイティブ実装（systeminformation, prom-client, winston）
- **包括的監視**: システム、アプリケーション、ビジネスの3層メトリクス
- **リアルタイムアラート**: Email/Slack/Discord統合
- **Webダッシュボード**: Express + EJS + Chart.js + Socket.io
- **データ永続化**: PostgreSQL（30日間履歴）+ Redis（リアルタイム）
- **PM2統合**: プロセス監視・自動再起動・Cron統合

### 技術スタック

```
監視層:
├─ systeminformation v5.x  - システムメトリクス
├─ prom-client v15.x       - Prometheusメトリクス
├─ winston v3.x            - ログ管理
├─ node-cron v3.x          - スケジューリング
└─ nodemailer v7.x         - Email通知

可視化層:
├─ Express v4.x            - Webサーバー
├─ EJS v3.x                - テンプレートエンジン
├─ Chart.js v4.x           - グラフ描画
└─ Socket.io v4.x          - リアルタイム通信

データ層:
├─ PostgreSQL v14+         - メトリクス履歴
├─ Redis v7.x              - リアルタイムキャッシュ
└─ ioredis v5.x            - Redisクライアント

管理層:
└─ PM2 v5.x                - プロセス管理
```

---

## 2. システムアーキテクチャ

### アーキテクチャ図

```
┌──────────────────────────────────────────────────────────────┐
│                     PersonalCookingRecipe                     │
│              ネイティブ監視システムアーキテクチャ               │
└──────────────────────────────────────────────────────────────┘

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  NativeMonitoring│  │ApplicationMetrics│  │ BusinessMetrics │
│                 │  │                 │  │                 │
│  - CPU使用率    │  │  - HTTPリクエスト │  │  - ユーザー登録  │
│  - メモリ使用率  │  │  - レスポンス時間 │  │  - レシピ作成   │
│  - ディスクI/O  │  │  - エラー率      │  │  - 検索実行     │
│  - ネットワーク  │  │  - DB/Redisメトリ│  │  - アクティビティ│
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  MetricsCollector  │
                    │  (統合コレクター)   │
                    │                   │
                    │  - 定期収集       │
                    │  - データ集約     │
                    │  - アラート管理   │
                    └─────────┬─────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
   ┌─────▼─────┐      ┌──────▼──────┐     ┌──────▼──────┐
   │ PostgreSQL │      │    Redis    │     │NativeAlert  │
   │            │      │             │     │  Manager    │
   │ 履歴保存   │      │ リアルタイム │     │             │
   │ 30日間     │      │ キャッシュ   │     │ - Console   │
   │            │      │             │     │ - File      │
   └───────────┘      └─────────────┘     │ - Email     │
                                           │ - Slack     │
                                           │ - Discord   │
                                           └─────┬───────┘
                                                 │
                              ┌──────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Webダッシュボード  │
                    │                   │
                    │  Express + EJS    │
                    │  Chart.js         │
                    │  Socket.io        │
                    │                   │
                    │  http://localhost:5000/monitoring/dashboard
                    └───────────────────┘
```

### データフロー

```
1. メトリクス収集
   NativeMonitoring (10秒毎)
        └─> システムメトリクス収集
        └─> EventEmitter で発行

2. アプリケーションメトリクス
   ApplicationMetrics (Expressミドルウェア)
        └─> HTTPリクエスト毎に記録
        └─> DB/Redisクエリ毎に記録

3. ビジネスメトリクス
   BusinessMetrics (イベント駆動)
        └─> ユーザー登録時に記録
        └─> レシピ作成時に記録
        └─> 検索実行時に記録

4. データ保存
   MetricsCollector
        ├─> PostgreSQL (5分毎に集約保存)
        └─> Redis (リアルタイム保存, TTL: 5分)

5. アラート処理
   NativeAlertManager
        ├─> 閾値チェック
        ├─> 重複抑制 (5分間)
        └─> 複数チャンネル通知

6. 可視化
   Webダッシュボード
        ├─> APIエンドポイント (/api/metrics/current)
        └─> リアルタイム更新 (5秒毎)
```

---

## 3. 実装されたコンポーネント

### 3.1 NativeMonitoring.js

**場所**: `/backend/src/monitoring/NativeMonitoring.js`

**機能**:
- systeminformationライブラリを使用したシステムメトリクス収集
- CPU, メモリ, ディスク, ネットワークの監視
- プロセスメトリクス収集
- 閾値ベースアラート

**主要メソッド**:
```javascript
- start()                    // 監視開始
- stop()                     // 監視停止
- collectMetrics()           // 全メトリクス収集
- getCurrentMetrics()        // 現在のメトリクス取得
- getMetricsHistory(limit)   // メトリクス履歴取得
- getSystemInfo()            // システム情報取得
```

**イベント**:
```javascript
- 'metrics'  // メトリクス収集完了時
- 'alert'    // アラート発生時
- 'error'    // エラー発生時
```

### 3.2 ApplicationMetrics.js

**場所**: `/backend/src/monitoring/ApplicationMetrics.js`

**機能**:
- HTTPリクエスト監視（Expressミドルウェア）
- レスポンス時間パーセンタイル計算 (P50, P95, P99)
- エラー率追跡
- データベースクエリ監視
- Redisヒット率監視

**主要メソッド**:
```javascript
- createHTTPMiddleware()              // Expressミドルウェア生成
- recordHTTPRequest(request)          // HTTPリクエスト記録
- recordDatabaseQuery(query)          // DBクエリ記録
- recordRedisOperation(operation)     // Redis操作記録
- calculateResponseTimePercentiles()  // パーセンタイル計算
- getCurrentMetrics()                 // 現在のメトリクス取得
```

### 3.3 BusinessMetrics.js

**場所**: `/backend/src/monitoring/BusinessMetrics.js`

**機能**:
- ユーザー登録数追跡
- レシピ作成数追跡
- 検索実行回数追跡
- ユーザーアクティビティ分析
- KPI計算

**主要メソッド**:
```javascript
- recordUserRegistration(data)   // ユーザー登録記録
- recordRecipeCreation(data)     // レシピ作成記録
- recordSearch(data)             // 検索実行記録
- recordActivity(data)           // アクティビティ記録
- getCurrentMetrics()            // 現在のメトリクス取得
```

### 3.4 NativeAlertManager.js

**場所**: `/backend/src/monitoring/NativeAlertManager.js`

**機能**:
- 複数チャンネル通知 (Console, File, Email, Slack, Discord)
- 25個のデフォルトアラートルール
- 重複抑制 (5分間)
- アラート履歴管理

**通知チャンネル**:
```javascript
- sendConsoleAlert()   // コンソール出力
- sendFileAlert()      // ファイルログ
- sendEmailAlert()     // Email通知 (nodemailer)
- sendSlackAlert()     // Slack Webhook
- sendDiscordAlert()   // Discord Webhook
```

**デフォルトアラートルール** (一部抜粋):
```javascript
1. HighCPUUsage (warning)           - CPU > 85%
2. CriticalCPUUsage (critical)      - CPU > 95%
3. HighMemoryUsage (warning)        - Memory > 90%
4. HighErrorRate (warning)          - Error Rate > 5%
5. SlowResponseTime (warning)       - P95 > 2秒
6. LowCacheHitRate (warning)        - Cache Hit < 80%
... (全25ルール)
```

### 3.5 MetricsCollector.js

**場所**: `/backend/src/monitoring/MetricsCollector.js`

**機能**:
- 全監視モジュールの統合管理
- 定期的なメトリクス収集 (Cron)
- PostgreSQL/Redisへのデータ保存
- アラート統合管理

**Cronスケジュール**:
```javascript
- 1分毎:   統合メトリクス収集
- 5分毎:   PostgreSQL保存
- 1時間毎: メトリクス集約
- 毎日3時:  古いデータ削除 (30日以上前)
```

### 3.6 Webダッシュボード

**場所**: `/backend/src/monitoring/dashboard/`

**構成**:
```
dashboard/
├── routes.js                      # Expressルート
├── services/
│   └── DashboardService.js        # データ集約サービス
├── views/
│   └── index.ejs                  # メインダッシュボード
└── public/
    ├── css/
    │   └── dashboard.css          # スタイルシート
    └── js/
        └── dashboard.js           # リアルタイム更新
```

**エンドポイント**:
```
GET  /monitoring/dashboard              - メインダッシュボード
GET  /monitoring/dashboard/system       - システムメトリクス詳細
GET  /monitoring/dashboard/application  - アプリケーションメトリクス詳細
GET  /monitoring/dashboard/business     - ビジネスメトリクス詳細
GET  /monitoring/dashboard/alerts       - アラート一覧

API:
GET  /monitoring/dashboard/api/metrics/current           - 現在のメトリクス
GET  /monitoring/dashboard/api/metrics/system/history    - システム履歴
GET  /monitoring/dashboard/api/alerts/history            - アラート履歴
GET  /monitoring/dashboard/api/stats                     - 統計情報
GET  /monitoring/dashboard/metrics                       - Prometheus形式
```

### 3.7 PostgreSQLスキーマ

**場所**: `/backend/src/monitoring/migrations/001-create-metrics-tables.sql`

**テーブル**:
```sql
1. system_metrics       - システムメトリクス履歴
2. metrics_raw          - 生メトリクスデータ (JSON)
3. metrics_hourly       - 時間別集約メトリクス
4. daily_summaries      - 日次サマリー
5. alert_history        - アラート履歴
```

**ビュー**:
```sql
1. metrics_last_24h (マテリアライズド) - 直近24時間統計
2. latest_metrics                      - 各メトリクスの最新値
3. active_alerts                       - 未解決アラート
```

**便利な関数**:
```sql
1. cleanup_old_metrics(retention_days)        - 古いデータ削除
2. get_metric_stats(metric_name, hours)       - メトリクス統計取得
3. refresh_metrics_views()                    - マテリアライズドビュー更新
```

---

## 4. メトリクス一覧

### 4.1 システムメトリクス

| メトリクス名 | 説明 | 単位 | 閾値 | 収集間隔 |
|------------|------|------|------|---------|
| cpu_usage | CPU使用率 | % | 85% (warning), 95% (critical) | 10秒 |
| cpu_usage_per_core | コア別CPU使用率 | % | - | 10秒 |
| cpu_temperature | CPU温度 | °C | - | 10秒 |
| memory_usage_percent | メモリ使用率 | % | 90% (warning), 95% (critical) | 10秒 |
| memory_used_bytes | メモリ使用量 | bytes | - | 10秒 |
| memory_total_bytes | メモリ総量 | bytes | - | 10秒 |
| swap_usage_percent | Swap使用率 | % | - | 10秒 |
| disk_usage_percent | ディスク使用率 | % | 85% (warning), 95% (critical) | 10秒 |
| disk_io_read_bytes | ディスクI/O読み込み | bytes/sec | - | 10秒 |
| disk_io_write_bytes | ディスクI/O書き込み | bytes/sec | - | 10秒 |
| network_bandwidth_usage | ネットワーク帯域使用率 | % | 80% (warning) | 10秒 |
| network_rx_speed_mbps | 受信速度 | Mbps | - | 10秒 |
| network_tx_speed_mbps | 送信速度 | Mbps | - | 10秒 |
| system_uptime | システム稼働時間 | seconds | - | 10秒 |

### 4.2 アプリケーションメトリクス

| メトリクス名 | 説明 | 単位 | 閾値 | 収集方法 |
|------------|------|------|------|---------|
| http_requests_total | HTTPリクエスト総数 | count | - | リクエスト毎 |
| http_request_duration_p50 | レスポンス時間 P50 | ms | - | 計算 |
| http_request_duration_p95 | レスポンス時間 P95 | ms | 2000ms (warning) | 計算 |
| http_request_duration_p99 | レスポンス時間 P99 | ms | - | 計算 |
| http_error_rate | APIエラー率 | % | 5% (warning), 10% (critical) | 計算 |
| http_active_connections | アクティブ接続数 | count | - | リアルタイム |
| http_throughput | スループット | req/sec | - | 計算 |
| database_queries_total | DBクエリ総数 | count | - | クエリ毎 |
| database_query_duration | DBクエリ時間 | ms | 1000ms (warning) | クエリ毎 |
| database_error_rate | DBエラー率 | % | 5% (warning) | 計算 |
| database_pool_active | DBプール使用中 | count | - | リアルタイム |
| database_pool_idle | DBプールアイドル | count | - | リアルタイム |
| database_pool_waiting | DBプール待機中 | count | 0 (critical) | リアルタイム |
| redis_operations_total | Redis操作総数 | count | - | 操作毎 |
| redis_operation_duration | Redis操作時間 | ms | - | 操作毎 |
| redis_hit_rate | キャッシュヒット率 | % | 80% (warning), 50% (critical) | 計算 |

### 4.3 ビジネスメトリクス

| メトリクス名 | 説明 | 単位 | 目標 | 収集方法 |
|------------|------|------|------|---------|
| user_registrations_total | ユーザー登録総数 | count | - | イベント |
| user_registrations_daily | 本日の登録数 | count | >5 | リセット毎日 |
| user_active_daily | DAU | count | - | リアルタイム |
| recipes_created_total | レシピ作成総数 | count | - | イベント |
| recipes_created_daily | 本日のレシピ作成 | count | - | リセット毎日 |
| recipes_published | 公開レシピ数 | count | - | 集計 |
| recipes_views_total | レシピ閲覧総数 | count | - | イベント |
| recipes_likes_total | いいね総数 | count | - | イベント |
| search_executions_total | 検索実行総数 | count | - | イベント |
| search_executions_daily | 本日の検索実行 | count | - | リセット毎日 |
| search_no_results_rate | 結果なし率 | % | <30% | 計算 |
| search_avg_result_count | 平均結果数 | count | - | 計算 |
| engagement_rate | エンゲージメント率 | % | - | 計算 |
| avg_recipes_per_user | ユーザー当たりレシピ数 | count | - | 計算 |

---

## 5. Webダッシュボード

### 5.1 ダッシュボード設計図

```
┌─────────────────────────────────────────────────────────────┐
│  PersonalCookingRecipe - Native Monitoring Dashboard        │
│                                                               │
│  Last Update: 2025-11-21 10:30:45  [System OK]              │
├─────────────────────────────────────────────────────────────┤
│  [Overview] [System] [Application] [Business] [Alerts]      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  System Metrics                                              │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
│  │ CPU Usage │ │ Memory    │ │  Active   │ │ Error Rate│  │
│  │           │ │  Usage    │ │Connections│ │           │  │
│  │  45.2%    │ │  68.5%    │ │    12     │ │   2.1%    │  │
│  │ [Chart]   │ │ [Chart]   │ │           │ │           │  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘  │
│                                                               │
│  Application Metrics                                         │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
│  │  Total    │ │ Response  │ │Throughput │ │ Cache Hit │  │
│  │ Requests  │ │ Time P95  │ │           │ │   Rate    │  │
│  │  15,234   │ │  450ms    │ │  25 req/s │ │  92.3%    │  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘  │
│                                                               │
│  Business Metrics                                            │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
│  │  Daily    │ │  Recipes  │ │ Searches  │ │   Total   │  │
│  │  Active   │ │  Created  │ │  Today    │ │   Users   │  │
│  │  Users    │ │  Today    │ │           │ │           │  │
│  │    45     │ │    23     │ │    156    │ │   1,234   │  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘  │
│                                                               │
│  Recent Alerts                                               │
│  ⚠️ WARNING - High CPU usage detected (88.2%)               │
│     2025-11-21 10:25:30                                     │
│  ⚠️ WARNING - Slow response time on /api/recipes (2.5s)    │
│     2025-11-21 10:20:15                                     │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  PersonalCookingRecipe Native Monitoring System v1.0.0      │
│  Uptime: 3 days 12 hours 34 minutes                         │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 リアルタイム更新

**実装**: Socket.io + ポーリング (5秒間隔)

```javascript
// クライアント側
setInterval(async () => {
    const response = await fetch('/monitoring/dashboard/api/metrics/current');
    const metrics = await response.json();
    updateDashboard(metrics);
}, 5000);
```

---

## 6. PM2統合

### 6.1 PM2プロセス構成

```bash
# PM2起動
$ pm2 start ecosystem.config.js

# プロセス一覧
┌─────┬──────────────────────────┬─────────┬─────────┬─────────┐
│ id  │ name                     │ mode    │ status  │ restart │
├─────┼──────────────────────────┼─────────┼─────────┼─────────┤
│ 0   │ recipe-frontend          │ fork    │ online  │ 0       │
│ 1   │ recipe-backend           │ fork    │ online  │ 0       │
│ 2   │ recipe-monitoring-collector│ fork  │ online  │ 0       │
└─────┴──────────────────────────┴─────────┴─────────┴─────────┘

# 監視コレクターはCron設定により6時間毎に自動再起動
```

### 6.2 PM2コマンド

```bash
# 全プロセス起動
$ pm2 start ecosystem.config.js

# 特定プロセス起動
$ pm2 start ecosystem.config.js --only recipe-monitoring-collector

# プロセス停止
$ pm2 stop recipe-monitoring-collector

# プロセス再起動
$ pm2 restart recipe-monitoring-collector

# ログ確認
$ pm2 logs recipe-monitoring-collector

# モニター表示
$ pm2 monit

# プロセス削除
$ pm2 delete recipe-monitoring-collector

# 全プロセス停止・削除
$ pm2 delete all
```

---

## 7. 運用開始ガイド

### 7.1 依存パッケージインストール

```bash
# プロジェクトルート
cd /mnt/Linux-ExHDD/PersonalCookingRecipe

# バックエンド依存パッケージ
cd backend
npm install systeminformation prom-client winston node-cron ioredis nodemailer axios ejs socket.io

# PM2グローバルインストール（未インストールの場合）
npm install -g pm2
```

### 7.2 PostgreSQLセットアップ

```bash
# PostgreSQL接続
psql -U postgres -d personalcookingrecipe

# マイグレーション実行
\i /mnt/Linux-ExHDD/PersonalCookingRecipe/backend/src/monitoring/migrations/001-create-metrics-tables.sql

# テーブル確認
\dt

# 正常終了メッセージが表示されればOK
```

### 7.3 環境変数設定

```bash
# .env ファイル作成 (backend/.env)
cat << EOF > backend/.env
# データベース設定
DB_HOST=localhost
DB_PORT=5432
DB_NAME=personalcookingrecipe
DB_USER=postgres
DB_PASSWORD=your_password

# Redis設定
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 監視設定
MONITORING_ENABLED=true

# アラート設定（オプション）
ALERT_EMAIL_SERVICE=gmail
ALERT_EMAIL_USER=your-email@gmail.com
ALERT_EMAIL_PASS=your-app-password
ALERT_EMAIL_TO=alerts@example.com

ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
ALERT_DISCORD_WEBHOOK=https://discord.com/api/webhooks/YOUR/WEBHOOK/URL
EOF
```

### 7.4 監視システム起動

```bash
# プロジェクトルート
cd /mnt/Linux-ExHDD/PersonalCookingRecipe

# PM2で全サービス起動
pm2 start ecosystem.config.js

# 起動確認
pm2 status

# ログ確認
pm2 logs recipe-monitoring-collector --lines 50

# Webダッシュボードアクセス
# http://localhost:5000/monitoring/dashboard
```

### 7.5 動作確認

```bash
# 1. システムメトリクス確認
curl http://localhost:5000/monitoring/dashboard/api/metrics/current | jq .

# 2. PostgreSQL データ確認
psql -U postgres -d personalcookingrecipe -c "SELECT COUNT(*) FROM system_metrics;"

# 3. Redis データ確認
redis-cli
> KEYS metrics:*
> GET metrics:integrated:current

# 4. アラート履歴確認
curl http://localhost:5000/monitoring/dashboard/api/alerts/history | jq .

# 5. Prometheus互換エンドポイント確認
curl http://localhost:5000/monitoring/dashboard/metrics
```

### 7.6 Expressアプリケーションへの統合

```javascript
// backend/src/server.js

const express = require('express');
const MetricsCollector = require('./monitoring/MetricsCollector');
const { router: dashboardRouter, initializeDashboardService } = require('./monitoring/dashboard/routes');

const app = express();

// メトリクスコレクター初期化
const metricsCollector = new MetricsCollector({
    postgres: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    },
    redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    },
    enableAlerts: true,
    alertConfig: {
        enableEmail: process.env.ALERT_EMAIL_USER ? true : false,
        enableSlack: process.env.ALERT_SLACK_WEBHOOK ? true : false,
        enableDiscord: process.env.ALERT_DISCORD_WEBHOOK ? true : false,
        email: {
            service: process.env.ALERT_EMAIL_SERVICE,
            user: process.env.ALERT_EMAIL_USER,
            pass: process.env.ALERT_EMAIL_PASS,
            to: process.env.ALERT_EMAIL_TO
        },
        slack: {
            webhookUrl: process.env.ALERT_SLACK_WEBHOOK
        },
        discord: {
            webhookUrl: process.env.ALERT_DISCORD_WEBHOOK
        }
    }
});

// 初期化
metricsCollector.initialize().catch(err => {
    console.error('Failed to initialize metrics collector:', err);
});

// HTTPリクエスト監視ミドルウェア
app.use(metricsCollector.createExpressMiddleware());

// ダッシュボードサービス初期化
initializeDashboardService(metricsCollector);

// ダッシュボードルート
app.use('/monitoring/dashboard', dashboardRouter);

// ビジネスメトリクス記録例
const businessMetrics = metricsCollector.getBusinessMetrics();

app.post('/api/users/register', async (req, res) => {
    // ... ユーザー登録処理 ...

    // メトリクス記録
    businessMetrics.recordUserRegistration({
        userId: newUser.id,
        type: 'email',
        source: 'web'
    });

    res.json({ success: true });
});

app.post('/api/recipes', async (req, res) => {
    // ... レシピ作成処理 ...

    // メトリクス記録
    businessMetrics.recordRecipeCreation({
        recipeId: newRecipe.id,
        userId: req.user.id,
        category: newRecipe.category,
        status: 'published'
    });

    res.json({ success: true });
});

app.get('/api/recipes/search', async (req, res) => {
    // ... 検索処理 ...

    // メトリクス記録
    businessMetrics.recordSearch({
        userId: req.user?.id,
        sessionId: req.sessionID,
        searchType: 'keyword',
        query: req.query.q,
        resultCount: results.length
    });

    res.json({ results });
});

// グレースフルシャットダウン
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    await metricsCollector.shutdown();
    process.exit(0);
});
```

---

## 8. Prometheus API互換性

### 8.1 メトリクスエンドポイント

**エンドポイント**: `GET /monitoring/dashboard/metrics`

**形式**: Prometheus Exposition Format (text/plain)

**例**:
```prometheus
# HELP cpu_usage CPU usage percentage
# TYPE cpu_usage gauge
cpu_usage 45.2

# HELP memory_usage Memory usage percentage
# TYPE memory_usage gauge
memory_usage 68.5

# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total 15234

# HELP http_error_rate HTTP error rate percentage
# TYPE http_error_rate gauge
http_error_rate 2.1

# HELP user_registrations_total Total user registrations
# TYPE user_registrations_total counter
user_registrations_total 1234
```

### 8.2 Prometheus統合（オプション）

Prometheusサーバーから本システムのメトリクスをスクレイピング可能:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'personalcookingrecipe'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/monitoring/dashboard/metrics'
    scrape_interval: 15s
```

---

## 9. トラブルシューティング

### 9.1 よくある問題と解決策

#### 問題1: メトリクスコレクターが起動しない

**症状**:
```
Error: MetricsCollector initialization failed
```

**原因と解決策**:
```bash
# PostgreSQL接続確認
psql -U postgres -d personalcookingrecipe -c "SELECT 1;"

# Redis接続確認
redis-cli ping

# 環境変数確認
echo $DB_HOST $DB_PORT $REDIS_HOST $REDIS_PORT

# ログ確認
pm2 logs recipe-monitoring-collector --err --lines 100
```

#### 問題2: メトリクスがPostgreSQLに保存されない

**症状**:
```sql
SELECT COUNT(*) FROM system_metrics;
-- count = 0
```

**原因と解決策**:
```sql
-- テーブル存在確認
\dt

-- テーブルが存在しない場合、マイグレーション実行
\i backend/src/monitoring/migrations/001-create-metrics-tables.sql

-- 権限確認
GRANT ALL PRIVILEGES ON TABLE system_metrics TO your_user;
```

#### 問題3: アラートが送信されない

**症状**: アラートが発生しても通知が来ない

**原因と解決策**:
```javascript
// 1. アラート設定確認
const alertManager = metricsCollector.getAlertManager();
console.log(alertManager.config);

// 2. 通知チャンネル有効化確認
// backend/.env
ALERT_EMAIL_USER=your-email@gmail.com
ALERT_EMAIL_PASS=your-app-password

// 3. Webhookテスト
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test alert"}'
```

#### 問題4: Webダッシュボードが表示されない

**症状**: `http://localhost:5000/monitoring/dashboard` にアクセスできない

**原因と解決策**:
```bash
# 1. バックエンドサービス起動確認
pm2 status recipe-backend

# 2. ポート確認
netstat -tulpn | grep 5000

# 3. ルート登録確認
# backend/src/server.js
app.use('/monitoring/dashboard', dashboardRouter);

# 4. EJS設定確認
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../'));
```

### 9.2 デバッグモード

```bash
# 詳細ログ出力
export LOG_LEVEL=debug

# PM2再起動
pm2 restart recipe-monitoring-collector --update-env

# ログストリーム
pm2 logs recipe-monitoring-collector --raw
```

---

## 10. 今後の拡張

### 10.1 推奨される拡張機能

1. **Grafanaダッシュボード統合**
   - PostgreSQL/Prometheusデータソース接続
   - カスタムダッシュボード作成
   - アラートルール追加

2. **機械学習による異常検知**
   - 時系列異常検知 (Isolation Forest)
   - 予測モデル (ARIMA, Prophet)
   - 自動閾値調整

3. **分散トレーシング**
   - OpenTelemetry統合
   - Jaeger/Zipkin連携
   - リクエストトレース可視化

4. **マルチリージョン対応**
   - リージョン別メトリクス収集
   - グローバルダッシュボード
   - リージョン間レイテンシ監視

5. **コスト最適化ダッシュボード**
   - リソース使用量コスト計算
   - 最適化推奨
   - コストアラート

### 10.2 パフォーマンス最適化

1. **メトリクス集約の最適化**
   - TimescaleDB導入 (PostgreSQL拡張)
   - 時系列データ圧縮
   - パーティショニング戦略

2. **キャッシュ戦略**
   - Redisクラスター構成
   - メトリクスキャッシュTTL最適化
   - 集約データキャッシュ

3. **クエリ最適化**
   - インデックス追加
   - マテリアライズドビュー活用
   - クエリプラン分析

---

## 付録

### A. 全ファイル一覧

```
PersonalCookingRecipe/
├── backend/
│   └── src/
│       └── monitoring/
│           ├── NativeMonitoring.js              # システム監視
│           ├── ApplicationMetrics.js            # アプリケーション監視
│           ├── BusinessMetrics.js               # ビジネス監視
│           ├── NativeAlertManager.js            # アラート管理
│           ├── MetricsCollector.js              # 統合コレクター
│           ├── ErrorDetectionSystem.js          # エラー検知 (既存)
│           ├── prometheus-metrics.js            # Prometheusメトリクス (既存)
│           ├── dashboard/
│           │   ├── routes.js                    # ダッシュボードルート
│           │   ├── services/
│           │   │   └── DashboardService.js      # データ集約サービス
│           │   ├── views/
│           │   │   └── index.ejs                # メインビュー
│           │   └── public/
│           │       ├── css/
│           │       │   └── dashboard.css        # スタイルシート
│           │       └── js/
│           │           └── dashboard.js         # クライアントJS
│           └── migrations/
│               └── 001-create-metrics-tables.sql # PostgreSQL マイグレーション
├── ecosystem.config.js                          # PM2設定 (更新)
├── scripts/
│   └── winston-logger.js                        # Winston統合ログ (既存)
└── NATIVE_MONITORING_IMPLEMENTATION_REPORT.md   # 本レポート
```

### B. 参考リンク

- systeminformation: https://github.com/sebhildebrandt/systeminformation
- prom-client: https://github.com/siimon/prom-client
- winston: https://github.com/winstonjs/winston
- node-cron: https://github.com/node-cron/node-cron
- PM2: https://pm2.keymetrics.io/docs/usage/quick-start/
- Prometheus: https://prometheus.io/docs/introduction/overview/

---

## 結論

PersonalCookingRecipeプロジェクトに、Docker非依存の完全ネイティブ監視システムを実装しました。本システムは以下の特徴を持ちます:

1. **包括的監視**: システム、アプリケーション、ビジネスの3層メトリクス
2. **リアルタイムアラート**: 複数チャンネル通知（Email/Slack/Discord）
3. **データ永続化**: PostgreSQL 30日間履歴 + Redis リアルタイムキャッシュ
4. **可視化**: Webダッシュボード（Express + EJS + Chart.js）
5. **PM2統合**: プロセス管理・自動再起動・Cron統合
6. **Prometheus互換**: 標準メトリクスエンドポイント

本システムは、Linuxネイティブ環境で完全動作し、Docker依存なしで運用可能です。今後の拡張として、Grafana統合、機械学習による異常検知、分散トレーシングなどを推奨します。

---

**実装完了日**: 2025-11-21
**バージョン**: v1.0.0
**担当**: Claude Code (System Architect)
**プロジェクト**: PersonalCookingRecipe
