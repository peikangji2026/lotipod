import { useEffect, useRef, useState } from 'react'
import { Button, Space, Spin, App, Typography } from 'antd'
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons'
import MindElixir from 'mind-elixir'
import type { MindElixirInstance, MindElixirData } from 'mind-elixir'
import type { MindMapNode } from '@/types'
import { funcCaseApi } from '@/services/functionalCase'

const { Text } = Typography

interface Props {
  projectId: number
  onClose?: () => void
}

// 将后端树结构转换为 mind-elixir 格式
function backendToMindElixir(nodes: MindMapNode[]): MindElixirData {
  let idCounter = 1

  function convertNode(node: MindMapNode): any {
    const id = node.id ? `${node.node_type}_${node.id}` : `new_${idCounter++}`
    return {
      id,
      topic: node.title,
      style: node.node_type === 'group'
        ? { background: '#e6f4ff', color: '#1677ff' }
        : { background: '#f6ffed', color: '#389e0d' },
      children: (node.children || []).map(convertNode),
    }
  }

  return {
    nodeData: {
      id: 'root',
      topic: '功能测试用例',
      children: nodes.map(convertNode),
    },
  }
}

// 将 mind-elixir 格式转换回后端树结构
function mindElixirToBackend(data: MindElixirData): MindMapNode[] {
  function convertNode(node: any, depth: number): MindMapNode {
    const isGroup = node.id?.startsWith('group_') || (depth === 0 && (node.children?.length ?? 0) > 0)
    const existingId = node.id && !node.id.startsWith('new_')
      ? parseInt(node.id.split('_')[1])
      : undefined

    return {
      id: existingId,
      node_type: isGroup ? 'group' : 'case',
      title: node.topic,
      children: (node.children || []).map((c: any) => convertNode(c, depth + 1)),
    }
  }

  return (data.nodeData.children || []).map((n: any) => convertNode(n, 0))
}

export default function MindMapView({ projectId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mindRef = useRef<MindElixirInstance | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { message } = App.useApp()

  const loadData = async () => {
    setLoading(true)
    try {
      const nodes = await funcCaseApi.getMindMapTree(projectId)
      if (!containerRef.current) return

      if (mindRef.current) {
        mindRef.current.refresh(backendToMindElixir(nodes))
      } else {
        const mind = new MindElixir({
          el: containerRef.current,
          direction: MindElixir.RIGHT,
          draggable: true,
          contextMenu: true,
          toolBar: true,
          keypress: true,
          locale: 'zh_CN',
        })
        mind.init(backendToMindElixir(nodes))
        mindRef.current = mind
      }
    } catch {
      message.error('加载脑图数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    return () => {
      mindRef.current = null
    }
  }, [projectId])

  const handleSave = async () => {
    if (!mindRef.current) return
    setSaving(true)
    try {
      const data = mindRef.current.getData()
      const nodes = mindElixirToBackend(data)
      await funcCaseApi.saveMindMapTree(projectId, nodes)
      message.success('脑图已保存')
    } catch {
      message.error('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            蓝色节点 = 分组，绿色节点 = 用例。编辑完成后点击「保存」
          </Text>
        </Space>
        <Space>
          <Button size="small" icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          <Button
            type="primary" size="small" icon={<SaveOutlined />}
            loading={saving} onClick={handleSave}
          >
            保存
          </Button>
        </Space>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin tip="加载脑图..." />
        </div>
      ) : (
        <div
          ref={containerRef}
          style={{ flex: 1, border: '1px solid #f0f0f0', borderRadius: 6, overflow: 'hidden' }}
        />
      )}
    </div>
  )
}
