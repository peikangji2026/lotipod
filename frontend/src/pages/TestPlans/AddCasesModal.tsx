import { useEffect, useState } from 'react'
import {
  Modal, Tabs, Tree, Table, Checkbox, Space, Typography, Spin, Tag, Input,
} from 'antd'
import { FolderOutlined, FileTextOutlined } from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import { testcaseApi } from '@/services/testcase'
import { funcCaseApi } from '@/services/functionalCase'
import type { ApiTestCase, FuncTestCase, Module, FuncCaseGroup } from '@/types'

const { Text } = Typography

const METHOD_COLORS: Record<string, string> = {
  GET: 'green', POST: 'blue', PUT: 'orange', DELETE: 'red', PATCH: 'purple',
}

interface SelectedCase {
  case_type: 'api' | 'functional'
  case_id: number
  name: string
}

interface Props {
  open: boolean
  projectId: number
  existingCaseKeys: Set<string>   // "api_123" | "functional_456"
  onClose: () => void
  onConfirm: (selected: SelectedCase[]) => void
}

function buildModuleTree(modules: Module[]): DataNode[] {
  const all: DataNode = { key: '__all__', title: '全部', icon: <FileTextOutlined /> }
  return [all, ...modules.map((m) => ({ key: m.id, title: m.name, icon: <FolderOutlined /> }))]
}

function buildGroupTree(groups: FuncCaseGroup[]): DataNode[] {
  const all: DataNode = { key: '__all__', title: '全部', icon: <FileTextOutlined /> }
  const buildNode = (g: FuncCaseGroup): DataNode => ({
    key: g.id,
    title: g.name,
    icon: <FolderOutlined />,
    children: g.children?.map(buildNode),
  })
  return [all, ...groups.map(buildNode)]
}

export default function AddCasesModal({ open, projectId, existingCaseKeys, onClose, onConfirm }: Props) {
  const [activeTab, setActiveTab] = useState<'api' | 'functional'>('api')

  // API 用例
  const [apiModules, setApiModules] = useState<Module[]>([])
  const [apiModuleId, setApiModuleId] = useState<number | null>(null)
  const [apiCases, setApiCases] = useState<ApiTestCase[]>([])
  const [apiLoading, setApiLoading] = useState(false)
  const [apiKeyword, setApiKeyword] = useState('')

  // 功能用例
  const [funcGroups, setFuncGroups] = useState<FuncCaseGroup[]>([])
  const [funcGroupId, setFuncGroupId] = useState<number | null>(null)
  const [funcCases, setFuncCases] = useState<FuncTestCase[]>([])
  const [funcLoading, setFuncLoading] = useState(false)
  const [funcKeyword, setFuncKeyword] = useState('')

  // 已选
  const [selectedCases, setSelectedCases] = useState<Map<string, SelectedCase>>(new Map())

  useEffect(() => {
    if (!open) return
    setSelectedCases(new Map())
    loadApiData()
    loadFuncData()
  }, [open, projectId])

  useEffect(() => {
    if (activeTab === 'api') loadApiCases()
  }, [apiModuleId, apiKeyword])

  useEffect(() => {
    if (activeTab === 'functional') loadFuncCases()
  }, [funcGroupId, funcKeyword])

  const loadApiData = async () => {
    const mods = await testcaseApi.listModules(projectId)
    setApiModules(mods)
    loadApiCases()
  }

  const loadApiCases = async () => {
    setApiLoading(true)
    try {
      const res = await testcaseApi.list(projectId, {
        module_id: apiModuleId ?? undefined,
        limit: 200,
      })
      setApiCases(res.items)
    } finally {
      setApiLoading(false)
    }
  }

  const loadFuncData = async () => {
    const groups = await funcCaseApi.listGroups(projectId)
    setFuncGroups(groups)
    loadFuncCases()
  }

  const loadFuncCases = async () => {
    setFuncLoading(true)
    try {
      const res = await funcCaseApi.list(projectId, {
        group_id: funcGroupId ?? undefined,
        keyword: funcKeyword || undefined,
        limit: 200,
      })
      setFuncCases(res.items)
    } finally {
      setFuncLoading(false)
    }
  }

  const toggleCase = (key: string, sc: SelectedCase) => {
    const next = new Map(selectedCases)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.set(key, sc)
    }
    setSelectedCases(next)
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selectedCases.values()))
  }

  const filteredApiCases = apiCases.filter((c) =>
    !apiKeyword || c.name.toLowerCase().includes(apiKeyword.toLowerCase())
  )
  const filteredFuncCases = funcCases.filter((c) =>
    !funcKeyword || c.title.toLowerCase().includes(funcKeyword.toLowerCase())
  )

  return (
    <Modal
      title="添加用例到计划"
      open={open}
      onCancel={onClose}
      onOk={handleConfirm}
      okText={`确认添加（${selectedCases.size}）`}
      cancelText="取消"
      width={820}
      destroyOnClose
    >
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary">已选 <Text strong>{selectedCases.size}</Text> 条用例（灰色表示已在计划中）</Text>
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'api' | 'functional')}
        items={[
          {
            key: 'api',
            label: 'API 测试用例',
            children: (
              <div style={{ display: 'flex', gap: 12 }}>
                {/* 模块树 */}
                <div style={{ width: 160, borderRight: '1px solid #f0f0f0', paddingRight: 8 }}>
                  <Tree
                    treeData={buildModuleTree(apiModules)}
                    defaultSelectedKeys={['__all__']}
                    showIcon
                    onSelect={(keys) => {
                      const k = keys[0]
                      setApiModuleId(k === '__all__' || !k ? null : Number(k))
                    }}
                  />
                </div>
                {/* 用例列表 */}
                <div style={{ flex: 1 }}>
                  <Input.Search
                    placeholder="搜索用例名称"
                    allowClear
                    style={{ marginBottom: 8 }}
                    value={apiKeyword}
                    onChange={(e) => setApiKeyword(e.target.value)}
                  />
                  <Spin spinning={apiLoading}>
                    <Table
                      dataSource={filteredApiCases}
                      rowKey="id"
                      size="small"
                      pagination={{ pageSize: 10 }}
                      columns={[
                        {
                          title: '',
                          width: 36,
                          render: (_: any, record: ApiTestCase) => {
                            const key = `api_${record.id}`
                            const exists = existingCaseKeys.has(key)
                            return (
                              <Checkbox
                                checked={selectedCases.has(key) || exists}
                                disabled={exists}
                                onChange={() => toggleCase(key, {
                                  case_type: 'api',
                                  case_id: record.id,
                                  name: record.name,
                                })}
                              />
                            )
                          },
                        },
                        {
                          title: '用例名称',
                          dataIndex: 'name',
                          render: (name: string, record: ApiTestCase) => (
                            <Space>
                              <Tag color={METHOD_COLORS[record.method] || 'default'} style={{ fontFamily: 'monospace', fontSize: 11 }}>
                                {record.method}
                              </Tag>
                              <Text style={{ fontSize: 13 }}>{name}</Text>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </Spin>
                </div>
              </div>
            ),
          },
          {
            key: 'functional',
            label: '功能测试用例',
            children: (
              <div style={{ display: 'flex', gap: 12 }}>
                {/* 分组树 */}
                <div style={{ width: 160, borderRight: '1px solid #f0f0f0', paddingRight: 8 }}>
                  <Tree
                    treeData={buildGroupTree(funcGroups)}
                    defaultSelectedKeys={['__all__']}
                    showIcon
                    onSelect={(keys) => {
                      const k = keys[0]
                      setFuncGroupId(k === '__all__' || !k ? null : Number(k))
                    }}
                  />
                </div>
                {/* 用例列表 */}
                <div style={{ flex: 1 }}>
                  <Input.Search
                    placeholder="搜索用例标题"
                    allowClear
                    style={{ marginBottom: 8 }}
                    value={funcKeyword}
                    onChange={(e) => setFuncKeyword(e.target.value)}
                  />
                  <Spin spinning={funcLoading}>
                    <Table
                      dataSource={filteredFuncCases}
                      rowKey="id"
                      size="small"
                      pagination={{ pageSize: 10 }}
                      columns={[
                        {
                          title: '',
                          width: 36,
                          render: (_: any, record: FuncTestCase) => {
                            const key = `functional_${record.id}`
                            const exists = existingCaseKeys.has(key)
                            return (
                              <Checkbox
                                checked={selectedCases.has(key) || exists}
                                disabled={exists}
                                onChange={() => toggleCase(key, {
                                  case_type: 'functional',
                                  case_id: record.id,
                                  name: record.title,
                                })}
                              />
                            )
                          },
                        },
                        {
                          title: '用例标题',
                          dataIndex: 'title',
                          render: (title: string, record: FuncTestCase) => (
                            <Space>
                              <Tag color="blue" style={{ fontSize: 11 }}>{record.priority}</Tag>
                              <Text style={{ fontSize: 13 }}>{title}</Text>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </Spin>
                </div>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  )
}
