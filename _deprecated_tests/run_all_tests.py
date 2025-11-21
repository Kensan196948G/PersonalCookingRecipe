#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全テスト実行スクリプト
PersonalCookingRecipe - 3チャンネル統合レシピ監視システム

包括的なテストスイートの実行とレポート生成を行います。
"""

import os
import sys
import subprocess
import argparse
import logging
import json
import time
import tempfile
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

# プロジェクトルート設定
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "config"))

# テスト結果格納クラス
class TestResults:
    def __init__(self):
        self.results = {}
        self.start_time = None
        self.end_time = None
        self.total_duration = 0
        self.summary = {
            'total_tests': 0,
            'passed_tests': 0,
            'failed_tests': 0,
            'skipped_tests': 0,
            'error_tests': 0,
            'success_rate': 0.0
        }
    
    def start_timing(self):
        """テスト実行開始時間記録"""
        self.start_time = time.time()
    
    def end_timing(self):
        """テスト実行終了時間記録"""
        self.end_time = time.time()
        self.total_duration = self.end_time - self.start_time
    
    def add_test_result(self, test_name: str, result: Dict[str, Any]):
        """テスト結果追加"""
        self.results[test_name] = result
        
        # サマリー更新
        self.summary['total_tests'] += result.get('total', 0)
        self.summary['passed_tests'] += result.get('passed', 0)
        self.summary['failed_tests'] += result.get('failed', 0)
        self.summary['skipped_tests'] += result.get('skipped', 0)
        self.summary['error_tests'] += result.get('errors', 0)
    
    def calculate_success_rate(self):
        """成功率計算"""
        if self.summary['total_tests'] > 0:
            self.summary['success_rate'] = (
                self.summary['passed_tests'] / self.summary['total_tests']
            )
        else:
            self.summary['success_rate'] = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """辞書形式で結果を返す"""
        return {
            'test_results': self.results,
            'summary': self.summary,
            'timing': {
                'start_time': self.start_time,
                'end_time': self.end_time,
                'total_duration': self.total_duration
            }
        }


class TestRunner:
    """包括的テスト実行クラス"""
    
    def __init__(self, project_root: Path = PROJECT_ROOT):
        self.project_root = project_root
        self.tests_dir = project_root / "tests"
        self.results = TestResults()
        self.logger = self._setup_logger()
        
        # テスト設定
        self.test_modules = {
            'api_connections': {
                'file': 'test_api_connections.py',
                'description': 'API接続テスト',
                'markers': [],
                'required': True
            },
            'system_integration': {
                'file': 'test_system_integration.py',
                'description': 'システム統合テスト',
                'markers': ['integration'],
                'required': True
            },
            'security': {
                'file': 'test_security.py',
                'description': 'セキュリティテスト',
                'markers': ['security'],
                'required': True
            },
            'performance': {
                'file': 'test_performance.py',
                'description': 'パフォーマンステスト',
                'markers': ['slow'],
                'required': False
            },
            'ui_components': {
                'file': 'test_ui_components.py',
                'description': 'UIコンポーネントテスト',
                'markers': ['ui'],
                'required': False
            },
            'e2e_selenium': {
                'file': 'test_e2e_selenium.py',
                'description': 'E2E Seleniumテスト',
                'markers': ['e2e'],
                'required': False
            },
            'macos_integration': {
                'file': 'test_macos_integration.py',
                'description': 'macOS統合テスト',
                'markers': ['macos'],
                'required': sys.platform == 'darwin'
            }
        }
    
    def _setup_logger(self) -> logging.Logger:
        """ログ設定"""
        logger = logging.getLogger('test_runner')
        logger.setLevel(logging.INFO)
        
        # コンソールハンドラー
        console_handler = logging.StreamHandler(sys.stdout)
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        logger.addHandler(console_handler)
        
        return logger
    
    def run_single_test(self, test_name: str, test_config: Dict[str, Any]) -> Dict[str, Any]:
        """単一テスト実行"""
        test_file = self.tests_dir / test_config['file']
        
        if not test_file.exists():
            return {
                'status': 'skipped',
                'reason': 'Test file not found',
                'total': 0,
                'passed': 0,
                'failed': 0,
                'skipped': 1,
                'errors': 0,
                'duration': 0
            }
        
        self.logger.info(f"🧪 実行中: {test_config['description']}")
        
        # pytest引数構築
        pytest_args = [
            sys.executable, '-m', 'pytest',
            str(test_file),
            '-v',
            '--tb=short',
            '--strict-markers',
            '--json-report',
            '--json-report-file=/tmp/test_report.json'
        ]
        
        # マーカー指定
        if test_config['markers']:
            marker_expr = ' or '.join(test_config['markers'])
            pytest_args.extend(['-m', marker_expr])
        
        start_time = time.time()
        
        try:
            # テスト実行
            result = subprocess.run(
                pytest_args,
                capture_output=True,
                text=True,
                timeout=300,  # 5分タイムアウト
                cwd=self.project_root
            )
            
            duration = time.time() - start_time
            
            # JSON レポート読み込み
            try:
                with open('/tmp/test_report.json', 'r') as f:
                    report_data = json.load(f)
                
                summary = report_data.get('summary', {})
                
                test_result = {
                    'status': 'completed',
                    'return_code': result.returncode,
                    'total': summary.get('total', 0),
                    'passed': summary.get('passed', 0),
                    'failed': summary.get('failed', 0),
                    'skipped': summary.get('skipped', 0),
                    'errors': summary.get('error', 0),
                    'duration': duration,
                    'stdout': result.stdout[-1000:],  # 最後の1000文字
                    'stderr': result.stderr[-1000:] if result.stderr else ''
                }
                
                # ステータス判定
                if result.returncode == 0:
                    self.logger.info(f"✅ 成功: {test_config['description']} ({duration:.1f}秒)")
                else:
                    self.logger.error(f"❌ 失敗: {test_config['description']} (終了コード: {result.returncode})")
                
            except (FileNotFoundError, json.JSONDecodeError):
                # JSONレポートが読み込めない場合
                test_result = {
                    'status': 'completed',
                    'return_code': result.returncode,
                    'total': 1,
                    'passed': 1 if result.returncode == 0 else 0,
                    'failed': 0 if result.returncode == 0 else 1,
                    'skipped': 0,
                    'errors': 0,
                    'duration': duration,
                    'stdout': result.stdout[-1000:],
                    'stderr': result.stderr[-1000:] if result.stderr else ''
                }
        
        except subprocess.TimeoutExpired:
            duration = time.time() - start_time
            test_result = {
                'status': 'timeout',
                'return_code': -1,
                'total': 1,
                'passed': 0,
                'failed': 0,
                'skipped': 0,
                'errors': 1,
                'duration': duration,
                'stdout': '',
                'stderr': 'Test execution timed out'
            }
            self.logger.error(f"⏰ タイムアウト: {test_config['description']}")
        
        except Exception as e:
            duration = time.time() - start_time
            test_result = {
                'status': 'error',
                'return_code': -2,
                'total': 1,
                'passed': 0,
                'failed': 0,
                'skipped': 0,
                'errors': 1,
                'duration': duration,
                'stdout': '',
                'stderr': str(e)
            }
            self.logger.error(f"💥 例外: {test_config['description']} - {e}")
        
        finally:
            # 一時ファイルクリーンアップ
            try:
                os.unlink('/tmp/test_report.json')
            except FileNotFoundError:
                pass
        
        return test_result
    
    def run_all_tests(self, include_optional: bool = False, specific_tests: Optional[List[str]] = None) -> TestResults:
        """全テスト実行"""
        self.results = TestResults()
        self.results.start_timing()
        
        self.logger.info("🚀 Recipe Monitor 包括的テストスイート開始")
        self.logger.info(f"📁 プロジェクトルート: {self.project_root}")
        self.logger.info(f"🧪 テストディレクトリ: {self.tests_dir}")
        
        # 実行するテストを決定
        tests_to_run = {}
        
        for test_name, test_config in self.test_modules.items():
            should_run = False
            
            # 特定テスト指定がある場合
            if specific_tests:
                should_run = test_name in specific_tests
            else:
                # 必須テストまたはオプショナルテスト含める場合
                should_run = test_config['required'] or include_optional
            
            if should_run:
                tests_to_run[test_name] = test_config
        
        self.logger.info(f"📋 実行予定テスト数: {len(tests_to_run)}")
        
        # テスト実行
        for i, (test_name, test_config) in enumerate(tests_to_run.items(), 1):
            self.logger.info(f"📊 進捗: {i}/{len(tests_to_run)} - {test_name}")
            
            result = self.run_single_test(test_name, test_config)
            self.results.add_test_result(test_name, result)
        
        self.results.end_timing()
        self.results.calculate_success_rate()
        
        self.logger.info("🏁 全テスト実行完了")
        
        return self.results
    
    def generate_report(self, results: TestResults, output_file: Optional[Path] = None) -> str:
        """テストレポート生成"""
        report_lines = [
            "=" * 80,
            "🧪 PersonalCookRecipe - 包括的テスト結果レポート",
            "=" * 80,
            "",
            f"📅 実行日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"⏱️  実行時間: {results.total_duration:.2f}秒",
            f"💻 プラットフォーム: {sys.platform}",
            f"🐍 Python: {sys.version.split()[0]}",
            "",
            "📊 テスト結果サマリー",
            "-" * 40,
            f"  総テスト数: {results.summary['total_tests']}",
            f"  ✅ 成功: {results.summary['passed_tests']}",
            f"  ❌ 失敗: {results.summary['failed_tests']}",
            f"  ⏭️  スキップ: {results.summary['skipped_tests']}",
            f"  💥 エラー: {results.summary['error_tests']}",
            f"  📈 成功率: {results.summary['success_rate']:.1%}",
            "",
            "🔍 詳細結果",
            "-" * 40
        ]
        
        for test_name, result in results.results.items():
            test_config = self.test_modules.get(test_name, {})
            description = test_config.get('description', test_name)
            
            status_icon = {
                'completed': '✅' if result['return_code'] == 0 else '❌',
                'skipped': '⏭️',
                'timeout': '⏰',
                'error': '💥'
            }.get(result['status'], '❓')
            
            report_lines.extend([
                f"{status_icon} {description}",
                f"   ステータス: {result['status']}",
                f"   実行時間: {result['duration']:.2f}秒",
                f"   成功/失敗/スキップ/エラー: {result['passed']}/{result['failed']}/{result['skipped']}/{result['errors']}",
            ])
            
            if result['stderr']:
                report_lines.append(f"   エラー: {result['stderr'][:100]}...")
            
            report_lines.append("")
        
        # 推奨事項
        report_lines.extend([
            "💡 推奨事項",
            "-" * 40
        ])
        
        if results.summary['failed_tests'] > 0:
            report_lines.append("• 失敗したテストのエラーメッセージを確認して修正してください")
        
        if results.summary['skipped_tests'] > 0:
            report_lines.append("• スキップされたテストの前提条件を確認してください")
        
        if results.summary['success_rate'] < 0.8:
            report_lines.append("• 成功率が80%を下回っています。システムの安定性を確認してください")
        
        if results.summary['success_rate'] >= 0.9:
            report_lines.append("• 🎉 優秀な結果です！システムは安定して動作しています")
        
        report_lines.extend([
            "",
            "=" * 80,
            "📋 レポート終了",
            "=" * 80
        ])
        
        report_content = "\n".join(report_lines)
        
        # ファイル出力
        if output_file:
            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(report_content)
            self.logger.info(f"📄 レポート出力: {output_file}")
        
        return report_content
    
    def save_json_results(self, results: TestResults, output_file: Path):
        """JSON形式での結果保存"""
        json_data = {
            'metadata': {
                'project': 'PersonalCookingRecipe',
                'timestamp': datetime.now().isoformat(),
                'platform': sys.platform,
                'python_version': sys.version.split()[0]
            },
            'results': results.to_dict()
        }
        
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)
        
        self.logger.info(f"💾 JSON結果保存: {output_file}")


def main():
    """メイン実行関数"""
    parser = argparse.ArgumentParser(
        description='PersonalCookRecipe - 包括的テストスイート',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
テスト種別:
  api_connections     - API接続テスト（必須）
  system_integration - システム統合テスト（必須）
  security           - セキュリティテスト（必須）
  performance        - パフォーマンステスト（オプショナル）
  ui_components      - UIコンポーネントテスト（オプショナル）
  e2e_selenium       - E2E Seleniumテスト（オプショナル）
  macos_integration  - macOS統合テスト（macOSでは必須）

例:
  python run_all_tests.py                      # 必須テストのみ実行
  python run_all_tests.py --include-optional   # 全テスト実行
  python run_all_tests.py --tests api_connections security  # 特定テストのみ
  python run_all_tests.py --output-dir ./test_results      # 結果出力先指定
        """
    )
    
    parser.add_argument(
        '--include-optional',
        action='store_true',
        help='オプショナルテストも含めて実行'
    )
    
    parser.add_argument(
        '--tests',
        nargs='*',
        help='実行する特定のテスト名を指定'
    )
    
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=PROJECT_ROOT / 'test_results',
        help='テスト結果の出力ディレクトリ（デフォルト: ./test_results）'
    )
    
    parser.add_argument(
        '--quiet',
        action='store_true',
        help='最小限の出力のみ'
    )
    
    parser.add_argument(
        '--json-only',
        action='store_true',
        help='JSON結果のみ保存（レポート生成をスキップ）'
    )
    
    args = parser.parse_args()
    
    # ログレベル設定
    if args.quiet:
        logging.getLogger('test_runner').setLevel(logging.WARNING)
    
    # テストランナー初期化
    runner = TestRunner()
    
    # テスト実行
    try:
        results = runner.run_all_tests(
            include_optional=args.include_optional,
            specific_tests=args.tests
        )
        
        # 結果出力
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # JSON結果保存
        json_file = args.output_dir / f"test_results_{timestamp}.json"
        runner.save_json_results(results, json_file)
        
        # レポート生成
        if not args.json_only:
            report_file = args.output_dir / f"test_report_{timestamp}.txt"
            report_content = runner.generate_report(results, report_file)
            
            if not args.quiet:
                print("\n" + report_content)
        
        # 終了コード決定
        if results.summary['failed_tests'] > 0 or results.summary['error_tests'] > 0:
            print(f"\n❌ テスト失敗: {results.summary['failed_tests']} failures, {results.summary['error_tests']} errors")
            sys.exit(1)
        elif results.summary['total_tests'] == 0:
            print("\n⚠️ 実行されたテストがありません")
            sys.exit(2)
        else:
            print(f"\n✅ 全テスト成功: {results.summary['passed_tests']}/{results.summary['total_tests']} passed")
            sys.exit(0)
    
    except KeyboardInterrupt:
        print("\n🛑 ユーザーによりテスト実行が中断されました")
        sys.exit(130)
    
    except Exception as e:
        print(f"\n💥 テスト実行中に予期しないエラーが発生しました: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()