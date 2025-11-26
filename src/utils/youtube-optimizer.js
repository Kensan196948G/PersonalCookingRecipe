/**
 * YouTube API呼び出し最適化
 * PersonalCookingRecipe Phase 2b パフォーマンス最適化
 */

const axios = require('axios');
const { cacheGet, cacheSet } = require('../config/database-postgresql');

class YouTubeOptimizer {
    constructor() {
        this.apiKey = process.env.YOUTUBE_API_KEY;
        this.baseURL = 'https://www.googleapis.com/youtube/v3';
        
        // キャッシュTTL設定
        this.cacheTTL = {
            channel: 3600,     // チャンネル情報: 1時間
            video: 1800,       // 動画情報: 30分
            search: 600,       // 検索結果: 10分
            statistics: 300    // 統計情報: 5分
        };
        
        // レート制限設定
        this.rateLimit = {
            maxRequestsPerSecond: 100,
            maxRequestsPerDay: 10000,
            requestQueue: [],
            lastRequestTime: 0
        };
        
        // PersonalCookingRecipe監視対象チャンネル
        this.monitoredChannels = [
            'UCzqfooJY4-5VNMhUXTf6ZdA', // きまぐれクック
            'UC6HcPwzZK2OOODq_ZAUoUkA', // はるあん
            'UC9lrImf0ry0EzBbEGjNVkrg'  // 料理研究家リュウジのバズレシピ
        ];
        
        // パフォーマンス監視
        this.performanceMetrics = {
            totalRequests: 0,
            cachedRequests: 0,
            apiRequests: 0,
            avgResponseTime: 0,
            errors: 0
        };
    }

    // レート制限チェック
    async checkRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.rateLimit.lastRequestTime;
        const minInterval = 1000 / this.rateLimit.maxRequestsPerSecond; // ミリ秒
        
        if (timeSinceLastRequest < minInterval) {
            await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
        }
        
        this.rateLimit.lastRequestTime = Date.now();
    }

    // チャンネル情報取得（最適化版）
    async getChannelInfo(channelId, useCache = true) {
        const startTime = process.hrtime.bigint();
        this.performanceMetrics.totalRequests++;
        
        try {
            // キャッシュ確認
            if (useCache) {
                const cacheKey = `youtube:channel:${channelId}`;
                const cached = await cacheGet(cacheKey);
                
                if (cached) {
                    this.performanceMetrics.cachedRequests++;
                    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
                    this.updatePerformanceMetrics(duration);
                    
                    return JSON.parse(cached);
                }
            }

            // レート制限チェック
            await this.checkRateLimit();

            // YouTube API呼び出し
            const response = await axios.get(`${this.baseURL}/channels`, {
                params: {
                    key: this.apiKey,
                    id: channelId,
                    part: 'snippet,statistics,contentDetails',
                    fields: 'items(id,snippet(title,description,thumbnails,publishedAt),statistics,contentDetails)'
                },
                timeout: 5000 // 5秒タイムアウト
            });

            this.performanceMetrics.apiRequests++;
            
            if (!response.data.items || response.data.items.length === 0) {
                throw new Error(`チャンネルが見つかりません: ${channelId}`);
            }

            const channelData = response.data.items[0];
            
            // 結果をキャッシュ
            if (useCache) {
                const cacheKey = `youtube:channel:${channelId}`;
                await cacheSet(cacheKey, JSON.stringify(channelData), this.cacheTTL.channel);
            }

            const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
            this.updatePerformanceMetrics(duration);

            return channelData;

        } catch (error) {
            this.performanceMetrics.errors++;
            console.error(`YouTube Channel API エラー (${channelId}):`, error.message);
            throw error;
        }
    }

    // 動画情報取得（最適化版）
    async getVideoInfo(videoId, useCache = true) {
        const startTime = process.hrtime.bigint();
        this.performanceMetrics.totalRequests++;
        
        try {
            // キャッシュ確認
            if (useCache) {
                const cacheKey = `youtube:video:${videoId}`;
                const cached = await cacheGet(cacheKey);
                
                if (cached) {
                    this.performanceMetrics.cachedRequests++;
                    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
                    this.updatePerformanceMetrics(duration);
                    
                    return JSON.parse(cached);
                }
            }

            // レート制限チェック
            await this.checkRateLimit();

            // YouTube API呼び出し
            const response = await axios.get(`${this.baseURL}/videos`, {
                params: {
                    key: this.apiKey,
                    id: videoId,
                    part: 'snippet,statistics,contentDetails',
                    fields: 'items(id,snippet(title,description,thumbnails,publishedAt,channelId,channelTitle),statistics,contentDetails(duration))'
                },
                timeout: 5000
            });

            this.performanceMetrics.apiRequests++;

            if (!response.data.items || response.data.items.length === 0) {
                throw new Error(`動画が見つかりません: ${videoId}`);
            }

            const videoData = response.data.items[0];
            
            // 結果をキャッシュ
            if (useCache) {
                const cacheKey = `youtube:video:${videoId}`;
                await cacheSet(cacheKey, JSON.stringify(videoData), this.cacheTTL.video);
            }

            const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
            this.updatePerformanceMetrics(duration);

            return videoData;

        } catch (error) {
            this.performanceMetrics.errors++;
            console.error(`YouTube Video API エラー (${videoId}):`, error.message);
            throw error;
        }
    }

    // 料理関連動画検索（最適化版）
    async searchCookingVideos(query, maxResults = 10, useCache = true) {
        const startTime = process.hrtime.bigint();
        this.performanceMetrics.totalRequests++;
        
        try {
            // キャッシュ確認
            if (useCache) {
                const cacheKey = `youtube:search:${Buffer.from(query).toString('base64')}:${maxResults}`;
                const cached = await cacheGet(cacheKey);
                
                if (cached) {
                    this.performanceMetrics.cachedRequests++;
                    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
                    this.updatePerformanceMetrics(duration);
                    
                    return JSON.parse(cached);
                }
            }

            // レート制限チェック
            await this.checkRateLimit();

            // 料理特化検索クエリ構築
            const cookingQuery = `${query} 料理 レシピ cooking recipe`;

            // YouTube API呼び出し
            const response = await axios.get(`${this.baseURL}/search`, {
                params: {
                    key: this.apiKey,
                    q: cookingQuery,
                    part: 'snippet',
                    maxResults,
                    type: 'video',
                    videoCategoryId: '26', // How-to & Style
                    order: 'relevance',
                    publishedAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 過去30日
                    fields: 'items(id,snippet(title,description,thumbnails,publishedAt,channelId,channelTitle))'
                },
                timeout: 10000 // 10秒タイムアウト
            });

            this.performanceMetrics.apiRequests++;
            
            const searchResults = response.data.items || [];
            
            // 結果をキャッシュ
            if (useCache) {
                const cacheKey = `youtube:search:${Buffer.from(query).toString('base64')}:${maxResults}`;
                await cacheSet(cacheKey, JSON.stringify(searchResults), this.cacheTTL.search);
            }

            const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
            this.updatePerformanceMetrics(duration);

            return searchResults;

        } catch (error) {
            this.performanceMetrics.errors++;
            console.error(`YouTube Search API エラー (${query}):`, error.message);
            throw error;
        }
    }

    // チャンネル最新動画取得（バッチ最適化）
    async getLatestVideosFromChannels(channelIds = this.monitoredChannels, maxResultsPerChannel = 5) {
        const startTime = process.hrtime.bigint();
        
        try {
            console.log(`📺 ${channelIds.length}チャンネルの最新動画取得開始...`);

            // 並列処理でチャンネル情報取得
            const channelPromises = channelIds.map(async (channelId) => {
                try {
                    // チャンネル情報取得
                    const channelInfo = await this.getChannelInfo(channelId);
                    
                    // 最新動画検索
                    const videos = await this.searchChannelVideos(channelId, maxResultsPerChannel);
                    
                    return {
                        channelId,
                        channelInfo,
                        videos,
                        success: true
                    };
                } catch (error) {
                    console.error(`チャンネル ${channelId} 処理エラー:`, error.message);
                    return {
                        channelId,
                        error: error.message,
                        success: false
                    };
                }
            });

            const results = await Promise.all(channelPromises);
            const successResults = results.filter(r => r.success);
            const failedResults = results.filter(r => !r.success);

            const duration = Number(process.hrtime.bigint() - startTime) / 1000000;

            console.log(`✅ 最新動画取得完了: ${successResults.length}/${channelIds.length}チャンネル (${duration.toFixed(3)}ms)`);
            
            if (failedResults.length > 0) {
                console.warn(`⚠️ 失敗したチャンネル: ${failedResults.map(r => r.channelId).join(', ')}`);
            }

            return {
                success: successResults,
                failed: failedResults,
                totalChannels: channelIds.length,
                duration
            };

        } catch (error) {
            console.error('YouTube バッチ処理エラー:', error.message);
            throw error;
        }
    }

    // チャンネル内動画検索
    async searchChannelVideos(channelId, maxResults = 5) {
        const cacheKey = `youtube:channel_videos:${channelId}:${maxResults}`;
        const cached = await cacheGet(cacheKey);
        
        if (cached) {
            return JSON.parse(cached);
        }

        await this.checkRateLimit();

        const response = await axios.get(`${this.baseURL}/search`, {
            params: {
                key: this.apiKey,
                channelId,
                part: 'snippet',
                maxResults,
                type: 'video',
                order: 'date',
                fields: 'items(id,snippet(title,description,thumbnails,publishedAt))'
            },
            timeout: 5000
        });

        const videos = response.data.items || [];
        await cacheSet(cacheKey, JSON.stringify(videos), this.cacheTTL.video);

        return videos;
    }

    // パフォーマンスメトリクス更新
    updatePerformanceMetrics(duration) {
        this.performanceMetrics.avgResponseTime = 
            (this.performanceMetrics.avgResponseTime + duration) / 2;
    }

    // パフォーマンス統計取得
    getPerformanceStats() {
        const cacheHitRate = this.performanceMetrics.totalRequests > 0 
            ? (this.performanceMetrics.cachedRequests / this.performanceMetrics.totalRequests) * 100 
            : 0;

        return {
            timestamp: new Date().toISOString(),
            metrics: {
                ...this.performanceMetrics,
                cacheHitRate: `${cacheHitRate.toFixed(2)}%`,
                avgResponseTime: `${this.performanceMetrics.avgResponseTime.toFixed(3)}ms`
            },
            cache_settings: this.cacheTTL,
            monitored_channels: this.monitoredChannels.length,
            rate_limits: {
                max_requests_per_second: this.rateLimit.maxRequestsPerSecond,
                max_requests_per_day: this.rateLimit.maxRequestsPerDay
            }
        };
    }

    // キャッシュクリア
    async clearCache(pattern = 'youtube:*') {
        // 実装は簡略化（パターン削除は複雑なため）
        console.log(`YouTube APIキャッシュクリア要求: ${pattern}`);
        return true;
    }
}

// シングルトンインスタンス
const youtubeOptimizer = new YouTubeOptimizer();

module.exports = {
    youtubeOptimizer,
    YouTubeOptimizer
};