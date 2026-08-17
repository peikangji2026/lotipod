import { Card, Empty } from 'antd'
import { Pie } from '@ant-design/plots'
import type { PlanReportOverview } from '@/services/report'

interface Props {
  overview: PlanReportOverview
}

const RESULT_COLORS: Record<string, string> = {
  '通过': '#52c41a',
  '失败': '#ff4d4f',
  '阻塞': '#fa8c16',
  '跳过': '#8c8c8c',
  '待执行': '#d9d9d9',
}

export default function ResultPieChart({ overview }: Props) {
  const raw = [
    { label: '通过', value: overview.passed },
    { label: '失败', value: overview.failed },
    { label: '阻塞', value: overview.blocked },
    { label: '跳过', value: overview.skipped },
    { label: '待执行', value: overview.pending },
  ]
  const data = raw
    .filter((d) => d.value > 0)
    .map((d) => ({ type: `${d.label} (${d.value})`, value: d.value, label: d.label }))

  if (data.length === 0) {
    return (
      <Card title="执行结果分布" style={{ borderRadius: 8 }}>
        <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    )
  }

  const config = {
    data,
    angleField: 'value',
    colorField: 'type',
    color: ({ type }: { type: string }) => {
      const label = type.split(' ')[0]
      return RESULT_COLORS[label] || '#d9d9d9'
    },
    radius: 0.85,
    innerRadius: 0.5,
    label: {
      type: 'inner',
      offset: '-30%',
      content: ({ percent }: { percent: number }) => `${(percent * 100).toFixed(0)}%`,
      style: { fontSize: 12, textAlign: 'center' },
    },
    legend: { position: 'bottom' as const },
    tooltip: {
      formatter: (d: { type: string; value: number }) => ({ name: d.type, value: `${d.value} 条` }),
    },
    height: 200,
    interactions: [{ type: 'element-active' }],
  }

  return (
    <Card title="执行结果分布" style={{ borderRadius: 8 }}>
      <Pie {...config} />
    </Card>
  )
}
