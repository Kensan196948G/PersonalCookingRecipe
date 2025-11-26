# Deploy Secrets Configuration Guide

このガイドでは、GitHub Actions CI/CDパイプラインでデプロイを実行するために必要なシークレットの設定方法を説明します。

## 必要なシークレット一覧

| シークレット名 | 説明 | 必須 |
|---|---|---|
| `STAGING_SSH_KEY` | ステージングサーバーへのSSH秘密鍵 | Yes |
| `STAGING_USER` | ステージングサーバーのユーザー名 | Yes |
| `STAGING_HOST` | ステージングサーバーのホスト名/IP | Yes |
| `PRODUCTION_SSH_KEY` | 本番サーバーへのSSH秘密鍵 | Yes |
| `PRODUCTION_USER` | 本番サーバーのユーザー名 | Yes |
| `PRODUCTION_HOST` | 本番サーバーのホスト名/IP | Yes |
| `SLACK_WEBHOOK` | Slack通知用Webhook URL | Optional |

## SSH鍵の生成方法

### 1. 新しいSSH鍵ペアを生成

```bash
# ステージング用
ssh-keygen -t ed25519 -C "github-actions-staging" -f ~/.ssh/github_actions_staging -N ""

# 本番用
ssh-keygen -t ed25519 -C "github-actions-production" -f ~/.ssh/github_actions_production -N ""
```

### 2. サーバーに公開鍵を追加

```bash
# ステージングサーバー
ssh-copy-id -i ~/.ssh/github_actions_staging.pub user@staging-server

# 本番サーバー
ssh-copy-id -i ~/.ssh/github_actions_production.pub user@production-server
```

または、手動で追加:
```bash
# サーバー上で
echo "公開鍵の内容" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 3. 秘密鍵の内容を確認

```bash
cat ~/.ssh/github_actions_staging
cat ~/.ssh/github_actions_production
```

## GitHubシークレットの設定

### 方法1: GitHub UIから設定

1. GitHubリポジトリにアクセス
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret** をクリック
4. 各シークレットを追加:

   **STAGING_SSH_KEY**
   - Name: `STAGING_SSH_KEY`
   - Value: `~/.ssh/github_actions_staging` の内容全体
     ```
     -----BEGIN OPENSSH PRIVATE KEY-----
     ... (秘密鍵の内容) ...
     -----END OPENSSH PRIVATE KEY-----
     ```

   **STAGING_USER**
   - Name: `STAGING_USER`
   - Value: `deploy` (サーバーユーザー名)

   **STAGING_HOST**
   - Name: `STAGING_HOST`
   - Value: `staging.example.com` または IPアドレス

   **PRODUCTION_SSH_KEY**
   - Name: `PRODUCTION_SSH_KEY`
   - Value: `~/.ssh/github_actions_production` の内容全体

   **PRODUCTION_USER**
   - Name: `PRODUCTION_USER`
   - Value: `deploy`

   **PRODUCTION_HOST**
   - Name: `PRODUCTION_HOST`
   - Value: `production.example.com`

### 方法2: GitHub CLIから設定

```bash
# GitHub CLIでログイン
gh auth login

# シークレットを設定
gh secret set STAGING_SSH_KEY < ~/.ssh/github_actions_staging
gh secret set STAGING_USER --body "deploy"
gh secret set STAGING_HOST --body "staging.example.com"

gh secret set PRODUCTION_SSH_KEY < ~/.ssh/github_actions_production
gh secret set PRODUCTION_USER --body "deploy"
gh secret set PRODUCTION_HOST --body "production.example.com"

# Slack Webhook (オプション)
gh secret set SLACK_WEBHOOK --body "https://hooks.slack.com/services/xxx/yyy/zzz"
```

## サーバー側の設定

### 1. デプロイユーザーの作成

```bash
# サーバー上で
sudo adduser deploy
sudo usermod -aG sudo deploy

# SSHディレクトリ作成
sudo mkdir -p /home/deploy/.ssh
sudo chown deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
```

### 2. アプリケーションディレクトリの準備

```bash
sudo mkdir -p /opt/recipe-app
sudo chown deploy:deploy /opt/recipe-app
```

### 3. 必要なツールのインストール

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 (プロセスマネージャー)
sudo npm install -g pm2

# Python
sudo apt-get install -y python3 python3-pip python3-venv
```

## トラブルシューティング

### SSH接続エラー

```
Permission denied (publickey)
```

**解決方法:**
1. 公開鍵がサーバーの `authorized_keys` に正しく追加されているか確認
2. 秘密鍵のパーミッションを確認: `chmod 600 ~/.ssh/github_actions_*`
3. SSH鍵の形式を確認（OpenSSH形式推奨）

### シークレットが見つからないエラー

```
Error: Input required and not supplied: ssh-private-key
```

**解決方法:**
1. GitHubリポジトリの Settings → Secrets で設定されているか確認
2. シークレット名のスペルを確認
3. リポジトリへのアクセス権限を確認

### ホスト検証エラー

```
Host key verification failed
```

**解決方法:**
ワークフローで `-o StrictHostKeyChecking=no` オプションが設定されていることを確認（既に設定済み）

## セキュリティベストプラクティス

1. **専用のデプロイユーザーを使用**: rootユーザーではなく、限定された権限を持つデプロイ専用ユーザーを使用
2. **SSH鍵のローテーション**: 定期的にSSH鍵を更新
3. **最小権限の原則**: デプロイユーザーには必要最小限の権限のみを付与
4. **IP制限**: 可能であれば、GitHub ActionsのIPレンジからのみSSH接続を許可

## 現在のワークフローステータス

デプロイワークフローが正常に動作するには、以下のシークレットがすべて設定されている必要があります:

- [ ] `STAGING_SSH_KEY`
- [ ] `STAGING_USER`
- [ ] `STAGING_HOST`
- [ ] `PRODUCTION_SSH_KEY`
- [ ] `PRODUCTION_USER`
- [ ] `PRODUCTION_HOST`
- [ ] `SLACK_WEBHOOK` (オプション)

---

質問や問題がある場合は、Issueを作成してください。
