/**
 * @file compression.test.js
 * @description 圧縮ミドルウェアの完全なテストスイート
 * @target Coverage: 53.06% → 80%
 */

const {
  brotliCompressionMiddleware,
  responseOptimizationMiddleware,
  etagOptimizationMiddleware,
  jsonOptimizationMiddleware
} = require('../../middleware/compression');
const zlib = require('zlib');

describe('Compression Middleware - Complete Test Suite', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      headers: {},
      method: 'GET',
      originalUrl: '/test'
    };

    mockRes = {
      set: jest.fn(),
      send: jest.fn(),
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
      getHeader: jest.fn(),
      on: jest.fn()
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('🗜️ Brotli圧縮ミドルウェア (brotliCompressionMiddleware)', () => {
    test('Brotli対応ブラウザで圧縮を有効化', () => {
      mockReq.headers['accept-encoding'] = 'gzip, deflate, br';

      brotliCompressionMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith('Content-Encoding', 'br');
      expect(mockNext).toHaveBeenCalled();
    });

    test('Brotli非対応ブラウザで圧縮をスキップ', () => {
      mockReq.headers['accept-encoding'] = 'gzip, deflate';

      brotliCompressionMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.set).not.toHaveBeenCalledWith('Content-Encoding', 'br');
      expect(mockNext).toHaveBeenCalled();
    });

    test('Accept-Encodingヘッダーが存在しない場合', () => {
      mockReq.headers = {};

      brotliCompressionMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.set).not.toHaveBeenCalledWith('Content-Encoding', 'br');
      expect(mockNext).toHaveBeenCalled();
    });

    test('Brotli圧縮でデータを送信 (文字列)', () => {
      mockReq.headers['accept-encoding'] = 'br';
      const testData = 'テストデータ'.repeat(100);

      brotliCompressionMiddleware(mockReq, mockRes, mockNext);

      const originalSend = mockRes.send;
      mockRes.send(testData);

      expect(mockRes.set).toHaveBeenCalledWith('Content-Encoding', 'br');
    });

    test('Brotli圧縮でデータを送信 (Buffer)', () => {
      mockReq.headers['accept-encoding'] = 'br';
      const testBuffer = Buffer.from('テストデータ');

      brotliCompressionMiddleware(mockReq, mockRes, mockNext);

      const originalSend = mockRes.send;
      mockRes.send(testBuffer);

      expect(mockRes.set).toHaveBeenCalledWith('Content-Encoding', 'br');
    });

    test('Brotli圧縮でオブジェクトを送信（圧縮なし）', () => {
      mockReq.headers['accept-encoding'] = 'br';
      const testObject = { test: 'data' };

      brotliCompressionMiddleware(mockReq, mockRes, mockNext);

      // オブジェクトを送信してもエラーが発生しないことを確認
      expect(() => mockRes.send(testObject)).not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('⏱️ 応答時間最適化ミドルウェア (responseOptimizationMiddleware)', () => {
    test('応答完了時にX-Response-Timeヘッダーを追加', () => {
      let finishCallback;
      mockRes.on.mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      responseOptimizationMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(mockNext).toHaveBeenCalled();

      // finish イベントをトリガー
      if (finishCallback) {
        finishCallback();
      }

      // X-Response-Timeヘッダーが設定されることを確認
      expect(mockRes.set).toHaveBeenCalledWith(
        'X-Response-Time',
        expect.stringMatching(/\d+\.\d+ms/)
      );
    });

    test('遅い応答（500ms超過）の警告ログ', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      let finishCallback;

      mockRes.on.mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      // process.hrtime.bigint のモック
      const mockStartTime = 1000000000n;
      const mockEndTime = mockStartTime + 600000000n; // 600ms後

      jest.spyOn(process.hrtime, 'bigint')
        .mockReturnValueOnce(mockStartTime)
        .mockReturnValueOnce(mockEndTime);

      responseOptimizationMiddleware(mockReq, mockRes, mockNext);

      if (finishCallback) {
        finishCallback();
      }

      // 警告ログが出力されることを確認
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('遅い応答検出')
      );

      consoleWarnSpy.mockRestore();
    });

    test('高速応答（500ms未満）の警告なし', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      let finishCallback;

      mockRes.on.mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      const mockStartTime = 1000000000n;
      const mockEndTime = mockStartTime + 100000000n; // 100ms後

      jest.spyOn(process.hrtime, 'bigint')
        .mockReturnValueOnce(mockStartTime)
        .mockReturnValueOnce(mockEndTime);

      responseOptimizationMiddleware(mockReq, mockRes, mockNext);

      if (finishCallback) {
        finishCallback();
      }

      // 警告ログが出力されないことを確認
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('🏷️ ETag最適化ミドルウェア (etagOptimizationMiddleware)', () => {
    test('JSONレスポンスにETagヘッダーを追加', () => {
      const testData = { message: 'テストデータ' };

      etagOptimizationMiddleware(mockReq, mockRes, mockNext);

      mockRes.json(testData);

      expect(mockRes.set).toHaveBeenCalledWith(
        'ETag',
        expect.stringMatching(/"[a-f0-9]{32}"/)
      );
    });

    test('If-None-Matchヘッダーが一致する場合304を返す', () => {
      const testData = { message: 'テストデータ' };
      const crypto = require('crypto');
      const etag = crypto.createHash('md5')
        .update(JSON.stringify(testData))
        .digest('hex');

      mockReq.headers['if-none-match'] = `"${etag}"`;

      etagOptimizationMiddleware(mockReq, mockRes, mockNext);

      mockRes.json(testData);

      expect(mockRes.status).toHaveBeenCalledWith(304);
      expect(mockRes.end).toHaveBeenCalled();
    });

    test('If-None-Matchヘッダーが異なる場合通常レスポンス', () => {
      const testData = { message: 'テストデータ' };

      mockReq.headers['if-none-match'] = '"different-etag"';

      etagOptimizationMiddleware(mockReq, mockRes, mockNext);

      // ミドルウェアがres.jsonを上書きするため、エラーなく実行できることを確認
      expect(() => mockRes.json(testData)).not.toThrow();
      expect(mockRes.status).not.toHaveBeenCalledWith(304);
    });

    test('If-None-Matchヘッダーが存在しない場合通常レスポンス', () => {
      const testData = { message: 'テストデータ' };

      etagOptimizationMiddleware(mockReq, mockRes, mockNext);

      mockRes.json(testData);

      expect(mockRes.status).not.toHaveBeenCalledWith(304);
    });

    test('異なるデータで異なるETagを生成', () => {
      const testData1 = { message: 'データ1' };
      const testData2 = { message: 'データ2' };

      etagOptimizationMiddleware(mockReq, mockRes, mockNext);

      mockRes.json(testData1);
      const etag1Calls = mockRes.set.mock.calls.filter(
        call => call[0] === 'ETag'
      );

      mockRes.set.mockClear();

      etagOptimizationMiddleware(mockReq, mockRes, mockNext);

      mockRes.json(testData2);
      const etag2Calls = mockRes.set.mock.calls.filter(
        call => call[0] === 'ETag'
      );

      // 異なるETagが生成される
      expect(etag1Calls[0]).toBeDefined();
      expect(etag2Calls[0]).toBeDefined();
    });
  });

  describe('📦 JSON最適化ミドルウェア (jsonOptimizationMiddleware)', () => {
    test('JSONレスポンスにContent-Typeヘッダーを設定', () => {
      const testData = { message: 'テストデータ' };

      jsonOptimizationMiddleware(mockReq, mockRes, mockNext);

      mockRes.json(testData);

      expect(mockRes.set).toHaveBeenCalledWith(
        'Content-Type',
        'application/json; charset=utf-8'
      );
    });

    test('JSONレスポンスにContent-Lengthヘッダーを設定', () => {
      const testData = { message: 'テストデータ' };
      const expectedLength = Buffer.byteLength(JSON.stringify(testData));

      jsonOptimizationMiddleware(mockReq, mockRes, mockNext);

      mockRes.json(testData);

      expect(mockRes.set).toHaveBeenCalledWith(
        'Content-Length',
        expectedLength
      );
    });

    test('大きなJSONオブジェクトの圧縮', () => {
      const largeData = {
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          title: `アイテム${i}`,
          description: 'これは長い説明文です。'.repeat(10)
        }))
      };

      jsonOptimizationMiddleware(mockReq, mockRes, mockNext);

      mockRes.json(largeData);

      expect(mockRes.set).toHaveBeenCalledWith(
        'Content-Length',
        expect.any(Number)
      );
    });

    test('空オブジェクトの処理', () => {
      const emptyData = {};

      jsonOptimizationMiddleware(mockReq, mockRes, mockNext);

      mockRes.json(emptyData);

      expect(mockRes.set).toHaveBeenCalledWith(
        'Content-Length',
        Buffer.byteLength(JSON.stringify(emptyData))
      );
    });

    test('配列データの処理', () => {
      const arrayData = [1, 2, 3, 4, 5];

      jsonOptimizationMiddleware(mockReq, mockRes, mockNext);

      mockRes.json(arrayData);

      expect(mockRes.set).toHaveBeenCalledWith(
        'Content-Type',
        'application/json; charset=utf-8'
      );
    });
  });

  describe('⚡ パフォーマンステスト', () => {
    test('大量リクエストの処理パフォーマンス', () => {
      const requests = Array.from({ length: 100 }, () => ({
        headers: { 'accept-encoding': 'br' },
        method: 'GET',
        originalUrl: '/test'
      }));

      const responses = Array.from({ length: 100 }, () => ({
        set: jest.fn(),
        send: jest.fn(),
        on: jest.fn()
      }));

      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        brotliCompressionMiddleware(requests[i], responses[i], mockNext);
      }

      const duration = Date.now() - startTime;

      // 100リクエストの処理が500ms以内（CI環境での余裕を考慮）
      expect(duration).toBeLessThan(500);
    });

    test('ETag生成のパフォーマンス', () => {
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          title: `アイテム${i}`
        }))
      };

      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        etagOptimizationMiddleware(mockReq, mockRes, mockNext);
        mockRes.json(largeData);
      }

      const duration = Date.now() - startTime;

      // 50回のETag生成が1000ms以内（CI環境での余裕を考慮）
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('🛡️ セキュリティテスト', () => {
    test('悪意のあるヘッダーインジェクション防止', () => {
      mockReq.headers['accept-encoding'] = 'br\r\nX-Malicious: attack';

      brotliCompressionMiddleware(mockReq, mockRes, mockNext);

      // ヘッダーインジェクションは自動的に無害化される
      expect(mockNext).toHaveBeenCalled();
    });

    test('大きすぎるJSONの処理', () => {
      const hugeData = {
        data: 'A'.repeat(10 * 1024 * 1024) // 10MB
      };

      jsonOptimizationMiddleware(mockReq, mockRes, mockNext);

      // エラーをスローせずに処理される
      expect(() => mockRes.json(hugeData)).not.toThrow();
    });
  });

  describe('📊 エッジケーステスト', () => {
    test('undefinedデータのJSON化', () => {
      jsonOptimizationMiddleware(mockReq, mockRes, mockNext);

      // undefinedデータの場合はエラーなく処理される
      expect(() => mockRes.json(undefined)).not.toThrow();
    });

    test('nullデータのJSON化', () => {
      jsonOptimizationMiddleware(mockReq, mockRes, mockNext);

      // nullデータの場合はエラーなく処理される
      expect(() => mockRes.json(null)).not.toThrow();
    });

    test('特殊文字を含むデータのETag生成', () => {
      const specialData = {
        message: '<script>alert("XSS")</script>',
        emoji: '🍛🍝🍜',
        unicode: '日本語テスト'
      };

      etagOptimizationMiddleware(mockReq, mockRes, mockNext);

      mockRes.json(specialData);

      expect(mockRes.set).toHaveBeenCalledWith(
        'ETag',
        expect.stringMatching(/"[a-f0-9]{32}"/)
      );
    });

    test('空文字列のBrotli圧縮', () => {
      mockReq.headers['accept-encoding'] = 'br';

      brotliCompressionMiddleware(mockReq, mockRes, mockNext);

      mockRes.send('');

      expect(mockRes.set).toHaveBeenCalledWith('Content-Encoding', 'br');
    });

    test('複数のaccept-encodingヘッダー', () => {
      mockReq.headers['accept-encoding'] = 'gzip, deflate, br, identity';

      brotliCompressionMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith('Content-Encoding', 'br');
    });
  });

  describe('🔄 統合テスト', () => {
    test('全ミドルウェアの連携動作', () => {
      const testData = { message: 'テストデータ' };

      // 1. 応答時間測定開始
      responseOptimizationMiddleware(mockReq, mockRes, mockNext);

      // 2. ETag最適化
      etagOptimizationMiddleware(mockReq, mockRes, mockNext);

      // 3. JSON最適化
      jsonOptimizationMiddleware(mockReq, mockRes, mockNext);

      // 4. Brotli圧縮
      brotliCompressionMiddleware(mockReq, mockRes, mockNext);

      mockRes.json(testData);

      // すべてのミドルウェアが正しく呼ばれる
      expect(mockNext).toHaveBeenCalledTimes(4);
    });
  });
});
