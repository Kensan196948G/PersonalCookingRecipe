# 統一認証システム仕様書 - Personal Cooking Recipe

## 🚨 発見された問題

### 1. 設計上の問題
- **全レシピAPIが認証必須**: `router.use(auth)` により、すべてのレシピエンドポイントが認証を要求
- **パブリックアクセス不可**: レシピ一覧・詳細が認証なしで利用不可
- **パフォーマンス劣化**: 認証処理で3.3秒のレスポンス遅延

### 2. 実装の不統一
- **Node.js JWT認証** vs **Python FastAPI認証**の混在
- **エラーレスポンス形式の不統一**
- **CORS設定の複雑化**

## 🎯 統一認証仕様

### 1. エンドポイント分類

#### パブリック（認証不要）
```
GET  /api/recipes             # レシピ一覧取得
GET  /api/recipes/:id         # レシピ詳細取得  
GET  /api/categories          # カテゴリ一覧取得
POST /api/auth/register       # ユーザー登録
POST /api/auth/login          # ログイン
```

#### プライベート（認証必要）
```
POST   /api/recipes           # レシピ作成
PUT    /api/recipes/:id       # レシピ更新
DELETE /api/recipes/:id       # レシピ削除
PUT    /api/recipes/:id/favorite    # お気に入り切り替え
PUT    /api/recipes/:id/rating      # 評価更新
GET    /api/auth/profile      # プロフィール取得
PUT    /api/auth/profile      # プロフィール更新
```

### 2. JWT仕様

#### トークン形式
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": "string",
    "email": "string",
    "username": "string",
    "iat": 1234567890,
    "exp": 1234567890
  }
}
```

#### トークン有効期限
- **アクセストークン**: 15分
- **リフレッシュトークン**: 7日間

### 3. エラーレスポンス統一

#### 成功レスポンス
```json
{
  "success": true,
  "data": {},
  "message": "Success message"
}
```

#### エラーレスポンス
```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_TOKEN",
    "message": "Invalid or expired token",
    "statusCode": 401
  }
}
```

#### エラーコード一覧
```javascript
const ERROR_CODES = {
  // 認証関連
  AUTH_NO_TOKEN: { code: 'AUTH_NO_TOKEN', status: 401, message: 'No token provided' },
  AUTH_INVALID_TOKEN: { code: 'AUTH_INVALID_TOKEN', status: 401, message: 'Invalid or expired token' },
  AUTH_EXPIRED_TOKEN: { code: 'AUTH_EXPIRED_TOKEN', status: 401, message: 'Token has expired' },
  AUTH_INSUFFICIENT_PERMISSIONS: { code: 'AUTH_INSUFFICIENT_PERMISSIONS', status: 403, message: 'Insufficient permissions' },
  
  // ユーザー関連
  USER_NOT_FOUND: { code: 'USER_NOT_FOUND', status: 404, message: 'User not found' },
  USER_ALREADY_EXISTS: { code: 'USER_ALREADY_EXISTS', status: 400, message: 'User already exists' },
  USER_INVALID_CREDENTIALS: { code: 'USER_INVALID_CREDENTIALS', status: 401, message: 'Invalid credentials' },
  
  // レシピ関連
  RECIPE_NOT_FOUND: { code: 'RECIPE_NOT_FOUND', status: 404, message: 'Recipe not found' },
  RECIPE_UNAUTHORIZED: { code: 'RECIPE_UNAUTHORIZED', status: 403, message: 'Not authorized to access this recipe' }
};
```

### 4. ミドルウェア設計

#### 統一認証ミドルウェア
```javascript
// middleware/unifiedAuth.js
const jwt = require('jsonwebtoken');
const { ERROR_CODES } = require('../utils/errorCodes');

const optionalAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      req.isAuthenticated = true;
    } catch (error) {
      req.user = null;
      req.isAuthenticated = false;
    }
  } else {
    req.user = null;
    req.isAuthenticated = false;
  }
  
  next();
};

const requireAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: ERROR_CODES.AUTH_NO_TOKEN
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.isAuthenticated = true;
    next();
  } catch (error) {
    const errorCode = error.name === 'TokenExpiredError' 
      ? ERROR_CODES.AUTH_EXPIRED_TOKEN 
      : ERROR_CODES.AUTH_INVALID_TOKEN;
      
    res.status(errorCode.status).json({
      success: false,
      error: errorCode
    });
  }
};

module.exports = { optionalAuth, requireAuth };
```

### 5. CORS設定最適化

```javascript
// config/cors.js
const corsConfig = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

module.exports = corsConfig;
```

### 6. パフォーマンス最適化

#### JWT検証キャッシュ
```javascript
const NodeCache = require('node-cache');
const tokenCache = new NodeCache({ stdTTL: 300 }); // 5分キャッシュ

const optimizedTokenVerification = (token) => {
  // キャッシュ確認
  const cached = tokenCache.get(token);
  if (cached) return cached;
  
  // JWT検証
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
  // キャッシュに保存
  tokenCache.set(token, decoded);
  return decoded;
};
```

#### 非同期認証
```javascript
const asyncAuth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (token) {
    try {
      // 非同期でトークン検証
      const decoded = await Promise.resolve(optimizedTokenVerification(token));
      req.user = decoded;
      req.isAuthenticated = true;
    } catch (error) {
      req.user = null;
      req.isAuthenticated = false;
    }
  }
  
  next();
};
```

## 🔄 実装計画

### Phase 1: 基盤整備
1. エラーコード統一
2. 統一ミドルウェア実装
3. CORS設定最適化

### Phase 2: ルート修正
1. パブリックレシピAPI実装
2. 認証必須ルートの最適化
3. エラーハンドリング統一

### Phase 3: パフォーマンス最適化
1. JWT検証キャッシュ実装
2. 非同期認証処理
3. パフォーマンステスト

### Phase 4: フロントエンド統合
1. 統一APIクライアント
2. エラーハンドリング統合
3. 認証フック最適化

## 📊 パフォーマンス目標

- **認証処理時間**: 3.3秒 → 50ms以下
- **レスポンス時間**: 平均200ms以下
- **トークン検証**: キャッシュヒット率 > 80%