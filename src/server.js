const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Phase 1: PostgreSQL統合対応 - 強制的にPostgreSQLを使用
// Phase 1: PostgreSQL統合対応 - 強制的にPostgreSQLを使用
// Local development fallback: Use SQLite
const db = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const phaseRoutes = require('./routes/phaseRoutes');
const errorHandler = require('./middleware/errorHandler');

// エラー検知・自動修復システム統合
const ErrorDetectionMiddleware = require('./middleware/errorDetectionMiddleware');

const app = express();
const HOST = process.env.HOST_IP || process.env.BACKEND_HOST || '0.0.0.0';
const PORT = process.env.PORT || process.env.BACKEND_PORT || 5000;

// エラー検知システム初期化
const errorDetection = new ErrorDetectionMiddleware({
  enabled: process.env.ERROR_DETECTION_ENABLED === 'true',
  monitors: {
    database: process.env.MONITOR_DATABASE === 'true',
    redis: process.env.MONITOR_REDIS === 'true',
    memory: process.env.MONITOR_MEMORY === 'true',
    api: process.env.MONITOR_API === 'true'
  },
  alerts: {
    console: { enabled: process.env.ALERT_CONSOLE_ENABLED === 'true' },
    email: {
      enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
      smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      from: process.env.ALERT_FROM_EMAIL,
      to: process.env.ALERT_TO_EMAIL?.split(',')
    },
    slack: {
      enabled: process.env.ALERT_SLACK_ENABLED === 'true',
      webhookUrl: process.env.SLACK_WEBHOOK_URL
    },
    discord: {
      enabled: process.env.ALERT_DISCORD_ENABLED === 'true',
      webhookUrl: process.env.DISCORD_WEBHOOK_URL
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/phases', phaseRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Recipe API is running' });
});

// Error handling
app.use(errorHandler);

// Initialize database and start server
db.initialize().then(async () => {
  // エラー検知システム初期化
  // await errorDetection.initialize();

  // Express統合
  // errorDetection.integrate(app);

  app.listen(PORT, HOST, () => {
    const hostDisplay = HOST === '0.0.0.0' ? (process.env.HOST_IP || 'assigned-ip') : HOST;
    console.log(`🚀 Server is running on http://${hostDisplay}:${PORT}`);
    console.log(`📊 Health Check: http://${hostDisplay}:${PORT}/api/health/monitoring`);
    console.log(`📈 Metrics: http://${hostDisplay}:${PORT}/api/metrics`);
    // console.log('🔧 エラー検知・自動修復システム稼働中');
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = app;