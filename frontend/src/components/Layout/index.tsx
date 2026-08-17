import { useState, useEffect } from 'react'
import { Layout, Menu, Avatar, Dropdown, Typography, theme, Select, Space } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  ProjectOutlined,
  FileTextOutlined,
  CheckSquareOutlined,
  PlayCircleOutlined,
  BarChartOutlined,
  CalendarOutlined,
  AuditOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'

const { Sider, Header, Content } = Layout
const { Text } = Typography
const { Option } = Select

const menuItems = [
  {
    key: '/dashboard',
    icon: <BarChartOutlined />,
    label: '测试概览',
  },
  {
    key: 'testcase-group',
    label: '测试用例',
    icon: <FileTextOutlined />,
    children: [
      {
        key: '/testcases',
        icon: <FileTextOutlined />,
        label: '接口用例',
      },
      {
        key: '/func-cases',
        icon: <CheckSquareOutlined />,
        label: '功能用例',
      },
    ],
  },
  {
    key: '/case-reviews',
    icon: <AuditOutlined />,
    label: '用例评审',
  },
  {
    key: '/test-plans',
    icon: <CalendarOutlined />,
    label: '测试计划',
  },
  {
    key: '/reports',
    icon: <BarChartOutlined />,
    label: '测试报告',
  },
  {
    key: '/projects',
    icon: <ProjectOutlined />,
    label: '项目管理',
  }
]

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clearAuth } = useAuthStore()
  const { token: designToken } = theme.useToken()
  const { projects, selectedProjectId, setSelectedProjectId, loadProjects } = useProjectStore()

  useEffect(() => { loadProjects() }, [])

  // 是否在「项目管理」相关页面（不显示项目选择器）
  const isProjectPage = location.pathname.startsWith('/projects')

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ]

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      clearAuth()
      navigate('/login')
    }
  }

  const pathSegment = '/' + location.pathname.split('/')[1]
  const selectedKey = pathSegment

  const openKeys = ['/testcases', '/func-cases'].includes(pathSegment)
    ? ['testcase-group']
    : []

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        style={{
          background: designToken.colorBgContainer,
          borderRight: `1px solid ${designToken.colorBorderSecondary}`,
        }}
      >
        {/* Logo 区域 */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 20px',
            borderBottom: `1px solid ${designToken.colorBorderSecondary}`,
            gap: 8,
          }}
        >
          <PlayCircleOutlined style={{ fontSize: 22, color: designToken.colorPrimary }} />
          {!collapsed && (
            <Text strong style={{ fontSize: 16, color: designToken.colorPrimary }}>
              测试平台
            </Text>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={openKeys}
          items={menuItems}
          style={{ borderRight: 0, marginTop: 8 }}
          onClick={({ key }) => {
            if (key !== 'testcase-group') navigate(key)
          }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: designToken.colorBgContainer,
            borderBottom: `1px solid ${designToken.colorBorderSecondary}`,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* 折叠按钮 */}
          <div
            onClick={() => setCollapsed(!collapsed)}
            style={{ cursor: 'pointer', fontSize: 16, color: designToken.colorTextSecondary }}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>

          {/* 右侧：项目选择器 + 用户信息 */}
          <Space size={16}>
            {!isProjectPage && (
              <Space size={8}>
                <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>当前项目</Text>
                <Select
                  value={selectedProjectId}
                  style={{ width: 200 }}
                  placeholder="请选择项目"
                  onChange={setSelectedProjectId}
                  size="small"
                >
                  {projects.map((p) => (
                    <Option key={p.id} value={p.id}>{p.name}</Option>
                  ))}
                </Select>
              </Space>
            )}

            <Dropdown
              menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
              placement="bottomRight"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} style={{ background: designToken.colorPrimary }} />
                <Text>{user?.full_name || user?.username || '用户'}</Text>
              </div>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            margin: 24,
            padding: 24,
            background: designToken.colorBgContainer,
            borderRadius: designToken.borderRadiusLG,
            minHeight: 'calc(100vh - 64px - 48px)',
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
