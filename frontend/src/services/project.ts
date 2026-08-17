import { apiClient } from './api'
import type { Project, ProjectMember, Environment } from '@/types'

export interface ProjectCreatePayload {
  name: string
  description?: string
}

export interface ProjectUpdatePayload {
  name?: string
  description?: string
  is_active?: boolean
}

export interface MemberAddPayload {
  username: string
  role: string
}

export interface EnvironmentPayload {
  name: string
  base_url: string
  variables?: Record<string, string>
  headers?: Record<string, string>
}

export const projectApi = {
  // 项目
  list: () => apiClient.get<Project[]>('/api/v1/projects'),
  get: (id: number) => apiClient.get<Project>(`/api/v1/projects/${id}`),
  create: (data: ProjectCreatePayload) => apiClient.post<Project>('/api/v1/projects', data),
  update: (id: number, data: ProjectUpdatePayload) => apiClient.put<Project>(`/api/v1/projects/${id}`, data),
  delete: (id: number) => apiClient.delete(`/api/v1/projects/${id}`),

  // 成员
  listMembers: (projectId: number) =>
    apiClient.get<ProjectMember[]>(`/api/v1/projects/${projectId}/members`),
  addMember: (projectId: number, data: MemberAddPayload) =>
    apiClient.post<ProjectMember>(`/api/v1/projects/${projectId}/members`, data),
  removeMember: (projectId: number, userId: number) =>
    apiClient.delete(`/api/v1/projects/${projectId}/members/${userId}`),

  // 环境
  listEnvironments: (projectId: number) =>
    apiClient.get<Environment[]>(`/api/v1/projects/${projectId}/environments`),
  createEnvironment: (projectId: number, data: EnvironmentPayload) =>
    apiClient.post<Environment>(`/api/v1/projects/${projectId}/environments`, data),
  updateEnvironment: (envId: number, data: Partial<EnvironmentPayload>) =>
    apiClient.put<Environment>(`/api/v1/projects/environments/${envId}`, data),
  deleteEnvironment: (envId: number) =>
    apiClient.delete(`/api/v1/projects/environments/${envId}`),
}
