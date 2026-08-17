# Phase 3 — 测试概览 Dashboard

> 依赖：Phase 1（功能用例数据）、Phase 2（测试计划数据）
> 本阶段完成后：Dashboard 从空壳变为真实数据大盘，一眼看清项目测试健康状况。

---

## 当前状态

`frontend/src/pages/Dashboard/index.tsx` 目前只有 20 行，内容是欢迎语 + 跳转按钮，无任何数据。

---

## 目标页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│  项目选择器 [当前项目 ▼]                                           │
├────────────┬────────────┬────────────┬────────────┬──────────────┤
│ API用例总数 │ 功能用例总数 │ 本周执行次数 │  综合通过率  │ 活跃测试计划  │
│    128     │    256     │     14     │   87.5%    │     3个      │
│  ↑ 较上周   │  ↑ 较上周   │  ↑ 较上周   │  ↓ 较上周   │             │
├────────────┴────────────┴────────────┴────────────┴──────────────┤
│  [API执行通过率趋势（折线图，最近10次）] │ [用例优先级分布（饼图）]    │
├──────────────────────────────────────────────────────────────────┤
│  近期测试计划进度                                                   │
│  计划名称         状态     进度              时间范围               │
│  Sprint 8.2 测试  进行中   ████░░ 67%       03/01 ~ 03/15        │
│  回归测试-v2.1    进行中   ██░░░░ 35%       03/05 ~ 03/20        │
├──────────────────────────────────────────────────────────────────┤
│  活跃度热力图（最近3个月，每日操作频次）                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 后端

### 新增 API 端点

在 `backend/app/api/v1/reports.py` 中新增：

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/reports/projects/{id}/dashboard` | 返回 Dashboard 所需全部统计数据 |

**响应结构：**

```json
{
  "stats": {
    "api_case_count": 128,
    "func_case_count": 256,
    "weekly_run_count": 14,
    "overall_pass_rate": 87.5,
    "active_plan_count": 3
  },
  "api_pass_trend": [
    {"run_name": "Run #42", "pass_rate": 90.0, "executed_at": "2026-03-01"},
    ...
  ],
  "priority_distribution": {
    "P0": 12, "P1": 45, "P2": 180, "P3": 147
  },
  "recent_plans": [
    {
      "id": 1,
      "name": "Sprint 8.2 测试",
      "status": "active",
      "progress": 67.0,
      "total": 30,
      "passed": 20,
      "start_date": "2026-03-01",
      "end_date": "2026-03-15"
    }
  ],
  "activity_heatmap": [
    {"date": "2026-03-01", "count": 5},
    ...
  ]
}
```

**查询逻辑说明：**
- `api_case_count`：`SELECT COUNT(*) FROM api_test_cases WHERE project_id=?`
- `func_case_count`：`SELECT COUNT(*) FROM func_test_cases WHERE project_id=?`
- `weekly_run_count`：过去7天 `test_runs` 数量
- `overall_pass_rate`：最近50次执行的平均通过率
- `active_plan_count`：`status='active'` 的测试计划数
- `priority_distribution`：`func_test_cases` + `api_test_cases` 的 priority 分组统计
- `activity_heatmap`：过去90天每天创建/执行用例的操作次数

---

## 前端

**改造文件：** `frontend/src/pages/Dashboard/index.tsx`

### 组件结构

```
Dashboard/
├── index.tsx              # 主页面（数据获取 + 布局）
├── StatsCards.tsx         # 顶部5个统计卡片
├── PassRateTrend.tsx      # API执行通过率折线图
├── PriorityPieChart.tsx   # 用例优先级分布饼图
├── RecentPlansTable.tsx   # 近期测试计划进度列表
└── ActivityHeatmap.tsx    # 活跃度热力图
```

### 图表库

项目已安装 Ant Design，使用 `@ant-design/charts`（基于 AntV G2）：

```bash
npm install @ant-design/charts
```

- 折线图：`<Line />` 组件
- 饼图：`<Pie />` 组件
- 热力图：用 Ant Design `Calendar` 组件自定义渲染（与 CODING 风格一致）

### 新增 service

**文件：** `frontend/src/services/dashboard.ts`

```typescript
export const getDashboardStats = (projectId: number) =>
  api.get(`/reports/projects/${projectId}/dashboard`)
```

---

## 验收标准

- [ ] 5个统计卡片数据正确，有环比趋势箭头
- [ ] API 通过率折线图展示最近10次执行
- [ ] 用例优先级分布饼图展示 P0/P1/P2/P3 比例
- [ ] 近期测试计划进度列表，进度条准确
- [ ] 活跃度热力图展示最近3个月每日操作频次
- [ ] 顶部可切换项目（项目选择器）
