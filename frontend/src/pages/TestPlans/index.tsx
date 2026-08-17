import { useEffect, useState } from 'react'
import {
  Button, Table, Space, Typography, App, Select,
  Empty, Progress, Modal, Form, Input, DatePicker,
  Popconfirm, Badge, Tooltip, Tag,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, EyeOutlined, EditOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { testPlanApi, type TestPlanPayload } from '@/services/testPlan'
import { useProjectStore } from '@/stores/projectStore'
import type { TestPlan } from '@/types'

const { Title, Text } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

const PLAN_STATUS: Record<string, { color: string; label: string }> = {
  draft:     { color: 'default',    label: '草稿' },
  active:    { color: 'processing', label: '进行中' },
  completed: { color: 'success',    label: '已完成' },
  archived:  { color: 'warning',    label: '已归档' },
}

export default function TestPlans() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { selectedProjectId } = useProjectStore()

  const [plans, setPlans] = useState<TestPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [generatingId, setGeneratingId] = useState<number | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<TestPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    if (selectedProjectId) loadPlans()
    else setPlans([])
  }, [selectedProjectId])

  const loadPlans = async () => {
    if (!selectedProjectId) return
    setLoading(true)
    try {
      const list = await testPlanApi.list(selectedProjectId)
      setPlans(list)
    } catch {
      message.error('获取测试计划失败')
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditingPlan(null)
    form.resetFields()
    form.setFieldsValue({ status: 'draft' })
    setModalOpen(true)
  }

  const openEdit = (plan: TestPlan) => {
    setEditingPlan(plan)
    form.setFieldsValue({
      name: plan.name,
      description: plan.description,
      status: plan.status,
      dateRange: plan.start_date && plan.end_date
        ? [dayjs(plan.start_date), dayjs(plan.end_date)]
        : undefined,
    })
    setModalOpen(true)
  }

  const handleSave = async (values: any) => {
    if (!selectedProjectId) return
    setSaving(true)
    try {
      const payload: TestPlanPayload = {
        name: values.name,
        description: values.description,
        status: values.status,
        start_date: values.dateRange?.[0]?.format('YYYY-MM-DD') || null,
        end_date: values.dateRange?.[1]?.format('YYYY-MM-DD') || null,
      }
      if (editingPlan) {
        await testPlanApi.update(editingPlan.id, payload)
        message.success('计划已更新')
      } else {
        const res = await testPlanApi.create(selectedProjectId, payload)
        message.success('计划已创建')
        navigate(`/test-plans/${res.id}`)
        return
      }
      setModalOpen(false)
      loadPlans()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (planId: number) => {
    try {
      await testPlanApi.delete(planId)
      message.success('计划已删除')
      loadPlans()
    } catch {
      message.error('删除失败')
    }
  }

  const handleGenerateReport = async (plan: TestPlan) => {
    setGeneratingId(plan.id)
    try {
      await testPlanApi.generateReport(plan.id)
      message.success(`「${plan.name}」报告已生成，可在测试报告页查看`)
      loadPlans()
    } catch {
      message.error('生成报告失败')
    } finally {
      setGeneratingId(null)
    }
  }

  const columns = [
    {
      title: '计划名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: TestPlan) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/test-plans/${record.id}`)}>
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
      title: '用例数',
      dataIndex: 'total_cases',
      key: 'total_cases',
      width: 70,
      render: (n: number) => <Tag>{n ?? 0}</Tag>,
    },
    {
      title: '执行进度',
      key: 'progress',
      width: 220,
      render: (_: any, record: TestPlan) => {
        const p = record.progress
        if (!p || p.total === 0) return <Text type="secondary">暂无用例</Text>
        return (
          <Space size={6}>
            <Progress percent={p.pass_rate} size="small" style={{ width: 120 }} status={p.pass_rate === 100 ? 'success' : 'active'} />
            <Text style={{ fontSize: 12, color: '#52c41a' }}>{p.passed}✓</Text>
            {p.failed > 0 && <Text style={{ fontSize: 12, color: '#ff4d4f' }}>{p.failed}✗</Text>}
            {p.blocked > 0 && <Text style={{ fontSize: 12, color: '#faad14' }}>{p.blocked}⚠</Text>}
          </Space>
        )
      },
    },
    {
      title: '时间范围',
      key: 'date',
      width: 180,
      render: (_: any, record: TestPlan) => {
        if (!record.start_date) return <Text type="secondary">-</Text>
        return <Text style={{ fontSize: 12 }}>{record.start_date} ~ {record.end_date || '...'}</Text>
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (t: string) => <Text style={{ fontSize: 12 }}>{dayjs(t).format('MM-DD HH:mm')}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: TestPlan) => (
        <Space size={0}>
          <Tooltip title="查看详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/test-plans/${record.id}`)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Tooltip title="生成测试报告">
            <Button
              type="link" size="small" icon={<FileTextOutlined />}
              loading={generatingId === record.id}
              onClick={() => handleGenerateReport(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除该测试计划？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除" okType="danger" cancelText="取消"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>测试计划</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} disabled={!selectedProjectId}>
          新建计划
        </Button>
      </div>

      {!selectedProjectId ? (
        <Empty description="请在顶部选择项目" style={{ paddingTop: 60 }} />
      ) : (
        <Table
          dataSource={plans}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 个计划` }}
          locale={{ emptyText: <Empty description="暂无测试计划，点击「新建计划」" /> }}
        />
      )}

      <Modal
        title={editingPlan ? '编辑计划' : '新建测试计划'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="保存" cancelText="取消"
        confirmLoading={saving}
        width={500}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="计划名称" rules={[{ required: true }]}>
            <Input placeholder="如：2025-Q1 回归测试" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Option value="draft">草稿</Option>
              <Option value="active">进行中</Option>
              <Option value="completed">已完成</Option>
              <Option value="archived">已归档</Option>
            </Select>
          </Form.Item>
          <Form.Item name="dateRange" label="计划时间范围">
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="测试范围、目标等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
