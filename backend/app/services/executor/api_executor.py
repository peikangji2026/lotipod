import time
import re
import requests
from typing import Any
from app.models.testcase import ApiTestCase
from app.models.environment import Environment


class APITestExecutor:
    """API 测试执行器：发送 HTTP 请求、执行断言、返回结构化结果"""

    def __init__(self, test_case: ApiTestCase, environment: Environment):
        self.test_case = test_case
        self.environment = environment

    def execute(self) -> dict:
        base_url = (self.environment.base_url or "").rstrip("/")
        url = self.test_case.url

        # 如果 URL 不带协议头，拼接 base_url
        if not url.startswith(("http://", "https://")):
            url = f"{base_url}{url}"

        # 合并 headers（环境默认 headers + 用例 headers，用例优先）
        env_headers = self.environment.headers or {}
        case_headers = self.test_case.headers or {}
        headers = {**env_headers, **case_headers}

        # 替换 URL / headers 中的环境变量占位符 {{VAR_NAME}}
        env_vars = self.environment.variables or {}
        url = self._replace_vars(url, env_vars)
        headers = {k: self._replace_vars(v, env_vars) for k, v in headers.items()}

        start_time = time.time()
        try:
            # 处理请求体
            json_body = None
            form_body = None
            raw_body = None
            if self.test_case.body:
                if self.test_case.body_type == "json":
                    import json
                    try:
                        json_body = json.loads(self.test_case.body)
                    except Exception:
                        raw_body = self.test_case.body
                elif self.test_case.body_type == "form":
                    form_body = self.test_case.body
                else:
                    raw_body = self.test_case.body

            response = requests.request(
                method=self.test_case.method.upper(),
                url=url,
                headers=headers,
                params=self.test_case.params or {},
                json=json_body,
                data=form_body or raw_body,
                timeout=30,
            )
            response_time = int((time.time() - start_time) * 1000)

            # 断言
            assertion_results = self._run_assertions(response)
            passed = all(a["passed"] for a in assertion_results)

            # 安全解析响应体
            try:
                resp_json = response.json()
            except Exception:
                resp_json = None

            return {
                "status": "passed" if passed else "failed",
                "request_data": {
                    "method": self.test_case.method,
                    "url": url,
                    "headers": headers,
                    "params": self.test_case.params or {},
                    "body": self.test_case.body,
                },
                "response_data": {
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "body": response.text[:10000],
                    "json": resp_json,
                },
                "response_time": response_time,
                "assertion_results": assertion_results,
                "error_message": None,
            }

        except requests.exceptions.Timeout:
            return self._error_result(url, "请求超时（超过 30 秒）", start_time)
        except requests.exceptions.ConnectionError as e:
            return self._error_result(url, f"连接失败：{str(e)}", start_time)
        except Exception as e:
            return self._error_result(url, str(e), start_time)

    def _run_assertions(self, response) -> list[dict]:
        results = []
        assertions = self.test_case.assertions or []

        for assertion in assertions:
            assertion_type = assertion.get("type") if isinstance(assertion, dict) else assertion.type
            expected = assertion.get("expected") if isinstance(assertion, dict) else assertion.expected
            path = assertion.get("path") if isinstance(assertion, dict) else getattr(assertion, "path", None)

            actual: Any = None
            passed = False
            error_msg = None

            try:
                if assertion_type == "status_code":
                    actual = response.status_code
                    passed = actual == int(expected)

                elif assertion_type == "response_time":
                    actual = int(response.elapsed.total_seconds() * 1000)
                    passed = actual < int(expected)

                elif assertion_type == "json_path":
                    from jsonpath_ng import parse as jp_parse
                    json_data = response.json()
                    matches = jp_parse(path).find(json_data)
                    actual = matches[0].value if matches else None
                    passed = str(actual) == str(expected)

                elif assertion_type == "contains":
                    actual = response.text
                    passed = str(expected) in actual

                elif assertion_type == "regex":
                    actual = response.text
                    passed = bool(re.search(str(expected), actual))

            except Exception as e:
                error_msg = str(e)
                passed = False

            results.append({
                "type": assertion_type,
                "expected": expected,
                "actual": actual,
                "passed": passed,
                "error": error_msg,
            })

        return results

    def _error_result(self, url: str, error_msg: str, start_time: float) -> dict:
        return {
            "status": "error",
            "request_data": {"url": url, "method": self.test_case.method},
            "response_data": None,
            "response_time": int((time.time() - start_time) * 1000),
            "assertion_results": [],
            "error_message": error_msg,
        }

    @staticmethod
    def _replace_vars(text: str, variables: dict) -> str:
        """替换 {{VAR_NAME}} 格式的环境变量"""
        for key, value in variables.items():
            text = text.replace(f"{{{{{key}}}}}", str(value))
        return text
