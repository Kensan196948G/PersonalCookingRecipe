/**
 * ネイティブ監視ダッシュボード - Expressルート
 * PersonalCookingRecipe
 */

const express = require('express');
const router = express.Router();
const DashboardService = require('./services/DashboardService');

/**
 * ダッシュボードサービス初期化
 */
let dashboardService = null;

function initializeDashboardService(metricsCollector) {
    dashboardService = new DashboardService(metricsCollector);
    return dashboardService;
}

/**
 * メインダッシュボード
 */
router.get('/', async (req, res) => {
    try {
        if (!dashboardService) {
            return res.status(503).send('Dashboard service not initialized');
        }

        const data = await dashboardService.getDashboardData();
        res.render('monitoring/dashboard/index', {
            title: 'PersonalCookingRecipe - Monitoring Dashboard',
            data
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Dashboard error');
    }
});

/**
 * システムメトリクス詳細
 */
router.get('/system', async (req, res) => {
    try {
        const data = await dashboardService.getSystemMetricsData();
        res.render('monitoring/dashboard/system', {
            title: 'System Metrics',
            data
        });
    } catch (error) {
        res.status(500).send('Error loading system metrics');
    }
});

/**
 * アプリケーションメトリクス詳細
 */
router.get('/application', async (req, res) => {
    try {
        const data = await dashboardService.getApplicationMetricsData();
        res.render('monitoring/dashboard/application', {
            title: 'Application Metrics',
            data
        });
    } catch (error) {
        res.status(500).send('Error loading application metrics');
    }
});

/**
 * ビジネスメトリクス詳細
 */
router.get('/business', async (req, res) => {
    try {
        const data = await dashboardService.getBusinessMetricsData();
        res.render('monitoring/dashboard/business', {
            title: 'Business Metrics',
            data
        });
    } catch (error) {
        res.status(500).send('Error loading business metrics');
    }
});

/**
 * アラート一覧
 */
router.get('/alerts', async (req, res) => {
    try {
        const data = await dashboardService.getAlertsData();
        res.render('monitoring/dashboard/alerts', {
            title: 'Alerts',
            data
        });
    } catch (error) {
        res.status(500).send('Error loading alerts');
    }
});

/**
 * API: リアルタイムメトリクス取得
 */
router.get('/api/metrics/current', async (req, res) => {
    try {
        const metrics = await dashboardService.getCurrentMetrics();
        res.json(metrics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * API: システムメトリクス履歴
 */
router.get('/api/metrics/system/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 60;
        const history = await dashboardService.getSystemMetricsHistory(limit);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * API: アプリケーションメトリクス履歴
 */
router.get('/api/metrics/application/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 60;
        const history = await dashboardService.getApplicationMetricsHistory(limit);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * API: アラート履歴
 */
router.get('/api/alerts/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const severity = req.query.severity;
        const history = await dashboardService.getAlertHistory(limit, severity);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * API: 統計情報
 */
router.get('/api/stats', async (req, res) => {
    try {
        const stats = await dashboardService.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Prometheus互換エンドポイント
 */
router.get('/metrics', async (req, res) => {
    try {
        const metrics = await dashboardService.getPrometheusMetrics();
        res.set('Content-Type', 'text/plain; version=0.0.4');
        res.send(metrics);
    } catch (error) {
        res.status(500).send('Error generating metrics');
    }
});

module.exports = {
    router,
    initializeDashboardService
};
