import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Spin, Typography, Tag, Badge, Space, Button, Table, Select,
  Progress, Avatar, Tooltip, Input, App, Popconfirm, Divider,
  Row, Col, Statistic, Card,
} from 'antd'
import {
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EditOutlined, UserOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { caseReviewApi, type ReviewDetail, type ReviewCaseView } from '@/services/caseReview'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

const STATUS_CONFIG: Record<string, { badge: any; label: string; color: string }> = {
  active:    { badge: 'processing', label: '进行中', color: '#1677ff' },
  completed: { badge: 'success',    label: '已完成', color: '#52c41a' },
  expired:   { badge: 'default',    label: '已过期', color: '#8c8c8c' },
}

const RESULT_CONFIG: Record<string, { color: string; label: string }> = {
  pending:      { color: 'default', label: '待评审' },
  approved:     { color: 'success', label: '通过' },
  rejected:     { color: 'error',   label: '不通过' },
  needs_change: { color: 'warning', label: '待修改' },
}

export default function ReviewDetailPage() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { user } = useAuthStore()

  const [detail, setDetail] = useState<ReviewDetail | null>(null)
  const [loading, setLoading] = useState(true)
  // 每条用例的「我的结果」暂存
  const [pendingResults, setPendingResults] = useState<Record<number, { result: string; comment: string }>>({})
  const [submitting, setSubmitting] = useState<number | null>(null)

  useEffect(() => { loadDetail() }, [reviewId])

  const loadDetail = async () => {
    if (!reviewId) return
    setLoading(true)
    try {
      const data = await caseReviewApi.get(Number(reviewId))
      setDetail(data)
    } catch {
      message.error('加载评审详情失败')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async () => {
    if (!reviewId) return
    try {
      await caseReviewApi.complete(Number(reviewId))
      message.success('评审已标记为完成')
      loadDetail()
    } catch {
      message.error('操作失败')
    }
  }

  const handleSubmitItem = async (caseItem: ReviewCaseView) => {
    if (!caseItem.my_item) return
    const pending = pendingResults[caseItem.my_item.id]
    if (!pending?.result || pending.result === 'pending') {
      message.warning('请先选择评审意见')
      return
    }
    setSubmitting(caseItem.my_item.id)
    try {
      await caseReviewApi.submitItem(Number(reviewId), caseItem.my_item.id, {
        result: pending.result as any,
        comment: pending.comment || '',
      })
      message.success('意见已提交')
      loadDetail()
    } catch {
      message.error('提交失败')
    } finally {
      setSubmitting(null)
    }
  }

  const setPending = (itemId: number, field: 'result' | 'comment', value: string) => {
    setPendingResults((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }))
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!detail) return null

  const statusConf = STATUS_CONFIG[detail.status] || { badge: 'default', label: detail.status, color: '#8c8c8c' }
  const isCreator = user?.id === detail.created_by
  const isReviewer = detail.members.some((m) => m.user_id === user?.id)

  const columns = [
    {
      title: '类型',
      dataIndex: 'case_type',
      key: 'case_type',
      width: 70,
      render: (t: string) => (
        <Tag color={t === 'api' ? 'blue' : 'green'} style={{ fontSize: 11 }}>
          {t === 'api' ? 'API' : '功能'}
        </Tag>
      ),
    },
    {
      title: '用例名称',
      dataIndex: 'case_name',
      key: 'case_name',
      render: (name: string) => <Text style={{ fontSize: 13 }}>{name}</Text>,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 70,
      render: (p: string) => (
        <Tag color={p === 'P0' ? 'red' : p === 'P1' ? 'orange' : 'blue'}>{p || '-'}</Tag>
      ),
    },
    ...(isReviewer ? [
      {
        title: '我的评审',
        key: 'my_review',
        width: 280,
        render: (_: any, r: ReviewCaseView) => {
          if (!r.my_item) return <Text type="secondary">-</Text>
          const pending = pendingResults[r.my_item.id] || {}
          const currentResult = pending.result !== undefined ? pending.result : r.my_item.result
          const currentComment = pending.comment !== undefined ? pending.comment : (r.my_item.comment || '')

          return (
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space>
                <Select
                  value={currentResult}
                  size="small"
                  style={{ width: 100 }}
                  onChange={(v) => setPending(r.my_item!.id, 'result', v)}
                >
                  <Option value="pending">待评审</Option>
                  <Option value="approved">通过</Option>
                  <Option value="rejected">不通过</Option>
                  <Option value="needs_change">待修改</Option>
                </Select>
                <Button
                  size="small"
                  type="primary"
                  loading={submitting === r.my_item.id}
                  disabled={currentResult === 'pending'}
                  onClick={() => handleSubmitItem(r)}
                >
                  提交
                </Button>
              </Space>
              <TextArea
                value={currentComment}
                onChange={(e) => setPending(r.my_item!.id, 'comment', e.target.value)}
                placeholder="意见（可选）"
                autoSize={{ minRows: 1, maxRows: 3 }}
                size="small"
                style={{ fontSize: 12 }}
              />
            </Space>
          )
        },
      },
    ] : []),
    {
      title: '其他人意见',
      key: 'others',
      render: (_: any, r: ReviewCaseView) => {
        if (r.others_opinions.length === 0) return <Text type="secondary" style={{ fontSize: 12 }}>暂无</Text>
        return (
          <Space direction="vertical" size={2}>
            {r.others_opinions.map((op, i) => {
              const conf = RESULT_CONFIG[op.result] || { color: 'default', label: op.result }
              return (
                <Space key={i} size={4}>
                  <Avatar size="small" icon={<UserOutlined />} style={{ background: '#1677ff' }} />
                  <Text style={{ fontSize: 12 }}>{op.reviewer_name}：</Text>
                  <Tag color={conf.color} style={{ fontSize: 10, padding: '0 4px' }}>{conf.label}</Tag>
                  {op.comment && (
                    <Tooltip title={op.comment}>
                      <Text type="secondary" style={{ fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {op.comment}
                      </Text>
                    </Tooltip>
                  )}
                </Space>
              )
            })}
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      {/* 顶部导航 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/case-reviews')} type="text" />
        <Title level={4} style={{ margin: 0 }}>{detail.title}</Title>
        <Badge status={statusConf.badge} text={statusConf.label} />
        {isCreator && detail.status === 'active' && (
          <Popconfirm
            title="确认将评审标记为已完成？"
            onConfirm={handleComplete}
            okText="确认" cancelText="取消"
          >
            <Button size="small" icon={<CheckCircleOutlined />} type="default">
              完成评审
            </Button>
          </Popconfirm>
        )}
      </div>

      {/* 基本信息 */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row gutter={24}>
          <Col>
            <Space split={<Divider type="vertical" />}>
              <Space size={4}>
                <UserOutlined style={{ color: '#8c8c8c' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>发起人：</Text>
                <Text style={{ fontSize: 12 }}>{detail.creator_name || '-'}</Text>
              </Space>
              {detail.deadline && (
                <Space size={4}>
                  <ClockCircleOutlined style={{ color: detail.status === 'expired' ? '#ff4d4f' : '#8c8c8c' }} />
                  <Text style={{ fontSize: 12, color: detail.status === 'expired' ? '#ff4d4f' : undefined }}>
                    截止：{detail.deadline}
                  </Text>
                </Space>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                发起：{dayjs(detail.created_at).format('YYYY-MM-DD HH:mm')}
              </Text>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic title="用例总数" value={detail.total_cases} valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic title="通过" value={detail.approved_count} valueStyle={{ fontSize: 20, color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="通过率"
              value={detail.pass_rate}
              suffix="%"
              valueStyle={{ fontSize: 20, color: detail.pass_rate >= 80 ? '#52c41a' : '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>已评人数</Text>
              <Text style={{ fontSize: 20, fontWeight: 700 }}>
                {detail.completed_members}/{detail.total_members}
              </Text>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>评审人</Text>
            <Space wrap size={4}>
              {detail.members.map((m) => (
                <Tooltip key={m.user_id} title={`${m.username}（${m.status === 'completed' ? '已完成' : '待评'}）`}>
                  <Tag
                    color={m.status === 'completed' ? 'success' : 'default'}
                    icon={<UserOutlined />}
                    style={{ fontSize: 11 }}
                  >
                    {m.username}
                  </Tag>
                </Tooltip>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 整体进度条 */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Text style={{ fontSize: 12 }}>评审进度：</Text>
          <Progress
            percent={detail.pass_rate}
            style={{ width: 300 }}
            strokeColor="#52c41a"
            format={(p) => `${p?.toFixed(0)}% 通过`}
          />
        </Space>
      </div>

      {/* 用例评审明细表 */}
      <Table
        dataSource={detail.cases}
        columns={columns}
        rowKey={(r) => `${r.case_type}_${r.case_id}`}
        size="small"
        pagination={{ pageSize: 20 }}
      />
    </div>
  )
}
