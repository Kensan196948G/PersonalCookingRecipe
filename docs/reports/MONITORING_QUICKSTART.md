# PostgreSQL監視システム クイックスタートガイド

PersonalCookingRecipe ネイティブ監視システムの最速セットアップ手順

---

## 前提条件チェック

```bash
# PostgreSQL確認
pg_isready -h localhost -p 5432

# Redis確認
redis-cli ping

# Node.js確認
node --version  # v18以上

# PM2確認
pm2 --version
```

すべて正常に動作していることを確認してください。

---

## セットアップ (3ステップ)

### ステップ1: PostgreSQLデータベース作成

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE recipe_db;
CREATE USER recipe_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE recipe_db TO recipe_user;
\q
```

### ステップ2: セットアップスクリプト実行

```bash
cd /mnt/Linux-ExHDD/PersonalCookingRecipe
./backend/scripts/setup-postgresql-monitoring.sh
```

パスワード入力を求められたら、ステップ1で設定したパスワードを入力してください。

### ステップ3: 動作確認

```bash
cd backend
node src/monitoring/test-monitoring.js
```

全テストが成功すれば、セットアップ完了です。

---

## 監視システム起動

### PM2で起動

```bash
# 全プロセス起動
pm2 start ecosystem.config.js

# または、監視システムのみ起動
pm2 start ecosystem.config.js --only recipe-monitoring-collector

# 状態確認
pm2 status
```

### ダッシュボードアクセス

ブラウザで開く:
```
http://localhost:5001/
```

---

## 基本的な使い方

### メトリクス確認 (PostgreSQL)

```bash
# PostgreSQL接続
psql -U recipe_user -d recipe_db -h localhost
```

```sql
-- 最新メトリクス確認
SELECT * FROM latest_metrics ORDER BY metric_name;

-- CPU使用率の統計（過去24時間）
SELECT * FROM get_metric_stats('cpu_usage', 24);

-- アクティブアラート確認
SELECT * FROM active_alerts ORDER BY timestamp DESC;
```

### ログ確認

```bash
# リアルタイムログ
pm2 logs recipe-monitoring-collector

# 過去ログ（100行）
pm2 logs recipe-monitoring-collector --lines 100

# エラーログのみ
pm2 logs recipe-monitoring-collector --err
```

---

## よくある操作

### プロセス管理

```bash
# 再起動
pm2 restart recipe-monitoring-collector

# 停止
pm2 stop recipe-monitoring-collector

# 削除
pm2 delete recipe-monitoring-collector
```

### データクリーンアップ

```sql
-- 30日以上前のデータ削除
SELECT * FROM cleanup_old_metrics(30);
```

### マテリアライズドビュー更新

```sql
SELECT refresh_metrics_views();
```

---

## トラブルシューティング

### PostgreSQL接続エラー

```bash
# PostgreSQL起動確認
sudo systemctl status postgresql

# 起動
sudo systemctl start postgresql
```

### Redis接続エラー

```bash
# Redis起動確認
sudo systemctl status redis-server

# 起動
sudo systemctl start redis-server
```

### メトリクスが表示されない

```bash
# プロセス状態確認
pm2 status

# ログ確認
pm2 logs recipe-monitoring-collector --lines 50

# プロセス再起動
pm2 restart recipe-monitoring-collector
```

---

## 次のステップ

1. **アラートルールのカスタマイズ**:
   - `backend/src/monitoring/NativeAlertManager.js` を編集

2. **ダッシュボードのカスタマイズ**:
   - `backend/src/monitoring/dashboard/` 配下のファイルを編集

3. **詳細ドキュメント参照**:
   - `/mnt/Linux-ExHDD/PersonalCookingRecipe/POSTGRESQL_MONITORING_SETUP_REPORT.md`

---

## サポート

問題が発生した場合:

1. テストスクリプト実行: `node backend/src/monitoring/test-monitoring.js`
2. ログ確認: `pm2 logs recipe-monitoring-collector`
3. 詳細レポート参照: `POSTGRESQL_MONITORING_SETUP_REPORT.md`

---

**最終更新**: 2025-11-21
