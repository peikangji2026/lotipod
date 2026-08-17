import { apiClient } from './api'
import axios from 'axios'

export interface ProjectOverview {
  total_cases: number
  active_cases: number
  total_runs: number
  latest_pass_rate: number
  overall_pass_rate: number
  latest_run: {
    id: number
    name: string
    status: string
    passed_cases: number
    failed_cases: number
    total_cases: number
    duration: number
    created_at: string
  } | null
}

export interface TrendPoint {
  run_id: number
  name: string
  pass_rate: number
  passed: number
  failed: number
  total: number
  duration: number | null
  created_at: string
}

export interface RunHistoryItem {
  id: number
  name: string
  status: string
  total_cases: number
  passed_cases: number
  failed_cases: number
  pass_rate: number
  duration: number | null
  created_at: string
}

export interface PlanReportOverview {
  total: number
  executed: number
  passed: number
  failed: number
  blocked: number
  skipped: number
  pending: number
  pass_rate: number
  execute_rate: number
}

export interface PlanReportItem {
  case_type: 'api' | 'functional'
  case_id: number
  case_name: string
  priority: string
  result: string
  comment: string
  executed_at: string | null
}

export interface PlanReportSummary {
  plan: {
    id: number
    name: string
    status: string
    start_date: string | null
    end_date: string | null
  }
  overview: PlanReportOverview
  type_distribution: { api: number; functional: number }
  items: PlanReportItem[]
}

export const reportApi = {
  overview: (projectId: number) =>
    apiClient.get<ProjectOverview>(`/api/v1/reports/projects/${projectId}/overview`),

  trend: (projectId: number, limit = 15) =>
    apiClient.get<TrendPoint[]>(`/api/v1/reports/projects/${projectId}/trend`, { params: { limit } }),

  runsHistory: (projectId: number, params?: { skip?: number; limit?: number }) =>
    apiClient.get<{ items: RunHistoryItem[]; total: number }>(
      `/api/v1/reports/projects/${projectId}/runs`,
      { params }
    ),

  generatedReports: (projectId: number) =>
    apiClient.get<any[]>(`/api/v1/reports/projects/${projectId}/generated-reports`),

  planSummary: (planId: number) =>
    apiClient.get<PlanReportSummary>(`/api/v1/reports/test-plans/${planId}/summary`),

  exportPlanPDF: async (planId: number, planName: string) => {
    const baseURL = import.meta.env.VITE_API_URL || ''
    const token = localStorage.getItem('access_token') || ''
    const res = await axios.get(`${baseURL}/api/v1/reports/test-plans/${planId}/export-pdf`, {
      responseType: 'blob',
      headers: { Authorization: `Bearer ${token}` },
    })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `测试报告-${planName}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  },
}
