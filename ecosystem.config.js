// PersonalCookingRecipe PM2エコシステム設定
// フロントエンド（Next.js）、バックエンド（Express）、監視システムの統合管理

module.exports = {
  apps: [
    {
      name: 'recipe-frontend',
      cwd: '/mnt/Linux-ExHDD/PersonalCookingRecipe/frontend',
      script: 'npm',
      args: 'run dev',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        NEXT_TELEMETRY_DISABLED: 1
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      error_file: '../logs/frontend-error.log',
      out_file: '../logs/frontend-out.log',
      log_file: '../logs/frontend-combined.log',
      time: true,
      merge_logs: true,
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000
    },
    {
      name: 'recipe-backend',
      cwd: '/mnt/Linux-ExHDD/PersonalCookingRecipe/backend',
      script: 'npm',
      args: 'run dev',
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        CORS_ORIGIN: 'http://localhost:3000',
        MONITORING_ENABLED: 'true'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '300M',
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      log_file: '../logs/backend-combined.log',
      time: true,
      merge_logs: true,
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000
    },
    {
      name: 'recipe-monitoring-collector',
      cwd: '/mnt/Linux-ExHDD/PersonalCookingRecipe/backend',
      script: 'src/monitoring/start-collector.js',
      env: {
        NODE_ENV: 'production',
        MONITORING_DB: 'sqlite',
        SQLITE_DB_PATH: '/mnt/Linux-ExHDD/PersonalCookingRecipe/backend/data/monitoring.db',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        MONITORING_ENABLED: 'true',
        METRICS_RETENTION_DAYS: 30
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '200M',
      error_file: '../logs/monitoring-collector-error.log',
      out_file: '../logs/monitoring-collector-out.log',
      log_file: '../logs/monitoring-collector-combined.log',
      time: true,
      merge_logs: true,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '30s',
      kill_timeout: 10000,
      cron_restart: '0 */6 * * *', // 6時間毎に再起動
      autorestart: true
    },
    {
      name: 'recipe-monitoring-dashboard',
      cwd: '/mnt/Linux-ExHDD/PersonalCookingRecipe/backend',
      script: 'src/monitoring/dashboard/server.js',
      env: {
        NODE_ENV: 'production',
        DASHBOARD_PORT: 5001,
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_NAME: 'recipe_db',
        DB_USER: 'recipe_user',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '150M',
      error_file: '../logs/monitoring-dashboard-error.log',
      out_file: '../logs/monitoring-dashboard-out.log',
      log_file: '../logs/monitoring-dashboard-combined.log',
      time: true,
      merge_logs: true,
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
      autorestart: true
    }
  ],
  
  deploy: {
    production: {
      user: 'recipe',
      host: 'localhost',
      ref: 'origin/main',
      repo: '.',
      path: '/mnt/Linux-ExHDD/PersonalCookingRecipe',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};