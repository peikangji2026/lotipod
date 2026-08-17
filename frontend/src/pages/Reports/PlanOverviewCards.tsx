import { Row, Col, Card, Statistic, Typography, Progress } from 'antd'
import type { PlanReportOverview } from '@/services/report'

const { Text } = Typography

interface Props {
  overview: PlanReportOverview
}

export default function PlanOverviewCards({ overview }: Props) {
  const passColor = overview.pass_rate >= 80 ? '#52c41a' : overview.pass_rate >= 60 ? '#faad14' : '#ff4d4f'

  return (
    <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
      <Row gutter={24} align="middle">
        {/* 仪表盘通过率 */}
        <Col>
          <Progress
            type="dashboard"
            percent={overview.pass_rate}
            size={90}
            strokeColor={passColor}
            format={(p) => (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: passColor }}>{p}%</div>
                <div style={{ fontSize: 10, color: '#8c8c8c' }}>通过率</div>
              </div>
            )}
          />
        </Col>

        {/* 各项数据 */}
        <Col flex={1}>
          <Row gutter={16}>
            <Col span={4}>
              <Statistic title="总用例" value={overview.total} valueStyle={{ fontSize: 20 }} />
            </Col>
            <Col span={4}>
              <Statistic title="已执行" value={overview.executed} valueStyle={{ fontSize: 20 }} />
            </Col>
            <Col span={4}>
              <Statistic title="通过" value={overview.passed} valueStyle={{ fontSize: 20, color: '#52c41a' }} />
            </Col>
            <Col span={4}>
              <Statistic title="失败" value={overview.failed}
                valueStyle={{ fontSize: 20, color: overview.failed > 0 ? '#ff4d4f' : undefined }} />
            </Col>
            <Col span={4}>
              <Statistic title="阻塞" value={overview.blocked}
                valueStyle={{ fontSize: 20, color: overview.blocked > 0 ? '#fa8c16' : undefined }} />
            </Col>
            <Col span={4}>
              <Statistic title="待执行" value={overview.pending} valueStyle={{ fontSize: 20 }} />
            </Col>
          </Row>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              执行率：<Text strong>{overview.execute_rate}%</Text>
              &emsp;跳过：{overview.skipped}
            </Text>
          </div>
        </Col>
      </Row>
    </Card>
  )
}
