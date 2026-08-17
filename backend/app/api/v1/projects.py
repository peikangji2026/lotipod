from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    MemberAdd, MemberResponse,
    EnvironmentCreate, EnvironmentUpdate, EnvironmentResponse,
)
from app.services.project_service import ProjectService

router = APIRouter()


# ===== 项目 CRUD =====

@router.get("", response_model=list[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取当前用户有权限的项目列表"""
    return ProjectService(db).get_projects(current_user.id)


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建项目"""
    return ProjectService(db).create_project(data, current_user.id)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取项目详情"""
    return ProjectService(db).get_project(project_id, current_user.id)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新项目信息"""
    return ProjectService(db).update_project(project_id, data, current_user.id)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除项目（软删除）"""
    ProjectService(db).delete_project(project_id, current_user.id)


# ===== 成员管理 =====

@router.get("/{project_id}/members", response_model=list[MemberResponse])
def list_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取项目成员列表"""
    return ProjectService(db).get_members(project_id, current_user.id)


@router.post("/{project_id}/members", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
def add_member(
    project_id: int,
    data: MemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """添加项目成员"""
    return ProjectService(db).add_member(project_id, data.username, data.role, current_user.id)


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """移除项目成员"""
    ProjectService(db).remove_member(project_id, user_id, current_user.id)


# ===== 环境配置 =====

@router.get("/{project_id}/environments", response_model=list[EnvironmentResponse])
def list_environments(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取项目环境列表"""
    return ProjectService(db).get_environments(project_id, current_user.id)


@router.post("/{project_id}/environments", response_model=EnvironmentResponse, status_code=status.HTTP_201_CREATED)
def create_environment(
    project_id: int,
    data: EnvironmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建环境配置"""
    return ProjectService(db).create_environment(project_id, data, current_user.id)


@router.put("/environments/{env_id}", response_model=EnvironmentResponse)
def update_environment(
    env_id: int,
    data: EnvironmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新环境配置"""
    return ProjectService(db).update_environment(env_id, data, current_user.id)


@router.delete("/environments/{env_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_environment(
    env_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除环境配置"""
    ProjectService(db).delete_environment(env_id, current_user.id)
