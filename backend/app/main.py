from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import auth, projects, testcases, testruns, reports, functional_cases, test_plans, case_reviews

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="企业级 API 测试平台",
    version=settings.VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)



app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)





app.include_router(auth.router, prefix="/api/v1/auth", tags=["认证"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["项目管理"])
app.include_router(testcases.router, prefix="/api/v1", tags=["测试用例"])
app.include_router(testruns.router, prefix="/api/v1/projects/{project_id}/testruns", tags=["测试执行"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["测试报告"])
app.include_router(functional_cases.router, prefix="/api/v1", tags=["功能测试用例"])
app.include_router(test_plans.router, prefix="/api/v1", tags=["测试计划"])
app.include_router(case_reviews.router, prefix="/api/v1", tags=["用例评审"])


@app.get("/", tags=["健康检查"])
def root():
    return {
        "message": "Test Platform API",
        "version": settings.VERSION,
        "docs": "/api/docs",
    }


@app.get("/api/health", tags=["健康检查"])
def health_check():
    return {"status": "ok", "environment": settings.ENVIRONMENT}
