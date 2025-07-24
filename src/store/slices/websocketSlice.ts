import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { 
  WebSocketState, 
  WebSocketEvent, 
  WebSocketSubscription, 
  ConnectionStatus,
  WebSocketEventType 
} from '../../types/websocket'

// Enhanced WebSocket state with processing statistics
interface EnhancedWebSocketState extends WebSocketState {
  processing: {
    activeEvents: Record<string, boolean>
    processingStats: {
      totalProcessed: number
      totalErrors: number
      averageProcessingTime: number
      eventTypeStats: Record<WebSocketEventType, {
        processed: number
        errors: number
        avgTime: number
      }>
    }
    recentErrors: Array<{
      eventType: WebSocketEventType
      error: string
      context: string
      timestamp: string
    }>
  }
  connectionQuality: {
    roundTripTime?: number
    connectionUptime: number
    reconnectHistory: Array<{
      timestamp: string
      reason: string
      success: boolean
    }>
  }
}

const initialEventTypeStats = Object.values(WebSocketEventType).reduce((acc, type) => {
  acc[type] = { processed: 0, errors: 0, avgTime: 0 }
  return acc
}, {} as Record<WebSocketEventType, { processed: number; errors: number; avgTime: number }>)

const initialState: EnhancedWebSocketState = {
  isConnected: false,
  connectionStatus: ConnectionStatus.DISCONNECTED,
  lastHeartbeat: undefined,
  reconnectAttempts: 0,
  subscriptions: [],
  eventBuffer: [],
  error: undefined,
  processing: {
    activeEvents: {},
    processingStats: {
      totalProcessed: 0,
      totalErrors: 0,
      averageProcessingTime: 0,
      eventTypeStats: initialEventTypeStats,
    },
    recentErrors: [],
  },
  connectionQuality: {
    connectionUptime: 0,
    reconnectHistory: [],
  },
}

const websocketSlice = createSlice({
  name: 'websocket',
  initialState,
  reducers: {
    connectionStatusChanged: (state, action: PayloadAction<ConnectionStatus>) => {
      const previousStatus = state.connectionStatus
      state.connectionStatus = action.payload
      state.isConnected = action.payload === ConnectionStatus.CONNECTED
      
      if (action.payload === ConnectionStatus.CONNECTED) {
        state.reconnectAttempts = 0
        state.error = undefined
        state.connectionQuality.connectionUptime = Date.now()
        
        // Log successful reconnection
        if (previousStatus === ConnectionStatus.RECONNECTING) {
          state.connectionQuality.reconnectHistory.push({
            timestamp: new Date().toISOString(),
            reason: 'Reconnection successful',
            success: true,
          })
        }
      } else if (action.payload === ConnectionStatus.DISCONNECTED && previousStatus === ConnectionStatus.CONNECTED) {
        // Calculate uptime
        const uptime = Date.now() - state.connectionQuality.connectionUptime
        state.connectionQuality.reconnectHistory.push({
          timestamp: new Date().toISOString(),
          reason: `Connection lost after ${Math.round(uptime / 1000)}s`,
          success: false,
        })
      }
    },

    reconnectAttempted: (state) => {
      state.reconnectAttempts += 1
      state.connectionStatus = ConnectionStatus.RECONNECTING
      
      // Limit reconnect history to last 10 attempts
      if (state.connectionQuality.reconnectHistory.length >= 10) {
        state.connectionQuality.reconnectHistory = state.connectionQuality.reconnectHistory.slice(-9)
      }
    },

    heartbeatReceived: (state, action: PayloadAction<{ timestamp: string; roundTripTime?: number }>) => {
      state.lastHeartbeat = action.payload.timestamp
      if (action.payload.roundTripTime !== undefined) {
        state.connectionQuality.roundTripTime = action.payload.roundTripTime
      }
    },

    subscriptionAdded: (state, action: PayloadAction<WebSocketSubscription>) => {
      const exists = state.subscriptions.find(
        sub => sub.type === action.payload.type && 
               JSON.stringify(sub.filters) === JSON.stringify(action.payload.filters)
      )
      if (!exists) {
        state.subscriptions.push(action.payload)
      }
    },

    subscriptionRemoved: (state, action: PayloadAction<WebSocketSubscription>) => {
      state.subscriptions = state.subscriptions.filter(
        sub => !(sub.type === action.payload.type && 
                JSON.stringify(sub.filters) === JSON.stringify(action.payload.filters))
      )
    },

    subscriptionsCleared: (state) => {
      state.subscriptions = []
    },

    eventReceived: (state, action: PayloadAction<WebSocketEvent>) => {
      // Add event to buffer (keep last 1000 events)
      state.eventBuffer.push(action.payload)
      if (state.eventBuffer.length > 1000) {
        state.eventBuffer = state.eventBuffer.slice(-1000)
      }
    },

    eventProcessingStarted: (state, action: PayloadAction<{ eventType: WebSocketEventType }>) => {
      const eventId = `${action.payload.eventType}_${Date.now()}`
      state.processing.activeEvents[eventId] = true
    },

    eventProcessingCompleted: (state, action: PayloadAction<{ 
      eventType: WebSocketEventType
      processingTime: number 
    }>) => {
      const { eventType, processingTime } = action.payload
      
      // Update overall stats
      state.processing.processingStats.totalProcessed += 1
      const currentAvg = state.processing.processingStats.averageProcessingTime
      const totalProcessed = state.processing.processingStats.totalProcessed
      state.processing.processingStats.averageProcessingTime = 
        (currentAvg * (totalProcessed - 1) + processingTime) / totalProcessed
      
      // Update event type specific stats
      const typeStats = state.processing.processingStats.eventTypeStats[eventType]
      typeStats.processed += 1
      typeStats.avgTime = (typeStats.avgTime * (typeStats.processed - 1) + processingTime) / typeStats.processed
      
      // Clean up active events (remove completed ones)
      const activeEventKeys = Object.keys(state.processing.activeEvents)
      activeEventKeys.forEach(key => {
        if (key.startsWith(eventType)) {
          delete state.processing.activeEvents[key]
        }
      })
    },

    eventProcessingFailed: (state, action: PayloadAction<{
      eventType: WebSocketEventType
      error: string
      context: string
      timestamp: string
    }>) => {
      const { eventType, error, context, timestamp } = action.payload
      
      // Update error stats
      state.processing.processingStats.totalErrors += 1
      state.processing.processingStats.eventTypeStats[eventType].errors += 1
      
      // Add to recent errors (keep last 50)
      state.processing.recentErrors.push({
        eventType,
        error,
        context,
        timestamp,
      })
      
      if (state.processing.recentErrors.length > 50) {
        state.processing.recentErrors = state.processing.recentErrors.slice(-50)
      }
      
      // Clean up active events
      const activeEventKeys = Object.keys(state.processing.activeEvents)
      activeEventKeys.forEach(key => {
        if (key.startsWith(eventType)) {
          delete state.processing.activeEvents[key]
        }
      })
    },

    eventBufferCleared: (state) => {
      state.eventBuffer = []
    },

    processingStatsReset: (state) => {
      state.processing.processingStats = {
        totalProcessed: 0,
        totalErrors: 0,
        averageProcessingTime: 0,
        eventTypeStats: initialEventTypeStats,
      }
      state.processing.recentErrors = []
      state.processing.activeEvents = {}
    },

    errorOccurred: (state, action: PayloadAction<string>) => {
      state.error = action.payload
      state.connectionStatus = ConnectionStatus.ERROR
      state.isConnected = false
    },

    errorCleared: (state) => {
      state.error = undefined
    },

    reset: () => initialState,
  },
})

export const {
  connectionStatusChanged,
  reconnectAttempted,
  heartbeatReceived,
  subscriptionAdded,
  subscriptionRemoved,
  subscriptionsCleared,
  eventReceived,
  eventProcessingStarted,
  eventProcessingCompleted,
  eventProcessingFailed,
  eventBufferCleared,
  processingStatsReset,
  errorOccurred,
  errorCleared,
  reset,
} = websocketSlice.actions

// Enhanced selectors
export const selectWebSocketState = (state: { websocket: EnhancedWebSocketState }) => state.websocket
export const selectIsConnected = (state: { websocket: EnhancedWebSocketState }) => state.websocket.isConnected
export const selectConnectionStatus = (state: { websocket: EnhancedWebSocketState }) => state.websocket.connectionStatus
export const selectSubscriptions = (state: { websocket: EnhancedWebSocketState }) => state.websocket.subscriptions
export const selectEventBuffer = (state: { websocket: EnhancedWebSocketState }) => state.websocket.eventBuffer
export const selectLastHeartbeat = (state: { websocket: EnhancedWebSocketState }) => state.websocket.lastHeartbeat
export const selectWebSocketError = (state: { websocket: EnhancedWebSocketState }) => state.websocket.error

// Processing selectors
export const selectProcessingStats = (state: { websocket: EnhancedWebSocketState }) => 
  state.websocket.processing.processingStats

export const selectActiveEventProcessing = (state: { websocket: EnhancedWebSocketState }) => 
  Object.keys(state.websocket.processing.activeEvents).length > 0

export const selectRecentErrors = (state: { websocket: EnhancedWebSocketState }) => 
  state.websocket.processing.recentErrors

export const selectConnectionQuality = (state: { websocket: EnhancedWebSocketState }) => 
  state.websocket.connectionQuality

export const selectEventTypeStats = (eventType: WebSocketEventType) => 
  (state: { websocket: EnhancedWebSocketState }) => 
    state.websocket.processing.processingStats.eventTypeStats[eventType]

// Event type selectors
export const selectEventsByType = (eventType: WebSocketEventType) => 
  (state: { websocket: EnhancedWebSocketState }) => 
    state.websocket.eventBuffer.filter(event => event.type === eventType)

export const selectWorkflowEvents = (workflowId: string) => 
  (state: { websocket: EnhancedWebSocketState }) => 
    state.websocket.eventBuffer.filter(event => 
      'workflowId' in event.data && event.data.workflowId === workflowId
    )

export const selectAgentEvents = (agentId: string) => 
  (state: { websocket: EnhancedWebSocketState }) => 
    state.websocket.eventBuffer.filter(event => 
      'agentId' in event.data && event.data.agentId === agentId
    )

// Performance health selectors
export const selectConnectionHealth = (state: { websocket: EnhancedWebSocketState }) => {
  const stats = state.websocket.processing.processingStats
  const quality = state.websocket.connectionQuality
  
  return {
    isHealthy: state.websocket.isConnected && 
              stats.totalErrors / Math.max(stats.totalProcessed, 1) < 0.1 &&
              (quality.roundTripTime || 0) < 1000,
    errorRate: stats.totalProcessed > 0 ? stats.totalErrors / stats.totalProcessed : 0,
    avgProcessingTime: stats.averageProcessingTime,
    connectionUptime: state.websocket.isConnected 
      ? Date.now() - quality.connectionUptime 
      : 0,
    roundTripTime: quality.roundTripTime,
  }
}

export default websocketSlice.reducer
