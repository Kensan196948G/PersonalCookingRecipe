/**
 * Phase Controller - RESTful API エンドポイント
 *
 * 機能:
 * - Phase管理 (CRUD)
 * - 進捗管理
 * - KPI管理
 * - Phase移行
 * - レポート生成
 */

const PhaseService = require('../services/phaseService');

class PhaseController {
    /**
     * GET /api/phases
     * 全Phase一覧取得
     */
    static async getAllPhases(req, res) {
        try {
            const options = {
                status: req.query.status,
                includeKPIs: req.query.include_kpis === 'true',
                includeDeliverables: req.query.include_deliverables === 'true'
            };

            const phases = await PhaseService.getAllPhases(options);

            res.json({
                success: true,
                count: phases.length,
                data: phases
            });
        } catch (error) {
            console.error('Phase一覧取得エラー:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * GET /api/phases/current
     * 現在のPhase取得
     */
    static async getCurrentPhase(req, res) {
        try {
            const phase = await PhaseService.getCurrentPhase();

            res.json({
                success: true,
                data: phase
            });
        } catch (error) {
            console.error('現在のPhase取得エラー:', error);
            res.status(404).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * GET /api/phases/:id
     * Phase詳細取得
     */
    static async getPhaseById(req, res) {
        try {
            const { id } = req.params;

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid phase ID'
                });
            }

            const phase = await PhaseService.getPhaseById(parseInt(id));

            res.json({
                success: true,
                data: phase
            });
        } catch (error) {
            console.error('Phase詳細取得エラー:', error);
            res.status(404).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * POST /api/phases
     * 新規Phase作成
     */
    static async createPhase(req, res) {
        try {
            const phaseData = {
                phase_number: req.body.phase_number,
                name: req.body.name,
                description: req.body.description,
                status: req.body.status || 'planned',
                priority: req.body.priority || 1,
                planned_start_date: req.body.planned_start_date,
                planned_end_date: req.body.planned_end_date,
                config: req.body.config || {},
                created_by: req.user?.username || 'api'
            };

            const phase = await PhaseService.createPhase(phaseData);

            res.status(201).json({
                success: true,
                message: 'Phase created successfully',
                data: phase
            });
        } catch (error) {
            console.error('Phase作成エラー:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * PUT /api/phases/:id
     * Phase更新
     */
    static async updatePhase(req, res) {
        try {
            const { id } = req.params;

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid phase ID'
                });
            }

            const updateData = {
                ...req.body,
                updated_by: req.user?.username || 'api'
            };

            const phase = await PhaseService.updatePhase(parseInt(id), updateData);

            res.json({
                success: true,
                message: 'Phase updated successfully',
                data: phase
            });
        } catch (error) {
            console.error('Phase更新エラー:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * POST /api/phases/:id/start
     * Phase開始
     */
    static async startPhase(req, res) {
        try {
            const { id } = req.params;

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid phase ID'
                });
            }

            const result = await PhaseService.startPhase(parseInt(id));

            res.json({
                success: true,
                message: result.message,
                data: result.phase
            });
        } catch (error) {
            console.error('Phase開始エラー:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * POST /api/phases/:id/complete
     * Phase完了
     */
    static async completePhase(req, res) {
        try {
            const { id } = req.params;

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid phase ID'
                });
            }

            const result = await PhaseService.completePhase(parseInt(id));

            res.json({
                success: true,
                message: result.message,
                data: result.phase,
                completion_report: result.completion_report
            });
        } catch (error) {
            console.error('Phase完了エラー:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * PUT /api/phases/:id/kpi
     * KPI更新
     */
    static async updateKPI(req, res) {
        try {
            const { id } = req.params;

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid phase ID'
                });
            }

            const { kpi_name, ...kpiData } = req.body;

            if (!kpi_name) {
                return res.status(400).json({
                    success: false,
                    error: 'KPI name is required'
                });
            }

            const kpi = await PhaseService.updateKPI(parseInt(id), kpi_name, kpiData);

            res.json({
                success: true,
                message: 'KPI updated successfully',
                data: kpi
            });
        } catch (error) {
            console.error('KPI更新エラー:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * GET /api/phases/:id/report
     * Phaseレポート生成
     */
    static async generateReport(req, res) {
        try {
            const { id } = req.params;

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid phase ID'
                });
            }

            const report = await PhaseService.generatePhaseReport(parseInt(id));

            // レポート形式指定（JSON / PDF / CSV など）
            const format = req.query.format || 'json';

            if (format === 'json') {
                res.json({
                    success: true,
                    data: report
                });
            } else {
                // 他のフォーマットは今後実装
                res.status(400).json({
                    success: false,
                    error: `Format '${format}' not supported yet`
                });
            }
        } catch (error) {
            console.error('レポート生成エラー:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // ===================================
    // 進捗管理エンドポイント
    // ===================================

    /**
     * GET /api/progress
     * 全体進捗取得
     */
    static async getOverallProgress(req, res) {
        try {
            const progress = await PhaseService.getOverallProgress();

            res.json({
                success: true,
                data: progress
            });
        } catch (error) {
            console.error('全体進捗取得エラー:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * GET /api/progress/:phaseId
     * Phase進捗取得
     */
    static async getPhaseProgress(req, res) {
        try {
            const { phaseId } = req.params;

            if (!phaseId || isNaN(parseInt(phaseId))) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid phase ID'
                });
            }

            const phase = await PhaseService.getPhaseById(parseInt(phaseId));

            res.json({
                success: true,
                data: {
                    phase_id: phase.id,
                    phase_name: phase.name,
                    current_progress: phase.progress,
                    deliverables: {
                        total: phase.total_deliverables,
                        completed: phase.completed_deliverables,
                        completion_rate: phase.total_deliverables > 0
                            ? ((phase.completed_deliverables / phase.total_deliverables) * 100).toFixed(2)
                            : 0
                    },
                    kpis: {
                        total: phase.total_kpis,
                        achieved: phase.achieved_kpis
                    }
                }
            });
        } catch (error) {
            console.error('Phase進捗取得エラー:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * POST /api/progress/update
     * 進捗更新
     */
    static async updateProgress(req, res) {
        try {
            const { phase_id, ...progressData } = req.body;

            if (!phase_id || isNaN(parseInt(phase_id))) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid phase_id is required'
                });
            }

            progressData.recorded_by = req.user?.username || 'api';

            const progress = await PhaseService.updateProgress(parseInt(phase_id), progressData);

            res.json({
                success: true,
                message: 'Progress updated successfully',
                data: progress
            });
        } catch (error) {
            console.error('進捗更新エラー:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    // ===================================
    // Phase移行エンドポイント
    // ===================================

    /**
     * POST /api/transition/check
     * Phase移行チェック
     */
    static async checkTransition(req, res) {
        try {
            const { from_phase_id, to_phase_id } = req.body;

            if (!from_phase_id || !to_phase_id) {
                return res.status(400).json({
                    success: false,
                    error: 'from_phase_id and to_phase_id are required'
                });
            }

            const result = await PhaseService.checkTransition(
                parseInt(from_phase_id),
                parseInt(to_phase_id)
            );

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('移行チェックエラー:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * POST /api/transition/execute
     * Phase移行実行
     */
    static async executeTransition(req, res) {
        try {
            const { from_phase_id, to_phase_id, notes } = req.body;

            if (!from_phase_id || !to_phase_id) {
                return res.status(400).json({
                    success: false,
                    error: 'from_phase_id and to_phase_id are required'
                });
            }

            const transitionData = {
                notes,
                approved_by: req.user?.username || 'api',
                approved_at: new Date(),
                created_by: req.user?.username || 'api'
            };

            const result = await PhaseService.executeTransition(
                parseInt(from_phase_id),
                parseInt(to_phase_id),
                transitionData
            );

            res.json({
                success: result.success,
                message: result.success
                    ? 'Phase transition executed successfully'
                    : 'Phase transition requirements not met',
                data: result
            });
        } catch (error) {
            console.error('Phase移行エラー:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * GET /api/transition/history
     * Phase移行履歴
     */
    static async getTransitionHistory(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;

            const history = await PhaseService.getTransitionHistory(limit);

            res.json({
                success: true,
                count: history.length,
                data: history
            });
        } catch (error) {
            console.error('移行履歴取得エラー:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // ===================================
    // ヘルスチェック
    // ===================================

    /**
     * GET /api/phases/health
     * Phase管理システムヘルスチェック
     */
    static async healthCheck(req, res) {
        try {
            const currentPhase = await PhaseService.getCurrentPhase().catch(() => null);
            const allPhases = await PhaseService.getAllPhases();

            res.json({
                success: true,
                status: 'healthy',
                data: {
                    total_phases: allPhases.length,
                    current_phase: currentPhase ? {
                        id: currentPhase.id,
                        name: currentPhase.name,
                        status: currentPhase.status
                    } : null,
                    system_status: 'operational',
                    timestamp: new Date()
                }
            });
        } catch (error) {
            console.error('ヘルスチェックエラー:', error);
            res.status(503).json({
                success: false,
                status: 'unhealthy',
                error: error.message
            });
        }
    }
}

module.exports = PhaseController;
