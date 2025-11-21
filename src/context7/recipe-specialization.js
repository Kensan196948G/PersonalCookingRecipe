/**
 * Context7 PersonalCookingRecipe Specialization Module
 * Recipe-CTO設計・実装
 * 
 * PersonalCookingRecipeプロジェクト特化機能:
 * - 3チャンネル統合レシピ監視
 * - PostgreSQL料理データベース統合
 * - YouTube/Claude/Notion/Gmail API連携
 * - 高速JWT認証統合（1.44ms対応）
 */

const winston = require('winston');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class RecipeSpecialization {
  constructor(context7Manager, config = {}) {
    this.context7 = context7Manager;
    this.config = {
      channels: {
        'Sam The Cooking Guy': {
          channelId: 'UCxzNaAXZwX_VH4wOyh--zOw',
          priority: 'high',
          updateFrequency: '15min',
          contentTypes: ['recipe', 'technique', 'equipment']
        },
        'Tasty Recipes': {
          channelId: 'UCzHyQjGcfN4GppGBe8v0ylw',
          priority: 'high',
          updateFrequency: '15min',
          contentTypes: ['quick_recipes', 'viral_food', 'tutorials']
        },
        'Joshua Weissman': {
          channelId: 'UChBEbMKI1eCcejTtmI32UEw',
          priority: 'high',
          updateFrequency: '20min',
          contentTypes: ['advanced_recipes', 'techniques', 'fermentation']
        }
      },
      apis: {
        youtube: {
          endpoint: 'https://youtube.googleapis.com/youtube/v3',
          key: process.env.YOUTUBE_API_KEY,
          quotaLimit: 10000,
          rateLimitPerSecond: 100
        },
        claude: {
          endpoint: 'https://api.anthropic.com/v1',
          key: process.env.CLAUDE_API_KEY,
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 4096
        },
        notion: {
          endpoint: 'https://api.notion.com/v1',
          key: process.env.NOTION_API_KEY,
          version: '2022-06-28',
          databaseId: process.env.NOTION_RECIPE_DATABASE_ID
        },
        gmail: {
          endpoint: 'https://gmail.googleapis.com/gmail/v1',
          credentials: process.env.GMAIL_CREDENTIALS,
          scopes: ['https://www.googleapis.com/auth/gmail.send']
        }
      },
      jwt: {
        secret: process.env.JWT_SECRET,
        algorithm: 'HS256',
        expiresIn: '1h',
        refreshExpiresIn: '7d',
        performanceTarget: 1.44 // ms
      },
      database: {
        recipeSchema: 'recipes',
        contextSchema: 'context7_recipe_data'
      },
      ...config
    };

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: 'logs/recipe-specialization.log' 
        })
      ]
    });

    this.channelMonitors = new Map();
    this.recipeAnalysisQueue = [];
    
    this.init();
  }

  async init() {
    try {
      // PostgreSQL recipe schema initialization
      await this.initializeRecipeSchema();
      
      // Channel monitoring setup
      await this.setupChannelMonitoring();
      
      // Context7 recipe layer customization
      await this.setupRecipeContextLayers();

      this.logger.info('Recipe Specialization Module initialized');
      
    } catch (error) {
      this.logger.error('Recipe Specialization initialization failed:', error);
      throw error;
    }
  }

  async initializeRecipeSchema() {
    const client = await this.context7.pgPool.connect();
    
    try {
      await client.query('BEGIN');

      // Recipe-specific Context7 tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS context7_recipe_monitoring (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          channel_name VARCHAR(100) NOT NULL,
          channel_id VARCHAR(50) NOT NULL,
          latest_video_id VARCHAR(50),
          last_check TIMESTAMP DEFAULT NOW(),
          status VARCHAR(20) DEFAULT 'active',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS context7_recipe_analysis (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          video_id VARCHAR(50) NOT NULL,
          channel_name VARCHAR(100) NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          recipe_data JSONB,
          claude_analysis JSONB,
          quality_score NUMERIC(3,2),
          ingredients JSONB DEFAULT '[]',
          instructions JSONB DEFAULT '[]',
          nutrition_info JSONB DEFAULT '{}',
          tags JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS context7_recipe_notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          notification_type VARCHAR(50) NOT NULL,
          recipient_email VARCHAR(255) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          sent_at TIMESTAMP,
          status VARCHAR(20) DEFAULT 'pending',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Performance tracking for JWT auth
      await client.query(`
        CREATE TABLE IF NOT EXISTS context7_jwt_performance (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          operation_type VARCHAR(50) NOT NULL,
          execution_time_ms NUMERIC(6,3) NOT NULL,
          success BOOLEAN DEFAULT true,
          user_id UUID,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Indexes for performance
      await client.query('CREATE INDEX IF NOT EXISTS idx_recipe_monitoring_channel ON context7_recipe_monitoring(channel_name, status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_recipe_analysis_video ON context7_recipe_analysis(video_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_recipe_analysis_quality ON context7_recipe_analysis(quality_score DESC)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_jwt_performance_time ON context7_jwt_performance(created_at, execution_time_ms)');

      await client.query('COMMIT');
      
      this.logger.info('Recipe-specific Context7 schema initialized');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async setupChannelMonitoring() {
    for (const [channelName, config] of Object.entries(this.config.channels)) {
      // Register channel in database
      await this.registerChannel(channelName, config);
      
      // Start monitoring interval
      const intervalMs = this.parseTimeToMs(config.updateFrequency);
      const monitor = setInterval(async () => {
        await this.checkChannelForUpdates(channelName, config);
      }, intervalMs);
      
      this.channelMonitors.set(channelName, monitor);
      
      this.logger.info(`Monitoring started for channel: ${channelName} (${config.updateFrequency})`);
    }
  }

  async setupRecipeContextLayers() {
    // Layer 1: Recipe project metadata
    await this.context7.setLayerData(1, {
      project_type: 'PersonalCookingRecipe',
      channels: Object.keys(this.config.channels),
      apis: Object.keys(this.config.apis),
      monitoring_status: 'active',
      last_updated: new Date().toISOString()
    });

    // Layer 3: Recipe database integration
    await this.context7.setLayerData(3, {
      database_type: 'postgresql',
      recipe_schema: this.config.database.recipeSchema,
      context_schema: this.config.database.contextSchema,
      monitoring_tables: [
        'context7_recipe_monitoring',
        'context7_recipe_analysis', 
        'context7_recipe_notifications'
      ]
    });

    // Layer 4: Recipe development progress
    await this.context7.setLayerData(4, {
      development_phase: 'context7_integration',
      api_integrations: {
        youtube: 'active',
        claude: 'active', 
        notion: 'configured',
        gmail: 'configured'
      },
      performance_targets: {
        jwt_auth: '1.44ms',
        recipe_analysis: '5s',
        notification_delivery: '2s'
      }
    });
  }

  // Channel monitoring functionality
  async checkChannelForUpdates(channelName, config) {
    const startTime = Date.now();
    
    try {
      // Get latest videos from YouTube API
      const videos = await this.fetchLatestVideos(config.channelId, 5);
      
      for (const video of videos) {
        // Check if video is already processed
        const existing = await this.isVideoProcessed(video.id);
        
        if (!existing) {
          // Queue for recipe analysis
          this.recipeAnalysisQueue.push({
            videoId: video.id,
            channelName,
            videoData: video
          });
          
          // Process immediately if queue is small
          if (this.recipeAnalysisQueue.length <= 5) {
            await this.processRecipeAnalysisQueue();
          }
        }
      }

      // Update channel monitoring status
      await this.updateChannelStatus(channelName, 'success', videos.length);
      
      // Record performance metric
      await this.context7.recordPerformanceMetric(
        'channel_check_time',
        Date.now() - startTime,
        'ms'
      );

    } catch (error) {
      this.logger.error(`Channel monitoring failed for ${channelName}:`, error);
      await this.updateChannelStatus(channelName, 'error', 0, error.message);
    }
  }

  async processRecipeAnalysisQueue() {
    if (this.recipeAnalysisQueue.length === 0) return;

    const batch = this.recipeAnalysisQueue.splice(0, 3); // Process 3 at a time
    
    for (const item of batch) {
      try {
        await this.analyzeRecipeVideo(item.videoId, item.channelName, item.videoData);
      } catch (error) {
        this.logger.error(`Recipe analysis failed for ${item.videoId}:`, error);
      }
    }
  }

  async analyzeRecipeVideo(videoId, channelName, videoData) {
    const startTime = Date.now();
    
    try {
      // Claude AI analysis
      const claudeAnalysis = await this.analyzeWithClaude(videoData);
      
      // Extract recipe components
      const recipeExtraction = await this.extractRecipeComponents(claudeAnalysis, videoData);
      
      // Calculate quality score
      const qualityScore = this.calculateRecipeQualityScore(recipeExtraction);
      
      // Save analysis to database
      await this.saveRecipeAnalysis({
        videoId,
        channelName,
        title: videoData.snippet.title,
        description: videoData.snippet.description,
        recipeData: recipeExtraction,
        claudeAnalysis,
        qualityScore,
        ingredients: recipeExtraction.ingredients || [],
        instructions: recipeExtraction.instructions || [],
        nutritionInfo: recipeExtraction.nutrition || {},
        tags: recipeExtraction.tags || []
      });

      // Send notifications for high-quality recipes
      if (qualityScore >= 0.8) {
        await this.sendRecipeNotification(videoData, recipeExtraction, qualityScore);
      }

      // Update Context7 with latest recipe analysis
      await this.updateRecipeContext(channelName, recipeExtraction, qualityScore);

      this.logger.info(`Recipe analyzed: ${videoId} (${channelName}) - Score: ${qualityScore} (${Date.now() - startTime}ms)`);

    } catch (error) {
      this.logger.error(`Recipe analysis failed for ${videoId}:`, error);
      throw error;
    }
  }

  // High-performance JWT authentication (1.44ms target)
  async authenticateJWT(token) {
    const startTime = process.hrtime.bigint();
    
    try {
      // Use synchronous verification for maximum performance
      const decoded = jwt.verify(token, this.config.jwt.secret, {
        algorithms: [this.config.jwt.algorithm]
      });

      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      // Record JWT performance metric
      await this.recordJWTPerformance('verify', executionTimeMs, true, decoded.userId);

      // Check if performance target is met
      if (executionTimeMs <= this.config.jwt.performanceTarget) {
        this.logger.debug(`JWT auth successful: ${executionTimeMs.toFixed(3)}ms (target: ${this.config.jwt.performanceTarget}ms)`);
      } else {
        this.logger.warn(`JWT auth slower than target: ${executionTimeMs.toFixed(3)}ms > ${this.config.jwt.performanceTarget}ms`);
      }

      return { 
        valid: true, 
        decoded, 
        performanceMs: executionTimeMs 
      };

    } catch (error) {
      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;
      
      await this.recordJWTPerformance('verify', executionTimeMs, false);
      
      return { 
        valid: false, 
        error: error.message, 
        performanceMs: executionTimeMs 
      };
    }
  }

  async generateJWT(userId, userData = {}) {
    const startTime = process.hrtime.bigint();
    
    try {
      const payload = {
        userId,
        ...userData,
        iat: Math.floor(Date.now() / 1000)
      };

      const token = jwt.sign(payload, this.config.jwt.secret, {
        algorithm: this.config.jwt.algorithm,
        expiresIn: this.config.jwt.expiresIn
      });

      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;

      await this.recordJWTPerformance('generate', executionTimeMs, true, userId);

      return { 
        token, 
        performanceMs: executionTimeMs 
      };

    } catch (error) {
      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;
      
      await this.recordJWTPerformance('generate', executionTimeMs, false, userId);
      throw error;
    }
  }

  // API integration methods
  async fetchLatestVideos(channelId, maxResults = 5) {
    try {
      const response = await axios.get(`${this.config.apis.youtube.endpoint}/search`, {
        params: {
          part: 'snippet',
          channelId,
          maxResults,
          order: 'date',
          type: 'video',
          key: this.config.apis.youtube.key
        }
      });

      return response.data.items || [];

    } catch (error) {
      this.logger.error(`YouTube API error for channel ${channelId}:`, error);
      throw error;
    }
  }

  async analyzeWithClaude(videoData) {
    try {
      const prompt = `
        Analyze this cooking video and extract recipe information:
        
        Title: ${videoData.snippet.title}
        Description: ${videoData.snippet.description}
        
        Please extract:
        1. Recipe name and type
        2. Ingredients list with quantities
        3. Step-by-step instructions
        4. Cooking time and difficulty
        5. Nutritional highlights
        6. Recipe tags and categories
        
        Return as structured JSON.
      `;

      const response = await axios.post(`${this.config.apis.claude.endpoint}/messages`, {
        model: this.config.claude.model,
        max_tokens: this.config.claude.maxTokens,
        messages: [{
          role: 'user',
          content: prompt
        }]
      }, {
        headers: {
          'Authorization': `Bearer ${this.config.apis.claude.key}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        }
      });

      return JSON.parse(response.data.content[0].text);

    } catch (error) {
      this.logger.error('Claude analysis error:', error);
      return { error: 'Analysis failed', fallback: true };
    }
  }

  // Recipe quality scoring algorithm
  calculateRecipeQualityScore(recipeData) {
    let score = 0.0;

    // Ingredients completeness (0-0.3)
    if (recipeData.ingredients && recipeData.ingredients.length > 0) {
      score += Math.min(recipeData.ingredients.length / 10, 0.3);
    }

    // Instructions clarity (0-0.3) 
    if (recipeData.instructions && recipeData.instructions.length > 0) {
      score += Math.min(recipeData.instructions.length / 8, 0.3);
    }

    // Nutritional information (0-0.2)
    if (recipeData.nutrition && Object.keys(recipeData.nutrition).length > 0) {
      score += 0.2;
    }

    // Recipe metadata (0-0.2)
    let metadataScore = 0;
    if (recipeData.cookTime) metadataScore += 0.05;
    if (recipeData.difficulty) metadataScore += 0.05;
    if (recipeData.servings) metadataScore += 0.05;
    if (recipeData.tags && recipeData.tags.length > 0) metadataScore += 0.05;
    score += metadataScore;

    return Math.min(score, 1.0);
  }

  // Database operations
  async registerChannel(channelName, config) {
    const client = await this.context7.pgPool.connect();
    
    try {
      await client.query(`
        INSERT INTO context7_recipe_monitoring 
        (channel_name, channel_id, metadata)
        VALUES ($1, $2, $3)
        ON CONFLICT (channel_name) 
        DO UPDATE SET 
          channel_id = $2,
          metadata = $3,
          status = 'active'
      `, [channelName, config.channelId, config]);

    } finally {
      client.release();
    }
  }

  async saveRecipeAnalysis(analysisData) {
    const client = await this.context7.pgPool.connect();
    
    try {
      await client.query(`
        INSERT INTO context7_recipe_analysis 
        (video_id, channel_name, title, description, recipe_data, claude_analysis, 
         quality_score, ingredients, instructions, nutrition_info, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        analysisData.videoId,
        analysisData.channelName, 
        analysisData.title,
        analysisData.description,
        analysisData.recipeData,
        analysisData.claudeAnalysis,
        analysisData.qualityScore,
        analysisData.ingredients,
        analysisData.instructions,
        analysisData.nutritionInfo,
        analysisData.tags
      ]);

    } finally {
      client.release();
    }
  }

  async recordJWTPerformance(operationType, executionTimeMs, success, userId = null) {
    const client = await this.context7.pgPool.connect();
    
    try {
      await client.query(`
        INSERT INTO context7_jwt_performance 
        (operation_type, execution_time_ms, success, user_id)
        VALUES ($1, $2, $3, $4)
      `, [operationType, executionTimeMs, success, userId]);

    } finally {
      client.release();
    }
  }

  // Utility methods
  parseTimeToMs(timeString) {
    const units = { 'min': 60000, 's': 1000, 'h': 3600000 };
    const match = timeString.match(/^(\d+)(min|s|h)$/);
    return match ? parseInt(match[1]) * units[match[2]] : 60000; // default 1 min
  }

  async isVideoProcessed(videoId) {
    const client = await this.context7.pgPool.connect();
    
    try {
      const result = await client.query(
        'SELECT id FROM context7_recipe_analysis WHERE video_id = $1',
        [videoId]
      );
      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  async updateChannelStatus(channelName, status, videoCount = 0, errorMessage = null) {
    const client = await this.context7.pgPool.connect();
    
    try {
      await client.query(`
        UPDATE context7_recipe_monitoring 
        SET status = $2, last_check = NOW(), 
            metadata = metadata || jsonb_build_object('last_video_count', $3, 'last_error', $4)
        WHERE channel_name = $1
      `, [channelName, status, videoCount, errorMessage]);
    } finally {
      client.release();
    }
  }

  // Mock implementations for email notifications and other integrations
  async sendRecipeNotification(videoData, recipeData, qualityScore) {
    // Implementation would integrate with Gmail API
    this.logger.info(`High-quality recipe notification: ${videoData.snippet.title} (Score: ${qualityScore})`);
  }

  async updateRecipeContext(channelName, recipeData, qualityScore) {
    // Update Context7 Layer 5 with latest recipe analytics
    const layerData = await this.context7.getLayerData(5);
    const updatedMetrics = {
      ...layerData?.data,
      latest_recipe_analysis: {
        channel: channelName,
        quality_score: qualityScore,
        timestamp: new Date().toISOString()
      }
    };
    
    await this.context7.setLayerData(5, updatedMetrics);
  }

  extractRecipeComponents(claudeAnalysis, videoData) {
    // Process Claude's structured analysis
    return {
      name: claudeAnalysis.recipe_name || videoData.snippet.title,
      ingredients: claudeAnalysis.ingredients || [],
      instructions: claudeAnalysis.instructions || [],
      cookTime: claudeAnalysis.cook_time,
      difficulty: claudeAnalysis.difficulty,
      nutrition: claudeAnalysis.nutrition || {},
      tags: claudeAnalysis.tags || []
    };
  }

  // Health check
  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      active_channels: this.channelMonitors.size,
      queue_length: this.recipeAnalysisQueue.length,
      jwt_performance_target: this.config.jwt.performanceTarget
    };
  }
}

module.exports = RecipeSpecialization;