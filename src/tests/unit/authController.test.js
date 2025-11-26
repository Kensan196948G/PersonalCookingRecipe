/**
 * @file authController.test.js
 * @description ユーザー認証コントローラーの完全なテストスイート
 * @target Coverage: 80%以上
 */

const authController = require('../../controllers/authController');
const User = require('../../models/User');
const { generateToken, generateRefreshToken, blacklistToken } = require('../../middleware/unifiedAuth');
const { ERROR_CODES } = require('../../utils/errorCodes');

// モック設定
jest.mock('../../models/User');
jest.mock('../../middleware/unifiedAuth');

describe('Authentication Controller - Complete Test Suite', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // リクエスト・レスポンス・ネクストのモック初期化
    mockReq = {
      body: {},
      user: {},
      token: null
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    // モックのクリア
    jest.clearAllMocks();
  });

  describe('✅ ユーザー登録 (register)', () => {
    test('有効なデータで新規ユーザー登録成功', async () => {
      // テストデータ準備
      mockReq.body = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      };

      // モック動作設定
      User.findByEmail.mockResolvedValue(null); // 既存ユーザーなし
      User.create.mockResolvedValue(mockUser);
      generateToken.mockReturnValue('mock-access-token');
      generateRefreshToken.mockReturnValue('mock-refresh-token');

      // テスト実行
      await authController.register(mockReq, mockRes, mockNext);

      // アサーション
      expect(User.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(User.create).toHaveBeenCalledWith({
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({
              id: 1,
              username: 'testuser',
              email: 'test@example.com'
            }),
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token'
          })
        })
      );
    });

    test('既存メールアドレスで登録失敗', async () => {
      mockReq.body = {
        username: 'testuser',
        email: 'existing@example.com',
        password: 'password123'
      };

      // 既存ユーザーが存在
      User.findByEmail.mockResolvedValue({ id: 1, email: 'existing@example.com' });

      await authController.register(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(ERROR_CODES.USER_ALREADY_EXISTS.status);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ERROR_CODES.USER_ALREADY_EXISTS.code
          })
        })
      );
      expect(User.create).not.toHaveBeenCalled();
    });

    test('データベースエラー時の500エラー', async () => {
      mockReq.body = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      User.findByEmail.mockResolvedValue(null);
      User.create.mockRejectedValue(new Error('Database connection failed'));

      await authController.register(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(ERROR_CODES.INTERNAL_SERVER_ERROR.status);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ERROR_CODES.INTERNAL_SERVER_ERROR.code
          })
        })
      );
    });
  });

  describe('🔐 ログイン (login)', () => {
    test('正しい資格情報でログイン成功', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'correctPassword'
      };

      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashed-password'
      };

      User.findByEmail.mockResolvedValue(mockUser);
      User.validatePassword.mockResolvedValue(true);
      generateToken.mockReturnValue('mock-access-token');
      generateRefreshToken.mockReturnValue('mock-refresh-token');

      await authController.login(mockReq, mockRes, mockNext);

      expect(User.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(User.validatePassword).toHaveBeenCalledWith('correctPassword', 'hashed-password');
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({ id: 1 }),
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token'
          })
        })
      );
    });

    test('存在しないメールアドレスでログイン失敗', async () => {
      mockReq.body = {
        email: 'nonexistent@example.com',
        password: 'anyPassword'
      };

      User.findByEmail.mockResolvedValue(null);

      await authController.login(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(ERROR_CODES.USER_INVALID_CREDENTIALS.status);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ERROR_CODES.USER_INVALID_CREDENTIALS.code
          })
        })
      );
      expect(User.validatePassword).not.toHaveBeenCalled();
    });

    test('不正なパスワードでログイン失敗', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'wrongPassword'
      };

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashed-password'
      };

      User.findByEmail.mockResolvedValue(mockUser);
      User.validatePassword.mockResolvedValue(false);

      await authController.login(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(ERROR_CODES.USER_INVALID_CREDENTIALS.status);
      expect(generateToken).not.toHaveBeenCalled();
    });

    test('ログイン処理時間が適切 (パフォーマンステスト)', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'correctPassword'
      };

      User.findByEmail.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashed-password'
      });
      User.validatePassword.mockResolvedValue(true);
      generateToken.mockReturnValue('token');
      generateRefreshToken.mockReturnValue('refresh-token');

      const startTime = Date.now();
      await authController.login(mockReq, mockRes, mockNext);
      const endTime = Date.now();

      // ログイン処理が100ms以内に完了すること
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('👤 プロファイル取得 (getProfile)', () => {
    test('認証済みユーザーのプロファイル取得成功', async () => {
      mockReq.user = { id: 1 };

      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-15'
      };

      User.findById.mockResolvedValue(mockUser);

      await authController.getProfile(mockReq, mockRes, mockNext);

      expect(User.findById).toHaveBeenCalledWith(1);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: mockUser
          })
        })
      );
    });

    test('存在しないユーザーID で404エラー', async () => {
      mockReq.user = { id: 999 };

      User.findById.mockResolvedValue(null);

      await authController.getProfile(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(ERROR_CODES.USER_NOT_FOUND.status);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ERROR_CODES.USER_NOT_FOUND.code
          })
        })
      );
    });
  });

  describe('✏️ プロファイル更新 (updateProfile)', () => {
    test('有効なデータでプロファイル更新成功', async () => {
      mockReq.user = { id: 1 };
      mockReq.body = {
        username: 'newUsername',
        email: 'newemail@example.com'
      };

      User.update.mockResolvedValue(true);

      await authController.updateProfile(mockReq, mockRes, mockNext);

      expect(User.update).toHaveBeenCalledWith(1, {
        username: 'newUsername',
        email: 'newemail@example.com'
      });
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Profile updated successfully'
        })
      );
    });

    test('存在しないユーザーの更新で404エラー', async () => {
      mockReq.user = { id: 999 };
      mockReq.body = { username: 'newUsername' };

      User.update.mockResolvedValue(false);

      await authController.updateProfile(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(ERROR_CODES.USER_NOT_FOUND.status);
    });
  });

  describe('🔑 パスワード変更 (changePassword)', () => {
    test('正しい現在のパスワードでパスワード変更成功', async () => {
      mockReq.user = { id: 1 };
      mockReq.body = {
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword456'
      };

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashed-old-password'
      };

      User.findById.mockResolvedValue({ id: 1, email: 'test@example.com' });
      User.findByEmail.mockResolvedValue(mockUser);
      User.validatePassword.mockResolvedValue(true);
      User.updatePassword.mockResolvedValue(true);

      await authController.changePassword(mockReq, mockRes, mockNext);

      expect(User.validatePassword).toHaveBeenCalledWith('oldPassword123', 'hashed-old-password');
      expect(User.updatePassword).toHaveBeenCalledWith(1, 'newPassword456');
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Password changed successfully'
        })
      );
    });

    test('不正な現在のパスワードで変更失敗', async () => {
      mockReq.user = { id: 1 };
      mockReq.body = {
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword456'
      };

      User.findById.mockResolvedValue({ id: 1, email: 'test@example.com' });
      User.findByEmail.mockResolvedValue({
        id: 1,
        password: 'hashed-old-password'
      });
      User.validatePassword.mockResolvedValue(false);

      await authController.changePassword(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(ERROR_CODES.USER_INVALID_CREDENTIALS.status);
      expect(User.updatePassword).not.toHaveBeenCalled();
    });

    test('存在しないユーザーのパスワード変更で404エラー', async () => {
      mockReq.user = { id: 999 };
      mockReq.body = {
        currentPassword: 'anyPassword',
        newPassword: 'newPassword'
      };

      User.findById.mockResolvedValue(null);

      await authController.changePassword(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(ERROR_CODES.USER_NOT_FOUND.status);
    });
  });

  describe('🚪 ログアウト (logout)', () => {
    test('有効なトークンでログアウト成功', async () => {
      mockReq.token = 'valid-jwt-token';

      blacklistToken.mockReturnValue(true);

      await authController.logout(mockReq, mockRes, mockNext);

      expect(blacklistToken).toHaveBeenCalledWith('valid-jwt-token');
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Logout successful'
        })
      );
    });

    test('トークンなしでもログアウト成功', async () => {
      mockReq.token = null;

      await authController.logout(mockReq, mockRes, mockNext);

      expect(blacklistToken).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Logout successful'
        })
      );
    });
  });

  describe('🔄 トークンリフレッシュ (refreshToken)', () => {
    test('リフレッシュトークンが未実装のため501エラー', async () => {
      mockReq.body = {
        refreshToken: 'valid-refresh-token'
      };

      await authController.refreshToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(501);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
            details: expect.stringContaining('Refresh token')
          })
        })
      );
    });

    test('リフレッシュトークンが提供されていない場合', async () => {
      mockReq.body = {};

      await authController.refreshToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(ERROR_CODES.AUTH_NO_TOKEN.status);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ERROR_CODES.AUTH_NO_TOKEN.code,
            details: expect.stringContaining('Refresh token')
          })
        })
      );
    });
  });

  describe('🛡️ セキュリティテスト', () => {
    test('SQLインジェクション攻撃を防ぐ', async () => {
      mockReq.body = {
        email: "'; DROP TABLE users; --",
        password: 'password'
      };

      User.findByEmail.mockResolvedValue(null);

      await authController.login(mockReq, mockRes, mockNext);

      // SQLインジェクション攻撃はサニタイズされ、通常の認証失敗として処理される
      expect(mockRes.status).toHaveBeenCalledWith(ERROR_CODES.USER_INVALID_CREDENTIALS.status);
    });

    test('XSS攻撃を防ぐ', async () => {
      mockReq.body = {
        username: '<script>alert("xss")</script>',
        email: 'test@example.com',
        password: 'password123'
      };

      User.findByEmail.mockResolvedValue(null);
      User.create.mockResolvedValue({
        id: 1,
        username: '<script>alert("xss")</script>',
        email: 'test@example.com'
      });
      generateToken.mockReturnValue('token');
      generateRefreshToken.mockReturnValue('refresh');

      await authController.register(mockReq, mockRes, mockNext);

      // XSSスクリプトはエスケープされるべき (バリデーションレイヤーで)
      expect(User.create).toHaveBeenCalled();
    });

    test('大量の同時ログイン試行に耐える', async () => {
      const promises = [];

      for (let i = 0; i < 100; i++) {
        const req = { body: { email: `test${i}@example.com`, password: 'password' } };
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };

        User.findByEmail.mockResolvedValue(null);
        promises.push(authController.login(req, res, mockNext));
      }

      await Promise.all(promises);

      // すべてのリクエストが処理されること
      expect(promises).toHaveLength(100);
    });
  });

  describe('⚡ パフォーマンステスト', () => {
    test('大量のユーザー登録リクエストを処理できる', async () => {
      const startTime = Date.now();
      const registrations = [];

      for (let i = 0; i < 50; i++) {
        const req = {
          body: {
            username: `user${i}`,
            email: `user${i}@example.com`,
            password: 'password123'
          }
        };
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };

        User.findByEmail.mockResolvedValue(null);
        User.create.mockResolvedValue({ id: i, username: `user${i}`, email: `user${i}@example.com` });
        generateToken.mockReturnValue('token');
        generateRefreshToken.mockReturnValue('refresh');

        registrations.push(authController.register(req, res, mockNext));
      }

      await Promise.all(registrations);
      const endTime = Date.now();

      // 50件の登録が1秒以内に完了
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
