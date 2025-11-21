#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WebSocket管理サービス - リアルタイム通信管理

Author: Recipe-DevUI Agent
Date: 2025-08-08
"""

import json
import asyncio
from typing import Dict, List, Any, Set
from fastapi import WebSocket
from datetime import datetime, timezone
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

class WebSocketManager:
    """WebSocket接続管理"""
    
    def __init__(self):
        """初期化"""
        # チャンネル別の接続管理
        self._connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        self._connection_info: Dict[WebSocket, Dict[str, Any]] = {}
        
        # 統計情報
        self._total_connections = 0
        self._message_count = 0
        
        logger.info("🔌 WebSocketManager initialized")
    
    async def connect(self, websocket: WebSocket, channel: str):
        """WebSocket接続を受け入れ"""
        try:
            await websocket.accept()
            
            # 接続をチャンネルに追加
            self._connections[channel].add(websocket)
            self._connection_info[websocket] = {
                'channel': channel,
                'connected_at': datetime.now(timezone.utc),
                'last_ping': datetime.now(timezone.utc)
            }
            
            self._total_connections += 1
            
            logger.info(f"🔗 WebSocket connected to channel '{channel}' (Total: {len(self._connections[channel])})")
            
            # 接続確認メッセージ送信
            await self._send_to_websocket(websocket, {
                'type': 'connection_established',
                'channel': channel,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error connecting WebSocket: {e}")
    
    def disconnect(self, websocket: WebSocket, channel: str):
        """WebSocket接続を切断"""
        try:
            # 接続をチャンネルから削除
            self._connections[channel].discard(websocket)
            
            # 接続情報を削除
            if websocket in self._connection_info:
                del self._connection_info[websocket]
            
            logger.info(f"❌ WebSocket disconnected from channel '{channel}' (Remaining: {len(self._connections[channel])})")
            
        except Exception as e:
            logger.error(f"Error disconnecting WebSocket: {e}")
    
    async def broadcast(self, channel: str, message: Dict[str, Any]):
        """チャンネルの全接続にメッセージをブロードキャスト"""
        try:
            if channel not in self._connections or not self._connections[channel]:
                logger.debug(f"No connections in channel '{channel}' for broadcast")
                return
            
            # 無効な接続を検出するためのリスト
            broken_connections = []
            
            # 各接続にメッセージ送信
            for websocket in self._connections[channel].copy():
                try:
                    await self._send_to_websocket(websocket, message)
                except Exception as e:
                    logger.warning(f"Failed to send message to WebSocket: {e}")
                    broken_connections.append(websocket)
            
            # 無効な接続を削除
            for websocket in broken_connections:
                self.disconnect(websocket, channel)
            
            sent_count = len(self._connections[channel]) - len(broken_connections)
            if sent_count > 0:
                logger.debug(f"📢 Broadcast message to {sent_count} connections in channel '{channel}'")
            
            self._message_count += sent_count
            
        except Exception as e:
            logger.error(f"Error broadcasting message: {e}")
    
    async def send_to_specific(self, websocket: WebSocket, message: Dict[str, Any]):
        """特定のWebSocket接続にメッセージ送信"""
        try:
            await self._send_to_websocket(websocket, message)
            self._message_count += 1
            
        except Exception as e:
            logger.error(f"Error sending message to specific WebSocket: {e}")
    
    async def _send_to_websocket(self, websocket: WebSocket, message: Dict[str, Any]):
        """WebSocketにJSONメッセージを送信"""
        try:
            # タイムスタンプを追加
            if 'timestamp' not in message:
                message['timestamp'] = datetime.now(timezone.utc).isoformat()
            
            # JSON形式で送信
            await websocket.send_text(json.dumps(message, ensure_ascii=False, default=str))
            
            # ping時刻を更新
            if websocket in self._connection_info:
                self._connection_info[websocket]['last_ping'] = datetime.now(timezone.utc)
            
        except Exception as e:
            logger.error(f"Error sending WebSocket message: {e}")
            raise
    
    async def ping_all_connections(self):
        """全接続にpingメッセージ送信（ヘルスチェック）"""
        try:
            ping_message = {
                'type': 'ping',
                'server_time': datetime.now(timezone.utc).isoformat()
            }
            
            total_pinged = 0
            broken_connections = []
            
            for channel, connections in self._connections.items():
                for websocket in connections.copy():
                    try:
                        await self._send_to_websocket(websocket, ping_message)
                        total_pinged += 1
                    except Exception:
                        broken_connections.append((websocket, channel))
            
            # 無効な接続を削除
            for websocket, channel in broken_connections:
                self.disconnect(websocket, channel)
            
            if total_pinged > 0:
                logger.debug(f"📊 Pinged {total_pinged} WebSocket connections")
            
        except Exception as e:
            logger.error(f"Error pinging connections: {e}")
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """接続統計情報を取得"""
        try:
            channel_stats = {}
            
            for channel, connections in self._connections.items():
                if connections:
                    connection_details = []
                    for websocket in connections:
                        info = self._connection_info.get(websocket, {})
                        connection_details.append({
                            'connected_at': info.get('connected_at', '').isoformat() if info.get('connected_at') else '',
                            'last_ping': info.get('last_ping', '').isoformat() if info.get('last_ping') else ''
                        })
                    
                    channel_stats[channel] = {
                        'active_connections': len(connections),
                        'connections': connection_details
                    }
            
            return {
                'total_connections': sum(len(connections) for connections in self._connections.values()),
                'total_lifetime_connections': self._total_connections,
                'total_messages_sent': self._message_count,
                'channels': channel_stats,
                'uptime': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting connection stats: {e}")
            return {}
    
    async def broadcast_system_alert(self, level: str, title: str, message: str, data: Dict[str, Any] = None):
        """システムアラートを全チャンネルに送信"""
        try:
            alert_message = {
                'type': 'system_alert',
                'level': level,
                'title': title,
                'message': message,
                'data': data or {},
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
            # 全チャンネルに送信
            for channel in self._connections.keys():
                await self.broadcast(channel, alert_message)
            
            logger.info(f"🚨 System alert broadcasted: {title}")
            
        except Exception as e:
            logger.error(f"Error broadcasting system alert: {e}")
    
    async def cleanup_stale_connections(self, max_idle_minutes: int = 30):
        """古い接続をクリーンアップ"""
        try:
            cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=max_idle_minutes)
            stale_connections = []
            
            for websocket, info in self._connection_info.items():
                last_ping = info.get('last_ping')
                if last_ping and last_ping < cutoff_time:
                    stale_connections.append((websocket, info.get('channel', 'unknown')))
            
            # 古い接続を削除
            for websocket, channel in stale_connections:
                self.disconnect(websocket, channel)
            
            if stale_connections:
                logger.info(f"🧹 Cleaned up {len(stale_connections)} stale WebSocket connections")
            
        except Exception as e:
            logger.error(f"Error cleaning up stale connections: {e}")
    
    async def send_log_update(self, log_entry: Dict[str, Any]):
        """ログ更新をログチャンネルに送信"""
        await self.broadcast('logs', {
            'type': 'new_log',
            'data': log_entry
        })
    
    async def send_system_update(self, system_data: Dict[str, Any]):
        """システム更新をシステムチャンネルに送信"""
        await self.broadcast('system', {
            'type': 'system_update',
            'data': system_data
        })
    
    async def send_recipe_update(self, recipe_data: Dict[str, Any]):
        """レシピ更新をレシピチャンネルに送信"""
        await self.broadcast('recipes', {
            'type': 'recipe_update',
            'data': recipe_data
        })