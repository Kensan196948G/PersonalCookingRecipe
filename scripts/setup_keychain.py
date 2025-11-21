#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Keychain設定スクリプト
PersonalCookRecipe - 3チャンネル統合レシピ監視システム

このスクリプトはmacOS Keychainの設定と管理を自動化します。
対話型設定、環境変数ファイルからの移行、セキュリティ確認を提供します。
"""

import os
import sys
import getpass
import json
import logging
from pathlib import Path
from typing import Dict, Optional, List, Tuple

# プロジェクトのconfigモジュールをインポート
sys.path.append(str(Path(__file__).parent.parent / "config"))

try:
    from keychain_manager import MacOSKeychainManager
    from api_manager import APIManager
except ImportError as e:
    print(f"❌ インポートエラー: {e}")
    print("config/keychain_manager.pyとapi_manager.pyが必要です。")
    sys.exit(1)


class KeychainSetupWizard:
    """Keychain設定ウィザード
    
    macOS Keychainの設定を対話型で行います。
    環境変数ファイルからの移行、新規設定、既存設定の更新をサポートします。
    """
    
    def __init__(self):
        """設定ウィザード初期化"""
        # ログ設定
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
        # パス設定
        self.base_dir = Path.home() / "Developer" / "tasty-recipe-monitor"
        self.config_dir = self.base_dir / "config"
        
        # ディレクトリ作成
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        # Keychain管理クラス初期化
        self.keychain_manager = MacOSKeychainManager()
        
        # 設定可能なAPI認証情報
        self.api_credentials = {
            'YOUTUBE_API_KEY': {
                'description': 'YouTube Data API Key',
                'required': True,
                'validation': self._validate_youtube_key,
                'help': 'Google Cloud ConsoleでYouTube Data API v3を有効化して取得'
            },
            'CLAUDE_API_KEY': {
                'description': 'Claude API Key (Anthropic)',
                'required': True,
                'validation': self._validate_claude_key,
                'help': 'Anthropic Consoleで取得（sk-で始まる）'
            },
            'NOTION_TOKEN': {
                'description': 'Notion Integration Token',
                'required': True,
                'validation': self._validate_notion_token,
                'help': 'Notion Developerでintegration作成時に取得'
            },
            'NOTION_DATABASE_ID': {
                'description': 'Notion Database ID',
                'required': True,
                'validation': self._validate_notion_database_id,
                'help': 'NotionデータベースページのURLから取得（32文字のハッシュ）'
            },
            'GMAIL_CLIENT_ID': {
                'description': 'Gmail OAuth Client ID',
                'required': True,
                'validation': self._validate_gmail_client_id,
                'help': 'Google Cloud ConsoleでOAuth 2.0認証情報を作成時に取得'
            },
            'GMAIL_CLIENT_SECRET': {
                'description': 'Gmail OAuth Client Secret',
                'required': True,
                'validation': self._validate_gmail_client_secret,
                'help': 'Gmail OAuth Client IDと同時に生成される'
            }
        }
        
        self.logger.info("Keychain設定ウィザード初期化完了")
    
    def run_setup(self):
        """設定メイン処理実行"""
        try:
            self._print_header()
            
            # 現在の状態確認
            current_status = self._check_current_status()
            self._print_current_status(current_status)
            
            # セットアップモード選択
            setup_mode = self._select_setup_mode(current_status)
            
            if setup_mode == 'migrate':
                self._migrate_from_env_file()
            elif setup_mode == 'new':
                self._interactive_setup()
            elif setup_mode == 'update':
                self._update_existing()
            elif setup_mode == 'verify':
                self._verify_setup()
            elif setup_mode == 'exit':
                print("セットアップを終了します。")
                return
            
            # 最終検証
            print("\n=== 最終検証 ===")
            self._final_verification()
            
        except KeyboardInterrupt:
            print("\n\n❌ セットアップがキャンセルされました。")
            sys.exit(1)
        except Exception as e:
            print(f"❌ セットアップエラー: {e}")
            self.logger.error(f"セットアップエラー: {e}")
            sys.exit(1)
    
    def _print_header(self):
        """ヘッダー表示"""
        print("="*60)
        print("🔐 PersonalCookRecipe - macOS Keychain設定ウィザード")
        print("="*60)
        print()
        print("このウィザードは以下を設定します:")
        print("• YouTube Data API Key")
        print("• Claude API Key")
        print("• Notion Integration Token & Database ID")
        print("• Gmail OAuth認証情報")
        print()
    
    def _check_current_status(self) -> Dict[str, bool]:
        """現在の設定状態確認"""
        status = {}
        
        print("📋 現在の設定状態を確認中...")
        
        for key in self.api_credentials.keys():
            value = self.keychain_manager.get_password(key)
            status[key] = bool(value)
        
        # 環境変数ファイル存在確認
        env_file = self.config_dir / "api_keys.env"
        status['env_file_exists'] = env_file.exists()
        
        return status
    
    def _print_current_status(self, status: Dict[str, bool]):
        """現在の設定状態表示"""
        print("\n📊 現在の設定状態:")
        print("-" * 40)
        
        for key, is_set in status.items():
            if key == 'env_file_exists':
                continue
                
            emoji = "✅" if is_set else "❌"
            description = self.api_credentials[key]['description']
            print(f"{emoji} {description}: {'設定済み' if is_set else '未設定'}")
        
        if status.get('env_file_exists'):
            print(f"📄 環境変数ファイル: 存在（{self.config_dir / 'api_keys.env'}）")
        
        print()
    
    def _select_setup_mode(self, status: Dict[str, bool]) -> str:
        """セットアップモード選択"""
        print("🚀 セットアップモードを選択してください:")
        print()
        
        options = []
        
        # 環境変数ファイルが存在する場合
        if status.get('env_file_exists'):
            options.append(('migrate', '📥 環境変数ファイルからKeychainへ移行'))
        
        # 未設定の項目がある場合
        unset_count = sum(1 for key, is_set in status.items() 
                         if key != 'env_file_exists' and not is_set)
        if unset_count > 0:
            options.append(('new', f'🆕 新規設定（{unset_count}件の未設定項目）'))
        
        # 設定済み項目がある場合
        set_count = sum(1 for key, is_set in status.items() 
                       if key != 'env_file_exists' and is_set)
        if set_count > 0:
            options.append(('update', f'🔄 既存設定の更新（{set_count}件の設定済み項目）'))
        
        # 検証オプション
        options.append(('verify', '🔍 設定の検証のみ'))
        options.append(('exit', '❌ 終了'))
        
        print("選択肢:")
        for i, (mode, description) in enumerate(options, 1):
            print(f"{i}. {description}")
        
        while True:
            try:
                choice = input(f"\n選択してください (1-{len(options)}): ").strip()
                choice_num = int(choice)
                
                if 1 <= choice_num <= len(options):
                    selected_mode = options[choice_num - 1][0]
                    print(f"選択されたモード: {options[choice_num - 1][1]}")
                    return selected_mode
                else:
                    print("❌ 無効な選択です。")
            except ValueError:
                print("❌ 数字を入力してください。")
            except KeyboardInterrupt:
                raise
    
    def _migrate_from_env_file(self):
        """環境変数ファイルからKeychain移行"""
        print("\n📥 環境変数ファイルからKeychain移行開始")
        
        env_file = self.config_dir / "api_keys.env"
        
        if not env_file.exists():
            print("❌ 環境変数ファイルが見つかりません。")
            return
        
        print(f"📄 移行元ファイル: {env_file}")
        
        # 確認
        proceed = input("移行を実行しますか？ (y/n): ").lower().strip()
        if proceed != 'y':
            print("移行をキャンセルしました。")
            return
        
        # 移行実行
        success = self.keychain_manager.migrate_from_env_file(env_file)
        
        if success:
            print("✅ Keychain移行成功")
            
            # 元ファイル削除確認
            delete_original = input("元の環境変数ファイルを削除しますか？ (y/n): ").lower().strip()
            if delete_original == 'y':
                try:
                    env_file.unlink()
                    print("✅ 元ファイル削除完了")
                except Exception as e:
                    print(f"❌ 元ファイル削除失敗: {e}")
            else:
                print("⚠️  元ファイルは保持されます（セキュリティ上削除を推奨）")
        else:
            print("❌ Keychain移行失敗")
    
    def _interactive_setup(self):
        """対話型新規設定"""
        print("\n🆕 対話型API認証情報設定")
        
        credentials_to_set = {}
        
        for key, config in self.api_credentials.items():
            print(f"\n--- {config['description']} ---")
            print(f"説明: {config['help']}")
            
            # 既存の値確認
            existing_value = self.keychain_manager.get_password(key)
            if existing_value:
                print(f"現在の設定: 設定済み")
                update = input("更新しますか？ (y/n): ").lower().strip()
                if update != 'y':
                    continue
            
            # 値入力
            while True:
                if 'SECRET' in key or 'KEY' in key or 'TOKEN' in key:
                    value = getpass.getpass(f"{config['description']}を入力: ")
                else:
                    value = input(f"{config['description']}を入力: ").strip()
                
                if not value:
                    if config['required']:
                        print("❌ この項目は必須です。")
                        continue
                    else:
                        break
                
                # バリデーション
                if config['validation'](value):
                    credentials_to_set[key] = value
                    print("✅ 入力値が有効です。")
                    break
                else:
                    print("❌ 入力値が無効です。再入力してください。")
        
        # 設定保存
        if credentials_to_set:
            print(f"\n💾 {len(credentials_to_set)}件の認証情報をKeychainに保存中...")
            success = self.keychain_manager.store_api_credentials(credentials_to_set)
            
            if success:
                print("✅ 全ての認証情報をKeychainに保存しました。")
            else:
                print("❌ 一部の認証情報の保存に失敗しました。")
        else:
            print("保存する認証情報がありません。")
    
    def _update_existing(self):
        """既存設定の更新"""
        print("\n🔄 既存設定の更新")
        
        # 設定済み項目の一覧表示
        existing_credentials = self.keychain_manager.retrieve_all_credentials()
        
        if not existing_credentials:
            print("設定済みの認証情報が見つかりません。")
            return
        
        print("設定済みの認証情報:")
        for i, (key, _) in enumerate(existing_credentials.items(), 1):
            description = self.api_credentials.get(key, {}).get('description', key)
            print(f"{i}. {description}")
        
        print(f"{len(existing_credentials) + 1}. 全て更新")
        print(f"{len(existing_credentials) + 2}. キャンセル")
        
        while True:
            try:
                choice = input(f"\n更新する項目を選択 (1-{len(existing_credentials) + 2}): ").strip()
                choice_num = int(choice)
                
                if choice_num == len(existing_credentials) + 2:  # キャンセル
                    print("更新をキャンセルしました。")
                    return
                elif choice_num == len(existing_credentials) + 1:  # 全て更新
                    keys_to_update = list(existing_credentials.keys())
                    break
                elif 1 <= choice_num <= len(existing_credentials):
                    keys_to_update = [list(existing_credentials.keys())[choice_num - 1]]
                    break
                else:
                    print("❌ 無効な選択です。")
            except ValueError:
                print("❌ 数字を入力してください。")
        
        # 選択された項目を更新
        for key in keys_to_update:
            config = self.api_credentials.get(key, {})
            description = config.get('description', key)
            
            print(f"\n--- {description} の更新 ---")
            
            if 'SECRET' in key or 'KEY' in key or 'TOKEN' in key:
                new_value = getpass.getpass(f"新しい{description}を入力: ")
            else:
                new_value = input(f"新しい{description}を入力: ").strip()
            
            if new_value:
                # バリデーション
                validation_func = config.get('validation', lambda x: True)
                if validation_func(new_value):
                    success = self.keychain_manager.add_password(key, new_value)
                    if success:
                        print(f"✅ {description}を更新しました。")
                    else:
                        print(f"❌ {description}の更新に失敗しました。")
                else:
                    print(f"❌ {description}の値が無効です。")
            else:
                print(f"スキップ: {description}")
    
    def _verify_setup(self):
        """設定検証のみ実行"""
        print("\n🔍 設定検証実行")
        
        # Keychain接続確認
        keychain_health = self.keychain_manager.health_check()
        print(f"Keychain接続: {'✅ 正常' if keychain_health['keychain_accessible'] else '❌ 問題あり'}")
        
        # 認証情報確認
        credentials = self.keychain_manager.retrieve_all_credentials()
        print(f"保存済み認証情報: {len(credentials)}件")
        
        for key, config in self.api_credentials.items():
            is_set = key in credentials
            emoji = "✅" if is_set else "❌"
            print(f"  {emoji} {config['description']}: {'設定済み' if is_set else '未設定'}")
        
        # APIManager経由での検証
        try:
            api_manager = APIManager(self.config_dir)
            validation_results = api_manager.validate_all_credentials()
            
            print("\nAPI認証情報検証結果:")
            for api_name, is_valid in validation_results.items():
                if api_name != 'all_valid':
                    emoji = "✅" if is_valid else "❌"
                    print(f"  {emoji} {api_name.upper()}: {'有効' if is_valid else '無効'}")
            
            overall_status = "✅ 全て有効" if validation_results.get('all_valid') else "❌ 一部無効"
            print(f"\n総合結果: {overall_status}")
            
        except Exception as e:
            print(f"❌ API認証情報検証エラー: {e}")
    
    def _final_verification(self):
        """最終検証"""
        print("最終的な設定状態を確認中...")
        
        # Keychainヘルスチェック
        health = self.keychain_manager.health_check()
        
        print(f"Keychain接続: {'✅' if health['keychain_accessible'] else '❌'}")
        print(f"認証情報数: {health['credentials_count']}件")
        
        if health['errors']:
            print("❌ エラー:")
            for error in health['errors']:
                print(f"  • {error}")
        
        # 設定完了の成功率計算
        credentials = self.keychain_manager.retrieve_all_credentials()
        required_keys = [key for key, config in self.api_credentials.items() if config['required']]
        set_required = sum(1 for key in required_keys if key in credentials)
        
        success_rate = set_required / len(required_keys) if required_keys else 0
        
        print(f"\n必須設定完了率: {set_required}/{len(required_keys)} ({success_rate:.1%})")
        
        if success_rate == 1.0:
            print("🎉 全ての必須設定が完了しました！")
        elif success_rate >= 0.8:
            print("⚠️  ほぼ完了していますが、一部未設定項目があります。")
        else:
            print("❌ 多くの項目が未設定です。設定を完了してください。")
    
    # バリデーション関数
    def _validate_youtube_key(self, key: str) -> bool:
        """YouTube API Key検証"""
        return len(key) > 30 and not key.startswith('sk-')
    
    def _validate_claude_key(self, key: str) -> bool:
        """Claude API Key検証"""
        return key.startswith('sk-') and len(key) > 40
    
    def _validate_notion_token(self, token: str) -> bool:
        """Notion Token検証"""
        return len(token) > 40 and token.startswith('secret_')
    
    def _validate_notion_database_id(self, db_id: str) -> bool:
        """Notion Database ID検証"""
        import re
        # UUIDフォーマット（ハイフンあり・なし両対応）
        uuid_pattern = r'^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$'
        return bool(re.match(uuid_pattern, db_id.replace('-', '')))
    
    def _validate_gmail_client_id(self, client_id: str) -> bool:
        """Gmail Client ID検証"""
        return '.googleusercontent.com' in client_id and len(client_id) > 50
    
    def _validate_gmail_client_secret(self, client_secret: str) -> bool:
        """Gmail Client Secret検証"""
        return len(client_secret) > 20


def setup_keychain_environment():
    """Keychain環境設定メイン関数"""
    try:
        wizard = KeychainSetupWizard()
        wizard.run_setup()
    except Exception as e:
        print(f"❌ 設定エラー: {e}")
        logging.error(f"設定エラー: {e}")
        sys.exit(1)


def main():
    """メイン関数"""
    setup_keychain_environment()


if __name__ == "__main__":
    main()