import { Card, Tooltip, Typography } from 'antd'
import type { HeatmapPoint } from '@/services/dashboard'

const { Text } = Typography

const WEEKS_COUNT = 13   // 13 周 ≈ 91 天
const DAYS_OF_WEEK = ['日', '一', '二', '三', '四', '五', '六']

function getColorByCount(count: number): string {
  if (count === 0)  return '#ebedf0'
  if (count <= 2)   return '#9be9a8'
  if (count <= 5)   return '#40c463'
  if (count <= 10)  return '#30a14e'
  return '#216e39'
}

interface Props {
  data: HeatmapPoint[]
}

export default function ActivityHeatmap({ data }: Props) {
  // 建立日期 → 数量的映射
  const countMap = new Map<string, number>()
  for (const p of data) {
    countMap.set(p.date, p.count)
  }

  // 计算起始日期：往前推 WEEKS_COUNT*7 天，从上周日开始
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 计算最近 WEEKS_COUNT 完整周的起点（上一个周日）
  const dayOfWeek = today.getDay()  // 0=日 6=六
  const endSunday = new Date(today)
  endSunday.setDate(today.getDate() - dayOfWeek)    // 本周日
  const startSunday = new Date(endSunday)
  startSunday.setDate(endSunday.getDate() - (WEEKS_COUNT - 1) * 7)

  // 构建完整网格：13列（周）× 7行（天）
  const grid: { date: string; count: number; isToday: boolean; isFuture: boolean }[][] = []
  for (let col = 0; col < WEEKS_COUNT; col++) {
    const week: { date: string; count: number; isToday: boolean; isFuture: boolean }[] = []
    for (let row = 0; row < 7; row++) {
      const d = new Date(startSunday)
      d.setDate(startSunday.getDate() + col * 7 + row)
      const dateStr = d.toISOString().split('T')[0]
      const isToday = d.getTime() === today.getTime()
      const isFuture = d > today
      week.push({
        date: dateStr,
        count: countMap.get(dateStr) || 0,
        isToday,
        isFuture,
      })
    }
    grid.push(week)
  }

  // 月份标签：每列第一天若月份改变则标注
  const monthLabels: (string | null)[] = grid.map((week, i) => {
    const firstDay = new Date(week[0].date)
    const prevWeek = grid[i - 1]
    if (i === 0) return `${firstDay.getMonth() + 1}月`
    const prevFirstDay = new Date(prevWeek[0].date)
    if (firstDay.getMonth() !== prevFirstDay.getMonth()) {
      return `${firstDay.getMonth() + 1}月`
    }
    return null
  })

  const totalCount = data.reduce((sum, p) => sum + p.count, 0)
  const activeDays = data.filter((p) => p.count > 0).length

  return (
    <Card title="最近3个月活跃度" style={{ borderRadius: 8 }}>
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          过去90天共 <Text strong>{activeDays}</Text> 天有操作，合计 <Text strong>{totalCount}</Text> 次
        </Text>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          {/* 左侧星期标签 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 20, marginRight: 4 }}>
            {DAYS_OF_WEEK.map((d, i) => (
              <div key={i} style={{ height: 12, lineHeight: '12px', fontSize: 10, color: '#8c8c8c', textAlign: 'right' }}>
                {[1, 3, 5].includes(i) ? d : ''}
              </div>
            ))}
          </div>

          {/* 热力图格子 */}
          <div>
            {/* 月份标签行 */}
            <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
              {monthLabels.map((label, i) => (
                <div key={i} style={{ width: 12, fontSize: 10, color: '#8c8c8c', whiteSpace: 'nowrap' }}>
                  {label || ''}
                </div>
              ))}
            </div>

            {/* 网格 */}
            <div style={{ display: 'flex', gap: 2 }}>
              {grid.map((week, ci) => (
                <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {week.map((cell, ri) => (
                    <Tooltip
                      key={ri}
                      title={
                        cell.isFuture
                          ? cell.date
                          : `${cell.date}：${cell.count} 次操作`
                      }
                    >
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 2,
                          background: cell.isFuture ? 'transparent' : getColorByCount(cell.count),
                          border: cell.isToday ? '2px solid #1677ff' : 'none',
                          boxSizing: 'border-box',
                          cursor: 'default',
                        }}
                      />
                    </Tooltip>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 图例 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, justifyContent: 'flex-end' }}>
          <Text style={{ fontSize: 11, color: '#8c8c8c' }}>少</Text>
          {['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'].map((color) => (
            <div key={color} style={{ width: 12, height: 12, borderRadius: 2, background: color }} />
          ))}
          <Text style={{ fontSize: 11, color: '#8c8c8c' }}>多</Text>
        </div>
      </div>
    </Card>
  )
}
