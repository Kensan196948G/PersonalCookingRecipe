/**
 * Phase Routes - RESTful API ルート定義
 *
 * エンドポイント構成:
 * - Phase管理: /api/phases
 * - 進捗管理: /api/progress
 * - Phase移行: /api/transition
 */

const express = require('express');
const router = express.Router();
const PhaseController = require('../controllers/phaseController');

// 認証ミドルウェア（オプション）
// const { authenticate } = require('../middleware/auth');

// ===================================
// Phase管理エンドポイント
// ===================================

/**
 * @route   GET /api/phases
 * @desc    全Phase一覧取得
 * @query   {string} status - フィルタリング用ステータス (planned/active/completed/cancelled)
 * @query   {boolean} include_kpis - KPI情報を含める
 * @query   {boolean} include_deliverables - 成果物情報を含める
 * @access  Public
 */
router.get('/', PhaseController.getAllPhases);

/**
 * @route   GET /api/phases/current
 * @desc    現在のアクティブPhase取得
 * @access  Public
 */
router.get('/current', PhaseController.getCurrentPhase);

/**
 * @route   GET /api/phases/health
 * @desc    Phase管理システムヘルスチェック
 * @access  Public
 */
router.get('/health', PhaseController.healthCheck);

/**
 * @route   GET /api/phases/:id
 * @desc    Phase詳細取得
 * @params  {number} id - Phase ID
 * @access  Public
 */
router.get('/:id', PhaseController.getPhaseById);

/**
 * @route   POST /api/phases
 * @desc    新規Phase作成
 * @body    {Object} phaseData - Phase情報
 * @access  Private (認証必要 - 今後実装)
 */
router.post('/', PhaseController.createPhase);

/**
 * @route   PUT /api/phases/:id
 * @desc    Phase更新
 * @params  {number} id - Phase ID
 * @body    {Object} updateData - 更新データ
 * @access  Private
 */
router.put('/:id', PhaseController.updatePhase);

/**
 * @route   POST /api/phases/:id/start
 * @desc    Phase開始
 * @params  {number} id - Phase ID
 * @access  Private
 */
router.post('/:id/start', PhaseController.startPhase);

/**
 * @route   POST /api/phases/:id/complete
 * @desc    Phase完了
 * @params  {number} id - Phase ID
 * @access  Private
 */
router.post('/:id/complete', PhaseController.completePhase);

/**
 * @route   PUT /api/phases/:id/kpi
 * @desc    KPI更新
 * @params  {number} id - Phase ID
 * @body    {string} kpi_name - KPI名
 * @body    {Object} kpiData - KPIデータ
 * @access  Private
 */
router.put('/:id/kpi', PhaseController.updateKPI);

/**
 * @route   GET /api/phases/:id/report
 * @desc    Phaseレポート生成
 * @params  {number} id - Phase ID
 * @query   {string} format - レポート形式 (json/pdf/csv)
 * @access  Public
 */
router.get('/:id/report', PhaseController.generateReport);

// ===================================
// 進捗管理エンドポイント
// ===================================

/**
 * @route   GET /api/phases/progress/overall
 * @desc    プロジェクト全体進捗取得
 * @access  Public
 */
router.get('/progress/overall', PhaseController.getOverallProgress);

/**
 * @route   GET /api/phases/progress/:phaseId
 * @desc    Phase別進捗取得
 * @params  {number} phaseId - Phase ID
 * @access  Public
 */
router.get('/progress/:phaseId', PhaseController.getPhaseProgress);

/**
 * @route   POST /api/phases/progress/update
 * @desc    進捗更新
 * @body    {number} phase_id - Phase ID
 * @body    {Object} progressData - 進捗データ
 * @access  Private
 */
router.post('/progress/update', PhaseController.updateProgress);

// ===================================
// Phase移行エンドポイント
// ===================================

/**
 * @route   POST /api/phases/transition/check
 * @desc    Phase移行可能性チェック
 * @body    {number} from_phase_id - 移行元Phase ID
 * @body    {number} to_phase_id - 移行先Phase ID
 * @access  Public
 */
router.post('/transition/check', PhaseController.checkTransition);

/**
 * @route   POST /api/phases/transition/execute
 * @desc    Phase移行実行
 * @body    {number} from_phase_id - 移行元Phase ID
 * @body    {number} to_phase_id - 移行先Phase ID
 * @body    {string} notes - 移行メモ
 * @access  Private
 */
router.post('/transition/execute', PhaseController.executeTransition);

/**
 * @route   GET /api/phases/transition/history
 * @desc    Phase移行履歴取得
 * @query   {number} limit - 取得件数 (default: 10)
 * @access  Public
 */
router.get('/transition/history', PhaseController.getTransitionHistory);

// ===================================
// エラーハンドリング
// ===================================

// 404 Not Found
router.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
    });
});

module.exports = router;
