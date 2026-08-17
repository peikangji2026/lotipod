from datetime import datetime
from app.tasks.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.testcase import ApiTestCase
from app.models.testrun import TestRun, TestResult
from app.models.environment import Environment
from app.services.executor.api_executor import APITestExecutor


@celery_app.task(bind=True, name="execute_test_run")
def execute_test_run(self, test_run_id: int):
    """批量执行测试用例（Celery 异步任务）"""
    db = SessionLocal()
    try:
        run = db.query(TestRun).filter(TestRun.id == test_run_id).first()
        if not run:
            return {"error": "TestRun not found"}

        # 更新状态为运行中
        run.status = "running"
        run.start_time = datetime.utcnow()
        db.commit()

        environment = db.query(Environment).filter(
            Environment.id == run.environment_id
        ).first()

        # 获取本次要执行的用例（通过已创建的 TestResult 记录）
        results = db.query(TestResult).filter(TestResult.test_run_id == test_run_id).all()
        case_ids = [r.test_case_id for r in results]

        passed = failed = error = 0

        for case_id in case_ids:
            case = db.query(ApiTestCase).filter(ApiTestCase.id == case_id).first()
            if not case or not environment:
                # 更新对应 result 为 error
                result_record = db.query(TestResult).filter(
                    TestResult.test_run_id == test_run_id,
                    TestResult.test_case_id == case_id,
                ).first()
                if result_record:
                    result_record.status = "error"
                    result_record.error_message = "用例或环境不存在"
                error += 1
                continue

            executor = APITestExecutor(case, environment)
            exec_result = executor.execute()

            result_record = db.query(TestResult).filter(
                TestResult.test_run_id == test_run_id,
                TestResult.test_case_id == case_id,
            ).first()
            if result_record:
                result_record.status = exec_result["status"]
                result_record.request_data = exec_result["request_data"]
                result_record.response_data = exec_result["response_data"]
                result_record.response_time = exec_result["response_time"]
                result_record.assertion_results = exec_result["assertion_results"]
                result_record.error_message = exec_result["error_message"]
                result_record.executed_at = datetime.utcnow()

            status = exec_result["status"]
            if status == "passed":
                passed += 1
            elif status in ("failed", "error"):
                failed += 1

            db.commit()

        # 更新汇总
        end_time = datetime.utcnow()
        run.status = "finished"
        run.end_time = end_time
        run.passed_cases = passed
        run.failed_cases = failed + error
        run.duration = int((end_time - run.start_time).total_seconds())
        db.commit()

        return {"status": "finished", "passed": passed, "failed": failed}

    except Exception as e:
        db.rollback()
        run = db.query(TestRun).filter(TestRun.id == test_run_id).first()
        if run:
            run.status = "failed"
            db.commit()
        raise e
    finally:
        db.close()
