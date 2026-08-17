# 测试平台（Testing Platform）

> 一个面向团队的全功能测试管理平台，支持 API 测试用例、功能测试用例、测试计划、测试报告、用例评审等完整工作流。

---

## 目录

- [项目是什么](#项目是什么)
- [功能模块一览](#功能模块一览)
- [技术栈详解](#技术栈详解)
- [项目目录结构](#项目目录结构)
- [本地启动指南（新手向）](#本地启动指南新手向)
- [新手上手改东西](#新手上手改东西)
  - [改一个页面](#改一个页面)
  - [加一个新 API 接口](#加一个新-api-接口)
  - [加一张新数据库表](#加一张新数据库表)
  - [加一个新页面](#加一个新页面)
- [数据流向图](#数据流向图)
- [常见问题](#常见问题)
- [部署上线](#部署上线)

---

## 项目是什么

这是一个给**测试团队**使用的 Web 管理系统，可以理解为 "内部版的 JIRA 测试模块"。

主要解决以下问题：
- 测试用例写在 Excel 里难以管理 → 本平台提供在线用例库
- API 接口想直接在平台里调试 → 本平台内置 HTTP 请求执行器
- 测试进度不透明 → 本平台提供测试计划 + Dashboard 实时看板
- 测试结果难追溯 → 本平台支持生成 PDF 测试报告

---

## 功能模块一览

```
测试平台
├── 测试概览 (Dashboard)      ← 项目整体数据看板
├── 项目管理                  ← 创建/管理项目，邀请成员
├── API 测试用例              ← 管理 HTTP 接口测试用例，支持在线调试
├── 功能测试用例              ← 管理手动测试步骤，支持脑图模式 + XMind 导入导出
├── 测试计划                  ← 将用例组合成计划，批量执行，追踪进度
├── 测试报告                  ← 基于测试计划手动生成报告，支持 PDF 导出
└── 用例评审                  ← 创建评审任务，多人审阅用例质量
```

### 各模块详细说明

| 模块 | 路由 | 说明 |
|------|------|------|
| 测试概览 | `/dashboard` | 5 个统计卡片 + 通过率趋势图 + 优先级分布饼图 + 近期计划表 + 活跃度热力图 |
| 项目管理 | `/projects` | 创建项目、设置测试环境（Base URL + 变量）、管理成员权限 |
| API 测试用例 | `/testcases` | 树形模块管理，支持 GET/POST/PUT/DELETE 等请求，内置断言（状态码、JSON 路径、正则等），右侧调试面板实时执行 |
| 功能测试用例 | `/func-cases` | 分组树 + 步骤表格，支持 P0-P3 优先级，内置脑图视图（可拖拽），支持 .xmind 文件导入导出 |
| 测试计划 | `/test-plans` | 创建计划 → 添加 API/功能用例 → 批量执行 API 用例 → 手动标记功能用例结果 → 点击「生成报告」 |
| 测试报告 | `/reports` | 仅展示已手动生成的报告，点进去看通过率饼图 + 用例明细表，可导出 PDF |
| 用例评审 | `/case-reviews` | 创建评审 → 选用例 → 指定评审员 → 每人提交通过/拒绝意见 → 统计评审结果 |

---

## 技术栈详解

### 前端（`/frontend`）

| 技术 | 版本 | 作用 | 官网 |
|------|------|------|------|
| **React** | 18 | 核心 UI 框架，组件化开发 | [react.dev](https://react.dev) |
| **TypeScript** | 5 | JavaScript 的类型增强版，减少运行时错误 | [typescriptlang.org](https://www.typescriptlang.org) |
| **Vite** | 5 | 极快的前端构建工具，替代 Webpack | [vitejs.dev](https://vitejs.dev) |
| **Ant Design** | 5 | 企业级 UI 组件库（按钮、表格、表单等都来自这里） | [ant.design](https://ant.design) |
| **@ant-design/plots** | 2 | 基于 G2 的图表库（折线图、饼图等） | [charts.ant.design](https://charts.ant.design) |
| **React Router** | 6 | 前端路由，控制页面跳转 | [reactrouter.com](https://reactrouter.com) |
| **Axios** | 1.6 | HTTP 客户端，用于调用后端 API | [axios-http.com](https://axios-http.com) |
| **Zustand** | 4 | 轻量级全局状态管理（比 Redux 简单很多） | [zustand](https://github.com/pmndrs/zustand) |
| **mind-elixir** | 5 | 脑图/思维导图组件 | [mind-elixir.com](https://mind-elixir.com) |
| **dayjs** | 1.11 | 日期时间处理库（比 moment.js 轻量） | [day.js.org](https://day.js.org) |
| **@monaco-editor/react** | 4.6 | VS Code 同款代码编辑器（用于编写请求 Body） | [github](https://github.com/suren-atoyan/monaco-react) |

**前端的工作方式：**
```
用户操作浏览器
    → React 组件响应，更新 UI
    → Axios 发 HTTP 请求到后端 /api/...
    → 收到响应后，更新 Zustand 状态或本地 useState
    → 页面重新渲染显示新数据
```

---

### 后端（`/backend`）

| 技术 | 版本 | 作用 | 官网 |
|------|------|------|------|
| **Python** | 3.12 | 编程语言 | [python.org](https://python.org) |
| **FastAPI** | 0.109 | Web 框架，自动生成 API 文档，比 Django 轻量 | [fastapi.tiangolo.com](https://fastapi.tiangolo.com) |
| **SQLAlchemy** | 2.0 | ORM（对象关系映射），用 Python 代码操作数据库 | [sqlalchemy.org](https://www.sqlalchemy.org) |
| **Alembic** | 1.13 | 数据库迁移工具（改表结构时用） | [alembic.sqlalchemy.org](https://alembic.sqlalchemy.org) |
| **Pydantic** | 2 | 数据校验，定义 API 的请求/响应格式 | [docs.pydantic.dev](https://docs.pydantic.dev) |
| **PostgreSQL** | 14 | 主数据库，支持 JSONB（灵活存储复杂数据） | [postgresql.org](https://www.postgresql.org) |
| **Redis** | 7 | 缓存 + 消息队列（供 Celery 使用） | [redis.io](https://redis.io) |
| **Celery** | 5.3 | 异步任务队列（批量执行测试时不阻塞主线程） | [celeryq.dev](https://docs.celeryq.dev) |
| **JWT** | - | JSON Web Token，用于用户登录鉴权 | - |
| **reportlab** | - | Python 生成 PDF 文件的库 | [reportlab.com](https://www.reportlab.com) |
| **httpx** | 0.26 | 发 HTTP 请求（执行 API 测试用例时用） | [python-httpx.org](https://www.python-httpx.org) |
| **xmindparser** | - | 解析 .xmind 文件（功能用例导入用） | [github](https://github.com/tobyqin/xmindparser) |

**后端的工作方式（一次 API 请求的生命周期）：**
```
前端发 POST /api/v1/projects/1/test-plans
    → FastAPI 路由匹配 test_plans.py 里的函数
    → 调用 Pydantic 校验请求体格式
    → 调用 TestPlanService 执行业务逻辑
    → SQLAlchemy 将数据写入 PostgreSQL
    → 返回 JSON 响应给前端
```

---

### 基础设施

| 技术 | 作用 |
|------|------|
| **Docker** | 容器化，保证本地和生产环境一致 |
| **docker-compose** | 本地一键启动所有服务（后端 + 数据库 + Redis） |
| **Nginx** | 生产环境 Web 服务器，提供前端静态文件 + 反向代理后端 |
| **AWS Elastic Beanstalk** | 云部署平台，自动管理 EC2、负载均衡、扩容 |
| **AWS RDS** | 云托管 PostgreSQL（数据安全，自动备份） |

---

## 项目目录结构

```
testing-platform/
│
├── backend/                    ← 后端（Python + FastAPI）
│   ├── app/
│   │   ├── main.py             ← 程序入口，注册所有路由
│   │   ├── core/
│   │   │   ├── config.py       ← 配置（数据库地址、密钥等从 .env 读取）
│   │   │   ├── database.py     ← 数据库连接和 Session 管理
│   │   │   └── security.py     ← 密码加密、JWT token 生成/验证
│   │   ├── models/             ← 数据库表结构（SQLAlchemy ORM 模型）
│   │   │   ├── user.py         ← users 表
│   │   │   ├── project.py      ← projects、project_members、environments 表
│   │   │   ├── testcase.py     ← api_test_cases、modules 表
│   │   │   ├── testrun.py      ← test_runs、test_results 表
│   │   │   ├── func_test_case.py  ← func_case_groups、func_test_cases 表
│   │   │   ├── test_plan.py    ← test_plans、test_plan_items 表
│   │   │   └── case_review.py  ← case_reviews、case_review_members、case_review_items 表
│   │   ├── schemas/            ← Pydantic 数据格式（API 的输入输出定义）
│   │   ├── services/           ← 业务逻辑层（真正干活的地方）
│   │   │   ├── executor/
│   │   │   │   └── api_executor.py  ← 执行 HTTP 请求，收集断言结果
│   │   │   ├── xmind_service.py     ← XMind 文件导入导出
│   │   │   └── report_pdf_service.py ← 生成 PDF 报告
│   │   ├── api/
│   │   │   └── v1/             ← API 路由（每个文件对应一个功能模块）
│   │   │       ├── auth.py     ← 登录、注册、刷新 Token
│   │   │       ├── projects.py ← 项目、成员、环境管理
│   │   │       ├── testcases.py ← API 测试用例 CRUD
│   │   │       ├── testruns.py  ← 测试执行
│   │   │       ├── functional_cases.py ← 功能测试用例 CRUD + 脑图
│   │   │       ├── test_plans.py ← 测试计划 + 执行 + 生成报告
│   │   │       ├── reports.py  ← 测试报告列表、详情、PDF
│   │   │       └── case_reviews.py ← 用例评审
│   │   └── tasks/              ← Celery 异步任务
│   ├── alembic/                ← 数据库迁移脚本（每次改表结构后生成）
│   │   └── versions/           ← 每条迁移记录（按时间顺序）
│   ├── requirements.txt        ← Python 依赖包清单
│   └── Dockerfile              ← 后端容器构建脚本
│
├── frontend/                   ← 前端（React + TypeScript）
│   ├── src/
│   │   ├── main.tsx            ← 程序入口，挂载 React App
│   │   ├── App.tsx             ← 根组件，定义所有页面路由
│   │   ├── components/
│   │   │   └── Layout/
│   │   │       └── index.tsx   ← 整体布局（左侧菜单 + 顶部导航 + 内容区）
│   │   ├── pages/              ← 每个页面一个文件夹
│   │   │   ├── Login/          ← 登录页
│   │   │   ├── Dashboard/      ← 测试概览（含多个图表子组件）
│   │   │   ├── Projects/       ← 项目列表
│   │   │   ├── ProjectDetail/  ← 项目详情（环境、成员管理）
│   │   │   ├── TestCases/      ← API 测试用例
│   │   │   ├── FunctionalCases/ ← 功能测试用例（含脑图）
│   │   │   ├── TestPlans/      ← 测试计划列表 + 详情
│   │   │   ├── Reports/        ← 测试报告列表 + 详情
│   │   │   └── CaseReviews/    ← 用例评审列表 + 详情
│   │   ├── services/           ← 封装所有后端 API 调用
│   │   │   ├── api.ts          ← Axios 客户端（统一处理 Token、错误）
│   │   │   ├── auth.ts         ← 登录/注册接口
│   │   │   ├── project.ts      ← 项目相关接口
│   │   │   ├── testcase.ts     ← API 用例相关接口
│   │   │   ├── functionalCase.ts ← 功能用例相关接口
│   │   │   ├── testPlan.ts     ← 测试计划相关接口
│   │   │   ├── report.ts       ← 测试报告相关接口
│   │   │   ├── caseReview.ts   ← 用例评审相关接口
│   │   │   └── dashboard.ts    ← Dashboard 数据接口
│   │   ├── stores/             ← 全局状态管理（Zustand）
│   │   │   ├── authStore.ts    ← 登录状态（token、用户信息）持久化到 localStorage
│   │   │   └── projectStore.ts ← 当前选中项目，持久化到 localStorage
│   │   └── types/
│   │       └── index.ts        ← 所有 TypeScript 类型定义
│   ├── .env.development        ← 本地开发环境变量（API 地址）
│   ├── .env.production         ← 生产环境变量
│   ├── nginx.conf              ← 生产环境 Nginx 配置
│   └── Dockerfile              ← 前端容器构建脚本（多阶段：先 build 再用 nginx 服务）
│
├── docker-compose.yml          ← 本地开发一键启动（包含 postgres + redis + 前后端）
├── docker-compose.prod.yml     ← 单机生产部署（含 postgres 本地运行）
├── docker-compose.eb.yml       ← AWS EB 部署专用（postgres 由 RDS 托管）
├── .env                        ← 本地环境变量（不提交到 git）
├── .gitignore                  ← git 忽略文件列表
└── .ebextensions/              ← AWS EB 配置钩子
    └── 01_compose.config
```

---

## 本地启动指南（新手向）

### 方式一：最简单（推荐新手）—— 手动启动

**前置要求：**
- PostgreSQL 已安装并运行（`brew install postgresql` 或下载安装包）
- Redis 已安装并运行（`brew install redis && brew services start redis`）
- Python 3.11+（`brew install python`）
- Node.js 18+（`brew install node`）

**第一步：准备数据库**

```bash
# 创建数据库
createdb testplatform
# 或者进入 psql 手动创建：
# psql -U postgres -c "CREATE DATABASE testplatform;"
```

**第二步：启动后端**

```bash
cd testing-platform/backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Windows 用：venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 复制环境变量文件，然后按需修改
cp ../.env.example ../.env

# 运行数据库迁移（创建所有表）
alembic upgrade head

# 启动后端服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

此时打开 http://localhost:8000/api/docs 可以看到所有 API 文档。

**第三步：启动前端**

新开一个终端：

```bash
cd testing-platform/frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开 http://localhost:5173 即可看到登录页。

---

### 方式二：一键启动（Docker Compose）

**前置要求：**
- 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
cd testing-platform

# 复制环境变量
cp .env.example .env

# 一键启动所有服务（后端 + 数据库 + Redis + 前端）
docker-compose up -d

# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f backend
```

打开 http://localhost:5173 即可。

---

### 默认账号

初次启动后，通过注册页创建账号，或者用 API 直接注册：

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "email": "admin@test.com", "password": "Admin123!"}'
```

---

## 新手上手改东西

### 改一个页面

**例子：在「测试计划列表」页加一列「创建人」**

**第一步：看后端返回了什么数据**

打开 http://localhost:8000/api/docs，找到 `GET /api/v1/projects/{project_id}/test-plans`，点 Try it out 看返回的 JSON 字段。

**第二步：找到对应的前端页面文件**

路由是 `/test-plans`，对应 `frontend/src/pages/TestPlans/index.tsx`

**第三步：在 `columns` 数组里加一列**

```typescript
// 在 frontend/src/pages/TestPlans/index.tsx 的 columns 数组里添加：
{
  title: '创建人',
  dataIndex: 'created_by',   // 对应 API 返回的字段名
  key: 'created_by',
  width: 100,
  render: (id: number) => <Text>{id || '-'}</Text>,
},
```

**第四步：保存，浏览器自动刷新，完成。**

---

### 加一个新 API 接口

**例子：在测试计划里加一个「复制计划」的接口**

**第一步：在后端路由文件里加接口**

打开 `backend/app/api/v1/test_plans.py`，参考已有的接口格式添加：

```python
@router.post("/test-plans/{plan_id}/clone")
def clone_test_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """复制一个测试计划"""
    from app.models.test_plan import TestPlan
    from fastapi import HTTPException
    
    # 找到原计划
    original = db.query(TestPlan).filter(TestPlan.id == plan_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="计划不存在")
    
    # 创建副本
    new_plan = TestPlan(
        project_id=original.project_id,
        name=f"{original.name}（副本）",
        description=original.description,
        status="draft",
        created_by=current_user.id,
    )
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)
    
    return {"id": new_plan.id, "name": new_plan.name}
```

**第二步：在前端 service 文件里加调用**

打开 `frontend/src/services/testPlan.ts`，参照已有的格式加一行：

```typescript
// 在 testPlanApi 对象里加：
clone: (planId: number) =>
  apiClient.post<{ id: number; name: string }>(`/api/v1/test-plans/${planId}/clone`),
```

**第三步：在前端页面里调用**

在 `TestPlans/index.tsx` 里加按钮和调用逻辑：

```typescript
// 加函数
const handleClone = async (planId: number) => {
  try {
    const result = await testPlanApi.clone(planId)
    message.success(`计划已复制：${result.name}`)
    loadPlans()  // 刷新列表
  } catch {
    message.error('复制失败')
  }
}

// 在 columns 的操作列里加按钮
<Button type="link" size="small" onClick={() => handleClone(record.id)}>复制</Button>
```

---

### 加一张新数据库表

**例子：加一张「缺陷记录」表**

**第一步：在 `models/` 里创建模型文件**

新建 `backend/app/models/defect.py`：

```python
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from datetime import datetime
from app.core.database import Base

class Defect(Base):
    __tablename__ = "defects"
    
    id         = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    title      = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status     = Column(String(20), default="open")  # open / fixed / closed
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
```

**第二步：在 `models/__init__.py` 里注册（让 Alembic 能发现它）**

打开 `backend/app/models/__init__.py`，加一行：

```python
from app.models.defect import Defect  # 加这行
```

**第三步：生成并执行迁移**

```bash
cd backend
source venv/bin/activate

# 自动生成迁移脚本
alembic revision --autogenerate -m "add_defects_table"

# 执行迁移（真正创建表）
alembic upgrade head
```

之后就可以在 `api/v1/` 里写接口、`services/` 里写业务逻辑了。

---

### 加一个新页面

**例子：加一个「缺陷管理」页面**

**第一步：创建页面组件**

新建 `frontend/src/pages/Defects/index.tsx`，可以复制 `CaseReviews/index.tsx` 作为模板修改。

**第二步：在路由里注册**

打开 `frontend/src/App.tsx`：

```typescript
// 在文件顶部加 import：
import Defects from '@/pages/Defects'

// 在 Routes 里加路由：
<Route path="defects" element={<Defects />} />
```

**第三步：在左侧菜单里加入口**

打开 `frontend/src/components/Layout/index.tsx`，在 `menuItems` 数组里加：

```typescript
{
  key: '/defects',
  icon: <BugOutlined />,  // 需要从 @ant-design/icons 导入
  label: '缺陷管理',
},
```

**第四步：在顶部 import 里加图标**

```typescript
import { ..., BugOutlined } from '@ant-design/icons'
```

完成，刷新即可看到新菜单。

---

## 数据流向图

```
用户在浏览器操作
        │
        ▼
  React 组件（pages/）
        │  调用
        ▼
  服务层（services/*.ts）    ← 封装了所有 HTTP 请求
        │  Axios 发请求
        ▼
  Nginx（生产）/ 直接（开发）
        │  转发 /api/* 到
        ▼
  FastAPI（main.py 注册路由）
        │  路由到
        ▼
  API 路由（api/v1/*.py）
        │  调用
        ▼
  服务层（services/*.py）     ← 业务逻辑
        │  使用 SQLAlchemy
        ▼
  PostgreSQL 数据库
```

**登录状态如何保持：**

```
登录成功
    → 后端返回 access_token + refresh_token
    → 前端 authStore 存到 localStorage
    → 之后每次请求，Axios 拦截器自动带上 Authorization: Bearer <token>
    → Token 过期时自动用 refresh_token 换新 token
```

**全局项目选择器如何工作：**

```
顶部导航栏选择项目
    → projectStore.setSelectedProjectId(id)
    → 存到 localStorage（刷新后仍然记住）
    → 各页面用 useProjectStore() 读取 selectedProjectId
    → 加载对应项目的数据
```

---

## 常见问题

### Q：改了后端代码，接口不生效？
`uvicorn` 带了 `--reload` 参数会自动重启，如果没有，手动 `Ctrl+C` 然后重新运行。

### Q：改了前端代码，页面没变化？
Vite 开发服务器会自动热更新（HMR）。如果确实没变，按 `Ctrl+Shift+R` 强制刷新清缓存。

### Q：新加的数据库字段，为什么查询报错？
没有运行迁移。执行 `alembic upgrade head` 更新数据库结构。

### Q：`alembic upgrade head` 报连接失败？
检查 `.env` 里的 `DATABASE_URL` 是否正确，PostgreSQL 是否在运行（`brew services list` 查看状态）。

### Q：前端页面显示 401 未授权？
Token 过期了，重新登录即可。也可以检查 `frontend/.env.development` 里的 API 地址是否正确。

### Q：想看所有 API 的文档？
启动后端后访问：http://localhost:8000/api/docs （Swagger UI，可以直接在网页里调试接口）

### Q：哪里可以看数据库里的数据？
推荐安装 [TablePlus](https://tableplus.com/) 或 [DBeaver](https://dbeaver.io/)（免费），连接：
- Host: localhost
- Port: 5432
- Database: testplatform
- User: postgres
- Password: postgres123（见 `.env`）

---

## 部署上线

详见 [`.cursor/plans/阶段6-AWS-ElasticBeanstalk部署指南.md`](.cursor/plans/阶段6-AWS-ElasticBeanstalk部署指南.md)

**简要流程：**
1. `git init && git add . && git commit -m "init"`
2. 在 AWS 创建 RDS PostgreSQL 实例
3. `eb init` + `eb create` 配置 EB 环境
4. 设置环境变量（DATABASE_URL、SECRET_KEY）
5. `eb deploy` 完成部署

费用约 **$17-32/月**（ap-southeast-1 新加坡区域），首年新账户 RDS 免费，约 **$15/月**。

---

## 开发规范说明

| 规范 | 说明 |
|------|------|
| 后端接口统一加 `/api/v1/` 前缀 | 方便后续版本迭代 |
| 所有数据库操作通过 Service 层 | Router 只负责接收请求和返回响应 |
| 前端所有接口调用通过 `services/` | 页面组件不直接写 axios 请求 |
| 全局状态用 Zustand | 不要直接操作 localStorage |
| 类型定义集中在 `types/index.ts` | 保持类型一致，前后端对齐 |
