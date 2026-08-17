import { apiClient } from './api'

export interface ReviewCasePayload {
  case_type: 'api' | 'functional'
  case_id: number
}

export interface CreateReviewPayload {
  title: string
  deadline?: string
  reviewer_ids: number[]
  cases: ReviewCasePayload[]
}

export interface UpdateReviewPayload {
  title?: string
  deadline?: string
  status?: string
}

export interface SubmitItemPayload {
  result: 'approved' | 'rejected' | 'needs_change'
  comment?: string
}

export interface ReviewMemberInfo {
  user_id: number
  username: string | null
  status: 'pending' | 'completed'
}

export interface ReviewListItem {
  id: number
  title: string
  status: 'active' | 'completed' | 'expired'
  deadline: string | null
  created_at: string
  created_by: number | null
  creator_name: string | null
  total_cases: number
  total_items: number
  approved_count: number
  pass_rate: number
  completed_members: number
  total_members: number
  members: ReviewMemberInfo[]
}

export interface ReviewCaseView {
  case_type: 'api' | 'functional'
  case_id: number
  case_name: string
  priority: string
  my_item: {
    id: number
    result: string
    comment: string | null
    reviewed_at: string | null
  } | null
  others_opinions: {
    reviewer_id: number
    reviewer_name: string | null
    result: string
    comment: string | null
    reviewed_at: string | null
  }[]
}

export interface ReviewDetail extends ReviewListItem {
  cases: ReviewCaseView[]
}

export const caseReviewApi = {
  list: (projectId: number, status?: string) =>
    apiClient.get<ReviewListItem[]>(`/api/v1/projects/${projectId}/case-reviews`, {
      params: status ? { status } : undefined,
    }),

  create: (projectId: number, payload: CreateReviewPayload) =>
    apiClient.post<ReviewListItem>(`/api/v1/projects/${projectId}/case-reviews`, payload),

  get: (reviewId: number) =>
    apiClient.get<ReviewDetail>(`/api/v1/case-reviews/${reviewId}`),

  update: (reviewId: number, payload: UpdateReviewPayload) =>
    apiClient.put<ReviewListItem>(`/api/v1/case-reviews/${reviewId}`, payload),

  delete: (reviewId: number) =>
    apiClient.delete(`/api/v1/case-reviews/${reviewId}`),

  submitItem: (reviewId: number, itemId: number, payload: SubmitItemPayload) =>
    apiClient.patch(`/api/v1/case-reviews/${reviewId}/items/${itemId}`, payload),

  complete: (reviewId: number) =>
    apiClient.post(`/api/v1/case-reviews/${reviewId}/complete`),
}
