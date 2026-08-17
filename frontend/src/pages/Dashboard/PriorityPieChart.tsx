import { Card, Empty } from 'antd'
import { Pie } from '@ant-design/plots'
import type { PriorityDistribution } from '@/services/dashboard'

interface Props {
  data: PriorityDistribution
}

const PRIORITY_COLORS: Record<string, string> = {
  P0: '#ff4d4f',
  P1: '#fa8c16',
  P2: '#1677ff',
  P3: '#8c8c8c',
}

export default function PriorityPieChart({ data }: Props) {
  const chartData = Object.entries(data)
    .map(([priority, value]) => ({ priority, value }))
    .filter((d) => d.value > 0)

  if (chartData.length === 0) {
    return (
      <Card title="用例优先级分布" style={{ borderRadius: 8 }}>
        <Empty description="暂无用例数据" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '30px 0' }} />
      </Card>
    )
  }

  const config = {
    data: chartData,
    angleField: 'value',
    colorField: 'priority',
    color: ({ priority }: { priority: string }) => PRIORITY_COLORS[priority] || '#d9d9d9',
    radius: 0.85,
    innerRadius: 0.5,
    label: {
      type: 'inner',
      offset: '-30%',
      content: ({ percent }: { percent: number }) => `${(percent * 100).toFixed(0)}%`,
      style: { fontSize: 12, textAlign: 'center' },
    },
    legend: {
      position: 'right' as const,
      itemName: {
        formatter: (text: string) => {
          const item = chartData.find((d) => d.priority === text)
          return `${text} (${item?.value ?? 0})`
        },
      },
    },
    tooltip: {
      formatter: (d: { priority: string; value: number }) => ({
        name: d.priority,
        value: `${d.value} 条`,
      }),
    },
    height: 220,
    interactions: [{ type: 'element-active' }],
  }

  return (
    <Card title="用例优先级分布" style={{ borderRadius: 8 }}>
      <Pie {...config} />
    </Card>
  )
}
