import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Agent, AgentStatus, AgentType, LogEntry, AgentResult } from '../../types/core'
import { agentApi } from '../../services/api'

interface AgentState {
  agents: Record<string, Agent>
  loading: boolean
  error: string | null
  selectedAgentId: string | null
  filters: {
    status: AgentStatus[]
    type: AgentType[]
    workflowId: string | null
    searchQuery: string
  }
  realTimeUpdates: {
    lastLogUpdate: string
    lastStatusChange: string
    lastResultUpdate: string
    updatesReceived: number
    activeUpdates: string[] // IDs of agents currently receiving updates
  }
  performanceStats: Record<string, {
    executionTime: number
    memoryUsage: number
    cpuUsage: number
    errorCount: number
    successCount: number
  }>
  logHistory: Record<string, LogEntry[]> // Separate log storage for performance
}

const initialState: AgentState = {
  agents: {},
  loading: false,
  error: null,
  selectedAgentId: null,
  filters: {
    status: [],
    type: [],
    workflowId: null,
    searchQuery: '',
  },
  realTimeUpdates: {
    lastLogUpdate: '',
    lastStatusChange: '',
    lastResultUpdate: '',
    updatesReceived: 0,
    activeUpdates: [],
  },
  performanceStats: {},
  logHistory: {},
}

export const fetchAgents = createAsyncThunk(
  'agents/fetchAgents',
  async (workflowId?: string) => {
    const response = await agentApi.getAgents(workflowId)
    return response
  }
)

export const fetchAgentById = createAsyncThunk(
  'agents/fetchAgentById',
  async (agentId: string) => {
    const response = await agentApi.getAgentById(agentId)
    return response
  }
)

export const fetchAgentLogs = createAsyncThunk(
  'agents/fetchAgentLogs',
  async (agentId: string) => {
    const response = await agentApi.getAgentLogs(agentId)
    return { agentId, logs: response }
  }
)

export const fetchAgentResults = createAsyncThunk(
  'agents/fetchAgentResults',
  async (agentId: string) => {
    const response = await agentApi.getAgentResults(agentId)
    return { agentId, results: response }
  }
)

const agentSlice = createSlice({
  name: 'agents',
  initialState,
  reducers: {
    selectAgent: (state, action: PayloadAction<string | null>) => {
      state.selectedAgentId = action.payload
    },

    updateAgentStatus: (state, action: PayloadAction<{ 
      agentId: string
      status: AgentStatus
      previousStatus?: string
      reason?: string
      metadata?: Record<string, any>
    }>) => {
      const { agentId, status, previousStatus, reason, metadata } = action.payload
      
      if (state.agents[agentId]) {
        const agent = state.agents[agentId]
        const timestamp = new Date().toISOString()
        
        // Update status
        agent.status = status
        agent.updatedAt = timestamp
        agent.statusChangeReason = reason
        
        // Merge metadata if provided
        if (metadata) {
          agent.metadata = { ...agent.metadata, ...metadata }
        }
        
        // Set completion time for terminal states
        if (status === AgentStatus.COMPLETED || status === AgentStatus.FAILED) {
          agent.completedAt = timestamp
          
          // Remove from active updates
          state.realTimeUpdates.activeUpdates = state.realTimeUpdates.activeUpdates.filter(
            id => id !== agentId
          )
          
          // Update performance stats
          if (!state.performanceStats[agentId]) {
            state.performanceStats[agentId] = {
              executionTime: 0,
              memoryUsage: 0,
              cpuUsage: 0,
              errorCount: 0,
              successCount: 0,
            }
          }
          
          if (status === AgentStatus.COMPLETED) {
            state.performanceStats[agentId].successCount += 1
          } else if (status === AgentStatus.FAILED) {
            state.performanceStats[agentId].errorCount += 1
          }
          
          // Set progress to 100% if completed successfully
          if (status === AgentStatus.COMPLETED && agent.progress < 100) {
            agent.progress = 100
          }
        }
        
        // Track status change history
        if (!agent.statusHistory) {
          agent.statusHistory = []
        }
        
        agent.statusHistory.push({
          status,
          previousStatus: previousStatus || agent.status,
          timestamp,
          reason,
          metadata,
        })
        
        // Keep only last 50 status changes
        if (agent.statusHistory.length > 50) {
          agent.statusHistory = agent.statusHistory.slice(-50)
        }
        
        // Update real-time tracking
        state.realTimeUpdates.lastStatusChange = timestamp
        state.realTimeUpdates.updatesReceived += 1
        
        if (!state.realTimeUpdates.activeUpdates.includes(agentId)) {
          state.realTimeUpdates.activeUpdates.push(agentId)
        }
      }
    },

    updateAgentProgress: (state, action: PayloadAction<{ 
      agentId: string
      progress: number
      phase?: string
      estimatedTimeRemaining?: number
    }>) => {
      const { agentId, progress, phase, estimatedTimeRemaining } = action.payload
      
      if (state.agents[agentId]) {
        const agent = state.agents[agentId]
        const timestamp = new Date().toISOString()
        
        // Update progress
        agent.progress = Math.max(0, Math.min(100, progress))
        agent.updatedAt = timestamp
        
        // Update current phase if provided
        if (phase) {
          agent.currentPhase = phase
        }
        
        // Update estimated time remaining if provided
        if (estimatedTimeRemaining !== undefined) {
          agent.estimatedTimeRemaining = estimatedTimeRemaining
        }
        
        // Track active updates
        if (!state.realTimeUpdates.activeUpdates.includes(agentId)) {
          state.realTimeUpdates.activeUpdates.push(agentId)
        }
        
        state.realTimeUpdates.updatesReceived += 1
      }
    },

    addLogEntry: (state, action: PayloadAction<{ 
      agentId: string
      workflowId?: string
      logEntry: LogEntry
    }>) => {
      const { agentId, workflowId, logEntry } = action.payload
      const timestamp = new Date().toISOString()
      
      // Enhanced log entry with validation
      const enhancedLogEntry: LogEntry = {
        ...logEntry,
        timestamp: logEntry.timestamp || timestamp,
        agentId,
        workflowId: workflowId || logEntry.workflowId,
      }
      
      // Store in separate log history for performance
      if (!state.logHistory[agentId]) {
        state.logHistory[agentId] = []
      }
      
      state.logHistory[agentId].push(enhancedLogEntry)
      
      // Keep only last 1000 log entries per agent
      if (state.logHistory[agentId].length > 1000) {
        state.logHistory[agentId] = state.logHistory[agentId].slice(-1000)
      }
      
      // Also update agent's log reference (keep last 100 for quick access)
      if (state.agents[agentId]) {
        if (!state.agents[agentId].logs) {
          state.agents[agentId].logs = []
        }
        
        state.agents[agentId].logs.push(enhancedLogEntry)
        
        if (state.agents[agentId].logs.length > 100) {
          state.agents[agentId].logs = state.agents[agentId].logs.slice(-100)
        }
        
        state.agents[agentId].updatedAt = timestamp
      }
      
      // Update real-time tracking
      state.realTimeUpdates.lastLogUpdate = timestamp
      state.realTimeUpdates.updatesReceived += 1
      
      if (!state.realTimeUpdates.activeUpdates.includes(agentId)) {
        state.realTimeUpdates.activeUpdates.push(agentId)
      }
    },

    addResult: (state, action: PayloadAction<{ 
      agentId: string
      workflowId?: string
      result: AgentResult
    }>) => {
      const { agentId, workflowId, result } = action.payload
      const timestamp = new Date().toISOString()
      
      if (state.agents[agentId]) {
        const agent = state.agents[agentId]
        
        // Enhanced result with validation
        const enhancedResult: AgentResult = {
          ...result,
          timestamp: result.timestamp || timestamp,
          agentId,
          workflowId: workflowId || result.workflowId,
        }
        
        if (!agent.results) {
          agent.results = []
        }
        
        agent.results.push(enhancedResult)
        agent.updatedAt = timestamp
        
        // Update performance stats if result includes performance data
        if (!state.performanceStats[agentId]) {
          state.performanceStats[agentId] = {
            executionTime: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            errorCount: 0,
            successCount: 0,
          }
        }
        
        const stats = state.performanceStats[agentId]
        if (result.executionTime) {
          stats.executionTime = (stats.executionTime + result.executionTime) / 2
        }
        if (result.memoryUsage) {
          stats.memoryUsage = Math.max(stats.memoryUsage, result.memoryUsage)
        }
        if (result.cpuUsage) {
          stats.cpuUsage = (stats.cpuUsage + result.cpuUsage) / 2
        }
        
        // Track active updates
        if (!state.realTimeUpdates.activeUpdates.includes(agentId)) {
          state.realTimeUpdates.activeUpdates.push(agentId)
        }
        
        // Update real-time tracking
        state.realTimeUpdates.lastResultUpdate = timestamp
        state.realTimeUpdates.updatesReceived += 1
      }
    },

    // Batch update multiple agents for performance
    batchUpdateAgents: (state, action: PayloadAction<Array<{
      agentId: string
      updates: Partial<Agent>
    }>>) => {
      const timestamp = new Date().toISOString()
      
      action.payload.forEach(({ agentId, updates }) => {
        if (state.agents[agentId]) {
          state.agents[agentId] = {
            ...state.agents[agentId],
            ...updates,
            updatedAt: timestamp,
          }
        }
      })
      
      state.realTimeUpdates.updatesReceived += action.payload.length
    },

    // Mark agent as actively updating
    setAgentActiveUpdate: (state, action: PayloadAction<{ agentId: string; active: boolean }>) => {
      const { agentId, active } = action.payload
      
      if (active) {
        if (!state.realTimeUpdates.activeUpdates.includes(agentId)) {
          state.realTimeUpdates.activeUpdates.push(agentId)
        }
      } else {
        state.realTimeUpdates.activeUpdates = state.realTimeUpdates.activeUpdates.filter(
          id => id !== agentId
        )
      }
    },

    // Clear logs for specific agent
    clearAgentLogs: (state, action: PayloadAction<string>) => {
      const agentId = action.payload
      if (state.agents[agentId]) {
        state.agents[agentId].logs = []
      }
      if (state.logHistory[agentId]) {
        delete state.logHistory[agentId]
      }
    },

    // Clear all performance stats
    clearPerformanceStats: (state) => {
      state.performanceStats = {}
    },

    setFilters: (state, action: PayloadAction<Partial<AgentState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload }
    },

    clearError: (state) => {
      state.error = null
    },

    resetRealTimeStats: (state) => {
      state.realTimeUpdates = {
        lastLogUpdate: '',
        lastStatusChange: '',
        lastResultUpdate: '',
        updatesReceived: 0,
        activeUpdates: [],
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAgents.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAgents.fulfilled, (state, action) => {
        state.loading = false
        
        // Convert array to record and enhance with real-time tracking
        const agents = action.payload.agents || []
        agents.forEach(agent => {
          state.agents[agent.id] = {
            ...agent,
            // Initialize real-time fields if not present
            statusHistory: agent.statusHistory || [],
            logs: agent.logs || [],
            results: agent.results || [],
            progress: agent.progress || 0,
            currentPhase: agent.currentPhase || 'initialization',
          }
          
          // Initialize performance stats
          if (!state.performanceStats[agent.id]) {
            state.performanceStats[agent.id] = {
              executionTime: 0,
              memoryUsage: 0,
              cpuUsage: 0,
              errorCount: 0,
              successCount: 0,
            }
          }
        })
      })
      .addCase(fetchAgents.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch agents'
      })
      
      .addCase(fetchAgentById.fulfilled, (state, action) => {
        const agent = action.payload
        state.agents[agent.id] = {
          ...agent,
          statusHistory: agent.statusHistory || [],
          logs: agent.logs || [],
          results: agent.results || [],
          progress: agent.progress || 0,
          currentPhase: agent.currentPhase || 'initialization',
        }
        
        // Initialize performance stats
        if (!state.performanceStats[agent.id]) {
          state.performanceStats[agent.id] = {
            executionTime: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            errorCount: 0,
            successCount: 0,
          }
        }
      })
      
      .addCase(fetchAgentLogs.fulfilled, (state, action) => {
        const { agentId, logs } = action.payload
        
        // Store in log history
        state.logHistory[agentId] = logs
        
        // Update agent's logs reference (last 100)
        if (state.agents[agentId]) {
          state.agents[agentId].logs = logs.slice(-100)
        }
      })
      
      .addCase(fetchAgentResults.fulfilled, (state, action) => {
        const { agentId, results } = action.payload
        
        if (state.agents[agentId]) {
          state.agents[agentId].results = results
        }
      })
  },
})

export const {
  selectAgent,
  updateAgentStatus,
  updateAgentProgress,
  addLogEntry,
  addResult,
  batchUpdateAgents,
  setAgentActiveUpdate,
  clearAgentLogs,
  clearPerformanceStats,
  setFilters,
  clearError,
  resetRealTimeStats,
} = agentSlice.actions

// Enhanced selectors
export const selectAgents = (state: { agents: AgentState }) => state.agents.agents
export const selectAgentById = (id: string) => (state: { agents: AgentState }) => 
  state.agents.agents[id]
export const selectSelectedAgent = (state: { agents: AgentState }) => 
  state.agents.selectedAgentId ? state.agents.agents[state.agents.selectedAgentId] : null
export const selectAgentsLoading = (state: { agents: AgentState }) => state.agents.loading
export const selectAgentsError = (state: { agents: AgentState }) => state.agents.error
export const selectAgentFilters = (state: { agents: AgentState }) => state.agents.filters

// Real-time selectors
export const selectRealTimeUpdates = (state: { agents: AgentState }) => state.agents.realTimeUpdates
export const selectActivelyUpdatingAgents = (state: { agents: AgentState }) => 
  state.agents.realTimeUpdates.activeUpdates.map(id => state.agents.agents[id]).filter(Boolean)
export const selectAgentLogs = (agentId: string) => (state: { agents: AgentState }) => 
  state.agents.logHistory[agentId] || state.agents.agents[agentId]?.logs || []
export const selectAgentPerformanceStats = (agentId: string) => (state: { agents: AgentState }) => 
  state.agents.performanceStats[agentId]

// Computed selectors
export const selectAgentsByStatus = (status: AgentStatus) => (state: { agents: AgentState }) => 
  Object.values(state.agents.agents).filter(agent => agent.status === status)

export const selectAgentsByWorkflow = (workflowId: string) => (state: { agents: AgentState }) => 
  Object.values(state.agents.agents).filter(agent => agent.workflowId === workflowId)

export const selectAgentStats = (state: { agents: AgentState }) => {
  const agents = Object.values(state.agents.agents)
  const total = agents.length
  
  if (total === 0) {
    return {
      total: 0,
      byStatus: {},
      byType: {},
      averageProgress: 0,
      activeUpdates: 0,
    }
  }
  
  const byStatus = agents.reduce((acc, agent) => {
    acc[agent.status] = (acc[agent.status] || 0) + 1
    return acc
  }, {} as Record<AgentStatus, number>)
  
  const byType = agents.reduce((acc, agent) => {
    acc[agent.type] = (acc[agent.type] || 0) + 1
    return acc
  }, {} as Record<AgentType, number>)
  
  const averageProgress = agents.reduce((sum, agent) => sum + agent.progress, 0) / total
  
  return {
    total,
    byStatus,
    byType,
    averageProgress: Math.round(averageProgress * 100) / 100,
    activeUpdates: state.agents.realTimeUpdates.activeUpdates.length,
  }
}

export const selectFilteredAgents = (state: { agents: AgentState }) => {
  const { agents, filters } = state.agents
  let filtered = Object.values(agents)
  
  // Apply status filter
  if (filters.status.length > 0) {
    filtered = filtered.filter(agent => filters.status.includes(agent.status))
  }
  
  // Apply type filter
  if (filters.type.length > 0) {
    filtered = filtered.filter(agent => filters.type.includes(agent.type))
  }
  
  // Apply workflow filter
  if (filters.workflowId) {
    filtered = filtered.filter(agent => agent.workflowId === filters.workflowId)
  }
  
  // Apply search query
  if (filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase()
    filtered = filtered.filter(agent => 
      agent.name.toLowerCase().includes(query) ||
      agent.description?.toLowerCase().includes(query) ||
      agent.id.toLowerCase().includes(query)
    )
  }
  
  return filtered
}

export const selectRecentLogs = (agentId: string, minutes: number = 5) => (state: { agents: AgentState }) => {
  const logs = state.agents.logHistory[agentId] || []
  const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).getTime()
  
  return logs.filter(log => 
    new Date(log.timestamp).getTime() > cutoffTime
  )
}

export default agentSlice.reducer
