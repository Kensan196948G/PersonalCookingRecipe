-- PersonalCookingRecipe ネイティブ監視システム
-- メトリクステーブル作成マイグレーション
--
-- 実行方法:
-- psql -U postgres -d personalcookingrecipe -f 001-create-metrics-tables.sql

-- ============================================
-- 1. システムメトリクステーブル
-- ============================================
CREATE TABLE IF NOT EXISTS system_metrics (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    labels JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_timestamp ON system_metrics(metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_labels ON system_metrics USING GIN(labels);

-- パーティショニング（オプション：大量データ対応）
-- 月別パーティション作成例
-- CREATE TABLE system_metrics_2025_11 PARTITION OF system_metrics
--     FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

COMMENT ON TABLE system_metrics IS 'システムメトリクス履歴（CPU、メモリ、ディスク、ネットワーク）';
COMMENT ON COLUMN system_metrics.metric_name IS 'メトリクス名（例: cpu_usage, memory_usage）';
COMMENT ON COLUMN system_metrics.metric_value IS 'メトリクス値（数値）';
COMMENT ON COLUMN system_metrics.labels IS 'ラベル（JSON形式）';

-- ============================================
-- 2. 生メトリクステーブル（JSON保存）
-- ============================================
CREATE TABLE IF NOT EXISTS metrics_raw (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metric_type VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_raw_timestamp ON metrics_raw(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_raw_type ON metrics_raw(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_raw_data ON metrics_raw USING GIN(data);

COMMENT ON TABLE metrics_raw IS '生メトリクスデータ（JSON形式）';
COMMENT ON COLUMN metrics_raw.metric_type IS 'メトリクスタイプ（system, application, business）';
COMMENT ON COLUMN metrics_raw.data IS 'メトリクスデータ（JSON）';

-- ============================================
-- 3. 時間別集約メトリクステーブル
-- ============================================
CREATE TABLE IF NOT EXISTS metrics_hourly (
    id BIGSERIAL PRIMARY KEY,
    hour TIMESTAMPTZ NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    avg_value NUMERIC,
    min_value NUMERIC,
    max_value NUMERIC,
    count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hour, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_metrics_hourly_hour ON metrics_hourly(hour DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_hourly_name ON metrics_hourly(metric_name);

COMMENT ON TABLE metrics_hourly IS '時間別集約メトリクス';

-- ============================================
-- 4. 日次サマリーテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS daily_summaries (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    summary_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date DESC);

COMMENT ON TABLE daily_summaries IS '日次サマリー（ビジネスメトリクス）';

-- ============================================
-- 5. アラート履歴テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS alert_history (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rule_name VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    category VARCHAR(50),
    message TEXT NOT NULL,
    metrics_snapshot JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_timestamp ON alert_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_severity ON alert_history(severity);
CREATE INDEX IF NOT EXISTS idx_alert_history_resolved ON alert_history(resolved);
CREATE INDEX IF NOT EXISTS idx_alert_history_rule_name ON alert_history(rule_name);

COMMENT ON TABLE alert_history IS 'アラート履歴';
COMMENT ON COLUMN alert_history.severity IS 'アラート重大度（critical, warning, info）';

-- ============================================
-- 6. マテリアライズドビュー: 直近24時間統計
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_last_24h AS
SELECT
    metric_name,
    COUNT(*) as data_points,
    AVG(metric_value) as avg_value,
    MIN(metric_value) as min_value,
    MAX(metric_value) as max_value,
    STDDEV(metric_value) as stddev_value,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY metric_value) as p50,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY metric_value) as p95,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY metric_value) as p99
FROM system_metrics
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY metric_name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_last_24h_name ON metrics_last_24h(metric_name);

COMMENT ON MATERIALIZED VIEW metrics_last_24h IS '直近24時間のメトリクス統計（高速参照用）';

-- ============================================
-- 7. 便利なビュー: 最新メトリクス
-- ============================================
CREATE OR REPLACE VIEW latest_metrics AS
SELECT DISTINCT ON (metric_name)
    metric_name,
    metric_value,
    labels,
    timestamp
FROM system_metrics
ORDER BY metric_name, timestamp DESC;

COMMENT ON VIEW latest_metrics IS '各メトリクスの最新値';

-- ============================================
-- 8. 便利なビュー: アクティブアラート
-- ============================================
CREATE OR REPLACE VIEW active_alerts AS
SELECT
    id,
    rule_name,
    severity,
    category,
    message,
    timestamp,
    EXTRACT(EPOCH FROM (NOW() - timestamp)) as age_seconds
FROM alert_history
WHERE resolved = FALSE
ORDER BY timestamp DESC;

COMMENT ON VIEW active_alerts IS '未解決のアラート一覧';

-- ============================================
-- 9. 自動クリーンアップ関数
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_metrics(retention_days INTEGER DEFAULT 30)
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
    result_count BIGINT;
BEGIN
    DELETE FROM system_metrics
    WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS result_count = ROW_COUNT;

    DELETE FROM metrics_raw
    WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;

    RETURN QUERY SELECT result_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_metrics IS '古いメトリクスデータを削除（デフォルト: 30日以上前）';

-- 使用例:
-- SELECT * FROM cleanup_old_metrics(30);

-- ============================================
-- 10. メトリクス統計取得関数
-- ============================================
CREATE OR REPLACE FUNCTION get_metric_stats(
    p_metric_name VARCHAR,
    p_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
    metric_name VARCHAR,
    avg_value NUMERIC,
    min_value NUMERIC,
    max_value NUMERIC,
    p95_value NUMERIC,
    data_points BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        $1::VARCHAR,
        AVG(metric_value),
        MIN(metric_value),
        MAX(metric_value),
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY metric_value),
        COUNT(*)
    FROM system_metrics
    WHERE metric_name = p_metric_name
      AND timestamp >= NOW() - (p_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_metric_stats IS '指定メトリクスの統計情報取得';

-- 使用例:
-- SELECT * FROM get_metric_stats('cpu_usage', 24);

-- ============================================
-- 11. マテリアライズドビュー自動更新トリガー
-- ============================================
-- 注: PostgreSQL 14以降は自動更新可能
-- それ以前のバージョンでは、Cronで定期実行
CREATE OR REPLACE FUNCTION refresh_metrics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY metrics_last_24h;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_metrics_views IS 'マテリアライズドビュー更新';

-- ============================================
-- 12. 初期データ投入（テスト用）
-- ============================================
-- 動作確認用のサンプルメトリクス
INSERT INTO system_metrics (metric_name, metric_value, labels)
VALUES
    ('cpu_usage', 45.5, '{"host": "localhost"}'),
    ('memory_usage', 68.2, '{"host": "localhost"}'),
    ('disk_usage', 75.0, '{"host": "localhost", "mount": "/"}')
ON CONFLICT DO NOTHING;

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'メトリクステーブル作成完了';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '';
    RAISE NOTICE '作成されたテーブル:';
    RAISE NOTICE '  1. system_metrics - システムメトリクス';
    RAISE NOTICE '  2. metrics_raw - 生メトリクスデータ';
    RAISE NOTICE '  3. metrics_hourly - 時間別集約';
    RAISE NOTICE '  4. daily_summaries - 日次サマリー';
    RAISE NOTICE '  5. alert_history - アラート履歴';
    RAISE NOTICE '';
    RAISE NOTICE '作成されたビュー:';
    RAISE NOTICE '  1. metrics_last_24h (マテリアライズド)';
    RAISE NOTICE '  2. latest_metrics';
    RAISE NOTICE '  3. active_alerts';
    RAISE NOTICE '';
    RAISE NOTICE '便利な関数:';
    RAISE NOTICE '  1. cleanup_old_metrics(retention_days)';
    RAISE NOTICE '  2. get_metric_stats(metric_name, hours)';
    RAISE NOTICE '  3. refresh_metrics_views()';
    RAISE NOTICE '';
    RAISE NOTICE 'マテリアライズドビューの更新:';
    RAISE NOTICE '  SELECT refresh_metrics_views();';
    RAISE NOTICE '';
    RAISE NOTICE '古いデータのクリーンアップ:';
    RAISE NOTICE '  SELECT * FROM cleanup_old_metrics(30);';
    RAISE NOTICE '==============================================';
END $$;
