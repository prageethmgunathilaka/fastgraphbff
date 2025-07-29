import { Workflow, Agent, WorkflowStatus, AgentStatus, AgentType, Priority } from '../../types/core'

export const mockWorkflows: Workflow[] = []

export const mockAgents: Agent[] = []

export const mockDashboardData = {
  activeAgents: 12,
  systemHealth: 95,
  totalWorkflows: mockWorkflows.length,
  runningWorkflows: mockWorkflows.filter(w => w.status === WorkflowStatus.RUNNING).length,
  completedWorkflows: mockWorkflows.filter(w => w.status === WorkflowStatus.COMPLETED).length,
  failedWorkflows: mockWorkflows.filter(w => w.status === WorkflowStatus.FAILED).length
}

export const mockBusinessMetrics = {
  roi: 245.8,
  costSavings: 140000,
  efficiencyGain: 42.5,
  qualityScore: 9.1
}

export const mockAnalyticsData = {
  dashboardData: mockDashboardData,
  businessMetrics: mockBusinessMetrics,
  performanceMetrics: {
    averageExecutionTime: 2400,
    successRate: 89.5,
    errorRate: 10.5,
    throughput: 25.5
  }
} 