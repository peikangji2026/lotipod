import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project } from '@/types'
import { projectApi } from '@/services/project'

interface ProjectState {
  selectedProjectId: number | null
  projects: Project[]
  setSelectedProjectId: (id: number | null) => void
  setProjects: (projects: Project[]) => void
  loadProjects: () => Promise<Project[]>
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      selectedProjectId: null,
      projects: [],

      setSelectedProjectId: (id) => set({ selectedProjectId: id }),

      setProjects: (projects) => set({ projects }),

      loadProjects: async () => {
        const list = await projectApi.list()
        set((state) => {
          // 若当前选中的项目 id 不在新列表中，重置为第一个
          const validId = list.find((p) => p.id === state.selectedProjectId)
            ? state.selectedProjectId
            : list[0]?.id ?? null
          return { projects: list, selectedProjectId: validId }
        })
        return list
      },
    }),
    {
      name: 'project-storage',
      // 只持久化 selectedProjectId，不持久化 projects 列表
      partialize: (state) => ({ selectedProjectId: state.selectedProjectId }),
    }
  )
)
