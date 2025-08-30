#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ログサービス - ログファイル監視・解析・配信

Author: Recipe-DevUI Agent
Date: 2025-08-08
"""

import json
import asyncio
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import logging
import re
from collections import defaultdict

from models.api_models import LogEntry, LogLevel, LogComponent, LogFilters

logger = logging.getLogger(__name__)

class LogService:
    """ログ管理サービス"""
    
    def __init__(self, log_dir: Optional[Path] = None):
        """初期化"""
        self.log_dir = log_dir or Path("../logs")
        self.log_dir.mkdir(exist_ok=True)
        
        # ログファイルパス
        self.app_log_file = self.log_dir / "application.log"
        self.error_log_file = self.log_dir / "error.log"
        self.api_log_file = self.log_dir / "api.log"
        
        # インメモリログキャッシュ（最新1000件）
        self._log_cache: List[LogEntry] = []
        self._max_cache_size = 1000
        
        # ログパースパターン
        self._log_pattern = re.compile(
            r'(?P<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}) - '
            r'(?P<component>\w+) - '
            r'(?P<level>\w+) - '
            r'(?P<message>.*)'
        )
        
        logger.info(f"📋 LogService initialized with log_dir: {self.log_dir}")
    
    async def get_logs(self, level: Optional[str] = None, component: Optional[str] = None, limit: int = 100) -> List[LogEntry]:
        """ログ取得（フィルタリング付き）"""
        try:
            # 最新ログをキャッシュに読み込み
            await self._refresh_log_cache()
            
            filtered_logs = self._log_cache.copy()
            
            # レベルフィルタ
            if level:
                level_enum = LogLevel(level.upper())
                filtered_logs = [log for log in filtered_logs if log.level == level_enum]
            
            # コンポーネントフィルタ
            if component:
                component_enum = LogComponent(component.lower())
                filtered_logs = [log for log in filtered_logs if log.component == component_enum]
            
            # 最新順でソートして制限
            filtered_logs.sort(key=lambda l: l.timestamp, reverse=True)
            result = filtered_logs[:limit]
            
            logger.debug(f"📜 Retrieved {len(result)} logs (filtered from {len(filtered_logs)})")
            return result
            
        except Exception as e:
            logger.error(f"Error getting logs: {e}")
            return []
    
    async def get_logs_since(self, since: datetime, limit: int = 100) -> List[LogEntry]:
        """指定日時以降のログを取得"""
        try:
            await self._refresh_log_cache()
            
            # 指定日時以降のログをフィルタ
            since_logs = [
                log for log in self._log_cache 
                if log.timestamp >= since
            ]
            
            # 最新順でソートして制限
            since_logs.sort(key=lambda l: l.timestamp, reverse=True)
            result = since_logs[:limit]
            
            logger.debug(f"📅 Retrieved {len(result)} logs since {since}")
            return result
            
        except Exception as e:
            logger.error(f"Error getting logs since {since}: {e}")
            return []
    
    async def _refresh_log_cache(self):
        """ログキャッシュを更新"""
        try:
            new_logs = []
            
            # 各ログファイルから読み込み
            log_files = [
                (self.app_log_file, LogComponent.SYSTEM),
                (self.error_log_file, LogComponent.SYSTEM),
                (self.api_log_file, LogComponent.API)
            ]
            
            for log_file, default_component in log_files:
                if log_file.exists():
                    file_logs = await self._parse_log_file(log_file, default_component)
                    new_logs.extend(file_logs)
            
            # 時間順でソートしてキャッシュに保存
            new_logs.sort(key=lambda l: l.timestamp, reverse=True)
            self._log_cache = new_logs[:self._max_cache_size]
            
        except Exception as e:
            logger.error(f"Error refreshing log cache: {e}")
    
    async def _parse_log_file(self, log_file: Path, default_component: LogComponent) -> List[LogEntry]:
        """ログファイルを解析してLogEntryリストを作成"""
        try:
            logs = []
            
            # ファイルサイズチェック（大きすぎる場合は末尾のみ読む）
            file_size = log_file.stat().st_size
            max_size = 10 * 1024 * 1024  # 10MB
            
            with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                if file_size > max_size:
                    # ファイルが大きい場合は末尾から読む
                    f.seek(max(0, file_size - max_size))
                    # 最初の不完全な行をスキップ
                    f.readline()
                
                lines = f.readlines()
                
                # 最新500行に制限
                if len(lines) > 500:
                    lines = lines[-500:]
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                log_entry = self._parse_log_line(line, default_component)
                if log_entry:
                    logs.append(log_entry)
            
            return logs
            
        except Exception as e:
            logger.error(f"Error parsing log file {log_file}: {e}")
            return []
    
    def _parse_log_line(self, line: str, default_component: LogComponent) -> Optional[LogEntry]:
        """ログ行を解析してLogEntryを作成"""
        try:
            # 標準ログ形式を試行
            match = self._log_pattern.match(line)
            
            if match:
                timestamp_str = match.group('timestamp')
                component_str = match.group('component')
                level_str = match.group('level')
                message = match.group('message')
                
                # タイムスタンプ変換
                timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S,%f')
                timestamp = timestamp.replace(tzinfo=timezone.utc)
                
                # レベル変換
                try:
                    level = LogLevel(level_str.upper())
                except ValueError:
                    level = LogLevel.INFO
                
                # コンポーネント変換
                try:
                    component = LogComponent(component_str.lower())
                except ValueError:
                    component = default_component
                
                return LogEntry(
                    timestamp=timestamp,
                    level=level,
                    component=component,
                    message=message
                )
            else:
                # 標準形式でない場合は簡易パース
                return LogEntry(
                    timestamp=datetime.now(timezone.utc),
                    level=LogLevel.INFO,
                    component=default_component,
                    message=line
                )
                
        except Exception as e:
            logger.error(f"Error parsing log line: {e}")
            return None
    
    async def add_log_entry(self, level: LogLevel, component: LogComponent, message: str, 
                           metadata: Optional[Dict[str, Any]] = None):
        """ログエントリを追加（プログラムからの直接追加用）"""
        try:
            log_entry = LogEntry(
                timestamp=datetime.now(timezone.utc),
                level=level,
                component=component,
                message=message,
                metadata=metadata
            )
            
            # キャッシュに追加
            self._log_cache.insert(0, log_entry)
            if len(self._log_cache) > self._max_cache_size:
                self._log_cache = self._log_cache[:self._max_cache_size]
            
            # ログファイルに書き込み（非同期）
            await self._write_log_to_file(log_entry)
            
        except Exception as e:
            logger.error(f"Error adding log entry: {e}")
    
    async def _write_log_to_file(self, log_entry: LogEntry):
        """ログエントリをファイルに書き込み"""
        try:
            # ログレベルに応じてファイルを選択
            if log_entry.level in [LogLevel.ERROR, LogLevel.CRITICAL]:
                target_file = self.error_log_file
            elif log_entry.component == LogComponent.API:
                target_file = self.api_log_file
            else:
                target_file = self.app_log_file
            
            # ログ行を作成
            log_line = (
                f"{log_entry.timestamp.strftime('%Y-%m-%d %H:%M:%S,%f')[:-3]} - "
                f"{log_entry.component.value} - "
                f"{log_entry.level.value} - "
                f"{log_entry.message}"
            )
            
            # 非同期でファイル追記
            with open(target_file, 'a', encoding='utf-8') as f:
                f.write(log_line + '\n')
                
        except Exception as e:
            logger.error(f"Error writing log to file: {e}")
    
    async def get_log_statistics(self) -> Dict[str, Any]:
        """ログ統計情報を取得"""
        try:
            await self._refresh_log_cache()
            
            # レベル別集計
            level_counts = defaultdict(int)
            component_counts = defaultdict(int)
            
            # 時間別集計（過去24時間）
            now = datetime.now(timezone.utc)
            hourly_counts = defaultdict(int)
            
            for log in self._log_cache:
                level_counts[log.level.value] += 1
                component_counts[log.component.value] += 1
                
                # 24時間以内のログを時間別に集計
                if now - log.timestamp <= timedelta(hours=24):
                    hour_key = log.timestamp.strftime('%Y-%m-%d %H:00')
                    hourly_counts[hour_key] += 1
            
            # エラー率計算
            total_logs = len(self._log_cache)
            error_logs = level_counts.get('ERROR', 0) + level_counts.get('CRITICAL', 0)
            error_rate = (error_logs / total_logs * 100) if total_logs > 0 else 0
            
            return {
                'total_logs': total_logs,
                'level_distribution': dict(level_counts),
                'component_distribution': dict(component_counts),
                'hourly_distribution': dict(hourly_counts),
                'error_rate': round(error_rate, 2),
                'last_updated': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting log statistics: {e}")
            return {}
    
    async def search_logs(self, query: str, limit: int = 50) -> List[LogEntry]:
        """ログ内容検索"""
        try:
            await self._refresh_log_cache()
            
            query_lower = query.lower()
            matching_logs = [
                log for log in self._log_cache
                if query_lower in log.message.lower()
            ]
            
            # 最新順でソートして制限
            matching_logs.sort(key=lambda l: l.timestamp, reverse=True)
            result = matching_logs[:limit]
            
            logger.debug(f"🔍 Found {len(result)} logs matching query: {query}")
            return result
            
        except Exception as e:
            logger.error(f"Error searching logs: {e}")
            return []
    
    async def get_error_summary(self, hours: int = 24) -> Dict[str, Any]:
        """エラーサマリーを取得"""
        try:
            await self._refresh_log_cache()
            
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
            
            error_logs = [
                log for log in self._log_cache
                if log.level in [LogLevel.ERROR, LogLevel.CRITICAL] and 
                   log.timestamp >= cutoff_time
            ]
            
            # エラーメッセージのパターン分析
            error_patterns = defaultdict(int)
            component_errors = defaultdict(int)
            
            for log in error_logs:
                # エラーメッセージの最初の50文字でパターン化
                pattern = log.message[:50] + "..." if len(log.message) > 50 else log.message
                error_patterns[pattern] += 1
                component_errors[log.component.value] += 1
            
            return {
                'total_errors': len(error_logs),
                'error_patterns': dict(error_patterns),
                'component_errors': dict(component_errors),
                'time_range_hours': hours,
                'most_recent_error': error_logs[0].model_dump() if error_logs else None
            }
            
        except Exception as e:
            logger.error(f"Error getting error summary: {e}")
            return {}