import { Card, Table, Tag, Progress, Space, Typography, Empty, Badge, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { RecentPlan } from '@/services/dashboard'

const { Text } = Typography

const PLAN_STATUS: Record<string, { color: string; label: string }> = {
  draft:     { color: 'default',    label: '草稿' },
  active:    { color: 'processing', label: '进行中' },
  completed: { color: 'success',    label: '已完成' },
  archived:  { color: 'warning',    label: '已归档' },
}

interface Props {
  plans: RecentPlan[]
}

export default function RecentPlansTable({ plans }: Props) {
  const navigate = useNavigate()

  const columns = [
    {
      title: '计划名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: RecentPlan) => (
        <Button
          type="link"
          style={{ padding: 0, fontSize: 13 }}
          onClick={() => navigate(`/test-plans/${record.id}`)}
        >
          {name}
        </Button>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string) => {
        const conf = PLAN_STATUS[s] || { color: 'default', label: s }
        return <Badge status={conf.color as any} text={conf.label} />
      },
    },
    {
      title: '执行进度',
      key: 'progress',
      width: 200,
      render: (_: any, record: RecentPlan) => {
        if (record.total === 0) return <Text type="secondary" style={{ fontSize: 12 }}>暂无用例</Text>
        return (
          <Space size={8}>
            <Progress
              percent={record.progress}
              size="small"
              style={{ width: 120 }}
              format={(p) => `${p?.toFixed(0)}%`}
              status={record.progress === 100 ? 'success' : 'active'}
            />
            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
              {record.passed}/{record.total}
            </Text>
          </Space>
        )
      },
    },
    {
      title: '时间范围',
      key: 'date',
      width: 170,
      render: (_: any, record: RecentPlan) => {
        if (!record.start_date) return <Text type="secondary">-</Text>
        return (
          <Text style={{ fontSize: 12 }}>
            {record.start_date} ~ {record.end_date || '...'}
          </Text>
        )
      },
    },
  ]

  return (
    <Card
      title="近期测试计划"
      extra={
        <Button type="link" size="small" onClick={() => navigate('/test-plans')}>
          查看全部
        </Button>
      }
      style={{ borderRadius: 8 }}
    >
      {plans.length === 0 ? (
        <Empty description="暂无活跃测试计划" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Table
          dataSource={plans}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
        />
      )}
    </Card>
  )
}
