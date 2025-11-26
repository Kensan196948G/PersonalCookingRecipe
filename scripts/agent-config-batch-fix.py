#!/usr/bin/env python3
"""
エージェント設定バッチ修正スクリプト
- 並列処理による高速修正
- 設定ファイル正規化
- 整合性検証
- バックアップ機能
"""

import os
import sys
import json
import yaml
import shutil
import asyncio
import concurrent.futures
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

@dataclass
class AgentConfig:
    """統一されたエージェント設定データクラス"""
    id: str
    name: str
    role: str
    goal: str
    category: str
    priority: int
    status: str = "active"
    color: str = "\033[1;36m"
    dependencies: List[str] = None
    
    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []

class AgentConfigBatchFixer:
    """エージェント設定バッチ修正クラス"""
    
    def __init__(self, base_dir: str = "/mnt/Linux-ExHDD/PersonalCookingRecipe"):
        self.base_dir = Path(base_dir)
        self.backup_dir = self.base_dir / "backups" / f"agent-config-{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.agents: Dict[str, AgentConfig] = {}
        self.config_files = {
            "yaml": self.base_dir / "docs" / "agents.yaml",
            "python": self.base_dir / "scripts" / "agent-selector.py",
            "shell": self.base_dir / "scripts" / "claude-agent-prompt.sh",
            "matrix": self.base_dir / "management" / "agent-coordination-matrix.md",
            "claude_config": self.base_dir / "claude-flow.config.json"
        }
    
    async def execute_batch_fix(self) -> bool:
        """並列バッチ修正の実行"""
        try:
            print("🚀 エージェント設定バッチ修正開始")
            
            # 1. バックアップ作成（並列）
            await self._create_backup()
            
            # 2. 設定ファイル解析（並列）
            await self._analyze_config_files()
            
            # 3. エージェント統合（並列）
            await self._normalize_agent_configs()
            
            # 4. 修正ファイル生成（並列）
            await self._generate_corrected_files()
            
            # 5. 検証実行
            validation_result = await self._validate_corrections()
            
            if validation_result:
                print("✅ バッチ修正完了")
                return True
            else:
                print("❌ 検証失敗 - ロールバック実行")
                await self._rollback()
                return False
                
        except Exception as e:
            print(f"❌ バッチ修正エラー: {e}")
            await self._rollback()
            return False
    
    async def _create_backup(self):
        """設定ファイルバックアップ（並列処理）"""
        print("📦 バックアップ作成中...")
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        backup_tasks = []
        for file_type, file_path in self.config_files.items():
            if file_path.exists():
                task = asyncio.create_task(self._backup_file(file_path, file_type))
                backup_tasks.append(task)
        
        await asyncio.gather(*backup_tasks)
        print(f"✅ バックアップ完了: {self.backup_dir}")
    
    async def _backup_file(self, source: Path, file_type: str):
        """個別ファイルバックアップ"""
        backup_path = self.backup_dir / f"{file_type}_{source.name}"
        shutil.copy2(source, backup_path)
    
    async def _analyze_config_files(self):
        """設定ファイル解析（並列処理）"""
        print("🔍 設定ファイル解析中...")
        
        analysis_tasks = []
        for file_type, file_path in self.config_files.items():
            if file_path.exists():
                task = asyncio.create_task(self._analyze_single_file(file_path, file_type))
                analysis_tasks.append(task)
        
        results = await asyncio.gather(*analysis_tasks)
        
        # 結果を統合
        for result in results:
            if result:
                for agent_id, agent_config in result.items():
                    if agent_id in self.agents:
                        # 既存設定とマージ
                        self.agents[agent_id] = self._merge_agent_configs(
                            self.agents[agent_id], agent_config
                        )
                    else:
                        self.agents[agent_id] = agent_config
    
    async def _analyze_single_file(self, file_path: Path, file_type: str) -> Optional[Dict[str, AgentConfig]]:
        """個別ファイル解析"""
        try:
            if file_type == "yaml":
                return await self._parse_yaml_config(file_path)
            elif file_type == "python":
                return await self._parse_python_config(file_path)
            elif file_type == "matrix":
                return await self._parse_matrix_config(file_path)
            return None
        except Exception as e:
            print(f"⚠️ {file_path} 解析エラー: {e}")
            return None
    
    async def _parse_yaml_config(self, file_path: Path) -> Dict[str, AgentConfig]:
        """YAML設定解析"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        agents = {}
        if 'agents' in data:
            for agent_data in data['agents']:
                agent = AgentConfig(
                    id=agent_data['id'],
                    name=agent_data['name'],
                    role=agent_data['role'],
                    goal=agent_data['goal'],
                    category=self._determine_category(agent_data['role']),
                    priority=self._calculate_priority(agent_data['id'])
                )
                agents[agent.id] = agent
        
        return agents
    
    async def _parse_python_config(self, file_path: Path) -> Dict[str, AgentConfig]:
        """Python設定解析"""
        agents = {}
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # AGENTS辞書を抽出
        import re
        agents_match = re.search(r'AGENTS\s*=\s*{(.*?)}', content, re.DOTALL)
        if agents_match:
            agents_str = agents_match.group(1)
            # 簡易解析（本格的には ast モジュールを使用）
            for line in agents_str.split('\n'):
                if '"recipe-' in line and ':' in line:
                    agent_id = line.split('"')[1]
                    agent = AgentConfig(
                        id=agent_id,
                        name=f"Agent {agent_id.replace('-', ' ').title()}",
                        role="Role extracted from Python",
                        goal="Goal extracted from Python",
                        category="legacy",
                        priority=3
                    )
                    agents[agent_id] = agent
        
        return agents
    
    async def _parse_matrix_config(self, file_path: Path) -> Dict[str, AgentConfig]:
        """Matrix設定解析"""
        agents = {}
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # テーブルからエージェント情報を抽出
        import re
        table_matches = re.findall(r'\|\s*(\S+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|', content)
        
        for match in table_matches:
            agent_id, name, role = match
            if 'recipe-' in agent_id.lower():
                agent = AgentConfig(
                    id=agent_id.lower(),
                    name=name.strip(),
                    role=role.strip(),
                    goal=f"Goal for {name.strip()}",
                    category="coordination",
                    priority=2
                )
                agents[agent_id.lower()] = agent
        
        return agents
    
    def _merge_agent_configs(self, existing: AgentConfig, new: AgentConfig) -> AgentConfig:
        """エージェント設定マージ"""
        # 優先度に基づいて設定をマージ
        merged = AgentConfig(
            id=existing.id,
            name=new.name if new.priority < existing.priority else existing.name,
            role=new.role if new.priority < existing.priority else existing.role,
            goal=new.goal if new.priority < existing.priority else existing.goal,
            category=existing.category,
            priority=min(existing.priority, new.priority),
            status=existing.status,
            color=existing.color,
            dependencies=list(set(existing.dependencies + new.dependencies))
        )
        return merged
    
    def _determine_category(self, role: str) -> str:
        """役割からカテゴリ決定"""
        role_lower = role.lower()
        if 'cto' in role_lower or '戦略' in role_lower:
            return 'leadership'
        elif 'dev' in role_lower or '開発' in role_lower:
            return 'development'
        elif 'qa' in role_lower or 'test' in role_lower:
            return 'quality'
        elif 'manager' in role_lower or '管理' in role_lower:
            return 'management'
        else:
            return 'specialized'
    
    def _calculate_priority(self, agent_id: str) -> int:
        """エージェントIDから優先度計算"""
        priority_map = {
            'cto': 1,
            'manager': 1,
            'dev': 2,
            'qa': 2,
            'security': 2,
            'frontend': 3,
            'backend': 3,
            'devops': 3,
            'performance': 3,
            'nlp': 3
        }
        
        for key, priority in priority_map.items():
            if key in agent_id.lower():
                return priority
        return 4
    
    async def _normalize_agent_configs(self):
        """エージェント設定正規化"""
        print("🔧 エージェント設定正規化中...")
        
        # 重複除去
        unique_agents = {}
        for agent_id, agent in self.agents.items():
            normalized_id = self._normalize_agent_id(agent_id)
            if normalized_id not in unique_agents:
                agent.id = normalized_id
                unique_agents[normalized_id] = agent
            else:
                # マージ
                unique_agents[normalized_id] = self._merge_agent_configs(
                    unique_agents[normalized_id], agent
                )
        
        self.agents = unique_agents
        print(f"✅ {len(self.agents)} エージェントを正規化")
    
    def _normalize_agent_id(self, agent_id: str) -> str:
        """エージェントID正規化"""
        # "Recipe-cto" -> "recipe-cto"
        # "recipe_dev" -> "recipe-dev"
        normalized = agent_id.lower().replace('_', '-').replace('recipe-', '').strip('-')
        return f"recipe-{normalized}"
    
    async def _generate_corrected_files(self):
        """修正済みファイル生成（並列）"""
        print("📝 修正済みファイル生成中...")
        
        generation_tasks = [
            asyncio.create_task(self._generate_yaml_config()),
            asyncio.create_task(self._generate_python_config()),
            asyncio.create_task(self._generate_shell_config()),
            asyncio.create_task(self._generate_matrix_config()),
            asyncio.create_task(self._generate_json_config())
        ]
        
        await asyncio.gather(*generation_tasks)
        print("✅ 修正済みファイル生成完了")
    
    async def _generate_yaml_config(self):
        """YAML設定ファイル生成"""
        config_data = {
            'agents': [asdict(agent) for agent in self.agents.values()],
            'execution': {
                'max_iterations': 4,
                'no_context': True,
                'dangerously_skip_permissions': True
            },
            'project': {
                'name': 'PersonalCookRecipe',
                'version': '1.0.0',
                'platform': 'Linux'
            }
        }
        
        output_path = self.base_dir / "config" / "agents-normalized.yaml"
        output_path.parent.mkdir(exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            yaml.dump(config_data, f, default_flow_style=False, allow_unicode=True, indent=2)
    
    async def _generate_python_config(self):
        """Python設定ファイル生成"""
        agents_dict = {}
        for agent in self.agents.values():
            agents_dict[agent.id] = {
                'name': agent.name,
                'role': agent.role,
                'color': agent.color
            }
        
        python_content = f'''#!/usr/bin/env python3
"""
正規化されたエージェント設定
自動生成日時: {datetime.now().isoformat()}
"""

import os
import sys
import json
from pathlib import Path

# 正規化されたエージェント定義
AGENTS = {json.dumps(agents_dict, indent=4, ensure_ascii=False)}

# 以下、既存のクラス定義を維持
class AgentPromptManager:
    # 既存の実装を保持
    pass

if __name__ == "__main__":
    main()
'''
        
        output_path = self.base_dir / "config" / "agent-selector-normalized.py"
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(python_content)
    
    async def _generate_shell_config(self):
        """Shell設定ファイル生成"""
        agent_list = " ".join([agent.id for agent in self.agents.values()])
        
        shell_content = f'''#!/bin/bash
# 正規化されたエージェント設定
# 自動生成日時: {datetime.now().isoformat()}

# 利用可能エージェント
CLAUDE_AGENTS="{agent_list}"

# デフォルト設定
CLAUDE_ACTIVE_AGENT="recipe-cto"
CLAUDE_AGENT_COLOR="\\033[1;36m"
CLAUDE_PATH_COLOR="\\033[1;33m"
CLAUDE_RESET_COLOR="\\033[0m"

# 既存の関数定義を保持
'''
        
        output_path = self.base_dir / "config" / "claude-agent-prompt-normalized.sh"
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(shell_content)
    
    async def _generate_matrix_config(self):
        """マトリクス設定ファイル生成"""
        matrix_content = f'''# 正規化されたエージェント調整マトリクス
# 自動生成日時: {datetime.now().isoformat()}

## エージェント構成

| Agent ID | Name | Role | Category | Priority | Status |
|----------|------|------|----------|----------|--------|
'''
        
        for agent in sorted(self.agents.values(), key=lambda x: x.priority):
            status_emoji = "🟢" if agent.status == "active" else "🟡"
            matrix_content += f"| {agent.id} | {agent.name} | {agent.role} | {agent.category} | {agent.priority} | {status_emoji} |\n"
        
        output_path = self.base_dir / "config" / "agent-coordination-matrix-normalized.md"
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(matrix_content)
    
    async def _generate_json_config(self):
        """JSON設定ファイル生成"""
        config_data = {
            'agents': {agent.id: asdict(agent) for agent in self.agents.values()},
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'total_agents': len(self.agents),
                'categories': list(set(agent.category for agent in self.agents.values()))
            },
            'features': {
                'autoTopologySelection': True,
                'parallelExecution': True,
                'neuralTraining': True,
                'bottleneckAnalysis': True,
                'smartAutoSpawning': True,
                'selfHealingWorkflows': True,
                'crossSessionMemory': True,
                'githubIntegration': True
            },
            'performance': {
                'maxAgents': len(self.agents),
                'defaultTopology': 'hierarchical',
                'executionStrategy': 'parallel',
                'tokenOptimization': True,
                'cacheEnabled': True,
                'telemetryLevel': 'detailed'
            }
        }
        
        output_path = self.base_dir / "config" / "claude-flow-normalized.json"
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=2, ensure_ascii=False)
    
    async def _validate_corrections(self) -> bool:
        """修正結果検証"""
        print("🔍 修正結果検証中...")
        
        validation_tasks = [
            asyncio.create_task(self._validate_file_syntax()),
            asyncio.create_task(self._validate_agent_consistency()),
            asyncio.create_task(self._validate_dependencies())
        ]
        
        results = await asyncio.gather(*validation_tasks)
        return all(results)
    
    async def _validate_file_syntax(self) -> bool:
        """ファイル構文検証"""
        try:
            # YAML構文チェック
            yaml_path = self.base_dir / "config" / "agents-normalized.yaml"
            if yaml_path.exists():
                with open(yaml_path, 'r', encoding='utf-8') as f:
                    yaml.safe_load(f)
            
            # JSON構文チェック
            json_path = self.base_dir / "config" / "claude-flow-normalized.json"
            if json_path.exists():
                with open(json_path, 'r', encoding='utf-8') as f:
                    json.load(f)
            
            print("✅ ファイル構文検証完了")
            return True
        except Exception as e:
            print(f"❌ ファイル構文エラー: {e}")
            return False
    
    async def _validate_agent_consistency(self) -> bool:
        """エージェント整合性検証"""
        try:
            # 重複ID検証
            agent_ids = [agent.id for agent in self.agents.values()]
            if len(agent_ids) != len(set(agent_ids)):
                print("❌ エージェントID重複検出")
                return False
            
            # 必須フィールド検証
            for agent in self.agents.values():
                if not all([agent.id, agent.name, agent.role]):
                    print(f"❌ エージェント {agent.id} 必須フィールド不足")
                    return False
            
            print("✅ エージェント整合性検証完了")
            return True
        except Exception as e:
            print(f"❌ エージェント整合性エラー: {e}")
            return False
    
    async def _validate_dependencies(self) -> bool:
        """依存関係検証"""
        try:
            agent_ids = set(agent.id for agent in self.agents.values())
            
            for agent in self.agents.values():
                for dep in agent.dependencies:
                    if dep not in agent_ids:
                        print(f"❌ エージェント {agent.id} の依存関係 {dep} が見つからない")
                        return False
            
            print("✅ 依存関係検証完了")
            return True
        except Exception as e:
            print(f"❌ 依存関係エラー: {e}")
            return False
    
    async def _rollback(self):
        """ロールバック実行"""
        print("🔄 ロールバック実行中...")
        
        for file_type, original_path in self.config_files.items():
            backup_path = self.backup_dir / f"{file_type}_{original_path.name}"
            if backup_path.exists():
                shutil.copy2(backup_path, original_path)
        
        print("✅ ロールバック完了")

async def main():
    """メイン実行関数"""
    fixer = AgentConfigBatchFixer()
    success = await fixer.execute_batch_fix()
    
    if success:
        print("\n🎉 エージェント設定バッチ修正完了")
        print("📁 修正済みファイル: config/")
        print("📦 バックアップ: backups/")
    else:
        print("\n❌ バッチ修正失敗")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())