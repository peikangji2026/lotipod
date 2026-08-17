import { apiClient } from './api'
import type { Module, ApiTestCase, TestRun, TestResult } from '@/types'

export interface TestCasePayload {
  name: string
  description?: string
  module_id?: number | null
  method: string
  url: string
  headers?: Record<string, string>
  params?: Record<string, string>
  body?: string
  body_type?: string
  assertions?: Array<{ type: string; expected: unknown; path?: string }>
  pre_script?: string
  post_script?: string
  priority?: string
  status?: string
}

export interface TestRunPayload {
  name?: string
  environment_id: number
  test_case_ids: number[]
}

export interface PageResult<T> {
  items: T[]
  total: number
}

export const testcaseApi = {
  // 模块
  listModules: (projectId: number) =>
    apiClient.get<Module[]>(`/api/v1/projects/${projectId}/modules`),
  createModule: (projectId: number, data: { name: string; parent_id?: number }) =>
    apiClient.post<Module>(`/api/v1/projects/${projectId}/modules`, data),
  deleteModule: (moduleId: number) =>
    apiClient.delete(`/api/v1/modules/${moduleId}`),

  // 测试用例
  list: (projectId: number, params?: { module_id?: number; status?: string; skip?: number; limit?: number }) =>
    apiClient.get<PageResult<ApiTestCase>>(`/api/v1/projects/${projectId}/testcases`, { params }),
  get: (caseId: number) =>
    apiClient.get<ApiTestCase>(`/api/v1/testcases/${caseId}`),
  create: (projectId: number, data: TestCasePayload) =>
    apiClient.post<ApiTestCase>(`/api/v1/projects/${projectId}/testcases`, data),
  update: (caseId: number, data: Partial<TestCasePayload>) =>
    apiClient.put<ApiTestCase>(`/api/v1/testcases/${caseId}`, data),
  delete: (caseId: number) =>
    apiClient.delete(`/api/v1/testcases/${caseId}`),

  // 测试执行
  createRun: (projectId: number, data: TestRunPayload) =>
    apiClient.post<TestRun>(`/api/v1/projects/${projectId}/testruns`, data),
  listRuns: (projectId: number, params?: { skip?: number; limit?: number }) =>
    apiClient.get<PageResult<TestRun>>(`/api/v1/projects/${projectId}/testruns`, { params }),
  getRun: (projectId: number, runId: number) =>
    apiClient.get<TestRun>(`/api/v1/projects/${projectId}/testruns/${runId}`),
  getRunResults: (projectId: number, runId: number) =>
    apiClient.get<TestResult[]>(`/api/v1/projects/${projectId}/testruns/${runId}/results`),
  deleteRun: (projectId: number, runId: number) =>
    apiClient.delete(`/api/v1/projects/${projectId}/testruns/${runId}`),
}
