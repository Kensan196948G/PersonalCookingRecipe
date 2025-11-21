#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
パフォーマンステスト
PersonalCookingRecipe - 3チャンネル統合レシピ監視システム

システムパフォーマンスの測定と最適化の検証を行います。
"""

import os
import sys
import pytest
import asyncio
import logging
import time
import threading
from pathlib import Path
from typing import Dict, Any, List, Callable
from unittest.mock import Mock, patch, AsyncMock
from concurrent.futures import ThreadPoolExecutor, as_completed

# プロジェクトモジュール
sys.path.append(str(Path(__file__).parent.parent / "config"))

try:
    from api_manager import APIManager, APIConnectionTester
    from keychain_manager import MacOSKeychainManager
except ImportError as e:
    pytest.skip(f"必要なモジュールのインポートに失敗: {e}", allow_module_level=True)

# psutil import (optional)
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False


@pytest.mark.slow
class TestPerformance:
    """パフォーマンステストクラス"""
    
    @pytest.fixture(autouse=True)
    def setup(self, test_config_dir, test_logger, performance_monitor):
        """パフォーマンステストセットアップ"""
        self.config_dir = test_config_dir
        self.logger = test_logger
        self.monitor = performance_monitor
        
        # システムコンポーネント初期化
        self.keychain_manager = MacOSKeychainManager()
        self.api_manager = APIManager(self.config_dir)
        self.connection_tester = APIConnectionTester(self.api_manager)
        
        self.logger.info("パフォーマンステストセットアップ完了")
    
    def test_keychain_performance(self):
        """Keychain操作パフォーマンステスト"""
        self.logger.info("Keychain操作パフォーマンステスト開始")
        
        # テスト設定
        test_iterations = 100
        test_credentials = [f"PERF_TEST_KEY_{i}" for i in range(test_iterations)]
        test_values = [f"test_value_{i}_{'x' * 50}" for i in range(test_iterations)]
        
        performance_metrics = {
            'write_operations': [],
            'read_operations': [],
            'delete_operations': [],
            'total_time': 0
        }
        
        try:
            self.monitor.start()
            start_time = time.time()
            
            # 書き込み性能テスト
            self.logger.info("Keychain書き込み性能テスト")
            write_start = time.time()
            
            for key, value in zip(test_credentials, test_values):
                operation_start = time.time()
                success = self.keychain_manager.add_password(key, value)
                operation_time = time.time() - operation_start
                
                performance_metrics['write_operations'].append({
                    'success': success,
                    'time': operation_time
                })
            
            write_total_time = time.time() - write_start
            
            # 読み込み性能テスト
            self.logger.info("Keychain読み込み性能テスト")
            read_start = time.time()
            
            for key in test_credentials:
                operation_start = time.time()
                value = self.keychain_manager.get_password(key)
                operation_time = time.time() - operation_start
                
                performance_metrics['read_operations'].append({
                    'success': value is not None,
                    'time': operation_time
                })
            
            read_total_time = time.time() - read_start
            
            # 削除性能テスト
            self.logger.info("Keychain削除性能テスト")
            delete_start = time.time()
            
            for key in test_credentials:
                operation_start = time.time()
                success = self.keychain_manager.delete_password(key)
                operation_time = time.time() - operation_start
                
                performance_metrics['delete_operations'].append({
                    'success': success,
                    'time': operation_time
                })
            
            delete_total_time = time.time() - delete_start
            
            performance_metrics['total_time'] = time.time() - start_time
            self.monitor.stop()
            
            # パフォーマンス分析
            write_times = [op['time'] for op in performance_metrics['write_operations']]
            read_times = [op['time'] for op in performance_metrics['read_operations']]
            delete_times = [op['time'] for op in performance_metrics['delete_operations']]
            
            avg_write_time = sum(write_times) / len(write_times)
            avg_read_time = sum(read_times) / len(read_times)
            avg_delete_time = sum(delete_times) / len(delete_times)
            
            self.logger.info(f"Keychain性能結果:")
            self.logger.info(f"  書き込み - 平均: {avg_write_time:.3f}秒, 合計: {write_total_time:.3f}秒")
            self.logger.info(f"  読み込み - 平均: {avg_read_time:.3f}秒, 合計: {read_total_time:.3f}秒")
            self.logger.info(f"  削除 - 平均: {avg_delete_time:.3f}秒, 合計: {delete_total_time:.3f}秒")
            self.logger.info(f"  総実行時間: {performance_metrics['total_time']:.3f}秒")
            
            if self.monitor.elapsed_time:
                self.logger.info(f"  監視時間: {self.monitor.elapsed_time:.3f}秒")
            
            if self.monitor.peak_memory_usage and PSUTIL_AVAILABLE:
                self.logger.info(f"  ピークメモリ使用量: {self.monitor.peak_memory_usage / 1024 / 1024:.2f}MB")
            
            # パフォーマンス基準の確認
            assert avg_write_time < 0.5, f"Keychain書き込み性能が基準を下回ります: {avg_write_time:.3f}秒"
            assert avg_read_time < 0.3, f"Keychain読み込み性能が基準を下回ります: {avg_read_time:.3f}秒"
            assert avg_delete_time < 0.3, f"Keychain削除性能が基準を下回ります: {avg_delete_time:.3f}秒"
            
        except Exception as e:
            self.logger.error(f"Keychain性能テスト例外: {e}")
            pytest.fail(f"Keychain性能テスト失敗: {e}")
    
    @pytest.mark.asyncio
    async def test_concurrent_api_performance(self):
        """並行API操作パフォーマンステスト"""
        self.logger.info("並行API操作パフォーマンステスト開始")
        
        # テスト設定
        concurrent_requests = 10
        request_batches = 5
        
        performance_results = {
            'sequential_time': 0,
            'concurrent_time': 0,
            'speedup_ratio': 0,
            'success_rate': 0
        }
        
        try:
            # モックAPIレスポンス設定
            with patch('httpx.AsyncClient') as mock_client:
                # レスポンス遅延をシミュレート
                async def mock_request_with_delay(*args, **kwargs):
                    await asyncio.sleep(0.1)  # 100ms遅延
                    mock_response = Mock()
                    mock_response.status_code = 200
                    mock_response.json.return_value = {"status": "success", "data": "test"}
                    return mock_response
                
                mock_client.return_value.__aenter__.return_value.get = mock_request_with_delay
                mock_client.return_value.__aenter__.return_value.post = mock_request_with_delay
                
                # 1. シーケンシャル実行性能測定
                self.logger.info("シーケンシャルAPI実行測定")
                sequential_start = time.time()
                
                sequential_results = []
                for batch in range(request_batches):
                    for req in range(concurrent_requests):
                        result = await self.connection_tester.test_youtube_connection()
                        sequential_results.append(result)
                
                performance_results['sequential_time'] = time.time() - sequential_start
                
                # 2. 並行実行性能測定
                self.logger.info("並行API実行測定")
                concurrent_start = time.time()
                
                concurrent_results = []
                for batch in range(request_batches):
                    # 並行タスク作成
                    tasks = []
                    for req in range(concurrent_requests):
                        tasks.append(self.connection_tester.test_youtube_connection())
                    
                    # 並行実行
                    batch_results = await asyncio.gather(*tasks, return_exceptions=True)
                    concurrent_results.extend(batch_results)
                
                performance_results['concurrent_time'] = time.time() - concurrent_start
                
                # パフォーマンス分析
                if performance_results['concurrent_time'] > 0:
                    performance_results['speedup_ratio'] = (
                        performance_results['sequential_time'] / performance_results['concurrent_time']
                    )
                
                # 成功率計算
                total_requests = request_batches * concurrent_requests
                successful_sequential = sum(1 for r in sequential_results if isinstance(r, dict) and r.get('success'))
                successful_concurrent = sum(1 for r in concurrent_results if isinstance(r, dict) and r.get('success'))
                
                performance_results['success_rate'] = (
                    (successful_sequential + successful_concurrent) / (total_requests * 2)
                )
                
                self.logger.info(f"並行API性能結果:")
                self.logger.info(f"  シーケンシャル時間: {performance_results['sequential_time']:.3f}秒")
                self.logger.info(f"  並行実行時間: {performance_results['concurrent_time']:.3f}秒")
                self.logger.info(f"  スピードアップ比: {performance_results['speedup_ratio']:.2f}倍")
                self.logger.info(f"  成功率: {performance_results['success_rate']:.2%}")
                
                # パフォーマンス基準の確認
                assert performance_results['speedup_ratio'] >= 2.0, f"並行実行スピードアップが不十分: {performance_results['speedup_ratio']:.2f}倍"
                assert performance_results['success_rate'] >= 0.8, f"API成功率が基準を下回ります: {performance_results['success_rate']:.2%}"
        
        except Exception as e:
            self.logger.error(f"並行API性能テスト例外: {e}")
            pytest.fail(f"並行API性能テスト失敗: {e}")
    
    def test_memory_usage_optimization(self):
        """メモリ使用量最適化テスト"""
        self.logger.info("メモリ使用量最適化テスト開始")
        
        if not PSUTIL_AVAILABLE:
            pytest.skip("psutilが利用できないため、メモリ使用量テストをスキップ")
        
        memory_metrics = {
            'initial_memory': 0,
            'peak_memory': 0,
            'final_memory': 0,
            'memory_leak_detected': False
        }
        
        try:
            # 初期メモリ使用量
            process = psutil.Process()
            memory_metrics['initial_memory'] = process.memory_info().rss
            
            # 大量データ処理シミュレーション
            self.logger.info("大量データ処理シミュレーション")
            large_data_sets = []
            
            for i in range(100):
                # 大きなデータセットを作成
                large_data = {
                    'recipes': [
                        {
                            'id': f'recipe_{j}',
                            'title': f'Recipe Title {j}' + 'x' * 100,
                            'description': f'Recipe Description {j}' + 'x' * 500,
                            'ingredients': [f'ingredient_{k}' for k in range(20)],
                            'steps': [f'step_{k}' + 'x' * 50 for k in range(10)]
                        }
                        for j in range(10)
                    ]
                }
                large_data_sets.append(large_data)
                
                # メモリ使用量監視
                current_memory = process.memory_info().rss
                memory_metrics['peak_memory'] = max(memory_metrics['peak_memory'], current_memory)
            
            # データセット削除
            del large_data_sets
            
            # ガベージコレクション実行
            import gc
            gc.collect()
            
            # 最終メモリ使用量
            memory_metrics['final_memory'] = process.memory_info().rss
            
            # メモリリーク検出
            memory_increase = memory_metrics['final_memory'] - memory_metrics['initial_memory']
            memory_leak_threshold = 50 * 1024 * 1024  # 50MB
            memory_metrics['memory_leak_detected'] = memory_increase > memory_leak_threshold
            
            # メモリ統計
            initial_mb = memory_metrics['initial_memory'] / 1024 / 1024
            peak_mb = memory_metrics['peak_memory'] / 1024 / 1024
            final_mb = memory_metrics['final_memory'] / 1024 / 1024
            increase_mb = memory_increase / 1024 / 1024
            
            self.logger.info(f"メモリ使用量結果:")
            self.logger.info(f"  初期メモリ: {initial_mb:.2f}MB")
            self.logger.info(f"  ピークメモリ: {peak_mb:.2f}MB")
            self.logger.info(f"  最終メモリ: {final_mb:.2f}MB")
            self.logger.info(f"  メモリ増加: {increase_mb:.2f}MB")
            self.logger.info(f"  メモリリーク検出: {memory_metrics['memory_leak_detected']}")
            
            # メモリ使用量基準の確認
            assert not memory_metrics['memory_leak_detected'], f"メモリリークが検出されました: {increase_mb:.2f}MB増加"
            assert peak_mb - initial_mb < 200, f"ピークメモリ使用量が過大です: {peak_mb - initial_mb:.2f}MB"
        
        except Exception as e:
            self.logger.error(f"メモリ使用量テスト例外: {e}")
            pytest.fail(f"メモリ使用量テスト失敗: {e}")
    
    def test_threading_performance(self):
        """スレッド処理パフォーマンステスト"""
        self.logger.info("スレッド処理パフォーマンステスト開始")
        
        # テスト設定
        thread_counts = [1, 2, 4, 8]
        task_count = 100
        
        threading_results = {}
        
        def cpu_intensive_task(task_id: int) -> Dict[str, Any]:
            """CPU集約的タスク"""
            # 簡単な計算処理
            result = 0
            for i in range(10000):
                result += i ** 0.5
            
            return {
                'task_id': task_id,
                'result': result,
                'thread_id': threading.current_thread().ident
            }
        
        try:
            for thread_count in thread_counts:
                self.logger.info(f"スレッド数 {thread_count} でのテスト実行")
                
                start_time = time.time()
                
                with ThreadPoolExecutor(max_workers=thread_count) as executor:
                    # タスクを並列実行
                    futures = [
                        executor.submit(cpu_intensive_task, task_id)
                        for task_id in range(task_count)
                    ]
                    
                    # 結果収集
                    results = []
                    for future in as_completed(futures):
                        try:
                            result = future.result(timeout=30)
                            results.append(result)
                        except Exception as e:
                            self.logger.error(f"タスク実行エラー: {e}")
                
                execution_time = time.time() - start_time
                threading_results[thread_count] = {
                    'execution_time': execution_time,
                    'completed_tasks': len(results),
                    'tasks_per_second': len(results) / execution_time if execution_time > 0 else 0
                }
            
            # パフォーマンス分析
            self.logger.info("スレッド処理性能結果:")
            for thread_count, result in threading_results.items():
                self.logger.info(f"  {thread_count}スレッド:")
                self.logger.info(f"    実行時間: {result['execution_time']:.3f}秒")
                self.logger.info(f"    完了タスク: {result['completed_tasks']}")
                self.logger.info(f"    処理速度: {result['tasks_per_second']:.2f}タスク/秒")
            
            # スケーラビリティ確認
            single_thread_time = threading_results[1]['execution_time']
            multi_thread_time = threading_results[min(4, max(threading_results.keys()))]['execution_time']
            
            speedup = single_thread_time / multi_thread_time if multi_thread_time > 0 else 1
            
            self.logger.info(f"マルチスレッドスピードアップ: {speedup:.2f}倍")
            
            # パフォーマンス基準の確認
            assert all(r['completed_tasks'] == task_count for r in threading_results.values()), "一部のタスクが完了していません"
            assert speedup >= 1.5, f"マルチスレッドスピードアップが不十分: {speedup:.2f}倍"
        
        except Exception as e:
            self.logger.error(f"スレッド処理性能テスト例外: {e}")
            pytest.fail(f"スレッド処理性能テスト失敗: {e}")
    
    def test_io_performance(self):
        """I/O性能テスト"""
        self.logger.info("I/O性能テスト開始")
        
        # テスト設定
        file_count = 50
        file_size_kb = 10
        test_content = "x" * (file_size_kb * 1024)
        
        io_metrics = {
            'write_time': 0,
            'read_time': 0,
            'delete_time': 0,
            'total_throughput': 0
        }
        
        temp_files = []
        
        try:
            # ファイル書き込み性能テスト
            self.logger.info("ファイル書き込み性能テスト")
            write_start = time.time()
            
            for i in range(file_count):
                temp_file = self.config_dir / f"perf_test_{i}.txt"
                with open(temp_file, 'w', encoding='utf-8') as f:
                    f.write(test_content)
                temp_files.append(temp_file)
            
            io_metrics['write_time'] = time.time() - write_start
            
            # ファイル読み込み性能テスト
            self.logger.info("ファイル読み込み性能テスト")
            read_start = time.time()
            
            read_contents = []
            for temp_file in temp_files:
                with open(temp_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    read_contents.append(content)
            
            io_metrics['read_time'] = time.time() - read_start
            
            # ファイル削除性能テスト
            self.logger.info("ファイル削除性能テスト")
            delete_start = time.time()
            
            for temp_file in temp_files:
                if temp_file.exists():
                    temp_file.unlink()
            
            io_metrics['delete_time'] = time.time() - delete_start
            
            # スループット計算
            total_data_mb = (file_count * file_size_kb) / 1024
            total_io_time = io_metrics['write_time'] + io_metrics['read_time']
            
            if total_io_time > 0:
                io_metrics['total_throughput'] = (total_data_mb * 2) / total_io_time  # 読み書き両方
            
            # I/O性能結果
            self.logger.info(f"I/O性能結果:")
            self.logger.info(f"  ファイル数: {file_count}")
            self.logger.info(f"  ファイルサイズ: {file_size_kb}KB")
            self.logger.info(f"  書き込み時間: {io_metrics['write_time']:.3f}秒")
            self.logger.info(f"  読み込み時間: {io_metrics['read_time']:.3f}秒")
            self.logger.info(f"  削除時間: {io_metrics['delete_time']:.3f}秒")
            self.logger.info(f"  総スループット: {io_metrics['total_throughput']:.2f}MB/秒")
            
            # I/O性能基準の確認
            assert io_metrics['write_time'] < 5.0, f"ファイル書き込み性能が基準を下回ります: {io_metrics['write_time']:.3f}秒"
            assert io_metrics['read_time'] < 3.0, f"ファイル読み込み性能が基準を下回ります: {io_metrics['read_time']:.3f}秒"
            assert io_metrics['total_throughput'] > 1.0, f"I/Oスループットが基準を下回ります: {io_metrics['total_throughput']:.2f}MB/秒"
            
            # 読み込み内容確認
            assert len(read_contents) == file_count, "読み込まれたファイル数が一致しません"
            assert all(content == test_content for content in read_contents), "読み込まれた内容が一致しません"
        
        except Exception as e:
            self.logger.error(f"I/O性能テスト例外: {e}")
            # クリーンアップ
            for temp_file in temp_files:
                try:
                    if temp_file.exists():
                        temp_file.unlink()
                except Exception:
                    pass
            pytest.fail(f"I/O性能テスト失敗: {e}")
    
    def test_system_resource_utilization(self):
        """システムリソース使用率テスト"""
        self.logger.info("システムリソース使用率テスト開始")
        
        if not PSUTIL_AVAILABLE:
            pytest.skip("psutilが利用できないため、システムリソーステストをスキップ")
        
        resource_metrics = {
            'cpu_usage': [],
            'memory_usage': [],
            'disk_io': [],
            'network_io': []
        }
        
        monitoring_duration = 10  # 10秒間監視
        monitoring_interval = 0.5  # 0.5秒間隔
        
        try:
            self.logger.info(f"{monitoring_duration}秒間のシステムリソース監視")
            
            # 監視開始
            monitoring_start = time.time()
            
            while time.time() - monitoring_start < monitoring_duration:
                # CPU使用率
                cpu_percent = psutil.cpu_percent(interval=None, percpu=False)
                resource_metrics['cpu_usage'].append(cpu_percent)
                
                # メモリ使用率
                memory = psutil.virtual_memory()
                resource_metrics['memory_usage'].append(memory.percent)
                
                # ディスクI/O
                disk_io = psutil.disk_io_counters()
                if disk_io:
                    resource_metrics['disk_io'].append({
                        'read_bytes': disk_io.read_bytes,
                        'write_bytes': disk_io.write_bytes
                    })
                
                # ネットワークI/O
                network_io = psutil.net_io_counters()
                if network_io:
                    resource_metrics['network_io'].append({
                        'bytes_sent': network_io.bytes_sent,
                        'bytes_recv': network_io.bytes_recv
                    })
                
                time.sleep(monitoring_interval)
            
            # リソース使用率分析
            avg_cpu = sum(resource_metrics['cpu_usage']) / len(resource_metrics['cpu_usage'])
            max_cpu = max(resource_metrics['cpu_usage'])
            avg_memory = sum(resource_metrics['memory_usage']) / len(resource_metrics['memory_usage'])
            max_memory = max(resource_metrics['memory_usage'])
            
            self.logger.info(f"システムリソース使用率結果:")
            self.logger.info(f"  CPU使用率 - 平均: {avg_cpu:.1f}%, 最大: {max_cpu:.1f}%")
            self.logger.info(f"  メモリ使用率 - 平均: {avg_memory:.1f}%, 最大: {max_memory:.1f}%")
            self.logger.info(f"  監視サンプル数: {len(resource_metrics['cpu_usage'])}")
            
            # ディスクI/O分析
            if len(resource_metrics['disk_io']) > 1:
                disk_read_diff = resource_metrics['disk_io'][-1]['read_bytes'] - resource_metrics['disk_io'][0]['read_bytes']
                disk_write_diff = resource_metrics['disk_io'][-1]['write_bytes'] - resource_metrics['disk_io'][0]['write_bytes']
                
                self.logger.info(f"  ディスクI/O - 読み込み: {disk_read_diff / 1024 / 1024:.2f}MB, 書き込み: {disk_write_diff / 1024 / 1024:.2f}MB")
            
            # ネットワークI/O分析
            if len(resource_metrics['network_io']) > 1:
                net_sent_diff = resource_metrics['network_io'][-1]['bytes_sent'] - resource_metrics['network_io'][0]['bytes_sent']
                net_recv_diff = resource_metrics['network_io'][-1]['bytes_recv'] - resource_metrics['network_io'][0]['bytes_recv']
                
                self.logger.info(f"  ネットワークI/O - 送信: {net_sent_diff / 1024 / 1024:.2f}MB, 受信: {net_recv_diff / 1024 / 1024:.2f}MB")
            
            # リソース使用率基準の確認
            assert avg_cpu < 80.0, f"平均CPU使用率が高すぎます: {avg_cpu:.1f}%"
            assert max_cpu < 95.0, f"最大CPU使用率が高すぎます: {max_cpu:.1f}%"
            assert avg_memory < 90.0, f"平均メモリ使用率が高すぎます: {avg_memory:.1f}%"
            assert max_memory < 95.0, f"最大メモリ使用率が高すぎます: {max_memory:.1f}%"
        
        except Exception as e:
            self.logger.error(f"システムリソース使用率テスト例外: {e}")
            pytest.fail(f"システムリソース使用率テスト失敗: {e}")


def run_performance_tests():
    """パフォーマンステストの実行"""
    print("=== PersonalCookRecipe パフォーマンステスト実行 ===")
    
    pytest_args = [
        __file__,
        "-v",
        "--tb=short",
        "--strict-markers",
        "-m", "slow"
    ]
    
    return pytest.main(pytest_args)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    exit_code = run_performance_tests()
    sys.exit(exit_code)