import { apiClient } from './api'
import type { TestPlan, TestPlanDetail, PlanItem, PlanProgress } from '@/types'

export interface TestPlanPayload {
  name: string
  description?: string
  status?: string
  start_date?: string | null
  end_date?: string | null
}

export interface PlanItemPayload {
  case_type: 'api' | 'functional'
  case_id: number
  sort_order?: number
}

export interface ItemResultPayload {
  result: string
  comment?: string
  defect_ids?: number[]
}

export const testPlanApi = {
  // ===== 计划 =====
  list: (projectId: number) =>
    apiClient.get<TestPlan[]>(`/api/v1/projects/${projectId}/test-plans`),

  create: (projectId: number, data: TestPlanPayload) =>
    apiClient.post<{ id: number; name: string; status: string }>(`/api/v1/projects/${projectId}/test-plans`, data),

  get: (planId: number) =>
    apiClient.get<TestPlanDetail>(`/api/v1/test-plans/${planId}`),

  update: (planId: number, data: Partial<TestPlanPayload>) =>
    apiClient.put(`/api/v1/test-plans/${planId}`, data),

  delete: (planId: number) =>
    apiClient.delete(`/api/v1/test-plans/${planId}`),

  // ===== 条目 =====
  addItems: (planId: number, items: PlanItemPayload[]) =>
    apiClient.post<{ added: number }>(`/api/v1/test-plans/${planId}/items`, { items }),

  removeItem: (planId: number, itemId: number) =>
    apiClient.delete(`/api/v1/test-plans/${planId}/items/${itemId}`),

  updateItemResult: (planId: number, itemId: number, data: ItemResultPayload) =>
    apiClient.patch<{ id: number; result: string; executed_at: string }>(
      `/api/v1/test-plans/${planId}/items/${itemId}`,
      data,
    ),

  // ===== 进度 =====
  getProgress: (planId: number) =>
    apiClient.get<PlanProgress>(`/api/v1/test-plans/${planId}/progress`),

  // ===== 执行 API 用例 =====
  executeApiCases: (planId: number, environmentId: number) =>
    apiClient.post<{ test_run_id: number; message: string }>(
      `/api/v1/test-plans/${planId}/execute-api`,
      { environment_id: environmentId },
    ),

  // ===== 手动生成报告 =====
  generateReport: (planId: number) =>
    apiClient.post<{ id: number; name: string; report_generated_at: string }>(
      `/api/v1/test-plans/${planId}/generate-report`,
    ),
}
