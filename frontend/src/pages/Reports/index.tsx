import { useEffect, useState } from 'react'
import {
  Button, Table, Typography, Progress, Space,
  Empty, App, Badge, Tooltip, Tag,
} from 'antd'
import {
  DownloadOutlined, EyeOutlined, CalendarOutlined, FileTextOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { reportApi } from '@/services/report'
import { useProjectStore } from '@/stores/projectStore'

const { Title, Text } = Typography

const PLAN_STATUS: Record<string, { badge: any; label: string }> = {
  draft:     { badge: 'default',    label: '草稿' },
  active:    { badge: 'processing', label: '进行中' },
  completed: { badge: 'success',    label: '已完成' },
  archived:  { badge: 'warning',    label: '已归档' },
}

export default function Reports() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { selectedProjectId } = useProjectStore()

  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [exportingId, setExportingId] = useState<number | null>(null)

  useEffect(() => {
    if (selectedProjectId) loadReports()
    else setReports([])
  }, [selectedProjectId])

  const loadReports = async () => {
    if (!selectedProjectId) return
    setLoading(true)
    try {
      const list = await reportApi.generatedReports(selectedProjectId)
      setReports(list)
    } catch {
      message.error('加载报告列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = async (r: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setExportingId(r.id)
    try {
      await reportApi.exportPlanPDF(r.id, r.name)
      message.success('PDF 已下载')
    } catch {
      message.error('导出 PDF 失败')
    } finally {
      setExportingId(null)
    }
  }

  const columns = [
    {
      title: '测试计划',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, r: any) => (
        <Space direction="vertical" size={2}>
          <Button
            type="link"
            style={{ padding: 0, fontWeight: 600, fontSize: 14 }}
            onClick={() => navigate(`/reports/${r.id}`)}
          >
            {name}
          </Button>
          {r.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>{r.description}</Text>
          )}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string) => {
        const conf = PLAN_STATUS[s] || { badge: 'default', label: s }
        return <Badge status={conf.badge} text={conf.label} />
      },
    },
    {
      title: '用例数',
      dataIndex: 'total',
      key: 'total',
      width: 80,
      render: (v: number) => (
        <Space size={4}>
          <FileTextOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
          <Text>{v}</Text>
        </Space>
      ),
    },
    {
      title: '通过率',
      key: 'pass_rate',
      width: 200,
      render: (_: any, r: any) => {
        if (r.total === 0) return <Text type="secondary" style={{ fontSize: 12 }}>暂无数据</Text>
        const color = r.pass_rate >= 80 ? '#52c41a' : r.pass_rate >= 60 ? '#faad14' : '#ff4d4f'
        return (
          <Space direction="vertical" size={2}>
            <Progress
              percent={r.pass_rate}
              size="small"
              strokeColor={color}
              format={(p) => `${p}%`}
              style={{ width: 150 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              通过 {r.passed} · 失败 {r.failed}
              {r.blocked > 0 && ` · 阻塞 ${r.blocked}`}
              {r.pending > 0 && ` · 待执行 ${r.pending}`}
            </Text>
          </Space>
        )
      },
    },
    {
      title: '时间范围',
      key: 'date',
      width: 160,
      render: (_: any, r: any) => {
        if (!r.start_date) return <Text type="secondary">-</Text>
        return (
          <Space size={4}>
            <CalendarOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>{r.start_date} ~ {r.end_date || '进行中'}</Text>
          </Space>
        )
      },
    },
    {
      title: '报告生成时间',
      dataIndex: 'report_generated_at',
      key: 'report_generated_at',
      width: 140,
      render: (t: string) => (
        <Tooltip title={dayjs(t).format('YYYY-MM-DD HH:mm:ss')}>
          <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(t).format('YYYY-MM-DD HH:mm')}</Text>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 90,
      render: (_: any, r: any) => (
        <Space size={4}>
          <Tooltip title="查看报告">
            <Button size="small" icon={<EyeOutlined />} type="text" onClick={() => navigate(`/reports/${r.id}`)} />
          </Tooltip>
          <Tooltip title="导出 PDF">
            <Button
              size="small" icon={<DownloadOutlined />} type="text"
              loading={exportingId === r.id}
              onClick={(e) => handleExportPDF(r, e)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space align="center">
          <Title level={4} style={{ margin: 0 }}>测试报告</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>在「测试计划」页点击生成报告后显示</Text>
        </Space>
      </div>

      {!selectedProjectId ? (
        <Empty description="请在顶部选择项目" style={{ paddingTop: 60 }} />
      ) : (
        <Table
          dataSource={reports}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          onRow={(r) => ({ onClick: () => navigate(`/reports/${r.id}`), style: { cursor: 'pointer' } })}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 份报告` }}
          locale={{
            emptyText: (
              <Empty
                description="暂无报告，请前往「测试计划」页点击「生成报告」按钮"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      )}
    </div>
  )
}
