# 🚀 テスト実行クイックガイド

## テスト実行コマンド

### 全テスト実行
```bash
cd /mnt/Linux-ExHDD/PersonalCookingRecipe/backend
npm test
```

### カバレッジ付きテスト実行
```bash
cd /mnt/Linux-ExHDD/PersonalCookingRecipe/backend
npm run test:coverage
```

### 特定ファイルのみテスト
```bash
# 認証テストのみ
npm test -- src/tests/unit/authController.test.js

# エラーハンドラーテストのみ
npm test -- src/tests/unit/errorHandler.test.js

# バリデーションテストのみ
npm test -- src/tests/unit/validation.test.js

# キャッシュテストのみ
npm test -- src/tests/unit/cache.test.js
```

### ウォッチモード (開発時)
```bash
npm test -- --watch
```

---

## カバレッジレポート確認

### コンソール出力
```bash
npm run test:coverage
```

### HTMLレポート
```bash
npm run test:coverage
open backend/coverage/lcov-report/index.html
```

---

## 注意事項

### 環境変数設定
テスト実行前に以下の環境変数が必要です:

```bash
export NODE_ENV=test
export JWT_SECRET=test-secret-key
export DATABASE_PATH=./data/test-recipes.db
```

### テストデータベース
- テスト用データベースは自動的に作成されます
- テスト終了後は自動的にクリーンアップされます

---

## トラブルシューティング

### SQLiteエラー
```bash
# SQLiteモジュール再インストール
cd backend
npm rebuild sqlite3
```

### Jestキャッシュクリア
```bash
cd backend
npx jest --clearCache
```

### 依存関係の再インストール
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

---

## 作成されたテストファイル

1. **authController.test.js** - 認証コントローラーテスト (25+ ケース)
2. **errorHandler.test.js** - エラーハンドラーテスト (35+ ケース)
3. **validation.test.js** - バリデーションテスト (30+ ケース)
4. **cache.test.js** - キャッシュテスト (40+ ケース)

**合計**: 130+ テストケース
