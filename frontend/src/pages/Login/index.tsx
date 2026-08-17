import { useState } from 'react'
import { Form, Input, Button, Card, Tabs, Typography, App, Divider } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { authApi, type LoginPayload, type RegisterPayload } from '@/services/auth'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography

export default function Login() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { message } = App.useApp()

  const handleLogin = async (values: LoginPayload) => {
    setLoading(true)
    try {
      const res = await authApi.login(values)
      localStorage.setItem('access_token', res.access_token)
      localStorage.setItem('refresh_token', res.refresh_token)
      setAuth(res.access_token, res.user)
      message.success(`欢迎回来，${res.user.full_name || res.user.username}！`)
      navigate('/', { replace: true })
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (values: RegisterPayload & { confirm_password: string }) => {
    setLoading(true)
    try {
      const { confirm_password, ...payload } = values
      const res = await authApi.register(payload)
      localStorage.setItem('access_token', res.access_token)
      localStorage.setItem('refresh_token', res.refresh_token)
      setAuth(res.access_token, res.user)
      message.success('注册成功，欢迎使用测试平台！')
      navigate('/', { replace: true })
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '注册失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 50%, #f9f0ff 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <Card
        style={{ width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}
        styles={{ body: { padding: '40px 40px 32px' } }}
      >
        {/* Logo + 标题 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <PlayCircleOutlined style={{ fontSize: 40, color: '#1677ff' }} />
          <Title level={3} style={{ margin: '12px 0 4px' }}>
            测试平台
          </Title>
          <Text type="secondary">企业级 API 测试管理平台</Text>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'login' | 'register')}
          centered
          items={[
            { key: 'login', label: '登录' },
            { key: 'register', label: '注册' },
          ]}
          style={{ marginBottom: 24 }}
        />

        {/* 登录表单 */}
        {activeTab === 'login' && (
          <Form layout="vertical" onFinish={handleLogin} size="large" requiredMark={false}>
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block loading={loading}>
                登录
              </Button>
            </Form.Item>

            <Divider plain>
              <Text type="secondary" style={{ fontSize: 12 }}>
                还没有账号？
                <Button type="link" size="small" onClick={() => setActiveTab('register')} style={{ padding: '0 4px' }}>
                  立即注册
                </Button>
              </Text>
            </Divider>
          </Form>
        )}

        {/* 注册表单 */}
        {activeTab === 'register' && (
          <Form layout="vertical" onFinish={handleRegister} size="large" requiredMark={false}>
            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少 3 个字符' },
                { pattern: /^[a-zA-Z0-9_]+$/, message: '只能包含字母、数字和下划线' },
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="用户名（字母/数字/下划线）" />
            </Form.Item>

            <Form.Item
              name="full_name"
              rules={[{ required: false }]}
            >
              <Input prefix={<UserOutlined />} placeholder="姓名（选填）" />
            </Form.Item>

            <Form.Item
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="邮箱" autoComplete="email" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少 6 位' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码（至少 6 位）"
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item
              name="confirm_password"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('两次密码输入不一致'))
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="确认密码"
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block loading={loading}>
                注册
              </Button>
            </Form.Item>

            <Divider plain>
              <Text type="secondary" style={{ fontSize: 12 }}>
                已有账号？
                <Button type="link" size="small" onClick={() => setActiveTab('login')} style={{ padding: '0 4px' }}>
                  立即登录
                </Button>
              </Text>
            </Divider>
          </Form>
        )}
      </Card>
    </div>
  )
}
