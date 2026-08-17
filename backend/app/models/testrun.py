from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class TestRun(Base):
    """测试执行批次"""
    __tablename__ = "test_runs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    environment_id = Column(Integer, ForeignKey("environments.id"), nullable=True)
    name = Column(String(200))
    # manual / scheduled / ci
    run_type = Column(String(20), default="manual")
    # pending / running / finished / failed
    status = Column(String(20), default="pending")
    total_cases = Column(Integer, default=0)
    passed_cases = Column(Integer, default=0)
    failed_cases = Column(Integer, default=0)
    skipped_cases = Column(Integer, default=0)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    # 执行总耗时（秒）
    duration = Column(Integer)
    triggered_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    # 关联测试计划（可为空，直接执行时不关联计划）
    plan_id = Column(Integer, ForeignKey("test_plans.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="test_runs")
    environment = relationship("Environment", back_populates="test_runs")
    triggered_by_user = relationship("User", back_populates="triggered_test_runs")
    results = relationship("TestResult", back_populates="test_run", cascade="all, delete-orphan")


class TestResult(Base):
    """单条用例执行结果"""
    __tablename__ = "test_results"

    id = Column(Integer, primary_key=True, index=True)
    test_run_id = Column(Integer, ForeignKey("test_runs.id", ondelete="CASCADE"), nullable=False)
    test_case_id = Column(Integer, ForeignKey("api_test_cases.id"), nullable=True)
    # passed / failed / skipped / error
    status = Column(String(20))
    # 实际发送的请求数据
    request_data = Column(JSONB)
    # 响应数据
    response_data = Column(JSONB)
    # 响应时间（毫秒）
    response_time = Column(Integer)
    error_message = Column(Text)
    # 断言结果详情
    assertion_results = Column(JSONB, default=[])
    executed_at = Column(DateTime, default=datetime.utcnow)

    test_run = relationship("TestRun", back_populates="results")
    test_case = relationship("ApiTestCase", back_populates="results")


class ScheduledTask(Base):
    """定时任务"""
    __tablename__ = "scheduled_tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    test_case_ids = Column(ARRAY(Integer), default=[])
    environment_id = Column(Integer, ForeignKey("environments.id"), nullable=True)
    cron_expression = Column(String(100))
    is_active = Column(Integer, default=True)
    last_run_time = Column(DateTime)
    next_run_time = Column(DateTime)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
