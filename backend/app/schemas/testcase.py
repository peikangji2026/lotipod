from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


# ===== 模块 =====

class ModuleCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None
    description: Optional[str] = None


class ModuleResponse(BaseModel):
    id: int
    project_id: int
    name: str
    parent_id: Optional[int] = None
    description: Optional[str] = None

    model_config = {"from_attributes": True}


# ===== 断言 =====

class Assertion(BaseModel):
    type: str          # status_code / response_time / json_path / contains / regex
    expected: Any
    path: Optional[str] = None   # json_path 类型使用


# ===== 测试用例 =====

class TestCaseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    module_id: Optional[int] = None
    method: str = "GET"
    url: str
    headers: Optional[dict] = {}
    params: Optional[dict] = {}
    body: Optional[str] = None
    body_type: Optional[str] = "json"
    assertions: Optional[list[Assertion]] = []
    pre_script: Optional[str] = None
    post_script: Optional[str] = None
    priority: Optional[str] = "medium"
    status: Optional[str] = "draft"


class TestCaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    module_id: Optional[int] = None
    method: Optional[str] = None
    url: Optional[str] = None
    headers: Optional[dict] = None
    params: Optional[dict] = None
    body: Optional[str] = None
    body_type: Optional[str] = None
    assertions: Optional[list[Assertion]] = None
    pre_script: Optional[str] = None
    post_script: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None


class TestCaseResponse(BaseModel):
    id: int
    project_id: int
    module_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    method: str
    url: str
    headers: Optional[dict] = {}
    params: Optional[dict] = {}
    body: Optional[str] = None
    body_type: Optional[str] = "json"
    assertions: Optional[list] = []
    pre_script: Optional[str] = None
    post_script: Optional[str] = None
    priority: str
    status: str
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ===== 测试执行 =====

class TestRunCreate(BaseModel):
    name: Optional[str] = None
    environment_id: int
    test_case_ids: list[int]


class AssertionResult(BaseModel):
    type: str
    expected: Any
    actual: Any
    passed: bool
    error: Optional[str] = None


class TestResultResponse(BaseModel):
    id: int
    test_run_id: int
    test_case_id: Optional[int] = None
    status: str
    request_data: Optional[dict] = None
    response_data: Optional[dict] = None
    response_time: Optional[int] = None
    error_message: Optional[str] = None
    assertion_results: Optional[list] = []
    executed_at: datetime
    test_case_name: Optional[str] = None

    model_config = {"from_attributes": True}


class TestRunResponse(BaseModel):
    id: int
    project_id: int
    environment_id: Optional[int] = None
    name: Optional[str] = None
    run_type: str
    status: str
    total_cases: int
    passed_cases: int
    failed_cases: int
    skipped_cases: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration: Optional[int] = None
    triggered_by: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}
