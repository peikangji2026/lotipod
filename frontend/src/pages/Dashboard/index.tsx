import { useEffect, useState } from 'react'
import { Spin, Empty, Typography, Space, App, Row, Col } from 'antd'
import { dashboardApi, type DashboardData } from '@/services/dashboard'
import { useProjectStore } from '@/stores/projectStore'
import StatsCards from './StatsCards'
import PassRateTrend from './PassRateTrend'
import PriorityPieChart from './PriorityPieChart'
import RecentPlansTable from './RecentPlansTable'
import ActivityHeatmap from './ActivityHeatmap'

const { Title, Text } = Typography

export default function Dashboard() {
  const { message } = App.useApp()
  const { selectedProjectId } = useProjectStore()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedProjectId) loadDashboard()
    else setData(null)
  }, [selectedProjectId])

  const loadDashboard = async () => {
    if (!selectedProjectId) return
    setLoading(true)
    try {
      const result = await dashboardApi.get(selectedProjectId)
      setData(result)
    } catch {
      message.error('获取 Dashboard 数据失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Space align="center">
          <Title level={4} style={{ margin: 0 }}>测试概览</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>数据实时统计</Text>
        </Space>
      </div>

      {!selectedProjectId ? (
        <Empty description="请在顶部选择项目" style={{ paddingTop: 80 }} />
      ) : loading ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <Spin size="large" tip="加载数据中..." />
        </div>
      ) : data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 第一行：统计卡片 */}
          <StatsCards stats={data.stats} />

          {/* 第二行：折线图 + 饼图 */}
          <Row gutter={16}>
            <Col span={14}>
              <PassRateTrend data={data.api_pass_trend} />
            </Col>
            <Col span={10}>
              <PriorityPieChart data={data.priority_distribution} />
            </Col>
          </Row>

          {/* 第三行：近期测试计划 */}
          <RecentPlansTable plans={data.recent_plans} />

          {/* 第四行：活跃度热力图 */}
          <ActivityHeatmap data={data.activity_heatmap} />
        </div>
      ) : null}
    </div>
  )
}
