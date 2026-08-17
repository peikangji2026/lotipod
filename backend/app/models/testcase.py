from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Module(Base):
    """测试模块（树形结构，用于组织用例）"""
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    # 支持子模块（树形结构）
    parent_id = Column(Integer, ForeignKey("modules.id"), nullable=True)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="modules")
    children = relationship("Module", back_populates="parent")
    parent = relationship("Module", back_populates="children", remote_side=[id])
    test_cases = relationship("ApiTestCase", back_populates="module")


class ApiTestCase(Base):
    """API 测试用例"""
    __tablename__ = "api_test_cases"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    # GET / POST / PUT / DELETE / PATCH etc.
    method = Column(String(10), nullable=False)
    url = Column(String(500), nullable=False)
    headers = Column(JSONB, default={})
    params = Column(JSONB, default={})
    body = Column(Text)
    # json / form / xml / raw
    body_type = Column(String(20), default="json")
    # 断言规则列表
    assertions = Column(JSONB, default=[])
    pre_script = Column(Text)
    post_script = Column(Text)
    # high / medium / low
    priority = Column(String(10), default="medium")
    # draft / active / deprecated
    status = Column(String(20), default="draft")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="test_cases")
    module = relationship("Module", back_populates="test_cases")
    creator = relationship("User", back_populates="created_test_cases")
    results = relationship("TestResult", back_populates="test_case")
