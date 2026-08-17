import { useEffect, useState, useRef } from 'react'
import {
  Layout, Table, Button, Tag, Space, Typography, App, Select,
  Tooltip, Popconfirm, Upload, Empty, Spin, Row, Col, Input,
  Segmented,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  ImportOutlined, ExportOutlined, BranchesOutlined, UnorderedListOutlined,
} from '@ant-design/icons'
import type { UploadProps } from 'antd'
import type { FuncCaseGroup, FuncTestCase } from '@/types'
import { funcCaseApi, type FuncCasePayload } from '@/services/functionalCase'
import { useProjectStore } from '@/stores/projectStore'
import GroupTree from './GroupTree'
import CaseDrawer from './CaseDrawer'
import MindMapView from './MindMapView'

const { Sider, Content } = Layout
const { Title, Text } = Typography
const { Option } = Select

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  P0: { color: 'red', label: 'P0' },
  P1: { color: 'orange', label: 'P1' },
  P2: { color: 'blue', label: 'P2' },
  P3: { color: 'default', label: 'P3' },
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  pending_review: { color: 'processing', label: '待评审' },
  approved: { color: 'success', label: '已通过' },
  deprecated: { color: 'warning', label: '废弃' },
}

type ViewMode = 'list' | 'mindmap'

export default function FunctionalCases() {
  const { message } = App.useApp()
  const { selectedProjectId } = useProjectStore()

  const [groups, setGroups] = useState<FuncCaseGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  const [cases, setCases] = useState<FuncTestCase[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [filterPriority, setFilterPriority] = useState<string | undefined>()
  const [filterStatus, setFilterStatus] = useState<string | undefined>()
  const [keyword, setKeyword] = useState('')

  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingCase, setEditingCase] = useState<FuncTestCase | null>(null)

  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])

  // ===== 初始化 =====
  useEffect(() => {
    if (selectedProjectId) {
      setSelectedGroupId(null)
      loadGroups()
      loadCases()
    }
  }, [selectedProjectId, selectedGroupId, filterPriority, filterStatus, keyword])

  const loadGroups = async () => {
    if (!selectedProjectId) return
    try {
      const list = await funcCaseApi.listGroups(selectedProjectId)
      setGroups(list)
    } catch {
      message.error('获取分组失败')
    }
  }

  const loadCases = async () => {
    if (!selectedProjectId) return
    setLoading(true)
    try {
      const res = await funcCaseApi.list(selectedProjectId, {
        group_id: selectedGroupId ?? undefined,
        priority: filterPriority,
        status: filterStatus,
        keyword: keyword || undefined,
      })
      setCases(res.items)
      setTotal(res.total)
    } catch {
      message.error('获取用例列表失败')
    } finally {
      setLoading(false)
    }
  }

  // ===== 分组操作 =====
  const handleCreateGroup = async (name: string) => {
    if (!selectedProjectId) return
    await funcCaseApi.createGroup(selectedProjectId, { name })
    message.success('分组已创建')
    loadGroups()
  }

  const handleRenameGroup = async (groupId: number, name: string) => {
    await funcCaseApi.updateGroup(groupId, { name })
    message.success('分组已重命名')
    loadGroups()
  }

  const handleDeleteGroup = async (groupId: number) => {
    await funcCaseApi.deleteGroup(groupId)
    message.success('分组已删除')
    if (selectedGroupId === groupId) setSelectedGroupId(null)
    loadGroups()
    loadCases()
  }

  // ===== 用例操作 =====
  const openCreateDrawer = () => {
    setEditingCase(null)
    setDrawerOpen(true)
  }

  const openEditDrawer = async (caseId: number) => {
    try {
      const tc = await funcCaseApi.get(caseId)
      setEditingCase(tc)
      setDrawerOpen(true)
    } catch {
      message.error('获取用例详情失败')
    }
  }

  const handleSaveCase = async (values: any, steps: any[]) => {
    if (!selectedProjectId) return
    const payload: FuncCasePayload = {
      ...values,
      group_id: values.group_id || null,
      steps,
    }
    if (editingCase) {
      await funcCaseApi.update(editingCase.id, payload)
      message.success('用例已更新')
    } else {
      await funcCaseApi.create(selectedProjectId, payload)
      message.success('用例已创建')
    }
    setDrawerOpen(false)
    loadCases()
  }

  const handleDeleteCase = async (caseId: number) => {
    await funcCaseApi.delete(caseId)
    message.success('用例已删除')
    loadCases()
  }

  const handleBatchDelete = async () => {
    if (!selectedProjectId || selectedRowKeys.length === 0) return
    await funcCaseApi.batchUpdate(selectedProjectId, {
      case_ids: selectedRowKeys,
      action: 'delete',
    })
    message.success(`已删除 ${selectedRowKeys.length} 条用例`)
    setSelectedRowKeys([])
    loadCases()
  }

  // ===== XMind =====
  const handleImportXmind: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    if (!selectedProjectId) return
    try {
      const result: any = await funcCaseApi.importXmind(selectedProjectId, file as File)
      message.success(`导入成功：新建分组 ${result.groups_created}，新建用例 ${result.cases_created}`)
      loadGroups()
      loadCases()
      onSuccess?.(result)
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'XMind 导入失败')
      onError?.(err)
    }
  }

  const handleExportXmind = () => {
    if (!selectedProjectId) return
    const token = localStorage.getItem('access_token')
    const url = funcCaseApi.exportXmindUrl(selectedProjectId)
    // 带 token 下载
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `func_cases_${selectedProjectId}.xmind`
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .catch(() => message.error('导出失败'))
  }

  // ===== 表格列 =====
  const columns = [
    {
      title: '用例标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 70,
      render: (p: string) => {
        const conf = PRIORITY_CONFIG[p] || { color: 'default', label: p }
        return <Tag color={conf.color}>{conf.label}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string) => {
        const conf = STATUS_CONFIG[s] || { color: 'default', label: s }
        return <Tag color={conf.color}>{conf.label}</Tag>
      },
    },
    {
      title: '步骤数',
      dataIndex: 'steps',
      key: 'steps',
      width: 70,
      render: (steps: any[]) => <Text type="secondary">{(steps || []).length}</Text>,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space size={4} wrap>
          {(tags || []).map((t) => <Tag key={t} style={{ margin: 0 }}>{t}</Tag>)}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: FuncTestCase) => (
        <Space size={0}>
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
        <Title level={4} style={{ marginBottom: 16 }}>功能测试用例</Title>
        <Empty description="请在顶部选择项目" style={{ paddingTop: 60 }} />
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部操作栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space wrap>
          <Title level={4} style={{ margin: 0 }}>功能测试用例</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>共 {total} 条</Text>
        </Space>

        <Space>
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            options={[
              { value: 'list', icon: <UnorderedListOutlined />, label: '列表' },
              { value: 'mindmap', icon: <BranchesOutlined />, label: '脑图' },
            ]}
          />
          <Upload
            accept=".xmind"
            showUploadList={false}
            customRequest={handleImportXmind}
          >
            <Button icon={<ImportOutlined />}>导入 XMind</Button>
          </Upload>
          <Tooltip title="导出全部用例为 .xmind 文件">
            <Button icon={<ExportOutlined />} onClick={handleExportXmind}>导出 XMind</Button>
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateDrawer}>
            新建用例
          </Button>
        </Space>
      </div>

      <Layout style={{ background: 'transparent', gap: 12, flex: 1, minHeight: 0 }}>
        {/* 左侧分组树 */}
        <Sider
          width={200}
          style={{ background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0', padding: 8, overflowY: 'auto' }}
        >
          <GroupTree
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelect={setSelectedGroupId}
            onCreate={handleCreateGroup}
            onRename={handleRenameGroup}
            onDelete={handleDeleteGroup}
          />
        </Sider>

        {/* 右侧内容区 */}
        <Content style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {viewMode === 'list' ? (
            <>
              {/* 过滤栏 */}
              <Row gutter={8} style={{ marginBottom: 8 }}>
                <Col flex="1">
                  <Input.Search
                    placeholder="搜索用例标题"
                    allowClear
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onSearch={() => loadCases()}
                  />
                </Col>
                <Col>
                  <Select
                    allowClear placeholder="优先级"
                    style={{ width: 100 }}
                    value={filterPriority}
                    onChange={setFilterPriority}
                  >
                    <Option value="P0">P0</Option>
                    <Option value="P1">P1</Option>
                    <Option value="P2">P2</Option>
                    <Option value="P3">P3</Option>
                  </Select>
                </Col>
                <Col>
                  <Select
                    allowClear placeholder="状态"
                    style={{ width: 110 }}
                    value={filterStatus}
                    onChange={setFilterStatus}
                  >
                    <Option value="draft">草稿</Option>
                    <Option value="pending_review">待评审</Option>
                    <Option value="approved">已通过</Option>
                    <Option value="deprecated">废弃</Option>
                  </Select>
                </Col>
                {selectedRowKeys.length > 0 && (
                  <Col>
                    <Popconfirm
                      title={`确认批量删除 ${selectedRowKeys.length} 条用例？`}
                      onConfirm={handleBatchDelete}
                      okText="删除" okType="danger" cancelText="取消"
                    >
                      <Button danger size="small">批量删除 ({selectedRowKeys.length})</Button>
                    </Popconfirm>
                  </Col>
                )}
              </Row>

              <Spin spinning={loading}>
                <Table
                  dataSource={cases}
                  columns={columns}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
                  rowSelection={{
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys as number[]),
                  }}
                  locale={{ emptyText: <Empty description="暂无用例，点击「新建用例」创建" /> }}
                />
              </Spin>
            </>
          ) : (
            <div style={{ flex: 1, minHeight: 0 }}>
              <MindMapView projectId={selectedProjectId} />
            </div>
          )}
        </Content>
      </Layout>

      <CaseDrawer
        open={drawerOpen}
        editingCase={editingCase}
        groups={groups}
        selectedGroupId={selectedGroupId}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSaveCase}
      />
    </div>
  )
}
