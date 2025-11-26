/**
 * Phase Controller - Unit Tests
 *
 * テストカバレッジ:
 * - Phase CRUD操作
 * - KPI管理
 * - 進捗管理
 * - Phase移行
 * - レポート生成
 */

const request = require('supertest');
const app = require('../../server');
const Phase = require('../../models/Phase');
const PhaseService = require('../../services/phaseService');

// テスト用データ
const mockPhase = {
    id: 1,
    phase_number: 1,
    name: 'Test Phase',
    description: 'Test phase description',
    status: 'planned',
    priority: 1,
    total_kpis: 3,
    achieved_kpis: 2,
    total_deliverables: 5,
    completed_deliverables: 3,
    kpis: [],
    deliverables: [],
    progress: null
};

describe('Phase Controller Tests', () => {
    // ===================================
    // GET /api/phases - 全Phase一覧
    // ===================================
    describe('GET /api/phases', () => {
        it('should return all phases', async () => {
            jest.spyOn(PhaseService, 'getAllPhases').mockResolvedValue([mockPhase]);

            const res = await request(app)
                .get('/api/phases')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(1);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].name).toBe('Test Phase');
        });

        it('should filter phases by status', async () => {
            const activePhases = [{ ...mockPhase, status: 'active' }];
            jest.spyOn(PhaseService, 'getAllPhases').mockResolvedValue(activePhases);

            const res = await request(app)
                .get('/api/phases?status=active')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data[0].status).toBe('active');
        });

        it('should handle errors gracefully', async () => {
            jest.spyOn(PhaseService, 'getAllPhases').mockRejectedValue(new Error('Database error'));

            const res = await request(app)
                .get('/api/phases')
                .expect(500);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBeTruthy();
        });
    });

    // ===================================
    // GET /api/phases/current - 現在のPhase
    // ===================================
    describe('GET /api/phases/current', () => {
        it('should return current active phase', async () => {
            const activePhase = { ...mockPhase, status: 'active' };
            jest.spyOn(PhaseService, 'getCurrentPhase').mockResolvedValue(activePhase);

            const res = await request(app)
                .get('/api/phases/current')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('active');
        });

        it('should return 404 if no active phase', async () => {
            jest.spyOn(PhaseService, 'getCurrentPhase').mockRejectedValue(
                new Error('アクティブなPhaseが見つかりません')
            );

            const res = await request(app)
                .get('/api/phases/current')
                .expect(404);

            expect(res.body.success).toBe(false);
        });
    });

    // ===================================
    // GET /api/phases/:id - Phase詳細
    // ===================================
    describe('GET /api/phases/:id', () => {
        it('should return phase by id', async () => {
            jest.spyOn(PhaseService, 'getPhaseById').mockResolvedValue(mockPhase);

            const res = await request(app)
                .get('/api/phases/1')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(1);
            expect(res.body.data.name).toBe('Test Phase');
        });

        it('should return 400 for invalid id', async () => {
            const res = await request(app)
                .get('/api/phases/invalid')
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Invalid phase ID');
        });

        it('should return 404 for non-existent phase', async () => {
            jest.spyOn(PhaseService, 'getPhaseById').mockRejectedValue(
                new Error('Phase not found')
            );

            const res = await request(app)
                .get('/api/phases/999')
                .expect(404);

            expect(res.body.success).toBe(false);
        });
    });

    // ===================================
    // POST /api/phases - Phase作成
    // ===================================
    describe('POST /api/phases', () => {
        it('should create new phase', async () => {
            const newPhase = {
                phase_number: 6,
                name: 'Phase 6',
                description: 'New phase',
                status: 'planned'
            };

            jest.spyOn(PhaseService, 'createPhase').mockResolvedValue({
                id: 6,
                ...newPhase
            });

            const res = await request(app)
                .post('/api/phases')
                .send(newPhase)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('created successfully');
            expect(res.body.data.phase_number).toBe(6);
        });

        it('should validate required fields', async () => {
            jest.spyOn(PhaseService, 'createPhase').mockRejectedValue(
                new Error('Phase名は必須です')
            );

            const res = await request(app)
                .post('/api/phases')
                .send({ phase_number: 7 })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('必須');
        });
    });

    // ===================================
    // PUT /api/phases/:id - Phase更新
    // ===================================
    describe('PUT /api/phases/:id', () => {
        it('should update phase', async () => {
            const updatedPhase = { ...mockPhase, name: 'Updated Phase' };
            jest.spyOn(PhaseService, 'updatePhase').mockResolvedValue(updatedPhase);

            const res = await request(app)
                .put('/api/phases/1')
                .send({ name: 'Updated Phase' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('updated successfully');
            expect(res.body.data.name).toBe('Updated Phase');
        });
    });

    // ===================================
    // POST /api/phases/:id/start - Phase開始
    // ===================================
    describe('POST /api/phases/:id/start', () => {
        it('should start phase', async () => {
            jest.spyOn(PhaseService, 'startPhase').mockResolvedValue({
                phase: { ...mockPhase, status: 'active' },
                message: 'Phase Test Phase を開始しました'
            });

            const res = await request(app)
                .post('/api/phases/1/start')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('開始しました');
        });

        it('should not start non-planned phase', async () => {
            jest.spyOn(PhaseService, 'startPhase').mockRejectedValue(
                new Error('Phase は開始できません')
            );

            const res = await request(app)
                .post('/api/phases/1/start')
                .expect(400);

            expect(res.body.success).toBe(false);
        });
    });

    // ===================================
    // POST /api/phases/:id/complete - Phase完了
    // ===================================
    describe('POST /api/phases/:id/complete', () => {
        it('should complete phase', async () => {
            jest.spyOn(PhaseService, 'completePhase').mockResolvedValue({
                phase: { ...mockPhase, status: 'completed' },
                message: 'Phase が完了しました',
                completion_report: { can_complete: true, reasons: [] }
            });

            const res = await request(app)
                .post('/api/phases/1/complete')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('完了しました');
            expect(res.body.completion_report).toBeTruthy();
        });
    });

    // ===================================
    // PUT /api/phases/:id/kpi - KPI更新
    // ===================================
    describe('PUT /api/phases/:id/kpi', () => {
        it('should update KPI', async () => {
            const kpiData = {
                kpi_name: 'API Response Time',
                target_value: '200',
                actual_value: '180',
                unit: 'ms',
                status: 'achieved'
            };

            jest.spyOn(PhaseService, 'updateKPI').mockResolvedValue({
                id: 1,
                phase_id: 1,
                ...kpiData
            });

            const res = await request(app)
                .put('/api/phases/1/kpi')
                .send(kpiData)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('KPI updated');
            expect(res.body.data.kpi_name).toBe('API Response Time');
        });

        it('should require kpi_name', async () => {
            const res = await request(app)
                .put('/api/phases/1/kpi')
                .send({ target_value: '200' })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('KPI name is required');
        });
    });

    // ===================================
    // GET /api/phases/:id/report - レポート生成
    // ===================================
    describe('GET /api/phases/:id/report', () => {
        it('should generate phase report', async () => {
            const mockReport = {
                phase: mockPhase,
                schedule: {},
                kpis: { total: 3, achieved: 2 },
                deliverables: { total: 5, completed: 3 },
                progress: {},
                summary: { overall_health: 'good' }
            };

            jest.spyOn(PhaseService, 'generatePhaseReport').mockResolvedValue(mockReport);

            const res = await request(app)
                .get('/api/phases/1/report')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.summary.overall_health).toBe('good');
        });
    });

    // ===================================
    // GET /api/phases/progress/overall - 全体進捗
    // ===================================
    describe('GET /api/phases/progress/overall', () => {
        it('should return overall progress', async () => {
            const mockProgress = {
                total_phases: 5,
                completed_phases: 2,
                active_phases: 1,
                planned_phases: 2,
                phase_completion_rate: '40.00'
            };

            jest.spyOn(PhaseService, 'getOverallProgress').mockResolvedValue(mockProgress);

            const res = await request(app)
                .get('/api/phases/progress/overall')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.total_phases).toBe(5);
            expect(res.body.data.phase_completion_rate).toBe('40.00');
        });
    });

    // ===================================
    // POST /api/phases/progress/update - 進捗更新
    // ===================================
    describe('POST /api/phases/progress/update', () => {
        it('should update progress', async () => {
            const progressData = {
                phase_id: 1,
                progress_percentage: 75,
                tasks_total: 10,
                tasks_completed: 7,
                notes: 'Progress update'
            };

            jest.spyOn(PhaseService, 'updateProgress').mockResolvedValue({
                id: 1,
                ...progressData,
                recorded_at: new Date()
            });

            const res = await request(app)
                .post('/api/phases/progress/update')
                .send(progressData)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('updated successfully');
        });
    });

    // ===================================
    // POST /api/phases/transition/check - 移行チェック
    // ===================================
    describe('POST /api/phases/transition/check', () => {
        it('should check transition readiness', async () => {
            const checkResult = {
                phase_completed: true,
                all_deliverables_done: true,
                kpis_achieved: true,
                next_phase_ready: true,
                can_transition: true
            };

            jest.spyOn(PhaseService, 'checkTransition').mockResolvedValue(checkResult);

            const res = await request(app)
                .post('/api/phases/transition/check')
                .send({ from_phase_id: 1, to_phase_id: 2 })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.can_transition).toBe(true);
        });
    });

    // ===================================
    // POST /api/phases/transition/execute - 移行実行
    // ===================================
    describe('POST /api/phases/transition/execute', () => {
        it('should execute transition', async () => {
            const transitionResult = {
                transition: { id: 1, status: 'completed' },
                readiness_check: { can_transition: true },
                success: true
            };

            jest.spyOn(PhaseService, 'executeTransition').mockResolvedValue(transitionResult);

            const res = await request(app)
                .post('/api/phases/transition/execute')
                .send({ from_phase_id: 1, to_phase_id: 2, notes: 'Transition' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('executed successfully');
        });
    });

    // ===================================
    // GET /api/phases/transition/history - 移行履歴
    // ===================================
    describe('GET /api/phases/transition/history', () => {
        it('should return transition history', async () => {
            const mockHistory = [
                { id: 1, from_phase_id: 1, to_phase_id: 2, status: 'completed' },
                { id: 2, from_phase_id: 2, to_phase_id: 3, status: 'pending' }
            ];

            jest.spyOn(PhaseService, 'getTransitionHistory').mockResolvedValue(mockHistory);

            const res = await request(app)
                .get('/api/phases/transition/history')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(2);
            expect(res.body.data).toHaveLength(2);
        });
    });

    // ===================================
    // GET /api/phases/health - ヘルスチェック
    // ===================================
    describe('GET /api/phases/health', () => {
        it('should return system health', async () => {
            jest.spyOn(PhaseService, 'getCurrentPhase').mockResolvedValue(mockPhase);
            jest.spyOn(PhaseService, 'getAllPhases').mockResolvedValue([mockPhase]);

            const res = await request(app)
                .get('/api/phases/health')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.status).toBe('healthy');
            expect(res.body.data.system_status).toBe('operational');
        });
    });
});

// テスト後のクリーンアップ
afterAll(() => {
    jest.restoreAllMocks();
});
