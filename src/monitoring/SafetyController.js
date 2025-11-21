/**
 * 安全対策コントローラー
 * PersonalCookingRecipe統合開発環境
 */

const EventEmitter = require('events');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');

class SafetyController extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // 試行回数制限
            maxRetries: {
                database: config.maxRetries?.database || 3,
                redis: config.maxRetries?.redis || 3,
                api: config.maxRetries?.api || 5,
                memory: config.maxRetries?.memory || 2
            },
            
            // 時間制限
            retryTimeWindow: config.retryTimeWindow || 300000, // 5分
            cooldownPeriod: config.cooldownPeriod || 600000,   // 10分
            
            // バックアップ設定
            backupEnabled: config.backupEnabled !== false,
            backupDirectory: config.backupDirectory || '/app/backups/safety',
            maxBackups: config.maxBackups || 10,
            
            // エスカレーション設定
            escalationEnabled: config.escalationEnabled !== false,
            escalationThreshold: {
                criticalErrors: config.escalationThreshold?.criticalErrors || 3,
                failedRepairs: config.escalationThreshold?.failedRepairs || 5,
                timeWindow: config.escalationThreshold?.timeWindow || 900000 // 15分
            },
            
            // 安全モード設定
            safeMode: {
                enabled: config.safeMode?.enabled || false,
                triggers: {
                    memoryUsage: config.safeMode?.triggers?.memoryUsage || 0.95,
                    errorRate: config.safeMode?.triggers?.errorRate || 0.5,
                    consecutiveFailures: config.safeMode?.triggers?.consecutiveFailures || 5
                }
            },
            
            ...config
        };

        this.state = {
            retryCounters: new Map(),
            cooldowns: new Map(),
            escalationHistory: [],
            safeMode: false,
            safeModeActivatedAt: null,
            backupStatus: {
                lastBackup: null,
                backupCount: 0,
                totalBackups: 0
            }
        };

        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'safety-controller' },
            transports: [
                new winston.transports.File({ 
                    filename: 'logs/safety-controller.log' 
                }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });

        this.initialize();
    }

    async initialize() {
        this.logger.info('安全対策コントローラー初期化開始');
        
        try {
            // バックアップディレクトリ作成
            if (this.config.backupEnabled) {
                await this.ensureBackupDirectory();
            }
            
            // 定期クリーンアップタスク開始
            this.startCleanupTasks();
            
            this.logger.info('安全対策コントローラー初期化完了');
        } catch (error) {
            this.logger.error('安全対策コントローラー初期化失敗', error);
            throw error;
        }
    }

    async ensureBackupDirectory() {
        try {
            await fs.mkdir(this.config.backupDirectory, { recursive: true });
            this.logger.info(`バックアップディレクトリ確保: ${this.config.backupDirectory}`);
        } catch (error) {
            this.logger.error('バックアップディレクトリ作成失敗', error);
            throw error;
        }
    }

    startCleanupTasks() {
        // 1時間ごとにクリーンアップ
        setInterval(() => {
            this.cleanupOldEntries();
        }, 3600000);
        
        // 6時間ごとに古いバックアップを削除
        setInterval(() => {
            this.cleanupOldBackups();
        }, 21600000);
    }

    // 修復試行制御
    canAttemptRepair(componentType, errorInfo) {
        const key = `${componentType}_${this.getTimeWindow()}`;
        const currentCount = this.state.retryCounters.get(key) || 0;
        const maxRetries = this.config.maxRetries[componentType] || 3;
        
        // クールダウン確認
        if (this.isInCooldown(componentType)) {
            this.logger.warn(`修復試行拒否: ${componentType} クールダウン中`);
            return {
                allowed: false,
                reason: 'cooldown',
                remainingTime: this.getRemainingCooldownTime(componentType)
            };
        }
        
        // 試行回数確認
        if (currentCount >= maxRetries) {
            this.logger.warn(`修復試行拒否: ${componentType} 最大試行回数到達 (${currentCount}/${maxRetries})`);
            this.setCooldown(componentType);
            return {
                allowed: false,
                reason: 'max_retries',
                currentCount,
                maxRetries
            };
        }
        
        return {
            allowed: true,
            currentCount,
            maxRetries,
            remainingAttempts: maxRetries - currentCount
        };
    }

    recordRepairAttempt(componentType, success, errorInfo) {
        const key = `${componentType}_${this.getTimeWindow()}`;
        const currentCount = this.state.retryCounters.get(key) || 0;
        
        this.state.retryCounters.set(key, currentCount + 1);
        
        this.logger.info('修復試行記録', {
            componentType,
            success,
            attemptNumber: currentCount + 1,
            maxRetries: this.config.maxRetries[componentType]
        });
        
        // 失敗の場合、エスカレーション判定
        if (!success) {
            this.checkEscalationNeeded(componentType, errorInfo);
        }
        
        // セーフモード判定
        this.checkSafeModeActivation(componentType, success);
    }

    isInCooldown(componentType) {
        const cooldownEnd = this.state.cooldowns.get(componentType);
        return cooldownEnd && Date.now() < cooldownEnd;
    }

    setCooldown(componentType) {
        const cooldownEnd = Date.now() + this.config.cooldownPeriod;
        this.state.cooldowns.set(componentType, cooldownEnd);
        
        this.logger.warn(`クールダウン設定: ${componentType} (${Math.floor(this.config.cooldownPeriod / 60000)}分)`);
        
        this.emit('cooldownActivated', { componentType, cooldownEnd });
    }

    getRemainingCooldownTime(componentType) {
        const cooldownEnd = this.state.cooldowns.get(componentType);
        return cooldownEnd ? Math.max(0, cooldownEnd - Date.now()) : 0;
    }

    getTimeWindow() {
        return Math.floor(Date.now() / this.config.retryTimeWindow);
    }

    // バックアップ機能
    async createBackup(componentType, data, metadata = {}) {
        if (!this.config.backupEnabled) {
            return null;
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupId = `${componentType}_${timestamp}`;
        const backupPath = path.join(this.config.backupDirectory, `${backupId}.json`);
        
        const backupData = {
            id: backupId,
            componentType,
            timestamp: new Date(),
            metadata,
            data
        };
        
        try {
            await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
            
            this.state.backupStatus.lastBackup = new Date();
            this.state.backupStatus.backupCount++;
            this.state.backupStatus.totalBackups++;
            
            this.logger.info(`バックアップ作成完了: ${backupId}`);
            
            return {
                id: backupId,
                path: backupPath,
                timestamp: backupData.timestamp
            };
            
        } catch (error) {
            this.logger.error('バックアップ作成失敗', error);
            throw error;
        }
    }

    async restoreFromBackup(backupId) {
        const backupPath = path.join(this.config.backupDirectory, `${backupId}.json`);
        
        try {
            const backupContent = await fs.readFile(backupPath, 'utf8');
            const backupData = JSON.parse(backupContent);
            
            this.logger.info(`バックアップ復元: ${backupId}`);
            
            return backupData;
            
        } catch (error) {
            this.logger.error('バックアップ復元失敗', error);
            throw error;
        }
    }

    async listBackups(componentType = null) {
        try {
            const files = await fs.readdir(this.config.backupDirectory);
            let backupFiles = files.filter(file => file.endsWith('.json'));
            
            if (componentType) {
                backupFiles = backupFiles.filter(file => file.startsWith(componentType));
            }
            
            const backups = [];
            for (const file of backupFiles) {
                try {
                    const filePath = path.join(this.config.backupDirectory, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const data = JSON.parse(content);
                    
                    backups.push({
                        id: data.id,
                        componentType: data.componentType,
                        timestamp: data.timestamp,
                        metadata: data.metadata,
                        size: content.length
                    });
                } catch (error) {
                    this.logger.warn(`バックアップファイル読み込みエラー: ${file}`, error);
                }
            }
            
            return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
        } catch (error) {
            this.logger.error('バックアップ一覧取得失敗', error);
            return [];
        }
    }

    async cleanupOldBackups() {
        try {
            const backups = await this.listBackups();
            
            if (backups.length > this.config.maxBackups) {
                const backupsToDelete = backups.slice(this.config.maxBackups);
                
                for (const backup of backupsToDelete) {
                    const backupPath = path.join(this.config.backupDirectory, `${backup.id}.json`);
                    await fs.unlink(backupPath);
                    this.logger.info(`古いバックアップ削除: ${backup.id}`);
                }
                
                this.logger.info(`バックアップクリーンアップ完了: ${backupsToDelete.length}件削除`);
            }
            
        } catch (error) {
            this.logger.error('バックアップクリーンアップエラー', error);
        }
    }

    // エスカレーション機能
    checkEscalationNeeded(componentType, errorInfo) {
        const now = Date.now();
        const timeWindow = this.config.escalationThreshold.timeWindow;
        
        // 時間窓内のエラー履歴をフィルタ
        const recentErrors = this.state.escalationHistory.filter(
            entry => now - entry.timestamp.getTime() < timeWindow
        );
        
        const criticalErrors = recentErrors.filter(entry => entry.severity === 'critical').length;
        const failedRepairs = recentErrors.filter(entry => entry.type === 'failed_repair').length;
        
        let shouldEscalate = false;
        let escalationReason = '';
        
        if (criticalErrors >= this.config.escalationThreshold.criticalErrors) {
            shouldEscalate = true;
            escalationReason = `Critical errors threshold reached: ${criticalErrors}`;
        } else if (failedRepairs >= this.config.escalationThreshold.failedRepairs) {
            shouldEscalate = true;
            escalationReason = `Failed repairs threshold reached: ${failedRepairs}`;
        }
        
        if (shouldEscalate) {
            this.escalateToHuman(componentType, errorInfo, escalationReason);
        }
        
        // エラー履歴に追加
        this.state.escalationHistory.push({
            timestamp: new Date(),
            componentType,
            severity: errorInfo.severity,
            type: 'error',
            details: errorInfo
        });
    }

    async escalateToHuman(componentType, errorInfo, reason) {
        const escalation = {
            id: this.generateEscalationId(),
            timestamp: new Date(),
            componentType,
            errorInfo,
            reason,
            status: 'pending'
        };
        
        this.logger.error('人的介入要求', escalation);
        
        // 緊急通知送信
        this.emit('humanInterventionRequired', escalation);
        
        // エスカレーション履歴に記録
        this.state.escalationHistory.push({
            ...escalation,
            type: 'escalation'
        });
        
        return escalation;
    }

    generateEscalationId() {
        return `escalation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // セーフモード機能
    checkSafeModeActivation(componentType, repairSuccess) {
        if (!this.config.safeMode.enabled || this.state.safeMode) {
            return;
        }
        
        const triggers = this.config.safeMode.triggers;
        let shouldActivate = false;
        let trigger = '';
        
        // メモリ使用量チェック
        const memoryUsage = process.memoryUsage();
        const memoryPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
        if (memoryPercent > triggers.memoryUsage) {
            shouldActivate = true;
            trigger = `Memory usage: ${(memoryPercent * 100).toFixed(1)}%`;
        }
        
        // エラー率チェック
        const recentErrors = this.getRecentErrors();
        const errorRate = this.calculateErrorRate(recentErrors);
        if (errorRate > triggers.errorRate) {
            shouldActivate = true;
            trigger = `Error rate: ${(errorRate * 100).toFixed(1)}%`;
        }
        
        // 連続失敗チェック
        const consecutiveFailures = this.getConsecutiveFailures(componentType);
        if (consecutiveFailures >= triggers.consecutiveFailures) {
            shouldActivate = true;
            trigger = `Consecutive failures: ${consecutiveFailures}`;
        }
        
        if (shouldActivate) {
            this.activateSafeMode(trigger);
        }
    }

    activateSafeMode(trigger) {
        this.state.safeMode = true;
        this.state.safeModeActivatedAt = new Date();
        
        this.logger.error(`セーフモード発動: ${trigger}`);
        
        // 全ての自動修復を無効化
        this.emit('safeModeActivated', { trigger, timestamp: this.state.safeModeActivatedAt });
        
        // 緊急通知
        this.emit('emergencyNotification', {
            type: 'safe_mode_activated',
            trigger,
            timestamp: this.state.safeModeActivatedAt
        });
    }

    deactivateSafeMode(reason = 'manual') {
        if (!this.state.safeMode) {
            return false;
        }
        
        this.state.safeMode = false;
        const duration = Date.now() - this.state.safeModeActivatedAt.getTime();
        
        this.logger.info(`セーフモード解除: ${reason} (稼働時間: ${Math.floor(duration / 60000)}分)`);
        
        this.emit('safeModeDeactivated', { reason, duration });
        
        return true;
    }

    // ユーティリティメソッド
    getRecentErrors(timeWindow = 300000) { // 5分
        const now = Date.now();
        return this.state.escalationHistory.filter(
            entry => entry.type === 'error' && now - entry.timestamp.getTime() < timeWindow
        );
    }

    calculateErrorRate(errors) {
        // 簡易実装：エラー数を時間で割る
        if (errors.length === 0) return 0;
        
        const timeSpan = Math.max(
            errors[0].timestamp.getTime() - errors[errors.length - 1].timestamp.getTime(),
            60000 // 最低1分
        );
        
        return errors.length / (timeSpan / 60000); // 1分あたりのエラー数
    }

    getConsecutiveFailures(componentType) {
        const key = `${componentType}_${this.getTimeWindow()}`;
        return this.state.retryCounters.get(key) || 0;
    }

    cleanupOldEntries() {
        const cutoff = Date.now() - this.config.retryTimeWindow * 2;
        
        // 古いリトライカウンターをクリーンアップ
        for (const [key, _] of this.state.retryCounters.entries()) {
            const timeWindow = parseInt(key.split('_').pop());
            if (timeWindow * this.config.retryTimeWindow < cutoff) {
                this.state.retryCounters.delete(key);
            }
        }
        
        // 古いクールダウンをクリーンアップ
        for (const [key, endTime] of this.state.cooldowns.entries()) {
            if (Date.now() > endTime) {
                this.state.cooldowns.delete(key);
            }
        }
        
        // 古いエスカレーション履歴をクリーンアップ
        const escalationCutoff = Date.now() - (this.config.escalationThreshold.timeWindow * 2);
        this.state.escalationHistory = this.state.escalationHistory.filter(
            entry => entry.timestamp.getTime() > escalationCutoff
        );
    }

    // 状態取得
    getStatus() {
        return {
            safeMode: this.state.safeMode,
            safeModeActivatedAt: this.state.safeModeActivatedAt,
            activeRetries: this.state.retryCounters.size,
            activeCooldowns: this.state.cooldowns.size,
            escalationHistoryLength: this.state.escalationHistory.length,
            backupStatus: this.state.backupStatus,
            config: {
                maxRetries: this.config.maxRetries,
                backupEnabled: this.config.backupEnabled,
                escalationEnabled: this.config.escalationEnabled
            }
        };
    }

    async shutdown() {
        this.logger.info('安全対策コントローラー停止開始');
        
        // 最終バックアップ作成（必要に応じて）
        if (this.config.backupEnabled) {
            try {
                await this.createBackup('system_state', this.getStatus(), {
                    shutdownBackup: true
                });
            } catch (error) {
                this.logger.error('停止時バックアップ作成失敗', error);
            }
        }
        
        this.logger.info('安全対策コントローラー停止完了');
    }
}

module.exports = SafetyController;