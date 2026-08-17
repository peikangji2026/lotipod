import { useEffect, useState } from 'react'
import {
  Tabs, Button, Table, Tag, Modal, Form, Input, Select,
  Space, Typography, App, Popconfirm, Card, Descriptions,
  Spin, Row, Col,
} from 'antd'
import {
  ArrowLeftOutlined, PlusOutlined, DeleteOutlined,
  EditOutlined, GlobalOutlined, TeamOutlined, SettingOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { projectApi, type MemberAddPayload, type EnvironmentPayload } from '@/services/project'
import type { Project, ProjectMember, Environment } from '@/types'

const { Title, Text } = Typography

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'members'
  const navigate = useNavigate()
  const { message } = App.useApp()

  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [loading, setLoading] = useState(true)

  // 成员弹窗
  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [memberForm] = Form.useForm()
  const [memberSubmitting, setMemberSubmitting] = useState(false)

  // 环境弹窗
  const [envModalOpen, setEnvModalOpen] = useState(false)
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null)
  const [envForm] = Form.useForm()
  const [envSubmitting, setEnvSubmitting] = useState(false)

  const id = Number(projectId)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [proj, mems, envs] = await Promise.all([
        projectApi.get(id),
        projectApi.listMembers(id),
        projectApi.listEnvironments(id),
      ])
      setProject(proj)
      setMembers(mems)
      setEnvironments(envs)
    } catch {
      message.error('加载项目数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [id])

  // ===== 成员操作 =====

  const handleAddMember = async (values: MemberAddPayload) => {
    setMemberSubmitting(true)
    try {
      await projectApi.addMember(id, values)
      message.success('成员添加成功')
      setMemberModalOpen(false)
      memberForm.resetFields()
      const mems = await projectApi.listMembers(id)
      setMembers(mems)
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '添加失败')
    } finally {
      setMemberSubmitting(false)
    }
  }

  const handleRemoveMember = async (userId: number) => {
    try {
      await projectApi.removeMember(id, userId)
      message.success('成员已移除')
      setMembers((prev) => prev.filter((m) => m.user_id !== userId))
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '移除失败')
    }
  }

  // ===== 环境操作 =====

  const openEnvModal = (env?: Environment) => {
    setEditingEnv(env || null)
    if (env) {
      envForm.setFieldsValue({
        name: env.name,
        base_url: env.base_url,
        variables: JSON.stringify(env.variables || {}, null, 2),
        headers: JSON.stringify(env.headers || {}, null, 2),
      })
    } else {
      envForm.resetFields()
    }
    setEnvModalOpen(true)
  }

  const handleEnvSubmit = async (values: any) => {
    setEnvSubmitting(true)
    try {
      const payload: EnvironmentPayload = {
        name: values.name,
        base_url: values.base_url,
        variables: values.variables ? JSON.parse(values.variables) : {},
        headers: values.headers ? JSON.parse(values.headers) : {},
      }

      if (editingEnv) {
        await projectApi.updateEnvironment(editingEnv.id, payload)
        message.success('环境更新成功')
      } else {
        await projectApi.createEnvironment(id, payload)
        message.success('环境创建成功')
      }

      setEnvModalOpen(false)
      const envs = await projectApi.listEnvironments(id)
      setEnvironments(envs)
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        message.error('变量或请求头格式错误，请输入有效的 JSON')
      } else {
        message.error(err?.response?.data?.detail || '操作失败')
      }
    } finally {
      setEnvSubmitting(false)
    }
  }

  const handleDeleteEnv = async (envId: number) => {
    try {
      await projectApi.deleteEnvironment(envId)
      message.success('环境已删除')
      setEnvironments((prev) => prev.filter((e) => e.id !== envId))
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '删除失败')
    }
  }

  const roleColors: Record<string, string> = {
    owner: 'gold', admin: 'blue', member: 'green', viewer: 'default',
  }
  const roleLabels: Record<string, string> = {
    owner: '创建者', admin: '管理员', member: '成员', viewer: '只读',
  }

  const memberColumns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '姓名', dataIndex: 'full_name', key: 'full_name', render: (v: string) => v || '-' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={roleColors[role] || 'default'}>{roleLabels[role] || role}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ProjectMember) =>
        record.role !== 'owner' ? (
          <Popconfirm
            title="确认移除该成员？"
            onConfirm={() => handleRemoveMember(record.user_id)}
            okText="移除"
            okType="danger"
            cancelText="取消"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              移除
            </Button>
          </Popconfirm>
        ) : null,
    },
  ]

  const envColumns = [
    { title: '环境名称', dataIndex: 'name', key: 'name' },
    {
      title: 'Base URL',
      dataIndex: 'base_url',
      key: 'base_url',
      render: (v: string) => (
        <Text copyable style={{ fontSize: 13 }}>{v || '-'}</Text>
      ),
    },
    {
      title: '变量数量',
      key: 'vars',
      render: (_: any, r: Environment) => Object.keys(r.variables || {}).length,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Environment) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEnvModal(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该环境？"
            onConfirm={() => handleDeleteEnv(record.id)}
            okText="删除"
            okType="danger"
            cancelText="取消"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Spin spinning={loading}>
      {/* 顶部导航 */}
      <div style={{ marginBottom: 24 }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/projects')}
          style={{ padding: 0, marginBottom: 8 }}
        >
          返回项目列表
        </Button>
        <Title level={4} style={{ margin: 0 }}>{project?.name}</Title>
        {project?.description && (
          <Text type="secondary">{project.description}</Text>
        )}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setSearchParams({ tab: key })}
        items={[
          {
            key: 'members',
            label: <span><TeamOutlined /> 成员管理</span>,
            children: (
              <Card
                extra={
                  <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setMemberModalOpen(true)}>
                    添加成员
                  </Button>
                }
                title={`成员列表（${members.length} 人）`}
              >
                <Table
                  dataSource={members}
                  columns={memberColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              </Card>
            ),
          },
          {
            key: 'environments',
            label: <span><SettingOutlined /> 环境配置</span>,
            children: (
              <Card
                extra={
                  <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openEnvModal()}>
                    添加环境
                  </Button>
                }
                title={`环境列表（${environments.length} 个）`}
              >
                <Table
                  dataSource={environments}
                  columns={envColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              </Card>
            ),
          },
        ]}
      />

      {/* 添加成员弹窗 */}
      <Modal
        title="添加成员"
        open={memberModalOpen}
        onCancel={() => { setMemberModalOpen(false); memberForm.resetFields() }}
        onOk={() => memberForm.submit()}
        confirmLoading={memberSubmitting}
        okText="添加"
        cancelText="取消"
        width={420}
        destroyOnClose
      >
        <Form form={memberForm} layout="vertical" onFinish={handleAddMember} style={{ marginTop: 16 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="请输入要添加的用户名" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="member" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'admin', label: '管理员' },
                { value: 'member', label: '成员' },
                { value: 'viewer', label: '只读' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建/编辑环境弹窗 */}
      <Modal
        title={editingEnv ? '编辑环境' : '添加环境'}
        open={envModalOpen}
        onCancel={() => { setEnvModalOpen(false); envForm.resetFields() }}
        onOk={() => envForm.submit()}
        confirmLoading={envSubmitting}
        okText={editingEnv ? '保存' : '创建'}
        cancelText="取消"
        width={560}
        destroyOnClose
      >
        <Form form={envForm} layout="vertical" onFinish={handleEnvSubmit} style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="name" label="环境名称" rules={[{ required: true, message: '请输入环境名称' }]}>
                <Input placeholder="如 dev / test / prod" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="base_url" label="Base URL" rules={[{ required: true, message: '请输入 Base URL' }]}>
                <Input placeholder="https://api.example.com" prefix={<GlobalOutlined />} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="variables"
            label="环境变量（JSON 格式）"
            initialValue="{}"
            rules={[
              {
                validator: (_, value) => {
                  try { JSON.parse(value || '{}'); return Promise.resolve() }
                  catch { return Promise.reject('请输入有效的 JSON 格式') }
                },
              },
            ]}
          >
            <Input.TextArea
              rows={4}
              placeholder={'{\n  "API_KEY": "your-key",\n  "TOKEN": "your-token"\n}'}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </Form.Item>

          <Form.Item
            name="headers"
            label="默认请求头（JSON 格式）"
            initialValue="{}"
            rules={[
              {
                validator: (_, value) => {
                  try { JSON.parse(value || '{}'); return Promise.resolve() }
                  catch { return Promise.reject('请输入有效的 JSON 格式') }
                },
              },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder={'{\n  "Authorization": "Bearer xxx"\n}'}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Spin>
  )
}
