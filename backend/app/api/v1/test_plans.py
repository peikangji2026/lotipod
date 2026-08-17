import threading
from datetime import datetime
from fastapi import APIRouter, Depends, BackgroundTasks, status
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.api.deps import get_current_user
from app.models.user import User
from app.models.testrun import TestRun, TestResult
from app.models.environment import Environment
from app.models.testcase import ApiTestCase
from app.schemas.test_plan import (
    TestPlanCreate, TestPlanUpdate,
    PlanItemsAdd, PlanItemResultUpdate,
    ExecuteApiCasesRequest,
)
from app.services.test_plan_service import TestPlanService

router = APIRouter()


# ===== 计划列表 / 创建 =====

@router.get("/projects/{project_id}/test-plans")
def list_test_plans(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TestPlanService(db).list_plans(project_id)


@router.post("/projects/{project_id}/test-plans", status_code=status.HTTP_201_CREATED)
def create_test_plan(
    project_id: int,
    data: TestPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = TestPlanService(db).create_plan(project_id, data, current_user.id)
    return {"id": plan.id, "name": plan.name, "status": plan.status}


# ===== 计划详情 / 更新 / 删除 =====

@router.get("/test-plans/{plan_id}")
def get_test_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TestPlanService(db).get_plan_detail(plan_id)


@router.put("/test-plans/{plan_id}")
def update_test_plan(
    plan_id: int,
    data: TestPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = TestPlanService(db).update_plan(plan_id, data)
    return {"id": plan.id, "name": plan.name, "status": plan.status, "updated_at": plan.updated_at}


@router.delete("/test-plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    TestPlanService(db).delete_plan(plan_id)


@router.post("/test-plans/{plan_id}/generate-report")
def generate_report(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """手动触发：将当前测试计划的状态快照标记为已生成报告"""
    from app.models.test_plan import TestPlan
    from fastapi import HTTPException
    plan = db.query(TestPlan).filter(TestPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="测试计划不存在")
    plan.report_generated_at = datetime.utcnow()
    db.commit()
    return {
        "id": plan.id,
        "name": plan.name,
        "report_generated_at": plan.report_generated_at.isoformat(),
    }


# ===== 条目管理 =====

@router.post("/test-plans/{plan_id}/items", status_code=status.HTTP_201_CREATED)
def add_plan_items(
    plan_id: int,
    data: PlanItemsAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    added = TestPlanService(db).add_items(plan_id, data)
    return {"added": len(added)}


@router.delete("/test-plans/{plan_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_plan_item(
    plan_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    TestPlanService(db).remove_item(plan_id, item_id)


@router.patch("/test-plans/{plan_id}/items/{item_id}")
def update_plan_item_result(
    plan_id: int,
    item_id: int,
    data: PlanItemResultUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = TestPlanService(db).update_item_result(plan_id, item_id, data, current_user.id)
    return {"id": item.id, "result": item.result, "executed_at": item.executed_at}


# ===== 进度 =====

@router.get("/test-plans/{plan_id}/progress")
def get_plan_progress(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TestPlanService(db).get_progress(plan_id)


# ===== 执行计划内的 API 用例 =====

def _run_plan_api_cases_bg(test_run_id: int, plan_id: int):
    """后台线程：执行 API 用例，完成后把结果写回 TestPlanItem"""
    db = SessionLocal()
    try:
        from app.services.executor.api_executor import APITestExecutor

        run = db.query(TestRun).filter(TestRun.id == test_run_id).first()
        if not run:
            return
        run.status = "running"
        run.start_time = datetime.utcnow()
        db.commit()

        environment = db.query(Environment).filter(Environment.id == run.environment_id).first()
        results = db.query(TestResult).filter(TestResult.test_run_id == test_run_id).all()

        passed = failed = 0
        for result_record in results:
            case = db.query(ApiTestCase).filter(ApiTestCase.id == result_record.test_case_id).first()
            if not case or not environment:
                result_record.status = "error"
                result_record.error_message = "用例或环境不存在"
                failed += 1
                continue

            exec_result = APITestExecutor(case, environment).execute()
            result_record.status = exec_result["status"]
            result_record.request_data = exec_result["request_data"]
            result_record.response_data = exec_result["response_data"]
            result_record.response_time = exec_result["response_time"]
            result_record.assertion_results = exec_result["assertion_results"]
            result_record.error_message = exec_result["error_message"]
            result_record.executed_at = datetime.utcnow()

            if exec_result["status"] == "passed":
                passed += 1
            else:
                failed += 1
            db.commit()

        end_time = datetime.utcnow()
        run.status = "finished"
        run.end_time = end_time
        run.passed_cases = passed
        run.failed_cases = failed
        run.duration = int((end_time - run.start_time).total_seconds())
        db.commit()

        # 同步结果回测试计划条目
        TestPlanService(db).sync_api_run_results(plan_id, test_run_id)

    finally:
        db.close()


@router.post("/test-plans/{plan_id}/execute-api")
def execute_plan_api_cases(
    plan_id: int,
    data: ExecuteApiCasesRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """触发计划内所有 API 用例的批量自动执行"""
    svc = TestPlanService(db)
    plan = svc.get_plan(plan_id)

    env = db.query(Environment).filter(Environment.id == data.environment_id).first()
    if not env:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="环境不存在")

    api_items = [i for i in plan.items if i.case_type == "api"]
    if not api_items:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="计划中没有 API 用例")

    # 创建 TestRun（关联 plan_id）
    run = TestRun(
        project_id=plan.project_id,
        environment_id=data.environment_id,
        name=f"计划执行 - {plan.name}",
        run_type="manual",
        status="pending",
        total_cases=len(api_items),
        triggered_by=current_user.id,
        plan_id=plan_id,
    )
    db.add(run)
    db.flush()

    for item in api_items:
        db.add(TestResult(test_run_id=run.id, test_case_id=item.case_id, status="pending"))
    db.commit()
    db.refresh(run)

    # 后台线程执行
    threading.Thread(
        target=_run_plan_api_cases_bg,
        args=(run.id, plan_id),
        daemon=True,
    ).start()

    return {"test_run_id": run.id, "message": f"已触发 {len(api_items)} 条 API 用例执行"}
