from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.orm import relationship, backref
from datetime import datetime
from app.core.database import Base


class FuncCaseGroup(Base):
    """功能测试用例分组（树形结构）"""
    __tablename__ = "func_case_groups"

    id         = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    parent_id  = Column(Integer, ForeignKey("func_case_groups.id"), nullable=True)
    name       = Column(String(100), nullable=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    children = relationship(
        "FuncCaseGroup",
        backref=backref("parent", remote_side=[id]),
        cascade="all, delete-orphan",
    )
    cases = relationship("FuncTestCase", back_populates="group", cascade="all, delete-orphan")


class FuncTestCase(Base):
    """功能测试用例"""
    __tablename__ = "func_test_cases"

    id              = Column(Integer, primary_key=True, index=True)
    project_id      = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    group_id        = Column(Integer, ForeignKey("func_case_groups.id", ondelete="SET NULL"), nullable=True)
    title           = Column(String(200), nullable=False)
    precondition    = Column(Text, nullable=True)
    # P0 / P1 / P2 / P3
    priority        = Column(String(10), default="P2")
    # draft / pending_review / approved / deprecated
    status          = Column(String(20), default="draft")
    # [{step: "操作描述", expected: "预期结果"}]
    steps           = Column(JSONB, default=list)
    tags            = Column(ARRAY(String), default=list)
    estimated_hours = Column(Float, nullable=True)
    created_by      = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group   = relationship("FuncCaseGroup", back_populates="cases")
    creator = relationship("User", foreign_keys=[created_by])
