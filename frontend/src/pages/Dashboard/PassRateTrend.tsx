import { Card, Empty } from 'antd'
import { Line } from '@ant-design/plots'
import type { TrendPoint } from '@/services/dashboard'

interface Props {
  data: TrendPoint[]
}

export default function PassRateTrend({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card title="API 执行通过率趋势" style={{ borderRadius: 8 }}>
        <Empty description="暂无执行数据" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '30px 0' }} />
      </Card>
    )
  }

  const config = {
    data,
    xField: 'executed_at',
    yField: 'pass_rate',
    smooth: true,
    point: { size: 4, shape: 'circle' },
    tooltip: {
      formatter: (d: TrendPoint) => ({ name: '通过率', value: `${d.pass_rate}%` }),
    },
    yAxis: {
      min: 0,
      max: 100,
      label: { formatter: (v: string) => `${v}%` },
    },
    annotations: [
      {
        type: 'line',
        start: ['min', 80] as [string, number],
        end: ['max', 80] as [string, number],
        style: { stroke: '#faad14', lineDash: [4, 4] },
      },
    ],
    color: '#1677ff',
    height: 220,
  }

  return (
    <Card title="API 执行通过率趋势（最近10次）" style={{ borderRadius: 8 }}>
      <Line {...config} />
    </Card>
  )
}
