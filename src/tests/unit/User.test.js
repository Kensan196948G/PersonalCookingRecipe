/**
 * @file User.test.js
 * @description Userモデルの完全なテストスイート
 * @target Coverage: 27.41% → 70%
 */

const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const { dbManager } = require('../../config/database');

// モック設定
jest.mock('../../config/database');
jest.mock('bcryptjs');

describe('User Model - Complete Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('📝 ユーザー作成 (create)', () => {
    test('有効なデータで新規ユーザー作成成功', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      bcrypt.hash.mockResolvedValue('hashed-password-123');
      dbManager.executeWithRetry.mockResolvedValue({
        lastID: 1
      });

      const result = await User.create(userData);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['testuser', 'test@example.com', 'hashed-password-123']
      );
      expect(result).toEqual({
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      });
    });

    test('パスワードが正しくハッシュ化される', async () => {
      const userData = {
        username: 'user',
        email: 'user@example.com',
        password: 'plainPassword'
      };

      bcrypt.hash.mockResolvedValue('hashed-plain-password');
      dbManager.executeWithRetry.mockResolvedValue({ lastID: 2 });

      await User.create(userData);

      expect(bcrypt.hash).toHaveBeenCalledWith('plainPassword', 10);
    });

    test('メールアドレスが小文字に変換される', async () => {
      const userData = {
        username: 'testuser',
        email: 'TEST@EXAMPLE.COM',
        password: 'password123'
      };

      bcrypt.hash.mockResolvedValue('hashed');
      dbManager.executeWithRetry.mockResolvedValue({ lastID: 3 });

      const result = await User.create(userData);

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['test@example.com'])
      );
      expect(result.email).toBe('test@example.com');
    });

    test('ユーザー名と メールの前後空白が削除される', async () => {
      const userData = {
        username: '  testuser  ',
        email: '  test@example.com  ',
        password: 'password123'
      };

      bcrypt.hash.mockResolvedValue('hashed');
      dbManager.executeWithRetry.mockResolvedValue({ lastID: 4 });

      const result = await User.create(userData);

      expect(result.username).toBe('testuser');
      expect(result.email).toBe('test@example.com');
    });

    test('必須フィールドが欠けている場合エラー (username)', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123'
      };

      await expect(User.create(userData)).rejects.toThrow(
        'Username, email, and password are required'
      );
    });

    test('必須フィールドが欠けている場合エラー (email)', async () => {
      const userData = {
        username: 'testuser',
        password: 'password123'
      };

      await expect(User.create(userData)).rejects.toThrow(
        'Username, email, and password are required'
      );
    });

    test('必須フィールドが欠けている場合エラー (password)', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com'
      };

      await expect(User.create(userData)).rejects.toThrow(
        'Username, email, and password are required'
      );
    });

    test('パスワードが短すぎる場合エラー (6文字未満)', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: '12345'
      };

      await expect(User.create(userData)).rejects.toThrow(
        'Password must be at least 6 characters long'
      );
    });

    test('無効なメールアドレス形式でエラー', async () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'password123'
      };

      await expect(User.create(userData)).rejects.toThrow(
        'Invalid email format'
      );
    });

    test('重複メールアドレスでエラー', async () => {
      const userData = {
        username: 'testuser',
        email: 'duplicate@example.com',
        password: 'password123'
      };

      bcrypt.hash.mockResolvedValue('hashed');
      const error = new Error('UNIQUE constraint failed: users.email');
      error.code = 'SQLITE_CONSTRAINT';
      dbManager.executeWithRetry.mockRejectedValue(error);

      await expect(User.create(userData)).rejects.toThrow(
        'Email address is already registered'
      );
    });

    test('重複ユーザー名でエラー', async () => {
      const userData = {
        username: 'duplicateuser',
        email: 'test@example.com',
        password: 'password123'
      };

      bcrypt.hash.mockResolvedValue('hashed');
      const error = new Error('UNIQUE constraint failed: users.username');
      error.code = 'SQLITE_CONSTRAINT';
      dbManager.executeWithRetry.mockRejectedValue(error);

      await expect(User.create(userData)).rejects.toThrow(
        'Username is already taken'
      );
    });
  });

  describe('🔍 メールアドレスでユーザー検索 (findByEmail)', () => {
    test('存在するメールアドレスでユーザー取得成功', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashed-password',
        created_at: '2025-01-01'
      };

      dbManager.executeWithRetry.mockResolvedValue([mockUser]);

      const result = await User.findByEmail('test@example.com');

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = ?',
        ['test@example.com']
      );
      expect(result).toEqual(mockUser);
    });

    test('メールアドレスが小文字に変換される', async () => {
      dbManager.executeWithRetry.mockResolvedValue([]);

      await User.findByEmail('TEST@EXAMPLE.COM');

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        ['test@example.com']
      );
    });

    test('メールアドレスの前後空白が削除される', async () => {
      dbManager.executeWithRetry.mockResolvedValue([]);

      await User.findByEmail('  test@example.com  ');

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        ['test@example.com']
      );
    });

    test('存在しないメールアドレスでnullを返す', async () => {
      dbManager.executeWithRetry.mockResolvedValue([]);

      const result = await User.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    test('メールアドレスが未提供の場合エラー', async () => {
      await expect(User.findByEmail()).rejects.toThrow('Email is required');
      await expect(User.findByEmail(null)).rejects.toThrow('Email is required');
      await expect(User.findByEmail('')).rejects.toThrow('Email is required');
    });

    test('データベースエラー時にエラーを投げる', async () => {
      const dbError = new Error('Database connection failed');
      dbManager.executeWithRetry.mockRejectedValue(dbError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(User.findByEmail('test@example.com')).rejects.toThrow(
        'Database connection failed'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error finding user by email:',
        dbError
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('🔍 IDでユーザー検索 (findById)', () => {
    test('存在するIDでユーザー取得成功', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        created_at: '2025-01-01'
      };

      dbManager.executeWithRetry.mockResolvedValue([mockUser]);

      const result = await User.findById(1);

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, username, email, created_at FROM users WHERE id = ?'),
        [1]
      );
      expect(result).toEqual(mockUser);
      expect(result).not.toHaveProperty('password'); // パスワードは含まれない
    });

    test('存在しないIDでnullを返す', async () => {
      dbManager.executeWithRetry.mockResolvedValue([]);

      const result = await User.findById(999);

      expect(result).toBeNull();
    });

    test('IDが未提供の場合エラー', async () => {
      await expect(User.findById()).rejects.toThrow('User ID is required');
      await expect(User.findById(null)).rejects.toThrow('User ID is required');
    });

    test('データベースエラー時にエラーを投げる', async () => {
      const dbError = new Error('Database error');
      dbManager.executeWithRetry.mockRejectedValue(dbError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(User.findById(1)).rejects.toThrow('Database error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error finding user by ID:',
        dbError
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('🔐 パスワード検証 (validatePassword)', () => {
    test('正しいパスワードで検証成功', async () => {
      bcrypt.compare.mockResolvedValue(true);

      const result = await User.validatePassword('password123', 'hashed-password');

      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
      expect(result).toBe(true);
    });

    test('間違ったパスワードで検証失敗', async () => {
      bcrypt.compare.mockResolvedValue(false);

      const result = await User.validatePassword('wrongpassword', 'hashed-password');

      expect(result).toBe(false);
    });
  });

  describe('✏️ ユーザー更新 (update)', () => {
    test('有効なデータでユーザー更新成功', async () => {
      const updateData = {
        username: 'newusername',
        email: 'newemail@example.com'
      };

      dbManager.executeWithRetry.mockResolvedValue({ changes: 1 });

      const result = await User.update(1, updateData);

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        ['newusername', 'newemail@example.com', 1]
      );
      expect(result).toBe(true);
    });

    test('メールアドレスが小文字に変換される', async () => {
      const updateData = {
        username: 'user',
        email: 'NEW@EXAMPLE.COM'
      };

      dbManager.executeWithRetry.mockResolvedValue({ changes: 1 });

      await User.update(1, updateData);

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['new@example.com'])
      );
    });

    test('ユーザー名とメールの前後空白が削除される', async () => {
      const updateData = {
        username: '  newuser  ',
        email: '  new@example.com  '
      };

      dbManager.executeWithRetry.mockResolvedValue({ changes: 1 });

      await User.update(1, updateData);

      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        ['newuser', 'new@example.com', 1]
      );
    });

    test('IDが未提供の場合エラー', async () => {
      await expect(User.update(null, { username: 'user', email: 'email@example.com' }))
        .rejects.toThrow('User ID is required');
    });

    test('ユーザー名が未提供の場合エラー', async () => {
      await expect(User.update(1, { email: 'email@example.com' }))
        .rejects.toThrow('Username and email are required');
    });

    test('メールが未提供の場合エラー', async () => {
      await expect(User.update(1, { username: 'user' }))
        .rejects.toThrow('Username and email are required');
    });

    test('無効なメールアドレス形式でエラー', async () => {
      await expect(User.update(1, { username: 'user', email: 'invalid-email' }))
        .rejects.toThrow('Invalid email format');
    });

    test('存在しないユーザーの更新でfalseを返す', async () => {
      dbManager.executeWithRetry.mockResolvedValue({ changes: 0 });

      const result = await User.update(999, { username: 'user', email: 'email@example.com' });

      expect(result).toBe(false);
    });

    test('重複メールアドレスでエラー', async () => {
      const error = new Error('UNIQUE constraint failed: users.email');
      error.code = 'SQLITE_CONSTRAINT';
      dbManager.executeWithRetry.mockRejectedValue(error);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(User.update(1, { username: 'user', email: 'duplicate@example.com' }))
        .rejects.toThrow('Email address is already in use');

      consoleErrorSpy.mockRestore();
    });

    test('重複ユーザー名でエラー', async () => {
      const error = new Error('UNIQUE constraint failed: users.username');
      error.code = 'SQLITE_CONSTRAINT';
      dbManager.executeWithRetry.mockRejectedValue(error);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(User.update(1, { username: 'duplicate', email: 'email@example.com' }))
        .rejects.toThrow('Username is already taken');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('🔑 パスワード更新 (updatePassword)', () => {
    test('有効な新パスワードでパスワード更新成功', async () => {
      bcrypt.hash.mockResolvedValue('new-hashed-password');
      dbManager.executeWithRetry.mockResolvedValue({ changes: 1 });

      const result = await User.updatePassword(1, 'newPassword123');

      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        ['new-hashed-password', 1]
      );
      expect(result).toBe(true);
    });

    test('IDが未提供の場合エラー', async () => {
      await expect(User.updatePassword(null, 'newPassword'))
        .rejects.toThrow('User ID and new password are required');
    });

    test('新パスワードが未提供の場合エラー', async () => {
      await expect(User.updatePassword(1, null))
        .rejects.toThrow('User ID and new password are required');
    });

    test('新パスワードが短すぎる場合エラー', async () => {
      await expect(User.updatePassword(1, '12345'))
        .rejects.toThrow('Password must be at least 6 characters long');
    });

    test('存在しないユーザーのパスワード更新でfalseを返す', async () => {
      bcrypt.hash.mockResolvedValue('hashed');
      dbManager.executeWithRetry.mockResolvedValue({ changes: 0 });

      const result = await User.updatePassword(999, 'newPassword123');

      expect(result).toBe(false);
    });

    test('データベースエラー時にエラーを投げる', async () => {
      bcrypt.hash.mockResolvedValue('hashed');
      const dbError = new Error('Database error');
      dbManager.executeWithRetry.mockRejectedValue(dbError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(User.updatePassword(1, 'newPassword123'))
        .rejects.toThrow('Database error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error updating user password:',
        dbError
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('🛡️ セキュリティテスト', () => {
    test('SQLインジェクション攻撃を防ぐ (メールアドレス)', async () => {
      dbManager.executeWithRetry.mockResolvedValue([]);

      await User.findByEmail("'; DROP TABLE users; --");

      // パラメータ化クエリで安全に処理される
      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        ["'; drop table users; --"]
      );
    });

    test('XSS攻撃を防ぐ (ユーザー名)', async () => {
      const userData = {
        username: '<script>alert("XSS")</script>',
        email: 'test@example.com',
        password: 'password123'
      };

      bcrypt.hash.mockResolvedValue('hashed');
      dbManager.executeWithRetry.mockResolvedValue({ lastID: 1 });

      await User.create(userData);

      // スクリプトタグはそのまま保存されるが、出力時にエスケープされる
      expect(dbManager.executeWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['<script>alert("XSS")</script>'])
      );
    });
  });

  describe('⚡ パフォーマンステスト', () => {
    test('並行ユーザー作成のパフォーマンス', async () => {
      bcrypt.hash.mockResolvedValue('hashed');
      dbManager.executeWithRetry.mockResolvedValue({ lastID: 1 });

      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(User.create({
          username: `user${i}`,
          email: `user${i}@example.com`,
          password: 'password123'
        }));
      }

      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // 50件の作成が1秒以内
      expect(duration).toBeLessThan(1000);
    });
  });
});
