import { Workflow, Agent, WorkflowStatus, AgentStatus, AgentType, Priority } from '../../types/core'

export const mockWorkflows: Workflow[] = [
  {
    id: 'demo-workflow-pending',
    name: 'Demo Pending Workflow',
    description: 'A demo workflow to test the run button functionality',
    status: WorkflowStatus.PENDING,
    priority: Priority.MEDIUM,
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    agents: [],
    metrics: {
      totalExecutionTime: 0,
      averageAgentResponseTime: 0,
      successRate: 0,
      errorCount: 0,
      resourceUtilization: { cpu: 0, memory: 0, network: 0, storage: 0 },
      businessImpact: {
        costSavings: 0,
        efficiencyGain: 0,
        roi: 0,
        timeToCompletion: 0,
        qualityImprovement: 0
      }
    }
  },
  {
    id: 'demo-workflow-completed',
    name: 'Demo Completed Workflow',
    description: 'A demo workflow to test the re-run button functionality',
    status: WorkflowStatus.COMPLETED,
    priority: Priority.HIGH,
    progress: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    agents: [],
    metrics: {
      totalExecutionTime: 5000,
      averageAgentResponseTime: 1200,
      successRate: 100,
      errorCount: 0,
      resourceUtilization: { cpu: 45, memory: 60, network: 30, storage: 25 },
      businessImpact: {
        costSavings: 2500,
        efficiencyGain: 35,
        roi: 180,
        timeToCompletion: 4500,
        qualityImprovement: 95
      }
    }
  }
]

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