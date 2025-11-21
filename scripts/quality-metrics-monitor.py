#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
品質メトリクス監視システム
PersonalCookingRecipe - 統合品質管理ダッシュボード
"""

import os
import sys
import json
import time
import sqlite3
import subprocess
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging
import argparse
from dataclasses import dataclass, asdict
import psutil
import requests

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('monitoring/logs/quality-metrics.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class QualityMetrics:
    """品質メトリクスデータクラス"""
    timestamp: str
    test_results: Dict[str, Any]
    coverage: Dict[str, float]
    performance: Dict[str, float]
    security: Dict[str, Any]
    code_quality: Dict[str, Any]
    deployment_status: str
    error_rate: float
    success_rate: float

@dataclass
class SystemMetrics:
    """システムメトリクスデータクラス"""
    timestamp: str
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    active_processes: int
    database_connections: int

class QualityMetricsCollector:
    """品質メトリクス収集クラス"""
    
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.db_path = self.project_root / "monitoring" / "quality-metrics.db"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.init_database()
        
    def init_database(self):
        """データベース初期化"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS quality_metrics (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp TEXT NOT NULL,
                        test_results TEXT,
                        coverage TEXT,
                        performance TEXT,
                        security TEXT,
                        code_quality TEXT,
                        deployment_status TEXT,
                        error_rate REAL,
                        success_rate REAL
                    )
                """)
                
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS system_metrics (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp TEXT NOT NULL,
                        cpu_usage REAL,
                        memory_usage REAL,
                        disk_usage REAL,
                        active_processes INTEGER,
                        database_connections INTEGER
                    )
                """)
                
                # インデックス作成
                conn.execute("CREATE INDEX IF NOT EXISTS idx_quality_timestamp ON quality_metrics(timestamp)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_system_timestamp ON system_metrics(timestamp)")
                
            logger.info("データベース初期化完了")
            
        except Exception as e:
            logger.error(f"データベース初期化エラー: {e}")
            raise

    def collect_test_results(self) -> Dict[str, Any]:
        """テスト結果収集"""
        results = {
            'backend': self._run_backend_tests(),
            'frontend': self._run_frontend_tests(),
            'api': self._run_api_tests(),
            'integration': self._run_integration_tests(),
            'e2e': self._run_e2e_tests()
        }
        
        # 統計計算
        total_tests = sum([r.get('total', 0) for r in results.values() if r])
        passed_tests = sum([r.get('passed', 0) for r in results.values() if r])
        
        results['summary'] = {
            'total_tests': total_tests,
            'passed_tests': passed_tests,
            'success_rate': (passed_tests / total_tests * 100) if total_tests > 0 else 0,
            'last_run': datetime.now().isoformat()
        }
        
        return results

    def _run_backend_tests(self) -> Optional[Dict[str, Any]]:
        """Backendテスト実行"""
        try:
            os.chdir(self.project_root / "backend")
            result = subprocess.run(
                ['npm', 'test', '--', '--json', '--coverage', '--silent'],
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode == 0:
                test_data = json.loads(result.stdout)
                return {
                    'total': test_data.get('numTotalTests', 0),
                    'passed': test_data.get('numPassedTests', 0),
                    'failed': test_data.get('numFailedTests', 0),
                    'duration': test_data.get('duration', 0),
                    'coverage': self._extract_coverage_data('backend/coverage/coverage-final.json')
                }
            else:
                logger.warning(f"Backendテスト失敗: {result.stderr}")
                return {'error': result.stderr, 'total': 0, 'passed': 0, 'failed': 0}
                
        except subprocess.TimeoutExpired:
            logger.error("Backendテストタイムアウト")
            return {'error': 'timeout', 'total': 0, 'passed': 0, 'failed': 0}
        except Exception as e:
            logger.error(f"Backendテストエラー: {e}")
            return {'error': str(e), 'total': 0, 'passed': 0, 'failed': 0}
        finally:
            os.chdir(self.project_root)

    def _run_frontend_tests(self) -> Optional[Dict[str, Any]]:
        """Frontendテスト実行"""
        try:
            frontend_path = self.project_root / "src" / "frontend"
            if not frontend_path.exists():
                return None
                
            os.chdir(frontend_path)
            result = subprocess.run(
                ['npm', 'run', 'test', '--', '--reporter=json', '--coverage'],
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode == 0:
                # Vitestの結果をパース
                lines = result.stdout.split('\n')
                test_summary = {}
                for line in lines:
                    if 'Test Files' in line:
                        # テスト結果パース
                        pass
                
                return {
                    'total': test_summary.get('total', 0),
                    'passed': test_summary.get('passed', 0),
                    'failed': test_summary.get('failed', 0),
                    'coverage': self._extract_coverage_data('src/frontend/coverage/coverage-summary.json')
                }
            else:
                return {'error': result.stderr, 'total': 0, 'passed': 0, 'failed': 0}
                
        except Exception as e:
            logger.error(f"Frontendテストエラー: {e}")
            return {'error': str(e), 'total': 0, 'passed': 0, 'failed': 0}
        finally:
            os.chdir(self.project_root)

    def _run_api_tests(self) -> Optional[Dict[str, Any]]:
        """APIテスト実行"""
        try:
            api_path = self.project_root / "api"
            if not api_path.exists():
                return None
                
            os.chdir(api_path)
            
            # 仮想環境アクティベート
            venv_python = api_path / "venv" / "bin" / "python"
            if not venv_python.exists():
                venv_python = "python3"
            
            result = subprocess.run([
                str(venv_python), '-m', 'pytest', 
                '--json-report', '--json-report-file=test-results.json',
                '-v'
            ], capture_output=True, text=True, timeout=300)
            
            # 結果ファイル読み込み
            results_file = api_path / "test-results.json"
            if results_file.exists():
                with open(results_file) as f:
                    test_data = json.load(f)
                    
                return {
                    'total': test_data.get('summary', {}).get('total', 0),
                    'passed': test_data.get('summary', {}).get('passed', 0),
                    'failed': test_data.get('summary', {}).get('failed', 0),
                    'duration': test_data.get('duration', 0)
                }
            else:
                return {'error': 'No results file', 'total': 0, 'passed': 0, 'failed': 0}
                
        except Exception as e:
            logger.error(f"APIテストエラー: {e}")
            return {'error': str(e), 'total': 0, 'passed': 0, 'failed': 0}
        finally:
            os.chdir(self.project_root)

    def _run_integration_tests(self) -> Optional[Dict[str, Any]]:
        """統合テスト実行"""
        try:
            tests_path = self.project_root / "tests"
            if not tests_path.exists():
                return None
                
            os.chdir(self.project_root)
            result = subprocess.run([
                'python3', '-m', 'pytest', 'tests/',
                '--json-report', '--json-report-file=integration-results.json',
                '-m', 'integration'
            ], capture_output=True, text=True, timeout=600)
            
            results_file = self.project_root / "integration-results.json"
            if results_file.exists():
                with open(results_file) as f:
                    test_data = json.load(f)
                    
                return {
                    'total': test_data.get('summary', {}).get('total', 0),
                    'passed': test_data.get('summary', {}).get('passed', 0),
                    'failed': test_data.get('summary', {}).get('failed', 0)
                }
            else:
                return {'total': 0, 'passed': 0, 'failed': 0}
                
        except Exception as e:
            logger.error(f"統合テストエラー: {e}")
            return {'error': str(e), 'total': 0, 'passed': 0, 'failed': 0}

    def _run_e2e_tests(self) -> Optional[Dict[str, Any]]:
        """E2Eテスト実行"""
        try:
            e2e_path = self.project_root / "e2e"
            if not e2e_path.exists():
                return None
                
            os.chdir(e2e_path)
            result = subprocess.run([
                'npx', 'playwright', 'test', '--reporter=json'
            ], capture_output=True, text=True, timeout=600)
            
            if result.stdout:
                test_data = json.loads(result.stdout)
                return {
                    'total': test_data.get('stats', {}).get('total', 0),
                    'passed': test_data.get('stats', {}).get('passed', 0),
                    'failed': test_data.get('stats', {}).get('failed', 0)
                }
            else:
                return {'total': 0, 'passed': 0, 'failed': 0}
                
        except Exception as e:
            logger.error(f"E2Eテストエラー: {e}")
            return {'error': str(e), 'total': 0, 'passed': 0, 'failed': 0}
        finally:
            os.chdir(self.project_root)

    def _extract_coverage_data(self, coverage_file: str) -> Dict[str, float]:
        """カバレッジデータ抽出"""
        coverage_path = self.project_root / coverage_file
        if not coverage_path.exists():
            return {'lines': 0, 'functions': 0, 'branches': 0, 'statements': 0}
            
        try:
            with open(coverage_path) as f:
                data = json.load(f)
                
            if 'total' in data:
                return {
                    'lines': data['total'].get('lines', {}).get('pct', 0),
                    'functions': data['total'].get('functions', {}).get('pct', 0),
                    'branches': data['total'].get('branches', {}).get('pct', 0),
                    'statements': data['total'].get('statements', {}).get('pct', 0)
                }
            else:
                return {'lines': 0, 'functions': 0, 'branches': 0, 'statements': 0}
                
        except Exception as e:
            logger.error(f"カバレッジデータ読み込みエラー: {e}")
            return {'lines': 0, 'functions': 0, 'branches': 0, 'statements': 0}

    def collect_performance_metrics(self) -> Dict[str, float]:
        """パフォーマンスメトリクス収集"""
        metrics = {}
        
        # API応答時間測定
        endpoints = [
            'http://localhost:3001/api/health',
            'http://localhost:3001/api/auth/login',
            'http://localhost:8001/health'
        ]
        
        for endpoint in endpoints:
            try:
                start_time = time.time()
                response = requests.get(endpoint, timeout=10)
                end_time = time.time()
                
                endpoint_name = endpoint.split('/')[-1]
                metrics[f'{endpoint_name}_response_time'] = (end_time - start_time) * 1000
                metrics[f'{endpoint_name}_status_code'] = response.status_code
                
            except requests.RequestException as e:
                logger.warning(f"エンドポイント {endpoint} アクセスエラー: {e}")
                endpoint_name = endpoint.split('/')[-1]
                metrics[f'{endpoint_name}_response_time'] = -1
                metrics[f'{endpoint_name}_status_code'] = 0
        
        # データベースパフォーマンス
        try:
            start_time = time.time()
            with sqlite3.connect(self.project_root / "backend" / "data" / "recipes.db") as conn:
                conn.execute("SELECT COUNT(*) FROM recipes").fetchone()
            end_time = time.time()
            
            metrics['database_query_time'] = (end_time - start_time) * 1000
        except Exception as e:
            logger.warning(f"データベースクエリエラー: {e}")
            metrics['database_query_time'] = -1
        
        return metrics

    def collect_security_metrics(self) -> Dict[str, Any]:
        """セキュリティメトリクス収集"""
        metrics = {
            'vulnerabilities': {'high': 0, 'medium': 0, 'low': 0},
            'last_scan': datetime.now().isoformat(),
            'auth_failures': 0,
            'suspicious_requests': 0
        }
        
        # npm audit結果
        try:
            os.chdir(self.project_root / "backend")
            result = subprocess.run(['npm', 'audit', '--json'], capture_output=True, text=True)
            
            if result.stdout:
                audit_data = json.loads(result.stdout)
                vulnerabilities = audit_data.get('metadata', {}).get('vulnerabilities', {})
                
                metrics['vulnerabilities'] = {
                    'high': vulnerabilities.get('high', 0),
                    'medium': vulnerabilities.get('moderate', 0),
                    'low': vulnerabilities.get('low', 0)
                }
        except Exception as e:
            logger.warning(f"npm auditエラー: {e}")
        finally:
            os.chdir(self.project_root)
        
        # ログからセキュリティイベント検出
        try:
            log_file = self.project_root / "backend" / "logs" / "access.log"
            if log_file.exists():
                with open(log_file) as f:
                    logs = f.readlines()
                    
                # 失敗した認証試行をカウント
                auth_failures = sum(1 for log in logs if "401" in log or "403" in log)
                metrics['auth_failures'] = auth_failures
                
                # 疑わしいリクエストをカウント
                suspicious = sum(1 for log in logs if any(pattern in log for pattern in [
                    "DROP TABLE", "UNION SELECT", "<script>", "javascript:"
                ]))
                metrics['suspicious_requests'] = suspicious
                
        except Exception as e:
            logger.warning(f"ログ解析エラー: {e}")
        
        return metrics

    def collect_system_metrics(self) -> SystemMetrics:
        """システムメトリクス収集"""
        return SystemMetrics(
            timestamp=datetime.now().isoformat(),
            cpu_usage=psutil.cpu_percent(interval=1),
            memory_usage=psutil.virtual_memory().percent,
            disk_usage=psutil.disk_usage('/').percent,
            active_processes=len(psutil.pids()),
            database_connections=self._count_db_connections()
        )

    def _count_db_connections(self) -> int:
        """データベース接続数カウント"""
        try:
            # SQLiteプロセス数をカウント
            count = 0
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    if 'sqlite' in proc.info['name'].lower():
                        count += 1
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            return count
        except Exception:
            return 0

    def store_quality_metrics(self, metrics: QualityMetrics):
        """品質メトリクスをデータベースに保存"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO quality_metrics 
                    (timestamp, test_results, coverage, performance, security, code_quality, 
                     deployment_status, error_rate, success_rate)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    metrics.timestamp,
                    json.dumps(metrics.test_results),
                    json.dumps(metrics.coverage),
                    json.dumps(metrics.performance),
                    json.dumps(metrics.security),
                    json.dumps(metrics.code_quality),
                    metrics.deployment_status,
                    metrics.error_rate,
                    metrics.success_rate
                ))
                
        except Exception as e:
            logger.error(f"品質メトリクス保存エラー: {e}")

    def store_system_metrics(self, metrics: SystemMetrics):
        """システムメトリクスをデータベースに保存"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO system_metrics 
                    (timestamp, cpu_usage, memory_usage, disk_usage, active_processes, database_connections)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    metrics.timestamp,
                    metrics.cpu_usage,
                    metrics.memory_usage,
                    metrics.disk_usage,
                    metrics.active_processes,
                    metrics.database_connections
                ))
                
        except Exception as e:
            logger.error(f"システムメトリクス保存エラー: {e}")

    def generate_quality_report(self) -> Dict[str, Any]:
        """品質レポート生成"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # 最新の品質メトリクス取得
                cursor = conn.execute("""
                    SELECT * FROM quality_metrics 
                    ORDER BY timestamp DESC LIMIT 1
                """)
                latest_quality = cursor.fetchone()
                
                # 過去24時間のシステムメトリクス取得
                yesterday = (datetime.now() - timedelta(hours=24)).isoformat()
                cursor = conn.execute("""
                    SELECT AVG(cpu_usage), AVG(memory_usage), AVG(disk_usage)
                    FROM system_metrics 
                    WHERE timestamp > ?
                """, (yesterday,))
                avg_system = cursor.fetchone()
                
                # 品質トレンド分析
                cursor = conn.execute("""
                    SELECT success_rate, timestamp FROM quality_metrics 
                    ORDER BY timestamp DESC LIMIT 10
                """)
                success_rates = cursor.fetchall()
                
                # レポート作成
                report = {
                    'generated_at': datetime.now().isoformat(),
                    'current_quality': {
                        'success_rate': latest_quality[9] if latest_quality else 0,
                        'error_rate': latest_quality[8] if latest_quality else 100,
                        'coverage': json.loads(latest_quality[3]) if latest_quality else {},
                        'performance': json.loads(latest_quality[4]) if latest_quality else {}
                    },
                    'system_health': {
                        'avg_cpu': avg_system[0] if avg_system else 0,
                        'avg_memory': avg_system[1] if avg_system else 0,
                        'avg_disk': avg_system[2] if avg_system else 0
                    },
                    'trends': {
                        'success_rate_trend': [row[0] for row in success_rates],
                        'improvement_needed': [],
                        'recommendations': []
                    }
                }
                
                # 改善提案
                if report['current_quality']['success_rate'] < 80:
                    report['trends']['improvement_needed'].append('Test success rate below 80%')
                    report['trends']['recommendations'].append('Review failing tests and fix issues')
                
                if report['system_health']['avg_cpu'] > 80:
                    report['trends']['improvement_needed'].append('High CPU usage')
                    report['trends']['recommendations'].append('Optimize resource-intensive processes')
                
                return report
                
        except Exception as e:
            logger.error(f"品質レポート生成エラー: {e}")
            return {'error': str(e)}

class QualityMonitor:
    """品質監視メインクラス"""
    
    def __init__(self, project_root: str, interval: int = 300):
        self.collector = QualityMetricsCollector(project_root)
        self.interval = interval
        self.running = False
        self.monitor_thread = None

    def start_monitoring(self):
        """監視開始"""
        if self.running:
            logger.warning("監視は既に実行中です")
            return
            
        self.running = True
        self.monitor_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.monitor_thread.start()
        logger.info(f"品質監視開始 (間隔: {self.interval}秒)")

    def stop_monitoring(self):
        """監視停止"""
        self.running = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        logger.info("品質監視停止")

    def _monitoring_loop(self):
        """監視ループ"""
        while self.running:
            try:
                # メトリクス収集
                logger.info("品質メトリクス収集開始")
                
                test_results = self.collector.collect_test_results()
                performance = self.collector.collect_performance_metrics()
                security = self.collector.collect_security_metrics()
                system_metrics = self.collector.collect_system_metrics()
                
                # カバレッジ統合
                total_coverage = {}
                for component in ['backend', 'frontend', 'api']:
                    if component in test_results and 'coverage' in test_results[component]:
                        coverage = test_results[component]['coverage']
                        for metric, value in coverage.items():
                            if metric not in total_coverage:
                                total_coverage[metric] = []
                            total_coverage[metric].append(value)
                
                # 平均カバレッジ計算
                avg_coverage = {}
                for metric, values in total_coverage.items():
                    avg_coverage[metric] = sum(values) / len(values) if values else 0
                
                # エラー率計算
                total_tests = test_results.get('summary', {}).get('total_tests', 1)
                passed_tests = test_results.get('summary', {}).get('passed_tests', 0)
                success_rate = test_results.get('summary', {}).get('success_rate', 0)
                error_rate = 100 - success_rate
                
                # 品質メトリクス作成
                quality_metrics = QualityMetrics(
                    timestamp=datetime.now().isoformat(),
                    test_results=test_results,
                    coverage=avg_coverage,
                    performance=performance,
                    security=security,
                    code_quality={'complexity': 'medium', 'maintainability': 'high'},
                    deployment_status='stable',
                    error_rate=error_rate,
                    success_rate=success_rate
                )
                
                # データベース保存
                self.collector.store_quality_metrics(quality_metrics)
                self.collector.store_system_metrics(system_metrics)
                
                logger.info(f"メトリクス収集完了 - 成功率: {success_rate:.1f}%")
                
                # アラートチェック
                self._check_alerts(quality_metrics, system_metrics)
                
            except Exception as e:
                logger.error(f"監視ループエラー: {e}")
            
            # 次回実行まで待機
            time.sleep(self.interval)

    def _check_alerts(self, quality_metrics: QualityMetrics, system_metrics: SystemMetrics):
        """アラートチェック"""
        alerts = []
        
        # 品質アラート
        if quality_metrics.success_rate < 80:
            alerts.append(f"テスト成功率が低下: {quality_metrics.success_rate:.1f}%")
        
        if quality_metrics.error_rate > 20:
            alerts.append(f"エラー率が高い: {quality_metrics.error_rate:.1f}%")
        
        # システムアラート
        if system_metrics.cpu_usage > 90:
            alerts.append(f"CPU使用率が高い: {system_metrics.cpu_usage:.1f}%")
        
        if system_metrics.memory_usage > 90:
            alerts.append(f"メモリ使用率が高い: {system_metrics.memory_usage:.1f}%")
        
        # セキュリティアラート
        high_vulns = quality_metrics.security.get('vulnerabilities', {}).get('high', 0)
        if high_vulns > 0:
            alerts.append(f"高リスク脆弱性検出: {high_vulns}件")
        
        # アラート通知
        if alerts:
            logger.warning("🚨 アラート発生:")
            for alert in alerts:
                logger.warning(f"  - {alert}")
            
            # Slack通知など（実装必要）
            self._send_alerts(alerts)

    def _send_alerts(self, alerts: List[str]):
        """アラート通知送信"""
        # TODO: Slack, Discord, メール通知の実装
        pass

    def generate_dashboard_data(self) -> Dict[str, Any]:
        """ダッシュボード用データ生成"""
        report = self.collector.generate_quality_report()
        return {
            'last_updated': datetime.now().isoformat(),
            'quality_report': report,
            'status': 'healthy' if report.get('current_quality', {}).get('success_rate', 0) > 80 else 'warning'
        }

def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(description='品質メトリクス監視システム')
    parser.add_argument('--project-root', default='.', help='プロジェクトルートディレクトリ')
    parser.add_argument('--interval', type=int, default=300, help='監視間隔（秒）')
    parser.add_argument('--daemon', action='store_true', help='デーモンモードで実行')
    parser.add_argument('--report', action='store_true', help='レポート生成のみ')
    
    args = parser.parse_args()
    
    if args.report:
        # レポート生成のみ
        collector = QualityMetricsCollector(args.project_root)
        report = collector.generate_quality_report()
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return
    
    # 監視開始
    monitor = QualityMonitor(args.project_root, args.interval)
    
    try:
        monitor.start_monitoring()
        
        if args.daemon:
            # デーモンモード（無限ループ）
            while True:
                time.sleep(60)
        else:
            # 対話モード
            input("Enterキーで監視を停止...")
    
    except KeyboardInterrupt:
        logger.info("監視停止要求を受信")
    finally:
        monitor.stop_monitoring()

if __name__ == "__main__":
    main()