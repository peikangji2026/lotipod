import { useState } from 'react'
import { Tree, Button, Input, Popconfirm, Space, Typography, Modal, Form } from 'antd'
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  FolderOutlined, FolderOpenOutlined, FileTextOutlined,
} from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import type { FuncCaseGroup } from '@/types'

const { Text } = Typography

interface Props {
  groups: FuncCaseGroup[]
  selectedGroupId: number | null
  onSelect: (groupId: number | null) => void
  onCreate: (name: string, parentId?: number) => Promise<void>
  onRename: (groupId: number, name: string) => Promise<void>
  onDelete: (groupId: number) => Promise<void>
}

function buildTreeNodes(groups: FuncCaseGroup[]): DataNode[] {
  return groups.map((g) => ({
    key: g.id,
    title: g.name,
    icon: (props: any) =>
      props.expanded ? <FolderOpenOutlined /> : <FolderOutlined />,
    children: g.children ? buildTreeNodes(g.children) : [],
  }))
}

export default function GroupTree({ groups, selectedGroupId, onSelect, onCreate, onRename, onDelete }: Props) {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<FuncCaseGroup | null>(null)
  const [form] = Form.useForm()
  const [renameForm] = Form.useForm()

  const allNode: DataNode = {
    key: '__all__',
    title: '全部用例',
    icon: <FileTextOutlined />,
  }

  const handleCreate = async (values: { name: string }) => {
    await onCreate(values.name)
    setCreateModalOpen(false)
    form.resetFields()
  }

  const handleRename = async (values: { name: string }) => {
    if (!renameTarget) return
    await onRename(renameTarget.id, values.name)
    setRenameTarget(null)
    renameForm.resetFields()
  }

  const openRename = (group: FuncCaseGroup, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenameTarget(group)
    renameForm.setFieldsValue({ name: group.name })
  }

  const treeData: DataNode[] = [allNode, ...buildTreeNodes(groups)]

  const titleRender = (node: any): React.ReactNode => {
    if (node.key === '__all__') return <span>{node.title}</span>

    const findGroup = (list: FuncCaseGroup[]): FuncCaseGroup | null => {
      for (const g of list) {
        if (g.id === node.key) return g
        if (g.children) {
          const found = findGroup(g.children)
          if (found) return found
        }
      }
      return null
    }
    const group = findGroup(groups)

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.title}</span>
        {group && (
          <Space size={0} style={{ opacity: 0, transition: 'opacity 0.2s' }} className="tree-node-actions">
            <Button
              type="text" size="small" icon={<EditOutlined style={{ fontSize: 11 }} />}
              onClick={(e) => openRename(group, e)}
            />
            <Popconfirm
              title="删除分组后其下用例将变为未分类，确认？"
              onConfirm={(e) => { e?.stopPropagation(); onDelete(group.id) }}
              okText="删除" okType="danger" cancelText="取消"
            >
              <Button
                type="text" size="small" danger
                icon={<DeleteOutlined style={{ fontSize: 11 }} />}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          </Space>
        )}
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
        <Text strong style={{ fontSize: 13 }}>分组</Text>
        <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)} />
      </div>

      <style>{`
        .ant-tree-node-content-wrapper:hover .tree-node-actions { opacity: 1 !important; }
      `}</style>

      <Tree
        treeData={treeData}
        defaultSelectedKeys={['__all__']}
        selectedKeys={selectedGroupId === null ? ['__all__'] : [selectedGroupId]}
        showIcon
        blockNode
        onSelect={(keys) => {
          const key = keys[0]
          if (!key || key === '__all__') {
            onSelect(null)
          } else {
            onSelect(Number(key))
          }
        }}
        titleRender={titleRender}
      />

      {/* 新建分组 */}
      <Modal
        title="新建分组"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        okText="创建" cancelText="取消"
        width={360}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="分组名称" rules={[{ required: true, message: '请输入分组名称' }]}>
            <Input placeholder="如：登录模块、用户管理" autoFocus />
          </Form.Item>
        </Form>
      </Modal>

      {/* 重命名 */}
      <Modal
        title="重命名分组"
        open={!!renameTarget}
        onCancel={() => { setRenameTarget(null); renameForm.resetFields() }}
        onOk={() => renameForm.submit()}
        okText="保存" cancelText="取消"
        width={360}
        destroyOnClose
      >
        <Form form={renameForm} layout="vertical" onFinish={handleRename} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="分组名称" rules={[{ required: true }]}>
            <Input autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
