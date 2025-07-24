import { createSlice, PayloadAction } from '@reduxjs/toolkit'

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
    totalWorkflows: number
    activeAgents: number
    completionRate: number
    averageExecutionTime: number
    errorRate: number
    systemHealth: number
  }
  performanceData: {
    throughput: number[]
    latency: number[]
    resourceUtilization: {
      cpu: number
      memory: number
      network: number
    }
  }
  businessMetrics: {
    roi: number
    costSavings: number
    efficiencyGain: number
    qualityScore: number
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
    totalWorkflows: 0,
    activeAgents: 0,
    completionRate: 0,
    averageExecutionTime: 0,
    errorRate: 0,
    systemHealth: 100,
  },
  performanceData: {
    throughput: [],
    latency: [],
    resourceUtilization: { cpu: 0, memory: 0, network: 0 },
  },
  businessMetrics: {
    roi: 0,
    costSavings: 0,
    efficiencyGain: 0,
    qualityScore: 0,
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
      
      // Auto-calculate system health based on various factors
      const { errorRate, completionRate } = state.dashboardData
      const eventErrorRate = state.systemMetrics.eventProcessing.errorRate
      const avgLatency = state.systemMetrics.realTimeConnections.averageLatency
      
      let healthScore = 100
      healthScore -= errorRate * 20 // Reduce by up to 20 points for errors
      healthScore -= eventErrorRate * 30 // Reduce by up to 30 points for event processing errors
      healthScore -= Math.max(0, (avgLatency - 500) / 50) // Reduce for high latency
      healthScore += (completionRate - 50) / 5 // Bonus for high completion rate
      
      state.dashboardData.systemHealth = Math.max(0, Math.min(100, Math.round(healthScore)))
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
      state.businessMetrics = { ...state.businessMetrics, ...action.payload }
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
      workflows: Math.max(0, completionRate),
      errors: Math.max(0, 100 - (errorRate * 100)),
    },
    trend: systemHealth > 90 ? 'excellent' : 
           systemHealth > 70 ? 'good' : 
           systemHealth > 50 ? 'fair' : 'poor'
  }
}

export const selectRecentMetrics = (minutes: number = 5) => (state: { analytics: AnalyticsState }) => {
  const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).getTime()
  
  return state.analytics.realTimeStats.dataPoints.filter(point => 
    new Date(point.timestamp).getTime() > cutoffTime
  )
}

export default analyticsSlice.reducer
