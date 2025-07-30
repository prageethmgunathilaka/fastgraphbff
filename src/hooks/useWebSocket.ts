import { useEffect, useRef, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '../store'
import { getWebSocketUrl } from '../utils/env'
import {
  connectionStatusChanged,
  reconnectAttempted,
  heartbeatReceived,
  subscriptionAdded,
  subscriptionRemoved,
  eventReceived,
  errorOccurred,
  errorCleared,
  eventProcessingStarted,
  eventProcessingCompleted,
  eventProcessingFailed,
} from '../store/slices/websocketSlice'
import { updateWorkflowProgress, updateWorkflowStatus } from '../store/slices/workflowSlice'
import { updateAgentStatus, addLogEntry, addResult } from '../store/slices/agentSlice'
import { updateMetric, updateSystemMetrics } from '../store/slices/analyticsSlice'
import { addNotification } from '../store/slices/uiSlice'
import {
  WebSocketEvent,
  WebSocketEventType,
  WebSocketSubscription,
  ConnectionStatus,
  WebSocketAction,
  WebSocketMessage,
  ErrorSeverity,
} from '../types/websocket'
import { WorkflowStatus, AgentStatus } from '../types/core'

const WS_URL = getWebSocketUrl()

// Event processing configuration
const EVENT_PROCESSING_CONFIG = {
  batchSize: 10,
  batchTimeout: 100, // ms
  maxRetries: 3,
  retryDelay: 1000, // ms
}

export const useWebSocket = () => {
  const dispatch = useAppDispatch()
  const { isConnected, connectionStatus, subscriptions, reconnectAttempts } = useAppSelector(
    (state) => state.websocket
  )
  
  const wsRef = useRef<WebSocket | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const eventBatchRef = useRef<WebSocketEvent[]>([])
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const eventProcessingStatsRef = useRef({
    totalProcessed: 0,
    totalErrors: 0,
    avgProcessingTime: 0,
    lastProcessingTime: 0,
  })

  // Validate WebSocket event structure
  const validateEvent = useCallback((event: any): event is WebSocketEvent => {
    if (!event || typeof event !== 'object') {
      console.error('Invalid event: not an object', event)
      return false
    }

    if (!event.type || !Object.values(WebSocketEventType).includes(event.type)) {
      console.error('Invalid event: unknown or missing type', event.type)
      return false
    }

    if (!event.timestamp || !event.sessionId) {
      console.error('Invalid event: missing required fields', event)
      return false
    }

    if (!event.data || typeof event.data !== 'object') {
      console.error('Invalid event: missing or invalid data', event)
      return false
    }

    return true
  }, [])

  // Enhanced error handling with user-friendly messages and recovery suggestions
  const handleEventError = useCallback((event: WebSocketEvent, error: Error, context: string) => {
    const errorMessage = `Failed to process ${event.type} event: ${error.message}`
    console.error(`[WebSocket Event Error] ${context}:`, error, event)
    
    dispatch(eventProcessingFailed({
      eventType: event.type,
      error: errorMessage,
      context,
      timestamp: new Date().toISOString(),
    }))

    // Determine error severity and notification type
    let notificationType: 'error' | 'warning' = 'error'
    let notificationTitle = 'Event Processing Error'
    let notificationMessage = errorMessage

    if (event.type === WebSocketEventType.METRIC_UPDATE) {
      notificationType = 'warning'
      notificationTitle = 'Metrics Update Failed'
      notificationMessage = 'Some performance metrics may be temporarily unavailable'
    } else if (event.type === WebSocketEventType.LOG_ENTRY) {
      notificationType = 'warning'
      notificationTitle = 'Log Processing Issue'
      notificationMessage = 'Some log entries may not be displayed'
    }

    dispatch(addNotification({
      type: notificationType,
      title: notificationTitle,
      message: notificationMessage,
      duration: notificationType === 'error' ? 8000 : 5000,
    }))

    eventProcessingStatsRef.current.totalErrors++
  }, [dispatch])

  // Process individual WebSocket event with enhanced error handling
  const processEvent = useCallback(async (event: WebSocketEvent): Promise<boolean> => {
    const startTime = performance.now()
    
    try {
      dispatch(eventProcessingStarted({ eventType: event.type }))

      switch (event.type) {
        case WebSocketEventType.WORKFLOW_PROGRESS:
          if (!event.data.workflowId || typeof event.data.progress !== 'number') {
            throw new Error('Invalid workflow progress data')
          }
          dispatch(updateWorkflowProgress({
            workflowId: event.data.workflowId,
            progress: Math.max(0, Math.min(100, event.data.progress)), // Clamp between 0-100
            estimatedTimeRemaining: event.data.estimatedTimeRemaining,
            completedTasks: event.data.completedTasks,
            totalTasks: event.data.totalTasks,
            currentPhase: event.data.currentPhase,
          }))
          break

        case WebSocketEventType.STATUS_CHANGE:
          if (!event.data.entityId || !event.data.entityType || !event.data.newStatus) {
            throw new Error('Invalid status change data')
          }
          
          if (event.data.entityType === 'workflow') {
            dispatch(updateWorkflowStatus({
              workflowId: event.data.entityId,
              status: event.data.newStatus as WorkflowStatus,
              reason: event.data.reason,
              metadata: event.data.metadata,
            }))
          } else if (event.data.entityType === 'agent') {
            dispatch(updateAgentStatus({
              agentId: event.data.entityId,
              status: event.data.newStatus as AgentStatus,
              previousStatus: event.data.previousStatus,
              reason: event.data.reason,
              metadata: event.data.metadata,
            }))
          }
          break

        case WebSocketEventType.RESULT_UPDATED:
          if (!event.data.agentId || !event.data.result) {
            throw new Error('Invalid result update data')
          }
          
          dispatch(addResult({
            agentId: event.data.agentId,
            result: event.data.result,
            workflowId: event.data.workflowId,
          }))
          
          if (event.data.isComplete) {
            dispatch(addNotification({
              type: 'success',
              title: 'Agent Completed',
              message: `Agent ${event.data.agentId} has completed successfully`,
              duration: 5000,
            }))
          }
          break

        case WebSocketEventType.ERROR_OCCURRED: {
          if (!event.data.error || !event.data.error.message) {
            throw new Error('Invalid error event data')
          }
          
          const severity = event.data.error.severity || ErrorSeverity.MEDIUM
          const notificationType = severity === ErrorSeverity.CRITICAL ? 'error' : 'warning'
          
          dispatch(addNotification({
            type: notificationType,
            title: `${severity.toUpperCase()} Error`,
            message: event.data.error.message,
            duration: severity === ErrorSeverity.CRITICAL ? 10000 : 6000,
            actions: event.data.isRecoverable ? [
              { label: 'Retry', action: 'retry' },
              { label: 'Dismiss', action: 'dismiss' }
            ] : undefined,
          }))
          break
        }

        case WebSocketEventType.METRIC_UPDATE: {
          if (!Array.isArray(event.data.metrics) || event.data.metrics.length === 0) {
            throw new Error('Invalid metrics data')
          }
          
          // Process metrics in batch for better performance
          const validMetrics = event.data.metrics.filter(metric => 
            metric.name && typeof metric.value === 'number'
          )
          
          if (validMetrics.length > 0) {
            // Update individual metrics
            validMetrics.forEach(metric => {
              dispatch(updateMetric({
                key: metric.name,
                metric: {
                  ...metric,
                  workflowId: event.data.workflowId,
                  agentId: event.data.agentId,
                }
              }))
            })
            
            // Update system-wide metrics summary
            dispatch(updateSystemMetrics({
              metricsCount: validMetrics.length,
              lastUpdate: event.timestamp,
              averageValue: validMetrics.reduce((sum, m) => sum + m.value, 0) / validMetrics.length,
            }))
          }
          break
        }

        case WebSocketEventType.LOG_ENTRY:
          if (!event.data.agentId || !event.data.logEntry) {
            throw new Error('Invalid log entry data')
          }
          
          dispatch(addLogEntry({
            agentId: event.data.agentId,
            workflowId: event.data.workflowId,
            logEntry: {
              ...event.data.logEntry,
              timestamp: event.data.logEntry.timestamp || event.timestamp,
            }
          }))
          break

        default:
          console.warn('Unknown WebSocket event type:', (event as any).type)
          return false
      }

      const processingTime = performance.now() - startTime
      eventProcessingStatsRef.current.totalProcessed++
      eventProcessingStatsRef.current.lastProcessingTime = processingTime
      eventProcessingStatsRef.current.avgProcessingTime = 
        (eventProcessingStatsRef.current.avgProcessingTime + processingTime) / 2

      dispatch(eventProcessingCompleted({ 
        eventType: event.type, 
        processingTime: Math.round(processingTime * 100) / 100 
      }))
      
      return true
    } catch (error) {
      handleEventError(event, error as Error, 'Event Processing')
      return false
    }
  }, [dispatch, handleEventError])

  // Batch process events for better performance
  const processBatchedEvents = useCallback(async () => {
    if (eventBatchRef.current.length === 0) return

    const batch = [...eventBatchRef.current]
    eventBatchRef.current = []

    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current)
      batchTimeoutRef.current = null
    }

    try {
      // Process events in parallel with limited concurrency
      const processingPromises = batch.map(event => processEvent(event))
      await Promise.allSettled(processingPromises)
    } catch (error) {
      console.error('Batch processing error:', error)
    }
  }, [processEvent])

  // Enhanced event handler with batching and validation
  const handleEvent = useCallback((event: WebSocketEvent) => {
    // Validate event structure
    if (!validateEvent(event)) {
      dispatch(addNotification({
        type: 'warning',
        title: 'Invalid Event Received',
        message: 'Received malformed event data from server',
        duration: 3000,
      }))
      return
    }

    // Store event in Redux buffer
    dispatch(eventReceived(event))

    // Add to processing batch
    eventBatchRef.current.push(event)

    // Process immediately if batch is full, otherwise set timeout
    if (eventBatchRef.current.length >= EVENT_PROCESSING_CONFIG.batchSize) {
      processBatchedEvents()
    } else if (!batchTimeoutRef.current) {
      batchTimeoutRef.current = setTimeout(
        processBatchedEvents, 
        EVENT_PROCESSING_CONFIG.batchTimeout
      )
    }
  }, [validateEvent, dispatch, processBatchedEvents])

  // Send message to WebSocket with error handling
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (!wsRef.current || wsRef.current.readyState !== 1) { // 1 = OPEN
      dispatch(addNotification({
        type: 'warning',
        title: 'Connection Error',
        message: 'Cannot send message: WebSocket not connected',
        duration: 3000,
      }))
      return false
    }

    try {
      wsRef.current.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error('Failed to send WebSocket message:', error)
      dispatch(addNotification({
        type: 'error',
        title: 'Message Send Failed',
        message: 'Failed to send message to server',
        duration: 5000,
      }))
      return false
    }
  }, [dispatch])

  // Subscribe to event types with enhanced error handling
  const subscribe = useCallback((subscription: WebSocketSubscription) => {
    dispatch(subscriptionAdded(subscription))
    const success = sendMessage({
      action: WebSocketAction.SUBSCRIBE,
      subscriptions: [subscription]
    })

    if (success) {
      dispatch(addNotification({
        type: 'info',
        title: 'Subscription Added',
        message: `Subscribed to ${subscription.type} events`,
        duration: 2000,
      }))
    }
  }, [dispatch, sendMessage])

  // Unsubscribe from event types
  const unsubscribe = useCallback((subscription: WebSocketSubscription) => {
    dispatch(subscriptionRemoved(subscription))
    const success = sendMessage({
      action: WebSocketAction.UNSUBSCRIBE,
      subscriptions: [subscription]
    })

    if (success) {
      dispatch(addNotification({
        type: 'info',
        title: 'Subscription Removed',
        message: `Unsubscribed from ${subscription.type} events`,
        duration: 2000,
      }))
    }
  }, [dispatch, sendMessage])

  // Enhanced heartbeat with connection quality monitoring
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }
    
    heartbeatIntervalRef.current = setInterval(() => {
      const heartbeatStart = performance.now()
      const success = sendMessage({ action: WebSocketAction.HEARTBEAT })
      
      if (success) {
        const roundTripTime = performance.now() - heartbeatStart
        dispatch(heartbeatReceived({
          timestamp: new Date().toISOString(),
          roundTripTime: Math.round(roundTripTime * 100) / 100,
        }))
      }
    }, 30000) // 30 second heartbeat
  }, [sendMessage, dispatch])

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  // Enhanced connection with better error reporting
  const connect = useCallback(() => {
    // TEMPORARILY DISABLED - WebSocket backend not available
    console.warn('🔌 WebSocket connect() called but connection is disabled')
    return
    
    // Check if WebSocket is already open - handle undefined WebSocket.OPEN in tests
    if (wsRef.current && wsRef.current.readyState === 1) { // 1 = OPEN state
      return
    }

    // Clear any pending batched events
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current)
      batchTimeoutRef.current = null
    }
    eventBatchRef.current = []

    dispatch(connectionStatusChanged(ConnectionStatus.CONNECTING))

    try {
      wsRef.current = new WebSocket(WS_URL)

      wsRef.current.onopen = () => {
        console.log('WebSocket connected to:', WS_URL)
        dispatch(connectionStatusChanged(ConnectionStatus.CONNECTED))
        dispatch(errorCleared())
        dispatch(addNotification({
          type: 'success',
          title: 'Connected',
          message: 'Real-time connection established',
          duration: 3000,
        }))
        startHeartbeat()

        // Re-subscribe to existing subscriptions
        if (subscriptions.length > 0) {
          sendMessage({
            action: WebSocketAction.SUBSCRIBE,
            subscriptions
          })
        }
      }

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleEvent(data as WebSocketEvent)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error, event.data)
          dispatch(addNotification({
            type: 'warning',
            title: 'Message Parse Error',
            message: 'Received invalid message format',
            duration: 3000,
          }))
        }
      }

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        dispatch(connectionStatusChanged(ConnectionStatus.DISCONNECTED))
        stopHeartbeat()

        // Clear processing batch
        if (batchTimeoutRef.current) {
          clearTimeout(batchTimeoutRef.current)
          batchTimeoutRef.current = null
        }

        // Show user-friendly disconnect message
        const isIntentional = event.code === 1000
        if (!isIntentional) {
          dispatch(addNotification({
            type: 'warning',
            title: 'Connection Lost',
            message: 'Attempting to reconnect...',
            duration: 5000,
          }))
        }

        // Attempt reconnection if not a normal closure
        if (!isIntentional && reconnectAttempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
          reconnectTimeoutRef.current = setTimeout(() => {
            dispatch(reconnectAttempted())
            connect()
          }, delay)
        } else if (reconnectAttempts >= 5) {
          dispatch(addNotification({
            type: 'error',
            title: 'Connection Failed',
            message: 'Unable to establish connection. Please refresh the page.',
            duration: 0, // Persistent notification
            actions: [
              { label: 'Retry', action: 'retry' },
              { label: 'Refresh Page', action: 'refresh' }
            ],
          }))
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        dispatch(errorOccurred('WebSocket connection error'))
        dispatch(addNotification({
          type: 'error',
          title: 'Connection Error',
          message: 'Failed to establish WebSocket connection',
          duration: 8000,
        }))
      }

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      dispatch(errorOccurred('Failed to establish WebSocket connection'))
      dispatch(addNotification({
        type: 'error',
        title: 'Connection Failed',
        message: 'Unable to create WebSocket connection',
        duration: 8000,
      }))
    }
  }, [dispatch, subscriptions, reconnectAttempts, startHeartbeat, stopHeartbeat, sendMessage, handleEvent])

  // Enhanced disconnect with cleanup
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current)
      batchTimeoutRef.current = null
    }
    
    stopHeartbeat()
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }
    
    // Clear pending events
    eventBatchRef.current = []
    
    dispatch(connectionStatusChanged(ConnectionStatus.DISCONNECTED))
    dispatch(addNotification({
      type: 'info',
      title: 'Disconnected',
      message: 'Real-time connection closed',
      duration: 2000,
    }))
  }, [stopHeartbeat, dispatch])

  // Get event processing statistics
  const getProcessingStats = useCallback(() => {
    return { ...eventProcessingStatsRef.current }
  }, [])

  // Initialize WebSocket connection - TEMPORARILY DISABLED
  useEffect(() => {
    // WebSocket disabled due to backend endpoint not being available
    console.warn('🔌 WebSocket connection disabled - backend WebSocket endpoint not available')
    dispatch(connectionStatusChanged(ConnectionStatus.DISCONNECTED))
    
    // Uncomment the line below when backend WebSocket support is added
    // connect()

    return () => {
      disconnect()
    }
  }, []) // Empty dependency array - only run once

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    sendMessage,
    getProcessingStats,
  }
}

// Hook for subscribing to specific workflow events
export const useWorkflowEvents = (workflowId: string) => {
  const { subscribe, unsubscribe } = useWebSocket()

  useEffect(() => {
    const subscription: WebSocketSubscription = {
      type: WebSocketEventType.WORKFLOW_PROGRESS,
      filters: { workflowId }
    }

    const statusSubscription: WebSocketSubscription = {
      type: WebSocketEventType.STATUS_CHANGE,
      filters: { workflowId }
    }

    const errorSubscription: WebSocketSubscription = {
      type: WebSocketEventType.ERROR_OCCURRED,
      filters: { workflowId }
    }

    subscribe(subscription)
    subscribe(statusSubscription)
    subscribe(errorSubscription)

    return () => {
      unsubscribe(subscription)
      unsubscribe(statusSubscription)
      unsubscribe(errorSubscription)
    }
  }, [workflowId, subscribe, unsubscribe])
}

// Hook for subscribing to specific agent events
export const useAgentEvents = (agentId: string) => {
  const { subscribe, unsubscribe } = useWebSocket()

  useEffect(() => {
    const logSubscription: WebSocketSubscription = {
      type: WebSocketEventType.LOG_ENTRY,
      filters: { agentId }
    }

    const resultSubscription: WebSocketSubscription = {
      type: WebSocketEventType.RESULT_UPDATED,
      filters: { agentId }
    }

    const statusSubscription: WebSocketSubscription = {
      type: WebSocketEventType.STATUS_CHANGE,
      filters: { agentId }
    }

    const metricSubscription: WebSocketSubscription = {
      type: WebSocketEventType.METRIC_UPDATE,
      filters: { agentId }
    }

    subscribe(logSubscription)
    subscribe(resultSubscription)
    subscribe(statusSubscription)
    subscribe(metricSubscription)

    return () => {
      unsubscribe(logSubscription)
      unsubscribe(resultSubscription)
      unsubscribe(statusSubscription)
      unsubscribe(metricSubscription)
    }
  }, [agentId, subscribe, unsubscribe])
}

// Hook for system-wide event monitoring
export const useSystemEvents = () => {
  const { subscribe, unsubscribe } = useWebSocket()

  useEffect(() => {
    const metricSubscription: WebSocketSubscription = {
      type: WebSocketEventType.METRIC_UPDATE,
      filters: {} // No filters = system-wide
    }

    const errorSubscription: WebSocketSubscription = {
      type: WebSocketEventType.ERROR_OCCURRED,
      filters: {} // No filters = system-wide
    }

    subscribe(metricSubscription)
    subscribe(errorSubscription)

    return () => {
      unsubscribe(metricSubscription)
      unsubscribe(errorSubscription)
    }
  }, [subscribe, unsubscribe])
}
