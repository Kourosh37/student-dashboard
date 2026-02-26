## PM2 + Nginx Deployment Checklist

1. Install runtime deps on server:

```bash
sudo apt update
sudo apt install -y nginx
sudo npm i -g pnpm pm2
```

2. Prepare app:

```bash
cd /var/www/student-dashboard
pnpm install --frozen-lockfile
cp .env.example .env
# Edit .env with production values (especially DATABASE_URL and AUTH_JWT_SECRET)
pnpm prod:prepare
```

3. Start app with PM2:

```bash
pnpm pm2:start
pm2 save
pm2 startup
```

4. Enable Nginx config:

```bash
sudo cp deployment/nginx/student-dashboard.conf /etc/nginx/sites-available/student-dashboard.conf
sudo ln -s /etc/nginx/sites-available/student-dashboard.conf /etc/nginx/sites-enabled/student-dashboard.conf
sudo nginx -t
sudo systemctl reload nginx
```

5. Logs / maintenance:

```bash
pnpm pm2:logs
pm2 status
sudo tail -f /var/log/nginx/error.log
```
