import { Card, Col, Row, Statistic, Typography } from 'antd'
import {
  FileTextOutlined, CheckSquareOutlined, PlayCircleOutlined,
  TrophyOutlined, CalendarOutlined,
} from '@ant-design/icons'
import type { DashboardStats } from '@/services/dashboard'

const { Text } = Typography

interface Props {
  stats: DashboardStats
}

const cards = [
  {
    key: 'api_case_count' as const,
    title: 'API 用例',
    icon: <FileTextOutlined style={{ fontSize: 22, color: '#1677ff' }} />,
    color: '#e6f4ff',
    suffix: '条',
  },
  {
    key: 'func_case_count' as const,
    title: '功能用例',
    icon: <CheckSquareOutlined style={{ fontSize: 22, color: '#52c41a' }} />,
    color: '#f6ffed',
    suffix: '条',
  },
  {
    key: 'weekly_run_count' as const,
    title: '本周执行',
    icon: <PlayCircleOutlined style={{ fontSize: 22, color: '#722ed1' }} />,
    color: '#f9f0ff',
    suffix: '次',
  },
  {
    key: 'overall_pass_rate' as const,
    title: '综合通过率',
    icon: <TrophyOutlined style={{ fontSize: 22, color: '#fa8c16' }} />,
    color: '#fff7e6',
    suffix: '%',
    precision: 1,
  },
  {
    key: 'active_plan_count' as const,
    title: '活跃计划',
    icon: <CalendarOutlined style={{ fontSize: 22, color: '#13c2c2' }} />,
    color: '#e6fffb',
    suffix: '个',
  },
]

export default function StatsCards({ stats }: Props) {
  return (
    <Row gutter={16}>
      {cards.map((card) => (
        <Col span={4} style={{ minWidth: 150 }} key={card.key}>
          <Card
            style={{ borderRadius: 8 }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: card.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {card.icon}
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{card.title}</Text>
                <Statistic
                  value={stats[card.key]}
                  precision={card.precision}
                  suffix={<Text style={{ fontSize: 13 }}>{card.suffix}</Text>}
                  valueStyle={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}
                />
              </div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  )
}
