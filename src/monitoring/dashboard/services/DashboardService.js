/**
 * ダッシュボードサービス
 * PersonalCookingRecipe - ネイティブ監視システム
 */

class DashboardService {
    constructor(metricsCollector) {
        if (!metricsCollector) {
            throw new Error('MetricsCollector is required');
        }

        this.metricsCollector = metricsCollector;
        this.nativeMonitoring = metricsCollector.getNativeMonitoring();
        this.applicationMetrics = metricsCollector.getApplicationMetrics();
        this.businessMetrics = metricsCollector.getBusinessMetrics();
        this.alertManager = metricsCollector.getAlertManager();
    }

    /**
     * ダッシュボードメインデータ取得
     */
    async getDashboardData() {
        const [systemInfo, currentMetrics, stats, recentAlerts] = await Promise.all([
            this.nativeMonitoring.getSystemInfo(),
            this.getCurrentMetrics(),
            this.getStats(),
            this.getRecentAlerts(10)
        ]);

        return {
            systemInfo,
            currentMetrics,
            stats,
            recentAlerts,
            timestamp: Date.now()
        };
    }

    /**
     * システムメトリクスデータ取得
     */
    async getSystemMetricsData() {
        const current = this.nativeMonitoring.getCurrentMetrics();
        const history = this.nativeMonitoring.getMetricsHistory(60);
        const systemInfo = await this.nativeMonitoring.getSystemInfo();

        return {
            current,
            history,
            systemInfo,
            timestamp: Date.now()
        };
    }

    /**
     * アプリケーションメトリクスデータ取得
     */
    async getApplicationMetricsData() {
        const current = this.applicationMetrics.getCurrentMetrics();
        const topRoutes = this.applicationMetrics.getTopRoutes(10);
        const slowQueries = this.applicationMetrics.getSlowQueries(10);

        return {
            current,
            topRoutes,
            slowQueries,
            timestamp: Date.now()
        };
    }

    /**
     * ビジネスメトリクスデータ取得
     */
    async getBusinessMetricsData() {
        const current = this.businessMetrics.getCurrentMetrics();
        const stats = this.businessMetrics.getStats();

        return {
            current,
            stats,
            timestamp: Date.now()
        };
    }

    /**
     * アラートデータ取得
     */
    async getAlertsData() {
        const history = this.alertManager.getAlertHistory(100);
        const stats = this.alertManager.getAlertStats();

        return {
            history,
            stats,
            timestamp: Date.now()
        };
    }

    /**
     * 現在のメトリクス取得（全モジュール）
     */
    async getCurrentMetrics() {
        return {
            system: this.nativeMonitoring.getCurrentMetrics(),
            application: this.applicationMetrics.getCurrentMetrics(),
            business: this.businessMetrics.getCurrentMetrics()
        };
    }

    /**
     * システムメトリクス履歴取得
     */
    async getSystemMetricsHistory(limit = 60) {
        return this.nativeMonitoring.getMetricsHistory(limit);
    }

    /**
     * アプリケーションメトリクス履歴取得
     */
    async getApplicationMetricsHistory(limit = 60) {
        // ApplicationMetricsには履歴メソッドがないため、現在値のみ返す
        return {
            current: this.applicationMetrics.getCurrentMetrics()
        };
    }

    /**
     * アラート履歴取得
     */
    async getAlertHistory(limit = 100, severity = null) {
        return this.alertManager.getAlertHistory(limit, severity);
    }

    /**
     * 最近のアラート取得
     */
    async getRecentAlerts(limit = 10) {
        return this.alertManager.getAlertHistory(limit);
    }

    /**
     * 統計情報取得
     */
    async getStats() {
        return this.metricsCollector.getStats();
    }

    /**
     * Prometheus形式メトリクス生成
     */
    async getPrometheusMetrics() {
        const metrics = await this.getCurrentMetrics();
        let output = [];

        // システムメトリクス
        if (metrics.system) {
            const sys = metrics.system.system;
            if (sys.cpu) {
                output.push(`# HELP cpu_usage CPU usage percentage`);
                output.push(`# TYPE cpu_usage gauge`);
                output.push(`cpu_usage ${sys.cpu.usage || 0}`);
            }
            if (sys.memory) {
                output.push(`# HELP memory_usage Memory usage percentage`);
                output.push(`# TYPE memory_usage gauge`);
                output.push(`memory_usage ${sys.memory.usage_percent || 0}`);
            }
        }

        // アプリケーションメトリクス
        if (metrics.application && metrics.application.http) {
            const http = metrics.application.http;
            output.push(`# HELP http_requests_total Total HTTP requests`);
            output.push(`# TYPE http_requests_total counter`);
            output.push(`http_requests_total ${http.totalRequests || 0}`);

            output.push(`# HELP http_error_rate HTTP error rate percentage`);
            output.push(`# TYPE http_error_rate gauge`);
            output.push(`http_error_rate ${http.errorRate || 0}`);
        }

        // ビジネスメトリクス
        if (metrics.business && metrics.business.users) {
            const users = metrics.business.users;
            output.push(`# HELP user_registrations_total Total user registrations`);
            output.push(`# TYPE user_registrations_total counter`);
            output.push(`user_registrations_total ${users.totalRegistrations || 0}`);
        }

        return output.join('\n') + '\n';
    }
}

module.exports = DashboardService;
