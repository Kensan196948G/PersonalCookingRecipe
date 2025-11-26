/**
 * Claude-Flow AI支援エラー対応統合モジュール
 * PersonalCookingRecipe統合開発環境
 */

const { spawn } = require('child_process');
const winston = require('winston');

class ClaudeFlowIntegration {
    constructor(config = {}) {
        this.config = {
            // Claude-Flow設定
            enabled: config.enabled !== false,
            claudeFlowPath: config.claudeFlowPath || 'npx claude-flow@alpha',
            aiAssistanceLevel: config.aiAssistanceLevel || 'diagnostic', // diagnostic, suggestion, auto
            
            // AI支援設定
            errorAnalysis: config.errorAnalysis !== false,
            solutionGeneration: config.solutionGeneration !== false,
            codeReview: config.codeReview || false,
            
            // 安全設定
            autoExecute: config.autoExecute || false, // 自動実行は無効化
            humanApproval: config.humanApproval !== false, // 人間の承認を必須
            maxSuggestions: config.maxSuggestions || 3,
            
            // コンテキスト設定
            includeSystemInfo: config.includeSystemInfo !== false,
            includeErrorHistory: config.includeErrorHistory !== false,
            includeMetrics: config.includeMetrics !== false,
            
            ...config
        };

        this.state = {
            aiRequestCount: 0,
            lastAiRequest: null,
            pendingAnalyses: new Map(),
            aiSuggestionHistory: []
        };

        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'claude-flow-integration' },
            transports: [
                new winston.transports.File({ 
                    filename: 'logs/claude-flow-integration.log' 
                }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });

        this.initialize();
    }

    async initialize() {
        if (!this.config.enabled) {
            this.logger.info('Claude-Flow統合は無効化されています');
            return;
        }

        this.logger.info('Claude-Flow統合初期化開始');
        
        try {
            // Claude-Flow の可用性チェック
            await this.checkClaudeFlowAvailability();
            
            this.logger.info('Claude-Flow統合初期化完了');
        } catch (error) {
            this.logger.error('Claude-Flow統合初期化失敗', error);
            this.config.enabled = false;
        }
    }

    async checkClaudeFlowAvailability() {
        return new Promise((resolve, reject) => {
            const child = spawn('npx', ['claude-flow@alpha', '--version'], {
                stdio: 'pipe'
            });

            let output = '';
            child.stdout.on('data', (data) => {
                output += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    this.logger.info(`Claude-Flow利用可能: ${output.trim()}`);
                    resolve(true);
                } else {
                    reject(new Error(`Claude-Flow not available (exit code: ${code})`));
                }
            });

            child.on('error', (error) => {
                reject(error);
            });
        });
    }

    async analyzeError(errorInfo, systemContext = {}) {
        if (!this.config.enabled || !this.config.errorAnalysis) {
            return null;
        }

        const analysisId = this.generateAnalysisId();
        this.state.aiRequestCount++;
        this.state.lastAiRequest = new Date();
        
        this.logger.info(`AI エラー分析開始: ${analysisId}`, {
            errorType: errorInfo.type,
            severity: errorInfo.severity
        });

        try {
            const contextData = await this.buildAnalysisContext(errorInfo, systemContext);
            const analysis = await this.requestAiAnalysis(contextData);
            
            const result = {
                id: analysisId,
                timestamp: new Date(),
                errorInfo,
                analysis,
                confidence: this.calculateConfidence(analysis),
                recommendations: this.extractRecommendations(analysis)
            };

            this.state.pendingAnalyses.set(analysisId, result);
            this.state.aiSuggestionHistory.push(result);

            // 履歴サイズ制限
            if (this.state.aiSuggestionHistory.length > 100) {
                this.state.aiSuggestionHistory.shift();
            }

            this.logger.info(`AI エラー分析完了: ${analysisId}`, {
                confidence: result.confidence,
                recommendationCount: result.recommendations.length
            });

            return result;

        } catch (error) {
            this.logger.error(`AI エラー分析失敗: ${analysisId}`, error);
            return {
                id: analysisId,
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    async buildAnalysisContext(errorInfo, systemContext) {
        const context = {
            // エラー基本情報
            error: {
                type: errorInfo.type,
                severity: errorInfo.severity,
                message: errorInfo.message,
                timestamp: errorInfo.timestamp,
                consecutiveFailures: errorInfo.consecutiveFailures
            },
            
            // プロジェクト情報
            project: {
                name: 'PersonalCookingRecipe',
                platform: 'Node.js + Express',
                database: 'PostgreSQL',
                cache: 'Redis',
                environment: process.env.NODE_ENV || 'development'
            },
            
            // リクエストされた分析タイプ
            analysisType: this.config.aiAssistanceLevel,
            
            // 安全制約
            constraints: {
                autoExecute: this.config.autoExecute,
                humanApproval: this.config.humanApproval,
                maxSuggestions: this.config.maxSuggestions
            }
        };

        // システム情報追加
        if (this.config.includeSystemInfo) {
            context.system = {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                platform: process.platform,
                nodeVersion: process.version,
                ...systemContext
            };
        }

        // エラー履歴追加
        if (this.config.includeErrorHistory && this.state.aiSuggestionHistory.length > 0) {
            context.errorHistory = this.state.aiSuggestionHistory
                .slice(-5) // 最新5件
                .map(item => ({
                    type: item.errorInfo?.type,
                    severity: item.errorInfo?.severity,
                    timestamp: item.timestamp,
                    resolved: item.resolved || false
                }));
        }

        return context;
    }

    async requestAiAnalysis(contextData) {
        const prompt = this.buildAnalysisPrompt(contextData);
        
        return new Promise((resolve, reject) => {
            const args = [
                'claude-flow@alpha',
                'analyze',
                '--prompt', prompt,
                '--output', 'json',
                '--mode', 'diagnostic'
            ];

            const child = spawn('npx', args, {
                stdio: 'pipe'
            });

            let output = '';
            let errorOutput = '';

            child.stdout.on('data', (data) => {
                output += data.toString();
            });

            child.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output);
                        resolve(result);
                    } catch (parseError) {
                        reject(new Error(`Failed to parse AI response: ${parseError.message}`));
                    }
                } else {
                    reject(new Error(`Claude-Flow failed (exit code: ${code}): ${errorOutput}`));
                }
            });

            child.on('error', (error) => {
                reject(error);
            });
        });
    }

    buildAnalysisPrompt(contextData) {
        const prompt = `
# PersonalCookingRecipe エラー分析要請

## エラー情報
- **種類**: ${contextData.error.type}
- **重要度**: ${contextData.error.severity}
- **メッセージ**: ${contextData.error.message}
- **発生時刻**: ${contextData.error.timestamp}
- **連続失敗回数**: ${contextData.error.consecutiveFailures}

## システム情報
- **プロジェクト**: ${contextData.project.name}
- **プラットフォーム**: ${contextData.project.platform}
- **データベース**: ${contextData.project.database}
- **キャッシュ**: ${contextData.project.cache}
- **環境**: ${contextData.project.environment}

${contextData.system ? `
## システム状態
- **稼働時間**: ${Math.floor(contextData.system.uptime / 60)} 分
- **メモリ使用量**: ${Math.round(contextData.system.memory.heapUsed / 1024 / 1024)} MB
- **Node.js バージョン**: ${contextData.system.nodeVersion}
` : ''}

${contextData.errorHistory ? `
## 最近のエラー履歴
${contextData.errorHistory.map((err, index) => 
    `${index + 1}. [${err.severity}] ${err.type} - ${err.timestamp}`
).join('\n')}
` : ''}

## 分析要求
分析レベル: ${contextData.analysisType}
最大提案数: ${contextData.constraints.maxSuggestions}

## 出力要求
以下のJSON形式で応答してください：
\`\`\`json
{
    "analysis": {
        "rootCause": "エラーの根本原因の分析",
        "impact": "システムへの影響評価",
        "urgency": "対応の緊急度 (low/medium/high/critical)"
    },
    "recommendations": [
        {
            "type": "immediate/short-term/long-term",
            "action": "推奨する具体的なアクション",
            "risk": "実行時のリスクレベル (low/medium/high)",
            "effort": "実装の工数見積もり (low/medium/high)",
            "expected_outcome": "期待される結果"
        }
    ],
    "preventive_measures": [
        "今後の予防策"
    ],
    "monitoring_points": [
        "監視すべきポイント"
    ]
}
\`\`\`
        `;

        return prompt.trim();
    }

    calculateConfidence(analysis) {
        // AI分析の信頼度を計算（簡易実装）
        let confidence = 0.5; // ベースライン50%
        
        if (analysis.analysis?.rootCause) confidence += 0.2;
        if (analysis.recommendations?.length > 0) confidence += 0.2;
        if (analysis.preventive_measures?.length > 0) confidence += 0.1;
        
        return Math.min(confidence, 1.0);
    }

    extractRecommendations(analysis) {
        const recommendations = [];
        
        if (analysis.recommendations) {
            analysis.recommendations.forEach(rec => {
                recommendations.push({
                    type: rec.type || 'general',
                    action: rec.action,
                    risk: rec.risk || 'medium',
                    effort: rec.effort || 'medium',
                    expectedOutcome: rec.expected_outcome,
                    aiGenerated: true,
                    requiresApproval: this.config.humanApproval,
                    autoExecutable: rec.risk === 'low' && this.config.autoExecute
                });
            });
        }
        
        return recommendations;
    }

    async generateSolution(errorInfo, requirements = {}) {
        if (!this.config.enabled || !this.config.solutionGeneration) {
            return null;
        }

        this.logger.info('AI ソリューション生成開始', {
            errorType: errorInfo.type,
            requirements
        });

        try {
            const solutionPrompt = this.buildSolutionPrompt(errorInfo, requirements);
            const solution = await this.requestAiSolution(solutionPrompt);
            
            return {
                id: this.generateAnalysisId(),
                timestamp: new Date(),
                errorInfo,
                solution,
                requirements,
                implementationPlan: this.extractImplementationPlan(solution),
                risks: this.extractRisks(solution),
                testing: this.extractTestingPlan(solution)
            };

        } catch (error) {
            this.logger.error('AI ソリューション生成失敗', error);
            return { error: error.message };
        }
    }

    buildSolutionPrompt(errorInfo, requirements) {
        return `
# PersonalCookingRecipe ソリューション生成要請

## エラー詳細
${JSON.stringify(errorInfo, null, 2)}

## 要求事項
${JSON.stringify(requirements, null, 2)}

## ソリューション要求
以下の形式で実装可能なソリューションを提供してください：
- コードの修正案
- 設定の変更案
- 新機能の追加案
- テスト計画
- リスク評価

出力はJSON形式でお願いします。
        `;
    }

    async requestAiSolution(prompt) {
        // Claude-Flow solution generation call
        return new Promise((resolve, reject) => {
            const args = [
                'claude-flow@alpha',
                'generate',
                '--prompt', prompt,
                '--output', 'json',
                '--mode', 'solution'
            ];

            const child = spawn('npx', args, { stdio: 'pipe' });
            let output = '';
            
            child.stdout.on('data', (data) => output += data.toString());
            child.on('close', (code) => {
                if (code === 0) {
                    try {
                        resolve(JSON.parse(output));
                    } catch (error) {
                        reject(new Error(`Failed to parse solution: ${error.message}`));
                    }
                } else {
                    reject(new Error(`Solution generation failed: ${code}`));
                }
            });
        });
    }

    extractImplementationPlan(solution) {
        return solution.implementation || [];
    }

    extractRisks(solution) {
        return solution.risks || [];
    }

    extractTestingPlan(solution) {
        return solution.testing || [];
    }

    generateAnalysisId() {
        return `ai_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 診断機能
    async runDiagnostics() {
        return {
            timestamp: new Date(),
            enabled: this.config.enabled,
            configuration: this.config,
            statistics: {
                totalAiRequests: this.state.aiRequestCount,
                lastRequest: this.state.lastAiRequest,
                pendingAnalyses: this.state.pendingAnalyses.size,
                historyLength: this.state.aiSuggestionHistory.length
            },
            availability: await this.checkClaudeFlowAvailability().catch(() => false)
        };
    }

    getStatus() {
        return {
            enabled: this.config.enabled,
            healthy: this.config.enabled,
            aiRequestCount: this.state.aiRequestCount,
            lastRequest: this.state.lastAiRequest,
            pendingAnalyses: this.state.pendingAnalyses.size
        };
    }

    async shutdown() {
        this.logger.info('Claude-Flow統合停止開始');
        
        // 未完了の分析をクリーンアップ
        this.state.pendingAnalyses.clear();
        
        this.logger.info('Claude-Flow統合停止完了');
    }
}

module.exports = ClaudeFlowIntegration;