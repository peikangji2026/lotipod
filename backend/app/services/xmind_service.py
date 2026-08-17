"""
XMind 文件导入/导出服务

.xmind 文件本质是 ZIP 压缩包，内含 content.json（新版）或 content.xml（旧版）。
导入：解析树结构 → 非叶子节点建分组，叶子节点建用例
导出：从数据库读取树 → 构建 content.json → 打包为 ZIP
"""
import json
import zipfile
from io import BytesIO
from sqlalchemy.orm import Session

from app.models.func_test_case import FuncCaseGroup, FuncTestCase


# ===== 导入 =====

def _parse_xmind_bytes(file_bytes: bytes) -> list[dict]:
    """解析 .xmind ZIP 字节，返回 content.json 中的 sheets 列表"""
    buf = BytesIO(file_bytes)
    with zipfile.ZipFile(buf, "r") as zf:
        names = zf.namelist()
        # 优先读 content.json（XMind 8+），否则尝试 content.xml
        if "content.json" in names:
            raw = zf.read("content.json")
            return json.loads(raw)
        raise ValueError("不支持的 XMind 格式，请使用 XMind 8 或更高版本导出的文件")


def import_xmind(file_bytes: bytes, project_id: int, user_id: int, db: Session) -> dict:
    """
    将 .xmind 文件解析并写入数据库。
    规则：有子节点的 → 分组，叶子节点 → 用例
    """
    sheets = _parse_xmind_bytes(file_bytes)
    if not sheets:
        raise ValueError("XMind 文件为空")

    stats = {"groups_created": 0, "cases_created": 0}

    # 取第一个 sheet 的根 topic 的子节点作为顶层
    root_topic = sheets[0].get("rootTopic", {})
    children = root_topic.get("children", {}).get("attached", [])

    def _process(topic: dict, parent_group_id: int | None) -> None:
        title = (topic.get("title") or "").strip() or "未命名"
        sub_topics = topic.get("children", {}).get("attached", [])

        if sub_topics:
            # 有子节点 → 建分组
            group = FuncCaseGroup(
                project_id=project_id,
                parent_id=parent_group_id,
                name=title,
            )
            db.add(group)
            db.flush()
            stats["groups_created"] += 1
            for child in sub_topics:
                _process(child, group.id)
        else:
            # 叶子节点 → 建用例
            case = FuncTestCase(
                project_id=project_id,
                group_id=parent_group_id,
                title=title,
                priority="P2",
                created_by=user_id,
            )
            db.add(case)
            stats["cases_created"] += 1

    for child in children:
        _process(child, None)

    db.commit()
    return stats


# ===== 导出 =====

def _build_topic(title: str, children: list[dict]) -> dict:
    topic: dict = {"title": title}
    if children:
        topic["children"] = {"attached": children}
    return topic


def export_xmind(project_id: int, db: Session) -> bytes:
    """将项目的功能测试用例树导出为 .xmind 字节流"""
    # 1. 查询所有分组和用例
    root_groups = (
        db.query(FuncCaseGroup)
        .filter(FuncCaseGroup.project_id == project_id, FuncCaseGroup.parent_id.is_(None))
        .order_by(FuncCaseGroup.sort_order, FuncCaseGroup.id)
        .all()
    )
    ungrouped_cases = (
        db.query(FuncTestCase)
        .filter(FuncTestCase.project_id == project_id, FuncTestCase.group_id.is_(None))
        .order_by(FuncTestCase.id)
        .all()
    )

    # 2. 递归构建 topic 树
    def _group_to_topic(group: FuncCaseGroup) -> dict:
        sub_topics = []
        for child_group in sorted(group.children, key=lambda g: (g.sort_order, g.id)):
            sub_topics.append(_group_to_topic(child_group))
        for case in sorted(group.cases, key=lambda c: c.id):
            sub_topics.append(_build_topic(case.title, []))
        return _build_topic(group.name, sub_topics)

    root_children = [_group_to_topic(g) for g in root_groups]
    for case in ungrouped_cases:
        root_children.append(_build_topic(case.title, []))

    content = [
        {
            "id": "sheet1",
            "class": "sheet",
            "title": "功能测试用例",
            "rootTopic": _build_topic("测试用例", root_children),
        }
    ]

    # 3. 打包为 ZIP
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("content.json", json.dumps(content, ensure_ascii=False))
        # XMind 需要 metadata.json 才能被正确识别
        metadata = {
            "creator": {"name": "Testing Platform", "version": "1.0.0"},
            "fileVersion": "2.0",
        }
        zf.writestr("metadata.json", json.dumps(metadata))
    return buf.getvalue()
