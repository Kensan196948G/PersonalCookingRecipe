/**
 * API応答圧縮最適化ミドルウェア
 * PersonalCookingRecipe Phase 2b パフォーマンス最適化
 */

const compression = require('compression');
const zlib = require('zlib');

// 圧縮設定最適化
const compressionOptions = {
    // 圧縮レベル: 6 (バランス型 - 速度と圧縮率)
    level: 6,
    
    // 閾値: 1KB以上のレスポンスを圧縮
    threshold: 1024,
    
    // メモリレベル: 8 (デフォルト)
    memLevel: 8,
    
    // 圧縮フィルター
    filter: (req, res) => {
        // 画像ファイルは圧縮しない（既に圧縮済み）
        const contentType = res.getHeader('content-type');
        if (contentType && (
            contentType.includes('image/') ||
            contentType.includes('video/') ||
            contentType.includes('audio/')
        )) {
            return false;
        }
        
        // 圧縮を無効化するヘッダーがある場合
        if (req.headers['x-no-compression']) {
            return false;
        }
        
        return compression.filter(req, res);
    }
};

// Brotli圧縮サポート (より高効率)
const brotliCompressionMiddleware = (req, res, next) => {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    
    // Brotli対応チェック
    if (acceptEncoding.includes('br')) {
        res.set('Content-Encoding', 'br');
        
        const originalSend = res.send;
        res.send = function(data) {
            if (typeof data === 'string' || Buffer.isBuffer(data)) {
                const compressed = zlib.brotliCompressSync(data, {
                    params: {
                        [zlib.constants.BROTLI_PARAM_QUALITY]: 4, // 速度重視
                        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length
                    }
                });
                
                res.set('Content-Length', compressed.length);
                originalSend.call(this, compressed);
            } else {
                originalSend.call(this, data);
            }
        };
    }
    
    next();
};

// 応答時間最適化
const responseOptimizationMiddleware = (req, res, next) => {
    const startTime = process.hrtime.bigint();
    
    // 応答完了時のパフォーマンス測定
    res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // ナノ秒からミリ秒
        
        // パフォーマンスヘッダー追加
        res.set('X-Response-Time', `${duration.toFixed(3)}ms`);
        
        // 遅い応答のログ
        if (duration > 500) { // 500ms超過
            console.warn(`遅い応答検出: ${req.method} ${req.originalUrl} - ${duration.toFixed(3)}ms`);
        }
    });
    
    next();
};

// ETags最適化（条件付きリクエスト対応）
const etagOptimizationMiddleware = (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
        const etag = require('crypto')
            .createHash('md5')
            .update(JSON.stringify(data))
            .digest('hex');
        
        res.set('ETag', `"${etag}"`);
        
        // 条件付きリクエストチェック
        const clientEtag = req.headers['if-none-match'];
        if (clientEtag === `"${etag}"`) {
            return res.status(304).end();
        }
        
        originalJson.call(this, data);
    };
    
    next();
};

// JSON圧縮最適化
const jsonOptimizationMiddleware = (req, res, next) => {
    const originalJson = res.json;

    res.json = function(data) {
        // undefinedまたはnullの場合はそのまま処理
        if (data === undefined || data === null) {
            return originalJson.call(this, data);
        }

        // JSON圧縮（空白除去）
        const compactJson = JSON.stringify(data);

        // JSON.stringifyが文字列を返した場合のみ処理
        if (typeof compactJson === 'string') {
            res.set('Content-Type', 'application/json; charset=utf-8');
            res.set('Content-Length', Buffer.byteLength(compactJson));
        }

        originalJson.call(this, data);
    };

    next();
};

module.exports = {
    compressionMiddleware: compression(compressionOptions),
    brotliCompressionMiddleware,
    responseOptimizationMiddleware,
    etagOptimizationMiddleware,
    jsonOptimizationMiddleware
};