from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.func_test_case import FuncCaseGroup, FuncTestCase
from app.schemas.func_testcase import (
    FuncCaseGroupCreate, FuncCaseGroupUpdate,
    FuncTestCaseCreate, FuncTestCaseUpdate,
    FuncCaseBatchUpdate, MindMapNode, MindMapSaveRequest,
)


class FuncTestCaseService:
    def __init__(self, db: Session):
        self.db = db

    # ===== 分组 =====

    def get_group_tree(self, project_id: int) -> list[FuncCaseGroup]:
        """获取根分组列表（含子分组通过 ORM lazy load）"""
        return (
            self.db.query(FuncCaseGroup)
            .filter(FuncCaseGroup.project_id == project_id, FuncCaseGroup.parent_id.is_(None))
            .order_by(FuncCaseGroup.sort_order, FuncCaseGroup.id)
            .all()
        )

    def create_group(self, project_id: int, data: FuncCaseGroupCreate) -> FuncCaseGroup:
        group = FuncCaseGroup(project_id=project_id, **data.model_dump())
        self.db.add(group)
        self.db.commit()
        self.db.refresh(group)
        return group

    def update_group(self, group_id: int, data: FuncCaseGroupUpdate) -> FuncCaseGroup:
        group = self.db.query(FuncCaseGroup).filter(FuncCaseGroup.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="分组不存在")
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(group, k, v)
        self.db.commit()
        self.db.refresh(group)
        return group

    def delete_group(self, group_id: int) -> None:
        group = self.db.query(FuncCaseGroup).filter(FuncCaseGroup.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="分组不存在")
        # 分组下的用例 group_id 置为 NULL（由 ForeignKey SET NULL 处理）
        self.db.delete(group)
        self.db.commit()

    # ===== 用例 CRUD =====

    def get_cases(
        self,
        project_id: int,
        group_id: int | None = None,
        priority: str | None = None,
        status: str | None = None,
        keyword: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[FuncTestCase], int]:
        query = self.db.query(FuncTestCase).filter(FuncTestCase.project_id == project_id)
        if group_id is not None:
            query = query.filter(FuncTestCase.group_id == group_id)
        if priority:
            query = query.filter(FuncTestCase.priority == priority)
        if status:
            query = query.filter(FuncTestCase.status == status)
        if keyword:
            query = query.filter(FuncTestCase.title.ilike(f"%{keyword}%"))
        total = query.count()
        items = query.order_by(FuncTestCase.created_at.desc()).offset(skip).limit(limit).all()
        return items, total

    def get_case(self, case_id: int) -> FuncTestCase:
        case = self.db.query(FuncTestCase).filter(FuncTestCase.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="用例不存在")
        return case

    def create_case(self, project_id: int, data: FuncTestCaseCreate, user_id: int) -> FuncTestCase:
        payload = data.model_dump()
        payload["steps"] = [s.model_dump() for s in (data.steps or [])]
        case = FuncTestCase(project_id=project_id, created_by=user_id, **payload)
        self.db.add(case)
        self.db.commit()
        self.db.refresh(case)
        return case

    def update_case(self, case_id: int, data: FuncTestCaseUpdate) -> FuncTestCase:
        case = self.get_case(case_id)
        update_data = data.model_dump(exclude_unset=True)
        if "steps" in update_data and update_data["steps"] is not None:
            update_data["steps"] = [
                s.model_dump() if hasattr(s, "model_dump") else s
                for s in update_data["steps"]
            ]
        for k, v in update_data.items():
            setattr(case, k, v)
        self.db.commit()
        self.db.refresh(case)
        return case

    def delete_case(self, case_id: int) -> None:
        case = self.get_case(case_id)
        self.db.delete(case)
        self.db.commit()

    def batch_update(self, project_id: int, data: FuncCaseBatchUpdate) -> dict:
        cases = (
            self.db.query(FuncTestCase)
            .filter(FuncTestCase.project_id == project_id, FuncTestCase.id.in_(data.case_ids))
            .all()
        )
        if data.action == "delete":
            for c in cases:
                self.db.delete(c)
            self.db.commit()
            return {"deleted": len(cases)}

        for c in cases:
            if data.group_id is not None:
                c.group_id = data.group_id
            if data.priority is not None:
                c.priority = data.priority
            if data.status is not None:
                c.status = data.status
        self.db.commit()
        return {"updated": len(cases)}

    # ===== 脑图树结构 =====

    def _serialize_group_node(self, group: FuncCaseGroup) -> dict:
        """将分组递归序列化为脑图节点"""
        children = []
        for child_group in sorted(group.children, key=lambda g: (g.sort_order, g.id)):
            children.append(self._serialize_group_node(child_group))
        for case in sorted(group.cases, key=lambda c: c.id):
            children.append({
                "id": case.id,
                "node_type": "case",
                "title": case.title,
                "priority": case.priority,
                "sort_order": 0,
                "children": [],
            })
        return {
            "id": group.id,
            "node_type": "group",
            "title": group.name,
            "sort_order": group.sort_order,
            "children": children,
        }

    def get_mind_map_tree(self, project_id: int) -> list[dict]:
        """获取完整脑图树数据"""
        root_groups = self.get_group_tree(project_id)
        tree = []
        for group in root_groups:
            tree.append(self._serialize_group_node(group))
        # 无分组的用例放在树末尾
        ungrouped = (
            self.db.query(FuncTestCase)
            .filter(FuncTestCase.project_id == project_id, FuncTestCase.group_id.is_(None))
            .order_by(FuncTestCase.id)
            .all()
        )
        for case in ungrouped:
            tree.append({
                "id": case.id,
                "node_type": "case",
                "title": case.title,
                "priority": case.priority,
                "sort_order": 0,
                "children": [],
            })
        return tree

    def save_mind_map_tree(self, project_id: int, data: MindMapSaveRequest, user_id: int) -> dict:
        """将脑图树结构同步写入数据库（增量 diff）"""
        stats = {"groups_created": 0, "groups_updated": 0, "cases_created": 0, "cases_updated": 0}
        self._sync_nodes(project_id, data.nodes, parent_group_id=None, user_id=user_id, stats=stats)
        self.db.commit()
        return stats

    def _sync_nodes(
        self,
        project_id: int,
        nodes: list[MindMapNode],
        parent_group_id: int | None,
        user_id: int,
        stats: dict,
    ) -> None:
        for order, node in enumerate(nodes):
            if node.node_type == "group":
                if node.id:
                    group = self.db.query(FuncCaseGroup).filter(FuncCaseGroup.id == node.id).first()
                    if group:
                        group.name = node.title
                        group.parent_id = parent_group_id
                        group.sort_order = order
                        stats["groups_updated"] += 1
                    else:
                        group = FuncCaseGroup(
                            project_id=project_id, name=node.title,
                            parent_id=parent_group_id, sort_order=order,
                        )
                        self.db.add(group)
                        self.db.flush()
                        stats["groups_created"] += 1
                else:
                    group = FuncCaseGroup(
                        project_id=project_id, name=node.title,
                        parent_id=parent_group_id, sort_order=order,
                    )
                    self.db.add(group)
                    self.db.flush()
                    stats["groups_created"] += 1
                self._sync_nodes(project_id, node.children or [], group.id, user_id, stats)

            elif node.node_type == "case":
                if node.id:
                    case = self.db.query(FuncTestCase).filter(FuncTestCase.id == node.id).first()
                    if case:
                        case.title = node.title
                        case.group_id = parent_group_id
                        if node.priority:
                            case.priority = node.priority
                        stats["cases_updated"] += 1
                else:
                    case = FuncTestCase(
                        project_id=project_id,
                        title=node.title,
                        group_id=parent_group_id,
                        priority=node.priority or "P2",
                        created_by=user_id,
                    )
                    self.db.add(case)
                    stats["cases_created"] += 1
