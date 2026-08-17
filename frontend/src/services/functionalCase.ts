import { apiClient } from './api'
import type { FuncCaseGroup, FuncTestCase, MindMapNode } from '@/types'

export interface FuncCasePayload {
  title: string
  group_id?: number | null
  precondition?: string
  priority?: string
  status?: string
  steps?: Array<{ step: string; expected: string }>
  tags?: string[]
  estimated_hours?: number | null
}

export interface FuncCaseGroupPayload {
  name: string
  parent_id?: number | null
  sort_order?: number
}

export interface PageResult<T> {
  items: T[]
  total: number
}

export interface FuncCaseListParams {
  group_id?: number
  priority?: string
  status?: string
  keyword?: string
  skip?: number
  limit?: number
}

export interface BatchUpdatePayload {
  case_ids: number[]
  group_id?: number | null
  priority?: string
  status?: string
  action?: 'update' | 'delete'
}

export const funcCaseApi = {
  // ===== 分组 =====
  listGroups: (projectId: number) =>
    apiClient.get<FuncCaseGroup[]>(`/api/v1/projects/${projectId}/func-case-groups`),

  createGroup: (projectId: number, data: FuncCaseGroupPayload) =>
    apiClient.post<FuncCaseGroup>(`/api/v1/projects/${projectId}/func-case-groups`, data),

  updateGroup: (groupId: number, data: Partial<FuncCaseGroupPayload>) =>
    apiClient.put<FuncCaseGroup>(`/api/v1/func-case-groups/${groupId}`, data),

  deleteGroup: (groupId: number) =>
    apiClient.delete(`/api/v1/func-case-groups/${groupId}`),

  // ===== 用例 =====
  list: (projectId: number, params?: FuncCaseListParams) =>
    apiClient.get<PageResult<FuncTestCase>>(`/api/v1/projects/${projectId}/func-cases`, { params }),

  get: (caseId: number) =>
    apiClient.get<FuncTestCase>(`/api/v1/func-cases/${caseId}`),

  create: (projectId: number, data: FuncCasePayload) =>
    apiClient.post<FuncTestCase>(`/api/v1/projects/${projectId}/func-cases`, data),

  update: (caseId: number, data: Partial<FuncCasePayload>) =>
    apiClient.put<FuncTestCase>(`/api/v1/func-cases/${caseId}`, data),

  delete: (caseId: number) =>
    apiClient.delete(`/api/v1/func-cases/${caseId}`),

  batchUpdate: (projectId: number, data: BatchUpdatePayload) =>
    apiClient.post(`/api/v1/projects/${projectId}/func-cases/batch`, data),

  // ===== 脑图树 =====
  getMindMapTree: (projectId: number) =>
    apiClient.get<MindMapNode[]>(`/api/v1/projects/${projectId}/func-cases/tree`),

  saveMindMapTree: (projectId: number, nodes: MindMapNode[]) =>
    apiClient.put(`/api/v1/projects/${projectId}/func-cases/tree`, { nodes }),

  // ===== XMind =====
  importXmind: (projectId: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post(
      `/api/v1/projects/${projectId}/func-cases/import-xmind`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
  },

  exportXmindUrl: (projectId: number) =>
    `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/projects/${projectId}/func-cases/export-xmind`,
}
