from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class TestPlan(Base):
    """测试计划"""
    __tablename__ = "test_plans"

    id          = Column(Integer, primary_key=True, index=True)
    project_id  = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name        = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    # draft / active / completed / archived
    status      = Column(String(20), default="draft")
    start_date  = Column(Date, nullable=True)
    end_date    = Column(Date, nullable=True)
    created_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # 手动生成报告时间戳，NULL 表示未生成报告
    report_generated_at = Column(DateTime, nullable=True)

    items   = relationship("TestPlanItem", back_populates="plan", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])


class TestPlanItem(Base):
    """测试计划内的单条用例条目"""
    __tablename__ = "test_plan_items"

    id          = Column(Integer, primary_key=True, index=True)
    plan_id     = Column(Integer, ForeignKey("test_plans.id", ondelete="CASCADE"), nullable=False)
    # 'api' | 'functional'
    case_type   = Column(String(20), nullable=False)
    # 对应 api_test_cases.id 或 func_test_cases.id
    case_id     = Column(Integer, nullable=False)
    # pending / passed / failed / blocked / skipped
    result      = Column(String(20), default="pending")
    executed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    executed_at = Column(DateTime, nullable=True)
    comment     = Column(Text, nullable=True)
    defect_ids  = Column(JSONB, default=list)
    sort_order  = Column(Integer, default=0)
    created_at  = Column(DateTime, default=datetime.utcnow)

    plan     = relationship("TestPlan", back_populates="items")
    executor = relationship("User", foreign_keys=[executed_by])
