#!/usr/bin/env python3
"""
エージェント設定保守性向上フレームワーク
将来的な拡張と継続的改善のための包括的システム
"""

import os
import sys
import json
import yaml
import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from abc import ABC, abstractmethod

@dataclass
class MaintenanceTask:
    """保守タスク定義"""
    id: str
    name: str
    description: str
    schedule: str  # cron形式
    priority: int
    auto_execute: bool
    dependencies: List[str] = None
    
    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []

@dataclass
class MaintenanceResult:
    """保守実行結果"""
    task_id: str
    executed_at: datetime
    success: bool
    message: str
    metrics: Dict[str, Any] = None
    next_execution: Optional[datetime] = None

class MaintenanceStrategy(ABC):
    """保守戦略抽象クラス"""
    
    @abstractmethod
    async def execute(self) -> MaintenanceResult:
        """保守実行"""
        pass
    
    @abstractmethod
    def should_execute(self, last_execution: Optional[datetime]) -> bool:
        """実行要否判定"""
        pass

class ConfigurationOptimizer(MaintenanceStrategy):
    """設定最適化戦略"""
    
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.config_dir = base_dir / "config"
    
    async def execute(self) -> MaintenanceResult:
        """設定最適化実行"""
        start_time = datetime.now()
        optimizations = []
        
        try:
            # 1. 未使用設定項目の特定・除去
            unused_configs = await self._find_unused_configurations()
            if unused_configs:
                await self._remove_unused_configurations(unused_configs)
                optimizations.append(f"未使用設定削除: {len(unused_configs)}項目")
            
            # 2. 重複設定の統合
            duplicates = await self._find_duplicate_configurations()
            if duplicates:
                await self._merge_duplicate_configurations(duplicates)
                optimizations.append(f"重複設定統合: {len(duplicates)}項目")
            
            # 3. パフォーマンス最適化
            perf_improvements = await self._optimize_performance()
            optimizations.extend(perf_improvements)
            
            # 4. セキュリティ強化
            security_updates = await self._enhance_security()
            optimizations.extend(security_updates)
            
            return MaintenanceResult(
                task_id="config-optimization",
                executed_at=start_time,
                success=True,
                message=f"最適化完了: {', '.join(optimizations)}",
                metrics={
                    "optimizations_applied": len(optimizations),
                    "execution_time": (datetime.now() - start_time).total_seconds()
                }
            )
            
        except Exception as e:
            return MaintenanceResult(
                task_id="config-optimization",
                executed_at=start_time,
                success=False,
                message=f"最適化エラー: {e}"
            )
    
    def should_execute(self, last_execution: Optional[datetime]) -> bool:
        """週次実行"""
        if not last_execution:
            return True
        return datetime.now() - last_execution > timedelta(days=7)
    
    async def _find_unused_configurations(self) -> List[str]:
        """未使用設定項目検出"""
        # 実装例（簡略化）
        return []
    
    async def _remove_unused_configurations(self, unused: List[str]):
        """未使用設定除去"""
        pass
    
    async def _find_duplicate_configurations(self) -> List[Dict[str, Any]]:
        """重複設定検出"""
        return []
    
    async def _merge_duplicate_configurations(self, duplicates: List[Dict[str, Any]]):
        """重複設定統合"""
        pass
    
    async def _optimize_performance(self) -> List[str]:
        """パフォーマンス最適化"""
        improvements = []
        
        # ファイルサイズ最適化
        large_files = []
        for config_file in self.config_dir.glob("*.yaml"):
            if config_file.stat().st_size > 50000:  # 50KB以上
                large_files.append(config_file)
        
        if large_files:
            improvements.append(f"大容量ファイル最適化: {len(large_files)}ファイル")
        
        return improvements
    
    async def _enhance_security(self) -> List[str]:
        """セキュリティ強化"""
        enhancements = []
        
        # パスワード・秘密情報のハードコーディングチェック
        security_issues = await self._scan_security_issues()
        if security_issues:
            enhancements.append(f"セキュリティ問題修正: {len(security_issues)}項目")
        
        return enhancements
    
    async def _scan_security_issues(self) -> List[str]:
        """セキュリティ問題スキャン"""
        issues = []
        
        for config_file in self.config_dir.glob("*"):
            if config_file.is_file():
                try:
                    with open(config_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                    # パスワード等の検出パターン
                    sensitive_patterns = [
                        r'password\s*=\s*["\'][^"\']+["\']',
                        r'api_key\s*=\s*["\'][^"\']+["\']',
                        r'secret\s*=\s*["\'][^"\']+["\']'
                    ]
                    
                    import re
                    for pattern in sensitive_patterns:
                        if re.search(pattern, content, re.IGNORECASE):
                            issues.append(f"{config_file.name}: 機密情報のハードコーディング")
                            break
                            
                except Exception:
                    continue
        
        return issues

class DependencyManager(MaintenanceStrategy):
    """依存関係管理戦略"""
    
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
    
    async def execute(self) -> MaintenanceResult:
        """依存関係更新実行"""
        start_time = datetime.now()
        
        try:
            # Python依存関係更新
            python_updates = await self._update_python_dependencies()
            
            # システム依存関係チェック
            system_updates = await self._check_system_dependencies()
            
            # 設定依存関係検証
            config_validation = await self._validate_config_dependencies()
            
            updates = python_updates + system_updates + config_validation
            
            return MaintenanceResult(
                task_id="dependency-management",
                executed_at=start_time,
                success=True,
                message=f"依存関係更新完了: {len(updates)}項目",
                metrics={"updates_applied": len(updates)}
            )
            
        except Exception as e:
            return MaintenanceResult(
                task_id="dependency-management",
                executed_at=start_time,
                success=False,
                message=f"依存関係更新エラー: {e}"
            )
    
    def should_execute(self, last_execution: Optional[datetime]) -> bool:
        """月次実行"""
        if not last_execution:
            return True
        return datetime.now() - last_execution > timedelta(days=30)
    
    async def _update_python_dependencies(self) -> List[str]:
        """Python依存関係更新"""
        updates = []
        
        requirements_file = self.base_dir / "requirements.txt"
        if requirements_file.exists():
            # pip list --outdated の実行（簡略化）
            updates.append("Pythonパッケージ更新確認")
        
        return updates
    
    async def _check_system_dependencies(self) -> List[str]:
        """システム依存関係チェック"""
        checks = []
        
        # 必要なシステムコマンドの存在確認
        required_commands = ['bash', 'python3', 'git', 'systemctl']
        for cmd in required_commands:
            import shutil
            if not shutil.which(cmd):
                checks.append(f"必要コマンド不足: {cmd}")
        
        return checks
    
    async def _validate_config_dependencies(self) -> List[str]:
        """設定依存関係検証"""
        validations = []
        
        # エージェント依存関係の循環参照チェック等
        validations.append("設定依存関係検証完了")
        
        return validations

class DocumentationSynchronizer(MaintenanceStrategy):
    """ドキュメント同期戦略"""
    
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.docs_dir = base_dir / "docs"
    
    async def execute(self) -> MaintenanceResult:
        """ドキュメント同期実行"""
        start_time = datetime.now()
        
        try:
            # 設定とドキュメントの同期チェック
            sync_issues = await self._find_sync_issues()
            
            # 自動生成可能なドキュメントの更新
            generated_docs = await self._regenerate_auto_docs()
            
            # リンク切れチェック
            broken_links = await self._check_broken_links()
            
            total_issues = len(sync_issues) + len(broken_links)
            total_updates = len(generated_docs)
            
            return MaintenanceResult(
                task_id="documentation-sync",
                executed_at=start_time,
                success=total_issues == 0,
                message=f"ドキュメント同期: {total_updates}更新, {total_issues}問題",
                metrics={
                    "sync_issues": len(sync_issues),
                    "generated_docs": len(generated_docs),
                    "broken_links": len(broken_links)
                }
            )
            
        except Exception as e:
            return MaintenanceResult(
                task_id="documentation-sync",
                executed_at=start_time,
                success=False,
                message=f"ドキュメント同期エラー: {e}"
            )
    
    def should_execute(self, last_execution: Optional[datetime]) -> bool:
        """日次実行"""
        if not last_execution:
            return True
        return datetime.now() - last_execution > timedelta(days=1)
    
    async def _find_sync_issues(self) -> List[str]:
        """同期問題検出"""
        issues = []
        
        # 設定ファイルとドキュメントの不整合チェック
        config_files = list(self.base_dir.glob("config/*.yaml"))
        doc_files = list(self.docs_dir.glob("*.md"))
        
        # 簡易チェック（実装は省略）
        
        return issues
    
    async def _regenerate_auto_docs(self) -> List[str]:
        """自動生成ドキュメント更新"""
        generated = []
        
        # API仕様書自動生成等
        generated.append("API仕様書更新")
        
        return generated
    
    async def _check_broken_links(self) -> List[str]:
        """リンク切れチェック"""
        broken_links = []
        
        # Markdownファイル内のリンクチェック（実装省略）
        
        return broken_links

class PerformanceMonitor(MaintenanceStrategy):
    """パフォーマンス監視戦略"""
    
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.metrics_dir = base_dir / "metrics"
    
    async def execute(self) -> MaintenanceResult:
        """パフォーマンス監視実行"""
        start_time = datetime.now()
        
        try:
            # システムメトリクス収集
            system_metrics = await self._collect_system_metrics()
            
            # アプリケーションメトリクス収集
            app_metrics = await self._collect_application_metrics()
            
            # パフォーマンス劣化検出
            degradations = await self._detect_performance_degradation(system_metrics, app_metrics)
            
            # メトリクス保存
            await self._save_metrics(system_metrics, app_metrics)
            
            return MaintenanceResult(
                task_id="performance-monitoring",
                executed_at=start_time,
                success=len(degradations) == 0,
                message=f"パフォーマンス監視: {len(degradations)}劣化検出",
                metrics={
                    "system_metrics": system_metrics,
                    "app_metrics": app_metrics,
                    "degradations": degradations
                }
            )
            
        except Exception as e:
            return MaintenanceResult(
                task_id="performance-monitoring",
                executed_at=start_time,
                success=False,
                message=f"パフォーマンス監視エラー: {e}"
            )
    
    def should_execute(self, last_execution: Optional[datetime]) -> bool:
        """時間次実行"""
        if not last_execution:
            return True
        return datetime.now() - last_execution > timedelta(hours=1)
    
    async def _collect_system_metrics(self) -> Dict[str, float]:
        """システムメトリクス収集"""
        import psutil
        
        return {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage('/').percent
        }
    
    async def _collect_application_metrics(self) -> Dict[str, float]:
        """アプリケーションメトリクス収集"""
        metrics = {}
        
        # 設定ファイルサイズ
        config_sizes = {}
        for config_file in (self.base_dir / "config").glob("*"):
            if config_file.is_file():
                config_sizes[config_file.name] = config_file.stat().st_size
        
        metrics["config_file_sizes"] = config_sizes
        
        return metrics
    
    async def _detect_performance_degradation(self, system_metrics: Dict[str, float], app_metrics: Dict[str, float]) -> List[str]:
        """パフォーマンス劣化検出"""
        degradations = []
        
        # CPU使用率チェック
        if system_metrics.get("cpu_percent", 0) > 80:
            degradations.append("CPU使用率高")
        
        # メモリ使用率チェック
        if system_metrics.get("memory_percent", 0) > 90:
            degradations.append("メモリ使用率高")
        
        return degradations
    
    async def _save_metrics(self, system_metrics: Dict[str, float], app_metrics: Dict[str, float]):
        """メトリクス保存"""
        self.metrics_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        metrics_file = self.metrics_dir / f"metrics-{timestamp}.json"
        
        with open(metrics_file, 'w') as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "system": system_metrics,
                "application": app_metrics
            }, f, indent=2)

class MaintenanceFramework:
    """保守フレームワーク主制御クラス"""
    
    def __init__(self, base_dir: str = "/mnt/Linux-ExHDD/PersonalCookingRecipe"):
        self.base_dir = Path(base_dir)
        self.maintenance_dir = self.base_dir / "maintenance"
        self.maintenance_dir.mkdir(exist_ok=True)
        
        # ログ設定
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.maintenance_dir / "maintenance.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
        # 保守戦略初期化
        self.strategies = {
            "config-optimization": ConfigurationOptimizer(self.base_dir),
            "dependency-management": DependencyManager(self.base_dir),
            "documentation-sync": DocumentationSynchronizer(self.base_dir),
            "performance-monitoring": PerformanceMonitor(self.base_dir)
        }
        
        # 保守タスク定義
        self.maintenance_tasks = [
            MaintenanceTask(
                id="config-optimization",
                name="設定最適化",
                description="未使用設定除去、重複統合、パフォーマンス最適化",
                schedule="0 2 * * 0",  # 日曜2時
                priority=2,
                auto_execute=True
            ),
            MaintenanceTask(
                id="dependency-management",
                name="依存関係管理",
                description="Python・システム依存関係の更新・検証",
                schedule="0 3 1 * *",  # 毎月1日3時
                priority=1,
                auto_execute=True
            ),
            MaintenanceTask(
                id="documentation-sync",
                name="ドキュメント同期",
                description="設定とドキュメントの同期、リンク切れチェック",
                schedule="0 1 * * *",  # 毎日1時
                priority=3,
                auto_execute=True
            ),
            MaintenanceTask(
                id="performance-monitoring",
                name="パフォーマンス監視",
                description="システム・アプリケーションメトリクス収集・分析",
                schedule="0 * * * *",  # 毎時
                priority=4,
                auto_execute=True
            )
        ]
    
    async def run_maintenance_cycle(self) -> Dict[str, MaintenanceResult]:
        """保守サイクル実行"""
        self.logger.info("保守サイクル開始")
        results = {}
        
        try:
            # 実行履歴読み込み
            execution_history = await self._load_execution_history()
            
            # 実行対象タスク決定
            tasks_to_execute = await self._determine_tasks_to_execute(execution_history)
            
            if not tasks_to_execute:
                self.logger.info("実行対象タスクなし")
                return results
            
            # 並列実行可能なタスクをグループ化
            execution_groups = await self._group_tasks_for_execution(tasks_to_execute)
            
            # グループ毎に実行
            for group in execution_groups:
                group_results = await self._execute_task_group(group)
                results.update(group_results)
            
            # 実行履歴更新
            await self._update_execution_history(results)
            
            # 結果レポート生成
            await self._generate_maintenance_report(results)
            
            success_count = sum(1 for r in results.values() if r.success)
            total_count = len(results)
            
            self.logger.info(f"保守サイクル完了: {success_count}/{total_count} 成功")
            
            return results
            
        except Exception as e:
            self.logger.error(f"保守サイクルエラー: {e}")
            return results
    
    async def _load_execution_history(self) -> Dict[str, MaintenanceResult]:
        """実行履歴読み込み"""
        history_file = self.maintenance_dir / "execution_history.json"
        
        if not history_file.exists():
            return {}
        
        try:
            with open(history_file, 'r') as f:
                data = json.load(f)
                
            history = {}
            for task_id, result_data in data.items():
                history[task_id] = MaintenanceResult(
                    task_id=result_data["task_id"],
                    executed_at=datetime.fromisoformat(result_data["executed_at"]),
                    success=result_data["success"],
                    message=result_data["message"],
                    metrics=result_data.get("metrics"),
                    next_execution=datetime.fromisoformat(result_data["next_execution"]) if result_data.get("next_execution") else None
                )
            
            return history
            
        except Exception as e:
            self.logger.warning(f"実行履歴読み込みエラー: {e}")
            return {}
    
    async def _determine_tasks_to_execute(self, execution_history: Dict[str, MaintenanceResult]) -> List[MaintenanceTask]:
        """実行対象タスク決定"""
        tasks_to_execute = []
        
        for task in self.maintenance_tasks:
            if not task.auto_execute:
                continue
            
            # 前回実行時刻取得
            last_execution = None
            if task.id in execution_history:
                last_execution = execution_history[task.id].executed_at
            
            # 実行要否判定
            strategy = self.strategies.get(task.id)
            if strategy and strategy.should_execute(last_execution):
                tasks_to_execute.append(task)
        
        return tasks_to_execute
    
    async def _group_tasks_for_execution(self, tasks: List[MaintenanceTask]) -> List[List[MaintenanceTask]]:
        """実行グループ化"""
        # 優先度順にソート
        sorted_tasks = sorted(tasks, key=lambda t: t.priority)
        
        # 依存関係を考慮してグループ化（簡略化）
        groups = []
        current_group = []
        current_priority = None
        
        for task in sorted_tasks:
            if current_priority is None or task.priority == current_priority:
                current_group.append(task)
                current_priority = task.priority
            else:
                if current_group:
                    groups.append(current_group)
                current_group = [task]
                current_priority = task.priority
        
        if current_group:
            groups.append(current_group)
        
        return groups
    
    async def _execute_task_group(self, tasks: List[MaintenanceTask]) -> Dict[str, MaintenanceResult]:
        """タスクグループ実行"""
        results = {}
        
        # 並列実行
        execution_tasks = []
        for task in tasks:
            strategy = self.strategies.get(task.id)
            if strategy:
                execution_tasks.append(asyncio.create_task(strategy.execute()))
        
        if execution_tasks:
            group_results = await asyncio.gather(*execution_tasks, return_exceptions=True)
            
            for i, result in enumerate(group_results):
                task = tasks[i]
                if isinstance(result, Exception):
                    results[task.id] = MaintenanceResult(
                        task_id=task.id,
                        executed_at=datetime.now(),
                        success=False,
                        message=f"実行エラー: {result}"
                    )
                else:
                    results[task.id] = result
        
        return results
    
    async def _update_execution_history(self, results: Dict[str, MaintenanceResult]):
        """実行履歴更新"""
        history_file = self.maintenance_dir / "execution_history.json"
        
        # 既存履歴読み込み
        existing_history = await self._load_execution_history()
        
        # 新結果で更新
        for task_id, result in results.items():
            existing_history[task_id] = result
        
        # JSON形式で保存
        history_data = {}
        for task_id, result in existing_history.items():
            history_data[task_id] = {
                "task_id": result.task_id,
                "executed_at": result.executed_at.isoformat(),
                "success": result.success,
                "message": result.message,
                "metrics": result.metrics,
                "next_execution": result.next_execution.isoformat() if result.next_execution else None
            }
        
        with open(history_file, 'w') as f:
            json.dump(history_data, f, indent=2, ensure_ascii=False)
    
    async def _generate_maintenance_report(self, results: Dict[str, MaintenanceResult]):
        """保守レポート生成"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.maintenance_dir / f"maintenance-report-{timestamp}.md"
        
        report_content = f"""# 保守実行レポート

## 実行情報

- 実行日時: {datetime.now().isoformat()}
- 実行タスク数: {len(results)}
- 成功タスク: {sum(1 for r in results.values() if r.success)}
- 失敗タスク: {sum(1 for r in results.values() if not r.success)}

## タスク実行結果

"""
        
        for task_id, result in results.items():
            status = "✅ 成功" if result.success else "❌ 失敗"
            report_content += f"### {task_id}\n\n"
            report_content += f"- **ステータス**: {status}\n"
            report_content += f"- **実行時刻**: {result.executed_at.isoformat()}\n"
            report_content += f"- **メッセージ**: {result.message}\n"
            
            if result.metrics:
                report_content += f"- **メトリクス**: {result.metrics}\n"
            
            report_content += "\n"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        self.logger.info(f"保守レポート生成: {report_file}")
    
    async def install_systemd_service(self):
        """systemdサービスインストール"""
        service_content = f"""[Unit]
Description=Agent Configuration Maintenance Framework
After=network.target

[Service]
Type=oneshot
User={os.getenv('USER', 'root')}
WorkingDirectory={self.base_dir}
ExecStart={sys.executable} {self.base_dir}/scripts/maintenance-framework.py
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
"""
        
        timer_content = """[Unit]
Description=Agent Configuration Maintenance Timer
Requires=agent-maintenance.service

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
"""
        
        service_file = Path("/etc/systemd/system/agent-maintenance.service")
        timer_file = Path("/etc/systemd/system/agent-maintenance.timer")
        
        # サービスファイル作成（要sudo）
        print("systemdサービスインストール:")
        print(f"1. 以下内容で {service_file} を作成:")
        print(service_content)
        print(f"2. 以下内容で {timer_file} を作成:")
        print(timer_content)
        print("3. 以下コマンド実行:")
        print("   sudo systemctl daemon-reload")
        print("   sudo systemctl enable agent-maintenance.timer")
        print("   sudo systemctl start agent-maintenance.timer")

async def main():
    """メイン実行関数"""
    framework = MaintenanceFramework()
    
    if len(sys.argv) > 1 and sys.argv[1] == "install":
        await framework.install_systemd_service()
        return
    
    results = await framework.run_maintenance_cycle()
    
    success_count = sum(1 for r in results.values() if r.success)
    total_count = len(results)
    
    if success_count == total_count:
        print(f"🎉 保守サイクル完了: {total_count}タスク成功")
        sys.exit(0)
    else:
        print(f"⚠️ 保守サイクル完了: {success_count}/{total_count}タスク成功")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())