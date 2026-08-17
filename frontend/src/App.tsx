import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme, App as AntApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import AppLayout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Projects from '@/pages/Projects'
import ProjectDetail from '@/pages/ProjectDetail'
import TestCases from '@/pages/TestCases'
import FunctionalCases from '@/pages/FunctionalCases'
import TestPlans from '@/pages/TestPlans'
import PlanDetail from '@/pages/TestPlans/PlanDetail'
import Reports from '@/pages/Reports'
import PlanReportDetail from '@/pages/Reports/PlanReportDetail'
import CaseReviews from '@/pages/CaseReviews'
import ReviewDetail from '@/pages/CaseReviews/ReviewDetail'
import { useAuthStore } from '@/stores/authStore'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/projects" replace />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:projectId" element={<ProjectDetail />} />
              <Route path="testcases" element={<TestCases />} />
              <Route path="func-cases" element={<FunctionalCases />} />
              <Route path="test-plans" element={<TestPlans />} />
              <Route path="test-plans/:planId" element={<PlanDetail />} />
              <Route path="reports" element={<Reports />} />
              <Route path="reports/:planId" element={<PlanReportDetail />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="case-reviews" element={<CaseReviews />} />
              <Route path="case-reviews/:reviewId" element={<ReviewDetail />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  )
}
