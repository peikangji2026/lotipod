# 统一导出所有模型，确保 Alembic 能发现所有表
from app.models.user import User
from app.models.project import Project, ProjectMember
from app.models.environment import Environment
from app.models.testcase import Module, ApiTestCase
from app.models.testrun import TestRun, TestResult, ScheduledTask
from app.models.func_test_case import FuncCaseGroup, FuncTestCase
from app.models.test_plan import TestPlan, TestPlanItem
from app.models.case_review import CaseReview, CaseReviewMember, CaseReviewItem

__all__ = [
    "User",
    "Project",
    "ProjectMember",
    "Environment",
    "Module",
    "ApiTestCase",
    "TestRun",
    "TestResult",
    "ScheduledTask",
    "FuncCaseGroup",
    "FuncTestCase",
    "TestPlan",
    "TestPlanItem",
    "CaseReview",
    "CaseReviewMember",
    "CaseReviewItem",
]
