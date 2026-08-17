import { Card, Empty } from 'antd'
import { Pie } from '@ant-design/plots'

interface Props {
  api: number
  functional: number
}

export default function TypePieChart({ api, functional }: Props) {
  const total = api + functional
  if (total === 0) {
    return (
      <Card title="用例类型分布" style={{ borderRadius: 8 }}>
        <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    )
  }

  const data = [
    { type: `API 用例 (${api})`, value: api },
    { type: `功能用例 (${functional})`, value: functional },
  ].filter((d) => d.value > 0)

  const config = {
    data,
    angleField: 'value',
    colorField: 'type',
    color: ['#1677ff', '#52c41a'],
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
    <Card title="用例类型分布" style={{ borderRadius: 8 }}>
      <Pie {...config} />
    </Card>
  )
}
