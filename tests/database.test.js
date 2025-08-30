/**
 * データベーステスト - 権限問題とSQLITE競合対策版
 * PersonalCookingRecipe Backend
 */

const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

// テスト用データベース設定
const TEST_DB_PATH = path.join('/tmp', 'test-db', 'backend-test.db');
const TEST_DB_DIR = path.dirname(TEST_DB_PATH);

// テスト前にデータベースディレクトリ作成
beforeAll(async () => {
  // テストDBディレクトリ作成
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }
  
  // 既存のテストDBファイル削除
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  // 環境変数設定
  process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
  process.env.NODE_ENV = 'test';
});

// テスト後クリーンアップ
afterAll(async () => {
  // テストDBファイル削除
  try {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  } catch (error) {
    // エラーを無視（他のプロセスが使用中の可能性）
    console.warn('Test database cleanup warning:', error.message);
  }
});

describe('Database Connection & Setup', () => {
  let database;
  
  beforeEach(() => {
    // データベースモジュールをテストごとにリロード
    jest.resetModules();
  });
  
  afterEach(async () => {
    // データベース接続クローズ
    if (database && database.close) {
      await database.close();
    }
  });

  test('should create test database directory with correct permissions', () => {
    expect(fs.existsSync(TEST_DB_DIR)).toBe(true);
    
    const stats = fs.statSync(TEST_DB_DIR);
    expect(stats.isDirectory()).toBe(true);
    
    // ディレクトリが書き込み可能かチェック
    expect(() => {
      fs.accessSync(TEST_DB_DIR, fs.constants.W_OK);
    }).not.toThrow();
  });

  test('should initialize database with proper schema', async () => {
    // データベース初期化のテスト
    const Database = require('sqlite3').Database;
    
    return new Promise((resolve, reject) => {
      database = new Database(TEST_DB_PATH, (err) => {
        if (err) {
          reject(new Error(`Database creation failed: ${err.message}`));
          return;
        }

        // 基本的なテーブル作成
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS test_table (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `;

        database.run(createTableSQL, (err) => {
          if (err) {
            reject(new Error(`Table creation failed: ${err.message}`));
            return;
          }

          // テーブル存在確認
          database.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'",
            (err, row) => {
              if (err) {
                reject(err);
                return;
              }
              
              expect(row).toBeTruthy();
              expect(row.name).toBe('test_table');
              resolve();
            }
          );
        });
      });
    });
  });

  test('should handle database operations without SQLITE_READONLY error', async () => {
    const Database = require('sqlite3').Database;
    
    return new Promise((resolve, reject) => {
      database = new Database(TEST_DB_PATH, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // 挿入テスト
        const insertSQL = 'INSERT INTO test_table (name, email) VALUES (?, ?)';
        database.run(insertSQL, ['Test User', 'test@example.com'], function(err) {
          if (err) {
            reject(new Error(`Insert operation failed: ${err.message}`));
            return;
          }

          expect(this.lastID).toBeGreaterThan(0);

          // 選択テスト
          database.get('SELECT * FROM test_table WHERE id = ?', [this.lastID], (err, row) => {
            if (err) {
              reject(err);
              return;
            }

            expect(row).toBeTruthy();
            expect(row.name).toBe('Test User');
            expect(row.email).toBe('test@example.com');

            // 更新テスト
            database.run(
              'UPDATE test_table SET name = ? WHERE id = ?',
              ['Updated User', this.lastID],
              (err) => {
                if (err) {
                  reject(new Error(`Update operation failed: ${err.message}`));
                  return;
                }

                // 削除テスト
                database.run('DELETE FROM test_table WHERE id = ?', [this.lastID], (err) => {
                  if (err) {
                    reject(new Error(`Delete operation failed: ${err.message}`));
                    return;
                  }

                  resolve();
                });
              }
            );
          });
        });
      });
    });
  });

  test('should handle concurrent database access', async () => {
    const Database = require('sqlite3').Database;
    
    // 複数の同時データベース操作をテスト
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
      const promise = new Promise((resolve, reject) => {
        const db = new Database(TEST_DB_PATH, (err) => {
          if (err) {
            reject(err);
            return;
          }

          const testData = {
            name: `Concurrent User ${i}`,
            email: `concurrent${i}@example.com`
          };

          db.run(
            'INSERT INTO test_table (name, email) VALUES (?, ?)',
            [testData.name, testData.email],
            function(err) {
              if (err) {
                db.close();
                reject(new Error(`Concurrent insert ${i} failed: ${err.message}`));
                return;
              }

              db.get('SELECT * FROM test_table WHERE id = ?', [this.lastID], (err, row) => {
                db.close();
                
                if (err) {
                  reject(err);
                  return;
                }

                expect(row.name).toBe(testData.name);
                expect(row.email).toBe(testData.email);
                resolve(row);
              });
            }
          );
        });
      });

      promises.push(promise);
    }

    // 全ての並行操作が完了することを確認
    const results = await Promise.all(promises);
    expect(results).toHaveLength(5);
    
    // 全レコードが正しく挿入されたか確認
    return new Promise((resolve, reject) => {
      database = new Database(TEST_DB_PATH, (err) => {
        if (err) {
          reject(err);
          return;
        }

        database.all('SELECT COUNT(*) as count FROM test_table', (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          expect(rows[0].count).toBeGreaterThanOrEqual(5);
          resolve();
        });
      });
    });
  });

  test('should handle database locking gracefully', async () => {
    const Database = require('sqlite3').Database;
    
    return new Promise((resolve, reject) => {
      // 長時間実行される操作をシミュレート
      const db1 = new Database(TEST_DB_PATH, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // トランザクション開始
        db1.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            db1.close();
            reject(err);
            return;
          }

          db1.run('INSERT INTO test_table (name, email) VALUES (?, ?)',
            ['Lock Test User', 'lock@example.com'], (err) => {
            if (err) {
              db1.close();
              reject(new Error(`Lock test insert failed: ${err.message}`));
              return;
            }

            // 同時に別の接続でアクセス試行
            const db2 = new Database(TEST_DB_PATH, (err) => {
              if (err) {
                db1.run('ROLLBACK', () => db1.close());
                reject(err);
                return;
              }

              // 短いタイムアウトでクエリ実行
              db2.run('INSERT INTO test_table (name, email) VALUES (?, ?)',
                ['Concurrent User', 'concurrent@example.com'], (err) => {
                // エラーが発生してもOK（SQLITE_BUSY予想）
                db2.close();

                // 最初のトランザクションをコミット
                db1.run('COMMIT', (err) => {
                  db1.close();
                  
                  if (err) {
                    reject(new Error(`Commit failed: ${err.message}`));
                    return;
                  }

                  // データベースが正常な状態に戻ったか確認
                  const db3 = new Database(TEST_DB_PATH, (err) => {
                    if (err) {
                      reject(err);
                      return;
                    }

                    db3.get('SELECT COUNT(*) as count FROM test_table', (err, row) => {
                      db3.close();
                      
                      if (err) {
                        reject(err);
                        return;
                      }

                      expect(row.count).toBeGreaterThan(0);
                      resolve();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  test('should create database with proper file permissions', async () => {
    const Database = require('sqlite3').Database;
    
    const testDbPath = path.join(TEST_DB_DIR, 'permission-test.db');
    
    return new Promise((resolve, reject) => {
      const db = new Database(testDbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        db.run('CREATE TABLE IF NOT EXISTS permission_test (id INTEGER)', (err) => {
          db.close();
          
          if (err) {
            reject(err);
            return;
          }

          // ファイル権限チェック
          const stats = fs.statSync(testDbPath);
          const mode = stats.mode & parseInt('777', 8);
          
          // 読み書き可能であることを確認
          expect(mode & parseInt('600', 8)).toBeTruthy();
          
          // クリーンアップ
          fs.unlinkSync(testDbPath);
          resolve();
        });
      });
    });
  });
});

describe('Database Error Handling', () => {
  test('should handle missing database directory gracefully', async () => {
    const badPath = '/non-existent-directory/test.db';
    const Database = require('sqlite3').Database;
    
    return new Promise((resolve) => {
      const db = new Database(badPath, (err) => {
        // エラーが発生することを期待
        expect(err).toBeTruthy();
        expect(err.code).toBe('SQLITE_CANTOPEN');
        resolve();
      });
    });
  });

  test('should handle read-only database scenario', async () => {
    const Database = require('sqlite3').Database;
    const readOnlyPath = path.join(TEST_DB_DIR, 'readonly-test.db');
    
    // まず通常のデータベースを作成
    return new Promise((resolve, reject) => {
      const db = new Database(readOnlyPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        db.run('CREATE TABLE readonly_test (id INTEGER)', (err) => {
          db.close();
          
          if (err) {
            reject(err);
            return;
          }

          // ファイルを読み取り専用に変更
          try {
            fs.chmodSync(readOnlyPath, 0o444);
          } catch (e) {
            // 権限変更に失敗した場合はテストをスキップ
            fs.unlinkSync(readOnlyPath);
            resolve();
            return;
          }

          // 読み取り専用データベースに書き込み試行
          const readOnlyDb = new Database(readOnlyPath, (err) => {
            if (err) {
              // 権限を戻してクリーンアップ
              try {
                fs.chmodSync(readOnlyPath, 0o666);
                fs.unlinkSync(readOnlyPath);
              } catch (e) {
                // クリーンアップエラーは無視
              }
              reject(err);
              return;
            }

            readOnlyDb.run('INSERT INTO readonly_test (id) VALUES (1)', (err) => {
              readOnlyDb.close();
              
              // 権限を戻してクリーンアップ
              try {
                fs.chmodSync(readOnlyPath, 0o666);
                fs.unlinkSync(readOnlyPath);
              } catch (e) {
                // クリーンアップエラーは無視
              }

              // 書き込みエラーが発生することを期待
              if (err && err.code === 'SQLITE_READONLY') {
                resolve(); // 期待される動作
              } else {
                reject(new Error('Expected SQLITE_READONLY error'));
              }
            });
          });
        });
      });
    });
  });
});