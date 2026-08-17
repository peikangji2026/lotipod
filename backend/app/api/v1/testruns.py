import threading
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from app.core.database import get_db, SessionLocal
from app.api.deps import get_current_user
from app.models.user import User
from app.models.testcase import ApiTestCase
from app.models.testrun import TestRun, TestResult
from app.models.environment import Environment
from app.schemas.testcase import TestRunCreate, TestRunResponse, TestResultResponse

router = APIRouter()


def _has_celery_worker() -> bool:
    """检测是否有可用的 Celery Worker"""
    try:
        from app.tasks.celery_app import celery_app
        result = celery_app.control.inspect(timeout=1).ping()
        return bool(result)
    except Exception:
        return False


def _run_in_background(test_run_id: int):
    """在独立线程 + 独立数据库 Session 中执行测试，不阻塞 API 响应"""
    db = SessionLocal()
    try:
        _run_sync(test_run_id, db)
    finally:
        db.close()


@router.post("", response_model=TestRunResponse, status_code=201)
def create_test_run(
    data: TestRunCreate,
    project_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建并触发一次批量测试执行"""
    env = db.query(Environment).filter(Environment.id == data.environment_id).first()
    if not env:
        raise HTTPException(status_code=404, detail="环境不存在")

    run_name = data.name or f"执行 {datetime.now().strftime('%m-%d %H:%M')}"
    run = TestRun(
        project_id=project_id,
        environment_id=data.environment_id,
        name=run_name,
        run_type="manual",
        status="pending",
        total_cases=len(data.test_case_ids),
        triggered_by=current_user.id,
    )
    db.add(run)
    db.flush()

    for case_id in data.test_case_ids:
        db.add(TestResult(test_run_id=run.id, test_case_id=case_id, status="pending"))
    db.commit()
    db.refresh(run)

    run_id = run.id

    # 优先尝试 Celery；没有 Worker 时用后台线程执行（不阻塞 API）
    if _has_celery_worker():
        try:
            from app.tasks.test_tasks import execute_test_run as celery_task
            celery_task.delay(run_id)
        except Exception:
            threading.Thread(target=_run_in_background, args=(run_id,), daemon=True).start()
    else:
        threading.Thread(target=_run_in_background, args=(run_id,), daemon=True).start()

    db.refresh(run)
    return run


def _run_sync(test_run_id: int, db: Session):
    """同步执行（Celery 不可用时的降级方案）"""
    from app.services.executor.api_executor import APITestExecutor

    run = db.query(TestRun).filter(TestRun.id == test_run_id).first()
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


@router.get("")
def list_test_runs(
    project_id: int,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取项目执行历史"""
    query = db.query(TestRun).filter(TestRun.project_id == project_id)
    total = query.count()
    items = query.order_by(TestRun.created_at.desc()).offset(skip).limit(limit).all()
    return {"items": items, "total": total}


@router.get("/{run_id}", response_model=TestRunResponse)
def get_test_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = db.query(TestRun).filter(TestRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    return run


@router.get("/{run_id}/results")
def get_run_results(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取一次执行的所有用例结果"""
    results = db.query(TestResult).filter(TestResult.test_run_id == run_id).all()
    output = []
    for r in results:
        case = db.query(ApiTestCase).filter(ApiTestCase.id == r.test_case_id).first()
        item = {
            "id": r.id,
            "test_run_id": r.test_run_id,
            "test_case_id": r.test_case_id,
            "test_case_name": case.name if case else "已删除",
            "status": r.status,
            "request_data": r.request_data,
            "response_data": r.response_data,
            "response_time": r.response_time,
            "error_message": r.error_message,
            "assertion_results": r.assertion_results,
            "executed_at": r.executed_at,
        }
        output.append(item)
    return output


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = db.query(TestRun).filter(TestRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    db.delete(run)
    db.commit()
