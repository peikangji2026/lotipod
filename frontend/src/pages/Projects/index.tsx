import { useEffect, useState } from 'react'
import {
  Row, Col, Card, Button, Modal, Form, Input, Typography,
  Space, Tag, Dropdown, App, Empty, Spin,
} from 'antd'
import {
  PlusOutlined, ProjectOutlined, MoreOutlined,
  EditOutlined, DeleteOutlined, TeamOutlined, SettingOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { projectApi, type ProjectCreatePayload } from '@/services/project'
import type { Project } from '@/types'

const { Title, Text, Paragraph } = Typography

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const data = await projectApi.list()
      setProjects(data)
    } catch {
      message.error('获取项目列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProjects() }, [])

  const openCreateModal = () => {
    setEditingProject(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEditModal = (project: Project) => {
    setEditingProject(project)
    form.setFieldsValue({ name: project.name, description: project.description })
    setModalOpen(true)
  }

  const handleSubmit = async (values: ProjectCreatePayload) => {
    setSubmitting(true)
    try {
      if (editingProject) {
        await projectApi.update(editingProject.id, values)
        message.success('项目更新成功')
      } else {
        await projectApi.create(values)
        message.success('项目创建成功')
      }
      setModalOpen(false)
      fetchProjects()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (project: Project) => {
    modal.confirm({
      title: '确认删除项目',
      content: `删除后项目「${project.name}」及其所有数据将不可恢复，确认删除？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await projectApi.delete(project.id)
          message.success('项目已删除')
          fetchProjects()
        } catch (err: any) {
          message.error(err?.response?.data?.detail || '删除失败')
        }
      },
    })
  }

  return (
    <div>
      {/* 页面头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>项目管理</Title>
          <Text type="secondary">共 {projects.length} 个项目</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          新建项目
        </Button>
      </div>

      <Spin spinning={loading}>
        {projects.length === 0 && !loading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无项目，点击「新建项目」开始"
            style={{ marginTop: 80 }}
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新建项目
            </Button>
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {projects.map((project) => (
              <Col key={project.id} xs={24} sm={12} lg={8} xl={6}>
                <Card
                  hoverable
                  style={{ height: '100%' }}
                  styles={{ body: { padding: '20px' } }}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  extra={
                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: 'edit',
                            icon: <EditOutlined />,
                            label: '编辑',
                            onClick: (e) => { e.domEvent.stopPropagation(); openEditModal(project) },
                          },
                          {
                            key: 'members',
                            icon: <TeamOutlined />,
                            label: '成员管理',
                            onClick: (e) => { e.domEvent.stopPropagation(); navigate(`/projects/${project.id}?tab=members`) },
                          },
                          {
                            key: 'envs',
                            icon: <SettingOutlined />,
                            label: '环境配置',
                            onClick: (e) => { e.domEvent.stopPropagation(); navigate(`/projects/${project.id}?tab=environments`) },
                          },
                          { type: 'divider' },
                          {
                            key: 'delete',
                            icon: <DeleteOutlined />,
                            label: '删除项目',
                            danger: true,
                            onClick: (e) => { e.domEvent.stopPropagation(); handleDelete(project) },
                          },
                        ],
                      }}
                      trigger={['click']}
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<MoreOutlined />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Dropdown>
                  }
                >
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    <Space>
                      <ProjectOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                      <Text strong style={{ fontSize: 15 }}>{project.name}</Text>
                    </Space>

                    <Paragraph
                      type="secondary"
                      ellipsis={{ rows: 2 }}
                      style={{ margin: 0, minHeight: 40 }}
                    >
                      {project.description || '暂无描述'}
                    </Paragraph>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Tag color={project.is_active ? 'success' : 'default'}>
                        {project.is_active ? '活跃' : '已归档'}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(project.created_at).format('YYYY-MM-DD')}
                      </Text>
                    </div>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingProject ? '编辑项目' : '新建项目'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editingProject ? '保存' : '创建'}
        cancelText="取消"
        width={480}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="项目名称"
            rules={[
              { required: true, message: '请输入项目名称' },
              { max: 100, message: '名称不超过 100 个字符' },
            ]}
          >
            <Input placeholder="例如：用户中心 API 测试" />
          </Form.Item>

          <Form.Item name="description" label="项目描述">
            <Input.TextArea
              placeholder="简短描述项目用途（选填）"
              rows={3}
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
