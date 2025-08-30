# Personal Cooking Recipe Monitor - Frontend

React UIコンポーネントシステム for 3チャンネル統合レシピ監視システム

## 🚀 Features

### メインダッシュボード
- レシピカード表示（グリッドレイアウト）
- 高速検索・フィルタ機能
- チャンネル別表示
- リアルタイム更新
- レスポンシブデザイン

### レシピ詳細ビュー
- YouTube動画埋め込み（react-youtube）
- インタラクティブな材料リスト
- ステップバイステップの手順表示
- 調理タイマー機能
- 翻訳切り替え対応

### 設定画面
- API設定管理（YouTube, Notion, Tasty）
- 監視設定
- 通知設定
- システム状態表示

### 管理機能
- リアルタイムログ表示
- システム統計情報
- ヘルス監視
- エラー管理

## 🛠 Technical Stack

- **React 18** with TypeScript
- **Material-UI (MUI v5)** for UI components
- **React Router v6** for routing
- **TanStack Query (React Query v4)** for data fetching
- **Zustand** for state management
- **Vite** for build tooling
- **React YouTube** for video embedding

## 📱 Design Features

- **レスポンシブデザイン**: Mobile-first approach
- **Material Design 3**: Modern UI/UX
- **PWA対応**: Offline functionality
- **アクセシビリティ**: WCAG 2.1 準拠
- **macOS Safari最適化**: Native-like experience

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Configure API endpoints
VITE_API_BASE_URL=http://localhost:8000/api
```

## 📁 Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── Common/          # Common components (Loading, ErrorBoundary)
│   ├── Dashboard/       # Dashboard-specific components
│   ├── RecipeDetail/    # Recipe detail components
│   ├── Settings/        # Settings components
│   ├── Admin/          # Admin panel components
│   └── Layout/         # Layout components
├── pages/              # Page components
│   ├── Home/          # Dashboard page
│   ├── Recipe/        # Recipe detail page
│   ├── Settings/      # Settings page
│   └── Admin/         # Admin page
├── hooks/             # Custom React hooks
├── utils/             # Utility functions
├── types/             # TypeScript type definitions
├── assets/            # Static assets
└── styles/           # Global styles
```

## 🎨 UI Components

### Dashboard Components
- `SearchBar`: Advanced search with filters
- `RecipeCard`: Recipe display card
- `RecipeGrid`: Grid layout for recipes

### Recipe Detail Components
- `VideoPlayer`: YouTube video integration
- `IngredientsList`: Interactive ingredients
- `RecipeSteps`: Step-by-step instructions with timers

### Common Components
- `Loading`: Loading states and skeletons
- `ErrorBoundary`: Error handling
- `AppBar`: Navigation bar

## 🔧 Configuration

### API Configuration
Configure API endpoints in `src/utils/api.ts`:
- YouTube Data API v3
- Notion Integration API
- Tasty API (RapidAPI)

### Theme Customization
Customize theme in `src/utils/theme.ts`:
- Color palette
- Typography
- Component overrides
- Responsive breakpoints

### PWA Configuration
PWA settings in `vite.config.ts`:
- Service worker setup
- Manifest configuration
- Offline caching strategy

## 📱 Responsive Design

### Breakpoints
- **xs**: 0px (mobile)
- **sm**: 600px (small tablet)
- **md**: 900px (tablet)
- **lg**: 1200px (desktop)
- **xl**: 1536px (large desktop)

### Grid Layout
- Mobile: 1 column
- Tablet: 2-3 columns
- Desktop: 3-4 columns
- Large Desktop: 4-5 columns

## 🔄 State Management

### React Query
- Server state management
- Caching strategy
- Background updates
- Error handling

### Local State
- Form state with useState
- UI state with useReducer
- Persistent state with localStorage

## 🚀 Performance Optimizations

### Code Splitting
- Route-based splitting
- Component lazy loading
- Dynamic imports

### Caching Strategy
- React Query caching
- Browser caching
- Service worker caching

### Bundle Optimization
- Tree shaking
- Asset optimization
- Compression

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Run type checking
npm run type-check
```

## 📦 Build & Deploy

### Production Build
```bash
npm run build
```

### Docker Deployment
```bash
# Build Docker image
docker build -t recipe-monitor-frontend .

# Run container
docker run -p 3000:3000 recipe-monitor-frontend
```

## 🔒 Security

- XSS protection
- CSP headers
- Secure API communication
- Environment variable protection

## 🌐 Browser Support

### Supported Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### macOS Safari Optimizations
- `-webkit-backdrop-filter` support
- Touch events optimization
- Smooth scrolling
- Native font rendering

## 📊 Performance Metrics

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Time to Interactive**: < 3.0s
- **Cumulative Layout Shift**: < 0.1

## 🔧 Development Tools

- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Type checking
- **React DevTools**: Development debugging
- **React Query DevTools**: Query debugging

## 📝 API Integration

### Data Types
See `src/types/` for complete TypeScript definitions:
- `Recipe`: Recipe data structure
- `Channel`: Channel information
- `SystemStatus`: System health data
- `ApiConfig`: API configuration

### HTTP Client
Axios-based client with:
- Request/response interceptors
- Error handling
- Authentication
- Retry logic

## 🎯 Accessibility Features

- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation
- Screen reader support
- High contrast mode
- Focus management

## 🌍 Internationalization

Future support for:
- Japanese (ja-JP)
- English (en-US)
- Recipe content translation

## 📚 Documentation

- Component documentation in Storybook
- API documentation with TypeDoc
- User guide in `/docs`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Follow coding standards
4. Add tests for new features
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Check existing GitHub issues
- Create new issue with template
- Include browser and environment details

---

Built with ❤️ for the cooking community