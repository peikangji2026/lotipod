from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ===== 分组 =====

class FuncCaseGroupCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None
    sort_order: Optional[int] = 0


class FuncCaseGroupUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None


class FuncCaseGroupResponse(BaseModel):
    id: int
    project_id: int
    parent_id: Optional[int] = None
    name: str
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ===== 测试步骤 =====

class TestStep(BaseModel):
    step: str
    expected: str


# ===== 功能用例 =====

class FuncTestCaseCreate(BaseModel):
    title: str
    group_id: Optional[int] = None
    precondition: Optional[str] = None
    priority: Optional[str] = "P2"
    status: Optional[str] = "draft"
    steps: Optional[list[TestStep]] = []
    tags: Optional[list[str]] = []
    estimated_hours: Optional[float] = None


class FuncTestCaseUpdate(BaseModel):
    title: Optional[str] = None
    group_id: Optional[int] = None
    precondition: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    steps: Optional[list[TestStep]] = None
    tags: Optional[list[str]] = None
    estimated_hours: Optional[float] = None


class FuncTestCaseResponse(BaseModel):
    id: int
    project_id: int
    group_id: Optional[int] = None
    title: str
    precondition: Optional[str] = None
    priority: str
    status: str
    steps: Optional[list] = []
    tags: Optional[list[str]] = []
    estimated_hours: Optional[float] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ===== 批量操作 =====

class FuncCaseBatchUpdate(BaseModel):
    case_ids: list[int]
    group_id: Optional[int] = None      # 批量移动分组
    priority: Optional[str] = None      # 批量修改优先级
    status: Optional[str] = None        # 批量修改状态
    action: str = "update"              # update / delete


# ===== 脑图树结构 =====

class MindMapNode(BaseModel):
    """脑图节点，递归结构"""
    id: Optional[int] = None            # 已存在的 group/case id，新建为 None
    node_type: str                       # "group" | "case"
    title: str
    priority: Optional[str] = None      # case 节点的优先级
    sort_order: Optional[int] = 0
    children: Optional[list["MindMapNode"]] = []


MindMapNode.model_rebuild()


class MindMapSaveRequest(BaseModel):
    nodes: list[MindMapNode]            # 根节点的子节点列表（不含虚拟根节点）
