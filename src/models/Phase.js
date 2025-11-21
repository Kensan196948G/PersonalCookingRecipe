/**
 * Phase Model - Phase 1-N対応の汎用的なモデル
 * PostgreSQL + Sequelize ORM
 *
 * 機能:
 * - Phase情報管理（CRUD）
 * - KPI管理
 * - 成果物管理
 * - 進捗トラッキング
 * - Phase移行管理
 */

const { Pool } = require('pg');
const db = require('../config/database-postgresql');

class Phase {
    /**
     * 全Phase一覧取得
     * @param {Object} options - フィルタオプション
     * @returns {Promise<Array>} Phase一覧
     */
    static async findAll(options = {}) {
        const client = await db.getConnection();
        try {
            const { status, includeKPIs = false, includeDeliverables = false } = options;

            let query = `
                SELECT p.*,
                    COUNT(DISTINCT pk.id) as total_kpis,
                    COUNT(DISTINCT CASE WHEN pk.status = 'achieved' THEN pk.id END) as achieved_kpis,
                    COUNT(DISTINCT pd.id) as total_deliverables,
                    COUNT(DISTINCT CASE WHEN pd.status = 'completed' THEN pd.id END) as completed_deliverables
                FROM phases p
                LEFT JOIN phase_kpis pk ON p.id = pk.phase_id
                LEFT JOIN phase_deliverables pd ON p.id = pd.phase_id
            `;

            const params = [];
            if (status) {
                query += ' WHERE p.status = $1';
                params.push(status);
            }

            query += ' GROUP BY p.id ORDER BY p.phase_number ASC';

            const result = await client.query(query, params);

            // KPIs と Deliverables を含める場合
            if (includeKPIs || includeDeliverables) {
                for (const phase of result.rows) {
                    if (includeKPIs) {
                        phase.kpis = await this.getKPIs(phase.id);
                    }
                    if (includeDeliverables) {
                        phase.deliverables = await this.getDeliverables(phase.id);
                    }
                }
            }

            return result.rows;
        } finally {
            client.release();
        }
    }

    /**
     * Phase ID で検索
     * @param {number} id - Phase ID
     * @returns {Promise<Object>} Phase情報
     */
    static async findById(id) {
        const client = await db.getConnection();
        try {
            const query = `
                SELECT p.*,
                    COUNT(DISTINCT pk.id) as total_kpis,
                    COUNT(DISTINCT CASE WHEN pk.status = 'achieved' THEN pk.id END) as achieved_kpis,
                    COUNT(DISTINCT pd.id) as total_deliverables,
                    COUNT(DISTINCT CASE WHEN pd.status = 'completed' THEN pd.id END) as completed_deliverables
                FROM phases p
                LEFT JOIN phase_kpis pk ON p.id = pk.phase_id
                LEFT JOIN phase_deliverables pd ON p.id = pd.phase_id
                WHERE p.id = $1
                GROUP BY p.id
            `;

            const result = await client.query(query, [id]);
            if (result.rows.length === 0) {
                return null;
            }

            const phase = result.rows[0];

            // 関連データ取得
            phase.kpis = await this.getKPIs(id);
            phase.deliverables = await this.getDeliverables(id);
            phase.progress = await this.getLatestProgress(id);

            return phase;
        } finally {
            client.release();
        }
    }

    /**
     * Phase番号で検索
     * @param {number} phaseNumber - Phase番号
     * @returns {Promise<Object>} Phase情報
     */
    static async findByPhaseNumber(phaseNumber) {
        const client = await db.getConnection();
        try {
            const result = await client.query(
                'SELECT * FROM phases WHERE phase_number = $1',
                [phaseNumber]
            );
            return result.rows.length > 0 ? result.rows[0] : null;
        } finally {
            client.release();
        }
    }

    /**
     * 現在アクティブなPhase取得
     * @returns {Promise<Object>} アクティブなPhase
     */
    static async getCurrentPhase() {
        const client = await db.getConnection();
        try {
            const result = await client.query('SELECT * FROM v_current_phase LIMIT 1');
            if (result.rows.length === 0) {
                return null;
            }

            const phase = result.rows[0];
            phase.kpis = await this.getKPIs(phase.id);
            phase.deliverables = await this.getDeliverables(phase.id);
            phase.progress = await this.getLatestProgress(phase.id);

            return phase;
        } finally {
            client.release();
        }
    }

    /**
     * 新規Phase作成
     * @param {Object} phaseData - Phase情報
     * @returns {Promise<Object>} 作成されたPhase
     */
    static async create(phaseData) {
        const client = await db.getConnection();
        try {
            await client.query('BEGIN');

            const query = `
                INSERT INTO phases (
                    phase_number, name, description, status, priority,
                    planned_start_date, planned_end_date, config, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;

            const values = [
                phaseData.phase_number,
                phaseData.name,
                phaseData.description || null,
                phaseData.status || 'planned',
                phaseData.priority || 1,
                phaseData.planned_start_date || null,
                phaseData.planned_end_date || null,
                JSON.stringify(phaseData.config || {}),
                phaseData.created_by || 'system'
            ];

            const result = await client.query(query, values);
            await client.query('COMMIT');

            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Phase更新
     * @param {number} id - Phase ID
     * @param {Object} updateData - 更新データ
     * @returns {Promise<Object>} 更新されたPhase
     */
    static async update(id, updateData) {
        const client = await db.getConnection();
        try {
            await client.query('BEGIN');

            const fields = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = [
                'name', 'description', 'status', 'priority',
                'planned_start_date', 'planned_end_date',
                'actual_start_date', 'actual_end_date',
                'config', 'updated_by'
            ];

            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    fields.push(`${field} = $${paramIndex}`);
                    values.push(
                        field === 'config' ? JSON.stringify(updateData[field]) : updateData[field]
                    );
                    paramIndex++;
                }
            }

            if (fields.length === 0) {
                throw new Error('更新するフィールドがありません');
            }

            values.push(id);
            const query = `
                UPDATE phases
                SET ${fields.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `;

            const result = await client.query(query, values);
            await client.query('COMMIT');

            if (result.rows.length === 0) {
                throw new Error('Phase not found');
            }

            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Phase開始
     * @param {number} id - Phase ID
     * @returns {Promise<Object>} 更新されたPhase
     */
    static async startPhase(id) {
        return await this.update(id, {
            status: 'active',
            actual_start_date: new Date()
        });
    }

    /**
     * Phase完了
     * @param {number} id - Phase ID
     * @returns {Promise<Object>} 更新されたPhase
     */
    static async completePhase(id) {
        return await this.update(id, {
            status: 'completed',
            actual_end_date: new Date()
        });
    }

    /**
     * Phase KPI取得
     * @param {number} phaseId - Phase ID
     * @returns {Promise<Array>} KPI一覧
     */
    static async getKPIs(phaseId) {
        const client = await db.getConnection();
        try {
            const result = await client.query(
                'SELECT * FROM phase_kpis WHERE phase_id = $1 ORDER BY id',
                [phaseId]
            );
            return result.rows;
        } finally {
            client.release();
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
        const client = await db.getConnection();
        try {
            await client.query('BEGIN');

            const query = `
                INSERT INTO phase_kpis (
                    phase_id, kpi_name, kpi_category, description,
                    target_value, actual_value, unit, status, measured_at, measurement_data
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (phase_id, kpi_name)
                DO UPDATE SET
                    actual_value = EXCLUDED.actual_value,
                    status = EXCLUDED.status,
                    measured_at = EXCLUDED.measured_at,
                    measurement_data = EXCLUDED.measurement_data,
                    updated_at = NOW()
                RETURNING *
            `;

            const values = [
                phaseId,
                kpiName,
                kpiData.kpi_category || null,
                kpiData.description || null,
                kpiData.target_value || null,
                kpiData.actual_value || null,
                kpiData.unit || null,
                kpiData.status || 'pending',
                kpiData.measured_at || new Date(),
                JSON.stringify(kpiData.measurement_data || {})
            ];

            const result = await client.query(query, values);
            await client.query('COMMIT');

            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Phase成果物取得
     * @param {number} phaseId - Phase ID
     * @returns {Promise<Array>} 成果物一覧
     */
    static async getDeliverables(phaseId) {
        const client = await db.getConnection();
        try {
            const result = await client.query(
                `SELECT * FROM phase_deliverables
                 WHERE phase_id = $1
                 ORDER BY priority DESC, created_at`,
                [phaseId]
            );
            return result.rows;
        } finally {
            client.release();
        }
    }

    /**
     * 進捗記録
     * @param {number} phaseId - Phase ID
     * @param {Object} progressData - 進捗データ
     * @returns {Promise<Object>} 記録された進捗
     */
    static async recordProgress(phaseId, progressData) {
        const client = await db.getConnection();
        try {
            const query = `
                INSERT INTO phase_progress (
                    phase_id, progress_percentage,
                    tasks_total, tasks_completed, tasks_in_progress, tasks_blocked,
                    estimated_hours, actual_hours, notes, snapshot_data, recorded_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `;

            const values = [
                phaseId,
                progressData.progress_percentage || 0,
                progressData.tasks_total || 0,
                progressData.tasks_completed || 0,
                progressData.tasks_in_progress || 0,
                progressData.tasks_blocked || 0,
                progressData.estimated_hours || null,
                progressData.actual_hours || null,
                progressData.notes || null,
                JSON.stringify(progressData.snapshot_data || {}),
                progressData.recorded_by || 'system'
            ];

            const result = await client.query(query, values);
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    /**
     * 最新進捗取得
     * @param {number} phaseId - Phase ID
     * @returns {Promise<Object>} 最新進捗
     */
    static async getLatestProgress(phaseId) {
        const client = await db.getConnection();
        try {
            const result = await client.query(
                `SELECT * FROM phase_progress
                 WHERE phase_id = $1
                 ORDER BY recorded_at DESC
                 LIMIT 1`,
                [phaseId]
            );
            return result.rows.length > 0 ? result.rows[0] : null;
        } finally {
            client.release();
        }
    }

    /**
     * Phase移行チェック
     * @param {number} fromPhaseId - 移行元Phase ID
     * @param {number} toPhaseId - 移行先Phase ID
     * @returns {Promise<Object>} 移行可能性チェック結果
     */
    static async checkTransitionReadiness(fromPhaseId, toPhaseId) {
        const client = await db.getConnection();
        try {
            const fromPhase = await this.findById(fromPhaseId);
            const toPhase = await this.findById(toPhaseId);

            if (!fromPhase || !toPhase) {
                throw new Error('Phase not found');
            }

            const checks = {
                phase_completed: fromPhase.status === 'completed',
                all_deliverables_done: fromPhase.completed_deliverables === fromPhase.total_deliverables,
                kpis_achieved: fromPhase.achieved_kpis >= fromPhase.total_kpis * 0.8, // 80%以上達成
                next_phase_ready: toPhase.status === 'planned',
                can_transition: false
            };

            checks.can_transition = checks.phase_completed &&
                                   checks.all_deliverables_done &&
                                   checks.kpis_achieved &&
                                   checks.next_phase_ready;

            return checks;
        } finally {
            client.release();
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
        const client = await db.getConnection();
        try {
            await client.query('BEGIN');

            // 移行可能性チェック
            const readinessCheck = await this.checkTransitionReadiness(fromPhaseId, toPhaseId);

            // 移行記録作成
            const transitionQuery = `
                INSERT INTO phase_transitions (
                    from_phase_id, to_phase_id, status, readiness_check,
                    approved_by, approved_at, started_at, notes, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;

            const transitionValues = [
                fromPhaseId,
                toPhaseId,
                readinessCheck.can_transition ? 'approved' : 'pending',
                JSON.stringify(readinessCheck),
                transitionData.approved_by || null,
                transitionData.approved_at || null,
                readinessCheck.can_transition ? new Date() : null,
                transitionData.notes || null,
                transitionData.created_by || 'system'
            ];

            const transitionResult = await client.query(transitionQuery, transitionValues);

            // 移行可能な場合は Phase を開始
            if (readinessCheck.can_transition) {
                await client.query(
                    'UPDATE phases SET status = $1, actual_start_date = $2 WHERE id = $3',
                    ['active', new Date(), toPhaseId]
                );

                await client.query(
                    'UPDATE phase_transitions SET status = $1, completed_at = $2 WHERE id = $3',
                    ['completed', new Date(), transitionResult.rows[0].id]
                );
            }

            await client.query('COMMIT');

            return {
                transition: transitionResult.rows[0],
                readiness_check: readinessCheck,
                success: readinessCheck.can_transition
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 移行履歴取得
     * @param {number} limit - 取得件数
     * @returns {Promise<Array>} 移行履歴
     */
    static async getTransitionHistory(limit = 10) {
        const client = await db.getConnection();
        try {
            const query = `
                SELECT
                    pt.*,
                    p1.name as from_phase_name,
                    p2.name as to_phase_name
                FROM phase_transitions pt
                LEFT JOIN phases p1 ON pt.from_phase_id = p1.id
                LEFT JOIN phases p2 ON pt.to_phase_id = p2.id
                ORDER BY pt.created_at DESC
                LIMIT $1
            `;

            const result = await client.query(query, [limit]);
            return result.rows;
        } finally {
            client.release();
        }
    }

    /**
     * Phase削除
     * @param {number} id - Phase ID
     * @returns {Promise<boolean>} 削除成功
     */
    static async delete(id) {
        const client = await db.getConnection();
        try {
            await client.query('BEGIN');
            const result = await client.query('DELETE FROM phases WHERE id = $1', [id]);
            await client.query('COMMIT');
            return result.rowCount > 0;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = Phase;
