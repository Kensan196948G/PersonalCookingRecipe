#!/usr/bin/env python3
"""
並列エージェント設定修正オーケストレーター
全修正処理を最適な順序で並列実行するマスタースクリプト
"""

import os
import sys
import asyncio
import subprocess
import time
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running" 
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class ParallelTask:
    """並列実行タスク定義"""
    id: str
    name: str
    script_path: str
    description: str
    priority: int
    estimated_duration: int  # 秒
    dependencies: List[str] = None
    max_retries: int = 3
    timeout: int = 600  # 10分
    
    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []

@dataclass
class TaskResult:
    """タスク実行結果"""
    task_id: str
    status: TaskStatus
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration: Optional[float] = None
    return_code: Optional[int] = None
    stdout: str = ""
    stderr: str = ""
    error_message: str = ""
    retry_count: int = 0

class ParallelFixOrchestrator:
    """並列修正オーケストレーター"""
    
    def __init__(self, base_dir: str = "/mnt/Linux-ExHDD/PersonalCookingRecipe"):
        self.base_dir = Path(base_dir)
        self.scripts_dir = self.base_dir / "scripts"
        self.results_dir = self.base_dir / "results"
        self.results_dir.mkdir(exist_ok=True)
        
        # タスク定義
        self.tasks = self._define_parallel_tasks()
        self.task_results: Dict[str, TaskResult] = {}
        self.running_tasks: Dict[str, asyncio.Task] = {}
        
        # 実行統計
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
        self.max_concurrent_tasks = 4  # 最大同時実行数
    
    def _define_parallel_tasks(self) -> Dict[str, ParallelTask]:
        """並列タスク定義"""
        return {
            "batch-fix": ParallelTask(
                id="batch-fix",
                name="バッチ設定修正",
                script_path="agent-config-batch-fix.py",
                description="エージェント設定ファイルの一括修正・正規化",
                priority=1,
                estimated_duration=120,
                dependencies=[]
            ),
            "claude-md-split": ParallelTask(
                id="claude-md-split", 
                name="CLAUDE.md分割",
                script_path="claude-md-splitter.py",
                description="巨大CLAUDE.mdファイルの最適化分割",
                priority=2,
                estimated_duration=60,
                dependencies=[]
            ),
            "validation": ParallelTask(
                id="validation",
                name="設定検証",
                script_path="agent-config-validator.py", 
                description="修正済み設定の包括的検証",
                priority=3,
                estimated_duration=180,
                dependencies=["batch-fix", "claude-md-split"]
            ),
            "maintenance-setup": ParallelTask(
                id="maintenance-setup",
                name="保守フレームワーク設定",
                script_path="maintenance-framework.py",
                description="継続的保守システムの初期化",
                priority=4,
                estimated_duration=30,
                dependencies=["validation"]
            ),
            "documentation-update": ParallelTask(
                id="documentation-update",
                name="ドキュメント更新",
                script_path="update-documentation.py",
                description="修正内容のドキュメント反映",
                priority=5,
                estimated_duration=45,
                dependencies=["validation"],
                max_retries=1
            ),
            "performance-benchmark": ParallelTask(
                id="performance-benchmark",
                name="パフォーマンスベンチマーク",
                script_path="performance-benchmark.py",
                description="修正後の性能測定・比較",
                priority=6,
                estimated_duration=90,
                dependencies=["validation"]
            )
        }
    
    async def execute_parallel_fix(self) -> bool:
        """並列修正実行"""
        print("🚀 エージェント設定並列修正開始")
        print(f"📋 総タスク数: {len(self.tasks)}")
        print(f"⚡ 最大同時実行数: {self.max_concurrent_tasks}")
        
        self.start_time = datetime.now()
        
        try:
            # 1. 前提条件チェック
            if not await self._check_prerequisites():
                return False
            
            # 2. タスク実行順序計算
            execution_plan = await self._calculate_execution_plan()
            print(f"📈 実行計画: {len(execution_plan)}フェーズ")
            
            # 3. フェーズ毎並列実行
            overall_success = True
            for phase_num, phase_tasks in enumerate(execution_plan, 1):
                print(f"\n🎯 フェーズ {phase_num}: {len(phase_tasks)}タスク並列実行")
                
                phase_success = await self._execute_phase(phase_tasks)
                if not phase_success:
                    print(f"❌ フェーズ {phase_num} 失敗")
                    overall_success = False
                    break
                else:
                    print(f"✅ フェーズ {phase_num} 完了")
            
            # 4. 結果集計・レポート生成
            await self._generate_execution_report()
            
            self.end_time = datetime.now()
            total_duration = (self.end_time - self.start_time).total_seconds()
            
            print(f"\n📊 実行結果サマリー")
            print(f"   総実行時間: {total_duration:.1f}秒")
            print(f"   成功タスク: {sum(1 for r in self.task_results.values() if r.status == TaskStatus.COMPLETED)}")
            print(f"   失敗タスク: {sum(1 for r in self.task_results.values() if r.status == TaskStatus.FAILED)}")
            
            return overall_success
            
        except Exception as e:
            print(f"❌ 並列修正エラー: {e}")
            return False
    
    async def _check_prerequisites(self) -> bool:
        """前提条件チェック"""
        print("🔍 前提条件チェック中...")
        
        # スクリプトファイル存在確認
        missing_scripts = []
        for task in self.tasks.values():
            script_path = self.scripts_dir / task.script_path
            if not script_path.exists():
                missing_scripts.append(task.script_path)
        
        if missing_scripts:
            print(f"❌ 必要なスクリプトが見つかりません: {', '.join(missing_scripts)}")
            return False
        
        # Python環境確認
        required_modules = ['asyncio', 'yaml', 'psutil']
        for module in required_modules:
            try:
                __import__(module)
            except ImportError:
                print(f"❌ 必要なPythonモジュールが見つかりません: {module}")
                return False
        
        # ディスク容量確認
        import shutil
        free_space = shutil.disk_usage(self.base_dir).free
        required_space = 100 * 1024 * 1024  # 100MB
        if free_space < required_space:
            print(f"❌ ディスク容量不足: {free_space / (1024*1024):.1f}MB < {required_space / (1024*1024):.1f}MB")
            return False
        
        print("✅ 前提条件チェック完了")
        return True
    
    async def _calculate_execution_plan(self) -> List[List[str]]:
        """実行計画計算（依存関係考慮）"""
        execution_plan = []
        remaining_tasks = set(self.tasks.keys())
        completed_tasks = set()
        
        while remaining_tasks:
            # 現在実行可能なタスクを特定
            ready_tasks = []
            for task_id in remaining_tasks:
                task = self.tasks[task_id]
                if all(dep in completed_tasks for dep in task.dependencies):
                    ready_tasks.append(task_id)
            
            if not ready_tasks:
                # デッドロック検出
                print(f"❌ 依存関係デッドロック検出: {remaining_tasks}")
                break
            
            # 優先度順にソート
            ready_tasks.sort(key=lambda tid: self.tasks[tid].priority)
            
            execution_plan.append(ready_tasks)
            completed_tasks.update(ready_tasks)
            remaining_tasks -= set(ready_tasks)
        
        return execution_plan
    
    async def _execute_phase(self, task_ids: List[str]) -> bool:
        """フェーズ実行"""
        # タスク結果初期化
        for task_id in task_ids:
            self.task_results[task_id] = TaskResult(
                task_id=task_id,
                status=TaskStatus.PENDING
            )
        
        # 同時実行制限を考慮してタスクを分割
        task_batches = []
        for i in range(0, len(task_ids), self.max_concurrent_tasks):
            batch = task_ids[i:i + self.max_concurrent_tasks]
            task_batches.append(batch)
        
        # バッチ毎に並列実行
        for batch_num, batch_task_ids in enumerate(task_batches, 1):
            if len(task_batches) > 1:
                print(f"   📦 バッチ {batch_num}/{len(task_batches)}: {len(batch_task_ids)}タスク")
            
            # 並列実行
            batch_tasks = []
            for task_id in batch_task_ids:
                task = asyncio.create_task(self._execute_single_task(task_id))
                batch_tasks.append(task)
                self.running_tasks[task_id] = task
            
            # 完了待機
            await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            # 実行中タスクリストから削除
            for task_id in batch_task_ids:
                self.running_tasks.pop(task_id, None)
        
        # フェーズ成功判定
        phase_success = all(
            self.task_results[tid].status == TaskStatus.COMPLETED 
            for tid in task_ids
        )
        
        return phase_success
    
    async def _execute_single_task(self, task_id: str) -> TaskResult:
        """単一タスク実行"""
        task = self.tasks[task_id]
        result = self.task_results[task_id]
        
        print(f"   🔄 開始: {task.name}")
        result.status = TaskStatus.RUNNING
        result.start_time = datetime.now()
        
        for attempt in range(task.max_retries + 1):
            if attempt > 0:
                print(f"   🔁 再試行 {attempt}/{task.max_retries}: {task.name}")
                result.retry_count = attempt
                await asyncio.sleep(2 ** attempt)  # 指数バックオフ
            
            try:
                # スクリプト実行
                script_path = self.scripts_dir / task.script_path
                process = await asyncio.create_subprocess_exec(
                    sys.executable, str(script_path),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=self.base_dir
                )
                
                # タイムアウト付き実行
                try:
                    stdout, stderr = await asyncio.wait_for(
                        process.communicate(),
                        timeout=task.timeout
                    )
                    
                    result.return_code = process.returncode
                    result.stdout = stdout.decode('utf-8', errors='replace')
                    result.stderr = stderr.decode('utf-8', errors='replace')
                    
                    if process.returncode == 0:
                        result.status = TaskStatus.COMPLETED
                        result.end_time = datetime.now()
                        result.duration = (result.end_time - result.start_time).total_seconds()
                        print(f"   ✅ 完了: {task.name} ({result.duration:.1f}秒)")
                        return result
                    else:
                        result.error_message = f"終了コード: {process.returncode}"
                        
                except asyncio.TimeoutError:
                    process.kill()
                    await process.wait()
                    result.error_message = f"タイムアウト ({task.timeout}秒)"
                
            except Exception as e:
                result.error_message = f"実行エラー: {e}"
        
        # 最大試行回数に達した場合
        result.status = TaskStatus.FAILED
        result.end_time = datetime.now()
        result.duration = (result.end_time - result.start_time).total_seconds()
        
        print(f"   ❌ 失敗: {task.name} - {result.error_message}")
        return result
    
    async def _generate_execution_report(self):
        """実行レポート生成"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.results_dir / f"parallel-fix-report-{timestamp}.md"
        
        # 統計計算
        completed_tasks = [r for r in self.task_results.values() if r.status == TaskStatus.COMPLETED]
        failed_tasks = [r for r in self.task_results.values() if r.status == TaskStatus.FAILED]
        total_duration = (self.end_time - self.start_time).total_seconds() if self.end_time else 0
        estimated_duration = sum(task.estimated_duration for task in self.tasks.values())
        efficiency = ((estimated_duration - total_duration) / estimated_duration * 100) if estimated_duration > 0 else 0
        
        report_content = f"""# エージェント設定並列修正レポート

## 実行サマリー

- **実行日時**: {self.start_time.isoformat() if self.start_time else 'N/A'} - {self.end_time.isoformat() if self.end_time else 'N/A'}
- **総実行時間**: {total_duration:.1f}秒
- **推定時間**: {estimated_duration}秒
- **効率改善**: {efficiency:+.1f}%
- **並列効果**: {(estimated_duration / total_duration):.1f}倍高速化
- **総タスク数**: {len(self.task_results)}
- **成功**: {len(completed_tasks)}
- **失敗**: {len(failed_tasks)}
- **成功率**: {(len(completed_tasks) / len(self.task_results) * 100):.1f}%

## タスク実行結果

"""
        
        # タスク毎詳細結果
        for task_id, result in self.task_results.items():
            task = self.tasks[task_id]
            status_emoji = {
                TaskStatus.COMPLETED: "✅",
                TaskStatus.FAILED: "❌", 
                TaskStatus.RUNNING: "🔄",
                TaskStatus.PENDING: "⏳",
                TaskStatus.CANCELLED: "⏹️"
            }.get(result.status, "❓")
            
            report_content += f"### {status_emoji} {task.name}\n\n"
            report_content += f"- **タスクID**: {task_id}\n"
            report_content += f"- **説明**: {task.description}\n"
            report_content += f"- **ステータス**: {result.status.value}\n"
            report_content += f"- **実行時間**: {result.duration:.1f}秒" if result.duration else "- **実行時間**: N/A\n"
            report_content += f" (推定: {task.estimated_duration}秒)\n" if result.duration else "\n"
            
            if result.retry_count > 0:
                report_content += f"- **再試行回数**: {result.retry_count}\n"
            
            if result.error_message:
                report_content += f"- **エラー**: {result.error_message}\n"
            
            if result.status == TaskStatus.COMPLETED:
                report_content += f"- **効果**: {((task.estimated_duration - (result.duration or 0)) / task.estimated_duration * 100):+.1f}%\n"
            
            report_content += "\n"
        
        # パフォーマンス分析
        report_content += """## パフォーマンス分析

### 並列効果

"""
        
        if total_duration > 0:
            parallel_efficiency = estimated_duration / total_duration
            report_content += f"- **並列化効果**: {parallel_efficiency:.1f}倍高速化\n"
            report_content += f"- **時間削減**: {estimated_duration - total_duration:.1f}秒短縮\n"
            report_content += f"- **効率改善**: {efficiency:+.1f}%\n"
        
        # 推奨事項
        report_content += """
### 推奨事項

"""
        
        if failed_tasks:
            report_content += f"- ❗ {len(failed_tasks)}個の失敗タスクを確認・修正してください\n"
            for failed_task in failed_tasks:
                report_content += f"  - {failed_task.task_id}: {failed_task.error_message}\n"
        
        if efficiency < 50:
            report_content += "- ⚠️ 並列効果が低いため、タスク依存関係を見直してください\n"
        
        if any(r.retry_count > 0 for r in self.task_results.values()):
            report_content += "- 🔄 再試行が発生したタスクの安定性を確認してください\n"
        
        # 今後の改善点
        report_content += """
## 今後の改善点

1. **依存関係最適化**: より多くのタスクを並列実行できるよう依存関係を見直し
2. **リソース最適化**: CPU・メモリ使用量に基づく動的同時実行数調整
3. **エラーハンドリング強化**: 個別タスクエラーが全体に影響しない仕組み
4. **進捗監視**: リアルタイム進捗表示とキャンセル機能
5. **結果キャッシュ**: 変更のないタスクの実行スキップ

---

**生成日時**: {datetime.now().isoformat()}
"""
        
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        print(f"📊 実行レポート生成: {report_file}")
    
    async def cancel_all_tasks(self):
        """全タスクキャンセル"""
        print("🛑 全タスクキャンセル中...")
        
        cancel_tasks = []
        for task_id, running_task in self.running_tasks.items():
            if not running_task.done():
                running_task.cancel()
                cancel_tasks.append(task_id)
                self.task_results[task_id].status = TaskStatus.CANCELLED
        
        if cancel_tasks:
            await asyncio.gather(*[self.running_tasks[tid] for tid in cancel_tasks], return_exceptions=True)
            print(f"🛑 {len(cancel_tasks)}タスクをキャンセルしました")
    
    def get_progress_summary(self) -> Dict[str, Any]:
        """進捗サマリー取得"""
        status_counts = {}
        for status in TaskStatus:
            status_counts[status.value] = sum(
                1 for r in self.task_results.values() 
                if r.status == status
            )
        
        return {
            "total_tasks": len(self.tasks),
            "status_counts": status_counts,
            "running_tasks": len(self.running_tasks),
            "estimated_total_duration": sum(t.estimated_duration for t in self.tasks.values()),
            "elapsed_time": (datetime.now() - self.start_time).total_seconds() if self.start_time else 0
        }

async def main():
    """メイン実行関数"""
    orchestrator = ParallelFixOrchestrator()
    
    # シグナルハンドリング（Ctrl+C対応）
    import signal
    
    def signal_handler(sig, frame):
        print("\n🛑 中断シグナル受信")
        asyncio.create_task(orchestrator.cancel_all_tasks())
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        success = await orchestrator.execute_parallel_fix()
        
        if success:
            print("\n🎉 エージェント設定並列修正完了")
            print("📁 結果ディレクトリ: results/")
            sys.exit(0)
        else:
            print("\n❌ エージェント設定並列修正失敗")
            sys.exit(1)
    
    except KeyboardInterrupt:
        print("\n🛑 ユーザーによる中断")
        await orchestrator.cancel_all_tasks()
        sys.exit(130)

if __name__ == "__main__":
    asyncio.run(main())