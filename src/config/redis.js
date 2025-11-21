/**
 * Redis統合設定 - PersonalCookingRecipe Phase 2 Week 1
 * ioredis クライアント + 高度なキャッシング戦略実装
 *
 * @author Backend API Developer
 * @version 2.0.0
 */

const Redis = require('ioredis');
const winston = require('winston');

class RedisManager {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.metrics = {
            hits: 0,
            misses: 0,
            errors: 0,
            totalCommands: 0,
            avgResponseTime: 0
        };

        // ロガー初期化
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'redis-manager' },
            transports: [
                new winston.transports.File({
                    filename: 'logs/redis-error.log',
                    level: 'error'
                }),
                new winston.transports.File({
                    filename: 'logs/redis-combined.log'
                }),
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });

        // TTL設定（秒）
        this.TTL = {
            JWT: 3600,           // 1時間 - JWT認証トークン
            USER_PROFILE: 1800,  // 30分 - ユーザープロファイル
            RECIPE_DETAIL: 3600, // 1時間 - レシピ詳細（Write-Through）
            RECIPE_LIST: 1800,   // 30分 - レシピリスト（Cache-Aside）
            DASHBOARD: 900,      // 15分 - ダッシュボード（Refresh-Ahead）
            SEARCH: 600,         // 10分 - 検索結果
            CATEGORIES: 7200,    // 2時間 - カテゴリ（ほぼ静的）
            API_RESPONSE: 300    // 5分 - 汎用API応答
        };

        // キャッシュキープレフィックス
        this.PREFIX = {
            JWT: 'jwt:',
            USER: 'user:',
            RECIPE: 'recipe:',
            RECIPES: 'recipes:',
            SEARCH: 'search:',
            CATEGORIES: 'categories:',
            API: 'api:'
        };
    }

    /**
     * Redis接続初期化
     */
    async connect() {
        if (this.isConnected && this.client) {
            this.logger.warn('Redis already connected');
            return this.client;
        }

        try {
            const config = {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || undefined,
                db: parseInt(process.env.REDIS_DB || '0'),

                // 接続最適化
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    this.logger.info(`Redis再接続試行 ${times}回目 (${delay}ms後)`);
                    return delay;
                },
                maxRetriesPerRequest: 3,
                enableReadyCheck: true,
                lazyConnect: false,

                // パフォーマンス設定
                connectTimeout: 10000,
                commandTimeout: 5000,
                keepAlive: 30000,

                // 接続プール設定
                enableOfflineQueue: true,
                autoResubscribe: true,
                autoResendUnfulfilledCommands: true,

                // キープレフィックス
                keyPrefix: 'recipe-app:'
            };

            this.client = new Redis(config);

            // イベントハンドラー設定
            this.setupEventHandlers();

            // 接続テスト
            await this.client.ping();
            this.isConnected = true;

            this.logger.info('Redis接続成功', {
                host: config.host,
                port: config.port,
                db: config.db
            });

            return this.client;

        } catch (error) {
            this.logger.error('Redis接続エラー', { error: error.message });
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * イベントハンドラー設定
     */
    setupEventHandlers() {
        this.client.on('connect', () => {
            this.logger.info('Redis接続確立');
        });

        this.client.on('ready', () => {
            this.logger.info('Redis準備完了');
            this.isConnected = true;
        });

        this.client.on('error', (error) => {
            this.logger.error('Redisエラー', { error: error.message });
            this.metrics.errors++;
            this.isConnected = false;
        });

        this.client.on('close', () => {
            this.logger.warn('Redis接続終了');
            this.isConnected = false;
        });

        this.client.on('reconnecting', (delay) => {
            this.logger.info(`Redis再接続中 (${delay}ms後)`);
        });

        this.client.on('end', () => {
            this.logger.warn('Redis接続完全終了');
            this.isConnected = false;
        });
    }

    /**
     * GET - キャッシュから値取得
     * @param {string} key - キャッシュキー
     * @param {boolean} parse - JSON.parse実行フラグ
     */
    async get(key, parse = true) {
        if (!this.isConnected) {
            throw new Error('Redis not connected');
        }

        const startTime = Date.now();
        this.metrics.totalCommands++;

        try {
            const value = await this.client.get(key);
            const duration = Date.now() - startTime;

            this.updateAvgResponseTime(duration);

            if (value === null) {
                this.metrics.misses++;
                this.logger.debug('Cache MISS', { key, duration });
                return null;
            }

            this.metrics.hits++;
            this.logger.debug('Cache HIT', { key, duration });

            if (parse) {
                try {
                    const parsed = JSON.parse(value);

                    // キャッシュポイズニング対策: 基本的なバリデーション
                    if (!this.validateCacheData(parsed, key)) {
                        this.logger.warn('Invalid cache data detected and removed', { key });
                        await this.del(key);
                        return null;
                    }

                    return parsed;
                } catch (parseError) {
                    this.logger.error('JSON parse error in cache data', {
                        key,
                        error: parseError.message
                    });
                    await this.del(key); // 不正データ削除
                    return null;
                }
            }

            return value;

        } catch (error) {
            this.metrics.errors++;
            this.logger.error('Redis GET エラー', {
                key,
                error: error.message
            });
            return null; // エラー時はnull返却（フォールバック）
        }
    }

    /**
     * キャッシュデータバリデーション（キャッシュポイズニング対策）
     * @param {any} data - パースされたデータ
     * @param {string} key - キャッシュキー
     * @returns {boolean} - バリデーション結果
     */
    validateCacheData(data, key) {
        // null/undefined チェック
        if (data === null || data === undefined) {
            return false;
        }

        // プリミティブ型は許可
        if (typeof data !== 'object') {
            return true;
        }

        // __proto__ や constructor 汚染チェック
        if (data.__proto__ || data.constructor !== Object && data.constructor !== Array) {
            this.logger.warn('Prototype pollution attempt detected', { key });
            return false;
        }

        // キータイプ別バリデーション
        const keyWithoutPrefix = key.replace('recipe-app:', '');

        // ユーザー関連データ
        if (keyWithoutPrefix.startsWith('user:profile:')) {
            return this.validateUserProfile(data);
        }

        // JWT関連データ
        if (keyWithoutPrefix.startsWith('jwt:')) {
            return this.validateJWTCache(data);
        }

        // レシピ関連データ
        if (keyWithoutPrefix.startsWith('recipe:detail:')) {
            return this.validateRecipeDetail(data);
        }

        // レシピリスト
        if (keyWithoutPrefix.startsWith('recipes:list:')) {
            return this.validateRecipeList(data);
        }

        // ダッシュボード
        if (keyWithoutPrefix.startsWith('user:dashboard:')) {
            return this.validateDashboard(data);
        }

        // 検索結果
        if (keyWithoutPrefix.startsWith('search:')) {
            return this.validateSearchResults(data);
        }

        // カテゴリ
        if (keyWithoutPrefix.startsWith('categories:')) {
            return this.validateCategories(data);
        }

        // デフォルト: 基本的なオブジェクト検証のみ
        return typeof data === 'object';
    }

    /**
     * ユーザープロファイルバリデーション
     */
    validateUserProfile(data) {
        return data &&
            typeof data === 'object' &&
            typeof data.id !== 'undefined' &&
            typeof data.email !== 'undefined';
    }

    /**
     * JWTキャッシュバリデーション
     */
    validateJWTCache(data) {
        return data &&
            typeof data === 'object' &&
            data.userId &&
            data.payload &&
            typeof data.timestamp === 'number' &&
            typeof data.expiresAt === 'number';
    }

    /**
     * レシピ詳細バリデーション
     */
    validateRecipeDetail(data) {
        return data &&
            typeof data === 'object' &&
            typeof data.id !== 'undefined' &&
            typeof data.title === 'string';
    }

    /**
     * レシピリストバリデーション
     */
    validateRecipeList(data) {
        return data &&
            typeof data === 'object' &&
            Array.isArray(data.recipes) &&
            typeof data.count === 'number';
    }

    /**
     * ダッシュボードバリデーション
     */
    validateDashboard(data) {
        return data &&
            typeof data === 'object' &&
            typeof data.cached_at === 'number';
    }

    /**
     * 検索結果バリデーション
     */
    validateSearchResults(data) {
        return data &&
            typeof data === 'object' &&
            Array.isArray(data.results);
    }

    /**
     * カテゴリバリデーション
     */
    validateCategories(data) {
        return data &&
            typeof data === 'object' &&
            Array.isArray(data.categories);
    }

    /**
     * SET - キャッシュに値保存
     * @param {string} key - キャッシュキー
     * @param {any} value - 保存値
     * @param {number} ttl - TTL（秒）
     * @param {boolean} stringify - JSON.stringify実行フラグ
     */
    async set(key, value, ttl = this.TTL.API_RESPONSE, stringify = true) {
        if (!this.isConnected) {
            throw new Error('Redis not connected');
        }

        const startTime = Date.now();
        this.metrics.totalCommands++;

        try {
            const stringValue = stringify ? JSON.stringify(value) : value;

            if (ttl > 0) {
                await this.client.setex(key, ttl, stringValue);
            } else {
                await this.client.set(key, stringValue);
            }

            const duration = Date.now() - startTime;
            this.updateAvgResponseTime(duration);

            this.logger.debug('Cache SET', { key, ttl, duration });
            return true;

        } catch (error) {
            this.metrics.errors++;
            this.logger.error('Redis SET エラー', {
                key,
                ttl,
                error: error.message
            });
            return false;
        }
    }

    /**
     * DELETE - キャッシュから削除
     * @param {string|string[]} keys - 削除キー（単数または複数）
     */
    async del(keys) {
        if (!this.isConnected) {
            throw new Error('Redis not connected');
        }

        this.metrics.totalCommands++;

        try {
            const keysArray = Array.isArray(keys) ? keys : [keys];
            const result = await this.client.del(...keysArray);

            this.logger.debug('Cache DELETE', {
                keys: keysArray,
                deleted: result
            });

            return result;

        } catch (error) {
            this.metrics.errors++;
            this.logger.error('Redis DEL エラー', {
                keys,
                error: error.message
            });
            return 0;
        }
    }

    /**
     * EXISTS - キー存在確認
     */
    async exists(key) {
        if (!this.isConnected) {
            return false;
        }

        try {
            const result = await this.client.exists(key);
            return result === 1;
        } catch (error) {
            this.logger.error('Redis EXISTS エラー', {
                key,
                error: error.message
            });
            return false;
        }
    }

    /**
     * TTL - 残存TTL取得
     */
    async ttl(key) {
        if (!this.isConnected) {
            return -2;
        }

        try {
            return await this.client.ttl(key);
        } catch (error) {
            this.logger.error('Redis TTL エラー', {
                key,
                error: error.message
            });
            return -2;
        }
    }

    /**
     * EXPIRE - TTL更新
     */
    async expire(key, ttl) {
        if (!this.isConnected) {
            return false;
        }

        try {
            const result = await this.client.expire(key, ttl);
            return result === 1;
        } catch (error) {
            this.logger.error('Redis EXPIRE エラー', {
                key,
                ttl,
                error: error.message
            });
            return false;
        }
    }

    /**
     * KEYS - パターンマッチングキー取得
     * @deprecated 本番環境では scan() メソッドを使用してください
     * 理由: KEYS コマンドは O(N) の時間複雑度でブロッキング動作します
     */
    async keys(pattern) {
        if (!this.isConnected) {
            return [];
        }

        // 本番環境では警告を出す
        if (process.env.NODE_ENV === 'production') {
            this.logger.warn('KEYS コマンドは本番環境で非推奨です。scan() メソッドを使用してください', {
                pattern,
                stack: new Error().stack
            });
        }

        try {
            return await this.client.keys(pattern);
        } catch (error) {
            this.logger.error('Redis KEYS エラー', {
                pattern,
                error: error.message
            });
            return [];
        }
    }

    /**
     * SCAN - 非ブロッキングパターンマッチングキー取得
     * 本番環境推奨: KEYS の代替として使用
     * @param {string} pattern - マッチパターン (例: 'user:*')
     * @param {number} count - バッチサイズ（デフォルト: 100）
     * @returns {Promise<string[]>} - マッチしたキー配列
     */
    async scan(pattern, count = 100) {
        if (!this.isConnected) {
            return [];
        }

        const keys = [];
        let cursor = '0';

        try {
            do {
                // SCAN: O(1) の時間複雑度、非ブロッキング
                const [newCursor, matches] = await this.client.scan(
                    cursor,
                    'MATCH', pattern,
                    'COUNT', count
                );

                keys.push(...matches);
                cursor = newCursor;
            } while (cursor !== '0');

            this.logger.debug('Redis SCAN 完了', {
                pattern,
                count: keys.length
            });

            return keys;

        } catch (error) {
            this.logger.error('Redis SCAN エラー', {
                pattern,
                error: error.message
            });
            return [];
        }
    }

    /**
     * パターンマッチングによるキー削除（SCAN + DEL）
     * @param {string} pattern - マッチパターン
     * @returns {Promise<number>} - 削除されたキー数
     */
    async deleteByPattern(pattern) {
        if (!this.isConnected) {
            return 0;
        }

        try {
            const keys = await this.scan(pattern);

            if (keys.length === 0) {
                return 0;
            }

            const deleted = await this.del(keys);

            this.logger.info('パターンマッチング削除完了', {
                pattern,
                keysFound: keys.length,
                deleted
            });

            return deleted;

        } catch (error) {
            this.logger.error('パターンマッチング削除エラー', {
                pattern,
                error: error.message
            });
            return 0;
        }
    }

    /**
     * FLUSHDB - データベースクリア（開発環境のみ）
     */
    async flushdb() {
        if (!this.isConnected) {
            return false;
        }

        if (process.env.NODE_ENV === 'production') {
            this.logger.warn('本番環境でのFLUSHDBは禁止されています');
            return false;
        }

        try {
            await this.client.flushdb();
            this.logger.info('Redis FLUSHDB 実行完了');
            return true;
        } catch (error) {
            this.logger.error('Redis FLUSHDB エラー', {
                error: error.message
            });
            return false;
        }
    }

    /**
     * キャッシュ統計取得
     */
    getStats() {
        const hitRate = this.metrics.hits + this.metrics.misses > 0
            ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses) * 100).toFixed(2)
            : 0;

        return {
            connected: this.isConnected,
            metrics: {
                ...this.metrics,
                hitRate: `${hitRate}%`
            },
            config: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                db: process.env.REDIS_DB || 0
            },
            ttl_settings: this.TTL,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 平均応答時間更新
     */
    updateAvgResponseTime(duration) {
        const { totalCommands, avgResponseTime } = this.metrics;
        this.metrics.avgResponseTime =
            ((avgResponseTime * (totalCommands - 1)) + duration) / totalCommands;
    }

    /**
     * ヘルスチェック
     */
    async healthCheck() {
        try {
            const startTime = Date.now();
            const result = await this.client.ping();
            const duration = Date.now() - startTime;

            return {
                healthy: result === 'PONG',
                duration,
                connected: this.isConnected,
                stats: this.getStats()
            };

        } catch (error) {
            this.logger.error('Redisヘルスチェック失敗', {
                error: error.message
            });
            return {
                healthy: false,
                error: error.message,
                connected: false
            };
        }
    }

    /**
     * 接続クローズ
     */
    async disconnect() {
        if (this.client) {
            try {
                await this.client.quit();
                this.isConnected = false;
                this.logger.info('Redis接続クローズ完了');
            } catch (error) {
                this.logger.error('Redis切断エラー', {
                    error: error.message
                });
            }
        }
    }
}

// シングルトンインスタンス
const redisManager = new RedisManager();

module.exports = {
    redisManager,
    RedisManager
};
