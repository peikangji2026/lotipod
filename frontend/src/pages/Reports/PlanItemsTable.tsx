import { useState } from 'react'
import { Table, Tag, Select, Space, Typography, Input } from 'antd'
import type { PlanReportItem } from '@/services/report'

const { Text } = Typography
const { Option } = Select

const RESULT_CONFIG: Record<string, { color: string; label: string }> = {
  passed:  { color: 'success', label: '通过' },
  failed:  { color: 'error',   label: '失败' },
  blocked: { color: 'warning', label: '阻塞' },
  skipped: { color: 'default', label: '跳过' },
  pending: { color: 'default', label: '待执行' },
}

const PRIORITY_CONFIG: Record<string, string> = {
  P0: 'red', P1: 'orange', P2: 'blue', P3: 'default',
}

interface Props {
  items: PlanReportItem[]
}

export default function PlanItemsTable({ items }: Props) {
  const [filterType, setFilterType] = useState<string>('all')
  const [filterResult, setFilterResult] = useState<string>('all')
  const [keyword, setKeyword] = useState('')

  const filtered = items.filter((item) => {
    if (filterType !== 'all' && item.case_type !== filterType) return false
    if (filterResult !== 'all' && item.result !== filterResult) return false
    if (keyword && !item.case_name.toLowerCase().includes(keyword.toLowerCase())) return false
    return true
  })

  const columns = [
    {
      title: '类型',
      dataIndex: 'case_type',
      key: 'case_type',
      width: 70,
      render: (t: string) => (
        <Tag color={t === 'api' ? 'blue' : 'green'} style={{ fontSize: 11 }}>
          {t === 'api' ? 'API' : '功能'}
        </Tag>
      ),
    },
    {
      title: '用例名称',
      dataIndex: 'case_name',
      key: 'case_name',
      render: (name: string) => <Text style={{ fontSize: 13 }}>{name}</Text>,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 70,
      render: (p: string) => (
        <Tag color={PRIORITY_CONFIG[p] || 'default'} style={{ fontSize: 11 }}>{p || '-'}</Tag>
      ),
    },
    {
      title: '执行结果',
      dataIndex: 'result',
      key: 'result',
      width: 90,
      render: (r: string) => {
        const conf = RESULT_CONFIG[r] || { color: 'default', label: r }
        return <Tag color={conf.color}>{conf.label}</Tag>
      },
    },
    {
      title: '备注',
      dataIndex: 'comment',
      key: 'comment',
      render: (c: string) => c ? <Text type="secondary" style={{ fontSize: 12 }}>{c}</Text> : '-',
    },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 12 }} wrap>
        <Select value={filterType} style={{ width: 110 }} onChange={setFilterType} size="small">
          <Option value="all">全部类型</Option>
          <Option value="api">API 用例</Option>
          <Option value="functional">功能用例</Option>
        </Select>
        <Select value={filterResult} style={{ width: 110 }} onChange={setFilterResult} size="small">
          <Option value="all">全部结果</Option>
          <Option value="passed">通过</Option>
          <Option value="failed">失败</Option>
          <Option value="blocked">阻塞</Option>
          <Option value="skipped">跳过</Option>
          <Option value="pending">待执行</Option>
        </Select>
        <Input.Search
          placeholder="搜索用例名称"
          style={{ width: 180 }}
          size="small"
          onSearch={setKeyword}
          onChange={(e) => !e.target.value && setKeyword('')}
          allowClear
        />
        <Text type="secondary" style={{ fontSize: 12 }}>共 {filtered.length} 条</Text>
      </Space>
      <Table
        dataSource={filtered}
        columns={columns}
        rowKey={(r) => `${r.case_type}-${r.case_id}`}
        size="small"
        pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 条` }}
      />
    </div>
  )
}
