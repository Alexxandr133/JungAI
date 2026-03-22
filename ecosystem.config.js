const path = require('path');

/** Корень монорепо — всегда каталог, где лежит этот файл (не зависит от того, откуда вызвали pm2). */
const repoRoot = __dirname;

module.exports = {
  apps: [{
    name: 'jingai-backend',
    script: path.join(repoRoot, 'backend', 'dist', 'server.js'),
    cwd: repoRoot,
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: path.join(repoRoot, 'logs', 'backend-error.log'),
    out_file: path.join(repoRoot, 'logs', 'backend-out.log'),
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};

