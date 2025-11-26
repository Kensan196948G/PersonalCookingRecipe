/**
 * ビジネスメトリクス監視モジュール
 * PersonalCookingRecipe - Docker非依存監視システム
 *
 * 機能:
 * - ユーザー登録数追跡
 * - レシピ作成数追跡
 * - 検索実行回数追跡
 * - ユーザーアクティビティ分析
 * - ビジネスKPI追跡
 */

const { EventEmitter } = require('events');
const winston = require('winston');

class BusinessMetrics extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            enableUserMetrics: config.enableUserMetrics !== false,
            enableRecipeMetrics: config.enableRecipeMetrics !== false,
            enableSearchMetrics: config.enableSearchMetrics !== false,
            enableActivityMetrics: config.enableActivityMetrics !== false,
            historyLimit: config.historyLimit || 1000,
            dailyResetHour: config.dailyResetHour || 0, // 0時にリセット
            ...config
        };

        // ロガー初期化
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'business-metrics' },
            transports: [
                new winston.transports.File({
                    filename: 'logs/business-metrics.log',
                    maxsize: 20 * 1024 * 1024, // 20MB
                    maxFiles: 10
                }),
                new winston.transports.Console({
                    format: winston.format.simple(),
                    level: 'info'
                })
            ]
        });

        // メトリクスストレージ
        this.metrics = {
            users: {
                registrations: [],
                totalRegistrations: 0,
                dailyRegistrations: 0,
                registrationTypes: {}, // email, google, facebook等
                activeUsers: new Set(),
                dailyActiveUsers: 0,
                monthlyActiveUsers: 0
            },
            recipes: {
                creations: [],
                totalCreations: 0,
                dailyCreations: 0,
                categories: {}, // カテゴリ別レシピ数
                published: 0,
                draft: 0,
                totalViews: 0,
                totalLikes: 0
            },
            search: {
                executions: [],
                totalExecutions: 0,
                dailyExecutions: 0,
                searchTypes: {}, // keyword, category, ingredient等
                topKeywords: {},
                noResultsCount: 0,
                avgResultCount: 0
            },
            activity: {
                events: [],
                dailyEvents: 0,
                eventTypes: {}, // view, like, comment, share等
                peakHours: {},
                userSessions: new Map()
            },
            kpi: {
                conversionRate: 0, // 訪問者 → 登録
                engagementRate: 0, // アクティブユーザー率
                retentionRate: 0, // ユーザー継続率
                avgRecipesPerUser: 0,
                avgSearchesPerSession: 0
            },
            lastUpdate: null,
            lastDailyReset: this.getToday(),
            startTime: Date.now()
        };

        // 日次リセットタイマー
        this.startDailyResetTimer();

        this.logger.info('ビジネスメトリクスシステム初期化完了');
    }

    /**
     * ユーザー登録記録
     */
    recordUserRegistration(data) {
        const registration = {
            id: this.generateId(),
            userId: data.userId,
            type: data.type || 'email', // email, google, facebook等
            timestamp: data.timestamp || Date.now(),
            source: data.source || 'web', // web, mobile, api等
            metadata: data.metadata || {}
        };

        // 登録履歴に追加
        this.metrics.users.registrations.push(registration);
        if (this.metrics.users.registrations.length > this.config.historyLimit) {
            this.metrics.users.registrations.shift();
        }

        // カウンター更新
        this.metrics.users.totalRegistrations++;
        this.metrics.users.dailyRegistrations++;

        // タイプ別集計
        const type = registration.type;
        this.metrics.users.registrationTypes[type] = (this.metrics.users.registrationTypes[type] || 0) + 1;

        // KPI更新
        this.updateUserKPIs();

        this.metrics.lastUpdate = Date.now();
        this.emit('user_registration', registration);

        this.logger.info('ユーザー登録記録', {
            userId: registration.userId,
            type: registration.type,
            source: registration.source
        });
    }

    /**
     * レシピ作成記録
     */
    recordRecipeCreation(data) {
        const creation = {
            id: this.generateId(),
            recipeId: data.recipeId,
            userId: data.userId,
            category: data.category || 'general',
            status: data.status || 'published', // published, draft
            timestamp: data.timestamp || Date.now(),
            metadata: data.metadata || {}
        };

        // 作成履歴に追加
        this.metrics.recipes.creations.push(creation);
        if (this.metrics.recipes.creations.length > this.config.historyLimit) {
            this.metrics.recipes.creations.shift();
        }

        // カウンター更新
        this.metrics.recipes.totalCreations++;
        this.metrics.recipes.dailyCreations++;

        // カテゴリ別集計
        const category = creation.category;
        this.metrics.recipes.categories[category] = (this.metrics.recipes.categories[category] || 0) + 1;

        // ステータス別集計
        if (creation.status === 'published') {
            this.metrics.recipes.published++;
        } else if (creation.status === 'draft') {
            this.metrics.recipes.draft++;
        }

        // KPI更新
        this.updateRecipeKPIs();

        this.metrics.lastUpdate = Date.now();
        this.emit('recipe_creation', creation);

        this.logger.info('レシピ作成記録', {
            recipeId: creation.recipeId,
            userId: creation.userId,
            category: creation.category
        });
    }

    /**
     * 検索実行記録
     */
    recordSearch(data) {
        const search = {
            id: this.generateId(),
            userId: data.userId,
            sessionId: data.sessionId,
            searchType: data.searchType || 'keyword', // keyword, category, ingredient等
            query: data.query,
            resultCount: data.resultCount || 0,
            timestamp: data.timestamp || Date.now(),
            duration: data.duration || 0,
            metadata: data.metadata || {}
        };

        // 検索履歴に追加
        this.metrics.search.executions.push(search);
        if (this.metrics.search.executions.length > this.config.historyLimit) {
            this.metrics.search.executions.shift();
        }

        // カウンター更新
        this.metrics.search.totalExecutions++;
        this.metrics.search.dailyExecutions++;

        // タイプ別集計
        const type = search.searchType;
        this.metrics.search.searchTypes[type] = (this.metrics.search.searchTypes[type] || 0) + 1;

        // キーワード集計
        if (search.query) {
            this.metrics.search.topKeywords[search.query] = (this.metrics.search.topKeywords[search.query] || 0) + 1;
        }

        // 結果なし検索カウント
        if (search.resultCount === 0) {
            this.metrics.search.noResultsCount++;
        }

        // 平均結果数更新
        const totalResults = this.metrics.search.executions.reduce((sum, s) => sum + s.resultCount, 0);
        this.metrics.search.avgResultCount = totalResults / this.metrics.search.executions.length;

        // KPI更新
        this.updateSearchKPIs();

        this.metrics.lastUpdate = Date.now();
        this.emit('search_execution', search);

        this.logger.debug('検索実行記録', {
            searchType: search.searchType,
            query: search.query,
            resultCount: search.resultCount
        });
    }

    /**
     * ユーザーアクティビティ記録
     */
    recordActivity(data) {
        const activity = {
            id: this.generateId(),
            userId: data.userId,
            sessionId: data.sessionId,
            eventType: data.eventType, // view, like, comment, share, download等
            targetType: data.targetType, // recipe, user, category等
            targetId: data.targetId,
            timestamp: data.timestamp || Date.now(),
            metadata: data.metadata || {}
        };

        // アクティビティ履歴に追加
        this.metrics.activity.events.push(activity);
        if (this.metrics.activity.events.length > this.config.historyLimit) {
            this.metrics.activity.events.shift();
        }

        // カウンター更新
        this.metrics.activity.dailyEvents++;

        // イベントタイプ別集計
        const eventType = activity.eventType;
        this.metrics.activity.eventTypes[eventType] = (this.metrics.activity.eventTypes[eventType] || 0) + 1;

        // アクティブユーザー追跡
        if (activity.userId) {
            this.metrics.users.activeUsers.add(activity.userId);
        }

        // ピーク時間帯分析
        const hour = new Date(activity.timestamp).getHours();
        this.metrics.activity.peakHours[hour] = (this.metrics.activity.peakHours[hour] || 0) + 1;

        // セッション追跡
        if (activity.sessionId) {
            if (!this.metrics.activity.userSessions.has(activity.sessionId)) {
                this.metrics.activity.userSessions.set(activity.sessionId, {
                    sessionId: activity.sessionId,
                    userId: activity.userId,
                    startTime: activity.timestamp,
                    events: [],
                    searchCount: 0
                });
            }
            const session = this.metrics.activity.userSessions.get(activity.sessionId);
            session.events.push(activity);
            if (activity.eventType === 'search') {
                session.searchCount++;
            }
        }

        // KPI更新
        this.updateActivityKPIs();

        this.metrics.lastUpdate = Date.now();
        this.emit('user_activity', activity);
    }

    /**
     * レシピビュー記録
     */
    recordRecipeView(data) {
        this.metrics.recipes.totalViews++;
        this.recordActivity({
            userId: data.userId,
            sessionId: data.sessionId,
            eventType: 'view',
            targetType: 'recipe',
            targetId: data.recipeId,
            timestamp: data.timestamp
        });
    }

    /**
     * レシピいいね記録
     */
    recordRecipeLike(data) {
        this.metrics.recipes.totalLikes++;
        this.recordActivity({
            userId: data.userId,
            sessionId: data.sessionId,
            eventType: 'like',
            targetType: 'recipe',
            targetId: data.recipeId,
            timestamp: data.timestamp
        });
    }

    /**
     * ユーザーKPI更新
     */
    updateUserKPIs() {
        // DAU/MAU計算
        this.metrics.users.dailyActiveUsers = this.metrics.users.activeUsers.size;

        // 平均レシピ数/ユーザー
        if (this.metrics.users.totalRegistrations > 0) {
            this.metrics.kpi.avgRecipesPerUser =
                this.metrics.recipes.totalCreations / this.metrics.users.totalRegistrations;
        }
    }

    /**
     * レシピKPI更新
     */
    updateRecipeKPIs() {
        // エンゲージメント率計算
        if (this.metrics.recipes.totalCreations > 0) {
            this.metrics.kpi.engagementRate =
                (this.metrics.recipes.totalLikes / this.metrics.recipes.totalViews) * 100 || 0;
        }
    }

    /**
     * 検索KPI更新
     */
    updateSearchKPIs() {
        // 平均検索数/セッション
        if (this.metrics.activity.userSessions.size > 0) {
            const totalSearches = Array.from(this.metrics.activity.userSessions.values())
                .reduce((sum, session) => sum + session.searchCount, 0);
            this.metrics.kpi.avgSearchesPerSession =
                totalSearches / this.metrics.activity.userSessions.size;
        }
    }

    /**
     * アクティビティKPI更新
     */
    updateActivityKPIs() {
        // エンゲージメント率
        if (this.metrics.users.totalRegistrations > 0) {
            this.metrics.kpi.engagementRate =
                (this.metrics.users.activeUsers.size / this.metrics.users.totalRegistrations) * 100;
        }
    }

    /**
     * 日次メトリクスリセット
     */
    resetDailyMetrics() {
        this.logger.info('日次メトリクスリセット実行');

        // 前日のデータを保存（オプション）
        const yesterdayMetrics = {
            date: this.getYesterday(),
            users: {
                dailyRegistrations: this.metrics.users.dailyRegistrations,
                dailyActiveUsers: this.metrics.users.dailyActiveUsers
            },
            recipes: {
                dailyCreations: this.metrics.recipes.dailyCreations
            },
            search: {
                dailyExecutions: this.metrics.search.dailyExecutions
            },
            activity: {
                dailyEvents: this.metrics.activity.dailyEvents
            }
        };

        this.emit('daily_summary', yesterdayMetrics);

        // 日次カウンターリセット
        this.metrics.users.dailyRegistrations = 0;
        this.metrics.users.dailyActiveUsers = 0;
        this.metrics.users.activeUsers.clear();
        this.metrics.recipes.dailyCreations = 0;
        this.metrics.search.dailyExecutions = 0;
        this.metrics.activity.dailyEvents = 0;
        this.metrics.activity.peakHours = {};
        this.metrics.activity.userSessions.clear();

        this.metrics.lastDailyReset = this.getToday();
    }

    /**
     * 日次リセットタイマー開始
     */
    startDailyResetTimer() {
        // 次のリセット時刻を計算
        const getNextResetTime = () => {
            const now = new Date();
            const next = new Date(now);
            next.setHours(this.config.dailyResetHour, 0, 0, 0);

            if (next <= now) {
                next.setDate(next.getDate() + 1);
            }

            return next.getTime() - now.getTime();
        };

        const scheduleReset = () => {
            const delay = getNextResetTime();
            setTimeout(() => {
                this.resetDailyMetrics();
                scheduleReset(); // 次のリセットをスケジュール
            }, delay);
        };

        scheduleReset();
        this.logger.info('日次リセットタイマー開始', {
            resetHour: this.config.dailyResetHour
        });
    }

    /**
     * 現在のメトリクス取得
     */
    getCurrentMetrics() {
        return {
            users: {
                totalRegistrations: this.metrics.users.totalRegistrations,
                dailyRegistrations: this.metrics.users.dailyRegistrations,
                dailyActiveUsers: this.metrics.users.dailyActiveUsers,
                registrationTypes: this.metrics.users.registrationTypes,
                topRegistrationType: this.getTopItem(this.metrics.users.registrationTypes)
            },
            recipes: {
                totalCreations: this.metrics.recipes.totalCreations,
                dailyCreations: this.metrics.recipes.dailyCreations,
                published: this.metrics.recipes.published,
                draft: this.metrics.recipes.draft,
                totalViews: this.metrics.recipes.totalViews,
                totalLikes: this.metrics.recipes.totalLikes,
                categories: this.metrics.recipes.categories,
                topCategory: this.getTopItem(this.metrics.recipes.categories)
            },
            search: {
                totalExecutions: this.metrics.search.totalExecutions,
                dailyExecutions: this.metrics.search.dailyExecutions,
                noResultsCount: this.metrics.search.noResultsCount,
                noResultsRate: this.metrics.search.totalExecutions > 0
                    ? (this.metrics.search.noResultsCount / this.metrics.search.totalExecutions) * 100
                    : 0,
                avgResultCount: this.metrics.search.avgResultCount,
                searchTypes: this.metrics.search.searchTypes,
                topKeywords: this.getTopItems(this.metrics.search.topKeywords, 10)
            },
            activity: {
                dailyEvents: this.metrics.activity.dailyEvents,
                eventTypes: this.metrics.activity.eventTypes,
                peakHour: this.getTopItem(this.metrics.activity.peakHours),
                activeSessions: this.metrics.activity.userSessions.size
            },
            kpi: this.metrics.kpi,
            lastUpdate: this.metrics.lastUpdate,
            uptime: Date.now() - this.metrics.startTime
        };
    }

    /**
     * トップアイテム取得
     */
    getTopItem(obj) {
        const entries = Object.entries(obj);
        if (entries.length === 0) return null;
        return entries.reduce((a, b) => b[1] > a[1] ? b : a)[0];
    }

    /**
     * トップアイテム複数取得
     */
    getTopItems(obj, limit = 10) {
        return Object.entries(obj)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([key, value]) => ({ key, count: value }));
    }

    /**
     * 統計情報取得
     */
    getStats() {
        return {
            uptime: Date.now() - this.metrics.startTime,
            lastUpdate: this.metrics.lastUpdate,
            lastDailyReset: this.metrics.lastDailyReset,
            users: {
                totalRegistrations: this.metrics.users.totalRegistrations,
                dailyRegistrations: this.metrics.users.dailyRegistrations,
                dailyActiveUsers: this.metrics.users.dailyActiveUsers,
                topRegistrationType: this.getTopItem(this.metrics.users.registrationTypes)
            },
            recipes: {
                totalCreations: this.metrics.recipes.totalCreations,
                dailyCreations: this.metrics.recipes.dailyCreations,
                publishRate: this.metrics.recipes.totalCreations > 0
                    ? ((this.metrics.recipes.published / this.metrics.recipes.totalCreations) * 100).toFixed(2) + '%'
                    : '0%',
                avgViewsPerRecipe: this.metrics.recipes.totalCreations > 0
                    ? (this.metrics.recipes.totalViews / this.metrics.recipes.totalCreations).toFixed(2)
                    : 0
            },
            search: {
                totalExecutions: this.metrics.search.totalExecutions,
                dailyExecutions: this.metrics.search.dailyExecutions,
                noResultsRate: this.metrics.search.totalExecutions > 0
                    ? ((this.metrics.search.noResultsCount / this.metrics.search.totalExecutions) * 100).toFixed(2) + '%'
                    : '0%',
                avgResultCount: this.metrics.search.avgResultCount.toFixed(2)
            },
            kpi: {
                engagementRate: this.metrics.kpi.engagementRate.toFixed(2) + '%',
                avgRecipesPerUser: this.metrics.kpi.avgRecipesPerUser.toFixed(2),
                avgSearchesPerSession: this.metrics.kpi.avgSearchesPerSession.toFixed(2)
            }
        };
    }

    /**
     * 今日の日付取得 (YYYY-MM-DD)
     */
    getToday() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * 昨日の日付取得 (YYYY-MM-DD)
     */
    getYesterday() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }

    /**
     * ID生成
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
}

module.exports = BusinessMetrics;
