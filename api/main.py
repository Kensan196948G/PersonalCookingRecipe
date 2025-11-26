#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PersonalCookingRecipe FastAPI統合サーバー
既存のPythonサービスとWebUIを橋渡しするAPI層

Author: Recipe-DevUI Agent  
Date: 2025-08-08
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional
import uvicorn

from models.recipe_models import Recipe, RecipeFilters, SystemStatus, ChannelStats
from models.api_models import APIResponse, LogEntry, SystemConfig
from services.recipe_service import RecipeService
from services.log_service import LogService
from services.system_service import SystemService
from services.websocket_manager import WebSocketManager

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('../logs/api.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# サービス初期化
@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションライフサイクル管理"""
    logger.info("🚀 PersonalCookingRecipe API サーバー開始")
    
    # サービス初期化
    app.state.recipe_service = RecipeService()
    app.state.log_service = LogService()
    app.state.system_service = SystemService()
    app.state.websocket_manager = WebSocketManager()
    
    # バックグラウンドタスク開始
    asyncio.create_task(monitor_system_health(app))
    asyncio.create_task(broadcast_logs(app))
    
    yield
    
    logger.info("📊 PersonalCookingRecipe API サーバー終了")

# FastAPIアプリケーション初期化
app = FastAPI(
    title="PersonalCookingRecipe API",
    description="3チャンネル統合レシピ監視システム API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS設定（開発環境用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.3.135:3000",
        "http://192.168.3.135:3002",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


# ==============================================================================
# API エンドポイント
# ==============================================================================


@app.get("/", response_model=Dict[str, str])
async def root():
    """API ルートエンドポイント"""
    return {
        "message": "PersonalCookingRecipe API Server",
        "version": "1.0.0",
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/health", response_model=APIResponse[SystemStatus])
async def get_system_health():
    """システムヘルスチェック"""
    try:
        system_service: SystemService = app.state.system_service
        health_data = await system_service.get_system_status()
        
        return APIResponse(
            data=health_data,
            status="success",
            message="システムヘルス取得成功"
        )
    except Exception as e:
        logger.error(f"システムヘルス取得エラー: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/dashboard", response_model=APIResponse[Dict[str, Any]])
async def get_dashboard_data():
    """ダッシュボードデータ取得"""
    try:
        recipe_service: RecipeService = app.state.recipe_service
        system_service: SystemService = app.state.system_service
        
        # 並列でデータ取得
        dashboard_data, system_status, channel_stats = await asyncio.gather(
            recipe_service.get_dashboard_summary(),
            system_service.get_system_status(),
            recipe_service.get_channel_statistics(),
            return_exceptions=True
        )
        
        return APIResponse(
            data={
                "summary": dashboard_data,
                "systemStatus": system_status,
                "channelStats": channel_stats
            },
            status="success",
            message="ダッシュボードデータ取得成功"
        )
    except Exception as e:
        logger.error(f"ダッシュボードデータ取得エラー: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/recipes", response_model=APIResponse[List[Recipe]])
async def get_recipes(
    channel: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
):
    """レシピ一覧取得"""
    try:
        recipe_service: RecipeService = app.state.recipe_service
        
        filters = RecipeFilters(
            channel=channel,
            search_query=search,
            limit=limit,
            offset=offset
        )
        
        recipes = await recipe_service.get_recipes(filters)
        
        return APIResponse(
            data=recipes,
            status="success",
            message=f"{len(recipes)}件のレシピを取得"
        )
    except Exception as e:
        logger.error(f"レシピ取得エラー: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/recipes/{recipe_id}", response_model=APIResponse[Recipe])
async def get_recipe_detail(recipe_id: str):
    """レシピ詳細取得"""
    try:
        recipe_service: RecipeService = app.state.recipe_service
        recipe = await recipe_service.get_recipe_by_id(recipe_id)
        
        if not recipe:
            raise HTTPException(status_code=404, detail="レシピが見つかりません")
        
        return APIResponse(
            data=recipe,
            status="success",
            message="レシピ詳細取得成功"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"レシピ詳細取得エラー: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/channels/stats", response_model=APIResponse[List[ChannelStats]])
async def get_channel_stats():
    """チャンネル統計取得"""
    try:
        recipe_service: RecipeService = app.state.recipe_service
        stats = await recipe_service.get_channel_statistics()
        
        return APIResponse(
            data=stats,
            status="success",
            message="チャンネル統計取得成功"
        )
    except Exception as e:
        logger.error(f"チャンネル統計取得エラー: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/logs", response_model=APIResponse[List[LogEntry]])
async def get_logs(
    level: Optional[str] = None,
    component: Optional[str] = None,
    limit: int = 100
):
    """ログ取得"""
    try:
        log_service: LogService = app.state.log_service
        logs = await log_service.get_logs(
            level=level,
            component=component,
            limit=limit,
        )
        
        return APIResponse(
            data=logs,
            status="success",
            message=f"{len(logs)}件のログを取得"
        )
    except Exception as e:
        logger.error(f"ログ取得エラー: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/config", response_model=APIResponse[SystemConfig])
async def get_system_config():
    """システム設定取得"""
    try:
        system_service: SystemService = app.state.system_service
        config = await system_service.get_system_config()
        
        return APIResponse(
            data=config,
            status="success",
            message="システム設定取得成功"
        )
    except Exception as e:
        logger.error(f"システム設定取得エラー: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/config", response_model=APIResponse[Dict[str, str]])
async def update_system_config(config: SystemConfig):
    """システム設定更新"""
    try:
        system_service: SystemService = app.state.system_service
        success = await system_service.update_system_config(config)
        
        if not success:
            raise HTTPException(status_code=400, detail="設定更新に失敗しました")
        
        return APIResponse(
            data={"result": "success"},
            status="success",
            message="システム設定更新成功"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"システム設定更新エラー: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==============================================================================
# WebSocket エンドポイント
# ==============================================================================

@app.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    """リアルタイムログ配信WebSocket"""
    websocket_manager: WebSocketManager = app.state.websocket_manager
    await websocket_manager.connect(websocket, "logs")
    
    try:
        while True:
            data = await websocket.receive_text()
            # クライアントからのメッセージ処理（必要に応じて）
            pass
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, "logs")

@app.websocket("/ws/system")
async def websocket_system(websocket: WebSocket):
    """システム状態リアルタイム配信WebSocket"""
    websocket_manager: WebSocketManager = app.state.websocket_manager
    await websocket_manager.connect(websocket, "system")
    
    try:
        while True:
            data = await websocket.receive_text()
            # システム状態リクエスト処理
            pass
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, "system")

# ==============================================================================
# バックグラウンドタスク
# ==============================================================================

async def monitor_system_health(app: FastAPI):
    """システムヘルス監視バックグラウンドタスク"""
    while True:
        try:
            system_service: SystemService = app.state.system_service
            websocket_manager: WebSocketManager = app.state.websocket_manager
            
            health_data = await system_service.get_system_status()
            
            # WebSocketで配信
            await websocket_manager.broadcast(
                "system",
                {
                    "type": "health_update",
                    "data": health_data.model_dump(),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            
            await asyncio.sleep(30)  # 30秒間隔
            
        except Exception as e:
            logger.error(f"ヘルス監視エラー: {e}")
            await asyncio.sleep(60)  # エラー時は1分待機

async def broadcast_logs(app: FastAPI):
    """ログリアルタイム配信バックグラウンドタスク"""
    log_service: LogService = app.state.log_service
    websocket_manager: WebSocketManager = app.state.websocket_manager
    
    last_log_time = datetime.now(timezone.utc)
    
    while True:
        try:
            # 新しいログを取得
            new_logs = await log_service.get_logs_since(last_log_time, limit=10)
            
            if new_logs:
                # WebSocketで配信
                for log_entry in new_logs:
                    await websocket_manager.broadcast(
                        "logs",
                        {
                            "type": "new_log",
                            "data": log_entry.model_dump(),
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                    )
                
                last_log_time = new_logs[-1].timestamp
            
            await asyncio.sleep(5)  # 5秒間隔
            
        except Exception as e:
            logger.error(f"ログ配信エラー: {e}")
            await asyncio.sleep(30)

# ==============================================================================
# エラーハンドラー
# ==============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP例外ハンドラー"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "message": exc.detail,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """一般例外ハンドラー"""
    logger.error(f"予期しないエラー: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "内部サーバーエラーが発生しました",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )

# ==============================================================================
# サーバー起動
# ==============================================================================

if __name__ == "__main__":
    logger.info("🔥 PersonalCookingRecipe API サーバー起動中...")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
        access_log=True
    )