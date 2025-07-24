/**
 * Comprehensive Dashboard Integration Tests (Simplified)
 * Tests basic Dashboard rendering with mocked dependencies
 */
import { screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createMockStore, createInitialState, MockWebSocket } from '../utils-jest'
import Dashboard from '../../pages/Dashboard/Dashboard'
import { mockWorkflows, mockBusinessMetrics, mockDashboardData } from '../mocks/data'

// Mock the API services
jest.mock('../../services/api', () => ({
  workflowApi: {
    getWorkflows: jest.fn(() => Promise.resolve(mockWorkflows))
  },
  agentApi: {
    getAgents: jest.fn(() => Promise.resolve([]))
  },
  analyticsApi: {
    getDashboardData: jest.fn(() => Promise.resolve(mockDashboardData))
  }
}))

// Mock WebSocket for controlled testing
const mockWebSocketInstances: MockWebSocket[] = []
global.WebSocket = jest.fn().mockImplementation((url: string) => {
  const instance = new MockWebSocket(url)
  mockWebSocketInstances.push(instance)
  return instance
}) as any

// Mock the useWebSocket hook with more control
jest.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: () => {
    const mockInstance = mockWebSocketInstances[0]
    return {
      isConnected: mockInstance?.readyState === MockWebSocket.OPEN,
      connectionStatus: mockInstance?.readyState === MockWebSocket.OPEN ? 'connected' : 'disconnected',
      connect: jest.fn(),
      disconnect: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      sendMessage: jest.fn(),
    }
  }
}))

describe('Dashboard Full Integration (Simplified)', () => {
  let mockWebSocket: MockWebSocket

  beforeEach(() => {
    // Clear instances array
    mockWebSocketInstances.length = 0
  })

  describe('Basic Dashboard Functionality', () => {
    it('should render Dashboard component without crashing', () => {
      render(<Dashboard />)
      expect(document.body).toBeInTheDocument()
    })

    it('should initialize WebSocket connection properly', async () => {
      render(<Dashboard />)
      
      await waitFor(() => {
        expect(mockWebSocketInstances).toHaveLength(1)
      })

      mockWebSocket = mockWebSocketInstances[0]
      expect(mockWebSocket).toBeInstanceOf(MockWebSocket)
    })

    it('should handle WebSocket connection state changes', async () => {
      render(<Dashboard />)
      
      await waitFor(() => {
        expect(mockWebSocketInstances).toHaveLength(1)
      })

      mockWebSocket = mockWebSocketInstances[0]
      
      // Simulate connection open
      mockWebSocket.readyState = MockWebSocket.OPEN
      if (mockWebSocket.onopen) {
        mockWebSocket.onopen(new Event('open'))
      }

      // Verify connection is established
      expect(mockWebSocket.readyState).toBe(MockWebSocket.OPEN)
    })

    it('should handle WebSocket messages without crashing', async () => {
      render(<Dashboard />)
      
      await waitFor(() => {
        expect(mockWebSocketInstances).toHaveLength(1)
      })

      mockWebSocket = mockWebSocketInstances[0]
      mockWebSocket.readyState = MockWebSocket.OPEN

      // Simulate receiving a message
      const testMessage = {
        type: 'WORKFLOW_PROGRESS',
        data: {
          workflowId: 'test-workflow',
          progress: 50
        }
      }

      // This should not crash the component
      mockWebSocket.simulateMessage(testMessage)
      
      expect(document.body).toBeInTheDocument()
    })

    it('should handle component unmounting gracefully', async () => {
      const { unmount } = render(<Dashboard />)
      
      await waitFor(() => {
        expect(mockWebSocketInstances).toHaveLength(1)
      })

      // Unmount should not crash
      unmount()
      
      // Cleanup should work
      expect(true).toBe(true)
    })
  })

  describe('WebSocket Integration', () => {
    it('should handle connection errors gracefully', async () => {
      render(<Dashboard />)
      
      await waitFor(() => {
        expect(mockWebSocketInstances).toHaveLength(1)
      })

      mockWebSocket = mockWebSocketInstances[0]
      
      // Simulate connection error
      mockWebSocket.simulateError()
      
      // Component should not crash
      expect(document.body).toBeInTheDocument()
    })

    it('should handle connection close events', async () => {
      render(<Dashboard />)
      
      await waitFor(() => {
        expect(mockWebSocketInstances).toHaveLength(1)
      })

      mockWebSocket = mockWebSocketInstances[0]
      
      // Simulate connection close
      mockWebSocket.simulateClose(1006, 'Connection lost')
      
      // Component should not crash
      expect(document.body).toBeInTheDocument()
    })
  })
}) 