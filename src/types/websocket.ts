// WebSocket event types for real-time communication

import { Agent, Workflow, LogEntry, AgentResult } from './core'

// Base WebSocket event structure
export interface BaseWebSocketEvent {
  type: WebSocketEventType
  timestamp: string
  sessionId: string
  userId?: string
}

// Specific event interfaces
export interface WorkflowProgressEvent extends BaseWebSocketEvent {
  type: WebSocketEventType.WORKFLOW_PROGRESS
  data: {
    workflowId: string
    progress: number
    estimatedTimeRemaining?: number
    completedTasks: number
    totalTasks: number
    currentPhase: string
  }
}

export interface StatusChangeEvent extends BaseWebSocketEvent {
  type: WebSocketEventType.STATUS_CHANGE
  data: {
    entityId: string
    entityType: 'workflow' | 'agent'
    previousStatus: string
    newStatus: string
    reason?: string
    metadata?: Record<string, any>
  }
}

export interface ResultUpdatedEvent extends BaseWebSocketEvent {
  type: WebSocketEventType.RESULT_UPDATED
  data: {
    workflowId: string
    agentId: string
    result: AgentResult
    isComplete: boolean
  }
}

export interface ErrorOccurredEvent extends BaseWebSocketEvent {
  type: WebSocketEventType.ERROR_OCCURRED
  data: {
    workflowId: string
    agentId?: string
    error: {
      code: string
      message: string
      severity: ErrorSeverity
      stack?: string
      context?: Record<string, any>
    }
    isRecoverable: boolean
    retryCount?: number
  }
}

export interface MetricUpdateEvent extends BaseWebSocketEvent {
  type: WebSocketEventType.METRIC_UPDATE
  data: {
    workflowId?: string
    agentId?: string
    metrics: {
      name: string
      value: number
      unit: string
      trend: 'up' | 'down' | 'stable'
      timestamp: string
    }[]
  }
}

export interface LogEntryEvent extends BaseWebSocketEvent {
  type: WebSocketEventType.LOG_ENTRY
  data: {
    workflowId: string
    agentId: string
    logEntry: LogEntry
  }
}

// Union type for all WebSocket events
export type WebSocketEvent = 
  | WorkflowProgressEvent
  | StatusChangeEvent
  | ResultUpdatedEvent
  | ErrorOccurredEvent
  | MetricUpdateEvent
  | LogEntryEvent

// WebSocket connection configuration
export interface WebSocketConfig {
  url: string
  reconnectAttempts: number
  reconnectDelay: number
  heartbeatInterval: number
  subscriptions: WebSocketSubscription[]
}

export interface WebSocketSubscription {
  type: WebSocketEventType
  filters?: {
    workflowId?: string
    agentId?: string
    userId?: string
    tags?: string[]
  }
}

// WebSocket connection state
export interface WebSocketState {
  isConnected: boolean
  connectionStatus: ConnectionStatus
  lastHeartbeat?: string
  reconnectAttempts: number
  subscriptions: WebSocketSubscription[]
  eventBuffer: WebSocketEvent[]
  error?: string
}

// Enums
export enum WebSocketEventType {
  WORKFLOW_PROGRESS = 'workflow_progress',
  STATUS_CHANGE = 'status_change',
  RESULT_UPDATED = 'result_updated',
  ERROR_OCCURRED = 'error_occurred',
  METRIC_UPDATE = 'metric_update',
  LOG_ENTRY = 'log_entry'
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// WebSocket message structure for sending
export interface WebSocketMessage {
  action: WebSocketAction
  data?: any
  subscriptions?: WebSocketSubscription[]
}

export enum WebSocketAction {
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  HEARTBEAT = 'heartbeat',
  AUTHENTICATE = 'authenticate'
}
