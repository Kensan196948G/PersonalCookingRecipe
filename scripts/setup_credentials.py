#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Linux認証設定スクリプト
PersonalCookingRecipe - 3チャンネル統合レシピ監視システム

このスクリプトはLinux環境でAPI認証情報を安全に設定・管理します。
"""

import os
import sys
import getpass
from pathlib import Path

# プロジェクトルートを追加
sys.path.append(str(Path(__file__).parent.parent))

try:
    from config.credentials_manager import LinuxCredentialsManager
except ImportError:
    print("❌ 認証管理モジュールをインポートできません。")
    print("   プロジェクトディレクトリが正しく設定されているか確認してください。")
    sys.exit(1)


def print_header():
    """ヘッダー表示"""
    print("=" * 60)
    print("🔐 PersonalCookingRecipe - Linux認証設定")
    print("   3チャンネル統合レシピ監視システム")
    print("=" * 60)
    print()


def print_step(step, description):
    """ステップ表示"""
    print(f"🚀 Step {step}: {description}")
    print("-" * 40)


def get_credential_input(credential_name, description, required=True):
    """認証情報の入力取得"""
    print(f"\n📝 {credential_name}")
    print(f"説明: {description}")
    
    if required:
        while True:
            credential = getpass.getpass(f"🔑 {credential_name}を入力してください (入力は非表示): ").strip()
            if credential:
                return credential
            print("❌ 必須項目です。値を入力してください。")
    else:
        credential = getpass.getpass(f"🔑 {credential_name}を入力してください (オプション、Enterでスキップ): ").strip()
        return credential if credential else None


def setup_youtube_api():
    """YouTube Data API v3設定"""
    print_step(1, "YouTube Data API v3 設定")
    
    print("""
📺 YouTube Data API v3 の設定
1. Google Cloud Console (https://console.cloud.google.com/) にアクセス
2. プロジェクトを作成または選択
3. YouTube Data API v3 を有効化
4. 認証情報でAPIキーを作成
5. APIキーの使用制限を設定（推奨）
    """)
    
    api_key = get_credential_input(
        "YOUTUBE_API_KEY",
        "YouTube Data API v3のAPIキー（動画メタデータ取得用）"
    )
    
    return {"YOUTUBE_API_KEY": api_key}


def setup_claude_api():
    """Claude API設定"""
    print_step(2, "Claude API 設定")
    
    print("""
🤖 Claude API (Anthropic) の設定
1. Anthropic Console (https://console.anthropic.com/) にアクセス
2. アカウントを作成またはログイン
3. API Keys セクションでAPIキーを生成
4. 利用制限とレート制限を確認
    """)
    
    api_key = get_credential_input(
        "CLAUDE_API_KEY",
        "Claude APIキー（レシピ解析・翻訳用）"
    )
    
    return {"CLAUDE_API_KEY": api_key}


def setup_notion_api():
    """Notion API設定"""
    print_step(3, "Notion API 設定")
    
    print("""
📄 Notion API の設定
1. Notion Integrations (https://www.notion.so/my-integrations) にアクセス
2. 新しいインテグレーションを作成
3. Internal Integration Token をコピー
4. レシピ用データベースを作成
5. データベースをインテグレーションに共有
6. データベースURLからDatabase IDを取得
    """)
    
    token = get_credential_input(
        "NOTION_TOKEN",
        "Notion Internal Integration Token"
    )
    
    database_id = get_credential_input(
        "NOTION_DATABASE_ID", 
        "NotionデータベースID（32文字の英数字）"
    )
    
    return {
        "NOTION_TOKEN": token,
        "NOTION_DATABASE_ID": database_id
    }


def setup_gmail_api():
    """Gmail API設定"""
    print_step(4, "Gmail API 設定")
    
    print("""
📧 Gmail API (OAuth 2.0) の設定
1. Google Cloud Console (https://console.cloud.google.com/) にアクセス
2. Gmail API を有効化
3. OAuth 2.0 クライアントIDを作成（デスクトップアプリケーション）
4. クライアントIDとクライアントシークレットをコピー
5. OAuth同意画面を設定
    """)
    
    client_id = get_credential_input(
        "GMAIL_CLIENT_ID",
        "Gmail OAuth 2.0 クライアントID"
    )
    
    client_secret = get_credential_input(
        "GMAIL_CLIENT_SECRET",
        "Gmail OAuth 2.0 クライアントシークレット"
    )
    
    return {
        "GMAIL_CLIENT_ID": client_id,
        "GMAIL_CLIENT_SECRET": client_secret
    }


def setup_additional_config():
    """追加設定"""
    print_step(5, "追加設定")
    
    print("""
⚙️ 追加設定（オプション）
    """)
    
    config = {}
    
    # 通知メールアドレス
    email = input("📧 通知先メールアドレス (Enter でスキップ): ").strip()
    if email:
        config["NOTIFICATION_EMAIL"] = email
    
    return config


def save_credentials(creds_manager, all_credentials):
    """認証情報の保存"""
    print_step(6, "認証情報保存")
    
    print("💾 認証情報を保存中...")
    
    success_count = 0
    total_count = len(all_credentials)
    
    for key, value in all_credentials.items():
        if value:  # 値が存在する場合のみ保存
            if creds_manager.store_credential(key, value):
                print(f"✅ {key}: 保存成功")
                success_count += 1
            else:
                print(f"❌ {key}: 保存失敗")
        else:
            print(f"⏭️  {key}: スキップ（値が空）")
    
    print(f"\n📊 保存結果: {success_count}/{total_count} 完了")
    return success_count == total_count


def verify_credentials(creds_manager):
    """認証情報確認"""
    print_step(7, "設定確認")
    
    print("🔍 保存された認証情報を確認中...")
    
    accounts = creds_manager.list_accounts()
    configured_count = sum(1 for configured in accounts.values() if configured)
    
    print(f"\n📋 設定状況:")
    for account, configured in accounts.items():
        status = "✅ 設定済み" if configured else "❌ 未設定"
        print(f"   {account}: {status}")
    
    print(f"\n📊 設定済み認証情報: {configured_count}/{len(accounts)}")
    
    return configured_count > 0


def show_environment_variables(all_credentials):
    """環境変数設定例表示"""
    print_step(8, "環境変数設定例")
    
    print("""
🔧 環境変数として設定する場合の例:
（~/.bashrc または ~/.profile に追加）
    """)
    
    for key, value in all_credentials.items():
        if value:
            env_key = f"PERSONAL_COOKING_RECIPE_{key}"
            masked_value = value[:4] + "*" * (len(value) - 8) + value[-4:] if len(value) > 8 else "*" * len(value)
            print(f"export {env_key}={masked_value}")
    
    print("""
⚠️  注意: 実際の値を設定してください（上記はマスク表示）
    """)


def main():
    """メイン処理"""
    try:
        print_header()
        
        # 認証管理クラス初期化
        creds_manager = LinuxCredentialsManager()
        
        # 健全性チェック
        health = creds_manager.health_check()
        if not health.get('storage_accessible', False):
            print("❌ 認証管理システムの初期化に失敗しました")
            sys.exit(1)
        
        print("✅ 認証管理システムの初期化成功")
        print()
        
        # 各API設定を順次実行
        all_credentials = {}
        
        # YouTube API
        youtube_creds = setup_youtube_api()
        all_credentials.update(youtube_creds)
        
        # Claude API
        claude_creds = setup_claude_api()
        all_credentials.update(claude_creds)
        
        # Notion API
        notion_creds = setup_notion_api()
        all_credentials.update(notion_creds)
        
        # Gmail API
        gmail_creds = setup_gmail_api()
        all_credentials.update(gmail_creds)
        
        # 追加設定
        additional_creds = setup_additional_config()
        all_credentials.update(additional_creds)
        
        # 認証情報保存
        if save_credentials(creds_manager, all_credentials):
            print("\n🎉 認証情報の保存が完了しました！")
        else:
            print("\n⚠️  一部の認証情報の保存に失敗しました")
        
        # 設定確認
        if verify_credentials(creds_manager):
            print("\n✅ 認証設定が正常に完了しました")
        else:
            print("\n❌ 認証設定に問題があります")
        
        # 環境変数設定例表示
        show_environment_variables(all_credentials)
        
        print("\n" + "=" * 60)
        print("🎯 次のステップ:")
        print("   1. systemdサービス開始:")
        print("      sudo systemctl start personal-cooking-recipe")
        print("   2. サービス状態確認:")
        print("      sudo systemctl status personal-cooking-recipe")
        print("   3. ログ確認:")
        print("      journalctl -u personal-cooking-recipe -f")
        print("=" * 60)
        
    except KeyboardInterrupt:
        print("\n\n⚠️  設定がキャンセルされました")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ エラーが発生しました: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()