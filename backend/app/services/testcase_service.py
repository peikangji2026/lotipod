from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.testcase import Module, ApiTestCase
from app.schemas.testcase import ModuleCreate, TestCaseCreate, TestCaseUpdate


class TestCaseService:
    def __init__(self, db: Session):
        self.db = db

    # ===== 模块 =====

    def get_modules(self, project_id: int) -> list[Module]:
        return self.db.query(Module).filter(
            Module.project_id == project_id,
            Module.parent_id == None,
        ).all()

    def get_all_modules(self, project_id: int) -> list[Module]:
        return self.db.query(Module).filter(Module.project_id == project_id).all()

    def create_module(self, project_id: int, data: ModuleCreate) -> Module:
        module = Module(project_id=project_id, **data.model_dump())
        self.db.add(module)
        self.db.commit()
        self.db.refresh(module)
        return module

    def delete_module(self, module_id: int) -> None:
        module = self.db.query(Module).filter(Module.id == module_id).first()
        if not module:
            raise HTTPException(status_code=404, detail="模块不存在")
        # 模块下的用例归为未分类（module_id 置空）
        self.db.query(ApiTestCase).filter(
            ApiTestCase.module_id == module_id
        ).update({"module_id": None})
        self.db.delete(module)
        self.db.commit()

    # ===== 用例 CRUD =====

    def get_test_cases(
        self,
        project_id: int,
        module_id: int | None = None,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[ApiTestCase], int]:
        query = self.db.query(ApiTestCase).filter(
            ApiTestCase.project_id == project_id
        )
        if module_id is not None:
            query = query.filter(ApiTestCase.module_id == module_id)
        if status:
            query = query.filter(ApiTestCase.status == status)

        total = query.count()
        items = query.order_by(ApiTestCase.created_at.desc()).offset(skip).limit(limit).all()
        return items, total

    def get_test_case(self, case_id: int) -> ApiTestCase:
        case = self.db.query(ApiTestCase).filter(ApiTestCase.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="测试用例不存在")
        return case

    def create_test_case(
        self, project_id: int, data: TestCaseCreate, user_id: int
    ) -> ApiTestCase:
        payload = data.model_dump()
        # 断言列表序列化为 dict
        payload["assertions"] = [a.model_dump() for a in (data.assertions or [])]
        case = ApiTestCase(
            project_id=project_id,
            created_by=user_id,
            **payload,
        )
        self.db.add(case)
        self.db.commit()
        self.db.refresh(case)
        return case

    def update_test_case(self, case_id: int, data: TestCaseUpdate) -> ApiTestCase:
        case = self.get_test_case(case_id)
        update_data = data.model_dump(exclude_unset=True)
        if "assertions" in update_data and update_data["assertions"] is not None:
            update_data["assertions"] = [
                a.model_dump() if hasattr(a, "model_dump") else a
                for a in update_data["assertions"]
            ]
        for field, value in update_data.items():
            setattr(case, field, value)
        self.db.commit()
        self.db.refresh(case)
        return case

    def delete_test_case(self, case_id: int) -> None:
        case = self.get_test_case(case_id)
        self.db.delete(case)
        self.db.commit()
