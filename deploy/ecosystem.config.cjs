const appPort = String(process.env.APP_PORT || "3001");
const appName = process.env.PM2_APP_NAME || "tempify";
const deployPath = process.env.DEPLOY_PATH || "/var/www/tempify";

module.exports = {
  apps: [
    {
      name: appName,
      cwd: deployPath,
      script: "node_modules/next/dist/bin/next",
      args: `start --hostname 127.0.0.1 --port ${appPort}`,
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "750M",
      min_uptime: "10s",
      max_restarts: 10,
      kill_timeout: 10000,
      listen_timeout: 10000,
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: appPort,
      },
    },
  ],
};
