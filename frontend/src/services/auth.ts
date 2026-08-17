import { apiClient } from './api'
import type { User } from '@/types'

export interface LoginPayload {
  username: string
  password: string
}

export interface RegisterPayload {
  username: string
  email: string
  password: string
  full_name?: string
}

export interface AuthResult {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export const authApi = {
  login: (data: LoginPayload) =>
    apiClient.post<AuthResult>('/api/v1/auth/login', data),

  register: (data: RegisterPayload) =>
    apiClient.post<AuthResult>('/api/v1/auth/register', data),

  refresh: (refresh_token: string) =>
    apiClient.post<AuthResult>('/api/v1/auth/refresh', { refresh_token }),

  me: () => apiClient.get<User>('/api/v1/auth/me'),
}
