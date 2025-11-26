# Personal Recipe Frontend

Next.js + TypeScript + Tailwind CSSで構築されたモダンなレシピ管理アプリケーションのフロントエンドです。

## 🚀 主な機能

- **レシピ管理**: 作成、編集、削除、検索
- **ユーザー認証**: JWT認証によるセキュアなログイン
- **外部サービス統合**: YouTube、Notion、Gmail連携
- **レスポンシブデザイン**: モバイル・デスクトップ対応
- **リアルタイム検索**: 高度なフィルタリング機能
- **画像アップロード**: レシピ画像の管理

## 🛠️ 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **状態管理**: React Query
- **認証**: カスタムJWT + Context API
- **アイコン**: Lucide React
- **HTTP クライアント**: Axios

## 📁 プロジェクト構造

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx         # ルートレイアウト
│   │   ├── page.tsx           # ホームページ
│   │   └── globals.css        # グローバルスタイル
│   ├── components/            # Reactコンポーネント
│   │   └── Layout/            # レイアウトコンポーネント
│   ├── hooks/                 # カスタムフック
│   │   ├── useAuth.ts         # 認証フック
│   │   └── useRecipes.ts      # レシピ管理フック
│   ├── services/              # APIサービス
│   │   └── api.ts             # API統合
│   ├── types/                 # TypeScript型定義
│   │   └── api.ts             # API型定義
│   └── utils/                 # ユーティリティ関数
├── public/                    # 静的ファイル
├── package.json               # 依存関係
├── next.config.js             # Next.js設定
├── tailwind.config.js         # Tailwind設定
└── tsconfig.json              # TypeScript設定
```

## 🏃‍♂️ セットアップ・起動方法

### 1. 依存関係のインストール

```bash
cd frontend
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env.local
```

`.env.local`ファイルを編集して、必要な環境変数を設定：

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_YOUTUBE_API_KEY=your-youtube-api-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NOTION_API_KEY=your-notion-api-key
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

アプリケーションは http://localhost:3000 で起動します。

## 🔧 利用可能なスクリプト

- `npm run dev` - 開発サーバーを起動
- `npm run build` - 本番用ビルドを作成
- `npm start` - 本番用サーバーを起動
- `npm run lint` - ESLintでコードをチェック
- `npm run type-check` - TypeScriptの型チェック

## 📊 APIとの統合

このフロントエンドは以下のAPIエンドポイントと統合されています：

### 認証API
- `POST /auth/login` - ユーザーログイン
- `POST /auth/register` - ユーザー登録
- `GET /auth/me` - 現在のユーザー情報取得
- `POST /auth/logout` - ログアウト

### レシピAPI
- `GET /api/recipes` - レシピ一覧取得
- `POST /api/recipes` - レシピ作成
- `GET /api/recipes/:id` - 特定レシピ取得
- `PUT /api/recipes/:id` - レシピ更新
- `DELETE /api/recipes/:id` - レシピ削除

### 外部サービスAPI
- `GET /api/youtube/search` - YouTube検索
- `GET /api/notion/pages` - Notionページ取得
- `POST /api/gmail/send-recipe` - Gmail送信
- `POST /api/upload/image` - 画像アップロード

## 🎨 スタイリング

### Tailwind CSSクラス

カスタムコンポーネントクラス：

```css
.btn-primary      - プライマリボタン
.btn-secondary    - セカンダリボタン
.btn-outline      - アウトラインボタン
.card             - カードコンテナ
.form-input       - フォーム入力
.badge            - バッジ
.difficulty-*     - 難易度バッジ
```

### レスポンシブデザイン

- **モバイルファースト**: sm: (640px+), md: (768px+), lg: (1024px+)
- **フレキシブルグリッド**: レシピカードのレスポンシブ表示
- **ナビゲーション**: モバイルメニューの自動切り替え

## 🔐 認証システム

### JWT認証フロー

1. ログイン後、JWTトークンをlocalStorageに保存
2. APIリクエスト時に`Authorization: Bearer <token>`ヘッダーを自動付与
3. トークン有効期限切れ時に自動ログアウト
4. React Contextで認証状態を管理

### 認証フック使用例

```typescript
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { user, login, logout, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <LoginForm />;
  }
  
  return <div>Welcome, {user?.name}!</div>;
}
```

## 📱 外部サービス統合

### YouTube統合
- 料理動画の自動検索
- レシピに関連する動画表示
- お気に入り動画の保存

### Notion統合
- レシピページのインポート
- 双方向データ同期
- 既存ワークフローとの連携

### Gmail統合
- レシピの簡単共有
- 買い物リストの送信
- 家族・友人への共有機能

## 🧪 テスト戦略

### テスト環境セットアップ

```bash
# テストライブラリのインストール (今後追加予定)
npm install --save-dev @testing-library/react @testing-library/jest-dom jest
```

### テスト対象
- **コンポーネントテスト**: UI要素の表示・操作
- **フックテスト**: カスタムフックの動作
- **APIテスト**: サービス層のテスト
- **統合テスト**: エンドツーエンドフロー

## 📈 パフォーマンス最適化

### 実装済み最適化
- **React Query**: APIキャッシングとデータフェッチング最適化
- **Next.js Image**: 画像の自動最適化
- **Code Splitting**: ページベースの自動コード分割
- **Lazy Loading**: コンポーネントの遅延読み込み

### パフォーマンス指標
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **Time to Interactive**: < 3.8s

## 🚀 デプロイメント

### Vercelデプロイ

```bash
# Vercel CLIを使用
npm install -g vercel
vercel
```

### 環境変数設定

本番環境では以下の環境変数を設定：

- `NEXT_PUBLIC_API_BASE_URL` - 本番APIのURL
- `NEXT_PUBLIC_YOUTUBE_API_KEY` - YouTube API Key
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID
- `NOTION_API_KEY` - Notion API Key

## 🤝 開発ワークフロー

### Git ワークフロー

1. **Feature Branch**: `feature/recipe-creation`
2. **Development**: 開発・テスト実施
3. **Pull Request**: コードレビュー
4. **Merge**: mainブランチへマージ
5. **Deploy**: 自動デプロイ

### コード品質

- **TypeScript**: 型安全性の確保
- **ESLint**: コード品質チェック
- **Prettier**: コードフォーマット
- **Husky**: Git hookでの品質チェック

## 🔧 今後の機能拡張

### 予定機能
- [ ] PWA対応 (オフライン機能)
- [ ] プッシュ通知
- [ ] レシピ共有機能
- [ ] 評価・レビューシステム
- [ ] 栄養情報表示
- [ ] 買い物リスト自動生成
- [ ] 音声入力対応
- [ ] AI料理アシスタント

### 技術的改善
- [ ] テストカバレッジ向上
- [ ] パフォーマンス監視
- [ ] アクセシビリティ改善
- [ ] SEO最適化
- [ ] セキュリティ強化

## 📞 サポート・問い合わせ

- **GitHub Issues**: バグレポート・機能要望
- **Documentation**: 詳細ドキュメント
- **Email**: 技術サポート

---

**Personal Recipe Frontend** - あなただけの特別なレシピコレクションを始めましょう！