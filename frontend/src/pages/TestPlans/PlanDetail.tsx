import { useEffect, useRef, useState } from 'react'
import {
  Button, Tag, Space, Typography, App, Select, Progress,
  Table, Modal, Form, Input, Popconfirm, Breadcrumb, Spin,
  Row, Col, Statistic, Divider, Badge,
} from 'antd'
import {
  PlusOutlined, PlayCircleOutlined, DeleteOutlined, ArrowLeftOutlined,
  CheckCircleOutlined, CloseCircleOutlined, WarningOutlined, MinusCircleOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { projectApi } from '@/services/project'
import { testPlanApi, type ItemResultPayload } from '@/services/testPlan'
import type { TestPlanDetail, PlanItem, Environment } from '@/types'
import AddCasesModal from './AddCasesModal'

const { Title, Text } = Typography
const { Option } = Select

const RESULT_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  pending: { color: 'default',    label: '待执行',  icon: <MinusCircleOutlined style={{ color: '#d9d9d9' }} /> },
  passed:  { color: 'success',    label: '通过',    icon: <CheckCircleOutlined  style={{ color: '#52c41a' }} /> },
  failed:  { color: 'error',      label: '失败',    icon: <CloseCircleOutlined  style={{ color: '#ff4d4f' }} /> },
  blocked: { color: 'warning',    label: '阻塞',    icon: <WarningOutlined      style={{ color: '#faad14' }} /> },
  skipped: { color: 'default',    label: '跳过',    icon: <MinusCircleOutlined  style={{ color: '#8c8c8c' }} /> },
}

const PLAN_STATUS: Record<string, { color: string; label: string }> = {
  draft:     { color: 'default',    label: '草稿' },
  active:    { color: 'processing', label: '进行中' },
  completed: { color: 'success',    label: '已完成' },
  archived:  { color: 'warning',    label: '已归档' },
}

export default function PlanDetail() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()

  const [plan, setPlan] = useState<TestPlanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [selectedEnvId, setSelectedEnvId] = useState<number | null>(null)
  const [executing, setExecuting] = useState(false)

  const [addCasesOpen, setAddCasesOpen] = useState(false)
  const [markModalOpen, setMarkModalOpen] = useState(false)
  const [markingItem, setMarkingItem] = useState<PlanItem | null>(null)
  const [markForm] = Form.useForm()
  const [markSaving, setMarkSaving] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (planId) loadPlan()
    return () => stopPoll()
  }, [planId])

  const loadPlan = async () => {
    if (!planId) return
    setLoading(true)
    try {
      const detail = await testPlanApi.get(Number(planId))
      setPlan(detail)
      // 加载环境
      const envs = await projectApi.listEnvironments(detail.project_id)
      setEnvironments(envs)
      if (envs.length > 0 && !selectedEnvId) setSelectedEnvId(envs[0].id)
    } catch {
      message.error('获取计划详情失败')
    } finally {
      setLoading(false)
    }
  }

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  // ===== 执行 API 用例 =====
  const handleExecuteApi = async () => {
    if (!plan || !selectedEnvId) { message.warning('请先选择执行环境'); return }
    setExecuting(true)
    try {
      const res = await testPlanApi.executeApiCases(plan.id, selectedEnvId)
      message.success(res.message)
      // 轮询计划进度（直到所有 pending 变为有结果）
      stopPoll()
      pollRef.current = setInterval(async () => {
        const fresh = await testPlanApi.get(plan.id)
        setPlan(fresh)
        if ((fresh.progress?.pending ?? 0) === 0 || (fresh.progress?.total ?? 0) === 0) {
          stopPoll()
          setExecuting(false)
        }
      }, 3000)
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '执行失败')
      setExecuting(false)
    }
  }

  // ===== 添加用例 =====
  const handleAddCases = async (selected: { case_type: 'api' | 'functional'; case_id: number }[]) => {
    if (!plan) return
    try {
      const res = await testPlanApi.addItems(plan.id, selected.map((s, i) => ({ ...s, sort_order: i })))
      message.success(`成功添加 ${res.added} 条用例`)
      setAddCasesOpen(false)
      loadPlan()
    } catch {
      message.error('添加失败')
    }
  }

  // ===== 移除用例 =====
  const handleRemoveItem = async (itemId: number) => {
    if (!plan) return
    await testPlanApi.removeItem(plan.id, itemId)
    message.success('用例已移除')
    loadPlan()
  }

  // ===== 手动标记结果 =====
  const openMarkModal = (item: PlanItem) => {
    setMarkingItem(item)
    markForm.resetFields()
    setMarkModalOpen(true)
  }

  const handleMark = async (values: { result: string; comment?: string }) => {
    if (!plan || !markingItem) return
    setMarkSaving(true)
    try {
      const payload: ItemResultPayload = { result: values.result, comment: values.comment }
      await testPlanApi.updateItemResult(plan.id, markingItem.id, payload)
      message.success('结果已记录')
      setMarkModalOpen(false)
      loadPlan()
    } catch {
      message.error('标记失败')
    } finally {
      setMarkSaving(false)
    }
  }

  // ===== 修改计划状态 =====
  const handleStatusChange = async (newStatus: string) => {
    if (!plan) return
    await testPlanApi.update(plan.id, { status: newStatus })
    loadPlan()
  }

  if (loading) {
    return <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin size="large" /></div>
  }

  if (!plan) return null

  const existingKeys = new Set(plan.items.map((i) => `${i.case_type}_${i.case_id}`))
  const progress = plan.progress
  const passRate = progress?.pass_rate ?? 0

  const columns = [
    {
      title: '类型',
      dataIndex: 'case_type',
      key: 'case_type',
      width: 80,
      render: (t: string) => (
        <Tag color={t === 'api' ? 'blue' : 'green'} style={{ fontSize: 11 }}>
          {t === 'api' ? 'API' : '功能'}
        </Tag>
      ),
    },
    {
      title: '用例名称',
      key: 'name',
      render: (_: any, record: PlanItem) => (
        <div>
          <Text>{record.case_name || `用例 #${record.case_id}`}</Text>
          {record.case_url && (
            <div><Text type="secondary" style={{ fontSize: 11 }}>{record.case_url}</Text></div>
          )}
        </div>
      ),
    },
    {
      title: '执行结果',
      dataIndex: 'result',
      key: 'result',
      width: 110,
      render: (r: string) => {
        const conf = RESULT_CONFIG[r] || { color: 'default', label: r, icon: null }
        return (
          <Space size={4}>
            {conf.icon}
            <Tag color={conf.color}>{conf.label}</Tag>
          </Space>
        )
      },
    },
    {
      title: '备注',
      dataIndex: 'comment',
      key: 'comment',
      render: (c: string) => c ? <Text type="secondary" style={{ fontSize: 12 }}>{c}</Text> : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, record: PlanItem) => (
        <Space size={4}>
          {record.case_type === 'functional' && (
            <Button size="small" onClick={() => openMarkModal(record)}>标记结果</Button>
          )}
          <Popconfirm
            title="从计划中移除该用例？"
            onConfirm={() => handleRemoveItem(record.id)}
            okText="移除" okType="danger" cancelText="取消"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 面包屑 */}
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          { title: <Button type="link" style={{ padding: 0 }} icon={<ArrowLeftOutlined />} onClick={() => navigate('/test-plans')}>测试计划</Button> },
          { title: plan.name },
        ]}
      />

      {/* 计划头部信息 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Space align="center" style={{ marginBottom: 4 }}>
            <Title level={4} style={{ margin: 0 }}>{plan.name}</Title>
            <Select
              value={plan.status}
              size="small"
              style={{ width: 110 }}
              onChange={handleStatusChange}
            >
              {Object.entries(PLAN_STATUS).map(([k, v]) => (
                <Option key={k} value={k}><Badge status={v.color as any} text={v.label} /></Option>
              ))}
            </Select>
          </Space>
          {plan.start_date && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {plan.start_date} ~ {plan.end_date || '...'}
            </Text>
          )}
          {plan.description && (
            <div><Text type="secondary" style={{ fontSize: 13 }}>{plan.description}</Text></div>
          )}
        </div>

        <Space>
          <Space.Compact>
            <Select
              value={selectedEnvId}
              onChange={setSelectedEnvId}
              placeholder="选择执行环境"
              style={{ width: 180 }}
            >
              {environments.map((e) => <Option key={e.id} value={e.id}>{e.name}</Option>)}
            </Select>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={executing}
              onClick={handleExecuteApi}
            >
              执行 API 用例
            </Button>
          </Space.Compact>
          <Button icon={<PlusOutlined />} onClick={() => setAddCasesOpen(true)}>添加用例</Button>
        </Space>
      </div>

      {/* 进度统计 */}
      {progress && progress.total > 0 && (
        <div style={{ background: '#fafafa', borderRadius: 8, padding: '16px 24px', marginBottom: 16, border: '1px solid #f0f0f0' }}>
          <Row gutter={24} align="middle">
            <Col span={8}>
              <Progress
                percent={passRate}
                format={(p) => `${p?.toFixed(1)}% 通过`}
                status={passRate === 100 ? 'success' : 'active'}
              />
            </Col>
            <Col span={16}>
              <Row gutter={16}>
                <Col><Statistic title="总用例" value={progress.total} valueStyle={{ fontSize: 20 }} /></Col>
                <Col><Statistic title="通过" value={progress.passed} valueStyle={{ color: '#52c41a', fontSize: 20 }} /></Col>
                <Col><Statistic title="失败" value={progress.failed} valueStyle={{ color: '#ff4d4f', fontSize: 20 }} /></Col>
                <Col><Statistic title="阻塞" value={progress.blocked} valueStyle={{ color: '#faad14', fontSize: 20 }} /></Col>
                <Col><Statistic title="待执行" value={progress.pending} valueStyle={{ fontSize: 20 }} /></Col>
              </Row>
            </Col>
          </Row>
        </div>
      )}

      <Divider style={{ margin: '8px 0 16px' }} />

      {/* 用例列表 */}
      <Table
        dataSource={plan.items}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        rowClassName={(record) =>
          record.result === 'passed' ? 'ant-table-row-passed'
          : record.result === 'failed' ? 'ant-table-row-failed'
          : ''
        }
      />

      {/* 添加用例弹窗 */}
      <AddCasesModal
        open={addCasesOpen}
        projectId={plan.project_id}
        existingCaseKeys={existingKeys}
        onClose={() => setAddCasesOpen(false)}
        onConfirm={handleAddCases}
      />

      {/* 手动标记结果弹窗 */}
      <Modal
        title={`标记执行结果 — ${markingItem?.case_name || ''}`}
        open={markModalOpen}
        onCancel={() => setMarkModalOpen(false)}
        onOk={() => markForm.submit()}
        okText="确认" cancelText="取消"
        confirmLoading={markSaving}
        width={420}
        destroyOnClose
      >
        <Form form={markForm} layout="vertical" onFinish={handleMark} style={{ marginTop: 16 }}>
          <Form.Item name="result" label="执行结果" rules={[{ required: true, message: '请选择结果' }]}>
            <Select>
              <Option value="passed"><Space><CheckCircleOutlined style={{ color: '#52c41a' }} />通过</Space></Option>
              <Option value="failed"><Space><CloseCircleOutlined style={{ color: '#ff4d4f' }} />失败</Space></Option>
              <Option value="blocked"><Space><WarningOutlined style={{ color: '#faad14' }} />阻塞</Space></Option>
              <Option value="skipped"><Space><MinusCircleOutlined />跳过</Space></Option>
            </Select>
          </Form.Item>
          <Form.Item name="comment" label="备注（可选）">
            <Input.TextArea rows={3} placeholder="描述问题、环境状态等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
