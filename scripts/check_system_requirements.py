#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PersonalCookRecipe - システム要件確認スクリプト
macOS環境での前提条件を確認し、インストール準備状況をチェックする

Author: Claude Code + Agents
Date: 2025-07-26
Platform: macOS 12 (Monterey) 以降
"""

import platform
import subprocess
import sys
import shutil
import os
from pathlib import Path
from typing import Dict, List, Tuple, Optional

class SystemChecker:
    """macOS環境のシステム要件確認クラス"""
    
    def __init__(self):
        self.requirements = {
            'os_version': '12.0',  # macOS Monterey以降
            'python_version': '3.8',  # Python 3.8以上
            'disk_space_gb': 5,  # 最低5GB
            'memory_gb': 4,  # 最低4GB
            'required_commands': ['curl', 'git', 'brew'],
            'homebrew_packages': ['python@3.11', 'git', 'wget']
        }
        self.check_results = {}
        
    def check_all(self) -> Dict[str, bool]:
        """全システム要件を確認"""
        print("=== PersonalCookRecipe システム要件確認開始 ===")
        print("macOS環境での3チャンネル統合レシピ監視システムの要件をチェックします\n")
        
        # 各項目をチェック
        self.check_results['os_version'] = self.check_macos_version()
        self.check_results['python_version'] = self.check_python_version()
        self.check_results['homebrew'] = self.check_homebrew()
        self.check_results['commands'] = self.check_required_commands()
        self.check_results['disk_space'] = self.check_disk_space()
        self.check_results['memory'] = self.check_memory()
        self.check_results['permissions'] = self.check_permissions()
        
        # 結果サマリー表示
        self.display_summary()
        
        return self.check_results
    
    def check_macos_version(self) -> bool:
        """macOSバージョン確認"""
        print("📱 macOSバージョン確認中...")
        
        try:
            # sw_vers -productVersion コマンドでバージョン取得
            result = subprocess.run(
                ['sw_vers', '-productVersion'], 
                capture_output=True, 
                text=True, 
                check=True
            )
            
            current_version = result.stdout.strip()
            print(f"   現在のmacOSバージョン: {current_version}")
            
            # バージョン比較（メジャーバージョンのみ）
            current_major = float('.'.join(current_version.split('.')[:2]))
            required_major = float(self.requirements['os_version'])
            
            if current_major >= required_major:
                print(f"   ✅ macOS {self.requirements['os_version']}以降の要件を満たしています")
                return True
            else:
                print(f"   ❌ macOS {self.requirements['os_version']}以降が必要です")
                return False
                
        except subprocess.CalledProcessError as e:
            print(f"   ❌ macOSバージョン確認エラー: {e}")
            return False
    
    def check_python_version(self) -> bool:
        """Pythonバージョン確認"""
        print("🐍 Pythonバージョン確認中...")
        
        try:
            current_version = f"{sys.version_info.major}.{sys.version_info.minor}"
            print(f"   現在のPythonバージョン: {current_version}")
            
            required_version = float(self.requirements['python_version'])
            current_version_float = float(current_version)
            
            if current_version_float >= required_version:
                print(f"   ✅ Python {self.requirements['python_version']}以降の要件を満たしています")
                
                # Python3.11の推奨確認
                if current_version_float >= 3.11:
                    print("   🌟 Python 3.11以降を使用中（推奨）")
                else:
                    print("   ⚠️  Python 3.11以降の使用を推奨します")
                
                return True
            else:
                print(f"   ❌ Python {self.requirements['python_version']}以降が必要です")
                return False
                
        except Exception as e:
            print(f"   ❌ Pythonバージョン確認エラー: {e}")
            return False
    
    def check_homebrew(self) -> bool:
        """Homebrewインストール確認"""
        print("🍺 Homebrew確認中...")
        
        try:
            result = subprocess.run(
                ['brew', '--version'], 
                capture_output=True, 
                text=True, 
                check=True
            )
            
            version_info = result.stdout.split('\n')[0]
            print(f"   {version_info}")
            print("   ✅ Homebrewがインストールされています")
            
            # Homebrewパッケージ確認
            self._check_homebrew_packages()
            
            return True
            
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("   ❌ Homebrewがインストールされていません")
            print("   📝 以下のコマンドでインストールしてください:")
            print('   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"')
            return False
    
    def _check_homebrew_packages(self):
        """必要なHomebrewパッケージ確認"""
        print("   📦 必要パッケージ確認中...")
        
        for package in self.requirements['homebrew_packages']:
            try:
                result = subprocess.run(
                    ['brew', 'list', package], 
                    capture_output=True, 
                    text=True, 
                    check=True
                )
                print(f"      ✅ {package}: インストール済み")
            except subprocess.CalledProcessError:
                print(f"      ⚠️  {package}: 未インストール（自動インストールで対応）")
    
    def check_required_commands(self) -> bool:
        """必要コマンド存在確認"""
        print("⚙️  必要コマンド確認中...")
        
        all_commands_available = True
        
        for command in self.requirements['required_commands']:
            if shutil.which(command):
                print(f"   ✅ {command}: 利用可能")
            else:
                print(f"   ❌ {command}: 見つかりません")
                all_commands_available = False
        
        return all_commands_available
    
    def check_disk_space(self) -> bool:
        """ディスク容量確認"""
        print("💾 ディスク容量確認中...")
        
        try:
            # ホームディレクトリの利用可能容量確認
            home_path = Path.home()
            statvfs = os.statvfs(home_path)
            
            # 利用可能容量（GB）
            available_gb = (statvfs.f_bavail * statvfs.f_frsize) / (1024**3)
            required_gb = self.requirements['disk_space_gb']
            
            print(f"   利用可能容量: {available_gb:.1f} GB")
            print(f"   必要容量: {required_gb} GB")
            
            if available_gb >= required_gb:
                print("   ✅ ディスク容量の要件を満たしています")
                return True
            else:
                print("   ❌ ディスク容量が不足しています")
                return False
                
        except Exception as e:
            print(f"   ❌ ディスク容量確認エラー: {e}")
            return False
    
    def check_memory(self) -> bool:
        """メモリ容量確認"""
        print("🧠 メモリ容量確認中...")
        
        try:
            # sysctl hw.memsize でシステムメモリ取得
            result = subprocess.run(
                ['sysctl', 'hw.memsize'], 
                capture_output=True, 
                text=True, 
                check=True
            )
            
            # メモリサイズをGBに変換
            memory_bytes = int(result.stdout.split(': ')[1])
            memory_gb = memory_bytes / (1024**3)
            required_gb = self.requirements['memory_gb']
            
            print(f"   システムメモリ: {memory_gb:.1f} GB")
            print(f"   必要メモリ: {required_gb} GB")
            
            if memory_gb >= required_gb:
                print("   ✅ メモリ容量の要件を満たしています")
                return True
            else:
                print("   ❌ メモリ容量が不足しています")
                return False
                
        except Exception as e:
            print(f"   ❌ メモリ容量確認エラー: {e}")
            return False
    
    def check_permissions(self) -> bool:
        """必要な権限確認"""
        print("🔐 権限確認中...")
        
        try:
            # ホームディレクトリ内での書き込み権限確認
            test_dir = Path.home() / "Developer"
            test_dir.mkdir(exist_ok=True)
            
            test_file = test_dir / "permission_test.tmp"
            test_file.write_text("permission test")
            test_file.unlink()
            
            print("   ✅ 必要な書き込み権限があります")
            return True
            
        except Exception as e:
            print(f"   ❌ 権限確認エラー: {e}")
            return False
    
    def display_summary(self):
        """確認結果サマリー表示"""
        print("\n" + "="*60)
        print("📊 システム要件確認結果サマリー")
        print("="*60)
        
        passed = sum(1 for result in self.check_results.values() if result)
        total = len(self.check_results)
        
        for check_name, result in self.check_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            check_display = {
                'os_version': 'macOSバージョン',
                'python_version': 'Pythonバージョン', 
                'homebrew': 'Homebrew',
                'commands': '必要コマンド',
                'disk_space': 'ディスク容量',
                'memory': 'メモリ容量',
                'permissions': 'システム権限'
            }
            
            print(f"{status} {check_display.get(check_name, check_name)}")
        
        print(f"\n合計: {passed}/{total} 項目がパス")
        
        if passed == total:
            print("\n🎉 全ての要件を満たしています！")
            print("   次のステップ: ./scripts/install.sh を実行してください")
        else:
            print(f"\n⚠️  {total - passed} 項目で問題があります")
            print("   上記の問題を解決してから再実行してください")
    
    def generate_report(self) -> str:
        """確認結果レポート生成"""
        report_lines = [
            "# PersonalCookRecipe システム要件確認レポート",
            f"実行日時: {subprocess.run(['date'], capture_output=True, text=True).stdout.strip()}",
            f"実行環境: {platform.platform()}",
            "",
            "## 確認結果"
        ]
        
        for check_name, result in self.check_results.items():
            status = "PASS" if result else "FAIL"
            report_lines.append(f"- {check_name}: {status}")
        
        return "\n".join(report_lines)


def main():
    """メイン実行関数"""
    try:
        checker = SystemChecker()
        results = checker.check_all()
        
        # レポートファイル生成
        report_dir = Path.home() / "Developer" / "tasty-recipe-monitor" / "logs"
        report_dir.mkdir(parents=True, exist_ok=True)
        
        report_file = report_dir / "system_requirements_check.md"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(checker.generate_report())
        
        print(f"\n📄 詳細レポート: {report_file}")
        
        # 終了コード決定
        all_passed = all(results.values())
        return 0 if all_passed else 1
        
    except KeyboardInterrupt:
        print("\n⚠️  ユーザーによって中断されました")
        return 130
    except Exception as e:
        print(f"\n❌ 予期しないエラー: {e}")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)