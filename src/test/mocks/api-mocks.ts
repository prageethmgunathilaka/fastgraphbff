/**
 * Simple API Mocks for Jest
 * Replaces MSW with direct Jest mocking of API services
 */
import { mockWorkflows, mockAgents, mockBusinessMetrics, mockAnalyticsData } from './data'

// Mock the API services directly
export const createApiMocks = () => {
  // Mock workflowApi
  jest.mock('../../services/api', () => ({
    workflowApi: {
      getWorkflows: jest.fn(() => Promise.resolve(mockWorkflows)),
      getWorkflow: jest.fn((id: string) => 
        Promise.resolve(mockWorkflows.find(w => w.id === id))
      ),
      createWorkflow: jest.fn((data: any) => 
        Promise.resolve({ ...data, id: 'new-workflow', status: 'pending' })
      ),
      updateWorkflow: jest.fn((id: string, data: any) => 
        Promise.resolve({ ...mockWorkflows[0], ...data })
      ),
      deleteWorkflow: jest.fn(() => Promise.resolve()),
      executeWorkflow: jest.fn((id: string) => 
        Promise.resolve({ success: true, executionId: 'exec-123' })
      ),
    },
    
    // Mock agentApi  
    agentApi: {
      getAgents: jest.fn(() => Promise.resolve(mockAgents)),
      getAgent: jest.fn((id: string) => 
        Promise.resolve(mockAgents.find(a => a.id === id))
      ),
      createAgent: jest.fn((data: any) => 
        Promise.resolve({ ...data, id: 'new-agent', status: 'idle' })
      ),
      updateAgent: jest.fn((id: string, data: any) => 
        Promise.resolve({ ...mockAgents[0], ...data })
      ),
      deleteAgent: jest.fn(() => Promise.resolve()),
      getAgentLogs: jest.fn(() => Promise.resolve([
        { id: '1', message: 'Agent started', timestamp: Date.now(), level: 'info' }
      ])),
      getAgentResults: jest.fn(() => Promise.resolve([
        { id: '1', data: { success: true }, timestamp: Date.now() }
      ])),
    },

    // Mock analyticsApi
    analyticsApi: {
      getDashboardData: jest.fn(() => Promise.resolve({
        workflows: mockWorkflows,
        agents: mockAgents,
        metrics: mockBusinessMetrics
      })),
      getBusinessMetrics: jest.fn(() => Promise.resolve(mockBusinessMetrics)),
      getPerformanceData: jest.fn(() => Promise.resolve(mockAnalyticsData.performance)),
      getSystemHealth: jest.fn(() => Promise.resolve({
        status: 'healthy',
        uptime: 99.9,
        lastCheck: Date.now()
      })),
    }
  }))
}

// Helper to reset all mocks
export const resetApiMocks = () => {
  jest.clearAllMocks()
} 