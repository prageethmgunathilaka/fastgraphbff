// Core system types for the Advanced Analytics Dashboard

export interface Workflow {
  id: string
  name: string
  description?: string
  status: WorkflowStatus
  createdAt: string
  updatedAt: string
  completedAt?: string
  progress: number
  estimatedTimeRemaining?: number
  priority: Priority
  tags: string[]
  agents: Agent[]
  metrics: WorkflowMetrics
  creator: string
  configuration: WorkflowConfiguration
  // Additional properties used in the application
  completedTasks?: number
  totalTasks?: number
  currentPhase?: string
  statusChangeReason?: string
  metadata?: Record<string, any>
  statusHistory?: { status: WorkflowStatus; timestamp: string; reason?: string; previousStatus?: string; metadata?: Record<string, any> }[]
}

export interface Agent {
  id: string
  workflowId: string
  name: string
  description?: string // Added description property
  type: AgentType
  status: AgentStatus
  createdAt: string
  updatedAt: string
  completedAt?: string
  progress: number
  capabilities: string[]
  tools: string[]
  executionContext: ExecutionContext
  performance: AgentPerformance
  logs: LogEntry[]
  results: AgentResult[]
  // Additional properties used in the application
  statusHistory?: { status: AgentStatus; timestamp: string; reason?: string; previousStatus?: string }[]
  statusChangeReason?: string
  metadata?: Record<string, any>
  currentPhase?: string
  estimatedTimeRemaining?: number
}

export interface WorkflowMetrics {
  totalExecutionTime: number
  averageAgentResponseTime: number
  successRate: number
  errorCount: number
  resourceUtilization: ResourceUtilization
  businessImpact: BusinessImpact
}

export interface AgentPerformance {
  executionTime: number
  responseTime: number
  successRate: number
  errorCount: number
  resourceUsage: ResourceUsage
  qualityScore: number
}

export interface BusinessImpact {
  costSavings: number
  efficiencyGain: number
  roi: number
  timeToCompletion: number
  qualityImprovement: number
}

export interface ResourceUtilization {
  cpu: number
  memory: number
  network: number
  storage: number
}

export interface ResourceUsage {
  cpu: number
  memory: number
  apiCalls: number
  tokens: number
}

export interface ExecutionContext {
  environment: string
  version: string
  configuration: Record<string, any>
  dependencies: string[]
}

export interface WorkflowConfiguration {
  timeout: number
  retryCount: number
  parallelExecution: boolean
  parameters: Record<string, any>
}

export interface LogEntry {
  id: string
  agentId: string
  workflowId?: string // Added workflowId property
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, any>
  error?: ErrorInfo
}

export interface AgentResult {
  id: string
  agentId: string
  workflowId?: string // Added workflowId property
  timestamp: string
  type: ResultType
  data: any
  metadata: Record<string, any>
  quality: QualityMetrics
  // Additional properties used for performance tracking
  executionTime?: number
  memoryUsage?: number
  cpuUsage?: number
}

export interface QualityMetrics {
  accuracy: number
  completeness: number
  relevance: number
  confidence: number
}

export interface ErrorInfo {
  code: string
  message: string
  stack?: string
  context?: Record<string, any>
}

// Enums
export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum AgentStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  WAITING = 'waiting',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout'
}

export enum AgentType {
  ANALYSIS = 'analysis',
  PROCESSING = 'processing',
  MONITORING = 'monitoring',
  OPTIMIZATION = 'optimization',
  COMMUNICATION = 'communication',
  VALIDATION = 'validation'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export enum ResultType {
  DATA = 'data',
  METRIC = 'metric',
  INSIGHT = 'insight',
  RECOMMENDATION = 'recommendation',
  ALERT = 'alert'
}
