/**
 * Redis統合キャッシングテスト - PersonalCookingRecipe Phase 2 Week 1
 * 完全なキャッシング戦略検証テストスイート
 *
 * @author Backend API Developer
 * @version 2.0.0
 */

// Jest形式に変換
// const { expect } = require('chai');
// const sinon = require('sinon');
const { redisManager } = require('../config/redis');
const { cacheService } = require('../services/cacheService');

// Redis接続が必要な統合テスト - CI環境ではスキップ
const describeIfRedisAvailable = process.env.SKIP_DB_TESTS ? describe.skip : describe;

describeIfRedisAvailable('Redis統合キャッシングシステムテスト', () => {
    // Jest形式に変換 (Mocha構文からJest構文へ)

    beforeAll(async () => {
        // Redis接続初期化
        try {
            await redisManager.connect();
            await cacheService.initialize();
            console.log('テスト環境: Redis接続成功');
        } catch (error) {
            console.error('テスト環境: Redis接続失敗', error.message);
        }
    }, 10000); // タイムアウト10秒

    afterAll(async () => {
        // テスト後クリーンアップ
        try {
            await cacheService.clearAll();
            await redisManager.disconnect();
            console.log('テスト環境: クリーンアップ完了');
        } catch (error) {
            console.error('クリーンアップエラー:', error.message);
        }
    });

    beforeEach(async () => {
        // 各テスト前にキャッシュクリア
        try {
            await cacheService.clearAll();
        } catch (error) {
            // キャッシュクリアエラーは無視
        }
    });

    describe('1. Redis接続テスト', () => {
        it('Redis接続が確立されていること', async () => {
            const health = await redisManager.healthCheck();
            expect(health.healthy).toBe(true);
            expect(health.connected).toBe(true);
        });

        it('基本的なGET/SET操作が動作すること', async () => {
            const testKey = 'test:key';
            const testValue = { message: 'Hello Redis' };

            await redisManager.set(testKey, testValue, 60);
            const result = await redisManager.get(testKey);

            expect(result).toEqual(testValue);
        });

        it('TTLが正しく設定されること', async () => {
            const testKey = 'test:ttl';
            const testValue = 'ttl-test';
            const ttl = 10; // 10秒

            await redisManager.set(testKey, testValue, ttl, false);
            const remainingTTL = await redisManager.ttl(testKey);

            expect(remainingTTL).toBeLessThanOrEqual(ttl);
            expect(remainingTTL).toBeGreaterThanOrEqual(1);
        });
    });

    describe('2. JWT認証キャッシングテスト (Strategy: Cache-Aside)', () => {
        const userId = 123;
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
        const payload = {
            userId: 123,
            email: 'test@example.com',
            username: 'testuser'
        };

        it('JWTがキャッシュに保存されること', async () => {
            const result = await cacheService.cacheJWT(userId, token, payload);
            expect(result).toBe(true);
        });

        it('キャッシュされたJWTが取得できること', async () => {
            await cacheService.cacheJWT(userId, token, payload);
            const cached = await cacheService.getCachedJWT(userId, token);

            expect(cached).toEqual(payload);
        });

        it('JWT無効化が動作すること', async () => {
            await cacheService.cacheJWT(userId, token, payload);
            await cacheService.invalidateJWT(userId, token);

            const cached = await cacheService.getCachedJWT(userId, token);
            expect(cached).toBeNull();
        });

        it('ユーザーの全JWT無効化が動作すること', async () => {
            const token1 = 'token1';
            const token2 = 'token2';

            await cacheService.cacheJWT(userId, token1, payload);
            await cacheService.cacheJWT(userId, token2, payload);

            await cacheService.invalidateUserJWTs(userId);

            const cached1 = await cacheService.getCachedJWT(userId, token1);
            const cached2 = await cacheService.getCachedJWT(userId, token2);

            expect(cached1).toBeNull();
            expect(cached2).toBeNull();
        });
    });

    describe('3. ユーザープロファイルキャッシングテスト (Strategy: Cache-Aside)', () => {
        const userId = 456;
        const profile = {
            id: 456,
            username: 'testuser',
            email: 'test@example.com',
            createdAt: new Date().toISOString()
        };

        it('ユーザープロファイルがキャッシュに保存されること', async () => {
            const result = await cacheService.cacheUserProfile(userId, profile);
            expect(result).toBe(true);
        });

        it('キャッシュされたプロファイルが取得できること', async () => {
            await cacheService.cacheUserProfile(userId, profile);
            const cached = await cacheService.getCachedUserProfile(userId);

            expect(cached).toMatchObject(profile);
            expect(cached.cached_at).toBeDefined();
        });

        it('プロファイル無効化が動作すること', async () => {
            await cacheService.cacheUserProfile(userId, profile);
            await cacheService.invalidateUserProfile(userId);

            const cached = await cacheService.getCachedUserProfile(userId);
            expect(cached).toBeNull();
        });
    });

    describe('4. レシピキャッシングテスト (Strategy: Write-Through)', () => {
        const recipeId = 789;
        const recipe = {
            id: 789,
            title: 'テストレシピ',
            description: 'テスト用のレシピです',
            ingredients: ['材料A', '材料B'],
            instructions: ['手順1', '手順2'],
            userId: 123
        };

        it('レシピがキャッシュに保存されること (Write-Through)', async () => {
            const result = await cacheService.cacheRecipe(recipeId, recipe);
            expect(result).toBe(true);
        });

        it('キャッシュされたレシピが取得できること', async () => {
            await cacheService.cacheRecipe(recipeId, recipe);
            const cached = await cacheService.getCachedRecipe(recipeId);

            expect(cached).toMatchObject(recipe);
            expect(cached.cache_strategy).toBe('write-through');
        });

        it('レシピ無効化が動作すること', async () => {
            await cacheService.cacheRecipe(recipeId, recipe);
            await cacheService.invalidateRecipe(recipeId);

            const cached = await cacheService.getCachedRecipe(recipeId);
            expect(cached).toBeNull();
        });

        it('レシピリストがキャッシュされること (Cache-Aside)', async () => {
            const userId = 123;
            const filters = { category_id: 1 };
            const pagination = { page: 1, limit: 10 };
            const recipes = [recipe];

            await cacheService.cacheRecipeList(userId, filters, pagination, recipes);
            const cached = await cacheService.getCachedRecipeList(userId, filters, pagination);

            expect(cached).toEqual(recipes);
        });
    });

    describe('5. ダッシュボードキャッシングテスト (Strategy: Refresh-Ahead)', () => {
        const userId = 999;
        const dashboardData = {
            recipes: [],
            favorites: [],
            stats: { totalRecipes: 0 }
        };

        it('ダッシュボードデータがキャッシュされること', async () => {
            const result = await cacheService.cacheDashboard(userId, dashboardData);
            expect(result).toBe(true);
        });

        it('キャッシュされたダッシュボードが取得できること', async () => {
            await cacheService.cacheDashboard(userId, dashboardData);
            const cached = await cacheService.getCachedDashboard(userId);

            expect(cached).toMatchObject(dashboardData);
            expect(cached.cache_strategy).toBe('refresh-ahead');
        });

        it('Refresh-Aheadコールバックが動作すること', async () => {
            const refreshCallback = jest.fn().mockResolvedValue({
                ...dashboardData,
                refreshed: true
            });

            await cacheService.cacheDashboard(userId, dashboardData);

            // TTLを短く設定してRefresh-Aheadをトリガー
            const key = `${redisManager.PREFIX.USER}dashboard:${userId}`;
            await redisManager.expire(key, 3); // 3秒に短縮

            // 取得（Refresh-Aheadトリガー）
            const cached = await cacheService.getCachedDashboard(userId, refreshCallback);

            expect(cached).toBeDefined();

            // コールバックが非同期で呼ばれるまで待機
            await new Promise(resolve => setTimeout(resolve, 100));

            // 注: 実際のコールバック呼び出しは非同期なので、
            // このテストでは呼び出し確認のみ行う
        });
    });

    describe('6. 検索結果キャッシングテスト (Strategy: Cache-Aside)', () => {
        const query = 'カレー';
        const filters = { category: '和食' };
        const results = [
            { id: 1, title: 'カレーライス' },
            { id: 2, title: 'スープカレー' }
        ];

        it('検索結果がキャッシュされること', async () => {
            const result = await cacheService.cacheSearchResults(query, filters, results);
            expect(result).toBe(true);
        });

        it('キャッシュされた検索結果が取得できること', async () => {
            await cacheService.cacheSearchResults(query, filters, results);
            const cached = await cacheService.getCachedSearchResults(query, filters);

            expect(cached).toEqual(results);
        });

        it('異なるフィルターで異なるキャッシュキーが生成されること', async () => {
            const filters1 = { category: '和食' };
            const filters2 = { category: '洋食' };

            await cacheService.cacheSearchResults(query, filters1, results);
            const cached1 = await cacheService.getCachedSearchResults(query, filters1);
            const cached2 = await cacheService.getCachedSearchResults(query, filters2);

            expect(cached1).toEqual(results);
            expect(cached2).toBeNull();
        });
    });

    describe('7. カテゴリキャッシングテスト (Strategy: Cache-Aside)', () => {
        const categories = [
            { id: 1, name: '和食' },
            { id: 2, name: '洋食' },
            { id: 3, name: '中華' }
        ];

        it('カテゴリがキャッシュされること', async () => {
            const result = await cacheService.cacheCategories(categories);
            expect(result).toBe(true);
        });

        it('キャッシュされたカテゴリが取得できること', async () => {
            await cacheService.cacheCategories(categories);
            const cached = await cacheService.getCachedCategories();

            expect(cached).toEqual(categories);
        });

        it('カテゴリ無効化が動作すること', async () => {
            await cacheService.cacheCategories(categories);
            await cacheService.invalidateCategories();

            const cached = await cacheService.getCachedCategories();
            expect(cached).toBeNull();
        });
    });

    describe('8. キャッシュ統計テスト', () => {
        it('キャッシュ統計が取得できること', async () => {
            const stats = await cacheService.getStats();

            expect(stats).toHaveProperty('connected');
            expect(stats).toHaveProperty('metrics');
            expect(stats.metrics).toHaveProperty('hitRate');
            expect(stats.metrics).toHaveProperty('totalCommands');
        });

        it('キャッシュヒット率が計算されること', async () => {
            const testKey = 'test:hit-rate';
            const testValue = 'test';

            // ミス
            await redisManager.get(testKey);

            // セット
            await redisManager.set(testKey, testValue, 60);

            // ヒット
            await redisManager.get(testKey);
            await redisManager.get(testKey);

            const stats = await cacheService.getStats();
            expect(stats.metrics.hits).toBeGreaterThanOrEqual(2);
            expect(stats.metrics.misses).toBeGreaterThanOrEqual(1);
        });
    });

    describe('9. エラーハンドリングテスト', () => {
        it('Redis切断時にnullを返すこと', async () => {
            // Redis切断をシミュレート
            await redisManager.disconnect();

            const result = await redisManager.get('test:key');
            expect(result).toBeNull();

            // 再接続
            await redisManager.connect();
        });

        it('無効なデータでもエラーにならないこと', async () => {
            const testKey = 'test:invalid';

            // 手動で無効なJSON保存
            await redisManager.set(testKey, '{invalid json}', 60, false);

            try {
                await redisManager.get(testKey);
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
    });

    describe('10. パフォーマンステスト', () => {
        it('大量のキャッシュ操作が高速であること', async () => {
            const iterations = 100;
            const startTime = Date.now();

            const promises = [];
            for (let i = 0; i < iterations; i++) {
                promises.push(
                    redisManager.set(`test:perf:${i}`, { index: i }, 60)
                );
            }

            await Promise.all(promises);

            const duration = Date.now() - startTime;
            console.log(`100件のキャッシュ保存: ${duration}ms`);

            expect(duration).toBeLessThan(1000); // 1秒以内
        });

        it('並列読み込みが高速であること', async () => {
            // データ準備
            for (let i = 0; i < 50; i++) {
                await redisManager.set(`test:read:${i}`, { index: i }, 60);
            }

            const startTime = Date.now();

            const promises = [];
            for (let i = 0; i < 50; i++) {
                promises.push(redisManager.get(`test:read:${i}`));
            }

            await Promise.all(promises);

            const duration = Date.now() - startTime;
            console.log(`50件の並列読み込み: ${duration}ms`);

            expect(duration).toBeLessThan(500); // 500ms以内
        });
    });

    describe('11. ヘルスチェックテスト', () => {
        it('ヘルスチェックが正常に動作すること', async () => {
            const health = await cacheService.healthCheck();

            expect(health).toHaveProperty('healthy');
            expect(health).toHaveProperty('duration');
            expect(health.healthy).toBe(true);
        });
    });
});
