from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.test_plan import TestPlan, TestPlanItem
from app.models.testcase import ApiTestCase
from app.models.func_test_case import FuncTestCase
from app.schemas.test_plan import (
    TestPlanCreate, TestPlanUpdate,
    PlanItemsAdd, PlanItemResultUpdate,
    TestPlanProgress,
)


def _enrich_item(item: TestPlanItem, db: Session) -> dict:
    """注入用例名称等信息"""
    d = {
        "id": item.id,
        "plan_id": item.plan_id,
        "case_type": item.case_type,
        "case_id": item.case_id,
        "result": item.result,
        "executed_by": item.executed_by,
        "executed_at": item.executed_at,
        "comment": item.comment,
        "defect_ids": item.defect_ids or [],
        "sort_order": item.sort_order,
        "created_at": item.created_at,
        "case_name": None,
        "case_url": None,
    }
    if item.case_type == "api":
        case = db.query(ApiTestCase).filter(ApiTestCase.id == item.case_id).first()
        if case:
            d["case_name"] = case.name
            d["case_url"] = f"{case.method} {case.url}"
    elif item.case_type == "functional":
        case = db.query(FuncTestCase).filter(FuncTestCase.id == item.case_id).first()
        if case:
            d["case_name"] = case.title
    return d


def _calc_progress(items: list[TestPlanItem]) -> TestPlanProgress:
    total = len(items)
    pending = sum(1 for i in items if i.result == "pending")
    passed  = sum(1 for i in items if i.result == "passed")
    failed  = sum(1 for i in items if i.result == "failed")
    blocked = sum(1 for i in items if i.result == "blocked")
    skipped = sum(1 for i in items if i.result == "skipped")
    pass_rate = round(passed / total * 100, 1) if total > 0 else 0.0
    return TestPlanProgress(
        total=total, pending=pending, passed=passed,
        failed=failed, blocked=blocked, skipped=skipped,
        pass_rate=pass_rate,
    )


class TestPlanService:
    def __init__(self, db: Session):
        self.db = db

    # ===== 计划 CRUD =====

    def list_plans(self, project_id: int) -> list[dict]:
        plans = (
            self.db.query(TestPlan)
            .filter(TestPlan.project_id == project_id)
            .order_by(TestPlan.created_at.desc())
            .all()
        )
        result = []
        for plan in plans:
            d = {
                "id": plan.id,
                "project_id": plan.project_id,
                "name": plan.name,
                "description": plan.description,
                "status": plan.status,
                "start_date": plan.start_date,
                "end_date": plan.end_date,
                "created_by": plan.created_by,
                "created_at": plan.created_at,
                "updated_at": plan.updated_at,
                "total_cases": len(plan.items),
                "progress": _calc_progress(plan.items).model_dump(),
            }
            result.append(d)
        return result

    def create_plan(self, project_id: int, data: TestPlanCreate, user_id: int) -> TestPlan:
        plan = TestPlan(
            project_id=project_id,
            created_by=user_id,
            **data.model_dump(),
        )
        self.db.add(plan)
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def get_plan(self, plan_id: int) -> TestPlan:
        plan = self.db.query(TestPlan).filter(TestPlan.id == plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="测试计划不存在")
        return plan

    def get_plan_detail(self, plan_id: int) -> dict:
        plan = self.get_plan(plan_id)
        items = sorted(plan.items, key=lambda i: (i.sort_order, i.id))
        enriched_items = [_enrich_item(item, self.db) for item in items]
        return {
            "id": plan.id,
            "project_id": plan.project_id,
            "name": plan.name,
            "description": plan.description,
            "status": plan.status,
            "start_date": plan.start_date,
            "end_date": plan.end_date,
            "created_by": plan.created_by,
            "created_at": plan.created_at,
            "updated_at": plan.updated_at,
            "total_cases": len(plan.items),
            "progress": _calc_progress(plan.items).model_dump(),
            "items": enriched_items,
        }

    def update_plan(self, plan_id: int, data: TestPlanUpdate) -> TestPlan:
        plan = self.get_plan(plan_id)
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(plan, k, v)
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def delete_plan(self, plan_id: int) -> None:
        plan = self.get_plan(plan_id)
        self.db.delete(plan)
        self.db.commit()

    # ===== 条目管理 =====

    def add_items(self, plan_id: int, data: PlanItemsAdd) -> list[TestPlanItem]:
        plan = self.get_plan(plan_id)
        # 去重：已存在的 (case_type, case_id) 不重复添加
        existing = {(i.case_type, i.case_id) for i in plan.items}
        added = []
        for item_data in data.items:
            key = (item_data.case_type, item_data.case_id)
            if key in existing:
                continue
            item = TestPlanItem(plan_id=plan_id, **item_data.model_dump())
            self.db.add(item)
            added.append(item)
            existing.add(key)
        self.db.commit()
        return added

    def remove_item(self, plan_id: int, item_id: int) -> None:
        item = self.db.query(TestPlanItem).filter(
            TestPlanItem.id == item_id,
            TestPlanItem.plan_id == plan_id,
        ).first()
        if not item:
            raise HTTPException(status_code=404, detail="条目不存在")
        self.db.delete(item)
        self.db.commit()

    def update_item_result(
        self, plan_id: int, item_id: int, data: PlanItemResultUpdate, user_id: int
    ) -> TestPlanItem:
        item = self.db.query(TestPlanItem).filter(
            TestPlanItem.id == item_id,
            TestPlanItem.plan_id == plan_id,
        ).first()
        if not item:
            raise HTTPException(status_code=404, detail="条目不存在")
        item.result = data.result
        item.comment = data.comment
        item.defect_ids = data.defect_ids or []
        item.executed_by = user_id
        item.executed_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(item)
        return item

    # ===== 进度 =====

    def get_progress(self, plan_id: int) -> TestPlanProgress:
        plan = self.get_plan(plan_id)
        return _calc_progress(plan.items)

    # ===== 执行 API 用例（回写结果到计划条目） =====

    def sync_api_run_results(self, plan_id: int, test_run_id: int) -> None:
        """将 TestRun 的执行结果同步写回对应的 TestPlanItem.result"""
        from app.models.testrun import TestResult
        results = self.db.query(TestResult).filter(TestResult.test_run_id == test_run_id).all()
        for res in results:
            item = self.db.query(TestPlanItem).filter(
                TestPlanItem.plan_id == plan_id,
                TestPlanItem.case_type == "api",
                TestPlanItem.case_id == res.test_case_id,
            ).first()
            if item:
                item.result = "passed" if res.status == "passed" else "failed"
                item.executed_at = res.executed_at
        self.db.commit()
