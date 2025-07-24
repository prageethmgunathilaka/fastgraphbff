import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Workflow, WorkflowStatus, Priority } from '../../types/core'
import { workflowApi } from '../../services/api'

interface WorkflowState {
  workflows: Record<string, Workflow>
  loading: boolean
  error: string | null
  selectedWorkflowId: string | null
  filters: {
    status: WorkflowStatus[]
    priority: Priority[]
    searchQuery: string
    tags: string[]
  }
  pagination: {
    page: number
    pageSize: number
    total: number
  }
  realTimeUpdates: {
    lastProgressUpdate: string
    lastStatusChange: string
    updatesReceived: number
    activeUpdates: string[] // IDs of workflows currently receiving updates
  }
  progressHistory: Record<string, Array<{
    timestamp: string
    progress: number
    phase?: string
    estimatedTimeRemaining?: number
  }>>
}

const initialState: WorkflowState = {
  workflows: {},
  loading: false,
  error: null,
  selectedWorkflowId: null,
  filters: {
    status: [],
    priority: [],
    searchQuery: '',
    tags: [],
  },
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
  },
  realTimeUpdates: {
    lastProgressUpdate: '',
    lastStatusChange: '',
    updatesReceived: 0,
    activeUpdates: [],
  },
  progressHistory: {},
}

// Async thunks
export const fetchWorkflows = createAsyncThunk(
  'workflows/fetchWorkflows',
  async (params?: { page?: number; pageSize?: number; filters?: any }) => {
    const response = await workflowApi.getWorkflows(params)
    return response
  }
)

export const fetchWorkflowById = createAsyncThunk(
  'workflows/fetchWorkflowById',
  async (workflowId: string) => {
    const response = await workflowApi.getWorkflowById(workflowId)
    return response
  }
)

export const createWorkflow = createAsyncThunk(
  'workflows/createWorkflow',
  async (workflowData: Partial<Workflow>) => {
    const response = await workflowApi.createWorkflow(workflowData)
    return response
  }
)

export const updateWorkflow = createAsyncThunk(
  'workflows/updateWorkflow',
  async ({ id, updates }: { id: string; updates: Partial<Workflow> }) => {
    const response = await workflowApi.updateWorkflow(id, updates)
    return response
  }
)

export const deleteWorkflow = createAsyncThunk(
  'workflows/deleteWorkflow',
  async (workflowId: string) => {
    await workflowApi.deleteWorkflow(workflowId)
    return workflowId
  }
)

const workflowSlice = createSlice({
  name: 'workflows',
  initialState,
  reducers: {
    selectWorkflow: (state, action: PayloadAction<string | null>) => {
      state.selectedWorkflowId = action.payload
    },

    updateWorkflowProgress: (state, action: PayloadAction<{ 
      workflowId: string
      progress: number
      estimatedTimeRemaining?: number
      completedTasks?: number
      totalTasks?: number
      currentPhase?: string
    }>) => {
      const { 
        workflowId, 
        progress, 
        estimatedTimeRemaining, 
        completedTasks, 
        totalTasks, 
        currentPhase 
      } = action.payload
      
      if (state.workflows[workflowId]) {
        const workflow = state.workflows[workflowId]
        const timestamp = new Date().toISOString()
        
        // Update workflow progress
        workflow.progress = Math.max(0, Math.min(100, progress))
        workflow.updatedAt = timestamp
        
        // Add estimated time remaining if provided
        if (estimatedTimeRemaining !== undefined) {
          workflow.estimatedTimeRemaining = estimatedTimeRemaining
        }
        
        // Update task completion if provided
        if (completedTasks !== undefined && totalTasks !== undefined) {
          workflow.completedTasks = completedTasks
          workflow.totalTasks = totalTasks
        }
        
        // Update current phase if provided
        if (currentPhase) {
          workflow.currentPhase = currentPhase
        }
        
        // Track progress history
        if (!state.progressHistory[workflowId]) {
          state.progressHistory[workflowId] = []
        }
        
        state.progressHistory[workflowId].push({
          timestamp,
          progress,
          phase: currentPhase,
          estimatedTimeRemaining,
        })
        
        // Keep only last 100 progress updates per workflow
        if (state.progressHistory[workflowId].length > 100) {
          state.progressHistory[workflowId] = state.progressHistory[workflowId].slice(-100)
        }
        
        // Update real-time tracking
        state.realTimeUpdates.lastProgressUpdate = timestamp
        state.realTimeUpdates.updatesReceived += 1
        
        if (!state.realTimeUpdates.activeUpdates.includes(workflowId)) {
          state.realTimeUpdates.activeUpdates.push(workflowId)
        }
      }
    },

    updateWorkflowStatus: (state, action: PayloadAction<{ 
      workflowId: string
      status: WorkflowStatus
      reason?: string
      metadata?: Record<string, any>
    }>) => {
      const { workflowId, status, reason, metadata } = action.payload
      
      if (state.workflows[workflowId]) {
        const workflow = state.workflows[workflowId]
        const previousStatus = workflow.status
        const timestamp = new Date().toISOString()
        
        // Update status
        workflow.status = status
        workflow.updatedAt = timestamp
        workflow.statusChangeReason = reason
        
        // Merge metadata if provided
        if (metadata) {
          workflow.metadata = { ...workflow.metadata, ...metadata }
        }
        
        // Set completion time for terminal states
        if (status === WorkflowStatus.COMPLETED || status === WorkflowStatus.FAILED) {
          workflow.completedAt = timestamp
          
          // Remove from active updates
          state.realTimeUpdates.activeUpdates = state.realTimeUpdates.activeUpdates.filter(
            id => id !== workflowId
          )
          
          // Set progress to 100% if completed successfully
          if (status === WorkflowStatus.COMPLETED && workflow.progress < 100) {
            workflow.progress = 100
          }
        }
        
        // Track status change history
        if (!workflow.statusHistory) {
          workflow.statusHistory = []
        }
        
        workflow.statusHistory.push({
          status,
          previousStatus,
          timestamp,
          reason,
          metadata,
        })
        
        // Keep only last 50 status changes
        if (workflow.statusHistory.length > 50) {
          workflow.statusHistory = workflow.statusHistory.slice(-50)
        }
        
        // Update real-time tracking
        state.realTimeUpdates.lastStatusChange = timestamp
        state.realTimeUpdates.updatesReceived += 1
      }
    },

    // Batch update multiple workflows (for performance)
    batchUpdateWorkflows: (state, action: PayloadAction<Array<{
      workflowId: string
      updates: Partial<Workflow>
    }>>) => {
      const timestamp = new Date().toISOString()
      
      action.payload.forEach(({ workflowId, updates }) => {
        if (state.workflows[workflowId]) {
          state.workflows[workflowId] = {
            ...state.workflows[workflowId],
            ...updates,
            updatedAt: timestamp,
          }
        }
      })
      
      state.realTimeUpdates.updatesReceived += action.payload.length
    },

    // Mark workflow as actively updating
    setWorkflowActiveUpdate: (state, action: PayloadAction<{ workflowId: string; active: boolean }>) => {
      const { workflowId, active } = action.payload
      
      if (active) {
        if (!state.realTimeUpdates.activeUpdates.includes(workflowId)) {
          state.realTimeUpdates.activeUpdates.push(workflowId)
        }
      } else {
        state.realTimeUpdates.activeUpdates = state.realTimeUpdates.activeUpdates.filter(
          id => id !== workflowId
        )
      }
    },

    setFilters: (state, action: PayloadAction<Partial<WorkflowState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload }
    },

    setPagination: (state, action: PayloadAction<Partial<WorkflowState['pagination']>>) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },

    clearError: (state) => {
      state.error = null
    },

    clearProgressHistory: (state, action: PayloadAction<string>) => {
      const workflowId = action.payload
      if (state.progressHistory[workflowId]) {
        delete state.progressHistory[workflowId]
      }
    },

    resetRealTimeStats: (state) => {
      state.realTimeUpdates = {
        lastProgressUpdate: '',
        lastStatusChange: '',
        updatesReceived: 0,
        activeUpdates: [],
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch workflows cases
      .addCase(fetchWorkflows.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchWorkflows.fulfilled, (state, action) => {
        state.loading = false
        
        // Convert array to record and enhance with real-time tracking
        const workflowsRecord = action.payload.workflows.reduce((acc, workflow) => {
          acc[workflow.id] = {
            ...workflow,
            // Initialize real-time fields if not present
            statusHistory: workflow.statusHistory || [],
            estimatedTimeRemaining: workflow.estimatedTimeRemaining,
            completedTasks: workflow.completedTasks || 0,
            totalTasks: workflow.totalTasks || 1,
            currentPhase: workflow.currentPhase || 'initialization',
          }
          return acc
        }, {} as Record<string, Workflow>)
        
        state.workflows = workflowsRecord
        state.pagination.total = action.payload.total
      })
      .addCase(fetchWorkflows.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch workflows'
      })
      
      // Fetch workflow by ID cases
      .addCase(fetchWorkflowById.fulfilled, (state, action) => {
        const workflow = action.payload
        state.workflows[workflow.id] = {
          ...workflow,
          statusHistory: workflow.statusHistory || [],
          estimatedTimeRemaining: workflow.estimatedTimeRemaining,
          completedTasks: workflow.completedTasks || 0,
          totalTasks: workflow.totalTasks || 1,
          currentPhase: workflow.currentPhase || 'initialization',
        }
      })
      
      // Create workflow cases
      .addCase(createWorkflow.fulfilled, (state, action) => {
        const workflow = action.payload
        state.workflows[workflow.id] = {
          ...workflow,
          statusHistory: [],
          completedTasks: 0,
          totalTasks: 1,
          currentPhase: 'initialization',
        }
      })
      
      // Update workflow cases
      .addCase(updateWorkflow.fulfilled, (state, action) => {
        const workflow = action.payload
        state.workflows[workflow.id] = {
          ...state.workflows[workflow.id],
          ...workflow,
          updatedAt: new Date().toISOString(),
        }
      })
      
      // Delete workflow cases
      .addCase(deleteWorkflow.fulfilled, (state, action) => {
        const workflowId = action.payload
        delete state.workflows[workflowId]
        
        // Clean up related data
        if (state.progressHistory[workflowId]) {
          delete state.progressHistory[workflowId]
        }
        
        state.realTimeUpdates.activeUpdates = state.realTimeUpdates.activeUpdates.filter(
          id => id !== workflowId
        )
        
        if (state.selectedWorkflowId === workflowId) {
          state.selectedWorkflowId = null
        }
      })
  },
})

export const {
  selectWorkflow,
  updateWorkflowProgress,
  updateWorkflowStatus,
  batchUpdateWorkflows,
  setWorkflowActiveUpdate,
  setFilters,
  setPagination,
  clearError,
  clearProgressHistory,
  resetRealTimeStats,
} = workflowSlice.actions

// Enhanced selectors
export const selectWorkflows = (state: { workflows: WorkflowState }) => state.workflows.workflows
export const selectWorkflowById = (id: string) => (state: { workflows: WorkflowState }) => 
  state.workflows.workflows[id]
export const selectSelectedWorkflow = (state: { workflows: WorkflowState }) => 
  state.workflows.selectedWorkflowId ? state.workflows.workflows[state.workflows.selectedWorkflowId] : null
export const selectWorkflowsLoading = (state: { workflows: WorkflowState }) => state.workflows.loading
export const selectWorkflowsError = (state: { workflows: WorkflowState }) => state.workflows.error
export const selectWorkflowFilters = (state: { workflows: WorkflowState }) => state.workflows.filters
export const selectWorkflowPagination = (state: { workflows: WorkflowState }) => state.workflows.pagination

// Real-time selectors
export const selectRealTimeUpdates = (state: { workflows: WorkflowState }) => state.workflows.realTimeUpdates
export const selectActivelyUpdatingWorkflows = (state: { workflows: WorkflowState }) => 
  state.workflows.realTimeUpdates.activeUpdates.map(id => state.workflows.workflows[id]).filter(Boolean)
export const selectProgressHistory = (workflowId: string) => (state: { workflows: WorkflowState }) => 
  state.workflows.progressHistory[workflowId] || []

// Computed selectors
export const selectWorkflowsByStatus = (status: WorkflowStatus) => (state: { workflows: WorkflowState }) => 
  Object.values(state.workflows.workflows).filter(workflow => workflow.status === status)

export const selectWorkflowStats = (state: { workflows: WorkflowState }) => {
  const workflows = Object.values(state.workflows.workflows)
  const total = workflows.length
  
  if (total === 0) {
    return {
      total: 0,
      byStatus: {},
      averageProgress: 0,
      activeUpdates: 0,
      completionRate: 0,
    }
  }
  
  const byStatus = workflows.reduce((acc, workflow) => {
    acc[workflow.status] = (acc[workflow.status] || 0) + 1
    return acc
  }, {} as Record<WorkflowStatus, number>)
  
  const averageProgress = workflows.reduce((sum, workflow) => sum + workflow.progress, 0) / total
  const completed = byStatus[WorkflowStatus.COMPLETED] || 0
  const failed = byStatus[WorkflowStatus.FAILED] || 0
  const completionRate = total > 0 ? (completed / (completed + failed)) * 100 : 0
  
  return {
    total,
    byStatus,
    averageProgress: Math.round(averageProgress * 100) / 100,
    activeUpdates: state.workflows.realTimeUpdates.activeUpdates.length,
    completionRate: Math.round(completionRate * 100) / 100,
  }
}

export const selectFilteredWorkflows = (state: { workflows: WorkflowState }) => {
  const { workflows, filters } = state.workflows
  let filtered = Object.values(workflows)
  
  // Apply status filter
  if (filters.status.length > 0) {
    filtered = filtered.filter(workflow => filters.status.includes(workflow.status))
  }
  
  // Apply priority filter
  if (filters.priority.length > 0) {
    filtered = filtered.filter(workflow => filters.priority.includes(workflow.priority))
  }
  
  // Apply search query
  if (filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase()
    filtered = filtered.filter(workflow => 
      workflow.name.toLowerCase().includes(query) ||
      workflow.description?.toLowerCase().includes(query) ||
      workflow.id.toLowerCase().includes(query)
    )
  }
  
  // Apply tags filter
  if (filters.tags.length > 0) {
    filtered = filtered.filter(workflow => 
      workflow.tags?.some(tag => filters.tags.includes(tag))
    )
  }
  
  return filtered
}

export default workflowSlice.reducer
