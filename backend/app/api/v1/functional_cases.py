from fastapi import APIRouter, Depends, Query, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.func_testcase import (
    FuncCaseGroupCreate, FuncCaseGroupUpdate, FuncCaseGroupResponse,
    FuncTestCaseCreate, FuncTestCaseUpdate, FuncTestCaseResponse,
    FuncCaseBatchUpdate, MindMapSaveRequest,
)
from app.services.func_testcase_service import FuncTestCaseService
from app.services.xmind_service import import_xmind, export_xmind

router = APIRouter()


# ===== 分组管理 =====

@router.get("/projects/{project_id}/func-case-groups", response_model=list[FuncCaseGroupResponse])
def list_groups(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取根分组列表（前端自行递归渲染子分组）"""
    return FuncTestCaseService(db).get_group_tree(project_id)


@router.post(
    "/projects/{project_id}/func-case-groups",
    response_model=FuncCaseGroupResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_group(
    project_id: int,
    data: FuncCaseGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return FuncTestCaseService(db).create_group(project_id, data)


@router.put("/func-case-groups/{group_id}", response_model=FuncCaseGroupResponse)
def update_group(
    group_id: int,
    data: FuncCaseGroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return FuncTestCaseService(db).update_group(group_id, data)


@router.delete("/func-case-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    FuncTestCaseService(db).delete_group(group_id)


# ===== 功能用例 CRUD =====

@router.get("/projects/{project_id}/func-cases")
def list_func_cases(
    project_id: int,
    group_id: int | None = Query(None),
    priority: str | None = Query(None),
    status: str | None = Query(None),
    keyword: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, total = FuncTestCaseService(db).get_cases(
        project_id, group_id, priority, status, keyword, skip, limit
    )
    return {"items": items, "total": total}


@router.post(
    "/projects/{project_id}/func-cases",
    response_model=FuncTestCaseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_func_case(
    project_id: int,
    data: FuncTestCaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return FuncTestCaseService(db).create_case(project_id, data, current_user.id)


@router.get("/func-cases/{case_id}", response_model=FuncTestCaseResponse)
def get_func_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return FuncTestCaseService(db).get_case(case_id)


@router.put("/func-cases/{case_id}", response_model=FuncTestCaseResponse)
def update_func_case(
    case_id: int,
    data: FuncTestCaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return FuncTestCaseService(db).update_case(case_id, data)


@router.delete("/func-cases/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_func_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    FuncTestCaseService(db).delete_case(case_id)


@router.post("/projects/{project_id}/func-cases/batch")
def batch_update_func_cases(
    project_id: int,
    data: FuncCaseBatchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return FuncTestCaseService(db).batch_update(project_id, data)


# ===== 脑图树结构 =====

@router.get("/projects/{project_id}/func-cases/tree")
def get_mind_map_tree(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取完整树结构，供脑图视图使用"""
    return FuncTestCaseService(db).get_mind_map_tree(project_id)


@router.put("/projects/{project_id}/func-cases/tree")
def save_mind_map_tree(
    project_id: int,
    data: MindMapSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """保存脑图树结构到数据库"""
    return FuncTestCaseService(db).save_mind_map_tree(project_id, data, current_user.id)


# ===== XMind 导入/导出 =====

@router.post("/projects/{project_id}/func-cases/import-xmind")
async def import_xmind_file(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """上传 .xmind 文件，解析导入为分组+用例"""
    if not file.filename or not file.filename.endswith(".xmind"):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="请上传 .xmind 格式文件")
    file_bytes = await file.read()
    stats = import_xmind(file_bytes, project_id, current_user.id, db)
    return {"message": "导入成功", **stats}


@router.get("/projects/{project_id}/func-cases/export-xmind")
def export_xmind_file(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """将项目功能测试用例导出为 .xmind 文件"""
    xmind_bytes = export_xmind(project_id, db)
    return StreamingResponse(
        BytesIO(xmind_bytes),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename=func_cases_{project_id}.xmind"},
    )
