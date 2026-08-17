import { useEffect, useState } from 'react'
import {
  Button, Table, Tag, Space, Typography, Progress, Tooltip,
  Popconfirm, App, Avatar, Badge, Empty,
} from 'antd'
import {
  PlusOutlined, UserOutlined, DeleteOutlined, EyeOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import { useNavigate } from 'react-router-dom'
import { caseReviewApi, type ReviewListItem } from '@/services/caseReview'
import { useProjectStore } from '@/stores/projectStore'
import CreateReviewModal from './CreateReviewModal'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const { Title, Text } = Typography

const STATUS_CONFIG: Record<string, { color: string; badge: any; label: string }> = {
  active:    { color: 'blue',    badge: 'processing', label: '进行中' },
  completed: { color: 'green',   badge: 'success',    label: '已完成' },
  expired:   { color: 'default', badge: 'default',    label: '已过期' },
}

export default function CaseReviews() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { selectedProjectId } = useProjectStore()
  const [reviews, setReviews] = useState<ReviewListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (selectedProjectId) loadReviews()
    else setReviews([])
  }, [selectedProjectId])

  const loadReviews = async () => {
    if (!selectedProjectId) return
    setLoading(true)
    try {
      const list = await caseReviewApi.list(selectedProjectId)
      setReviews(list)
    } catch {
      message.error('加载评审列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await caseReviewApi.delete(id)
      message.success('已删除')
      loadReviews()
    } catch {
      message.error('删除失败')
    }
  }

  const columns = [
    {
      title: '评审名称',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, r: ReviewListItem) => (
        <Button type="link" style={{ padding: 0, fontWeight: 500 }}
          onClick={() => navigate(`/case-reviews/${r.id}`)}>
          {title}
        </Button>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string) => {
        const conf = STATUS_CONFIG[s] || { badge: 'default', label: s }
        return <Badge status={conf.badge as any} text={conf.label} />
      },
    },
    {
      title: '通过率',
      key: 'pass_rate',
      width: 160,
      render: (_: any, r: ReviewListItem) => (
        r.total_items === 0
          ? <Text type="secondary">-</Text>
          : <Space size={8}>
              <Progress
                percent={r.pass_rate}
                size="small"
                style={{ width: 100 }}
                strokeColor="#52c41a"
                format={(p) => `${p?.toFixed(0)}%`}
              />
              <Text style={{ fontSize: 11, color: '#8c8c8c' }}>
                {r.approved_count}/{r.total_items}
              </Text>
            </Space>
      ),
    },
    {
      title: '已评/总人数',
      key: 'members',
      width: 100,
      render: (_: any, r: ReviewListItem) => (
        <Space size={4}>
          <Avatar.Group max={{ count: 3 }} size="small">
            {r.members.map((m) => (
              <Tooltip key={m.user_id} title={`${m.username}（${m.status === 'completed' ? '已完成' : '待评'}）`}>
                <Avatar
                  size="small"
                  icon={<UserOutlined />}
                  style={{ background: m.status === 'completed' ? '#52c41a' : '#d9d9d9' }}
                />
              </Tooltip>
            ))}
          </Avatar.Group>
          <Text style={{ fontSize: 12 }}>{r.completed_members}/{r.total_members}</Text>
        </Space>
      ),
    },
    {
      title: '截止日期',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 110,
      render: (d: string | null, r: ReviewListItem) => {
        if (!d) return <Text type="secondary">-</Text>
        const isExpired = r.status === 'expired' || dayjs(d).isBefore(dayjs(), 'day')
        return (
          <Space size={4}>
            <ClockCircleOutlined style={{ color: isExpired ? '#ff4d4f' : '#8c8c8c', fontSize: 12 }} />
            <Text style={{ color: isExpired ? '#ff4d4f' : undefined, fontSize: 12 }}>{d}</Text>
          </Space>
        )
      },
    },
    {
      title: '发起人',
      dataIndex: 'creator_name',
      key: 'creator',
      width: 100,
      render: (name: string | null) => (
        <Space size={4}>
          <Avatar size="small" icon={<UserOutlined />} style={{ background: '#1677ff' }} />
          <Text style={{ fontSize: 12 }}>{name || '-'}</Text>
        </Space>
      ),
    },
    {
      title: '发起时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 100,
      render: (t: string) => (
        <Tooltip title={dayjs(t).format('YYYY-MM-DD HH:mm')}>
          <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(t).fromNow()}</Text>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: any, r: ReviewListItem) => (
        <Space size={4}>
          <Tooltip title="查看详情">
            <Button size="small" icon={<EyeOutlined />} type="text"
              onClick={() => navigate(`/case-reviews/${r.id}`)} />
          </Tooltip>
          <Popconfirm
            title="确定删除此评审？"
            onConfirm={() => handleDelete(r.id)}
            okText="删除" cancelText="取消" okType="danger"
          >
            <Tooltip title="删除">
              <Button size="small" icon={<DeleteOutlined />} type="text" danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>用例评审</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!selectedProjectId}
          onClick={() => setCreateOpen(true)}
        >
          创建评审
        </Button>
      </div>

      {!selectedProjectId ? (
        <Empty description="请在顶部选择项目" style={{ paddingTop: 60 }} />
      ) : (
        <Table
          dataSource={reviews}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条评审` }}
          locale={{ emptyText: <Empty description="暂无评审，点击「创建评审」发起第一个" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      )}

      {selectedProjectId && (
        <CreateReviewModal
          open={createOpen}
          projectId={selectedProjectId}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => { setCreateOpen(false); loadReviews() }}
        />
      )}
    </div>
  )
}
