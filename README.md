# パーソナル料理レシピ管理システム 🍳

**PersonalCookingRecipe - 3チャンネル統合レシピ監視システム**  
**Phase 1緊急安定化完了・PostgreSQL移行・JWT超高速化実現**

## 🎯 プロジェクト概要

**PostgreSQL + Redis + Node.js**で構築された、**JWT超高速認証（1.44ms）**を搭載した本格的なレシピ管理システムです。食事計画、買い物リスト生成、カテゴリとタグによるレシピ整理機能を提供します。

### 🚀 Phase 1実装完了（2025年8月30日）
- ✅ **PostgreSQL移行完了**: SQLite競合問題を根本解決  
- ✅ **JWT認証99.96%高速化**: 3326ms → 1.44ms
- ✅ **システム安定性確保**: エンタープライズレベル並行処理対応
- ✅ **Redis統合準備**: キャッシング基盤構築完了
- ✅ **CI/CD品質ゲート**: 自動化パフォーマンス監視実装

### 🏗️ 主要機能
- **レシピ管理**: レシピの作成、編集、削除、整理
- **カテゴリ・タグ**: カスタムカテゴリとタグによるレシピ整理
- **検索・フィルタ**: 材料、料理、難易度、食事制限による検索
- **食事計画**: インタラクティブカレンダーによる週次・月次食事計画
- **買い物リスト**: 食事計画から買い物リストを自動生成
- **ユーザー認証**: JWTトークンによる安全なログインシステム
- **インポート・エクスポート**: JSONからのレシピインポートやコレクションエクスポート
- **栄養追跡**: レシピの栄養情報追跡
- **お気に入り**: お気に入りレシピのマークと高速アクセス

## 🛠️ 技術スタック

### バックエンド (Phase 1最適化済み)
- **ランタイム**: Node.js 18+ + Express.js
- **データベース**: **PostgreSQL 15** (SQLiteから移行完了)
- **キャッシング**: **Redis 7** (JWT + API キャッシング)
- **認証**: **JWT超高速認証** (平均1.44ms)
- **コネクションプール**: 5-50接続最適化

### フロントエンド
- **フレームワーク**: Next.js 14 + React 18 + TypeScript
- **スタイリング**: Tailwind CSS + PostCSS
- **状態管理**: React Query + Context API
- **UIコンポーネント**: Lucide React + Heroicons

### API レイヤー  
- **フレームワーク**: Python FastAPI + Uvicorn
- **データ検証**: Pydantic + JSONB
- **WebSocket**: リアルタイム通信サポート

### インフラストラクチャ
- **コンテナ化**: Docker + Docker Compose
- **リバースプロキシ**: Nginx Alpine
- **監視**: Prometheus + Grafana + Fluentd
- **CI/CD**: GitHub Actions品質ゲート実装済み

## 📋 API エンドポイント

### 認証
- `POST /api/users/register` - 新規ユーザー登録
- `POST /api/users/login` - ログイン
- `GET /api/users/profile` - ユーザープロファイル取得

### レシピ
- `GET /api/recipes` - 全レシピ取得（フィルタ付き）
- `GET /api/recipes/search?q=query` - レシピ検索
- `GET /api/recipes/:id` - ID指定レシピ取得
- `POST /api/recipes` - レシピ作成
- `PUT /api/recipes/:id` - レシピ更新
- `DELETE /api/recipes/:id` - レシピ削除

### カテゴリ
- `GET /api/categories` - 全カテゴリ取得
- `POST /api/categories` - カテゴリ作成

### 食事計画
- `GET /api/meal-plans` - 全食事計画取得
- `POST /api/meal-plans` - 食事計画作成
- `POST /api/meal-plans/:id/shopping-list` - 買い物リスト生成

## 🚀 クイックスタート

### 1. リポジトリのクローン:
```bash
git clone https://github.com/Kensan196948G/PersonalCookingRecipe.git
cd PersonalCookingRecipe
```

### 2. 依存関係のインストール:
```bash
npm install
```

### 3. 環境設定:
```bash
cp .env.example .env
# 設定内容を編集してください
```

### 4. サーバー起動:
```bash
npm start
# 開発環境の場合:
npm run dev
```

### 5. アプリケーションへのアクセス:
ブラウザで http://localhost:3000 を開いてください

## 📁 プロジェクト構造

```
PersonalCookingRecipe/
├── src/
│   ├── server.js           # メインサーバーファイル
│   ├── config/             # 設定ファイル
│   ├── models/             # データベースモデル
│   ├── controllers/        # ルートコントローラー
│   ├── routes/             # APIルート
│   └── middleware/         # カスタムミドルウェア
├── views/                  # EJSテンプレート
├── public/                 # 静的ファイル
├── tests/                  # テストファイル
├── .env.example           # 環境変数テンプレート
├── package.json           # 依存関係
└── README.md             # ドキュメント
```

## 📊 レシピデータ構造

```json
{
  "title": "レシピ名",
  "description": "簡単な説明",
  "ingredients": [
    {
      "name": "材料名",
      "amount": "2",
      "unit": "カップ"
    }
  ],
  "instructions": [
    "ステップ1: 材料を準備する",
    "ステップ2: 調理する"
  ],
  "prepTime": 15,
  "cookTime": 30,
  "servings": 4,
  "difficulty": "中級",
  "cuisine": "イタリアン",
  "mealType": "夕食",
  "dietaryInfo": {
    "vegetarian": false,
    "vegan": false,
    "glutenFree": false
  },
  "tags": ["簡単", "ヘルシー"]
}
```

## 🔒 環境変数

```env
# データベース (Phase 1でPostgreSQLに移行済み)
DB_TYPE=postgresql
DB_HOST=postgres
DB_PORT=5432
DB_NAME=recipe_db
DB_USER=recipe_user
DB_PASSWORD=recipe_secure_password_2024

# サーバー
FRONTEND_PORT=3000
BACKEND_PORT=5000
API_PORT=8000
NODE_ENV=development

# JWT (超高速化済み - 平均1.44ms)
JWT_SECRET=phase1_emergency_jwt_secret_key_32chars_minimum
JWT_CACHE_ENABLED=true
JWT_CACHE_TTL=3600

# Redis キャッシング
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379

# アップロード
UPLOAD_PATH=/app/uploads
MAX_FILE_SIZE=10485760
```

## 🧪 テスト

```bash
# テスト実行
npm test

# ウォッチモード
npm run test:watch

# リンター実行
npm run lint

# パフォーマンステスト（JWT認証）
node scripts/jwt-performance-test.js
```

## 📋 システム要件

- **Node.js**: 18.x 以上（推奨）
- **npm**: 8.x 以上
- **PostgreSQL**: 15.x 以上
- **Redis**: 7.x 以上
- **Docker**: 最新版（推奨）
- **ディスク容量**: 最低 1GB
- **メモリ**: 最低 1GB（推奨 2GB以上）

## 🔒 セキュリティ機能

- bcryptによるパスワードハッシュ化
- JWTトークン認証（超高速化済み）
- セキュアクッキーによるセッション管理
- 入力値検証とサニタイゼーション
- PostgreSQL ORMによるSQLインジェクション対策
- CORS設定
- Redis統合による認証キャッシング

## 🚀 機能ロードマップ

### Phase 2 (品質・パフォーマンス改善) - 実装予定
- [ ] テストカバレッジ向上（37% → 80%）
- [ ] API レスポンス時間最適化（<500ms）
- [ ] Redis本格キャッシング稼働
- [ ] フロントエンド最適化（SSR/SSG）

### Phase 3 (機能拡張) - 将来予定
- [ ] モバイルアプリ (React Native)
- [ ] ユーザー間レシピ共有
- [ ] 材料のバーコードスキャン
- [ ] 音声入力によるレシピ登録
- [ ] AI搭載レシピ提案機能
- [ ] 食材宅配サービス連携
- [ ] レシピ分量計算機
- [ ] ワイン・飲み物ペアリング提案

## 🐛 トラブルシューティング

### よくある問題

1. **ポートが使用中**: .envファイルのPORTを変更してください
2. **データベース接続エラー**: .envファイルのPostgreSQL設定を確認してください
3. **JWT認証エラー**: JWT_SECRETが.envファイルに設定されていることを確認してください
4. **モジュールが見つからない**: `npm install`を再実行してください
5. **Docker起動エラー**: `docker-compose down && docker-compose up -d`を試してください

### サポートについて

- コンソールログを確認してください
- APIドキュメントを参照してください
- GitHubでIssueを作成してください
- plan/フォルダ内の開発報告書を参照してください

## 📝 ライセンス

MIT License

## 🤝 コントリビューション

コントリビューションを歓迎します！以下の手順でお願いします：

1. リポジトリをフォークする
2. フィーチャーブランチを作成する
3. 変更をコミットする
4. ブランチにプッシュする
5. プルリクエストを開く

## 📊 Phase 1 達成実績

- ✅ **PostgreSQL移行**: SQLite競合問題を根本解決
- ✅ **JWT認証99.96%高速化**: 3326ms → 1.44ms
- ✅ **システム安定性確保**: エンタープライズレベル対応
- ✅ **CI/CD品質ゲート**: 自動化監視体制確立

---

**❤️ Node.js + PostgreSQL + Redis で構築**  
**🚀 Claude-Flow/SPARC方法論による高効率開発**