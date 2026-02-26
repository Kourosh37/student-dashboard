module.exports = {
  apps: [
    {
      name: "student-dashboard",
      cwd: __dirname,
      script: "pnpm",
      args: "start -- -p 3000 -H 127.0.0.1",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      max_restarts: 10,
      min_uptime: "10s",
      exp_backoff_restart_delay: 200,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
      },
    },
  ],
};
