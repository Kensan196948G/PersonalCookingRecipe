#!/bin/bash
# バックアップスクリプト
# Personal Cooking Recipe Backup Strategy

set -e

# 設定読み込み
if [ -f .env.production ]; then
    source .env.production
else
    echo "❌ .env.production ファイルが見つかりません"
    exit 1
fi

# 変数設定
BACKUP_DIR="/app/backups"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="recipe_backup_$DATE"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

echo "🗄️ バックアップ開始: $DATE"

# バックアップディレクトリ作成
mkdir -p $BACKUP_DIR/$DATE

# データベースバックアップ
echo "📊 データベースをバックアップしています..."
if [ -f "./data/recipes.db" ]; then
    # SQLiteファイルをコピー（WALモード対応）
    sqlite3 "./data/recipes.db" "VACUUM;" 2>/dev/null || echo "⚠️ VACUUM failed, continuing..."
    cp "./data/recipes.db" "$BACKUP_DIR/$DATE/"
    
    # WALファイルもバックアップ（存在する場合）
    [ -f "./data/recipes.db-wal" ] && cp "./data/recipes.db-wal" "$BACKUP_DIR/$DATE/"
    [ -f "./data/recipes.db-shm" ] && cp "./data/recipes.db-shm" "$BACKUP_DIR/$DATE/"
    
    echo "✅ データベースバックアップ完了"
else
    echo "⚠️ データベースファイルが見つかりません: ./data/recipes.db"
fi

# アップロードファイルバックアップ
echo "📁 アップロードファイルをバックアップしています..."
if [ -d "./uploads" ]; then
    tar -czf "$BACKUP_DIR/$DATE/uploads.tar.gz" -C "./uploads" . 2>/dev/null || echo "⚠️ No uploads to backup"
    echo "✅ アップロードファイルバックアップ完了"
fi

# 設定ファイルバックアップ
echo "⚙️ 設定ファイルをバックアップしています..."
mkdir -p "$BACKUP_DIR/$DATE/config"
cp .env.production "$BACKUP_DIR/$DATE/config/" 2>/dev/null || echo "⚠️ .env.production not found"
cp -r nginx "$BACKUP_DIR/$DATE/config/" 2>/dev/null || echo "⚠️ nginx config not found"
cp docker-compose.yml "$BACKUP_DIR/$DATE/config/" 2>/dev/null || echo "⚠️ docker-compose.yml not found"
cp -r ssl "$BACKUP_DIR/$DATE/config/" 2>/dev/null || echo "⚠️ ssl certs not found"

# ログファイルバックアップ（最新1週間分）
echo "📋 ログファイルをバックアップしています..."
if [ -d "./logs" ]; then
    find ./logs -name "*.log" -mtime -7 -exec tar -czf "$BACKUP_DIR/$DATE/logs.tar.gz" {} + 2>/dev/null || echo "⚠️ No recent logs to backup"
    echo "✅ ログファイルバックアップ完了"
fi

# バックアップ圧縮
echo "🗜️ バックアップを圧縮しています..."
cd $BACKUP_DIR
tar -czf "${BACKUP_NAME}.tar.gz" $DATE
rm -rf $DATE

# バックアップサイズ計算
BACKUP_SIZE=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
echo "📦 バックアップサイズ: $BACKUP_SIZE"

# AWS S3アップロード（設定されている場合）
if [ "$BACKUP_ENABLED" = "true" ] && [ -n "$BACKUP_S3_BUCKET" ] && [ -n "$AWS_ACCESS_KEY_ID" ]; then
    echo "☁️ S3にバックアップをアップロードしています..."
    
    # AWS CLI確認
    if command -v aws &> /dev/null; then
        aws s3 cp "${BACKUP_NAME}.tar.gz" "s3://$BACKUP_S3_BUCKET/backups/" \
            --region $AWS_REGION \
            --storage-class STANDARD_IA
        
        if [ $? -eq 0 ]; then
            echo "✅ S3アップロード完了: s3://$BACKUP_S3_BUCKET/backups/${BACKUP_NAME}.tar.gz"
        else
            echo "❌ S3アップロード失敗"
        fi
    else
        echo "⚠️ AWS CLIがインストールされていません"
    fi
fi

# 古いバックアップ削除
echo "🧹 古いバックアップを削除しています..."
find $BACKUP_DIR -name "recipe_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
DELETED_COUNT=$(find $BACKUP_DIR -name "recipe_backup_*.tar.gz" -mtime +$RETENTION_DAYS 2>/dev/null | wc -l)
if [ $DELETED_COUNT -gt 0 ]; then
    echo "🗑️ $DELETED_COUNT 個の古いバックアップを削除しました"
fi

# S3の古いバックアップも削除
if [ "$BACKUP_ENABLED" = "true" ] && [ -n "$BACKUP_S3_BUCKET" ] && command -v aws &> /dev/null; then
    CUTOFF_DATE=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)
    aws s3 ls "s3://$BACKUP_S3_BUCKET/backups/" | awk '{print $4}' | while read file; do
        FILE_DATE=$(echo $file | sed -n 's/recipe_backup_\([0-9]\{8\}\)_.*\.tar\.gz/\1/p')
        if [ -n "$FILE_DATE" ]; then
            FORMATTED_DATE=$(echo $FILE_DATE | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3/')
            if [[ "$FORMATTED_DATE" < "$CUTOFF_DATE" ]]; then
                aws s3 rm "s3://$BACKUP_S3_BUCKET/backups/$file"
                echo "🗑️ S3から削除: $file"
            fi
        fi
    done
fi

# バックアップ完了通知
echo "✅ バックアップ完了: ${BACKUP_NAME}.tar.gz ($BACKUP_SIZE)"

# メール通知（設定されている場合）
if [ -n "$NOTIFICATION_EMAIL" ] && [ -n "$SMTP_HOST" ]; then
    echo "📧 バックアップ完了通知を送信しています..."
    
    # メール本文作成
    cat > /tmp/backup_notification.txt << EOF
Subject: [PersonalCookingRecipe] Backup Completed - $DATE

バックアップが正常に完了しました。

詳細情報:
- 時刻: $DATE  
- ファイル名: ${BACKUP_NAME}.tar.gz
- サイズ: $BACKUP_SIZE
- 場所: $BACKUP_DIR
- S3バックアップ: $([ "$BACKUP_ENABLED" = "true" ] && echo "有効" || echo "無効")

システム状態:
- ディスク使用量: $(df -h / | awk 'NR==2{print $5}')
- メモリ使用量: $(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')

次回バックアップ予定: $(date -d '+1 day' '+%Y-%m-%d %H:%M:%S')

---
Personal Cooking Recipe Backup System
EOF

    # メール送信（sendmailまたはmsmtp使用）
    if command -v sendmail &> /dev/null; then
        sendmail $NOTIFICATION_EMAIL < /tmp/backup_notification.txt
        echo "✅ 通知メール送信完了"
    else
        echo "⚠️ sendmailが利用できません。メール通知をスキップします。"
    fi
    
    rm -f /tmp/backup_notification.txt
fi

echo "🏁 バックアップ処理完了: $(date)"