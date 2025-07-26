import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'
import { analyticsApi } from '../../services/api'

interface AnalyticsMetric {
  name: string
  value: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  timestamp: string
  workflowId?: string
  agentId?: string
}

interface SystemMetrics {
  eventProcessing: {
    totalEventsProcessed: number
    eventsPerSecond: number
    averageProcessingTime: number
    errorRate: number
    lastUpdate: string
  }
  realTimeConnections: {
    activeConnections: number
    averageLatency: number
    connectionUptime: number
    reconnectionCount: number
  }
  performance: {
    memoryUsage: number
    cpuUsage: number
    networkThroughput: number
    cacheHitRate: number
  }
}

interface AnalyticsState {
  metrics: Record<string, AnalyticsMetric[]>
  systemMetrics: SystemMetrics
  dashboardData: {
    totalWorkflows: number | null
    activeAgents: number | null
    completionRate: number | null
    averageExecutionTime: number | null
    errorRate: number | null
    systemHealth: number | null
  }
  performanceData: {
    throughput: number[]
    latency: number[]
    resourceUtilization: {
      cpu: number | null
      memory: number | null
      network: number | null
    }
  }
  businessMetrics: {
    roi: number | null
    costSavings: number | null
    efficiencyGain: number | null
    qualityScore: number | null
  }
  timeRange: {
    start: string
    end: string
    period: '1h' | '6h' | '24h' | '7d' | '30d'
  }
  realTimeStats: {
    lastMetricUpdate: string
    metricsReceived: number
    dataPoints: Array<{
      timestamp: string
      value: number
      category: string
    }>
  }
  loading: {
    dashboard: boolean
    performance: boolean
    business: boolean
  }
  error: {
    dashboard: string | null
    performance: string | null
    business: string | null
  }
}

// Async thunks for fetching data from backend
export const fetchDashboardMetrics = createAsyncThunk(
  'analytics/fetchDashboardMetrics',
  async (timeRange: { start: string; end: string } | undefined, { rejectWithValue }) => {
    try {
      const data = await analyticsApi.getDashboardMetrics(timeRange)
      return data
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to fetch dashboard metrics')
    }
  }
)

export const fetchPerformanceMetrics = createAsyncThunk(
  'analytics/fetchPerformanceMetrics',
  async (timeRange: { start: string; end: string } | undefined, { rejectWithValue }) => {
    try {
      const data = await analyticsApi.getPerformanceMetrics(timeRange)
      return data
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to fetch performance metrics')
    }
  }
)

export const fetchBusinessMetrics = createAsyncThunk(
  'analytics/fetchBusinessMetrics',
  async (timeRange: { start: string; end: string } | undefined, { rejectWithValue }) => {
    try {
      const data = await analyticsApi.getBusinessMetrics(timeRange)
      return data
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || 'Failed to fetch business metrics')
    }
  }
)

// Helper function to safely get numeric value or null
const safeNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return isNaN(num) ? null : num
}

const initialState: AnalyticsState = {
  metrics: {},
  systemMetrics: {
    eventProcessing: {
      totalEventsProcessed: 0,
      eventsPerSecond: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      lastUpdate: new Date().toISOString(),
    },
    realTimeConnections: {
      activeConnections: 0,
      averageLatency: 0,
      connectionUptime: 0,
      reconnectionCount: 0,
    },
    performance: {
      memoryUsage: 0,
      cpuUsage: 0,
      networkThroughput: 0,
      cacheHitRate: 95,
    },
  },
  dashboardData: {
    totalWorkflows: null,
    activeAgents: null,
    completionRate: null,
    averageExecutionTime: null,
    errorRate: null,
    systemHealth: null,
  },
  performanceData: {
    throughput: [],
    latency: [],
    resourceUtilization: { cpu: null, memory: null, network: null },
  },
  businessMetrics: {
    roi: null,
    costSavings: null,
    efficiencyGain: null,
    qualityScore: null,
  },
  timeRange: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
    period: '24h',
  },
  realTimeStats: {
    lastMetricUpdate: new Date().toISOString(),
    metricsReceived: 0,
    dataPoints: [],
  },
  loading: {
    dashboard: false,
    performance: false,
    business: false,
  },
  error: {
    dashboard: null,
    performance: null,
    business: null,
  },
}

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    updateMetric: (state, action: PayloadAction<{ key: string; metric: AnalyticsMetric }>) => {
      const { key, metric } = action.payload
      if (!state.metrics[key]) {
        state.metrics[key] = []
      }
      
      // Enhanced metric with validation
      const enhancedMetric: AnalyticsMetric = {
        ...metric,
        timestamp: metric.timestamp || new Date().toISOString(),
        value: Number(metric.value) || 0,
      }
      
      state.metrics[key].push(enhancedMetric)
      
      // Keep only last 1000 entries per metric
      if (state.metrics[key].length > 1000) {
        state.metrics[key] = state.metrics[key].slice(-1000)
      }
      
      // Update real-time stats
      state.realTimeStats.metricsReceived += 1
      state.realTimeStats.lastMetricUpdate = enhancedMetric.timestamp
      
      // Add to data points for trending
      state.realTimeStats.dataPoints.push({
        timestamp: enhancedMetric.timestamp,
        value: enhancedMetric.value,
        category: key,
      })
      
      // Keep last 500 data points
      if (state.realTimeStats.dataPoints.length > 500) {
        state.realTimeStats.dataPoints = state.realTimeStats.dataPoints.slice(-500)
      }
    },

    updateSystemMetrics: (state, action: PayloadAction<{
      metricsCount?: number
      lastUpdate?: string
      averageValue?: number
      processingTime?: number
      errorCount?: number
    }>) => {
      const { metricsCount, lastUpdate, averageValue, processingTime, errorCount } = action.payload
      
      if (metricsCount !== undefined) {
        state.systemMetrics.eventProcessing.totalEventsProcessed += metricsCount
        
        // Calculate events per second (simple moving average)
        const now = new Date().getTime()
        const lastUpdateTime = new Date(state.systemMetrics.eventProcessing.lastUpdate).getTime()
        const timeDiff = (now - lastUpdateTime) / 1000 // seconds
        
        if (timeDiff > 0) {
          const currentEPS = metricsCount / timeDiff
          state.systemMetrics.eventProcessing.eventsPerSecond = 
            (state.systemMetrics.eventProcessing.eventsPerSecond + currentEPS) / 2
        }
      }
      
      if (lastUpdate) {
        state.systemMetrics.eventProcessing.lastUpdate = lastUpdate
      }
      
      if (averageValue !== undefined) {
        // Update system performance based on metric values
        state.systemMetrics.performance.networkThroughput = averageValue
      }
      
      if (processingTime !== undefined) {
        state.systemMetrics.eventProcessing.averageProcessingTime = 
          (state.systemMetrics.eventProcessing.averageProcessingTime + processingTime) / 2
      }
      
      if (errorCount !== undefined) {
        const totalProcessed = state.systemMetrics.eventProcessing.totalEventsProcessed
        state.systemMetrics.eventProcessing.errorRate = 
          totalProcessed > 0 ? errorCount / totalProcessed : 0
      }
    },

    updateConnectionMetrics: (state, action: PayloadAction<{
      activeConnections?: number
      averageLatency?: number
      connectionUptime?: number
      reconnectionCount?: number
    }>) => {
      const { activeConnections, averageLatency, connectionUptime, reconnectionCount } = action.payload
      
      if (activeConnections !== undefined) {
        state.systemMetrics.realTimeConnections.activeConnections = activeConnections
      }
      
      if (averageLatency !== undefined) {
        state.systemMetrics.realTimeConnections.averageLatency = averageLatency
      }
      
      if (connectionUptime !== undefined) {
        state.systemMetrics.realTimeConnections.connectionUptime = connectionUptime
      }
      
      if (reconnectionCount !== undefined) {
        state.systemMetrics.realTimeConnections.reconnectionCount = reconnectionCount
      }
    },

    updateDashboardData: (state, action: PayloadAction<Partial<AnalyticsState['dashboardData']>>) => {
      state.dashboardData = { ...state.dashboardData, ...action.payload }
      
      // Auto-calculate system health based on various factors only if we have valid data
      const { errorRate, completionRate } = state.dashboardData
      const eventErrorRate = state.systemMetrics.eventProcessing.errorRate
      const avgLatency = state.systemMetrics.realTimeConnections.averageLatency
      
      if (errorRate !== null && completionRate !== null) {
        let healthScore = 100
        healthScore -= (errorRate || 0) * 20 // Reduce by up to 20 points for errors
        healthScore -= eventErrorRate * 30 // Reduce by up to 30 points for event processing errors
        healthScore -= Math.max(0, (avgLatency - 500) / 50) // Reduce for high latency
        healthScore += ((completionRate || 0) - 50) / 5 // Bonus for high completion rate
        
        state.dashboardData.systemHealth = Math.max(0, Math.min(100, Math.round(healthScore)))
      }
    },

    updatePerformanceData: (state, action: PayloadAction<Partial<AnalyticsState['performanceData']>>) => {
      const newData = action.payload
      
      // Merge performance data with validation
      if (newData.throughput) {
        state.performanceData.throughput = [...state.performanceData.throughput, ...newData.throughput].slice(-100)
      }
      
      if (newData.latency) {
        state.performanceData.latency = [...state.performanceData.latency, ...newData.latency].slice(-100)
      }
      
      if (newData.resourceUtilization) {
        state.performanceData.resourceUtilization = {
          ...state.performanceData.resourceUtilization,
          ...newData.resourceUtilization
        }
        
        // Update system metrics
        state.systemMetrics.performance = {
          ...state.systemMetrics.performance,
          cpuUsage: newData.resourceUtilization.cpu || state.systemMetrics.performance.cpuUsage,
          memoryUsage: newData.resourceUtilization.memory || state.systemMetrics.performance.memoryUsage,
          networkThroughput: newData.resourceUtilization.network || state.systemMetrics.performance.networkThroughput,
        }
      }
    },

    updateBusinessMetrics: (state, action: PayloadAction<Partial<AnalyticsState['businessMetrics']>>) => {
      // Convert all values to safely handle null/undefined
      const updatedMetrics: Partial<AnalyticsState['businessMetrics']> = {}
      Object.entries(action.payload).forEach(([key, value]) => {
        updatedMetrics[key as keyof AnalyticsState['businessMetrics']] = safeNumber(value)
      })
      state.businessMetrics = { ...state.businessMetrics, ...updatedMetrics }
    },

    setTimeRange: (state, action: PayloadAction<AnalyticsState['timeRange']>) => {
      state.timeRange = action.payload
      
      // Clear metrics outside the new time range
      const startTime = new Date(action.payload.start).getTime()
      const endTime = new Date(action.payload.end).getTime()
      
      Object.keys(state.metrics).forEach(key => {
        state.metrics[key] = state.metrics[key].filter(metric => {
          const metricTime = new Date(metric.timestamp).getTime()
          return metricTime >= startTime && metricTime <= endTime
        })
      })
      
      // Filter data points as well
      state.realTimeStats.dataPoints = state.realTimeStats.dataPoints.filter(point => {
        const pointTime = new Date(point.timestamp).getTime()
        return pointTime >= startTime && pointTime <= endTime
      })
    },

    clearMetrics: (state) => {
      state.metrics = {}
      state.realTimeStats.dataPoints = []
      state.realTimeStats.metricsReceived = 0
    },

    resetSystemMetrics: (state) => {
      state.systemMetrics = initialState.systemMetrics
    },

    clearErrors: (state) => {
      state.error = {
        dashboard: null,
        performance: null,
        business: null,
      }
    },

    // Batch update for high-frequency metrics
    batchUpdateMetrics: (state, action: PayloadAction<Array<{ key: string; metric: AnalyticsMetric }>>) => {
      action.payload.forEach(({ key, metric }) => {
        if (!state.metrics[key]) {
          state.metrics[key] = []
        }
        
        const enhancedMetric: AnalyticsMetric = {
          ...metric,
          timestamp: metric.timestamp || new Date().toISOString(),
          value: Number(metric.value) || 0,
        }
        
        state.metrics[key].push(enhancedMetric)
      })
      
      // Clean up oversized arrays
      Object.keys(state.metrics).forEach(key => {
        if (state.metrics[key].length > 1000) {
          state.metrics[key] = state.metrics[key].slice(-1000)
        }
      })
      
      // Update batch stats
      state.realTimeStats.metricsReceived += action.payload.length
      state.realTimeStats.lastMetricUpdate = new Date().toISOString()
    },
  },
  extraReducers: (builder) => {
    // Dashboard metrics
    builder
      .addCase(fetchDashboardMetrics.pending, (state) => {
        state.loading.dashboard = true
        state.error.dashboard = null
      })
      .addCase(fetchDashboardMetrics.fulfilled, (state, action) => {
        state.loading.dashboard = false
        state.error.dashboard = null
        
        // Safely update dashboard data with null fallbacks
        const data = action.payload
        state.dashboardData = {
          totalWorkflows: safeNumber(data?.totalWorkflows),
          activeAgents: safeNumber(data?.activeAgents),
          completionRate: safeNumber(data?.completionRate),
          averageExecutionTime: safeNumber(data?.averageExecutionTime),
          errorRate: safeNumber(data?.errorRate),
          systemHealth: safeNumber(data?.systemHealth),
        }
      })
      .addCase(fetchDashboardMetrics.rejected, (state, action) => {
        state.loading.dashboard = false
        state.error.dashboard = action.payload as string
        // Keep existing data on error, don't reset to null
      })

    // Performance metrics
    builder
      .addCase(fetchPerformanceMetrics.pending, (state) => {
        state.loading.performance = true
        state.error.performance = null
      })
      .addCase(fetchPerformanceMetrics.fulfilled, (state, action) => {
        state.loading.performance = false
        state.error.performance = null
        
        const data = action.payload
        if (data?.resourceUtilization) {
          state.performanceData.resourceUtilization = {
            cpu: safeNumber(data.resourceUtilization.cpu),
            memory: safeNumber(data.resourceUtilization.memory),
            network: safeNumber(data.resourceUtilization.network),
          }
        }
        
        if (data?.throughput) {
          state.performanceData.throughput = Array.isArray(data.throughput) ? data.throughput : []
        }
        
        if (data?.latency) {
          state.performanceData.latency = Array.isArray(data.latency) ? data.latency : []
        }
      })
      .addCase(fetchPerformanceMetrics.rejected, (state, action) => {
        state.loading.performance = false
        state.error.performance = action.payload as string
      })

    // Business metrics
    builder
      .addCase(fetchBusinessMetrics.pending, (state) => {
        state.loading.business = true
        state.error.business = null
      })
      .addCase(fetchBusinessMetrics.fulfilled, (state, action) => {
        state.loading.business = false
        state.error.business = null
        
        const data = action.payload
        state.businessMetrics = {
          roi: safeNumber(data?.roi),
          costSavings: safeNumber(data?.costSavings),
          efficiencyGain: safeNumber(data?.efficiencyGain),
          qualityScore: safeNumber(data?.qualityScore),
        }
      })
      .addCase(fetchBusinessMetrics.rejected, (state, action) => {
        state.loading.business = false
        state.error.business = action.payload as string
      })
  },
})

export const {
  updateMetric,
  updateSystemMetrics,
  updateConnectionMetrics,
  updateDashboardData,
  updatePerformanceData,
  updateBusinessMetrics,
  setTimeRange,
  clearMetrics,
  resetSystemMetrics,
  clearErrors,
  batchUpdateMetrics,
} = analyticsSlice.actions

// Enhanced selectors
export const selectMetrics = (state: { analytics: AnalyticsState }) => state.analytics.metrics
export const selectSystemMetrics = (state: { analytics: AnalyticsState }) => state.analytics.systemMetrics
export const selectDashboardData = (state: { analytics: AnalyticsState }) => state.analytics.dashboardData
export const selectPerformanceData = (state: { analytics: AnalyticsState }) => state.analytics.performanceData
export const selectBusinessMetrics = (state: { analytics: AnalyticsState }) => state.analytics.businessMetrics
export const selectRealTimeStats = (state: { analytics: AnalyticsState }) => state.analytics.realTimeStats

export const selectMetricByKey = (key: string) => (state: { analytics: AnalyticsState }) => 
  state.analytics.metrics[key] || []

export const selectSystemHealth = (state: { analytics: AnalyticsState }) => {
  const { systemHealth, errorRate, completionRate } = state.analytics.dashboardData
  const { eventProcessing, realTimeConnections } = state.analytics.systemMetrics
  
  return {
    overall: systemHealth,
    components: {
      eventProcessing: Math.max(0, 100 - (eventProcessing.errorRate * 100)),
      connections: realTimeConnections.activeConnections > 0 ? 
        Math.max(0, 100 - (realTimeConnections.averageLatency / 10)) : 0,
      workflows: Math.max(0, completionRate || 0),
      errors: Math.max(0, 100 - (errorRate || 0) * 100),
    },
    trend: systemHealth && systemHealth > 90 ? 'excellent' : 
           systemHealth && systemHealth > 70 ? 'good' : 
           systemHealth && systemHealth > 50 ? 'fair' : 'poor'
  }
}

export const selectRecentMetrics = (minutes: number = 5) => (state: { analytics: AnalyticsState }) => {
  const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).getTime()
  
  return state.analytics.realTimeStats.dataPoints.filter(point => 
    new Date(point.timestamp).getTime() > cutoffTime
  )
}

export default analyticsSlice.reducer
