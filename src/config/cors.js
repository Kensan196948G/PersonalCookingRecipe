/**
 * CORS設定最適化
 * Personal Cooking Recipe - 認証システム統一化
 */

const corsConfig = {
  // 許可するオリジン
  origin: (origin, callback) => {
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [
          'https://your-domain.com',
          'https://www.your-domain.com',
          'https://app.your-domain.com'
        ]
      : [
          'http://localhost:3000',    // React default
          'http://localhost:5173',    // Vite default
          'http://localhost:8080',    // Vue CLI default
          'http://127.0.0.1:3000',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:8080'
        ];

    // リクエストにオリジンがない場合（Postmanなど）は許可
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`Blocked CORS request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },

  // 認証情報（cookies, authorization headers）を含むリクエストを許可
  credentials: true,

  // 許可するHTTPメソッド
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],

  // 許可するヘッダー
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-HTTP-Method-Override',
    'X-Forwarded-For',
    'X-Real-IP'
  ],

  // ブラウザに公開するレスポンスヘッダー
  exposedHeaders: [
    'X-Total-Count',
    'X-Pagination-Page',
    'X-Pagination-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],

  // プリフライトリクエストの結果をキャッシュする時間（秒）
  maxAge: 86400, // 24時間

  // OPTIONSリクエストのステータスコード（古いブラウザ対応）
  optionsSuccessStatus: 200,

  // プリフライトリクエストを次のハンドラに渡すか
  preflightContinue: false
};

/**
 * 開発環境用のゆるいCORS設定
 */
const devCorsConfig = {
  origin: true, // すべてのオリジンを許可
  credentials: true,
  methods: ['*'],
  allowedHeaders: ['*'],
  exposedHeaders: ['*'],
  maxAge: 86400,
  optionsSuccessStatus: 200,
  preflightContinue: false
};

/**
 * API専用CORS設定
 */
const apiCorsConfig = {
  ...corsConfig,
  // API固有の設定
  allowedHeaders: [
    ...corsConfig.allowedHeaders,
    'X-API-Key',
    'X-Client-Version'
  ],
  exposedHeaders: [
    ...corsConfig.exposedHeaders,
    'X-API-Version',
    'X-Response-Time'
  ]
};

/**
 * WebSocket用CORS設定
 */
const wsCorsConfig = {
  origin: corsConfig.origin,
  credentials: true
};

/**
 * 環境別CORS設定取得
 * @param {string} env - 環境名（development, production, test）
 * @param {string} type - 設定タイプ（api, ws, default）
 * @returns {Object} CORS設定オブジェクト
 */
const getCorsConfig = (env = process.env.NODE_ENV, type = 'default') => {
  if (env === 'development' && type === 'default') {
    return devCorsConfig;
  }

  switch (type) {
    case 'api':
      return apiCorsConfig;
    case 'ws':
      return wsCorsConfig;
    default:
      return corsConfig;
  }
};

/**
 * セキュリティヘッダーミドルウェア
 * CORS設定と併用するセキュリティヘッダーを設定
 */
const securityHeaders = (req, res, next) => {
  // XSS保護
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // コンテンツタイプスニッフィング防止
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // クリックジャッキング防止
  res.setHeader('X-Frame-Options', 'DENY');
  
  // HSTS（HTTPS使用時のみ）
  if (req.secure || req.get('x-forwarded-proto') === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // リファラーポリシー
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // 権限ポリシー
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  next();
};

module.exports = {
  corsConfig,
  devCorsConfig,
  apiCorsConfig,
  wsCorsConfig,
  getCorsConfig,
  securityHeaders
};