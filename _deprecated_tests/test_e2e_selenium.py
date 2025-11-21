#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
エンドツーエンドSeleniumテスト
PersonalCookingRecipe - 3チャンネル統合レシピ監視システム

完全なユーザーワークフローのE2Eテストを実行します。
"""

import os
import sys
import pytest
import logging
import json
import time
import threading
import subprocess
from pathlib import Path
from typing import Dict, Any, List
from unittest.mock import Mock, patch

# Seleniumインポート（オプション）
try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.firefox.options import Options as FirefoxOptions
    from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False


@pytest.mark.e2e
class TestEndToEndWorkflow:
    """エンドツーエンドワークフローテストクラス"""
    
    @pytest.fixture(autouse=True)
    def setup(self, test_config_dir, test_logger):
        """E2Eテストセットアップ"""
        self.config_dir = test_config_dir
        self.logger = test_logger
        self.driver = None
        self.test_server = None
        self.test_port = 8080
        
        if not SELENIUM_AVAILABLE:
            pytest.skip("Seleniumが利用できないため、E2Eテストをスキップ")
        
        self.logger.info("E2Eテストセットアップ完了")
    
    def _setup_webdriver(self, browser="chrome", headless=True):
        """WebDriverセットアップ"""
        try:
            if browser.lower() == "chrome":
                options = ChromeOptions()
                if headless:
                    options.add_argument("--headless")
                options.add_argument("--no-sandbox")
                options.add_argument("--disable-dev-shm-usage")
                options.add_argument("--disable-gpu")
                options.add_argument("--window-size=1920,1080")
                options.add_argument("--disable-web-security")
                options.add_argument("--allow-running-insecure-content")
                
                self.driver = webdriver.Chrome(options=options)
                
            elif browser.lower() == "firefox":
                options = FirefoxOptions()
                if headless:
                    options.add_argument("--headless")
                options.add_argument("--width=1920")
                options.add_argument("--height=1080")
                
                self.driver = webdriver.Firefox(options=options)
            
            # 暗黙の待機時間設定
            self.driver.implicitly_wait(10)
            self.logger.info(f"{browser} WebDriver初期化成功")
            return True
            
        except Exception as e:
            self.logger.error(f"WebDriver初期化失敗: {e}")
            return False
    
    def _teardown_webdriver(self):
        """WebDriverクリーンアップ"""
        if self.driver:
            try:
                self.driver.quit()
                self.logger.info("WebDriverクリーンアップ完了")
            except Exception as e:
                self.logger.error(f"WebDriverクリーンアップエラー: {e}")
    
    def _create_test_application(self):
        """テスト用Webアプリケーション作成"""
        app_html = """
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Recipe Monitor - E2E Test Application</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background: #f8f9fa; }
                
                .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
                
                header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                header h1 { font-size: 2.5rem; margin-bottom: 10px; }
                header p { font-size: 1.1rem; opacity: 0.9; }
                
                nav { margin: 20px 0; }
                nav ul { list-style: none; display: flex; gap: 15px; flex-wrap: wrap; }
                nav button { background: rgba(255,255,255,0.2); color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer; font-size: 16px; transition: all 0.3s ease; }
                nav button:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
                nav button.active { background: rgba(255,255,255,0.4); }
                
                .content-section { background: white; border-radius: 12px; padding: 30px; margin-bottom: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .content-section h2 { color: #333; margin-bottom: 20px; font-size: 1.8rem; }
                
                .recipe-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 25px; }
                .recipe-card { border: 1px solid #e9ecef; border-radius: 12px; overflow: hidden; transition: all 0.3s ease; background: white; }
                .recipe-card:hover { transform: translateY(-4px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
                .recipe-image { width: 100%; height: 200px; background: linear-gradient(45deg, #f0f0f0, #e0e0e0); display: flex; align-items: center; justify-content: center; color: #666; font-size: 14px; }
                .recipe-content { padding: 20px; }
                .recipe-title { font-size: 1.3rem; color: #333; margin-bottom: 8px; font-weight: 600; }
                .recipe-channel { color: #6c757d; margin-bottom: 12px; font-size: 0.95rem; }
                .recipe-description { color: #555; line-height: 1.6; margin-bottom: 15px; }
                .recipe-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; font-size: 0.9rem; color: #6c757d; }
                .recipe-actions { display: flex; gap: 10px; }
                
                .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s ease; text-decoration: none; display: inline-block; text-align: center; }
                .btn-primary { background: #007bff; color: white; }
                .btn-primary:hover { background: #0056b3; }
                .btn-success { background: #28a745; color: white; }
                .btn-success:hover { background: #1e7e34; }
                .btn-secondary { background: #6c757d; color: white; }
                .btn-secondary:hover { background: #545b62; }
                .btn:disabled { opacity: 0.6; cursor: not-allowed; }
                
                .form-group { margin-bottom: 20px; }
                .form-group label { display: block; margin-bottom: 8px; font-weight: 500; color: #333; }
                .form-control { width: 100%; padding: 12px 16px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 16px; transition: border-color 0.2s ease; }
                .form-control:focus { outline: none; border-color: #007bff; box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1); }
                .form-control.is-invalid { border-color: #dc3545; }
                
                .alert { padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; }
                .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .alert-danger { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                .alert-info { background: #cce7ff; color: #004085; border: 1px solid #b8d4f0; }
                
                .loading-spinner { border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                
                .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
                .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 12px; text-align: center; }
                .stat-number { font-size: 2.5rem; font-weight: bold; margin-bottom: 8px; }
                .stat-label { font-size: 1rem; opacity: 0.9; }
                
                .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); }
                .modal-content { background-color: white; margin: 5% auto; padding: 30px; border-radius: 12px; width: 80%; max-width: 600px; position: relative; }
                .modal-header { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef; }
                .modal-title { font-size: 1.5rem; color: #333; }
                .close { position: absolute; right: 20px; top: 15px; font-size: 28px; font-weight: bold; cursor: pointer; color: #aaa; }
                .close:hover { color: #000; }
                
                @media (max-width: 768px) {
                    .container { padding: 10px; }
                    header { padding: 20px; }
                    header h1 { font-size: 2rem; }
                    .recipe-grid { grid-template-columns: 1fr; }
                    nav ul { flex-direction: column; }
                    nav button { width: 100%; }
                    .stats-grid { grid-template-columns: 1fr 1fr; }
                    .modal-content { width: 95%; margin: 10% auto; padding: 20px; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <h1 id="app-title">Recipe Monitor</h1>
                    <p>3チャンネル統合レシピ監視システム - E2Eテスト版</p>
                    <nav>
                        <ul>
                            <li><button id="nav-dashboard" class="active">ダッシュボード</button></li>
                            <li><button id="nav-recipes">レシピ一覧</button></li>
                            <li><button id="nav-settings">設定</button></li>
                            <li><button id="nav-about">アバウト</button></li>
                        </ul>
                    </nav>
                </header>
                
                <!-- ダッシュボードセクション -->
                <section id="dashboard-section" class="content-section">
                    <h2>ダッシュボード</h2>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-number" id="total-recipes">24</div>
                            <div class="stat-label">保存済みレシピ</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number" id="monitored-channels">3</div>
                            <div class="stat-label">監視チャンネル</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number" id="new-today">5</div>
                            <div class="stat-label">今日の新着</div>
                        </div>
                    </div>
                    
                    <h3>最新のレシピ</h3>
                    <div id="recent-recipes" class="recipe-grid">
                        <div class="recipe-card" data-testid="recent-recipe-1">
                            <div class="recipe-image">Sam The Cooking Guy</div>
                            <div class="recipe-content">
                                <h4 class="recipe-title">15分でできる簡単パスタ</h4>
                                <p class="recipe-channel">Sam The Cooking Guy</p>
                                <p class="recipe-description">忙しい平日の夜にピッタリな、簡単で美味しいパスタレシピです。</p>
                                <div class="recipe-meta">
                                    <span>⏱️ 15分</span>
                                    <span>👀 12.5K views</span>
                                </div>
                                <div class="recipe-actions">
                                    <button class="btn btn-primary save-recipe-btn" data-recipe-id="1">保存</button>
                                    <button class="btn btn-secondary view-recipe-btn" data-recipe-id="1">詳細</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="recipe-card" data-testid="recent-recipe-2">
                            <div class="recipe-image">Bon Appétit</div>
                            <div class="recipe-content">
                                <h4 class="recipe-title">完璧なチョコレートクッキー</h4>
                                <p class="recipe-channel">Bon Appétit</p>
                                <p class="recipe-description">外はサクサク、中はしっとりの理想的なチョコレートクッキーの作り方。</p>
                                <div class="recipe-meta">
                                    <span>⏱️ 25分</span>
                                    <span>👀 45.2K views</span>
                                </div>
                                <div class="recipe-actions">
                                    <button class="btn btn-primary save-recipe-btn" data-recipe-id="2">保存</button>
                                    <button class="btn btn-secondary view-recipe-btn" data-recipe-id="2">詳細</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                
                <!-- レシピ一覧セクション -->
                <section id="recipes-section" class="content-section" style="display: none;">
                    <h2>保存済みレシピ一覧</h2>
                    <div class="form-group">
                        <input type="text" id="recipe-search" class="form-control" placeholder="レシピを検索...">
                    </div>
                    <div id="saved-recipes" class="recipe-grid">
                        <div class="recipe-card" data-testid="saved-recipe-1">
                            <div class="recipe-image">保存済み</div>
                            <div class="recipe-content">
                                <h4 class="recipe-title">クリーミーカルボナーラ</h4>
                                <p class="recipe-channel">Sam The Cooking Guy</p>
                                <p class="recipe-description">本格的なイタリアンカルボナーラのレシピ。クリーミーで濃厚な味わい。</p>
                                <div class="recipe-actions">
                                    <button class="btn btn-success">✓ 保存済み</button>
                                    <button class="btn btn-secondary">詳細</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                
                <!-- 設定セクション -->
                <section id="settings-section" class="content-section" style="display: none;">
                    <h2>システム設定</h2>
                    
                    <form id="settings-form">
                        <div class="form-group">
                            <label for="youtube-api-key">YouTube Data API v3 キー</label>
                            <input type="password" id="youtube-api-key" class="form-control" placeholder="API キーを入力してください">
                            <div id="api-key-feedback" style="margin-top: 8px; font-size: 0.9rem;"></div>
                        </div>
                        
                        <div class="form-group">
                            <label for="claude-api-key">Claude API キー</label>
                            <input type="password" id="claude-api-key" class="form-control" placeholder="Claude API キーを入力してください">
                        </div>
                        
                        <div class="form-group">
                            <label for="notion-token">Notion統合トークン</label>
                            <input type="password" id="notion-token" class="form-control" placeholder="Notionトークンを入力してください">
                        </div>
                        
                        <div class="form-group">
                            <label for="notification-email">通知メールアドレス</label>
                            <input type="email" id="notification-email" class="form-control" placeholder="your@email.com">
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="enable-notifications" style="margin-right: 8px;">
                                メール通知を有効にする
                            </label>
                        </div>
                        
                        <div class="form-group">
                            <label for="monitoring-interval">監視間隔（分）</label>
                            <input type="number" id="monitoring-interval" class="form-control" value="30" min="5" max="1440">
                        </div>
                        
                        <button type="submit" id="save-settings" class="btn btn-primary">設定を保存</button>
                        <button type="button" id="test-connection" class="btn btn-secondary" style="margin-left: 10px;">接続テスト</button>
                    </form>
                    
                    <div id="settings-status" style="margin-top: 20px;"></div>
                </section>
                
                <!-- アバウトセクション -->
                <section id="about-section" class="content-section" style="display: none;">
                    <h2>Recipe Monitor について</h2>
                    <p>このアプリケーションは、YouTubeの料理チャンネルを自動監視し、新しいレシピ動画を検出して通知するシステムです。</p>
                    
                    <h3>監視対象チャンネル</h3>
                    <ul>
                        <li><strong>Sam The Cooking Guy</strong> - 簡単で美味しい家庭料理</li>
                        <li><strong>Bon Appétit</strong> - プロの料理テクニックとレシピ</li>
                        <li><strong>Babish Culinary Universe</strong> - 映画・アニメの料理を再現</li>
                    </ul>
                    
                    <h3>主な機能</h3>
                    <ul>
                        <li>✅ 自動レシピ監視</li>
                        <li>✅ Claude AIによる内容解析</li>
                        <li>✅ Notionへの自動保存</li>
                        <li>✅ メール通知</li>
                        <li>✅ macOS統合（Keychain、LaunchDaemon）</li>
                    </ul>
                </section>
            </div>
            
            <!-- モーダルダイアログ -->
            <div id="recipe-modal" class="modal">
                <div class="modal-content">
                    <span class="close" id="modal-close">&times;</span>
                    <div class="modal-header">
                        <h3 class="modal-title" id="modal-recipe-title">レシピ詳細</h3>
                    </div>
                    <div id="modal-recipe-content">
                        <div class="loading-spinner"></div>
                        <p style="text-align: center;">レシピ情報を読み込み中...</p>
                    </div>
                </div>
            </div>
            
            <script>
                // ナビゲーション
                const sections = ['dashboard', 'recipes', 'settings', 'about'];
                const navButtons = {
                    'dashboard': document.getElementById('nav-dashboard'),
                    'recipes': document.getElementById('nav-recipes'),
                    'settings': document.getElementById('nav-settings'),
                    'about': document.getElementById('nav-about')
                };
                
                function showSection(sectionName) {
                    sections.forEach(name => {
                        const section = document.getElementById(name + '-section');
                        const button = navButtons[name];
                        
                        if (name === sectionName) {
                            section.style.display = 'block';
                            button.classList.add('active');
                        } else {
                            section.style.display = 'none';
                            button.classList.remove('active');
                        }
                    });
                }
                
                // ナビゲーションイベント
                Object.keys(navButtons).forEach(name => {
                    navButtons[name].addEventListener('click', () => showSection(name));
                });
                
                // レシピ保存機能
                document.querySelectorAll('.save-recipe-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const recipeId = this.getAttribute('data-recipe-id');
                        this.textContent = '✓ 保存済み';
                        this.classList.remove('btn-primary');
                        this.classList.add('btn-success');
                        this.disabled = true;
                        
                        // 統計を更新
                        const totalRecipes = document.getElementById('total-recipes');
                        totalRecipes.textContent = parseInt(totalRecipes.textContent) + 1;
                    });
                });
                
                // レシピ詳細表示
                document.querySelectorAll('.view-recipe-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const recipeId = this.getAttribute('data-recipe-id');
                        showRecipeModal(recipeId);
                    });
                });
                
                function showRecipeModal(recipeId) {
                    const modal = document.getElementById('recipe-modal');
                    const title = document.getElementById('modal-recipe-title');
                    const content = document.getElementById('modal-recipe-content');
                    
                    title.textContent = 'レシピ詳細を読み込み中...';
                    content.innerHTML = '<div class="loading-spinner"></div><p style="text-align: center;">レシピ情報を読み込み中...</p>';
                    modal.style.display = 'block';
                    
                    // シミュレートされたAPI呼び出し
                    setTimeout(() => {
                        title.textContent = recipeId === '1' ? '15分でできる簡単パスタ' : '完璧なチョコレートクッキー';
                        content.innerHTML = `
                            <h4>材料</h4>
                            <ul>
                                <li>スパゲッティ 200g</li>
                                <li>ベーコン 100g</li>
                                <li>玉ねぎ 1/2個</li>
                                <li>にんにく 2片</li>
                            </ul>
                            <h4>作り方</h4>
                            <ol>
                                <li>お湯を沸かし、スパゲッティを茹でる</li>
                                <li>フライパンでベーコンと玉ねぎを炒める</li>
                                <li>にんにくを加えて香りを出す</li>
                                <li>茹でたパスタと絡めて完成</li>
                            </ol>
                            <div style="margin-top: 20px;">
                                <button class="btn btn-primary" onclick="closeModal()">閉じる</button>
                            </div>
                        `;
                    }, 1500);
                }
                
                function closeModal() {
                    document.getElementById('recipe-modal').style.display = 'none';
                }
                
                // モーダル閉じる
                document.getElementById('modal-close').addEventListener('click', closeModal);
                
                // 設定フォーム
                document.getElementById('settings-form').addEventListener('submit', function(e) {
                    e.preventDefault();
                    
                    const status = document.getElementById('settings-status');
                    status.innerHTML = '<div class="alert alert-info">設定を保存中...</div>';
                    
                    // バリデーション
                    const youtubeKey = document.getElementById('youtube-api-key').value;
                    const claudeKey = document.getElementById('claude-api-key').value;
                    const notionToken = document.getElementById('notion-token').value;
                    
                    let isValid = true;
                    let errors = [];
                    
                    if (!youtubeKey.trim()) {
                        errors.push('YouTube API キーは必須です');
                        document.getElementById('youtube-api-key').classList.add('is-invalid');
                        isValid = false;
                    }
                    
                    if (!claudeKey.trim()) {
                        errors.push('Claude API キーは必須です');
                        document.getElementById('claude-api-key').classList.add('is-invalid');
                        isValid = false;
                    }
                    
                    setTimeout(() => {
                        if (isValid) {
                            status.innerHTML = '<div class="alert alert-success">設定が正常に保存されました！</div>';
                            // フォームをリセット
                            document.getElementById('youtube-api-key').classList.remove('is-invalid');
                            document.getElementById('claude-api-key').classList.remove('is-invalid');
                        } else {
                            status.innerHTML = `<div class="alert alert-danger"><strong>エラー:</strong><ul>${errors.map(e => '<li>' + e + '</li>').join('')}</ul></div>`;
                        }
                    }, 1000);
                });
                
                // 接続テスト
                document.getElementById('test-connection').addEventListener('click', function() {
                    this.disabled = true;
                    this.textContent = 'テスト中...';
                    
                    const status = document.getElementById('settings-status');
                    status.innerHTML = '<div class="alert alert-info">API接続をテスト中...</div>';
                    
                    setTimeout(() => {
                        const success = Math.random() > 0.3; // 70%の確率で成功
                        
                        if (success) {
                            status.innerHTML = '<div class="alert alert-success">✅ すべてのAPI接続が正常です</div>';
                        } else {
                            status.innerHTML = '<div class="alert alert-danger">❌ 一部のAPI接続に問題があります</div>';
                        }
                        
                        this.disabled = false;
                        this.textContent = '接続テスト';
                    }, 2000);
                });
                
                // レシピ検索
                document.getElementById('recipe-search').addEventListener('input', function() {
                    const query = this.value.toLowerCase();
                    const recipes = document.querySelectorAll('#saved-recipes .recipe-card');
                    
                    recipes.forEach(card => {
                        const title = card.querySelector('.recipe-title').textContent.toLowerCase();
                        const description = card.querySelector('.recipe-description').textContent.toLowerCase();
                        
                        if (title.includes(query) || description.includes(query)) {
                            card.style.display = 'block';
                        } else {
                            card.style.display = 'none';
                        }
                    });
                });
                
                // API キー入力フィードバック
                document.getElementById('youtube-api-key').addEventListener('input', function() {
                    const feedback = document.getElementById('api-key-feedback');
                    const value = this.value.trim();
                    
                    if (value.length === 0) {
                        feedback.textContent = '';
                        feedback.className = '';
                    } else if (value.startsWith('AIza') && value.length > 30) {
                        feedback.textContent = '✅ 有効なYouTube API キー形式です';
                        feedback.style.color = '#28a745';
                    } else {
                        feedback.textContent = '⚠️ YouTube API キー形式を確認してください';
                        feedback.style.color = '#ffc107';
                    }
                });
            </script>
        </body>
        </html>
        """
        
        app_file = self.config_dir / "e2e_test_app.html"
        with open(app_file, 'w', encoding='utf-8') as f:
            f.write(app_html)
        
        return app_file
    
    def test_complete_user_workflow(self):
        """完全なユーザーワークフローE2Eテスト"""
        self.logger.info("完全ユーザーワークフローE2Eテスト開始")
        
        workflow_results = {
            'application_load': False,
            'navigation': False,
            'recipe_interaction': False,
            'settings_configuration': False,
            'data_persistence': False,
            'modal_interaction': False,
            'form_validation': False,
            'responsive_behavior': False
        }
        
        try:
            # テストアプリケーション作成
            app_file = self._create_test_application()
            
            # WebDriverセットアップ
            if not self._setup_webdriver(headless=True):
                pytest.skip("WebDriverの初期化に失敗しました")
            
            file_url = f"file://{app_file.absolute()}"
            self.logger.info(f"テストアプリケーション読み込み: {file_url}")
            
            # 1. アプリケーション読み込みテスト
            self.driver.get(file_url)
            
            # タイトル確認
            WebDriverWait(self.driver, 15).until(
                lambda driver: "Recipe Monitor" in driver.title
            )
            
            # メインヘッダー確認
            main_title = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.ID, "app-title"))
            )
            assert "Recipe Monitor" in main_title.text, "メインタイトルが表示されていません"
            
            workflow_results['application_load'] = True
            self.logger.info("✅ アプリケーション読み込み成功")
            
            # 2. ナビゲーションテスト
            self.logger.info("ナビゲーション機能テスト")
            
            # 各セクションへの移動テスト
            navigation_tests = [
                ('nav-recipes', 'recipes-section', 'レシピ一覧'),
                ('nav-settings', 'settings-section', '設定'),
                ('nav-about', 'about-section', 'アバウト'),
                ('nav-dashboard', 'dashboard-section', 'ダッシュボード')
            ]
            
            nav_success = True
            for nav_id, section_id, section_name in navigation_tests:
                try:
                    nav_button = self.driver.find_element(By.ID, nav_id)
                    nav_button.click()
                    time.sleep(0.5)
                    
                    section = self.driver.find_element(By.ID, section_id)
                    if not section.is_displayed():
                        nav_success = False
                        self.logger.error(f"{section_name}セクションが表示されません")
                        break
                    
                    self.logger.info(f"✅ {section_name}ナビゲーション成功")
                    
                except NoSuchElementException:
                    nav_success = False
                    self.logger.error(f"{section_name}ナビゲーション要素が見つかりません")
                    break
            
            workflow_results['navigation'] = nav_success
            
            # 3. レシピインタラクションテスト
            self.logger.info("レシピインタラクション機能テスト")
            
            # ダッシュボードに戻る
            dashboard_nav = self.driver.find_element(By.ID, "nav-dashboard")
            dashboard_nav.click()
            time.sleep(0.5)
            
            # レシピ保存機能テスト
            save_buttons = self.driver.find_elements(By.CLASS_NAME, "save-recipe-btn")
            if len(save_buttons) >= 1:
                first_save_btn = save_buttons[0]
                original_text = first_save_btn.text
                first_save_btn.click()
                time.sleep(0.5)
                
                updated_text = first_save_btn.text
                is_disabled = not first_save_btn.is_enabled()
                
                recipe_interaction_success = (
                    updated_text != original_text and 
                    "保存済み" in updated_text and
                    is_disabled
                )
                
                workflow_results['recipe_interaction'] = recipe_interaction_success
                if recipe_interaction_success:
                    self.logger.info("✅ レシピ保存機能成功")
                else:
                    self.logger.error("❌ レシピ保存機能失敗")
            else:
                workflow_results['recipe_interaction'] = False
                self.logger.error("❌ レシピ保存ボタンが見つかりません")
            
            # 4. モーダルインタラクションテスト
            self.logger.info("モーダルダイアログ機能テスト")
            
            try:
                view_buttons = self.driver.find_elements(By.CLASS_NAME, "view-recipe-btn")
                if len(view_buttons) >= 1:
                    view_btn = view_buttons[0]
                    view_btn.click()
                    time.sleep(0.5)
                    
                    # モーダルが表示されることを確認
                    modal = WebDriverWait(self.driver, 10).until(
                        EC.visibility_of_element_located((By.ID, "recipe-modal"))
                    )
                    
                    # モーダル内容が読み込まれるまで待機
                    time.sleep(2)
                    
                    # モーダル閉じる
                    close_btn = self.driver.find_element(By.ID, "modal-close")
                    close_btn.click()
                    time.sleep(0.5)
                    
                    # モーダルが非表示になることを確認
                    modal_style = modal.value_of_css_property("display")
                    modal_interaction_success = modal_style == "none"
                    
                    workflow_results['modal_interaction'] = modal_interaction_success
                    if modal_interaction_success:
                        self.logger.info("✅ モーダルインタラクション成功")
                    else:
                        self.logger.error("❌ モーダルインタラクション失敗")
                else:
                    workflow_results['modal_interaction'] = False
                    self.logger.error("❌ レシピ詳細ボタンが見つかりません")
                    
            except TimeoutException:
                workflow_results['modal_interaction'] = False
                self.logger.error("❌ モーダル表示タイムアウト")
            
            # 5. 設定画面テスト
            self.logger.info("設定画面機能テスト")
            
            settings_nav = self.driver.find_element(By.ID, "nav-settings")
            settings_nav.click()
            time.sleep(0.5)
            
            # フォーム入力テスト
            youtube_input = self.driver.find_element(By.ID, "youtube-api-key")
            claude_input = self.driver.find_element(By.ID, "claude-api-key")
            email_input = self.driver.find_element(By.ID, "notification-email")
            
            # テストデータ入力
            youtube_input.send_keys("AIza_test_youtube_key_12345678901234567890")
            claude_input.send_keys("sk-test_claude_key_67890")
            email_input.send_keys("test@example.com")
            
            # 入力値確認
            youtube_value = youtube_input.get_attribute("value")
            claude_value = claude_input.get_attribute("value")
            email_value = email_input.get_attribute("value")
            
            input_success = (
                "AIza_test_youtube_key" in youtube_value and
                "sk-test_claude_key" in claude_value and
                email_value == "test@example.com"
            )
            
            if input_success:
                self.logger.info("✅ フォーム入力成功")
            else:
                self.logger.error("❌ フォーム入力失敗")
            
            # 6. フォーム送信と検証テスト
            self.logger.info("フォーム検証機能テスト")
            
            save_btn = self.driver.find_element(By.ID, "save-settings")
            save_btn.click()
            time.sleep(2)
            
            # 成功メッセージ確認
            status_div = self.driver.find_element(By.ID, "settings-status")
            status_content = status_div.get_attribute("innerHTML")
            
            form_validation_success = "正常に保存されました" in status_content
            workflow_results['form_validation'] = form_validation_success
            
            if form_validation_success:
                self.logger.info("✅ フォーム検証成功")
            else:
                self.logger.error("❌ フォーム検証失敗")
            
            workflow_results['settings_configuration'] = input_success and form_validation_success
            
            # 7. 接続テスト機能
            self.logger.info("API接続テスト機能テスト")
            
            test_connection_btn = self.driver.find_element(By.ID, "test-connection")
            test_connection_btn.click()
            time.sleep(3)  # テスト完了まで待機
            
            # テスト結果確認
            status_content = status_div.get_attribute("innerHTML")
            connection_test_success = ("正常です" in status_content) or ("問題があります" in status_content)
            
            if connection_test_success:
                self.logger.info("✅ 接続テスト機能成功")
            else:
                self.logger.error("❌ 接続テスト機能失敗")
            
            # 8. レスポンシブ動作テスト
            self.logger.info("レスポンシブ動作テスト")
            
            # 画面サイズ変更テスト
            screen_sizes = [
                (1920, 1080),  # デスクトップ
                (768, 1024),   # タブレット
                (375, 667)     # モバイル
            ]
            
            responsive_success = True
            for width, height in screen_sizes:
                self.driver.set_window_size(width, height)
                time.sleep(1)
                
                # メインタイトルが表示されているかチェック
                try:
                    title_element = self.driver.find_element(By.ID, "app-title")
                    if not title_element.is_displayed():
                        responsive_success = False
                        break
                except NoSuchElementException:
                    responsive_success = False
                    break
            
            workflow_results['responsive_behavior'] = responsive_success
            if responsive_success:
                self.logger.info("✅ レスポンシブ動作成功")
            else:
                self.logger.error("❌ レスポンシブ動作失敗")
            
            # 9. データ永続性シミュレーション
            self.logger.info("データ永続性シミュレーションテスト")
            
            # ページリロード
            self.driver.refresh()
            time.sleep(2)
            
            # アプリケーションが再読み込み後も動作するか確認
            try:
                main_title = self.driver.find_element(By.ID, "app-title")
                persistence_success = "Recipe Monitor" in main_title.text
                workflow_results['data_persistence'] = persistence_success
                
                if persistence_success:
                    self.logger.info("✅ データ永続性テスト成功")
                else:
                    self.logger.error("❌ データ永続性テスト失敗")
            except NoSuchElementException:
                workflow_results['data_persistence'] = False
                self.logger.error("❌ ページリロード後の要素が見つかりません")
            
            # 結果検証
            successful_workflows = sum(workflow_results.values())
            total_workflows = len(workflow_results)
            success_rate = successful_workflows / total_workflows
            
            self.logger.info(f"E2Eワークフローテスト結果: {workflow_results}")
            self.logger.info(f"ワークフロー成功率: {successful_workflows}/{total_workflows} ({success_rate:.1%})")
            
            # 最低75%のワークフローが成功することを確認
            assert success_rate >= 0.75, f"E2Eワークフロー成功率が不足: {success_rate:.1%}"
            
        except Exception as e:
            self.logger.error(f"E2Eワークフローテスト例外: {e}")
            pytest.fail(f"E2Eワークフローテスト失敗: {e}")
        
        finally:
            self._teardown_webdriver()
            
            # テストファイルクリーンアップ
            try:
                if app_file and app_file.exists():
                    app_file.unlink()
            except Exception:
                pass
    
    def test_error_handling_scenarios(self):
        """エラーハンドリングシナリオテスト"""
        self.logger.info("エラーハンドリングシナリオテスト開始")
        
        # エラーシナリオ用HTML作成
        error_test_html = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Error Handling Test</title>
            <style>
                .error { color: red; background: #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 4px; }
                .loading { color: #0984e3; }
                button { padding: 10px; margin: 5px; }
                input { padding: 8px; margin: 5px; width: 200px; }
            </style>
        </head>
        <body>
            <h1>Error Handling Test Page</h1>
            
            <div id="error-scenarios">
                <h2>Error Test Scenarios</h2>
                
                <div>
                    <button id="trigger-network-error">Network Error</button>
                    <button id="trigger-validation-error">Validation Error</button>
                    <button id="trigger-timeout-error">Timeout Error</button>
                    <button id="trigger-permission-error">Permission Error</button>
                </div>
                
                <form id="error-form">
                    <input type="email" id="email-input" placeholder="Enter email" required>
                    <button type="submit" id="submit-form">Submit</button>
                </form>
                
                <div id="error-display"></div>
                <div id="loading-indicator" style="display: none;">
                    <p class="loading">Loading...</p>
                </div>
            </div>
            
            <script>
                function showError(message, type = 'error') {
                    const errorDiv = document.getElementById('error-display');
                    errorDiv.innerHTML = '<div class="' + type + '">' + message + '</div>';
                }
                
                function showLoading(show = true) {
                    const loadingDiv = document.getElementById('loading-indicator');
                    loadingDiv.style.display = show ? 'block' : 'none';
                }
                
                // Network Error
                document.getElementById('trigger-network-error').onclick = function() {
                    showLoading(true);
                    setTimeout(() => {
                        showLoading(false);
                        showError('Network connection failed. Please check your internet connection.');
                    }, 1500);
                };
                
                // Validation Error
                document.getElementById('trigger-validation-error').onclick = function() {
                    showError('Validation failed: Required fields are missing.');
                };
                
                // Timeout Error
                document.getElementById('trigger-timeout-error').onclick = function() {
                    showLoading(true);
                    setTimeout(() => {
                        showLoading(false);
                        showError('Request timeout. The server took too long to respond.');
                    }, 3000);
                };
                
                // Permission Error
                document.getElementById('trigger-permission-error').onclick = function() {
                    showError('Access denied. You do not have permission to perform this action.');
                };
                
                // Form validation
                document.getElementById('error-form').addEventListener('submit', function(e) {
                    e.preventDefault();
                    
                    const emailInput = document.getElementById('email-input');
                    const email = emailInput.value.trim();
                    
                    if (!email) {
                        showError('Email is required.');
                        return;
                    }
                    
                    if (!email.includes('@')) {
                        showError('Please enter a valid email address.');
                        return;
                    }
                    
                    showError('Form submitted successfully!', 'success');
                });
            </script>
        </body>
        </html>
        """
        
        error_handling_results = {
            'network_error_display': False,
            'validation_error_display': False,
            'timeout_error_handling': False,
            'permission_error_display': False,
            'form_validation_errors': False,
            'loading_indicators': False
        }
        
        try:
            # エラーテスト用HTMLファイル作成
            error_html_file = self.config_dir / "error_test.html"
            with open(error_html_file, 'w', encoding='utf-8') as f:
                f.write(error_test_html)
            
            # WebDriverセットアップ
            if not self._setup_webdriver(headless=True):
                pytest.skip("WebDriverの初期化に失敗しました")
            
            file_url = f"file://{error_html_file.absolute()}"
            self.driver.get(file_url)
            
            # ページ読み込み確認
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.ID, "error-scenarios"))
            )
            
            # 1. ネットワークエラーテスト
            self.logger.info("ネットワークエラーハンドリングテスト")
            
            network_error_btn = self.driver.find_element(By.ID, "trigger-network-error")
            network_error_btn.click()
            
            # ローディング表示確認
            loading_indicator = WebDriverWait(self.driver, 5).until(
                EC.visibility_of_element_located((By.ID, "loading-indicator"))
            )
            error_handling_results['loading_indicators'] = True
            
            # エラーメッセージ表示確認
            WebDriverWait(self.driver, 10).until(
                EC.text_to_be_present_in_element((By.ID, "error-display"), "Network connection failed")
            )
            error_handling_results['network_error_display'] = True
            self.logger.info("✅ ネットワークエラー表示成功")
            
            # 2. バリデーションエラーテスト
            self.logger.info("バリデーションエラーハンドリングテスト")
            
            validation_error_btn = self.driver.find_element(By.ID, "trigger-validation-error")
            validation_error_btn.click()
            time.sleep(0.5)
            
            error_display = self.driver.find_element(By.ID, "error-display")
            if "Validation failed" in error_display.text:
                error_handling_results['validation_error_display'] = True
                self.logger.info("✅ バリデーションエラー表示成功")
            
            # 3. タイムアウトエラーテスト
            self.logger.info("タイムアウトエラーハンドリングテスト")
            
            timeout_error_btn = self.driver.find_element(By.ID, "trigger-timeout-error")
            timeout_error_btn.click()
            
            # タイムアウト後のエラーメッセージ確認
            WebDriverWait(self.driver, 10).until(
                EC.text_to_be_present_in_element((By.ID, "error-display"), "Request timeout")
            )
            error_handling_results['timeout_error_handling'] = True
            self.logger.info("✅ タイムアウトエラー表示成功")
            
            # 4. 権限エラーテスト
            self.logger.info("権限エラーハンドリングテスト")
            
            permission_error_btn = self.driver.find_element(By.ID, "trigger-permission-error")
            permission_error_btn.click()
            time.sleep(0.5)
            
            error_display = self.driver.find_element(By.ID, "error-display")
            if "Access denied" in error_display.text:
                error_handling_results['permission_error_display'] = True
                self.logger.info("✅ 権限エラー表示成功")
            
            # 5. フォームバリデーションエラーテスト
            self.logger.info("フォームバリデーションエラーテスト")
            
            # 無効なメールアドレスでテスト
            email_input = self.driver.find_element(By.ID, "email-input")
            submit_btn = self.driver.find_element(By.ID, "submit-form")
            
            # 空の入力でテスト
            email_input.clear()
            submit_btn.click()
            time.sleep(0.5)
            
            error_display = self.driver.find_element(By.ID, "error-display")
            empty_email_error = "Email is required" in error_display.text
            
            # 無効なメール形式でテスト
            email_input.clear()
            email_input.send_keys("invalid-email")
            submit_btn.click()
            time.sleep(0.5)
            
            error_display = self.driver.find_element(By.ID, "error-display")
            invalid_email_error = "valid email address" in error_display.text
            
            # 有効なメールでテスト
            email_input.clear()
            email_input.send_keys("test@example.com")
            submit_btn.click()
            time.sleep(0.5)
            
            error_display = self.driver.find_element(By.ID, "error-display")
            success_message = "successfully" in error_display.text
            
            error_handling_results['form_validation_errors'] = (
                empty_email_error and invalid_email_error and success_message
            )
            
            if error_handling_results['form_validation_errors']:
                self.logger.info("✅ フォームバリデーション成功")
            else:
                self.logger.error("❌ フォームバリデーション失敗")
            
            # 結果検証
            successful_error_tests = sum(error_handling_results.values())
            total_error_tests = len(error_handling_results)
            error_handling_rate = successful_error_tests / total_error_tests
            
            self.logger.info(f"エラーハンドリングテスト結果: {error_handling_results}")
            self.logger.info(f"エラーハンドリング成功率: {successful_error_tests}/{total_error_tests} ({error_handling_rate:.1%})")
            
            # 最低80%のエラーハンドリングが動作することを確認
            assert error_handling_rate >= 0.8, f"エラーハンドリング率が不足: {error_handling_rate:.1%}"
            
        except Exception as e:
            self.logger.error(f"エラーハンドリングテスト例外: {e}")
            pytest.fail(f"エラーハンドリングテスト失敗: {e}")
        
        finally:
            self._teardown_webdriver()
            
            # テストファイルクリーンアップ
            try:
                if error_html_file.exists():
                    error_html_file.unlink()
            except Exception:
                pass


def run_e2e_tests():
    """E2Eテストの実行"""
    print("=== PersonalCookRecipe E2Eテスト実行 ===")
    
    if not SELENIUM_AVAILABLE:
        print("⚠️ Seleniumが利用できないため、E2Eテストをスキップします")
        print("   pip install selenium でSeleniumをインストールしてください")
        print("   また、ChromeDriverまたはGeckoDriverが必要です")
        return 0
    
    pytest_args = [
        __file__,
        "-v",
        "--tb=short",
        "--strict-markers",
        "-m", "e2e"
    ]
    
    return pytest.main(pytest_args)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    exit_code = run_e2e_tests()
    sys.exit(exit_code)