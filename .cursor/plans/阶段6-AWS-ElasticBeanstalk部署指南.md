# 阶段 6：AWS Elastic Beanstalk 部署指南

> 目标架构：EC2（EB 自动管理）+ RDS PostgreSQL + 自动 HTTPS

```
用户浏览器
    │
    ▼
Elastic Beanstalk (EC2)
    │  docker-compose 运行两个服务：
    ├─ nginx:80  ──────────── 提供前端静态页面 + 反向代理 /api
    └─ fastapi:8000 ────────── 后端 API
         │
         ├──▶  RDS PostgreSQL（托管数据库，数据持久安全）
         └──▶  Redis（同 EC2 内，省成本；未来可迁移 ElastiCache）
```

---

## 前置准备

### 安装工具（Mac）

```bash
# AWS CLI
brew install awscli

# EB CLI
pip install awsebcli --upgrade

# 验证安装
aws --version
eb --version
```

### 配置 AWS 凭证

1. 登录 [AWS IAM 控制台](https://console.aws.amazon.com/iam)
2. 创建一个新 IAM 用户，勾选 **Programmatic access**
3. 附加权限策略：`AdministratorAccess`（或按最小权限配置）
4. 下载 Access Key ID 和 Secret Access Key

```bash
aws configure
# AWS Access Key ID: <你的 Key>
# AWS Secret Access Key: <你的 Secret>
# Default region name: ap-southeast-1   ← 新加坡，距离中国最近
# Default output format: json
```

---

## 第一步：Git 初始化

```bash
cd /Users/jipeikng/CursorProjects/testing-platform

git init
git add .
git commit -m "chore: initial commit for deployment"
```

如果要推送到 GitHub（推荐，方便后续 CI/CD）：

```bash
# 在 GitHub 创建仓库后：
git remote add origin https://github.com/你的用户名/testing-platform.git
git push -u origin main
```

---

## 第二步：修改代码适配生产环境

### 2-1  前端 API 地址改为相对路径

**修改 `frontend/src/services/api.ts` 第 3 行：**

```typescript
// 改前：
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// 改后：
const API_BASE_URL = import.meta.env.VITE_API_URL ?? ''
```

这样生产环境 `VITE_API_URL=''` 时，所有 `/api/...` 请求都是相对路径，
由 nginx 的反向代理转发到后端，**不需要知道域名**。

### 2-2  新增 `.env.production`（前端构建参数）

创建文件 `frontend/.env.production`：

```ini
# 生产环境使用空字符串 = 相对路径，由 nginx 代理到后端
VITE_API_URL=
```

### 2-3  更新 `frontend/Dockerfile`（接收构建参数）

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
# 使用 .env.production 构建（Vite 会自动读取）
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 2-4  新建 `.gitignore`（根目录）

创建文件 `.gitignore`：

```gitignore
# Python
backend/venv/
backend/__pycache__/
backend/*.pyc
backend/.env
backend/.env.prod
**/__pycache__/
*.pyc

# Node
frontend/node_modules/
frontend/dist/
frontend/.env.local
frontend/.env.*.local

# 本地环境文件（包含敏感信息，不提交）
.env
.env.prod
.env.local

# EB 临时文件
.elasticbeanstalk/
!.elasticbeanstalk/*.cfg.yml
!.elasticbeanstalk/*.global.yml

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
```

### 2-5  新建 EB 专用 `docker-compose.eb.yml`

这是 EB 部署时使用的 compose 文件（PostgreSQL 由 RDS 托管，不在此处运行）：

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: always
    networks:
      - testplatform

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    command: >
      sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: redis://redis:6379/0
      SECRET_KEY: ${SECRET_KEY}
      ENVIRONMENT: production
      CORS_ORIGINS: '["https://${EB_DOMAIN}"]'
    depends_on:
      - redis
    networks:
      - testplatform

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - testplatform

networks:
  testplatform:
    driver: bridge
```

---

## 第三步：创建 RDS PostgreSQL 数据库

> **为什么用 RDS？** 数据库数据独立于 EC2，EC2 重启/重部署不丢数据。

### 3-1  进入 RDS 控制台

1. 访问 [RDS 控制台](https://console.aws.amazon.com/rds) → **创建数据库**
2. 配置如下：

| 选项 | 值 |
|------|-----|
| 引擎 | PostgreSQL 14 |
| 模板 | **免费套餐**（Free tier，12个月免费）或 Production |
| 实例类 | `db.t3.micro`（免费 / 低成本） |
| 数据库名称 | `testplatform` |
| 主用户名 | `postgres` |
| 主密码 | 自定义强密码，**记录下来** |
| VPC | **默认 VPC** |
| 公开可访问 | **是**（便于本地迁移数据，上线后可改为否） |
| 初始数据库名 | `testplatform` |

3. 点击 **创建数据库**，等待约 5 分钟
4. 创建完成后记录 **Endpoint**，格式类似：
   ```
   testplatform.xxxxxxxx.ap-southeast-1.rds.amazonaws.com
   ```

### 3-2  配置 RDS 安全组（允许访问）

1. 进入 RDS 实例 → 安全组 → 编辑入站规则
2. 添加规则：
   - 类型：`PostgreSQL`（端口 5432）
   - 来源：`0.0.0.0/0`（临时，方便本地迁移；部署后限制为 EB 安全组）

---

## 第四步：迁移本地数据到 RDS（可选）

如果本地已有测试数据需要迁移：

```bash
# 1. 导出本地数据库
pg_dump -h localhost -U postgres -d testplatform > local_backup.sql

# 2. 导入到 RDS（替换 <RDS_ENDPOINT>）
psql -h <RDS_ENDPOINT> -U postgres -d testplatform < local_backup.sql

# 3. 验证
psql -h <RDS_ENDPOINT> -U postgres -d testplatform -c "\dt"
```

---

## 第五步：初始化 Elastic Beanstalk

```bash
cd /Users/jipeikng/CursorProjects/testing-platform

# 初始化 EB 应用
eb init

# 交互式配置：
# Select a default region: 10) ap-southeast-1 (新加坡)
# Enter Application Name: testing-platform
# It appears you are using Docker. Is this correct? Y
# Do you want to set up SSH for your instances? Y（推荐，方便调试）
# Select a keypair: 选择已有或创建新的
```

这会创建 `.elasticbeanstalk/config.yml` 文件。

---

## 第六步：配置 EB 环境钩子（自动使用 eb 专用 compose 文件）

新建文件 `.ebextensions/01_compose.config`：

```yaml
option_settings:
  aws:elasticbeanstalk:application:environment:
    COMPOSE_FILE: docker-compose.eb.yml
```

---

## 第七步：创建 EB 环境并配置环境变量

```bash
# 创建环境（首次，约 5-10 分钟）
eb create testing-platform-prod \
  --instance-type t3.small \
  --single \
  --envvars "DATABASE_URL=postgresql://postgres:<密码>@<RDS_ENDPOINT>:5432/testplatform,SECRET_KEY=<随机32位字符串>,ENVIRONMENT=production"
```

> 生成 32 位随机 SECRET_KEY：
> ```bash
> python3 -c "import secrets; print(secrets.token_hex(32))"
> ```

**或者**创建完后在控制台配置环境变量：
1. EB 控制台 → 你的环境 → 配置 → 软件 → 编辑
2. 环境属性中添加：

| 键 | 值 |
|----|----|
| `DATABASE_URL` | `postgresql://postgres:<密码>@<RDS_ENDPOINT>:5432/testplatform` |
| `SECRET_KEY` | `<随机32位字符串>` |
| `ENVIRONMENT` | `production` |
| `COMPOSE_FILE` | `docker-compose.eb.yml` |

---

## 第八步：首次部署

```bash
# 部署（约 3-8 分钟，取决于 Docker build 时间）
eb deploy

# 查看部署日志（实时）
eb logs --all

# 查看环境状态
eb status
```

部署成功后，EB 会给你一个域名，类似：
```
testing-platform-prod.ap-southeast-1.elasticbeanstalk.com
```

---

## 第九步：验证部署

```bash
# 打开应用（浏览器）
eb open

# 检查后端健康
curl https://testing-platform-prod.ap-southeast-1.elasticbeanstalk.com/api/health
# 期望返回：{"status": "ok", "environment": "production"}

# SSH 进入 EC2 查看容器状态（可选）
eb ssh
docker-compose -f docker-compose.eb.yml ps
docker-compose -f docker-compose.eb.yml logs backend
```

---

## 第十步：配置 HTTPS（强烈推荐）

### 10-1  申请免费 SSL 证书（ACM）

1. 访问 [ACM 控制台](https://console.aws.amazon.com/acm)
2. **申请公有证书** → 输入域名（如果没有域名，跳过此步骤）
3. DNS 验证 → 等待验证完成（约 5 分钟）

### 10-2  配置 HTTPS 监听

1. EB 控制台 → 配置 → 负载均衡器（需要切换到 Load Balanced 模式）
2. **或者**：使用 CloudFront 包裹 EB（最简单的 HTTPS 方案）：

```bash
# CloudFront 控制台：
# 1. 创建 Distribution
# 2. Origin Domain: 你的 EB 域名
# 3. Viewer Protocol Policy: Redirect HTTP to HTTPS
# 4. 几分钟后获得 *.cloudfront.net 域名
```

---

## 日常更新流程

每次修改代码后，只需一条命令：

```bash
# 1. 构建前端（可选，如果有前端改动）
cd frontend && npm run build && cd ..

# 2. 提交代码
git add .
git commit -m "feat: xxx"

# 3. 部署到 EB
eb deploy

# 4. 查看日志确认无报错
eb logs --tail
```

---

## 回滚操作

```bash
# 查看历史版本
eb appversion

# 回滚到上一个版本（界面操作）
# EB 控制台 → 应用版本 → 选择旧版本 → 部署到环境
```

---

## 费用估算（ap-southeast-1 新加坡区域）

| 资源 | 规格 | 月费用（约） |
|------|------|-------------|
| EC2 (EB 管理) | t3.small | $15 |
| RDS PostgreSQL | db.t3.micro（**12个月免费**） | $0 → $15 |
| 数据传输 | 前 1GB 免费 | ~$2 |
| **合计** | | **~$17-32/月** |

> 如果是首年 AWS 新账户，RDS db.t3.micro 免费使用 12 个月，合计约 **$15-17/月**

---

## 常见问题排查

### 部署后页面空白 / API 连不上
```bash
eb ssh
docker-compose -f docker-compose.eb.yml logs frontend
docker-compose -f docker-compose.eb.yml logs backend
```

### 数据库连接失败
- 检查 RDS 安全组是否允许 EC2 访问 5432 端口
- 检查 DATABASE_URL 环境变量格式是否正确

### 容器启动失败
```bash
eb ssh
docker ps -a              # 查看所有容器
docker logs <容器ID>      # 查看具体错误
```

### 更新环境变量后不生效
```bash
# EB 控制台更新环境变量会自动重启
# 或命令行：
eb setenv KEY=VALUE
```

---

## 后续优化时间线（遇到问题再做）

| 触发条件 | 解决方案 |
|---------|---------|
| 数据库查询变慢 | RDS 升级实例或开启 Read Replica |
| 上传文件占用磁盘 | 接入 S3 存储测试附件 |
| 测试任务影响 Web 响应 | 拆分 Celery Worker 为独立 EB 环境 |
| 需要定时跑测试 | EventBridge + Lambda 触发 API |
| 并发用户增多 | EB 切换为 Load Balanced + Auto Scaling |
