/**
 * エラーハンドラーミドルウェア
 * null/undefined エラーにも対応
 */
module.exports = (err, req, res, next) => {
  // エラーオブジェクトがnull/undefinedの場合のガード
  if (!err) {
    err = new Error('Unknown error occurred');
  }

  // エラースタックの安全な出力（Optional chaining使用）
  console.error(err?.stack || err?.message || err);

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large' });
  }

  // SQLite constraint errors
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(400).json({ error: 'Database constraint violation' });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};