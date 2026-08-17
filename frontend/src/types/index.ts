// ===== 用户 =====
export interface User {
  id: number
  username: string
  email: string
  full_name?: string
  is_active: boolean
  is_superuser: boolean
  created_at: string
}

// ===== 项目 =====
export interface Project {
  id: number
  name: string
  description?: string
  owner_id: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ProjectMemberRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface ProjectMember {
  id: number
  project_id: number
  user_id: number
  role: ProjectMemberRole
  username: string
  full_name?: string
  email: string
}

// ===== 环境 =====
export interface Environment {
  id: number
  project_id: number
  name: string
  base_url: string
  variables: Record<string, string>
  headers: Record<string, string>
}

// ===== 测试模块 =====
export interface Module {
  id: number
  project_id: number
  name: string
  parent_id?: number
  description?: string
  children?: Module[]
}

// ===== 测试用例 =====
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
export type BodyType = 'json' | 'form' | 'xml' | 'raw' | 'none'
export type CasePriority = 'high' | 'medium' | 'low'
export type CaseStatus = 'draft' | 'active' | 'deprecated'

export interface Assertion {
  type: 'status_code' | 'response_time' | 'json_path' | 'contains' | 'regex'
  expected: string | number
  path?: string
}

export interface ApiTestCase {
  id: number
  project_id: number
  module_id?: number
  name: string
  description?: string
  method: HttpMethod
  url: string
  headers: Record<string, string>
  params: Record<string, string>
  body?: string
  body_type: BodyType
  assertions: Assertion[]
  pre_script?: string
  post_script?: string
  priority: CasePriority
  status: CaseStatus
  created_by?: number
  created_at: string
  updated_at: string
}

// ===== 测试执行 =====
export type RunStatus = 'pending' | 'running' | 'finished' | 'failed'
export type ResultStatus = 'passed' | 'failed' | 'skipped' | 'error'

export interface TestRun {
  id: number
  project_id: number
  environment_id?: number
  name: string
  run_type: 'manual' | 'scheduled' | 'ci'
  status: RunStatus
  total_cases: number
  passed_cases: number
  failed_cases: number
  skipped_cases: number
  start_time?: string
  end_time?: string
  duration?: number
  created_at: string
}

export interface TestResult {
  id: number
  test_run_id: number
  test_case_id: number
  test_case_name?: string
  status: ResultStatus
  request_data?: Record<string, unknown>
  response_data?: Record<string, unknown>
  response_time?: number
  error_message?: string
  assertion_results: Array<{
    type: string
    expected: unknown
    actual: unknown
    passed: boolean
    error?: string
  }>
  executed_at: string
}

// ===== 功能测试用例 =====
export type FuncCasePriority = 'P0' | 'P1' | 'P2' | 'P3'
export type FuncCaseStatus = 'draft' | 'pending_review' | 'approved' | 'deprecated'

export interface FuncCaseGroup {
  id: number
  project_id: number
  parent_id?: number
  name: string
  sort_order: number
  created_at: string
  children?: FuncCaseGroup[]
}

export interface TestStep {
  step: string
  expected: string
}

export interface FuncTestCase {
  id: number
  project_id: number
  group_id?: number
  title: string
  precondition?: string
  priority: FuncCasePriority
  status: FuncCaseStatus
  steps: TestStep[]
  tags: string[]
  estimated_hours?: number
  created_by?: number
  created_at: string
  updated_at: string
}

export interface MindMapNode {
  id?: number
  node_type: 'group' | 'case'
  title: string
  priority?: FuncCasePriority
  sort_order?: number
  children?: MindMapNode[]
}

// ===== 测试计划 =====
export type PlanStatus = 'draft' | 'active' | 'completed' | 'archived'
export type PlanItemResult = 'pending' | 'passed' | 'failed' | 'blocked' | 'skipped'

export interface PlanProgress {
  total: number
  pending: number
  passed: number
  failed: number
  blocked: number
  skipped: number
  pass_rate: number
}

export interface TestPlan {
  id: number
  project_id: number
  name: string
  description?: string
  status: PlanStatus
  start_date?: string
  end_date?: string
  created_by?: number
  created_at: string
  updated_at: string
  total_cases: number
  progress?: PlanProgress
}

export interface PlanItem {
  id: number
  plan_id: number
  case_type: 'api' | 'functional'
  case_id: number
  result: PlanItemResult
  executed_by?: number
  executed_at?: string
  comment?: string
  defect_ids?: number[]
  sort_order: number
  created_at: string
  case_name?: string
  case_url?: string
}

export interface TestPlanDetail extends TestPlan {
  items: PlanItem[]
}

// ===== 通用 =====
export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface ApiResponse<T = unknown> {
  data: T
  message?: string
}
