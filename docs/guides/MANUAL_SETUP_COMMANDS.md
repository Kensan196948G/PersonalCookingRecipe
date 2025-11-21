# PostgreSQL監視システム 手動セットアップコマンド

**実行者**: ユーザー (sudo権限必要)
**所要時間**: 約5分
**Phase**: Phase 2 Week 2完了 → Week 3準備

---

## 📋 実行コマンド (コピー&ペースト)

以下のコマンドを**順番に**ターミナルで実行してください。

---

### Step 1: PostgreSQL起動確認

```bash
sudo systemctl start postgresql
sudo systemctl status postgresql
```

**期待される出力**: `Active: active (exited)`

---

### Step 2: データベースとユーザー作成

```bash
sudo -u postgres psql
```

PostgreSQLプロンプトで以下を実行:

```sql
-- データベース存在確認
\l

-- 既に recipe_db が存在する場合はスキップ、なければ作成
CREATE DATABASE recipe_db;
CREATE USER recipe_user WITH PASSWORD 'recipe_secure_password_2024';
GRANT ALL PRIVILEGES ON DATABASE recipe_db TO recipe_user;
GRANT ALL ON SCHEMA public TO recipe_user;

-- 確認
\l recipe_db
\du recipe_user

-- 終了
\q
```

---

### Step 3: 監視テーブル作成

```bash
sudo -u postgres psql -d recipe_db -f /mnt/Linux-ExHDD/PersonalCookingRecipe/backend/src/monitoring/migrations/001-create-metrics-tables.sql
```

**期待される出力**:
```
CREATE TABLE (5回)
CREATE VIEW (3回)
CREATE FUNCTION (3回)
```

---

### Step 4: テーブル確認

```bash
sudo -u postgres psql -d recipe_db
```

PostgreSQLプロンプトで:

```sql
-- テーブル一覧
\dt

-- ビュー一覧
\dv

-- 関数一覧
\df

-- 終了
\q
```

**期待されるテーブル**:
- system_metrics
- metrics_raw
- metrics_hourly
- daily_summaries
- alert_history

---

### Step 5: アプリケーションユーザーでの接続テスト

```bash
PGPASSWORD='recipe_secure_password_2024' psql -h localhost -U recipe_user -d recipe_db -c "SELECT NOW();"
```

**期待される出力**: 現在時刻が表示される

---

### Step 6: 動作確認テスト

```bash
cd /mnt/Linux-ExHDD/PersonalCookingRecipe/backend
node src/monitoring/test-monitoring.js
```

**期待される出力**:
```
🧪 PersonalCookingRecipe 監視システム動作確認テスト
================================================

✅ PostgreSQL接続テスト - 成功
✅ Redis接続テスト - 成功
✅ テーブル存在確認 - 成功 (5テーブル)
✅ ビュー存在確認 - 成功 (3ビュー)
✅ メトリクス書き込みテスト - 成功
✅ メトリクス読み込みテスト - 成功
...

🎉 全15項目のテストが成功しました!
```

---

### Step 7: PM2監視コレクター起動

```bash
cd /mnt/Linux-ExHDD/PersonalCookingRecipe

# recipe-backend再起動 (PostgreSQL使用)
pm2 restart recipe-backend

# 監視コレクター起動
pm2 start ecosystem.config.js --only recipe-monitoring-collector

# ステータス確認
pm2 status

# ログ確認
pm2 logs recipe-monitoring-collector --lines 20

# 保存
pm2 save
```

**期待されるPM2プロセス**:
- recipe-backend: **online**
- recipe-monitoring-collector: **online**

---

### Step 8: ダッシュボード確認 (オプション)

```bash
# 監視ダッシュボード起動
pm2 start ecosystem.config.js --only recipe-monitoring-dashboard

# アクセス
# http://localhost:5000/monitoring/dashboard
# または
# http://localhost:5001
```

---

### Step 9: PM2自動起動設定

```bash
pm2 startup systemd
```

**出力されたコマンドをコピーして実行** (sudoが含まれる)

例:
```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u kensan --hp /home/kensan
```

その後:
```bash
pm2 save
```

---

## 🚨 トラブルシューティング

### エラー: "FATAL: Peer authentication failed"

**原因**: pg_hba.confの設定

**解決**:
```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

以下の行を追加:
```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
host    all             all             127.0.0.1/32            md5
```

PostgreSQL再起動:
```bash
sudo systemctl restart postgresql
```

---

### エラー: "relation does not exist"

**原因**: マイグレーション未実行

**解決**: Step 3を再実行

---

### エラー: "permission denied for schema public"

**原因**: 権限不足

**解決**:
```bash
sudo -u postgres psql -d recipe_db -c "GRANT ALL ON SCHEMA public TO recipe_user;"
sudo -u postgres psql -d recipe_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO recipe_user;"
```

---

### PM2プロセスが online にならない

**確認**:
```bash
pm2 logs recipe-backend --lines 50
pm2 logs recipe-monitoring-collector --lines 50
```

**原因特定後、再起動**:
```bash
pm2 restart all
pm2 delete all
pm2 start ecosystem.config.js
```

---

## ✅ セットアップ完了確認

全て✅になれば完了です:

- [ ] PostgreSQL起動中
- [ ] recipe_dbデータベース存在
- [ ] recipe_userユーザー存在
- [ ] 5テーブル作成済み
- [ ] 3ビュー作成済み
- [ ] 接続テスト成功
- [ ] 動作確認テスト 15項目全成功
- [ ] PM2 recipe-backend online
- [ ] PM2 recipe-monitoring-collector online
- [ ] ダッシュボードアクセス可能

---

## 🎯 完了後の次のステップ

セットアップが完了したら:

### 1. Lighthouse CI実行

```bash
cd /mnt/Linux-ExHDD/PersonalCookingRecipe

# フロントエンド起動
cd frontend
PORT=3003 npm run start &

# Lighthouse実行 (別ターミナル)
cd ..
node scripts/lighthouse-ci.js

# レポート確認
open frontend/.lighthouseci/report.html
```

### 2. Week 3開始

**目標**:
- Critical Issues 5件修正
- カバレッジ 30%達成
- SLI/SLO測定開始

**詳細**: `PHASE2_COMPLETION_NEXT_STEPS.md` 参照

---

**このガイドに従って実行してください!** 🚀

**問題が発生した場合**: トラブルシューティングセクションを参照
