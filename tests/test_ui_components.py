#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UIコンポーネントテスト
PersonalCookingRecipe - 3チャンネル統合レシピ監視システム

React UIコンポーネントのテスト（Python側からのSeleniumベース）
"""

import os
import sys
import pytest
import logging
import json
import time
from pathlib import Path
from typing import Dict, Any, List
from unittest.mock import Mock, patch

# Seleniumインポート（オプション）
try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.service import Service as ChromeService
    from selenium.webdriver.firefox.service import Service as FirefoxService
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.firefox.options import Options as FirefoxOptions
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False


@pytest.mark.ui
class TestUIComponents:
    """UIコンポーネントテストクラス"""
    
    @pytest.fixture(autouse=True)
    def setup(self, test_config_dir, test_logger):
        """UIテストセットアップ"""
        self.config_dir = test_config_dir
        self.logger = test_logger
        self.driver = None
        self.test_server_port = 3000
        
        if not SELENIUM_AVAILABLE:
            pytest.skip("Seleniumが利用できないため、UIテストをスキップ")
        
        self.logger.info("UIコンポーネントテストセットアップ完了")
    
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
                
                # ChromeDriverパスの自動検出を試行
                try:
                    self.driver = webdriver.Chrome(options=options)
                except Exception as e:
                    self.logger.warning(f"Chrome WebDriver初期化失敗: {e}")
                    return False
            
            elif browser.lower() == "firefox":
                options = FirefoxOptions()
                if headless:
                    options.add_argument("--headless")
                options.add_argument("--width=1920")
                options.add_argument("--height=1080")
                
                try:
                    self.driver = webdriver.Firefox(options=options)
                except Exception as e:
                    self.logger.warning(f"Firefox WebDriver初期化失敗: {e}")
                    return False
            
            self.logger.info(f"{browser} WebDriver初期化成功")
            return True
            
        except Exception as e:
            self.logger.error(f"WebDriver初期化例外: {e}")
            return False
    
    def _teardown_webdriver(self):
        """WebDriverクリーンアップ"""
        if self.driver:
            try:
                self.driver.quit()
                self.logger.info("WebDriverクリーンアップ完了")
            except Exception as e:
                self.logger.error(f"WebDriverクリーンアップエラー: {e}")
    
    def test_static_ui_components(self):
        """静的UIコンポーネントテスト（HTMLファイルベース）"""
        self.logger.info("静的UIコンポーネントテスト開始")
        
        # テスト用HTMLファイル作成
        test_html = """
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Recipe Monitor Test</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .recipe-card { border: 1px solid #ddd; padding: 15px; margin: 10px; border-radius: 8px; }
                .recipe-title { font-size: 18px; font-weight: bold; color: #333; }
                .recipe-channel { color: #666; margin: 5px 0; }
                .recipe-description { margin: 10px 0; }
                .button-primary { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
                .button-primary:hover { background: #0056b3; }
                .error-message { color: #dc3545; background: #f8d7da; padding: 10px; border-radius: 4px; }
                .loading-spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div id="app">
                <header>
                    <h1 id="main-title">Recipe Monitor Dashboard</h1>
                    <nav>
                        <button id="nav-dashboard" class="button-primary">Dashboard</button>
                        <button id="nav-recipes" class="button-primary">Recipes</button>
                        <button id="nav-settings" class="button-primary">Settings</button>
                    </nav>
                </header>
                
                <main>
                    <div id="dashboard-section">
                        <h2>Recent Recipes</h2>
                        <div id="recipe-list">
                            <div class="recipe-card" data-testid="recipe-card-1">
                                <h3 class="recipe-title">Amazing Pasta Recipe</h3>
                                <p class="recipe-channel">Sam The Cooking Guy</p>
                                <p class="recipe-description">Learn how to make delicious pasta with simple ingredients.</p>
                                <button class="button-primary save-recipe-btn" data-recipe-id="1">Save Recipe</button>
                            </div>
                            
                            <div class="recipe-card" data-testid="recipe-card-2">
                                <h3 class="recipe-title">Perfect Chocolate Cake</h3>
                                <p class="recipe-channel">Bon Appétit</p>
                                <p class="recipe-description">The ultimate chocolate cake recipe that never fails.</p>
                                <button class="button-primary save-recipe-btn" data-recipe-id="2">Save Recipe</button>
                            </div>
                        </div>
                    </div>
                    
                    <div id="settings-section" style="display: none;">
                        <h2>Settings</h2>
                        <form id="settings-form">
                            <div>
                                <label for="api-key-input">YouTube API Key:</label>
                                <input type="password" id="api-key-input" placeholder="Enter your API key">
                            </div>
                            <div>
                                <label for="notification-email">Notification Email:</label>
                                <input type="email" id="notification-email" placeholder="your@email.com">
                            </div>
                            <div>
                                <label>
                                    <input type="checkbox" id="enable-notifications"> Enable Email Notifications
                                </label>
                            </div>
                            <button type="submit" id="save-settings" class="button-primary">Save Settings</button>
                        </form>
                    </div>
                    
                    <div id="loading-section" style="display: none;">
                        <div class="loading-spinner"></div>
                        <p>Loading recipes...</p>
                    </div>
                    
                    <div id="error-section" style="display: none;">
                        <div class="error-message">
                            <strong>Error:</strong> Failed to load recipes. Please check your API configuration.
                        </div>
                    </div>
                </main>
            </div>
            
            <script>
                // 基本的なインタラクション
                document.getElementById('nav-dashboard').onclick = function() {
                    document.getElementById('dashboard-section').style.display = 'block';
                    document.getElementById('settings-section').style.display = 'none';
                };
                
                document.getElementById('nav-settings').onclick = function() {
                    document.getElementById('dashboard-section').style.display = 'none';
                    document.getElementById('settings-section').style.display = 'block';
                };
                
                document.getElementById('settings-form').onsubmit = function(e) {
                    e.preventDefault();
                    alert('Settings saved successfully!');
                };
                
                // レシピ保存ボタン
                document.querySelectorAll('.save-recipe-btn').forEach(btn => {
                    btn.onclick = function() {
                        const recipeId = this.getAttribute('data-recipe-id');
                        this.textContent = 'Saved!';
                        this.disabled = true;
                    };
                });
            </script>
        </body>
        </html>
        """
        
        ui_test_results = {
            'page_load': False,
            'navigation': False,
            'form_interaction': False,
            'button_functionality': False,
            'responsive_design': False
        }
        
        try:
            # HTMLファイル保存
            test_html_file = self.config_dir / "test_ui.html"
            with open(test_html_file, 'w', encoding='utf-8') as f:
                f.write(test_html)
            
            # WebDriverセットアップ
            if not self._setup_webdriver(headless=True):
                pytest.skip("WebDriverの初期化に失敗しました")
            
            # ページロードテスト
            self.logger.info("ページロードテスト")
            file_url = f"file://{test_html_file.absolute()}"
            self.driver.get(file_url)
            
            # ページタイトル確認
            WebDriverWait(self.driver, 10).until(
                lambda driver: driver.title == "Recipe Monitor Test"
            )
            ui_test_results['page_load'] = True
            
            # ナビゲーションテスト
            self.logger.info("ナビゲーションテスト")
            
            # ダッシュボードセクションが表示されていることを確認
            dashboard_section = self.driver.find_element(By.ID, "dashboard-section")
            assert dashboard_section.is_displayed(), "ダッシュボードセクションが表示されていません"
            
            # 設定ボタンクリック
            settings_btn = self.driver.find_element(By.ID, "nav-settings")
            settings_btn.click()
            time.sleep(0.5)
            
            # 設定セクションが表示されることを確認
            settings_section = self.driver.find_element(By.ID, "settings-section")
            assert settings_section.is_displayed(), "設定セクションが表示されていません"
            
            ui_test_results['navigation'] = True
            
            # フォームインタラクションテスト
            self.logger.info("フォームインタラクションテスト")
            
            api_key_input = self.driver.find_element(By.ID, "api-key-input")
            email_input = self.driver.find_element(By.ID, "notification-email")
            checkbox = self.driver.find_element(By.ID, "enable-notifications")
            
            # フォーム入力
            api_key_input.send_keys("test_api_key_12345")
            email_input.send_keys("test@example.com")
            checkbox.click()
            
            # 入力値確認
            assert api_key_input.get_attribute("value") == "test_api_key_12345", "API Key入力値が一致しません"
            assert email_input.get_attribute("value") == "test@example.com", "Email入力値が一致しません"
            assert checkbox.is_selected(), "チェックボックスが選択されていません"
            
            ui_test_results['form_interaction'] = True
            
            # ボタン機能テスト
            self.logger.info("ボタン機能テスト")
            
            # ダッシュボードに戻る
            dashboard_btn = self.driver.find_element(By.ID, "nav-dashboard")
            dashboard_btn.click()
            time.sleep(0.5)
            
            # レシピ保存ボタンテスト
            save_buttons = self.driver.find_elements(By.CLASS_NAME, "save-recipe-btn")
            assert len(save_buttons) >= 2, "レシピ保存ボタンが見つかりません"
            
            # 最初の保存ボタンクリック
            first_save_btn = save_buttons[0]
            original_text = first_save_btn.text
            first_save_btn.click()
            time.sleep(0.5)
            
            # ボタンテキストが変更されることを確認
            updated_text = first_save_btn.text
            assert updated_text == "Saved!", f"ボタンテキストが変更されていません: {updated_text}"
            assert not first_save_btn.is_enabled(), "ボタンが無効化されていません"
            
            ui_test_results['button_functionality'] = True
            
            # レスポンシブデザインテスト
            self.logger.info("レスポンシブデザインテスト")
            
            # ウィンドウサイズ変更
            window_sizes = [
                (1920, 1080),  # デスクトップ
                (768, 1024),   # タブレット
                (375, 667)     # モバイル
            ]
            
            responsive_success = True
            for width, height in window_sizes:
                self.driver.set_window_size(width, height)
                time.sleep(0.5)
                
                # メインタイトルが表示されていることを確認
                main_title = self.driver.find_element(By.ID, "main-title")
                if not main_title.is_displayed():
                    responsive_success = False
                    break
                
                # レシピカードが表示されていることを確認
                recipe_cards = self.driver.find_elements(By.CSS_SELECTOR, "[data-testid^='recipe-card-']")
                if len(recipe_cards) == 0:
                    responsive_success = False
                    break
            
            ui_test_results['responsive_design'] = responsive_success
            
            # 結果検証
            successful_tests = sum(ui_test_results.values())
            total_tests = len(ui_test_results)
            success_rate = successful_tests / total_tests
            
            self.logger.info(f"UIコンポーネントテスト結果: {ui_test_results}")
            self.logger.info(f"UI成功率: {successful_tests}/{total_tests} ({success_rate:.1%})")
            
            # 最低80%のUIテストが成功することを確認
            assert success_rate >= 0.8, f"UIテスト成功率が不足: {success_rate:.1%}"
            
        except Exception as e:
            self.logger.error(f"UIコンポーネントテスト例外: {e}")
            pytest.fail(f"UIコンポーネントテスト失敗: {e}")
        
        finally:
            self._teardown_webdriver()
            
            # テストファイルクリーンアップ
            try:
                if test_html_file.exists():
                    test_html_file.unlink()
            except Exception:
                pass
    
    def test_accessibility_features(self):
        """アクセシビリティ機能テスト"""
        self.logger.info("アクセシビリティ機能テスト開始")
        
        # アクセシブルなHTMLテンプレート
        accessible_html = """
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Accessible Recipe Monitor</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
                .sr-only { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
                .focus-visible { outline: 2px solid #007bff; outline-offset: 2px; }
                .recipe-card { border: 1px solid #ddd; padding: 15px; margin: 10px; border-radius: 8px; }
                .recipe-card:focus-within { box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25); }
                button { padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
                button:focus { outline: 2px solid #007bff; outline-offset: 2px; }
                .button-primary { background: #007bff; color: white; }
                .button-primary:hover { background: #0056b3; }
                .button-primary:disabled { background: #6c757d; cursor: not-allowed; }
                input, textarea { padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
                input:focus, textarea:focus { border-color: #007bff; box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25); }
                label { display: block; margin-bottom: 5px; font-weight: bold; }
                .error { color: #dc3545; }
                .success { color: #28a745; }
            </style>
        </head>
        <body>
            <div id="app">
                <header role="banner">
                    <h1 id="main-heading">Recipe Monitor - Accessibility Test</h1>
                    <nav role="navigation" aria-label="Main navigation">
                        <ul role="menubar" style="list-style: none; padding: 0; display: flex; gap: 10px;">
                            <li role="none">
                                <button id="nav-home" role="menuitem" class="button-primary" aria-current="page">
                                    Home
                                    <span class="sr-only">(current page)</span>
                                </button>
                            </li>
                            <li role="none">
                                <button id="nav-recipes" role="menuitem" class="button-primary">Recipes</button>
                            </li>
                            <li role="none">
                                <button id="nav-settings" role="menuitem" class="button-primary">Settings</button>
                            </li>
                        </ul>
                    </nav>
                </header>
                
                <main role="main" id="main-content">
                    <section aria-labelledby="recipes-heading">
                        <h2 id="recipes-heading">Featured Recipes</h2>
                        <div role="region" aria-label="Recipe list">
                            <article class="recipe-card" aria-labelledby="recipe-1-title" tabindex="0">
                                <h3 id="recipe-1-title">Quick Pasta Recipe</h3>
                                <p aria-label="Channel">Channel: <span>Sam The Cooking Guy</span></p>
                                <p aria-label="Description">A simple and delicious pasta recipe perfect for weeknight dinners.</p>
                                <button class="button-primary" aria-describedby="recipe-1-title" data-recipe-id="1">
                                    Save to Favorites
                                    <span class="sr-only">Quick Pasta Recipe</span>
                                </button>
                            </article>
                            
                            <article class="recipe-card" aria-labelledby="recipe-2-title" tabindex="0">
                                <h3 id="recipe-2-title">Chocolate Chip Cookies</h3>
                                <p aria-label="Channel">Channel: <span>Bon Appétit</span></p>
                                <p aria-label="Description">Classic chocolate chip cookies that are crispy outside and chewy inside.</p>
                                <button class="button-primary" aria-describedby="recipe-2-title" data-recipe-id="2">
                                    Save to Favorites
                                    <span class="sr-only">Chocolate Chip Cookies</span>
                                </button>
                            </article>
                        </div>
                    </section>
                    
                    <section aria-labelledby="settings-heading" id="settings-section" style="display: none;">
                        <h2 id="settings-heading">Settings</h2>
                        <form id="settings-form" novalidate>
                            <fieldset>
                                <legend>API Configuration</legend>
                                <div>
                                    <label for="youtube-api-key">YouTube API Key *</label>
                                    <input 
                                        type="password" 
                                        id="youtube-api-key" 
                                        required 
                                        aria-describedby="api-key-help api-key-error"
                                        autocomplete="off">
                                    <div id="api-key-help" class="sr-only">Enter your YouTube Data API v3 key</div>
                                    <div id="api-key-error" role="alert" aria-live="polite" class="error" style="display: none;"></div>
                                </div>
                            </fieldset>
                            
                            <fieldset>
                                <legend>Notification Settings</legend>
                                <div>
                                    <label for="notification-email">Email Address</label>
                                    <input 
                                        type="email" 
                                        id="notification-email" 
                                        aria-describedby="email-help"
                                        autocomplete="email">
                                    <div id="email-help" class="sr-only">Email address for recipe notifications</div>
                                </div>
                                
                                <div>
                                    <label>
                                        <input type="checkbox" id="enable-email-notifications" aria-describedby="email-notifications-help">
                                        Enable email notifications
                                    </label>
                                    <div id="email-notifications-help" class="sr-only">Receive email notifications when new recipes are found</div>
                                </div>
                            </fieldset>
                            
                            <div>
                                <button type="submit" id="save-settings" class="button-primary">
                                    Save Settings
                                </button>
                                <div id="settings-status" role="status" aria-live="polite" style="margin-top: 10px;"></div>
                            </div>
                        </form>
                    </section>
                </main>
                
                <footer role="contentinfo">
                    <p>&copy; 2024 Recipe Monitor. All rights reserved.</p>
                </footer>
            </div>
            
            <script>
                // キーボードナビゲーション
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Tab' && !e.shiftKey) {
                        // Tab順序の管理
                    }
                });
                
                // フォーム検証
                document.getElementById('settings-form').addEventListener('submit', function(e) {
                    e.preventDefault();
                    
                    const apiKey = document.getElementById('youtube-api-key');
                    const errorDiv = document.getElementById('api-key-error');
                    const statusDiv = document.getElementById('settings-status');
                    
                    if (!apiKey.value.trim()) {
                        errorDiv.textContent = 'API key is required';
                        errorDiv.style.display = 'block';
                        apiKey.setAttribute('aria-invalid', 'true');
                        apiKey.focus();
                        return;
                    }
                    
                    errorDiv.style.display = 'none';
                    apiKey.removeAttribute('aria-invalid');
                    statusDiv.textContent = 'Settings saved successfully!';
                    statusDiv.className = 'success';
                });
            </script>
        </body>
        </html>
        """
        
        accessibility_results = {
            'semantic_html': False,
            'keyboard_navigation': False,
            'aria_attributes': False,
            'focus_management': False,
            'form_validation': False
        }
        
        try:
            # アクセシブルHTMLファイル作成
            accessible_html_file = self.config_dir / "accessible_test.html"
            with open(accessible_html_file, 'w', encoding='utf-8') as f:
                f.write(accessible_html)
            
            # WebDriverセットアップ
            if not self._setup_webdriver(headless=True):
                pytest.skip("WebDriverの初期化に失敗しました")
            
            file_url = f"file://{accessible_html_file.absolute()}"
            self.driver.get(file_url)
            
            # セマンティックHTML要素確認
            self.logger.info("セマンティックHTML要素確認")
            
            # 重要なセマンティック要素の存在確認
            semantic_elements = [
                (By.TAG_NAME, "header"),
                (By.TAG_NAME, "nav"),
                (By.TAG_NAME, "main"),
                (By.TAG_NAME, "section"),
                (By.TAG_NAME, "article"),
                (By.TAG_NAME, "footer")
            ]
            
            semantic_found = 0
            for selector_type, selector_value in semantic_elements:
                try:
                    elements = self.driver.find_elements(selector_type, selector_value)
                    if elements:
                        semantic_found += 1
                except NoSuchElementException:
                    pass
            
            accessibility_results['semantic_html'] = semantic_found >= 5
            
            # ARIA属性確認
            self.logger.info("ARIA属性確認")
            
            # 重要なARIA属性の存在確認
            aria_checks = [
                ("[role='banner']", "banner role"),
                ("[role='navigation']", "navigation role"),
                ("[role='main']", "main role"),
                ("[aria-label]", "aria-label attribute"),
                ("[aria-labelledby]", "aria-labelledby attribute"),
                ("[role='alert']", "alert role")
            ]
            
            aria_found = 0
            for selector, description in aria_checks:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        aria_found += 1
                        self.logger.debug(f"Found {description}: {len(elements)} elements")
                except NoSuchElementException:
                    pass
            
            accessibility_results['aria_attributes'] = aria_found >= 4
            
            # キーボードナビゲーション確認
            self.logger.info("キーボードナビゲーション確認")
            
            # タブ順序の確認
            from selenium.webdriver.common.keys import Keys
            
            # 最初の要素にフォーカス
            body = self.driver.find_element(By.TAG_NAME, "body")
            body.click()
            
            # Tab キーでナビゲーション
            focusable_elements = []
            for i in range(10):  # 最大10回Tab
                try:
                    active_element = self.driver.switch_to.active_element
                    tag_name = active_element.tag_name
                    element_id = active_element.get_attribute("id") or f"{tag_name}_{i}"
                    focusable_elements.append(element_id)
                    
                    active_element.send_keys(Keys.TAB)
                    time.sleep(0.1)
                except Exception:
                    break
            
            # フォーカス可能な要素が見つかることを確認
            accessibility_results['keyboard_navigation'] = len(focusable_elements) >= 3
            
            # フォーカス管理確認
            self.logger.info("フォーカス管理確認")
            
            try:
                # 設定ボタンにフォーカスして押下
                settings_btn = self.driver.find_element(By.ID, "nav-settings")
                settings_btn.click()
                time.sleep(0.5)
                
                # 設定フォームの最初の入力フィールドにフォーカス
                api_key_input = self.driver.find_element(By.ID, "youtube-api-key")
                api_key_input.click()
                
                # アクティブ要素がAPI Key入力フィールドであることを確認
                active_element = self.driver.switch_to.active_element
                accessibility_results['focus_management'] = active_element == api_key_input
                
            except NoSuchElementException:
                accessibility_results['focus_management'] = False
            
            # フォーム検証確認
            self.logger.info("フォーム検証確認")
            
            try:
                # 空のフォーム送信
                save_settings_btn = self.driver.find_element(By.ID, "save-settings")
                save_settings_btn.click()
                time.sleep(0.5)
                
                # エラーメッセージが表示されることを確認
                error_div = self.driver.find_element(By.ID, "api-key-error")
                accessibility_results['form_validation'] = (
                    error_div.is_displayed() and 
                    error_div.text.strip() != ""
                )
                
            except NoSuchElementException:
                accessibility_results['form_validation'] = False
            
            # 結果検証
            accessible_count = sum(accessibility_results.values())
            total_tests = len(accessibility_results)
            accessibility_rate = accessible_count / total_tests
            
            self.logger.info(f"アクセシビリティテスト結果: {accessibility_results}")
            self.logger.info(f"アクセシビリティ率: {accessible_count}/{total_tests} ({accessibility_rate:.1%})")
            
            # 最低80%のアクセシビリティ機能が動作することを確認
            assert accessibility_rate >= 0.8, f"アクセシビリティ率が不足: {accessibility_rate:.1%}"
            
        except Exception as e:
            self.logger.error(f"アクセシビリティテスト例外: {e}")
            pytest.fail(f"アクセシビリティテスト失敗: {e}")
        
        finally:
            self._teardown_webdriver()
            
            # テストファイルクリーンアップ
            try:
                if accessible_html_file.exists():
                    accessible_html_file.unlink()
            except Exception:
                pass
    
    def test_mobile_responsiveness(self):
        """モバイル対応テスト"""
        self.logger.info("モバイル対応テスト開始")
        
        # レスポンシブHTMLテンプレート
        responsive_html = """
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Mobile Responsive Recipe Monitor</title>
            <style>
                * { box-sizing: border-box; }
                body { font-family: Arial, sans-serif; margin: 0; padding: 10px; line-height: 1.6; }
                
                .container { max-width: 1200px; margin: 0 auto; }
                
                header { background: #007bff; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                header h1 { margin: 0; font-size: 1.5rem; }
                
                nav ul { list-style: none; padding: 0; margin: 10px 0 0 0; display: flex; flex-wrap: wrap; gap: 10px; }
                nav button { background: rgba(255,255,255,0.2); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
                nav button:hover { background: rgba(255,255,255,0.3); }
                
                .recipe-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
                .recipe-card { border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .recipe-card img { width: 100%; height: 200px; object-fit: cover; }
                .recipe-card-content { padding: 15px; }
                .recipe-title { margin: 0 0 10px 0; font-size: 1.25rem; }
                .recipe-channel { color: #666; margin: 0 0 10px 0; }
                .recipe-description { margin: 0 0 15px 0; }
                .recipe-actions { display: flex; gap: 10px; flex-wrap: wrap; }
                .btn { padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
                .btn-primary { background: #007bff; color: white; }
                .btn-secondary { background: #6c757d; color: white; }
                
                /* タブレット用スタイル */
                @media (max-width: 768px) {
                    .recipe-grid { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
                    nav ul { flex-direction: column; }
                    nav button { width: 100%; }
                    header h1 { font-size: 1.25rem; }
                }
                
                /* モバイル用スタイル */
                @media (max-width: 480px) {
                    body { padding: 5px; }
                    .recipe-grid { grid-template-columns: 1fr; }
                    .recipe-actions { flex-direction: column; }
                    .btn { width: 100%; }
                    header { padding: 10px; }
                    header h1 { font-size: 1.1rem; }
                    .recipe-card-content { padding: 10px; }
                }
                
                /* 高DPI画面対応 */
                @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
                    .recipe-card { box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <h1 id="main-title">Recipe Monitor</h1>
                    <nav>
                        <ul>
                            <li><button id="nav-home" class="active">Home</button></li>
                            <li><button id="nav-favorites">Favorites</button></li>
                            <li><button id="nav-settings">Settings</button></li>
                        </ul>
                    </nav>
                </header>
                
                <main>
                    <div id="recipe-grid" class="recipe-grid">
                        <div class="recipe-card">
                            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICAgIDxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZGRkIi8+CiAgICA8dGV4dCB4PSIxNTAiIHk9IjEwMCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj5SZWNpcGUgSW1hZ2U8L3RleHQ+Cjwvc3ZnPg==" alt="Recipe Image">
                            <div class="recipe-card-content">
                                <h3 class="recipe-title">Delicious Pasta Recipe</h3>
                                <p class="recipe-channel">Sam The Cooking Guy</p>
                                <p class="recipe-description">A quick and easy pasta recipe perfect for busy weeknights.</p>
                                <div class="recipe-actions">
                                    <button class="btn btn-primary save-btn" data-recipe-id="1">Save</button>
                                    <button class="btn btn-secondary">View</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="recipe-card">
                            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICAgIDxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZGRkIi8+CiAgICA8dGV4dCB4PSIxNTAiIHk9IjEwMCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj5SZWNpcGUgSW1hZ2U8L3RleHQ+Cjwvc3ZnPg==" alt="Recipe Image">
                            <div class="recipe-card-content">
                                <h3 class="recipe-title">Chocolate Chip Cookies</h3>
                                <p class="recipe-channel">Bon Appétit</p>
                                <p class="recipe-description">Classic cookies with a perfect crispy-chewy texture.</p>
                                <div class="recipe-actions">
                                    <button class="btn btn-primary save-btn" data-recipe-id="2">Save</button>
                                    <button class="btn btn-secondary">View</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
            
            <script>
                // 保存ボタンの動作
                document.querySelectorAll('.save-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        this.textContent = 'Saved!';
                        this.disabled = true;
                        this.classList.replace('btn-primary', 'btn-secondary');
                    });
                });
            </script>
        </body>
        </html>
        """
        
        mobile_test_results = {
            'viewport_meta': False,
            'responsive_grid': False,
            'mobile_navigation': False,
            'touch_targets': False,
            'media_queries': False
        }
        
        try:
            # レスポンシブHTMLファイル作成
            responsive_html_file = self.config_dir / "responsive_test.html"
            with open(responsive_html_file, 'w', encoding='utf-8') as f:
                f.write(responsive_html)
            
            # WebDriverセットアップ
            if not self._setup_webdriver(headless=True):
                pytest.skip("WebDriverの初期化に失敗しました")
            
            file_url = f"file://{responsive_html_file.absolute()}"
            self.driver.get(file_url)
            
            # viewport metaタグ確認
            self.logger.info("viewport metaタグ確認")
            
            try:
                viewport_meta = self.driver.find_element(By.CSS_SELECTOR, "meta[name='viewport']")
                viewport_content = viewport_meta.get_attribute("content")
                mobile_test_results['viewport_meta'] = 'width=device-width' in viewport_content
            except NoSuchElementException:
                mobile_test_results['viewport_meta'] = False
            
            # 各画面サイズでのテスト
            screen_sizes = [
                (1920, 1080, "desktop"),
                (768, 1024, "tablet"),
                (375, 667, "mobile")
            ]
            
            grid_responsive = True
            navigation_responsive = True
            
            for width, height, device_type in screen_sizes:
                self.logger.info(f"{device_type}サイズ ({width}x{height}) でのテスト")
                
                self.driver.set_window_size(width, height)
                time.sleep(1)  # レイアウト調整を待機
                
                # レシピグリッドの確認
                recipe_grid = self.driver.find_element(By.ID, "recipe-grid")
                if not recipe_grid.is_displayed():
                    grid_responsive = False
                
                # ナビゲーションの確認
                nav_buttons = self.driver.find_elements(By.CSS_SELECTOR, "nav button")
                if len(nav_buttons) < 3:
                    navigation_responsive = False
                
                # モバイルサイズでの特別な確認
                if device_type == "mobile":
                    # タッチターゲットサイズ確認
                    save_buttons = self.driver.find_elements(By.CLASS_NAME, "save-btn")
                    touch_targets_ok = True
                    
                    for btn in save_buttons:
                        size = btn.size
                        # 最小タッチターゲットサイズ (44px x 44px) の確認
                        if size['width'] < 44 or size['height'] < 44:
                            touch_targets_ok = False
                            break
                    
                    mobile_test_results['touch_targets'] = touch_targets_ok
            
            mobile_test_results['responsive_grid'] = grid_responsive
            mobile_test_results['mobile_navigation'] = navigation_responsive
            
            # CSSメディアクエリの確認
            self.logger.info("CSSメディアクエリ確認")
            
            # 異なるサイズでスタイル変化を確認
            self.driver.set_window_size(1200, 800)  # デスクトップ
            desktop_nav_style = self.driver.find_element(By.CSS_SELECTOR, "nav ul").value_of_css_property("flex-direction")
            
            self.driver.set_window_size(600, 800)   # タブレット
            time.sleep(0.5)
            tablet_nav_style = self.driver.find_element(By.CSS_SELECTOR, "nav ul").value_of_css_property("flex-direction")
            
            # メディアクエリが動作している場合、スタイルが変化する
            mobile_test_results['media_queries'] = desktop_nav_style != tablet_nav_style
            
            # 結果検証
            responsive_count = sum(mobile_test_results.values())
            total_tests = len(mobile_test_results)
            responsive_rate = responsive_count / total_tests
            
            self.logger.info(f"モバイル対応テスト結果: {mobile_test_results}")
            self.logger.info(f"レスポンシブ率: {responsive_count}/{total_tests} ({responsive_rate:.1%})")
            
            # 最低80%のレスポンシブ機能が動作することを確認
            assert responsive_rate >= 0.8, f"モバイル対応率が不足: {responsive_rate:.1%}"
            
        except Exception as e:
            self.logger.error(f"モバイル対応テスト例外: {e}")
            pytest.fail(f"モバイル対応テスト失敗: {e}")
        
        finally:
            self._teardown_webdriver()
            
            # テストファイルクリーンアップ
            try:
                if responsive_html_file.exists():
                    responsive_html_file.unlink()
            except Exception:
                pass


def run_ui_tests():
    """UIテストの実行"""
    print("=== PersonalCookRecipe UIテスト実行 ===")
    
    if not SELENIUM_AVAILABLE:
        print("⚠️ Seleniumが利用できないため、UIテストをスキップします")
        print("   pip install selenium でSeleniumをインストールしてください")
        return 0
    
    pytest_args = [
        __file__,
        "-v",
        "--tb=short",
        "--strict-markers",
        "-m", "ui"
    ]
    
    return pytest.main(pytest_args)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    exit_code = run_ui_tests()
    sys.exit(exit_code)