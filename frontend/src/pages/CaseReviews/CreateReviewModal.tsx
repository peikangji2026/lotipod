import { useEffect, useState } from 'react'
import {
  Modal, Form, Input, DatePicker, Select, Tabs, Tree, Table,
  Checkbox, Space, Typography, Spin, Tag, App, Badge,
} from 'antd'
import { FolderOutlined, FileTextOutlined } from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import dayjs from 'dayjs'
import { projectApi } from '@/services/project'
import { testcaseApi } from '@/services/testcase'
import { funcCaseApi } from '@/services/functionalCase'
import { caseReviewApi } from '@/services/caseReview'
import type { ApiTestCase, FuncTestCase, Module, FuncCaseGroup } from '@/types'

const { Text } = Typography
const { Option } = Select

const METHOD_COLORS: Record<string, string> = {
  GET: 'green', POST: 'blue', PUT: 'orange', DELETE: 'red', PATCH: 'purple',
}

interface Props {
  open: boolean
  projectId: number
  onClose: () => void
  onSuccess: () => void
}

function buildModuleTree(mods: Module[]): DataNode[] {
  return [
    { key: '__all__', title: '全部', icon: <FileTextOutlined /> },
    ...mods.map((m) => ({ key: m.id, title: m.name, icon: <FolderOutlined /> })),
  ]
}

function buildGroupTree(groups: FuncCaseGroup[]): DataNode[] {
  const buildNode = (g: FuncCaseGroup): DataNode => ({
    key: g.id, title: g.name, icon: <FolderOutlined />,
    children: g.children?.map(buildNode),
  })
  return [
    { key: '__all__', title: '全部', icon: <FileTextOutlined /> },
    ...groups.map(buildNode),
  ]
}

export default function CreateReviewModal({ open, projectId, onClose, onSuccess }: Props) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  // 项目成员（评审人候选）
  const [members, setMembers] = useState<{ user_id: number; username: string }[]>([])

  // API 用例
  const [apiModules, setApiModules] = useState<Module[]>([])
  const [apiModuleId, setApiModuleId] = useState<number | null>(null)
  const [apiCases, setApiCases] = useState<ApiTestCase[]>([])
  const [apiLoading, setApiLoading] = useState(false)

  // 功能用例
  const [funcGroups, setFuncGroups] = useState<FuncCaseGroup[]>([])
  const [funcGroupId, setFuncGroupId] = useState<number | null>(null)
  const [funcCases, setFuncCases] = useState<FuncTestCase[]>([])
  const [funcLoading, setFuncLoading] = useState(false)

  // 已选用例
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    form.resetFields()
    setSelectedKeys(new Set())
    loadMembers()
    loadApiData()
    loadFuncData()
  }, [open])

  useEffect(() => { if (open) loadApiCases() }, [apiModuleId])
  useEffect(() => { if (open) loadFuncCases() }, [funcGroupId])

  const loadMembers = async () => {
    const list = await projectApi.listMembers(projectId)
    setMembers(list.map((m: any) => ({ user_id: m.user_id, username: m.user?.username || `用户${m.user_id}` })))
  }

  const loadApiData = async () => {
    const mods = await testcaseApi.listModules(projectId)
    setApiModules(mods)
    loadApiCases()
  }
  const loadApiCases = async () => {
    setApiLoading(true)
    try {
      const res = await testcaseApi.list(projectId, { module_id: apiModuleId ?? undefined, limit: 200 })
      setApiCases(res.items)
    } finally { setApiLoading(false) }
  }

  const loadFuncData = async () => {
    const groups = await funcCaseApi.listGroups(projectId)
    setFuncGroups(groups)
    loadFuncCases()
  }
  const loadFuncCases = async () => {
    setFuncLoading(true)
    try {
      const res = await funcCaseApi.list(projectId, { group_id: funcGroupId ?? undefined, limit: 200 })
      setFuncCases(res.items)
    } finally { setFuncLoading(false) }
  }

  const toggleCase = (key: string) => {
    const next = new Set(selectedKeys)
    next.has(key) ? next.delete(key) : next.add(key)
    setSelectedKeys(next)
  }

  const handleOk = async () => {
    try {
      const vals = await form.validateFields()
      if (selectedKeys.size === 0) { message.warning('请至少选择一个用例'); return }

      const cases = Array.from(selectedKeys).map((k) => {
        const [type, idStr] = k.split('_')
        return { case_type: type as 'api' | 'functional', case_id: parseInt(idStr) }
      })

      setSubmitting(true)
      await caseReviewApi.create(projectId, {
        title: vals.title,
        deadline: vals.deadline ? dayjs(vals.deadline).format('YYYY-MM-DD') : undefined,
        reviewer_ids: vals.reviewer_ids,
        cases,
      })
      message.success('评审创建成功')
      onSuccess()
    } catch (e: any) {
      if (e?.errorFields) return   // form validation
      message.error('创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const apiColumns = [
    {
      title: '', width: 36,
      render: (_: any, r: ApiTestCase) => (
        <Checkbox checked={selectedKeys.has(`api_${r.id}`)} onChange={() => toggleCase(`api_${r.id}`)} />
      ),
    },
    {
      title: '方法', dataIndex: 'method', width: 60,
      render: (m: string) => <Tag color={METHOD_COLORS[m] || 'default'} style={{ fontSize: 11 }}>{m}</Tag>,
    },
    { title: '用例名称', dataIndex: 'name' },
    { title: '路径', dataIndex: 'path', render: (p: string) => <Text type="secondary" style={{ fontSize: 11 }}>{p}</Text> },
  ]

  const funcColumns = [
    {
      title: '', width: 36,
      render: (_: any, r: FuncTestCase) => (
        <Checkbox checked={selectedKeys.has(`functional_${r.id}`)} onChange={() => toggleCase(`functional_${r.id}`)} />
      ),
    },
    { title: '用例名称', dataIndex: 'title' },
    {
      title: '优先级', dataIndex: 'priority', width: 70,
      render: (p: string) => <Tag color={p === 'P0' ? 'red' : p === 'P1' ? 'orange' : 'blue'}>{p}</Tag>,
    },
  ]

  return (
    <Modal
      title="创建用例评审"
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText={`创建评审（已选 ${selectedKeys.size} 条）`}
      cancelText="取消"
      width={860}
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginBottom: 16 }}>
        <Form.Item name="title" label="评审名称" rules={[{ required: true, message: '请输入评审名称' }]}>
          <Input placeholder="例如：Sprint 8.2 功能用例评审" />
        </Form.Item>
        <Space size={16} style={{ width: '100%' }}>
          <Form.Item name="deadline" label="截止日期" style={{ minWidth: 200 }}>
            <DatePicker style={{ width: '100%' }} disabledDate={(d) => d < dayjs().startOf('day')} />
          </Form.Item>
          <Form.Item
            name="reviewer_ids" label="评审人（可多选）"
            rules={[{ required: true, message: '请选择至少一名评审人' }]}
            style={{ minWidth: 300 }}
          >
            <Select mode="multiple" placeholder="选择评审人" allowClear>
              {members.map((m) => (
                <Option key={m.user_id} value={m.user_id}>{m.username}</Option>
              ))}
            </Select>
          </Form.Item>
        </Space>
      </Form>

      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        选择评审用例：已选 <Text strong>{selectedKeys.size}</Text> 条
      </Text>

      <Tabs
        items={[
          {
            key: 'api', label: 'API 测试用例',
            children: (
              <div style={{ display: 'flex', gap: 12, height: 300 }}>
                <Tree
                  treeData={buildModuleTree(apiModules)}
                  showIcon
                  defaultExpandAll
                  style={{ width: 160, flexShrink: 0, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 8 }}
                  onSelect={(keys) => setApiModuleId(keys[0] === '__all__' ? null : Number(keys[0]))}
                />
                <Spin spinning={apiLoading} style={{ flex: 1 }}>
                  <Table
                    dataSource={apiCases}
                    columns={apiColumns}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    scroll={{ y: 260 }}
                    style={{ flex: 1 }}
                  />
                </Spin>
              </div>
            ),
          },
          {
            key: 'functional', label: '功能测试用例',
            children: (
              <div style={{ display: 'flex', gap: 12, height: 300 }}>
                <Tree
                  treeData={buildGroupTree(funcGroups)}
                  showIcon
                  defaultExpandAll
                  style={{ width: 160, flexShrink: 0, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 8 }}
                  onSelect={(keys) => setFuncGroupId(keys[0] === '__all__' ? null : Number(keys[0]))}
                />
                <Spin spinning={funcLoading} style={{ flex: 1 }}>
                  <Table
                    dataSource={funcCases}
                    columns={funcColumns}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    scroll={{ y: 260 }}
                    style={{ flex: 1 }}
                  />
                </Spin>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  )
}
