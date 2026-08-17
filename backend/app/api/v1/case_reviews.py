"""
用例评审 API
"""
from datetime import datetime, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.testcase import ApiTestCase
from app.models.func_test_case import FuncTestCase
from app.models.case_review import CaseReview, CaseReviewMember, CaseReviewItem

router = APIRouter()


# ── Pydantic Schemas ────────────────────────────────────────────────────────

class ReviewCaseItem(BaseModel):
    case_type: str   # 'api' | 'functional'
    case_id: int

class CreateReviewPayload(BaseModel):
    title: str
    deadline: Optional[date] = None
    reviewer_ids: List[int]
    cases: List[ReviewCaseItem]

class UpdateReviewPayload(BaseModel):
    title: Optional[str] = None
    deadline: Optional[date] = None
    status: Optional[str] = None

class SubmitItemPayload(BaseModel):
    result: str    # approved / rejected / needs_change
    comment: Optional[str] = None


# ── 辅助函数 ────────────────────────────────────────────────────────────────

def _enrich_review(review: CaseReview, db: Session) -> dict:
    """构建评审列表项（含统计）"""
    total_items = len(review.items)
    # 每个评审人视角：对每个用例都有一条 item
    unique_cases = len(set((i.case_type, i.case_id) for i in review.items))
    approved = sum(1 for i in review.items if i.result == "approved")
    pass_rate = round(approved / total_items * 100, 1) if total_items > 0 else 0.0

    completed_members = sum(1 for m in review.members if m.status == "completed")
    total_members = len(review.members)

    creator = review.creator
    return {
        "id": review.id,
        "title": review.title,
        "status": review.status,
        "deadline": review.deadline.isoformat() if review.deadline else None,
        "created_at": review.created_at.isoformat(),
        "created_by": review.created_by,
        "creator_name": creator.username if creator else None,
        "total_cases": unique_cases,
        "total_items": total_items,
        "approved_count": approved,
        "pass_rate": pass_rate,
        "completed_members": completed_members,
        "total_members": total_members,
        "members": [
            {
                "user_id": m.user_id,
                "username": m.user.username if m.user else None,
                "status": m.status,
            }
            for m in review.members
        ],
    }


def _get_case_name(case_type: str, case_id: int, db: Session) -> str:
    if case_type == "api":
        c = db.query(ApiTestCase).filter(ApiTestCase.id == case_id).first()
        return c.name if c else f"API 用例 #{case_id}"
    else:
        c = db.query(FuncTestCase).filter(FuncTestCase.id == case_id).first()
        return c.title if c else f"功能用例 #{case_id}"


def _get_case_priority(case_type: str, case_id: int, db: Session) -> str:
    priority_map = {"high": "P1", "medium": "P2", "low": "P3"}
    if case_type == "api":
        c = db.query(ApiTestCase).filter(ApiTestCase.id == case_id).first()
        p = getattr(c, "priority", "-") if c else "-"
        return priority_map.get(p, p)
    else:
        c = db.query(FuncTestCase).filter(FuncTestCase.id == case_id).first()
        return getattr(c, "priority", "-") if c else "-"


def _check_expired(review: CaseReview, db: Session) -> CaseReview:
    """若已超过截止日期且仍为 active，自动转为 expired"""
    if review.status == "active" and review.deadline and review.deadline < date.today():
        review.status = "expired"
        db.commit()
        db.refresh(review)
    return review


# ── 评审列表 ────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/case-reviews")
def list_reviews(
    project_id: int,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(CaseReview).filter(CaseReview.project_id == project_id)
    if status:
        q = q.filter(CaseReview.status == status)
    reviews = q.order_by(CaseReview.created_at.desc()).all()
    # 自动过期检测
    for r in reviews:
        _check_expired(r, db)
    return [_enrich_review(r, db) for r in reviews]


# ── 创建评审 ────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/case-reviews", status_code=201)
def create_review(
    project_id: int,
    payload: CreateReviewPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.cases:
        raise HTTPException(status_code=400, detail="至少选择一个用例")
    if not payload.reviewer_ids:
        raise HTTPException(status_code=400, detail="至少指定一名评审人")

    review = CaseReview(
        project_id=project_id,
        title=payload.title,
        deadline=payload.deadline,
        created_by=current_user.id,
    )
    db.add(review)
    db.flush()   # 获取 review.id

    # 评审人
    for uid in payload.reviewer_ids:
        db.add(CaseReviewMember(review_id=review.id, user_id=uid))

    # 每个评审人对每个用例各生成一条 item
    for reviewer_id in payload.reviewer_ids:
        for case in payload.cases:
            db.add(CaseReviewItem(
                review_id=review.id,
                case_type=case.case_type,
                case_id=case.case_id,
                reviewer_id=reviewer_id,
                result="pending",
            ))

    db.commit()
    db.refresh(review)
    return _enrich_review(review, db)


# ── 评审详情 ────────────────────────────────────────────────────────────────

@router.get("/case-reviews/{review_id}")
def get_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.query(CaseReview).filter(CaseReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    _check_expired(review, db)

    base = _enrich_review(review, db)

    # 构建「用例维度」的聚合视图
    case_keys = list(dict.fromkeys((i.case_type, i.case_id) for i in review.items))
    cases_view = []
    for case_type, case_id in case_keys:
        case_items = [i for i in review.items if i.case_type == case_type and i.case_id == case_id]
        my_item = next((i for i in case_items if i.reviewer_id == current_user.id), None)
        others = [
            {
                "reviewer_id": i.reviewer_id,
                "reviewer_name": i.reviewer.username if i.reviewer else None,
                "result": i.result,
                "comment": i.comment,
                "reviewed_at": i.reviewed_at.isoformat() if i.reviewed_at else None,
            }
            for i in case_items if i.reviewer_id != current_user.id
        ]
        cases_view.append({
            "case_type": case_type,
            "case_id": case_id,
            "case_name": _get_case_name(case_type, case_id, db),
            "priority": _get_case_priority(case_type, case_id, db),
            "my_item": {
                "id": my_item.id,
                "result": my_item.result,
                "comment": my_item.comment,
                "reviewed_at": my_item.reviewed_at.isoformat() if my_item.reviewed_at else None,
            } if my_item else None,
            "others_opinions": others,
        })

    base["cases"] = cases_view
    return base


# ── 更新评审基本信息 ────────────────────────────────────────────────────────

@router.put("/case-reviews/{review_id}")
def update_review(
    review_id: int,
    payload: UpdateReviewPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.query(CaseReview).filter(CaseReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    if review.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="仅发起人可修改")

    if payload.title is not None:
        review.title = payload.title
    if payload.deadline is not None:
        review.deadline = payload.deadline
    if payload.status is not None:
        review.status = payload.status

    db.commit()
    db.refresh(review)
    return _enrich_review(review, db)


# ── 删除评审 ────────────────────────────────────────────────────────────────

@router.delete("/case-reviews/{review_id}", status_code=204)
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.query(CaseReview).filter(CaseReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    if review.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="仅发起人可删除")
    db.delete(review)
    db.commit()


# ── 提交单条用例的评审意见 ──────────────────────────────────────────────────

@router.patch("/case-reviews/{review_id}/items/{item_id}")
def submit_item_result(
    review_id: int,
    item_id: int,
    payload: SubmitItemPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(CaseReviewItem).filter(
        CaseReviewItem.id == item_id,
        CaseReviewItem.review_id == review_id,
        CaseReviewItem.reviewer_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="评审条目不存在或无权限")

    item.result = payload.result
    item.comment = payload.comment
    item.reviewed_at = datetime.utcnow()

    # 检查当前评审人是否已对所有用例提交意见
    my_items = db.query(CaseReviewItem).filter(
        CaseReviewItem.review_id == review_id,
        CaseReviewItem.reviewer_id == current_user.id,
    ).all()
    # 更新后判断
    all_done = all(
        (i.result != "pending") if i.id != item.id else (payload.result != "pending")
        for i in my_items
    )
    if all_done:
        member = db.query(CaseReviewMember).filter(
            CaseReviewMember.review_id == review_id,
            CaseReviewMember.user_id == current_user.id,
        ).first()
        if member:
            member.status = "completed"

    db.commit()
    return {"id": item.id, "result": item.result, "comment": item.comment}


# ── 完成评审（发起人操作） ──────────────────────────────────────────────────

@router.post("/case-reviews/{review_id}/complete")
def complete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.query(CaseReview).filter(CaseReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="评审不存在")
    if review.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="仅发起人可完成评审")

    review.status = "completed"
    db.commit()
    return {"id": review.id, "status": review.status}
