import { useEffect, useRef, useState } from 'react'
import {
  Layout, Tree, Button, Table, Tag, Space, Typography, App,
  Drawer, Form, Input, Select, Popconfirm, Spin, Empty,
  Tabs, Row, Col, Modal, Divider, Badge, Collapse, Tooltip,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  PlayCircleOutlined, FolderOutlined, FileTextOutlined,
  CloseOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import { projectApi } from '@/services/project'
import { testcaseApi, type TestCasePayload } from '@/services/testcase'
import { useProjectStore } from '@/stores/projectStore'
import type { Project, Module, ApiTestCase, Environment, TestResult } from '@/types'

const { Sider, Content } = Layout
const { Title, Text } = Typography
const { Option } = Select

const METHOD_COLORS: Record<string, string> = {
  GET: 'green', POST: 'blue', PUT: 'orange',
  DELETE: 'red', PATCH: 'purple', HEAD: 'default',
}

const STATUS_LABELS: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  active: { color: 'success', label: '启用' },
  deprecated: { color: 'warning', label: '废弃' },
}

const PRIORITY_LABELS: Record<string, { color: string; label: string }> = {
  high: { color: 'error', label: '高' },
  medium: { color: 'warning', label: '中' },
  low: { color: 'default', label: '低' },
}

const RESULT_STATUS: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  passed: { color: 'success', label: '通过', icon: <CheckCircleOutlined style={{ color: '#52c41a' }} /> },
  failed: { color: 'error', label: '失败', icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> },
  error: { color: 'warning', label: '错误', icon: <CloseCircleOutlined style={{ color: '#faad14' }} /> },
  pending: { color: 'default', label: '等待', icon: <Badge status="default" /> },
  skipped: { color: 'default', label: '跳过', icon: <Badge status="default" /> },
}

export default function TestCases() {
  const { message } = App.useApp()
  const { selectedProjectId } = useProjectStore()

  // 模块
  const [modules, setModules] = useState<Module[]>([])
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null)
  const [moduleModalOpen, setModuleModalOpen] = useState(false)
  const [moduleForm] = Form.useForm()

  // 用例列表
  const [cases, setCases] = useState<ApiTestCase[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // 用例编辑抽屉
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingCase, setEditingCase] = useState<ApiTestCase | null>(null)
  const [caseForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [assertionRows, setAssertionRows] = useState<any[]>([])

  // ===== 内嵌调试面板 =====
  const [debugPanelOpen, setDebugPanelOpen] = useState(false)
  const [debugCase, setDebugCase] = useState<ApiTestCase | null>(null)
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [selectedEnvId, setSelectedEnvId] = useState<number | null>(null)
  const [executing, setExecuting] = useState(false)
  const [debugResult, setDebugResult] = useState<TestResult | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ===== 初始化 =====
  useEffect(() => {
    if (selectedProjectId) {
      setSelectedModuleId(null)
      loadModules()
      loadCases()
      loadEnvironments()
    }
    return () => stopPolling()
  }, [selectedProjectId, selectedModuleId])

  const loadModules = async () => {
    if (!selectedProjectId) return
    const mods = await testcaseApi.listModules(selectedProjectId)
    setModules(mods)
  }

  const loadCases = async () => {
    if (!selectedProjectId) return
    setLoading(true)
    try {
      const res = await testcaseApi.list(selectedProjectId, {
        module_id: selectedModuleId ?? undefined,
      })
      setCases(res.items)
      setTotal(res.total)
    } catch {
      message.error('获取用例列表失败')
    } finally {
      setLoading(false)
    }
  }

  const loadEnvironments = async () => {
    if (!selectedProjectId) return
    const envs = await projectApi.listEnvironments(selectedProjectId)
    setEnvironments(envs)
    if (envs.length > 0 && !selectedEnvId) setSelectedEnvId(envs[0].id)
  }

  // ===== 模块树 =====
  const buildTreeData = (): DataNode[] => {
    const allNode: DataNode = {
      key: 'all',
      title: '全部用例',
      icon: <FileTextOutlined />,
    }
    const moduleNodes: DataNode[] = modules.map((m) => ({
      key: m.id,
      title: m.name,
      icon: <FolderOutlined />,
    }))
    return [allNode, ...moduleNodes]
  }

  const handleTreeSelect = (keys: any[]) => {
    const key = keys[0]
    if (key === 'all' || key === undefined) {
      setSelectedModuleId(null)
    } else {
      setSelectedModuleId(Number(key))
    }
  }

  const handleCreateModule = async (values: { name: string }) => {
    if (!selectedProjectId) return
    try {
      await testcaseApi.createModule(selectedProjectId, values)
      message.success('模块创建成功')
      setModuleModalOpen(false)
      moduleForm.resetFields()
      loadModules()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '创建失败')
    }
  }

  const handleDeleteModule = async (moduleId: number) => {
    try {
      await testcaseApi.deleteModule(moduleId)
      message.success('模块已删除')
      if (selectedModuleId === moduleId) setSelectedModuleId(null)
      loadModules()
      loadCases()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '删除失败')
    }
  }

  // ===== 用例操作 =====
  const openCreateDrawer = () => {
    setEditingCase(null)
    setAssertionRows([])
    caseForm.resetFields()
    caseForm.setFieldsValue({ method: 'GET', priority: 'medium', status: 'draft', body_type: 'json' })
    setDrawerOpen(true)
  }

  const openEditDrawer = async (caseId: number) => {
    try {
      const tc = await testcaseApi.get(caseId)
      setEditingCase(tc)
      setAssertionRows(tc.assertions || [])
      caseForm.setFieldsValue({
        name: tc.name,
        description: tc.description,
        module_id: tc.module_id,
        method: tc.method,
        url: tc.url,
        headers: JSON.stringify(tc.headers || {}, null, 2),
        params: JSON.stringify(tc.params || {}, null, 2),
        body: tc.body,
        body_type: tc.body_type,
        priority: tc.priority,
        status: tc.status,
      })
      setDrawerOpen(true)
    } catch {
      message.error('获取用例详情失败')
    }
  }

  const handleSaveCase = async (values: any) => {
    if (!selectedProjectId) return
    setSaving(true)
    try {
      const payload: TestCasePayload = {
        ...values,
        module_id: values.module_id || null,
        headers: values.headers ? JSON.parse(values.headers) : {},
        params: values.params ? JSON.parse(values.params) : {},
        assertions: assertionRows,
      }
      if (editingCase) {
        await testcaseApi.update(editingCase.id, payload)
        message.success('用例更新成功')
      } else {
        await testcaseApi.create(selectedProjectId, payload)
        message.success('用例创建成功')
      }
      setDrawerOpen(false)
      loadCases()
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        message.error('Headers 或 Params 格式错误，请输入有效的 JSON')
      } else {
        message.error(err?.response?.data?.detail || '保存失败')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCase = async (caseId: number) => {
    try {
      await testcaseApi.delete(caseId)
      message.success('用例已删除')
      if (debugCase?.id === caseId) {
        setDebugPanelOpen(false)
        setDebugCase(null)
      }
      loadCases()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '删除失败')
    }
  }

  // ===== 断言管理 =====
  const addAssertion = () => {
    setAssertionRows([...assertionRows, { type: 'status_code', expected: '200', path: '' }])
  }

  const updateAssertion = (idx: number, field: string, value: any) => {
    const updated = [...assertionRows]
    updated[idx] = { ...updated[idx], [field]: value }
    setAssertionRows(updated)
  }

  const removeAssertion = (idx: number) => {
    setAssertionRows(assertionRows.filter((_, i) => i !== idx))
  }

  // ===== 调试面板 =====
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const openDebugPanel = (tc: ApiTestCase) => {
    setDebugCase(tc)
    setDebugResult(null)
    setDebugPanelOpen(true)
  }

  const handleDebugRun = async () => {
    if (!selectedProjectId || !debugCase) return
    if (!selectedEnvId) {
      message.warning('请先选择执行环境')
      return
    }
    setExecuting(true)
    setDebugResult(null)
    stopPolling()
    try {
      const run = await testcaseApi.createRun(selectedProjectId, {
        environment_id: selectedEnvId,
        test_case_ids: [debugCase.id],
        name: `调试 #${debugCase.id}`,
      })
      // 轮询结果
      const poll = async () => {
        const latest = await testcaseApi.getRun(selectedProjectId, run.id)
        if (latest.status === 'finished' || latest.status === 'failed') {
          stopPolling()
          const results = await testcaseApi.getRunResults(selectedProjectId, run.id)
          if (results.length > 0) setDebugResult(results[0])
          setExecuting(false)
        }
      }
      pollingRef.current = setInterval(poll, 1500)
      // 先立即查一次
      setTimeout(poll, 1500)
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '执行失败')
      setExecuting(false)
    }
  }

  // ===== 表格列 =====
  const columns = [
    {
      title: '用例名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ApiTestCase) => (
        <Space>
          <Tag color={METHOD_COLORS[record.method] || 'default'} style={{ fontFamily: 'monospace' }}>
            {record.method}
          </Tag>
          <Text>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      render: (url: string) => <Text type="secondary" style={{ fontSize: 12 }}>{url}</Text>,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (p: string) => {
        const conf = PRIORITY_LABELS[p] || { color: 'default', label: p }
        return <Tag color={conf.color}>{conf.label}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (s: string) => {
        const conf = STATUS_LABELS[s] || { color: 'default', label: s }
        return <Tag color={conf.color}>{conf.label}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, record: ApiTestCase) => (
        <Space size={0}>
          <Tooltip title="调试执行">
            <Button
              type="link" size="small" icon={<PlayCircleOutlined style={{ color: '#52c41a' }} />}
              onClick={() => openDebugPanel(record)}
            />
          </Tooltip>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditDrawer(record.id)} />
          <Popconfirm
            title="确认删除该用例？"
            onConfirm={() => handleDeleteCase(record.id)}
            okText="删除" okType="danger" cancelText="取消"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (!selectedProjectId) {
    return (
      <div>
        <Title level={4} style={{ marginBottom: 16 }}>API 测试用例</Title>
        <Empty description="请在顶部选择项目" style={{ paddingTop: 60 }} />
      </div>
    )
  }

  return (
    <div style={{ height: '100%' }}>
      {/* 顶部：操作按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Title level={4} style={{ margin: 0 }}>API 测试用例</Title>
          <Text type="secondary">共 {total} 条</Text>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateDrawer}>
          新建用例
        </Button>
      </div>

      <Layout style={{ background: 'transparent', gap: 16 }}>
        {/* 左侧模块树 */}
        <Sider width={200} style={{ background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0', padding: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
            <Text strong style={{ fontSize: 13 }}>模块</Text>
            <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => setModuleModalOpen(true)} />
          </div>
          <Tree
            treeData={buildTreeData()}
            defaultSelectedKeys={['all']}
            showIcon
            onSelect={handleTreeSelect}
            titleRender={(node: any) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.title}</span>
                {node.key !== 'all' && (
                  <Popconfirm
                    title="删除模块后用例将变为未分类，确认？"
                    onConfirm={(e) => { e?.stopPropagation(); handleDeleteModule(Number(node.key)) }}
                    okText="删除" okType="danger" cancelText="取消"
                  >
                    <DeleteOutlined
                      style={{ fontSize: 11, color: '#ff4d4f', marginLeft: 4 }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                )}
              </div>
            )}
          />
        </Sider>

        {/* 右侧内容区：用例列表 + 调试面板 */}
        <Content>
          <Layout style={{ background: 'transparent', gap: 12 }}>
            {/* 用例列表 */}
            <Content>
              <Spin spinning={loading}>
                <Table
                  dataSource={cases}
                  columns={columns}
                  rowKey="id"
                  size="small"
                  rowClassName={(record) => debugCase?.id === record.id ? 'ant-table-row-selected' : ''}
                  pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
                />
              </Spin>
            </Content>

            {/* 调试面板（右侧固定宽度） */}
            {debugPanelOpen && debugCase && (
              <Sider
                width={400}
                style={{
                  background: '#fafafa',
                  borderRadius: 6,
                  border: '1px solid #f0f0f0',
                  padding: '12px 16px',
                  overflowY: 'auto',
                  maxHeight: 'calc(100vh - 180px)',
                }}
              >
                {/* 面板标题 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Space>
                    <Tag color={METHOD_COLORS[debugCase.method] || 'default'} style={{ fontFamily: 'monospace' }}>
                      {debugCase.method}
                    </Tag>
                    <Text strong style={{ fontSize: 13, maxWidth: 200 }} ellipsis>
                      {debugCase.name}
                    </Text>
                  </Space>
                  <Button
                    type="text" size="small" icon={<CloseOutlined />}
                    onClick={() => { setDebugPanelOpen(false); setDebugResult(null); stopPolling() }}
                  />
                </div>

                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                  {debugCase.url}
                </Text>

                {/* 环境选择 + 执行 */}
                <div style={{ marginBottom: 12 }}>
                  <Space.Compact style={{ width: '100%' }}>
                    <Select
                      value={selectedEnvId}
                      onChange={setSelectedEnvId}
                      placeholder="选择环境"
                      style={{ flex: 1 }}
                    >
                      {environments.map((e) => (
                        <Option key={e.id} value={e.id}>{e.name} ({e.base_url})</Option>
                      ))}
                    </Select>
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      loading={executing}
                      onClick={handleDebugRun}
                    >
                      {executing ? '执行中...' : '执行'}
                    </Button>
                  </Space.Compact>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                {/* 用例信息 */}
                <Collapse
                  size="small"
                  ghost
                  defaultActiveKey={[]}
                  items={[
                    {
                      key: 'request',
                      label: <Text style={{ fontSize: 12 }}>请求详情</Text>,
                      children: (
                        <div style={{ fontSize: 12 }}>
                          {debugCase.headers && Object.keys(debugCase.headers).length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <Text type="secondary">Headers：</Text>
                              <pre style={{ margin: '4px 0', fontSize: 11, background: '#f5f5f5', padding: 6, borderRadius: 4 }}>
                                {JSON.stringify(debugCase.headers, null, 2)}
                              </pre>
                            </div>
                          )}
                          {debugCase.params && Object.keys(debugCase.params).length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <Text type="secondary">Params：</Text>
                              <pre style={{ margin: '4px 0', fontSize: 11, background: '#f5f5f5', padding: 6, borderRadius: 4 }}>
                                {JSON.stringify(debugCase.params, null, 2)}
                              </pre>
                            </div>
                          )}
                          {debugCase.body && (
                            <div>
                              <Text type="secondary">Body ({debugCase.body_type})：</Text>
                              <pre style={{ margin: '4px 0', fontSize: 11, background: '#f5f5f5', padding: 6, borderRadius: 4 }}>
                                {debugCase.body}
                              </pre>
                            </div>
                          )}
                          {!debugCase.body && (!debugCase.headers || Object.keys(debugCase.headers).length === 0) && (
                            <Text type="secondary" style={{ fontSize: 12 }}>无额外请求参数</Text>
                          )}
                        </div>
                      ),
                    },
                  ]}
                />

                <Divider style={{ margin: '8px 0' }} />

                {/* 执行结果 */}
                {executing && !debugResult && (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <Spin tip="执行中..." />
                  </div>
                )}

                {debugResult && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      {RESULT_STATUS[debugResult.status]?.icon}
                      <Text strong style={{ color: debugResult.status === 'passed' ? '#52c41a' : '#ff4d4f' }}>
                        {RESULT_STATUS[debugResult.status]?.label || debugResult.status}
                      </Text>
                      {debugResult.response_time && (
                        <Tag style={{ marginLeft: 'auto' }}>{debugResult.response_time}ms</Tag>
                      )}
                    </div>

                    {debugResult.error_message && (
                      <div style={{ marginBottom: 8 }}>
                        <Text type="danger" style={{ fontSize: 12 }}>{debugResult.error_message}</Text>
                      </div>
                    )}

                    {debugResult.response_data && (
                      <div style={{ marginBottom: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>响应：</Text>
                        <pre style={{ fontSize: 11, background: '#f5f5f5', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto', margin: '4px 0' }}>
                          {JSON.stringify(debugResult.response_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {debugResult.assertion_results && debugResult.assertion_results.length > 0 && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>断言结果：</Text>
                        {debugResult.assertion_results.map((ar: any, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            {ar.passed
                              ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                              : <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />}
                            <Text style={{ fontSize: 12 }}>
                              {ar.type}：期望 {String(ar.expected)}，实际 {String(ar.actual)}
                            </Text>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: 8 }}>
                      <Button
                        size="small" icon={<ReloadOutlined />}
                        onClick={() => { setDebugResult(null); handleDebugRun() }}
                      >
                        再次执行
                      </Button>
                    </div>
                  </div>
                )}

                {!executing && !debugResult && (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="点击「执行」运行此用例"
                    style={{ margin: '20px 0' }}
                  />
                )}
              </Sider>
            )}
          </Layout>
        </Content>
      </Layout>

      {/* 新建模块弹窗 */}
      <Modal
        title="新建模块"
        open={moduleModalOpen}
        onCancel={() => setModuleModalOpen(false)}
        onOk={() => moduleForm.submit()}
        okText="创建" cancelText="取消"
        width={360}
        destroyOnClose
      >
        <Form form={moduleForm} layout="vertical" onFinish={handleCreateModule} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="模块名称" rules={[{ required: true, message: '请输入模块名称' }]}>
            <Input placeholder="如：用户模块、订单模块" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 用例编辑抽屉 */}
      <Drawer
        title={editingCase ? '编辑用例' : '新建用例'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => caseForm.submit()}>
              保存
            </Button>
          </Space>
        }
        destroyOnClose
      >
        <Form form={caseForm} layout="vertical" onFinish={handleSaveCase}>
          <Tabs
            items={[
              {
                key: 'basic',
                label: '基本信息',
                children: (
                  <Row gutter={12}>
                    <Col span={16}>
                      <Form.Item name="name" label="用例名称" rules={[{ required: true }]}>
                        <Input placeholder="用例名称" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="module_id" label="所属模块">
                        <Select allowClear placeholder="未分类">
                          {modules.map((m) => <Option key={m.id} value={m.id}>{m.name}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item name="method" label="Method" rules={[{ required: true }]}>
                        <Select>
                          {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
                            <Option key={m} value={m}>
                              <Tag color={METHOD_COLORS[m]}>{m}</Tag>
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={20}>
                      <Form.Item name="url" label="URL" rules={[{ required: true }]}>
                        <Input placeholder="/api/users 或 https://..." />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="priority" label="优先级">
                        <Select>
                          <Option value="high">高</Option>
                          <Option value="medium">中</Option>
                          <Option value="low">低</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="status" label="状态">
                        <Select>
                          <Option value="draft">草稿</Option>
                          <Option value="active">启用</Option>
                          <Option value="deprecated">废弃</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item name="description" label="描述">
                        <Input.TextArea rows={2} />
                      </Form.Item>
                    </Col>
                  </Row>
                ),
              },
              {
                key: 'request',
                label: '请求配置',
                children: (
                  <>
                    <Form.Item
                      name="headers"
                      label="请求头 Headers（JSON 格式）"
                      initialValue="{}"
                    >
                      <Input.TextArea rows={4} style={{ fontFamily: 'monospace', fontSize: 12 }} />
                    </Form.Item>
                    <Form.Item
                      name="params"
                      label="Query 参数（JSON 格式）"
                      initialValue="{}"
                    >
                      <Input.TextArea rows={3} style={{ fontFamily: 'monospace', fontSize: 12 }} />
                    </Form.Item>
                    <Row gutter={8}>
                      <Col span={6}>
                        <Form.Item name="body_type" label="Body 类型">
                          <Select>
                            <Option value="json">JSON</Option>
                            <Option value="form">Form</Option>
                            <Option value="raw">Raw</Option>
                            <Option value="none">None</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={18}>
                        <Form.Item name="body" label="请求体 Body">
                          <Input.TextArea
                            rows={5}
                            style={{ fontFamily: 'monospace', fontSize: 12 }}
                            placeholder='{"key": "value"}'
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                ),
              },
              {
                key: 'assertions',
                label: `断言（${assertionRows.length}）`,
                children: (
                  <>
                    <Button size="small" icon={<PlusOutlined />} onClick={addAssertion} style={{ marginBottom: 12 }}>
                      添加断言
                    </Button>
                    {assertionRows.map((row, idx) => (
                      <Row key={idx} gutter={8} style={{ marginBottom: 8, alignItems: 'flex-start' }}>
                        <Col span={6}>
                          <Select
                            value={row.type}
                            style={{ width: '100%' }}
                            onChange={(v) => updateAssertion(idx, 'type', v)}
                          >
                            <Option value="status_code">状态码</Option>
                            <Option value="response_time">响应时间(ms)</Option>
                            <Option value="json_path">JSONPath</Option>
                            <Option value="contains">包含文本</Option>
                            <Option value="regex">正则匹配</Option>
                          </Select>
                        </Col>
                        {row.type === 'json_path' && (
                          <Col span={7}>
                            <Input
                              placeholder="$.data.id"
                              value={row.path}
                              onChange={(e) => updateAssertion(idx, 'path', e.target.value)}
                            />
                          </Col>
                        )}
                        <Col span={row.type === 'json_path' ? 8 : 15}>
                          <Input
                            placeholder="预期值"
                            value={row.expected}
                            onChange={(e) => updateAssertion(idx, 'expected', e.target.value)}
                          />
                        </Col>
                        <Col span={3}>
                          <Button danger size="small" onClick={() => removeAssertion(idx)}>删除</Button>
                        </Col>
                      </Row>
                    ))}
                    {assertionRows.length === 0 && (
                      <Empty description="暂无断言规则，点击「添加断言」" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Drawer>
    </div>
  )
}
