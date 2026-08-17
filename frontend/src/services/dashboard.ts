import { apiClient } from './api'

export interface DashboardStats {
  api_case_count: number
  func_case_count: number
  weekly_run_count: number
  overall_pass_rate: number
  active_plan_count: number
}

export interface TrendPoint {
  run_name: string
  pass_rate: number
  executed_at: string
}

export interface PriorityDistribution {
  P0: number
  P1: number
  P2: number
  P3: number
}

export interface RecentPlan {
  id: number
  name: string
  status: string
  progress: number
  total: number
  passed: number
  start_date?: string
  end_date?: string
}

export interface HeatmapPoint {
  date: string
  count: number
}

export interface DashboardData {
  stats: DashboardStats
  api_pass_trend: TrendPoint[]
  priority_distribution: PriorityDistribution
  recent_plans: RecentPlan[]
  activity_heatmap: HeatmapPoint[]
}

export const dashboardApi = {
  get: (projectId: number) =>
    apiClient.get<DashboardData>(`/api/v1/reports/projects/${projectId}/dashboard`),
}
