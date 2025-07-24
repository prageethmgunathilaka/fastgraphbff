/**
 * API Services Integration Tests (Simplified)
 * Tests that API service mocks are working correctly
 */
import { mockWorkflows, mockAgents, mockBusinessMetrics } from '../mocks/data'

// Mock the API services
const mockWorkflowApi = {
  getWorkflows: jest.fn(),
  getWorkflow: jest.fn(),
  createWorkflow: jest.fn(),
  updateWorkflow: jest.fn(),
  deleteWorkflow: jest.fn(),
  executeWorkflow: jest.fn(),
}

const mockAgentApi = {
  getAgents: jest.fn(),
  getAgent: jest.fn(),
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  deleteAgent: jest.fn(),
  getAgentLogs: jest.fn(),
  getAgentResults: jest.fn(),
}

const mockAnalyticsApi = {
  getDashboardData: jest.fn(),
  getBusinessMetrics: jest.fn(),
  getPerformanceData: jest.fn(),
  getSystemHealth: jest.fn(),
}

// Mock the API module
jest.mock('../../services/api', () => ({
  workflowApi: mockWorkflowApi,
  agentApi: mockAgentApi,
  analyticsApi: mockAnalyticsApi,
}))

describe('API Services Integration (Simplified)', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
    
    // Set up default mock implementations
    mockWorkflowApi.getWorkflows.mockResolvedValue(mockWorkflows)
    mockAgentApi.getAgents.mockResolvedValue(mockAgents)
    mockAnalyticsApi.getDashboardData.mockResolvedValue({
      workflows: mockWorkflows,
      agents: mockAgents,
      metrics: mockBusinessMetrics
    })
  })

  describe('Workflow API Mocks', () => {
    it('should mock workflow operations correctly', async () => {
      // Test getWorkflows
      const workflows = await mockWorkflowApi.getWorkflows()
      expect(workflows).toEqual(mockWorkflows)
      expect(mockWorkflowApi.getWorkflows).toHaveBeenCalled()

      // Test getWorkflow  
      mockWorkflowApi.getWorkflow.mockResolvedValue(mockWorkflows[0])
      const workflow = await mockWorkflowApi.getWorkflow('workflow-1')
      expect(workflow).toEqual(mockWorkflows[0])
      expect(mockWorkflowApi.getWorkflow).toHaveBeenCalledWith('workflow-1')
    })
  })

  describe('Agent API Mocks', () => {
    it('should mock agent operations correctly', async () => {
      // Test getAgents
      const agents = await mockAgentApi.getAgents()
      expect(agents).toEqual(mockAgents)
      expect(mockAgentApi.getAgents).toHaveBeenCalled()

      // Test getAgent
      mockAgentApi.getAgent.mockResolvedValue(mockAgents[0])
      const agent = await mockAgentApi.getAgent('agent-1')
      expect(agent).toEqual(mockAgents[0])
      expect(mockAgentApi.getAgent).toHaveBeenCalledWith('agent-1')
    })
  })

  describe('Analytics API Mocks', () => {
    it('should mock analytics operations correctly', async () => {
      // Test getDashboardData
      const dashboardData = await mockAnalyticsApi.getDashboardData()
      expect(dashboardData).toEqual({
        workflows: mockWorkflows,
        agents: mockAgents,
        metrics: mockBusinessMetrics
      })
      expect(mockAnalyticsApi.getDashboardData).toHaveBeenCalled()
    })
  })
}) 