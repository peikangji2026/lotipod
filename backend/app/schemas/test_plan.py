from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


# ===== 计划条目 =====

class PlanItemCreate(BaseModel):
    case_type: str   # 'api' | 'functional'
    case_id: int
    sort_order: Optional[int] = 0


class PlanItemsAdd(BaseModel):
    items: list[PlanItemCreate]


class PlanItemResultUpdate(BaseModel):
    result: str                        # passed / failed / blocked / skipped
    comment: Optional[str] = None
    defect_ids: Optional[list[int]] = []


class PlanItemResponse(BaseModel):
    id: int
    plan_id: int
    case_type: str
    case_id: int
    result: str
    executed_by: Optional[int] = None
    executed_at: Optional[datetime] = None
    comment: Optional[str] = None
    defect_ids: Optional[list] = []
    sort_order: int
    created_at: datetime
    # 动态注入的用例信息（非 DB 字段）
    case_name: Optional[str] = None
    case_url: Optional[str] = None      # API 用例专有

    model_config = {"from_attributes": True}


# ===== 测试计划 =====

class TestPlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[str] = "draft"
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class TestPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class TestPlanProgress(BaseModel):
    total: int
    pending: int
    passed: int
    failed: int
    blocked: int
    skipped: int
    pass_rate: float


class TestPlanResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: Optional[str] = None
    status: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    # 聚合字段（列表页使用）
    total_cases: Optional[int] = 0
    progress: Optional[TestPlanProgress] = None

    model_config = {"from_attributes": True}


class TestPlanDetailResponse(TestPlanResponse):
    items: Optional[list[PlanItemResponse]] = []


# ===== 执行 API 用例 =====

class ExecuteApiCasesRequest(BaseModel):
    environment_id: int
