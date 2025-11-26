/**
 * Phase Service Layer - ビジネスロジック
 *
 * 責務:
 * - Phase管理のビジネスルール適用
 * - データバリデーション
 * - エラーハンドリング
 * - キャッシング戦略
 * - レポート生成
 */

const Phase = require('../models/Phase');
const db = require('../config/database-postgresql');

class PhaseService {
    /**
     * 全Phase取得（キャッシュ対応）
     * @param {Object} options - フィルタオプション
     * @returns {Promise<Array>} Phase一覧
     */
    static async getAllPhases(options = {}) {
        try {
            // キャッシュキー生成
            const cacheKey = `phases:all:${JSON.stringify(options)}`;

            // キャッシュチェック
            const cached = await db.cacheGet(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            // DB取得
            const phases = await Phase.findAll(options);

            // キャッシュ保存（5分）
            await db.cacheSet(cacheKey, JSON.stringify(phases), 300);

            return phases;
        } catch (error) {
            throw new Error(`Phase一覧取得エラー: ${error.message}`);
        }
    }

    /**
     * 現在のPhase取得
     * @returns {Promise<Object>} 現在のPhase
     */
    static async getCurrentPhase() {
        try {
            const cacheKey = 'phases:current';
            const cached = await db.cacheGet(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            const phase = await Phase.getCurrentPhase();
            if (!phase) {
                throw new Error('アクティブなPhaseが見つかりません');
            }

            await db.cacheSet(cacheKey, JSON.stringify(phase), 300);
            return phase;
        } catch (error) {
            throw new Error(`現在のPhase取得エラー: ${error.message}`);
        }
    }

    /**
     * Phase詳細取得
     * @param {number} id - Phase ID
     * @returns {Promise<Object>} Phase詳細
     */
    static async getPhaseById(id) {
        try {
            const cacheKey = `phases:${id}`;
            const cached = await db.cacheGet(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            const phase = await Phase.findById(id);
            if (!phase) {
                throw new Error('Phase not found');
            }

            await db.cacheSet(cacheKey, JSON.stringify(phase), 300);
            return phase;
        } catch (error) {
            throw new Error(`Phase詳細取得エラー: ${error.message}`);
        }
    }

    /**
     * Phase作成
     * @param {Object} phaseData - Phase情報
     * @returns {Promise<Object>} 作成されたPhase
     */
    static async createPhase(phaseData) {
        try {
            // バリデーション
            this.validatePhaseData(phaseData);

            // 重複チェック
            const existing = await Phase.findByPhaseNumber(phaseData.phase_number);
            if (existing) {
                throw new Error(`Phase ${phaseData.phase_number} は既に存在します`);
            }

            // Phase作成
            const phase = await Phase.create(phaseData);

            // キャッシュクリア
            await this.clearPhaseCache();

            return phase;
        } catch (error) {
            throw new Error(`Phase作成エラー: ${error.message}`);
        }
    }

    /**
     * Phase更新
     * @param {number} id - Phase ID
     * @param {Object} updateData - 更新データ
     * @returns {Promise<Object>} 更新されたPhase
     */
    static async updatePhase(id, updateData) {
        try {
            // 存在チェック
            const existing = await Phase.findById(id);
            if (!existing) {
                throw new Error('Phase not found');
            }

            // ステータス変更バリデーション
            if (updateData.status) {
                this.validateStatusTransition(existing.status, updateData.status);
            }

            // Phase更新
            const updated = await Phase.update(id, updateData);

            // キャッシュクリア
            await this.clearPhaseCache(id);

            return updated;
        } catch (error) {
            throw new Error(`Phase更新エラー: ${error.message}`);
        }
    }

    /**
     * Phase開始
     * @param {number} id - Phase ID
     * @returns {Promise<Object>} 開始結果
     */
    static async startPhase(id) {
        try {
            const phase = await Phase.findById(id);
            if (!phase) {
                throw new Error('Phase not found');
            }

            if (phase.status !== 'planned') {
                throw new Error(`Phase ${phase.name} は開始できません（現在: ${phase.status}）`);
            }

            // 他のアクティブPhaseをチェック
            const activePhases = await Phase.findAll({ status: 'active' });
            if (activePhases.length > 0) {
                throw new Error('既にアクティブなPhaseが存在します');
            }

            // Phase開始
            const updated = await Phase.startPhase(id);

            // 進捗記録初期化
            await Phase.recordProgress(id, {
                progress_percentage: 0,
                tasks_total: phase.total_deliverables || 0,
                tasks_completed: 0,
                tasks_in_progress: 0,
                tasks_blocked: 0,
                notes: 'Phase開始',
                recorded_by: 'system'
            });

            await this.clearPhaseCache();

            return {
                phase: updated,
                message: `Phase ${phase.name} を開始しました`
            };
        } catch (error) {
            throw new Error(`Phase開始エラー: ${error.message}`);
        }
    }

    /**
     * Phase完了
     * @param {number} id - Phase ID
     * @returns {Promise<Object>} 完了結果
     */
    static async completePhase(id) {
        try {
            const phase = await Phase.findById(id);
            if (!phase) {
                throw new Error('Phase not found');
            }

            if (phase.status !== 'active') {
                throw new Error(`Phase ${phase.name} は完了できません（現在: ${phase.status}）`);
            }

            // 完了条件チェック
            const completionCheck = this.checkPhaseCompletion(phase);
            if (!completionCheck.can_complete) {
                throw new Error(`Phase完了条件を満たしていません: ${completionCheck.reasons.join(', ')}`);
            }

            // Phase完了
            const updated = await Phase.completePhase(id);

            // 最終進捗記録
            await Phase.recordProgress(id, {
                progress_percentage: 100,
                tasks_total: phase.total_deliverables || 0,
                tasks_completed: phase.completed_deliverables || 0,
                notes: 'Phase完了',
                recorded_by: 'system'
            });

            await this.clearPhaseCache();

            return {
                phase: updated,
                message: `Phase ${phase.name} が完了しました`,
                completion_report: completionCheck
            };
        } catch (error) {
            throw new Error(`Phase完了エラー: ${error.message}`);
        }
    }

    /**
     * KPI更新
     * @param {number} phaseId - Phase ID
     * @param {string} kpiName - KPI名
     * @param {Object} kpiData - KPIデータ
     * @returns {Promise<Object>} 更新されたKPI
     */
    static async updateKPI(phaseId, kpiName, kpiData) {
        try {
            const phase = await Phase.findById(phaseId);
            if (!phase) {
                throw new Error('Phase not found');
            }

            // KPIステータス自動判定
            if (kpiData.target_value && kpiData.actual_value) {
                kpiData.status = this.calculateKPIStatus(
                    parseFloat(kpiData.target_value),
                    parseFloat(kpiData.actual_value)
                );
            }

            const kpi = await Phase.updateKPI(phaseId, kpiName, kpiData);

            await this.clearPhaseCache(phaseId);

            return kpi;
        } catch (error) {
            throw new Error(`KPI更新エラー: ${error.message}`);
        }
    }

    /**
     * Phaseレポート生成
     * @param {number} id - Phase ID
     * @returns {Promise<Object>} Phaseレポート
     */
    static async generatePhaseReport(id) {
        try {
            const phase = await Phase.findById(id);
            if (!phase) {
                throw new Error('Phase not found');
            }

            // 進捗履歴取得
            const client = await db.getConnection();
            try {
                const progressHistory = await client.query(
                    `SELECT * FROM phase_progress
                     WHERE phase_id = $1
                     ORDER BY recorded_at`,
                    [id]
                );

                // KPI達成率計算
                const kpiAchievement = phase.total_kpis > 0
                    ? (phase.achieved_kpis / phase.total_kpis * 100).toFixed(2)
                    : 0;

                // 成果物完了率
                const deliverableCompletion = phase.total_deliverables > 0
                    ? (phase.completed_deliverables / phase.total_deliverables * 100).toFixed(2)
                    : 0;

                // 期間計算
                const duration = this.calculatePhaseDuration(phase);

                return {
                    phase: {
                        id: phase.id,
                        phase_number: phase.phase_number,
                        name: phase.name,
                        status: phase.status,
                        priority: phase.priority
                    },
                    schedule: {
                        planned_start: phase.planned_start_date,
                        planned_end: phase.planned_end_date,
                        actual_start: phase.actual_start_date,
                        actual_end: phase.actual_end_date,
                        duration_days: duration.days,
                        is_delayed: duration.is_delayed
                    },
                    kpis: {
                        total: phase.total_kpis,
                        achieved: phase.achieved_kpis,
                        achievement_rate: kpiAchievement,
                        details: phase.kpis || []
                    },
                    deliverables: {
                        total: phase.total_deliverables,
                        completed: phase.completed_deliverables,
                        completion_rate: deliverableCompletion,
                        details: phase.deliverables || []
                    },
                    progress: {
                        current: phase.progress || {},
                        history: progressHistory.rows
                    },
                    summary: {
                        overall_health: this.calculatePhaseHealth(phase),
                        recommendations: this.generateRecommendations(phase)
                    },
                    generated_at: new Date()
                };
            } finally {
                client.release();
            }
        } catch (error) {
            throw new Error(`レポート生成エラー: ${error.message}`);
        }
    }

    /**
     * 進捗更新
     * @param {number} phaseId - Phase ID
     * @param {Object} progressData - 進捗データ
     * @returns {Promise<Object>} 記録された進捗
     */
    static async updateProgress(phaseId, progressData) {
        try {
            const phase = await Phase.findById(phaseId);
            if (!phase) {
                throw new Error('Phase not found');
            }

            // 進捗率自動計算（指定されていない場合）
            if (!progressData.progress_percentage && progressData.tasks_total && progressData.tasks_completed) {
                progressData.progress_percentage = (
                    (progressData.tasks_completed / progressData.tasks_total) * 100
                ).toFixed(2);
            }

            const progress = await Phase.recordProgress(phaseId, progressData);

            await this.clearPhaseCache(phaseId);

            return progress;
        } catch (error) {
            throw new Error(`進捗更新エラー: ${error.message}`);
        }
    }

    /**
     * 全体進捗取得
     * @returns {Promise<Object>} プロジェクト全体進捗
     */
    static async getOverallProgress() {
        try {
            const cacheKey = 'phases:overall_progress';
            const cached = await db.cacheGet(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            const phases = await Phase.findAll({ includeDeliverables: true });

            const totalDeliverables = phases.reduce((sum, p) => sum + (p.total_deliverables || 0), 0);
            const completedDeliverables = phases.reduce((sum, p) => sum + (p.completed_deliverables || 0), 0);

            const completedPhases = phases.filter(p => p.status === 'completed').length;
            const activePhases = phases.filter(p => p.status === 'active').length;
            const plannedPhases = phases.filter(p => p.status === 'planned').length;

            const overallProgress = {
                total_phases: phases.length,
                completed_phases: completedPhases,
                active_phases: activePhases,
                planned_phases: plannedPhases,
                phase_completion_rate: ((completedPhases / phases.length) * 100).toFixed(2),
                total_deliverables: totalDeliverables,
                completed_deliverables: completedDeliverables,
                deliverable_completion_rate: totalDeliverables > 0
                    ? ((completedDeliverables / totalDeliverables) * 100).toFixed(2)
                    : 0,
                phases: phases.map(p => ({
                    id: p.id,
                    phase_number: p.phase_number,
                    name: p.name,
                    status: p.status,
                    completion_rate: p.total_deliverables > 0
                        ? ((p.completed_deliverables / p.total_deliverables) * 100).toFixed(2)
                        : 0
                })),
                updated_at: new Date()
            };

            await db.cacheSet(cacheKey, JSON.stringify(overallProgress), 300);

            return overallProgress;
        } catch (error) {
            throw new Error(`全体進捗取得エラー: ${error.message}`);
        }
    }

    /**
     * Phase移行チェック
     * @param {number} fromPhaseId - 移行元Phase ID
     * @param {number} toPhaseId - 移行先Phase ID
     * @returns {Promise<Object>} チェック結果
     */
    static async checkTransition(fromPhaseId, toPhaseId) {
        try {
            const result = await Phase.checkTransitionReadiness(fromPhaseId, toPhaseId);
            return result;
        } catch (error) {
            throw new Error(`移行チェックエラー: ${error.message}`);
        }
    }

    /**
     * Phase移行実行
     * @param {number} fromPhaseId - 移行元Phase ID
     * @param {number} toPhaseId - 移行先Phase ID
     * @param {Object} transitionData - 移行データ
     * @returns {Promise<Object>} 移行結果
     */
    static async executeTransition(fromPhaseId, toPhaseId, transitionData = {}) {
        try {
            const result = await Phase.executeTransition(fromPhaseId, toPhaseId, transitionData);

            await this.clearPhaseCache();

            return result;
        } catch (error) {
            throw new Error(`Phase移行エラー: ${error.message}`);
        }
    }

    /**
     * 移行履歴取得
     * @param {number} limit - 取得件数
     * @returns {Promise<Array>} 移行履歴
     */
    static async getTransitionHistory(limit = 10) {
        try {
            return await Phase.getTransitionHistory(limit);
        } catch (error) {
            throw new Error(`移行履歴取得エラー: ${error.message}`);
        }
    }

    // ===================================
    // ヘルパーメソッド
    // ===================================

    /**
     * Phaseデータバリデーション
     * @param {Object} phaseData - Phaseデータ
     * @throws {Error} バリデーションエラー
     */
    static validatePhaseData(phaseData) {
        if (!phaseData.phase_number || phaseData.phase_number < 1) {
            throw new Error('Phase番号は1以上の整数が必要です');
        }

        if (!phaseData.name || phaseData.name.trim().length === 0) {
            throw new Error('Phase名は必須です');
        }

        const validStatuses = ['planned', 'active', 'completed', 'cancelled'];
        if (phaseData.status && !validStatuses.includes(phaseData.status)) {
            throw new Error(`無効なステータス: ${phaseData.status}`);
        }
    }

    /**
     * ステータス遷移バリデーション
     * @param {string} currentStatus - 現在のステータス
     * @param {string} newStatus - 新しいステータス
     * @throws {Error} 無効な遷移
     */
    static validateStatusTransition(currentStatus, newStatus) {
        const validTransitions = {
            planned: ['active', 'cancelled'],
            active: ['completed', 'cancelled'],
            completed: [], // 完了後は変更不可
            cancelled: ['planned'] // キャンセル後は計画に戻せる
        };

        if (!validTransitions[currentStatus]?.includes(newStatus)) {
            throw new Error(`無効なステータス遷移: ${currentStatus} → ${newStatus}`);
        }
    }

    /**
     * Phase完了条件チェック
     * @param {Object} phase - Phase情報
     * @returns {Object} チェック結果
     */
    static checkPhaseCompletion(phase) {
        const reasons = [];

        if (phase.total_deliverables > 0 && phase.completed_deliverables < phase.total_deliverables) {
            reasons.push('全成果物が完了していません');
        }

        if (phase.total_kpis > 0 && phase.achieved_kpis < phase.total_kpis * 0.8) {
            reasons.push('KPI達成率が80%未満です');
        }

        return {
            can_complete: reasons.length === 0,
            reasons,
            deliverables: {
                completed: phase.completed_deliverables,
                total: phase.total_deliverables
            },
            kpis: {
                achieved: phase.achieved_kpis,
                total: phase.total_kpis
            }
        };
    }

    /**
     * KPIステータス計算
     * @param {number} target - 目標値
     * @param {number} actual - 実績値
     * @returns {string} ステータス
     */
    static calculateKPIStatus(target, actual) {
        const ratio = actual / target;
        if (ratio >= 1.0) return 'achieved';
        if (ratio >= 0.8) return 'on_track';
        if (ratio >= 0.5) return 'at_risk';
        return 'failed';
    }

    /**
     * Phase期間計算
     * @param {Object} phase - Phase情報
     * @returns {Object} 期間情報
     */
    static calculatePhaseDuration(phase) {
        const start = phase.actual_start_date || phase.planned_start_date;
        const end = phase.actual_end_date || phase.planned_end_date;

        if (!start || !end) {
            return { days: null, is_delayed: false };
        }

        const startDate = new Date(start);
        const endDate = new Date(end);
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

        const plannedEnd = new Date(phase.planned_end_date);
        const is_delayed = phase.actual_end_date && new Date(phase.actual_end_date) > plannedEnd;

        return { days, is_delayed };
    }

    /**
     * Phase健全性スコア計算
     * @param {Object} phase - Phase情報
     * @returns {string} 健全性スコア
     */
    static calculatePhaseHealth(phase) {
        let score = 100;

        // 成果物完了率
        if (phase.total_deliverables > 0) {
            const deliverableRate = phase.completed_deliverables / phase.total_deliverables;
            if (deliverableRate < 0.5) score -= 30;
            else if (deliverableRate < 0.8) score -= 15;
        }

        // KPI達成率
        if (phase.total_kpis > 0) {
            const kpiRate = phase.achieved_kpis / phase.total_kpis;
            if (kpiRate < 0.5) score -= 30;
            else if (kpiRate < 0.8) score -= 15;
        }

        // スケジュール遅延
        const duration = this.calculatePhaseDuration(phase);
        if (duration.is_delayed) score -= 20;

        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'fair';
        return 'poor';
    }

    /**
     * 推奨事項生成
     * @param {Object} phase - Phase情報
     * @returns {Array<string>} 推奨事項
     */
    static generateRecommendations(phase) {
        const recommendations = [];

        if (phase.total_deliverables > 0) {
            const rate = phase.completed_deliverables / phase.total_deliverables;
            if (rate < 0.5) {
                recommendations.push('成果物の完了率が低いです。優先度の見直しを検討してください');
            }
        }

        if (phase.total_kpis > 0) {
            const rate = phase.achieved_kpis / phase.total_kpis;
            if (rate < 0.8) {
                recommendations.push('KPI達成率を向上させる施策が必要です');
            }
        }

        const duration = this.calculatePhaseDuration(phase);
        if (duration.is_delayed) {
            recommendations.push('スケジュールが遅延しています。リソース追加を検討してください');
        }

        if (recommendations.length === 0) {
            recommendations.push('現在のペースで進行中です。引き続き品質維持に注力してください');
        }

        return recommendations;
    }

    /**
     * キャッシュクリア
     * @param {number} phaseId - Phase ID（指定時は該当Phaseのみ）
     */
    static async clearPhaseCache(phaseId = null) {
        try {
            if (phaseId) {
                await db.cacheDel(`phases:${phaseId}`);
            }
            await db.cacheDel('phases:current');
            await db.cacheDel('phases:overall_progress');

            // ワイルドカードキャッシュクリア（all系）
            // Redis の場合は KEYS コマンドで取得してまとめて削除
        } catch (error) {
            console.error('キャッシュクリアエラー:', error.message);
        }
    }
}

module.exports = PhaseService;
