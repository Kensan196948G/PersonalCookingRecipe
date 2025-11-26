const axios = require('axios');

// Mock axios for YouTube API testing
jest.mock('axios');

describe('YouTube API Integration Tests', () => {
  const mockAxios = axios;
  
  // Test channel IDs from PersonalCookingRecipe
  const testChannels = [
    { id: 'UC8C7QblJwCHsYrftuLjGKig', name: 'Sam' },
    { id: 'UCJFp8uSYCjXOMnkUyb3CQ3Q', name: 'Tasty' },
    { id: 'UChBEbMKI1eCcejTtmI32UEw', name: 'Joshua' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('YouTube Data API Integration', () => {
    test('should fetch channel information successfully', async () => {
      const mockChannelData = {
        data: {
          items: [{
            id: testChannels[0].id,
            snippet: {
              title: testChannels[0].name,
              description: 'Cooking channel description',
              thumbnails: {
                default: { url: 'https://example.com/thumb.jpg' }
              }
            },
            statistics: {
              subscriberCount: '1000000',
              videoCount: '500',
              viewCount: '50000000'
            }
          }]
        }
      };

      mockAxios.get.mockResolvedValue(mockChannelData);

      // Mock YouTube API service
      class YouTubeApiService {
        constructor(apiKey) {
          this.apiKey = apiKey;
          this.baseUrl = 'https://www.googleapis.com/youtube/v3';
        }

        async getChannelInfo(channelId) {
          const response = await axios.get(`${this.baseUrl}/channels`, {
            params: {
              part: 'snippet,statistics',
              id: channelId,
              key: this.apiKey
            }
          });
          return response.data.items[0];
        }
      }

      const youtubeService = new YouTubeApiService('test-api-key');
      const channelInfo = await youtubeService.getChannelInfo(testChannels[0].id);

      expect(channelInfo).toBeDefined();
      expect(channelInfo.id).toBe(testChannels[0].id);
      expect(channelInfo.snippet.title).toBe(testChannels[0].name);
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/channels',
        expect.objectContaining({
          params: expect.objectContaining({
            id: testChannels[0].id,
            part: 'snippet,statistics'
          })
        })
      );
    });

    test('should fetch latest videos from channel', async () => {
      const mockVideosData = {
        data: {
          items: [
            {
              id: { videoId: 'test-video-id-1' },
              snippet: {
                title: 'Amazing Beef Steak Recipe',
                description: 'Learn to cook the perfect steak',
                publishedAt: '2025-01-01T00:00:00Z',
                thumbnails: {
                  medium: { url: 'https://example.com/thumb1.jpg' }
                }
              }
            },
            {
              id: { videoId: 'test-video-id-2' },
              snippet: {
                title: 'Chicken Teriyaki Tutorial',
                description: 'Delicious Japanese chicken recipe',
                publishedAt: '2025-01-02T00:00:00Z',
                thumbnails: {
                  medium: { url: 'https://example.com/thumb2.jpg' }
                }
              }
            }
          ]
        }
      };

      mockAxios.get.mockResolvedValue(mockVideosData);

      class YouTubeApiService {
        async getChannelVideos(channelId, maxResults = 10) {
          const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
              part: 'snippet',
              channelId: channelId,
              maxResults: maxResults,
              order: 'date',
              type: 'video',
              key: 'test-api-key'
            }
          });
          return response.data.items;
        }
      }

      const youtubeService = new YouTubeApiService();
      const videos = await youtubeService.getChannelVideos(testChannels[0].id, 5);

      expect(videos).toHaveLength(2);
      expect(videos[0].snippet.title).toContain('Beef Steak');
      expect(videos[1].snippet.title).toContain('Chicken Teriyaki');
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/search',
        expect.objectContaining({
          params: expect.objectContaining({
            channelId: testChannels[0].id,
            maxResults: 5,
            order: 'date'
          })
        })
      );
    });

    test('should handle YouTube API rate limiting', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          data: {
            error: {
              code: 429,
              message: 'Quota exceeded'
            }
          }
        }
      };

      mockAxios.get.mockRejectedValue(rateLimitError);

      class YouTubeApiService {
        async getChannelInfoWithRetry(channelId, maxRetries = 3) {
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
                params: {
                  part: 'snippet',
                  id: channelId,
                  key: 'test-api-key'
                }
              });
              return response.data.items[0];
            } catch (error) {
              if (error.response?.status === 429 && attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
              }
              throw error;
            }
          }
        }
      }

      const youtubeService = new YouTubeApiService();
      
      await expect(
        youtubeService.getChannelInfoWithRetry(testChannels[0].id)
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 429
        })
      });
    });
  });

  describe('Recipe Monitoring System', () => {
    test('should detect new cooking videos from monitored channels', async () => {
      const mockNewVideos = {
        data: {
          items: [
            {
              id: { videoId: 'new-video-1' },
              snippet: {
                title: 'Ultimate Ramen Recipe 2025',
                description: 'Perfect homemade ramen bowl',
                publishedAt: new Date().toISOString(),
                channelId: testChannels[2].id
              }
            }
          ]
        }
      };

      mockAxios.get.mockResolvedValue(mockNewVideos);

      class RecipeMonitoringService {
        constructor() {
          // テスト用に1チャンネルのみ監視（重複を避けるため）
          this.monitoredChannels = [testChannels[2]];
          this.lastCheckTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
        }

        async checkForNewRecipeVideos() {
          const newVideos = [];
          
          for (const channel of this.monitoredChannels) {
            const videos = await this.getRecentVideos(channel.id);
            const recipeKeywords = ['recipe', 'cooking', 'how to cook', 'tutorial'];
            
            const recipeVideos = videos.filter(video => {
              const title = video.snippet.title.toLowerCase();
              const publishDate = new Date(video.snippet.publishedAt);
              
              return publishDate > this.lastCheckTime &&
                     recipeKeywords.some(keyword => title.includes(keyword));
            });
            
            newVideos.push(...recipeVideos);
          }
          
          return newVideos;
        }

        async getRecentVideos(channelId) {
          const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
              part: 'snippet',
              channelId: channelId,
              publishedAfter: this.lastCheckTime.toISOString(),
              maxResults: 10,
              order: 'date',
              type: 'video',
              key: 'test-api-key'
            }
          });
          return response.data.items;
        }
      }

      const monitoringService = new RecipeMonitoringService();
      const newRecipeVideos = await monitoringService.checkForNewRecipeVideos();

      expect(newRecipeVideos).toHaveLength(1);
      expect(newRecipeVideos[0].snippet.title).toContain('Ramen Recipe');
    });

    test('should extract recipe metadata from video descriptions', () => {
      const videoData = {
        snippet: {
          title: 'Perfect Beef Steak - Medium Rare',
          description: `
            Learn to cook the perfect medium-rare steak!
            
            Ingredients:
            - 2 ribeye steaks (1 inch thick)
            - Salt and pepper
            - Butter
            - Garlic
            
            Cook Time: 8-10 minutes
            Prep Time: 5 minutes
            Servings: 2
            
            Instructions:
            1. Season steaks with salt and pepper
            2. Heat pan to high heat
            3. Cook 3-4 minutes per side
            4. Add butter and garlic in last minute
          `,
          tags: ['cooking', 'steak', 'beef', 'recipe']
        }
      };

      class RecipeExtractor {
        extractRecipeData(videoData) {
          const description = videoData.snippet.description;
          const title = videoData.snippet.title;
          
          // Extract cooking times
          const cookTimeMatch = description.match(/Cook Time:\s*(\d+(?:-\d+)?)\s*minutes/i);
          const prepTimeMatch = description.match(/Prep Time:\s*(\d+)\s*minutes/i);
          const servingsMatch = description.match(/Servings:\s*(\d+)/i);
          
          // Extract ingredients
          const ingredientsSection = description.match(/Ingredients:([\s\S]*?)(?=Cook Time|Prep Time|Instructions|$)/i);
          const ingredients = ingredientsSection 
            ? ingredientsSection[1]
                .split('\n')
                .filter(line => line.trim().startsWith('-'))
                .map(line => line.trim().substring(1).trim())
            : [];

          return {
            title: title,
            cookTime: cookTimeMatch ? parseInt(cookTimeMatch[1]) : null,
            prepTime: prepTimeMatch ? parseInt(prepTimeMatch[1]) : null,
            servings: servingsMatch ? parseInt(servingsMatch[1]) : null,
            ingredients: ingredients,
            tags: videoData.snippet.tags || []
          };
        }
      }

      const extractor = new RecipeExtractor();
      const recipeData = extractor.extractRecipeData(videoData);

      expect(recipeData.title).toBe('Perfect Beef Steak - Medium Rare');
      expect(recipeData.cookTime).toBe(8); // First number from "8-10 minutes"
      expect(recipeData.prepTime).toBe(5);
      expect(recipeData.servings).toBe(2);
      expect(recipeData.ingredients).toHaveLength(4);
      expect(recipeData.ingredients[0]).toBe('2 ribeye steaks (1 inch thick)');
    });
  });

  describe('YouTube API Performance Tests', () => {
    test('should handle concurrent API requests efficiently', async () => {
      mockAxios.get.mockResolvedValue({
        data: { items: [{ id: 'test', snippet: { title: 'Test' } }] }
      });

      class YouTubeApiService {
        async getChannelInfo(channelId) {
          const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
            params: { part: 'snippet', id: channelId, key: 'test-key' }
          });
          return response.data.items[0];
        }
      }

      const youtubeService = new YouTubeApiService();
      const startTime = Date.now();

      // Make concurrent requests to all test channels
      const promises = testChannels.map(channel => 
        youtubeService.getChannelInfo(channel.id)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(3);
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(mockAxios.get).toHaveBeenCalledTimes(3);
    });

    test('should implement proper caching for API responses', async () => {
      const mockChannelData = {
        data: {
          items: [{ id: 'test', snippet: { title: 'Cached Channel' } }]
        }
      };

      mockAxios.get.mockResolvedValue(mockChannelData);

      class CachedYouTubeService {
        constructor() {
          this.cache = new Map();
          this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        }

        async getChannelInfoCached(channelId) {
          const cacheKey = `channel:${channelId}`;
          const cached = this.cache.get(cacheKey);
          
          if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
          }

          const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
            params: { part: 'snippet', id: channelId, key: 'test-key' }
          });
          
          const data = response.data.items[0];
          this.cache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
          });
          
          return data;
        }
      }

      const cachedService = new CachedYouTubeService();
      
      // First call - should hit API
      await cachedService.getChannelInfoCached(testChannels[0].id);
      expect(mockAxios.get).toHaveBeenCalledTimes(1);
      
      // Second call - should use cache
      await cachedService.getChannelInfoCached(testChannels[0].id);
      expect(mockAxios.get).toHaveBeenCalledTimes(1); // Still only 1 call
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle network errors gracefully', async () => {
      const networkError = new Error('Network Error');
      networkError.code = 'ENOTFOUND';
      
      mockAxios.get.mockRejectedValue(networkError);

      class ResilientYouTubeService {
        async getChannelInfoSafe(channelId) {
          try {
            const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
              params: { part: 'snippet', id: channelId, key: 'test-key' }
            });
            return { success: true, data: response.data.items[0] };
          } catch (error) {
            return { 
              success: false, 
              error: error.message,
              code: error.code 
            };
          }
        }
      }

      const service = new ResilientYouTubeService();
      const result = await service.getChannelInfoSafe(testChannels[0].id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network Error');
      expect(result.code).toBe('ENOTFOUND');
    });

    test('should handle invalid channel IDs', async () => {
      const invalidChannelError = {
        response: {
          status: 404,
          data: {
            error: {
              code: 404,
              message: 'Channel not found'
            }
          }
        }
      };

      mockAxios.get.mockRejectedValue(invalidChannelError);

      class YouTubeValidator {
        async validateChannel(channelId) {
          try {
            await axios.get('https://www.googleapis.com/youtube/v3/channels', {
              params: { part: 'snippet', id: channelId, key: 'test-key' }
            });
            return { valid: true };
          } catch (error) {
            if (error.response?.status === 404) {
              return { valid: false, reason: 'Channel not found' };
            }
            throw error;
          }
        }
      }

      const validator = new YouTubeValidator();
      const result = await validator.validateChannel('invalid-channel-id');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Channel not found');
    });
  });
});