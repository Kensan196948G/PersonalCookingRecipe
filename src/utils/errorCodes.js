/**
 * 統一エラーコード定義
 * Personal Cooking Recipe - 認証システム統一化
 */

const ERROR_CODES = {
  // 認証関連エラー
  AUTH_NO_TOKEN: {
    code: 'AUTH_NO_TOKEN',
    status: 401,
    message: 'No authentication token provided'
  },
  AUTH_INVALID_TOKEN: {
    code: 'AUTH_INVALID_TOKEN',
    status: 401,
    message: 'Invalid or malformed authentication token'
  },
  AUTH_EXPIRED_TOKEN: {
    code: 'AUTH_EXPIRED_TOKEN',
    status: 401,
    message: 'Authentication token has expired'
  },
  AUTH_INSUFFICIENT_PERMISSIONS: {
    code: 'AUTH_INSUFFICIENT_PERMISSIONS',
    status: 403,
    message: 'Insufficient permissions to access this resource'
  },
  AUTH_TOKEN_BLACKLISTED: {
    code: 'AUTH_TOKEN_BLACKLISTED',
    status: 401,
    message: 'Authentication token has been invalidated'
  },

  // ユーザー関連エラー
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    status: 404,
    message: 'User not found'
  },
  USER_ALREADY_EXISTS: {
    code: 'USER_ALREADY_EXISTS',
    status: 400,
    message: 'User with this email already exists'
  },
  USER_INVALID_CREDENTIALS: {
    code: 'USER_INVALID_CREDENTIALS',
    status: 401,
    message: 'Invalid email or password'
  },
  USER_ACCOUNT_DISABLED: {
    code: 'USER_ACCOUNT_DISABLED',
    status: 403,
    message: 'User account has been disabled'
  },
  USER_VALIDATION_ERROR: {
    code: 'USER_VALIDATION_ERROR',
    status: 400,
    message: 'User data validation failed'
  },

  // レシピ関連エラー
  RECIPE_NOT_FOUND: {
    code: 'RECIPE_NOT_FOUND',
    status: 404,
    message: 'Recipe not found'
  },
  RECIPE_UNAUTHORIZED: {
    code: 'RECIPE_UNAUTHORIZED',
    status: 403,
    message: 'Not authorized to access or modify this recipe'
  },
  RECIPE_VALIDATION_ERROR: {
    code: 'RECIPE_VALIDATION_ERROR',
    status: 400,
    message: 'Recipe data validation failed'
  },
  RECIPE_IMAGE_UPLOAD_ERROR: {
    code: 'RECIPE_IMAGE_UPLOAD_ERROR',
    status: 400,
    message: 'Failed to upload recipe image'
  },

  // カテゴリ関連エラー
  CATEGORY_NOT_FOUND: {
    code: 'CATEGORY_NOT_FOUND',
    status: 404,
    message: 'Category not found'
  },
  CATEGORY_VALIDATION_ERROR: {
    code: 'CATEGORY_VALIDATION_ERROR',
    status: 400,
    message: 'Category data validation failed'
  },

  // 汎用エラー
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    status: 400,
    message: 'Request validation failed'
  },
  INTERNAL_SERVER_ERROR: {
    code: 'INTERNAL_SERVER_ERROR',
    status: 500,
    message: 'An internal server error occurred'
  },
  BAD_REQUEST: {
    code: 'BAD_REQUEST',
    status: 400,
    message: 'Bad request format or parameters'
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    status: 403,
    message: 'Access to this resource is forbidden'
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    status: 404,
    message: 'Requested resource not found'
  },
  METHOD_NOT_ALLOWED: {
    code: 'METHOD_NOT_ALLOWED',
    status: 405,
    message: 'HTTP method not allowed for this endpoint'
  },
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    status: 429,
    message: 'Rate limit exceeded. Please try again later'
  }
};

/**
 * 成功レスポンス生成
 * @param {*} data - レスポンスデータ
 * @param {string} message - 成功メッセージ
 * @returns {Object} 統一成功レスポンス
 */
const createSuccessResponse = (data = null, message = 'Success') => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString()
});

/**
 * エラーレスポンス生成
 * @param {Object} errorCode - エラーコード定義
 * @param {string} details - 追加詳細情報
 * @param {Object} metadata - メタデータ
 * @returns {Object} 統一エラーレスポンス
 */
const createErrorResponse = (errorCode, details = null, metadata = {}) => ({
  success: false,
  error: {
    code: errorCode.code,
    message: errorCode.message,
    statusCode: errorCode.status,
    details,
    metadata,
    timestamp: new Date().toISOString()
  }
});

/**
 * バリデーションエラーレスポンス生成
 * @param {Array} validationErrors - バリデーションエラー配列
 * @returns {Object} バリデーションエラーレスポンス
 */
const createValidationErrorResponse = (validationErrors) => ({
  success: false,
  error: {
    code: ERROR_CODES.VALIDATION_ERROR.code,
    message: ERROR_CODES.VALIDATION_ERROR.message,
    statusCode: ERROR_CODES.VALIDATION_ERROR.status,
    details: validationErrors,
    timestamp: new Date().toISOString()
  }
});

/**
 * エラーコード取得
 * @param {string} code - エラーコード文字列
 * @returns {Object|null} エラーコード定義または null
 */
const getErrorCode = (code) => {
  return Object.values(ERROR_CODES).find(error => error.code === code) || null;
};

/**
 * HTTPステータスコードからエラーコード推定
 * @param {number} statusCode - HTTPステータスコード
 * @returns {Object} 対応するエラーコード定義
 */
const getErrorCodeByStatus = (statusCode) => {
  const errorMapping = {
    400: ERROR_CODES.BAD_REQUEST,
    401: ERROR_CODES.AUTH_INVALID_TOKEN,
    403: ERROR_CODES.FORBIDDEN,
    404: ERROR_CODES.NOT_FOUND,
    405: ERROR_CODES.METHOD_NOT_ALLOWED,
    429: ERROR_CODES.RATE_LIMIT_EXCEEDED,
    500: ERROR_CODES.INTERNAL_SERVER_ERROR
  };

  return errorMapping[statusCode] || ERROR_CODES.INTERNAL_SERVER_ERROR;
};

module.exports = {
  ERROR_CODES,
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  getErrorCode,
  getErrorCodeByStatus
};