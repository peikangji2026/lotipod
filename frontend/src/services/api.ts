import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
    })

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('access_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    this.client.interceptors.response.use(
      (res) => res.data,
      async (error) => {
        const originalRequest = error.config

        // Access Token 过期，尝试用 Refresh Token 自动续期
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true
          const refreshToken = localStorage.getItem('refresh_token')

          if (refreshToken) {
            try {
              const res: any = await axios.post(
                `${API_BASE_URL}/api/v1/auth/refresh`,
                { refresh_token: refreshToken }
              )
              localStorage.setItem('access_token', res.data.access_token)
              localStorage.setItem('refresh_token', res.data.refresh_token)
              originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`
              return this.client(originalRequest)
            } catch {
              // Refresh Token 也失效，跳转登录
              localStorage.removeItem('access_token')
              localStorage.removeItem('refresh_token')
              window.location.href = '/login'
            }
          } else {
            window.location.href = '/login'
          }
        }

        return Promise.reject(error)
      }
    )
  }

  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.client.get(url, config) as Promise<T>
  }

  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.client.post(url, data, config) as Promise<T>
  }

  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.client.put(url, data, config) as Promise<T>
  }

  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.client.delete(url, config) as Promise<T>
  }

  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.client.patch(url, data, config) as Promise<T>
  }
}

export const apiClient = new ApiClient()
