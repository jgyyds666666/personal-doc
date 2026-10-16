# 1 核 2G 服务器部署说明

本文适用于单用户、低并发使用。服务器只运行一个 Next.js 进程和 Nginx；不要在同机部署 PostgreSQL、Redis、MinIO 或本地 AI 模型。

## 1. 运行条件

- Linux x64，建议使用仍在安全支持期内的 Ubuntu 或 Debian
- Node.js 20.9 或更高版本
- pnpm 9
- Nginx
- 已准备可访问的 S3 兼容对象存储

生产构建尽量在 Linux CI 或与服务器相同的平台完成，避免 Windows 构建中的原生依赖无法在 Linux 运行。

## 2. 环境变量

在服务器创建 `/etc/personal-doc.env`，权限设为仅 root 可读：

```dotenv
NODE_ENV=production
HOSTNAME=127.0.0.1
PORT=5000
NODE_OPTIONS=--max-old-space-size=640

# 图形化部署：直接填写明文，后端首次登录时转换一次并缓存
ADMIN_PASSWORD=请替换为至少6位的管理员密码
ADMIN_PASSWORD_MODE=plain
SESSION_SECRET=请替换为至少32个随机字符

S3_ENDPOINT_URL=https://对象存储端点
S3_BUCKET_NAME=存储桶名称
S3_REGION=区域
S3_ACCESS_KEY_ID=访问密钥ID
S3_SECRET_ACCESS_KEY=访问密钥
```

如果不希望部署平台保存明文，可在可信的本地环境生成哈希：

```bash
pnpm auth:hash -- "至少6位的管理员密码"
```

然后把生成的 `scrypt$...` 填入 `ADMIN_PASSWORD`，并设置：

```dotenv
ADMIN_PASSWORD_MODE=hash
```

`plain` 模式只会清理当前 Node 进程中的环境变量引用，无法回写或删除图形化部署平台中保存的值。不要把 `.env`、明文密码或密钥提交到 Git。

## 3. 构建

```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
pnpm install --frozen-lockfile
pnpm test
pnpm validate
pnpm build:standalone
```

部署产物位于 `.next/standalone`。构建脚本已经把 `public` 和 `.next/static` 复制进该目录。

## 4. systemd

把 standalone 产物放到 `/opt/personal-doc`，并创建 `/etc/systemd/system/personal-doc.service`：

```ini
[Unit]
Description=Personal Document Library
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/personal-doc
EnvironmentFile=/etc/personal-doc.env
ExecStart=/usr/bin/node /opt/personal-doc/server.js
Restart=on-failure
RestartSec=5
MemoryMax=900M
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

启动并检查：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now personal-doc
sudo systemctl status personal-doc
curl http://127.0.0.1:5000/api/health
```

健康检查应返回 `{"status":"ok"}`。

## 5. Nginx

示例站点配置：

```nginx
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

server {
    listen 443 ssl http2;
    server_name docs.example.com;

    client_max_body_size 52m;

    location = /api/auth/login {
        limit_req zone=login_limit burst=5 nodelay;
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

必须配置有效 HTTPS 证书。生产会话 Cookie 带有 `Secure`，通过明文 HTTP 无法正常保持登录。

不要把 Node 的 5000 端口直接开放到公网；防火墙只放行 SSH、HTTP 和 HTTPS。

## 6. 运维检查

```bash
journalctl -u personal-doc -n 100 --no-pager
systemctl show personal-doc -p MemoryCurrent -p MemoryPeak
curl -I https://docs.example.com/login
curl https://docs.example.com/api/health
```

至少保留 1–2GB swap 作为突发保护，但正常运行不应持续使用 swap。后续引入 SQLite 元数据后，需要增加每日数据库备份与恢复演练。
