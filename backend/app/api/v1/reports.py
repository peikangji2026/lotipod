from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.testcase import ApiTestCase
from app.models.func_test_case import FuncTestCase
from app.models.testrun import TestRun, TestResult
from app.models.test_plan import TestPlan, TestPlanItem

router = APIRouter()


@router.get("/projects/{project_id}/overview")
def project_overview(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """项目测试概览统计"""
    total_cases = db.query(ApiTestCase).filter(
        ApiTestCase.project_id == project_id
    ).count()

    active_cases = db.query(ApiTestCase).filter(
        ApiTestCase.project_id == project_id,
        ApiTestCase.status == "active",
    ).count()

    total_runs = db.query(TestRun).filter(
        TestRun.project_id == project_id,
        TestRun.status == "finished",
    ).count()

    # 最近一次执行的统计
    latest_run = (
        db.query(TestRun)
        .filter(TestRun.project_id == project_id, TestRun.status == "finished")
        .order_by(TestRun.created_at.desc())
        .first()
    )

    latest_pass_rate = 0
    if latest_run and latest_run.total_cases > 0:
        latest_pass_rate = round(
            latest_run.passed_cases / latest_run.total_cases * 100, 1
        )

    # 所有已完成执行的汇总通过率
    agg = db.query(
        func.sum(TestRun.passed_cases).label("total_passed"),
        func.sum(TestRun.total_cases).label("total_executed"),
    ).filter(
        TestRun.project_id == project_id,
        TestRun.status == "finished",
    ).first()

    overall_pass_rate = 0
    if agg.total_executed and agg.total_executed > 0:
        overall_pass_rate = round(agg.total_passed / agg.total_executed * 100, 1)

    return {
        "total_cases": total_cases,
        "active_cases": active_cases,
        "total_runs": total_runs,
        "latest_pass_rate": latest_pass_rate,
        "overall_pass_rate": overall_pass_rate,
        "latest_run": {
            "id": latest_run.id,
            "name": latest_run.name,
            "status": latest_run.status,
            "passed_cases": latest_run.passed_cases,
            "failed_cases": latest_run.failed_cases,
            "total_cases": latest_run.total_cases,
            "duration": latest_run.duration,
            "created_at": latest_run.created_at,
        } if latest_run else None,
    }


@router.get("/projects/{project_id}/trend")
def project_trend(
    project_id: int,
    limit: int = 15,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """最近 N 次执行的通过率趋势"""
    runs = (
        db.query(TestRun)
        .filter(TestRun.project_id == project_id, TestRun.status == "finished")
        .order_by(TestRun.created_at.asc())
        .limit(limit)
        .all()
    )

    trend = []
    for r in runs:
        pass_rate = 0
        if r.total_cases > 0:
            pass_rate = round(r.passed_cases / r.total_cases * 100, 1)
        trend.append({
            "run_id": r.id,
            "name": r.name or f"执行 #{r.id}",
            "pass_rate": pass_rate,
            "passed": r.passed_cases,
            "failed": r.failed_cases,
            "total": r.total_cases,
            "duration": r.duration,
            "created_at": r.created_at.strftime("%m-%d %H:%M") if r.created_at else "",
        })

    return trend


@router.get("/projects/{project_id}/runs")
def project_runs_history(
    project_id: int,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """项目全部执行历史列表（报告页用）"""
    query = db.query(TestRun).filter(
        TestRun.project_id == project_id,
        TestRun.status == "finished",
    )
    total = query.count()
    runs = query.order_by(TestRun.created_at.desc()).offset(skip).limit(limit).all()

    items = []
    for r in runs:
        pass_rate = round(r.passed_cases / r.total_cases * 100, 1) if r.total_cases else 0
        items.append({
            "id": r.id,
            "name": r.name or f"执行 #{r.id}",
            "status": r.status,
            "total_cases": r.total_cases,
            "passed_cases": r.passed_cases,
            "failed_cases": r.failed_cases,
            "pass_rate": pass_rate,
            "duration": r.duration,
            "created_at": r.created_at,
        })
    return {"items": items, "total": total}


@router.get("/projects/{project_id}/generated-reports")
def list_generated_reports(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """返回已手动生成报告的测试计划列表（report_generated_at IS NOT NULL）"""
    plans = (
        db.query(TestPlan)
        .filter(
            TestPlan.project_id == project_id,
            TestPlan.report_generated_at.isnot(None),
        )
        .order_by(TestPlan.report_generated_at.desc())
        .all()
    )
    result = []
    for plan in plans:
        total = len(plan.items)
        passed = sum(1 for i in plan.items if i.result == "passed")
        failed = sum(1 for i in plan.items if i.result == "failed")
        blocked = sum(1 for i in plan.items if i.result == "blocked")
        pending = sum(1 for i in plan.items if i.result == "pending")
        pass_rate = round(passed / total * 100, 1) if total else 0.0
        result.append({
            "id": plan.id,
            "name": plan.name,
            "status": plan.status,
            "description": plan.description,
            "start_date": plan.start_date.isoformat() if plan.start_date else None,
            "end_date": plan.end_date.isoformat() if plan.end_date else None,
            "created_at": plan.created_at.isoformat(),
            "report_generated_at": plan.report_generated_at.isoformat(),
            "total": total,
            "passed": passed,
            "failed": failed,
            "blocked": blocked,
            "pending": pending,
            "pass_rate": pass_rate,
        })
    return result


@router.get("/projects/{project_id}/dashboard")
def project_dashboard(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dashboard 所需全部统计数据（一次性返回）"""
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    ninety_days_ago = now - timedelta(days=90)

    # ── 1. 统计卡片 ──────────────────────────────────────────────
    api_case_count = db.query(ApiTestCase).filter(
        ApiTestCase.project_id == project_id
    ).count()

    func_case_count = db.query(FuncTestCase).filter(
        FuncTestCase.project_id == project_id
    ).count()

    weekly_run_count = db.query(TestRun).filter(
        TestRun.project_id == project_id,
        TestRun.created_at >= week_ago,
    ).count()

    active_plan_count = db.query(TestPlan).filter(
        TestPlan.project_id == project_id,
        TestPlan.status == "active",
    ).count()

    # 最近50次执行的综合通过率
    recent_runs = (
        db.query(TestRun)
        .filter(TestRun.project_id == project_id, TestRun.status == "finished")
        .order_by(TestRun.created_at.desc())
        .limit(50)
        .all()
    )
    total_passed = sum(r.passed_cases for r in recent_runs)
    total_executed = sum(r.total_cases for r in recent_runs)
    overall_pass_rate = round(total_passed / total_executed * 100, 1) if total_executed else 0.0

    # ── 2. API 执行通过率趋势（最近10次） ────────────────────────
    trend_runs = (
        db.query(TestRun)
        .filter(TestRun.project_id == project_id, TestRun.status == "finished")
        .order_by(TestRun.created_at.asc())
        .limit(10)
        .all()
    )
    api_pass_trend = []
    for r in trend_runs:
        pass_rate = round(r.passed_cases / r.total_cases * 100, 1) if r.total_cases else 0.0
        api_pass_trend.append({
            "run_name": r.name or f"执行 #{r.id}",
            "pass_rate": pass_rate,
            "executed_at": r.created_at.strftime("%m-%d") if r.created_at else "",
        })

    # ── 3. 用例优先级分布 ─────────────────────────────────────────
    # API 用例：high/medium/low → 映射为 P1/P2/P3
    api_priority_rows = (
        db.query(ApiTestCase.priority, func.count(ApiTestCase.id))
        .filter(ApiTestCase.project_id == project_id)
        .group_by(ApiTestCase.priority)
        .all()
    )
    api_priority_map = {"high": "P1", "medium": "P2", "low": "P3"}
    priority_dist: dict[str, int] = {"P0": 0, "P1": 0, "P2": 0, "P3": 0}
    for prio, cnt in api_priority_rows:
        key = api_priority_map.get(prio, "P3")
        priority_dist[key] = priority_dist.get(key, 0) + cnt

    # 功能用例：P0/P1/P2/P3 直接累加
    func_priority_rows = (
        db.query(FuncTestCase.priority, func.count(FuncTestCase.id))
        .filter(FuncTestCase.project_id == project_id)
        .group_by(FuncTestCase.priority)
        .all()
    )
    for prio, cnt in func_priority_rows:
        if prio in priority_dist:
            priority_dist[prio] += cnt

    # ── 4. 近期测试计划进度（最新5个 active/draft 计划） ──────────
    recent_plans_raw = (
        db.query(TestPlan)
        .filter(TestPlan.project_id == project_id, TestPlan.status.in_(["active", "draft"]))
        .order_by(TestPlan.created_at.desc())
        .limit(5)
        .all()
    )
    recent_plans = []
    for plan in recent_plans_raw:
        total = len(plan.items)
        passed = sum(1 for i in plan.items if i.result == "passed")
        progress = round(passed / total * 100, 1) if total > 0 else 0.0
        recent_plans.append({
            "id": plan.id,
            "name": plan.name,
            "status": plan.status,
            "progress": progress,
            "total": total,
            "passed": passed,
            "start_date": plan.start_date.isoformat() if plan.start_date else None,
            "end_date": plan.end_date.isoformat() if plan.end_date else None,
        })

    # ── 5. 活跃度热力图（过去90天每天的操作数） ──────────────────
    # 统计：每天新增用例数 + 执行次数
    runs_90 = (
        db.query(
            func.date(TestRun.created_at).label("day"),
            func.count(TestRun.id).label("cnt"),
        )
        .filter(TestRun.project_id == project_id, TestRun.created_at >= ninety_days_ago)
        .group_by(func.date(TestRun.created_at))
        .all()
    )
    cases_90 = (
        db.query(
            func.date(ApiTestCase.created_at).label("day"),
            func.count(ApiTestCase.id).label("cnt"),
        )
        .filter(ApiTestCase.project_id == project_id, ApiTestCase.created_at >= ninety_days_ago)
        .group_by(func.date(ApiTestCase.created_at))
        .all()
    )
    func_cases_90 = (
        db.query(
            func.date(FuncTestCase.created_at).label("day"),
            func.count(FuncTestCase.id).label("cnt"),
        )
        .filter(FuncTestCase.project_id == project_id, FuncTestCase.created_at >= ninety_days_ago)
        .group_by(func.date(FuncTestCase.created_at))
        .all()
    )

    heatmap_dict: dict[str, int] = {}
    for day, cnt in [*runs_90, *cases_90, *func_cases_90]:
        key = str(day)
        heatmap_dict[key] = heatmap_dict.get(key, 0) + cnt

    activity_heatmap = [
        {"date": date_str, "count": count}
        for date_str, count in sorted(heatmap_dict.items())
    ]

    return {
        "stats": {
            "api_case_count": api_case_count,
            "func_case_count": func_case_count,
            "weekly_run_count": weekly_run_count,
            "overall_pass_rate": overall_pass_rate,
            "active_plan_count": active_plan_count,
        },
        "api_pass_trend": api_pass_trend,
        "priority_distribution": priority_dist,
        "recent_plans": recent_plans,
        "activity_heatmap": activity_heatmap,
    }


@router.get("/testcases/{case_id}/history")
def testcase_history(
    case_id: int,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """单个测试用例的历史执行记录"""
    results = (
        db.query(TestResult)
        .filter(TestResult.test_case_id == case_id)
        .order_by(TestResult.executed_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": r.id,
            "test_run_id": r.test_run_id,
            "status": r.status,
            "response_time": r.response_time,
            "executed_at": r.executed_at,
        }
        for r in results
    ]


# ── 测试计划报告端点 ───────────────────────────────────────────────────


def _build_plan_summary(plan_id: int, db: Session) -> dict:
    """构建测试计划报告数据，被 summary 和 export-pdf 共用"""
    plan = db.query(TestPlan).filter(TestPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="测试计划不存在")

    items = plan.items  # 已经通过 relationship 加载

    total = len(items)
    passed = sum(1 for i in items if i.result == "passed")
    failed = sum(1 for i in items if i.result == "failed")
    blocked = sum(1 for i in items if i.result == "blocked")
    skipped = sum(1 for i in items if i.result == "skipped")
    pending = sum(1 for i in items if i.result == "pending")
    executed = total - pending
    pass_rate = round(passed / total * 100, 1) if total else 0.0
    execute_rate = round(executed / total * 100, 1) if total else 0.0

    api_count = sum(1 for i in items if i.case_type == "api")
    func_count = sum(1 for i in items if i.case_type == "functional")

    # 获取每条用例的名称和优先级
    api_case_map = {}
    func_case_map = {}
    api_ids = [i.case_id for i in items if i.case_type == "api"]
    func_ids = [i.case_id for i in items if i.case_type == "functional"]
    if api_ids:
        rows = db.query(ApiTestCase).filter(ApiTestCase.id.in_(api_ids)).all()
        api_case_map = {r.id: r for r in rows}
    if func_ids:
        rows = db.query(FuncTestCase).filter(FuncTestCase.id.in_(func_ids)).all()
        func_case_map = {r.id: r for r in rows}

    enriched_items = []
    for item in sorted(items, key=lambda x: x.sort_order):
        if item.case_type == "api":
            case = api_case_map.get(item.case_id)
            case_name = case.name if case else f"API 用例 #{item.case_id}"
            priority = getattr(case, "priority", "-") if case else "-"
            # API 用例 priority 为 high/medium/low，转换显示
            priority_map = {"high": "P1", "medium": "P2", "low": "P3"}
            priority = priority_map.get(priority, priority)
        else:
            case = func_case_map.get(item.case_id)
            case_name = case.title if case else f"功能用例 #{item.case_id}"
            priority = getattr(case, "priority", "-") if case else "-"

        enriched_items.append({
            "case_type": item.case_type,
            "case_id": item.case_id,
            "case_name": case_name,
            "priority": priority,
            "result": item.result,
            "comment": item.comment or "",
            "executed_at": item.executed_at.isoformat() if item.executed_at else None,
        })

    return {
        "plan": {
            "id": plan.id,
            "name": plan.name,
            "status": plan.status,
            "start_date": plan.start_date.isoformat() if plan.start_date else None,
            "end_date": plan.end_date.isoformat() if plan.end_date else None,
        },
        "overview": {
            "total": total,
            "executed": executed,
            "passed": passed,
            "failed": failed,
            "blocked": blocked,
            "skipped": skipped,
            "pending": pending,
            "pass_rate": pass_rate,
            "execute_rate": execute_rate,
        },
        "type_distribution": {
            "api": api_count,
            "functional": func_count,
        },
        "items": enriched_items,
    }


@router.get("/test-plans/{plan_id}/summary")
def plan_report_summary(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """测试计划报告统计数据"""
    return _build_plan_summary(plan_id, db)


@router.get("/test-plans/{plan_id}/export-pdf")
def plan_report_export_pdf(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """导出测试计划报告为 PDF"""
    from app.services.report_pdf_service import generate_plan_report_pdf
    summary = _build_plan_summary(plan_id, db)
    pdf_bytes = generate_plan_report_pdf(summary)
    plan_name = summary["plan"]["name"]
    filename = f"测试报告-{plan_name}.pdf".encode("utf-8").decode("latin-1", errors="replace")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
