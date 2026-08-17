from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.testcase import (
    ModuleCreate, ModuleResponse,
    TestCaseCreate, TestCaseUpdate, TestCaseResponse,
)
from app.services.testcase_service import TestCaseService

router = APIRouter()


# ===== 模块管理 =====

@router.get("/projects/{project_id}/modules", response_model=list[ModuleResponse])
def list_modules(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TestCaseService(db).get_all_modules(project_id)


@router.post("/projects/{project_id}/modules", response_model=ModuleResponse, status_code=201)
def create_module(
    project_id: int,
    data: ModuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TestCaseService(db).create_module(project_id, data)


@router.delete("/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module(
    module_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    TestCaseService(db).delete_module(module_id)


# ===== 测试用例 CRUD =====

@router.get("/projects/{project_id}/testcases")
def list_test_cases(
    project_id: int,
    module_id: int | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, total = TestCaseService(db).get_test_cases(
        project_id, module_id, status, skip, limit
    )
    return {"items": items, "total": total}


@router.post("/projects/{project_id}/testcases", response_model=TestCaseResponse, status_code=201)
def create_test_case(
    project_id: int,
    data: TestCaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TestCaseService(db).create_test_case(project_id, data, current_user.id)


@router.get("/testcases/{case_id}", response_model=TestCaseResponse)
def get_test_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TestCaseService(db).get_test_case(case_id)


@router.put("/testcases/{case_id}", response_model=TestCaseResponse)
def update_test_case(
    case_id: int,
    data: TestCaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TestCaseService(db).update_test_case(case_id, data)


@router.delete("/testcases/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    TestCaseService(db).delete_test_case(case_id)
