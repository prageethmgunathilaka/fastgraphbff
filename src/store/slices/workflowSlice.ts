import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit'
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
        
        // Handle case where payload or workflows might be undefined
        if (!action.payload || !action.payload.workflows || !Array.isArray(action.payload.workflows)) {
          console.warn('fetchWorkflows.fulfilled: Invalid payload structure', action.payload)
          return
        }
        
        // Convert array to record and enhance with real-time tracking
        const workflowsRecord = action.payload.workflows.reduce((acc, workflow: any) => {
          // Transform backend data format to frontend format
          const transformedWorkflow: Workflow = {
            ...workflow,
            // Map backend status to frontend status
            status: (workflow.status === 'active' ? WorkflowStatus.RUNNING : workflow.status) as WorkflowStatus,
            // Map snake_case to camelCase
            createdAt: workflow.created_at || workflow.createdAt || new Date().toISOString(),
            updatedAt: workflow.last_modified || workflow.updatedAt || new Date().toISOString(),
            // Ensure required fields exist with defaults
            progress: workflow.progress || 0,
            priority: workflow.priority || Priority.MEDIUM,
            tags: workflow.tags || [],
            agents: workflow.agents || [],
            metrics: workflow.metrics || {
              executionTime: 0,
              successRate: 0,
              errorRate: 0,
              throughput: 0,
              costMetrics: { totalCost: 0, costPerExecution: 0 },
              resourceUsage: { cpuUsage: 0, memoryUsage: 0, storageUsage: 0 }
            },
            creator: workflow.creator || 'system',
            configuration: workflow.configuration || {},
            // Initialize real-time fields if not present
            statusHistory: workflow.statusHistory || [],
            estimatedTimeRemaining: workflow.estimatedTimeRemaining,
            completedTasks: workflow.completedTasks || 0,
            totalTasks: workflow.totalTasks || 1,
            currentPhase: workflow.currentPhase || 'initialization',
          }
          
          acc[workflow.id] = transformedWorkflow
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

// Agent-related selectors
export const selectActiveAgentsCount = (state: { workflows: WorkflowState }) => {
  const workflows = Object.values(state.workflows.workflows)
  let activeAgentsCount = 0
  
  workflows.forEach(workflow => {
    if (workflow.agents && Array.isArray(workflow.agents)) {
      // Count agents that are actively working (not completed, failed, or timeout)
      const activeAgents = workflow.agents.filter(agent => 
        agent.status === 'running' || 
        agent.status === 'waiting' || 
        agent.status === 'idle'
      )
      activeAgentsCount += activeAgents.length
    }
  })
  
  return activeAgentsCount
}

// Get total agents count for reference
export const selectTotalAgentsCount = (state: { workflows: WorkflowState }) => {
  const workflows = Object.values(state.workflows.workflows)
  let totalAgentsCount = 0
  
  workflows.forEach(workflow => {
    if (workflow.agents && Array.isArray(workflow.agents)) {
      totalAgentsCount += workflow.agents.length
    }
  })
  
  return totalAgentsCount
}

// Get agents by status for detailed breakdown - MEMOIZED
export const selectAgentsByStatus = createSelector(
  [selectWorkflows],
  (workflows) => {
    const workflowsArray = Object.values(workflows)
    const agentsByStatus = {
      idle: 0,
      running: 0,
      waiting: 0,
      completed: 0,
      failed: 0,
      timeout: 0
    }
    
    workflowsArray.forEach(workflow => {
      if (workflow.agents && Array.isArray(workflow.agents)) {
        workflow.agents.forEach(agent => {
          if (agentsByStatus.hasOwnProperty(agent.status)) {
            agentsByStatus[agent.status as keyof typeof agentsByStatus] += 1
          }
        })
      }
    })
    
    return agentsByStatus
  }
)

// Calculate system health based on workflow and agent performance - MEMOIZED
export const selectSystemHealth = createSelector(
  [selectWorkflows],
  (workflows) => {
    const workflowsArray = Object.values(workflows)
    
    if (workflowsArray.length === 0) {
      return {
        score: null,
        status: 'No data available',
        factors: {
          workflowSuccess: null,
          agentPerformance: null,
          errorRate: null,
          activeWorkflows: null
        }
      }
    }

    let healthScore = 100
    const factors = {
      workflowSuccess: 0,
      agentPerformance: 0, 
      errorRate: 0,
      activeWorkflows: 0
    }

    // 1. Workflow Success Rate (40% weight)
    const completedWorkflows = workflowsArray.filter(w => 
      w.status === WorkflowStatus.COMPLETED || w.status === ('completed' as any)
    ).length
    const failedWorkflows = workflowsArray.filter(w => 
      w.status === WorkflowStatus.FAILED || w.status === ('failed' as any)
    ).length
    const totalTerminalWorkflows = completedWorkflows + failedWorkflows
    
    if (totalTerminalWorkflows > 0) {
      factors.workflowSuccess = (completedWorkflows / totalTerminalWorkflows) * 100
      // Deduct up to 40 points for poor workflow success rate
      healthScore -= (100 - factors.workflowSuccess) * 0.4
    }

    // 2. Agent Performance (30% weight)
    let totalAgents = 0
    let successfulAgents = 0
    let failedAgents = 0

    workflowsArray.forEach(workflow => {
      if (workflow.agents && Array.isArray(workflow.agents)) {
        totalAgents += workflow.agents.length
        successfulAgents += workflow.agents.filter(a => a.status === 'completed').length
        failedAgents += workflow.agents.filter(a => a.status === 'failed' || a.status === 'timeout').length
      }
    })

    if (totalAgents > 0) {
      factors.agentPerformance = (successfulAgents / totalAgents) * 100
      // Deduct up to 30 points for poor agent performance
      healthScore -= (100 - factors.agentPerformance) * 0.3
    }

    // 3. Error Rate (20% weight)
    const totalWorkflows = workflowsArray.length
    const errorRate = (failedWorkflows / totalWorkflows) * 100
    factors.errorRate = errorRate
    // Deduct up to 20 points for high error rates
    healthScore -= errorRate * 0.2

    // 4. Active Workflows Health (10% weight)
    const runningWorkflows = workflowsArray.filter(w => 
      w.status === WorkflowStatus.RUNNING || w.status === ('running' as any)
    ).length
    const pausedWorkflows = workflowsArray.filter(w => 
      w.status === WorkflowStatus.PAUSED || w.status === ('paused' as any)
    ).length
    const pendingWorkflows = workflowsArray.filter(w => 
      w.status === WorkflowStatus.PENDING || w.status === ('pending' as any)
    ).length
    const activeWorkflows = runningWorkflows + pausedWorkflows + pendingWorkflows

    if (activeWorkflows > 0) {
      // Healthy if most active workflows are running (not paused/pending)
      factors.activeWorkflows = (runningWorkflows / activeWorkflows) * 100
      healthScore -= (100 - factors.activeWorkflows) * 0.1
    }

    // Ensure score stays within bounds
    const finalScore = Math.max(0, Math.min(100, Math.round(healthScore)))
    
    // Determine status message
    let status = 'System operational'
    if (finalScore < 50) {
      status = 'System degraded - multiple issues detected'
    } else if (finalScore < 70) {
      status = 'System experiencing some issues'
    } else if (finalScore < 90) {
      status = 'System mostly operational'
    }

    return {
      score: finalScore,
      status,
      factors: {
        workflowSuccess: Math.round(factors.workflowSuccess * 100) / 100,
        agentPerformance: Math.round(factors.agentPerformance * 100) / 100,
        errorRate: Math.round(factors.errorRate * 100) / 100,
        activeWorkflows: Math.round(factors.activeWorkflows * 100) / 100
      }
    }
  }
)

export default workflowSlice.reducer
