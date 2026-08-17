import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Spin, Button, Space, Typography, Badge, Card, Divider, App, Row, Col,
} from 'antd'
import { ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons'
import { reportApi, type PlanReportSummary } from '@/services/report'
import PlanOverviewCards from './PlanOverviewCards'
import TypePieChart from './TypePieChart'
import ResultPieChart from './ResultPieChart'
import PlanItemsTable from './PlanItemsTable'

const { Title, Text } = Typography

const PLAN_STATUS: Record<string, { badge: any; label: string }> = {
  draft:     { badge: 'default',    label: '草稿' },
  active:    { badge: 'processing', label: '进行中' },
  completed: { badge: 'success',    label: '已完成' },
  archived:  { badge: 'warning',    label: '已归档' },
}

export default function PlanReportDetail() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [summary, setSummary] = useState<PlanReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!planId) return
    setLoading(true)
    reportApi.planSummary(Number(planId))
      .then(setSummary)
      .catch(() => message.error('加载报告失败'))
      .finally(() => setLoading(false))
  }, [planId])

  const handleExportPDF = async () => {
    if (!summary) return
    setExporting(true)
    try {
      await reportApi.exportPlanPDF(Number(planId), summary.plan.name)
      message.success('PDF 已下载')
    } catch {
      message.error('导出 PDF 失败')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" tip="加载报告..." /></div>
  }
  if (!summary) return null

  const statusConf = PLAN_STATUS[summary.plan.status] || { badge: 'default', label: summary.plan.status }

  return (
    <div>
      {/* 顶部导航栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')} type="text" />
          <Title level={4} style={{ margin: 0 }}>{summary.plan.name}</Title>
          <Badge status={statusConf.badge} text={statusConf.label} />
        </Space>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleExportPDF}
          loading={exporting}
        >
          导出 PDF
        </Button>
      </div>

      {/* 计划基本信息 */}
      <Card size="small" style={{ borderRadius: 8, background: '#fafafa', marginBottom: 16 }}>
        <Space split={<Divider type="vertical" />} wrap>
          <Text type="secondary" style={{ fontSize: 12 }}>
            计划状态：<Text strong>{statusConf.label}</Text>
          </Text>
          {summary.plan.start_date && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              时间范围：{summary.plan.start_date} ~ {summary.plan.end_date || '进行中'}
            </Text>
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>
            用例类型：API {summary.type_distribution.api} 条 · 功能 {summary.type_distribution.functional} 条
          </Text>
        </Space>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 执行概况 */}
        <PlanOverviewCards overview={summary.overview} />

        {/* 饼图双列 */}
        <Row gutter={16}>
          <Col span={12}>
            <TypePieChart
              api={summary.type_distribution.api}
              functional={summary.type_distribution.functional}
            />
          </Col>
          <Col span={12}>
            <ResultPieChart overview={summary.overview} />
          </Col>
        </Row>

        {/* 执行明细 */}
        <Card title="用例执行明细" style={{ borderRadius: 8 }}>
          <PlanItemsTable items={summary.items} />
        </Card>
      </div>
    </div>
  )
}
