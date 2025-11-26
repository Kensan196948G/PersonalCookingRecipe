-- Phase Management System - Database Schema Migration
-- Phase 1-N 対応の汎用的なテーブル設計
-- 作成日: 2025-11-21

-- ===================================
-- 1. Phases テーブル
-- ===================================
CREATE TABLE IF NOT EXISTS phases (
    id SERIAL PRIMARY KEY,
    phase_number INTEGER NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
    priority INTEGER DEFAULT 1,

    -- 日程管理
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,

    -- Phase設定 (JSONB形式で柔軟に拡張可能)
    config JSONB DEFAULT '{}'::jsonb,

    -- メタデータ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- Phaseインデックス（パフォーマンス最適化）
CREATE INDEX IF NOT EXISTS idx_phases_status ON phases(status);
CREATE INDEX IF NOT EXISTS idx_phases_phase_number ON phases(phase_number);
CREATE INDEX IF NOT EXISTS idx_phases_dates ON phases(planned_start_date, planned_end_date);

-- ===================================
-- 2. Phase KPIs テーブル
-- ===================================
CREATE TABLE IF NOT EXISTS phase_kpis (
    id SERIAL PRIMARY KEY,
    phase_id INTEGER NOT NULL REFERENCES phases(id) ON DELETE CASCADE,

    -- KPI情報
    kpi_name VARCHAR(100) NOT NULL,
    kpi_category VARCHAR(50), -- 'performance', 'quality', 'cost', 'schedule'
    description TEXT,

    -- 目標値・実績値
    target_value VARCHAR(100),
    actual_value VARCHAR(100),
    unit VARCHAR(50), -- '%', 'ms', 'count', etc.

    -- ステータス
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'on_track', 'at_risk', 'achieved', 'failed')),

    -- 測定データ
    measured_at TIMESTAMP WITH TIME ZONE,
    measurement_data JSONB DEFAULT '{}'::jsonb,

    -- メタデータ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(phase_id, kpi_name)
);

-- KPIインデックス
CREATE INDEX IF NOT EXISTS idx_phase_kpis_phase_id ON phase_kpis(phase_id);
CREATE INDEX IF NOT EXISTS idx_phase_kpis_status ON phase_kpis(status);
CREATE INDEX IF NOT EXISTS idx_phase_kpis_category ON phase_kpis(kpi_category);

-- ===================================
-- 3. Phase Deliverables テーブル
-- ===================================
CREATE TABLE IF NOT EXISTS phase_deliverables (
    id SERIAL PRIMARY KEY,
    phase_id INTEGER NOT NULL REFERENCES phases(id) ON DELETE CASCADE,

    -- 成果物情報
    title VARCHAR(200) NOT NULL,
    description TEXT,
    deliverable_type VARCHAR(50), -- 'document', 'code', 'api', 'database', etc.

    -- ステータス
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'cancelled')),

    -- 優先度・期限
    priority INTEGER DEFAULT 1,
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- ファイル情報
    file_path VARCHAR(500),
    file_url VARCHAR(1000),

    -- 詳細データ（柔軟に拡張可能）
    metadata JSONB DEFAULT '{}'::jsonb,

    -- メタデータ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_to VARCHAR(100),
    completed_by VARCHAR(100)
);

-- Deliverablesインデックス
CREATE INDEX IF NOT EXISTS idx_phase_deliverables_phase_id ON phase_deliverables(phase_id);
CREATE INDEX IF NOT EXISTS idx_phase_deliverables_status ON phase_deliverables(status);
CREATE INDEX IF NOT EXISTS idx_phase_deliverables_type ON phase_deliverables(deliverable_type);

-- ===================================
-- 4. Phase Transitions テーブル（移行履歴）
-- ===================================
CREATE TABLE IF NOT EXISTS phase_transitions (
    id SERIAL PRIMARY KEY,

    -- 移行情報
    from_phase_id INTEGER REFERENCES phases(id),
    to_phase_id INTEGER NOT NULL REFERENCES phases(id),

    -- 移行ステータス
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_progress', 'completed', 'failed', 'cancelled')),

    -- 移行条件チェック結果
    readiness_check JSONB DEFAULT '{}'::jsonb,

    -- 承認情報
    approved_by VARCHAR(100),
    approved_at TIMESTAMP WITH TIME ZONE,

    -- 実行情報
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- メモ・コメント
    notes TEXT,

    -- メタデータ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100)
);

-- Transitionsインデックス
CREATE INDEX IF NOT EXISTS idx_phase_transitions_from_phase ON phase_transitions(from_phase_id);
CREATE INDEX IF NOT EXISTS idx_phase_transitions_to_phase ON phase_transitions(to_phase_id);
CREATE INDEX IF NOT EXISTS idx_phase_transitions_status ON phase_transitions(status);

-- ===================================
-- 5. Phase Progress テーブル（進捗記録）
-- ===================================
CREATE TABLE IF NOT EXISTS phase_progress (
    id SERIAL PRIMARY KEY,
    phase_id INTEGER NOT NULL REFERENCES phases(id) ON DELETE CASCADE,

    -- 進捗データ
    progress_percentage DECIMAL(5,2) DEFAULT 0.00 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),

    -- 進捗詳細
    tasks_total INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_in_progress INTEGER DEFAULT 0,
    tasks_blocked INTEGER DEFAULT 0,

    -- 時間管理
    estimated_hours DECIMAL(10,2),
    actual_hours DECIMAL(10,2),

    -- 進捗メモ
    notes TEXT,

    -- スナップショットデータ
    snapshot_data JSONB DEFAULT '{}'::jsonb,

    -- 記録日時
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recorded_by VARCHAR(100)
);

-- Progressインデックス
CREATE INDEX IF NOT EXISTS idx_phase_progress_phase_id ON phase_progress(phase_id);
CREATE INDEX IF NOT EXISTS idx_phase_progress_recorded_at ON phase_progress(recorded_at);

-- ===================================
-- 6. トリガー関数（自動更新）
-- ===================================

-- updated_at 自動更新トリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Phases テーブル用トリガー
DROP TRIGGER IF EXISTS update_phases_updated_at ON phases;
CREATE TRIGGER update_phases_updated_at
    BEFORE UPDATE ON phases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Phase KPIs テーブル用トリガー
DROP TRIGGER IF EXISTS update_phase_kpis_updated_at ON phase_kpis;
CREATE TRIGGER update_phase_kpis_updated_at
    BEFORE UPDATE ON phase_kpis
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Phase Deliverables テーブル用トリガー
DROP TRIGGER IF EXISTS update_phase_deliverables_updated_at ON phase_deliverables;
CREATE TRIGGER update_phase_deliverables_updated_at
    BEFORE UPDATE ON phase_deliverables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===================================
-- 7. 初期データ投入（Phase 1-5）
-- ===================================

INSERT INTO phases (phase_number, name, description, status, config) VALUES
    (1, 'Phase 1: Foundation', '基盤構築・緊急安定化', 'completed', '{"objectives": ["PostgreSQL移行", "Redis統合", "監視システム構築"], "duration_weeks": 2}'),
    (2, 'Phase 2: Core Features', 'コア機能実装・API完成', 'active', '{"objectives": ["RESTful API", "認証・認可", "レシピCRUD"], "duration_weeks": 3}'),
    (3, 'Phase 3: Advanced Features', '高度な機能実装', 'planned', '{"objectives": ["検索機能", "レコメンド", "画像処理"], "duration_weeks": 3}'),
    (4, 'Phase 4: Performance', 'パフォーマンス最適化', 'planned', '{"objectives": ["キャッシング", "クエリ最適化", "負荷試験"], "duration_weeks": 2}'),
    (5, 'Phase 5: Production', '本番環境デプロイ', 'planned', '{"objectives": ["CI/CD", "監視強化", "運用開始"], "duration_weeks": 2}')
ON CONFLICT (phase_number) DO NOTHING;

-- Phase 2 KPI サンプルデータ
INSERT INTO phase_kpis (phase_id, kpi_name, kpi_category, target_value, unit, status) VALUES
    (2, 'API Response Time', 'performance', '200', 'ms', 'on_track'),
    (2, 'Test Coverage', 'quality', '80', '%', 'pending'),
    (2, 'API Endpoints Completed', 'schedule', '15', 'count', 'on_track')
ON CONFLICT (phase_id, kpi_name) DO NOTHING;

-- Phase 2 Deliverables サンプルデータ
INSERT INTO phase_deliverables (phase_id, title, deliverable_type, status, priority) VALUES
    (2, 'Recipe CRUD API', 'api', 'completed', 1),
    (2, 'Authentication System', 'api', 'completed', 1),
    (2, 'Category Management', 'api', 'completed', 2),
    (2, 'Phase Management API', 'api', 'in_progress', 1),
    (2, 'API Documentation', 'document', 'in_progress', 2)
ON CONFLICT DO NOTHING;

-- ===================================
-- 8. ビュー作成（便利なクエリ）
-- ===================================

-- 現在のアクティブPhase
CREATE OR REPLACE VIEW v_current_phase AS
SELECT
    p.*,
    COUNT(DISTINCT pk.id) as total_kpis,
    COUNT(DISTINCT CASE WHEN pk.status = 'achieved' THEN pk.id END) as achieved_kpis,
    COUNT(DISTINCT pd.id) as total_deliverables,
    COUNT(DISTINCT CASE WHEN pd.status = 'completed' THEN pd.id END) as completed_deliverables
FROM phases p
LEFT JOIN phase_kpis pk ON p.id = pk.phase_id
LEFT JOIN phase_deliverables pd ON p.id = pd.phase_id
WHERE p.status = 'active'
GROUP BY p.id;

-- Phase進捗サマリー
CREATE OR REPLACE VIEW v_phase_progress_summary AS
SELECT
    p.id,
    p.phase_number,
    p.name,
    p.status,
    p.planned_start_date,
    p.planned_end_date,
    p.actual_start_date,
    p.actual_end_date,
    COUNT(DISTINCT pd.id) as total_deliverables,
    COUNT(DISTINCT CASE WHEN pd.status = 'completed' THEN pd.id END) as completed_deliverables,
    ROUND(
        CASE
            WHEN COUNT(DISTINCT pd.id) > 0
            THEN (COUNT(DISTINCT CASE WHEN pd.status = 'completed' THEN pd.id END)::DECIMAL / COUNT(DISTINCT pd.id) * 100)
            ELSE 0
        END,
    2) as deliverable_completion_rate,
    COUNT(DISTINCT pk.id) as total_kpis,
    COUNT(DISTINCT CASE WHEN pk.status IN ('achieved', 'on_track') THEN pk.id END) as kpis_on_track
FROM phases p
LEFT JOIN phase_deliverables pd ON p.id = pd.phase_id
LEFT JOIN phase_kpis pk ON p.id = pk.phase_id
GROUP BY p.id, p.phase_number, p.name, p.status, p.planned_start_date, p.planned_end_date, p.actual_start_date, p.actual_end_date
ORDER BY p.phase_number;

-- コメント追加
COMMENT ON TABLE phases IS 'プロジェクトの各Phase情報を管理';
COMMENT ON TABLE phase_kpis IS 'Phase毎のKPI（重要業績評価指標）';
COMMENT ON TABLE phase_deliverables IS 'Phase毎の成果物・タスク';
COMMENT ON TABLE phase_transitions IS 'Phase間の移行履歴';
COMMENT ON TABLE phase_progress IS 'Phaseの進捗スナップショット記録';

-- 完了メッセージ
DO $$
BEGIN
    RAISE NOTICE '✅ Phase Management System - Database Schema Created Successfully';
    RAISE NOTICE '📊 Tables: phases, phase_kpis, phase_deliverables, phase_transitions, phase_progress';
    RAISE NOTICE '📈 Views: v_current_phase, v_phase_progress_summary';
END $$;
