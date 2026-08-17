import { useEffect, useState } from 'react'
import {
  Drawer, Form, Input, Select, Button, Space, Row, Col,
  Table, Tag, Typography, App,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { FuncCaseGroup, FuncTestCase, TestStep } from '@/types'

const { Option } = Select
const { Text } = Typography

const PRIORITY_OPTIONS = [
  { value: 'P0', label: 'P0 - 最高', color: 'red' },
  { value: 'P1', label: 'P1 - 高', color: 'orange' },
  { value: 'P2', label: 'P2 - 中', color: 'blue' },
  { value: 'P3', label: 'P3 - 低', color: 'default' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'pending_review', label: '待评审' },
  { value: 'approved', label: '已通过' },
  { value: 'deprecated', label: '废弃' },
]

interface Props {
  open: boolean
  editingCase: FuncTestCase | null
  groups: FuncCaseGroup[]
  selectedGroupId: number | null
  onClose: () => void
  onSave: (values: any, steps: TestStep[]) => Promise<void>
}

export default function CaseDrawer({ open, editingCase, groups, selectedGroupId, onClose, onSave }: Props) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [steps, setSteps] = useState<TestStep[]>([])

  useEffect(() => {
    if (open) {
      if (editingCase) {
        form.setFieldsValue({
          title: editingCase.title,
          group_id: editingCase.group_id,
          precondition: editingCase.precondition,
          priority: editingCase.priority,
          status: editingCase.status,
          tags: editingCase.tags,
          estimated_hours: editingCase.estimated_hours,
        })
        setSteps(editingCase.steps || [])
      } else {
        form.setFieldsValue({
          priority: 'P2',
          status: 'draft',
          group_id: selectedGroupId,
        })
        setSteps([])
      }
    }
  }, [open, editingCase, selectedGroupId])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await onSave(values, steps)
    } catch (err: any) {
      if (err?.errorFields) {
        message.error('请检查表单填写是否完整')
      }
    } finally {
      setSaving(false)
    }
  }

  const addStep = () => setSteps([...steps, { step: '', expected: '' }])

  const updateStep = (idx: number, field: keyof TestStep, value: string) => {
    const updated = [...steps]
    updated[idx] = { ...updated[idx], [field]: value }
    setSteps(updated)
  }

  const removeStep = (idx: number) => setSteps(steps.filter((_, i) => i !== idx))

  const flattenGroups = (list: FuncCaseGroup[], indent = 0): { id: number; name: string; indent: number }[] => {
    const result: { id: number; name: string; indent: number }[] = []
    for (const g of list) {
      result.push({ id: g.id, name: g.name, indent })
      if (g.children) result.push(...flattenGroups(g.children, indent + 1))
    }
    return result
  }

  return (
    <Drawer
      title={editingCase ? '编辑功能用例' : '新建功能用例'}
      open={open}
      onClose={onClose}
      width={780}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>保存</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        {/* 基本信息 */}
        <Row gutter={12}>
          <Col span={24}>
            <Form.Item name="title" label="用例标题" rules={[{ required: true, message: '请输入用例标题' }]}>
              <Input placeholder="用例标题" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="group_id" label="所属分组">
              <Select allowClear placeholder="未分类">
                {flattenGroups(groups).map((g) => (
                  <Option key={g.id} value={g.id}>
                    {'　'.repeat(g.indent)}{g.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="priority" label="优先级">
              <Select>
                {PRIORITY_OPTIONS.map((o) => (
                  <Option key={o.value} value={o.value}>
                    <Tag color={o.color}>{o.value}</Tag> {o.label.split(' - ')[1]}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="status" label="状态">
              <Select>
                {STATUS_OPTIONS.map((o) => (
                  <Option key={o.value} value={o.value}>{o.label}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item name="tags" label="标签">
              <Select mode="tags" placeholder="输入标签后按回车" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="estimated_hours" label="预计工时(小时)">
              <Input type="number" min={0} step={0.5} placeholder="0.5" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="precondition" label="前置条件">
              <Input.TextArea rows={2} placeholder="描述测试前置条件、环境依赖等" />
            </Form.Item>
          </Col>
        </Row>

        {/* 测试步骤 */}
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>测试步骤 ({steps.length})</Text>
          <Button size="small" icon={<PlusOutlined />} onClick={addStep}>添加步骤</Button>
        </div>

        <Table
          dataSource={steps.map((s, i) => ({ ...s, key: i }))}
          size="small"
          pagination={false}
          locale={{ emptyText: '暂无步骤，点击「添加步骤」' }}
          columns={[
            {
              title: '#',
              width: 40,
              render: (_: any, __: any, idx: number) => (
                <Text type="secondary" style={{ fontSize: 12 }}>{idx + 1}</Text>
              ),
            },
            {
              title: '操作步骤',
              dataIndex: 'step',
              render: (val: string, _: any, idx: number) => (
                <Input.TextArea
                  value={val}
                  rows={1}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  placeholder="描述操作步骤"
                  onChange={(e) => updateStep(idx, 'step', e.target.value)}
                />
              ),
            },
            {
              title: '预期结果',
              dataIndex: 'expected',
              render: (val: string, _: any, idx: number) => (
                <Input.TextArea
                  value={val}
                  rows={1}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  placeholder="描述预期结果"
                  onChange={(e) => updateStep(idx, 'expected', e.target.value)}
                />
              ),
            },
            {
              title: '',
              width: 40,
              render: (_: any, __: any, idx: number) => (
                <Button
                  type="text" danger size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removeStep(idx)}
                />
              ),
            },
          ]}
        />
      </Form>
    </Drawer>
  )
}
