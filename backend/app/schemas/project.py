from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime


# ===== 项目 =====

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    owner_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ===== 项目成员 =====

class MemberAdd(BaseModel):
    username: str
    role: str = "member"  # owner / admin / member / viewer


class MemberResponse(BaseModel):
    id: int
    project_id: int
    user_id: int
    role: str
    username: str
    full_name: Optional[str] = None
    email: str

    model_config = {"from_attributes": True}


# ===== 环境配置 =====

class EnvironmentCreate(BaseModel):
    name: str
    base_url: str
    variables: Optional[dict] = {}
    headers: Optional[dict] = {}


class EnvironmentUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    variables: Optional[dict] = None
    headers: Optional[dict] = None


class EnvironmentResponse(BaseModel):
    id: int
    project_id: int
    name: str
    base_url: Optional[str] = None
    variables: Optional[dict] = {}
    headers: Optional[dict] = {}

    model_config = {"from_attributes": True}
