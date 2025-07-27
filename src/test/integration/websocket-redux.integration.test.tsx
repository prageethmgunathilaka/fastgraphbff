/**
 * Integration tests for WebSocket + Redux functionality
 * Tests real-time event handling and state updates
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { renderHook, act, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { useWebSocket } from '../../hooks/useWebSocket'
import { createMockStore, MockWebSocket } from '../utils'
import { WebSocketEventType, WebSocketEvent } from '../../types/websocket'
import { WorkflowStatus } from '../../types/core'

// Mock WebSocket globally
const mockWebSocketInstances: MockWebSocket[] = []
global.WebSocket = jest.fn().mockImplementation((url: string) => {
  const instance = new MockWebSocket(url)
  mockWebSocketInstances.push(instance)
  return instance
}) as any

describe('WebSocket + Redux Integration', () => {
  let store: ReturnType<typeof createMockStore>
  let mockWebSocket: MockWebSocket

  beforeEach(() => {
    store = createMockStore()
    mockWebSocketInstances.length = 0
  })

  afterEach(() => {
    mockWebSocketInstances.forEach(ws => ws.close())
    jest.clearAllMocks()
  })

  const renderWebSocketHook = () => {
    return renderHook(() => useWebSocket(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
    })
  }

  const setupWebSocketConnection = async (result: any) => {
    // Wait for the useEffect to automatically create the WebSocket connection
    await waitFor(() => {
      expect(mockWebSocketInstances.length).toBeGreaterThan(0)
    })

    // Use the most recent WebSocket instance (in case of reconnects)
    return mockWebSocketInstances[mockWebSocketInstances.length - 1]
  }

  describe('Connection Management', () => {
    it('should establish WebSocket connection and update Redux state', async () => {
      const { result } = renderWebSocketHook()
      
      mockWebSocket = await setupWebSocketConnection(result)
      
      // Initially disconnected
      expect(result.current.isConnected).toBe(false)
      expect(store.getState().websocket.connectionStatus).toBe('connecting')

      // Simulate connection opening
      act(() => {
        mockWebSocket.readyState = MockWebSocket.OPEN
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'))
        }
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
        expect(store.getState().websocket.connectionStatus).toBe('connected')
      })
    })

    it('should handle connection failures and retry logic', async () => {
      jest.useFakeTimers()
      
      const { result } = renderWebSocketHook()
      
      mockWebSocket = await setupWebSocketConnection(result)

      // Simulate connection error
      act(() => {
        mockWebSocket.simulateError()
      })

      await waitFor(() => {
        expect(store.getState().websocket.error).toBeDefined()
      })

      // Simulate connection close (triggers reconnection)
      act(() => {
        mockWebSocket.simulateClose(1006, 'Connection lost')
      })

      // Advance timers to trigger reconnection attempt
      act(() => {
        jest.advanceTimersByTime(1000) // First reconnect happens after 1 second
      })

      await waitFor(() => {
        expect(store.getState().websocket.connectionStatus).toBe('reconnecting')
        expect(store.getState().websocket.reconnectAttempts).toBeGreaterThan(0)
      })
      
      jest.useRealTimers()
    })
  })

  describe('Event Processing', () => {
    beforeEach(async () => {
      const { result } = renderWebSocketHook()
      
      mockWebSocket = await setupWebSocketConnection(result)
      mockWebSocket.readyState = MockWebSocket.OPEN
    })

    it('should process workflow_progress events and update workflow state', async () => {
      const progressEvent: WebSocketEvent = {
        type: WebSocketEventType.WORKFLOW_PROGRESS,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-123',
        data: {
          workflowId: 'workflow-1',
          progress: 75
        }
      }

      // First add a workflow to the store
      act(() => {
        store.dispatch({
          type: 'workflows/fetchWorkflows/fulfilled',
          payload: {
            workflows: [{
              id: 'workflow-1',
              name: 'Test Workflow',
              progress: 50,
              status: WorkflowStatus.RUNNING
            }],
            total: 1
          }
        })
      })

      // Send progress update via WebSocket
      act(() => {
        mockWebSocket.simulateMessage(progressEvent)
      })

      await waitFor(() => {
        const workflow = store.getState().workflows.workflows['workflow-1']
        expect(workflow.progress).toBe(75)
        expect(store.getState().websocket.eventBuffer).toHaveLength(1)
        expect(store.getState().websocket.eventBuffer[0].type).toBe(WebSocketEventType.WORKFLOW_PROGRESS)
      })
    })

    it('should process status_change events for workflows and agents', async () => {
      const statusChangeEvent: WebSocketEvent = {
        type: WebSocketEventType.STATUS_CHANGE,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-123',
        data: {
          entityType: 'workflow',
          entityId: 'workflow-1',
          oldStatus: 'running',
          newStatus: 'completed'
        }
      }

      // Add workflow to store
      act(() => {
        store.dispatch({
          type: 'workflows/fetchWorkflows/fulfilled',
          payload: {
            workflows: [{
              id: 'workflow-1',
              name: 'Test Workflow',
              status: WorkflowStatus.RUNNING
            }],
            total: 1
          }
        })
      })

      // Send status change via WebSocket
      act(() => {
        mockWebSocket.simulateMessage(statusChangeEvent)
      })

      await waitFor(() => {
        const workflow = store.getState().workflows.workflows['workflow-1']
        expect(workflow.status).toBe(WorkflowStatus.COMPLETED)
      })
    })

    it('should process result_updated events and show notifications', async () => {
      const resultEvent: WebSocketEvent = {
        type: WebSocketEventType.RESULT_UPDATED,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-123',
        data: {
          agentId: 'agent-1',
          workflowId: 'workflow-1',
          result: {
            id: 'result-1',
            data: { success: true },
            quality: { accuracy: 95.5 }
          },
          isComplete: true
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(resultEvent)
      })

      await waitFor(() => {
        const notifications = store.getState().ui.notifications
        expect(notifications.length).toBeGreaterThanOrEqual(1)
        const agentCompletedNotification = notifications.find(n => n.title === 'Agent Completed')
        expect(agentCompletedNotification).toBeDefined()
        expect(agentCompletedNotification!.type).toBe('success')
      })
    })

    it('should process error_occurred events and show error notifications', async () => {
      const errorEvent: WebSocketEvent = {
        type: WebSocketEventType.ERROR_OCCURRED,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-123',
        data: {
          workflowId: 'workflow-1',
          agentId: 'agent-1',
          error: {
            code: 'EXECUTION_ERROR',
            message: 'Agent execution failed due to timeout',
            severity: 'critical',
            context: { timeout: 5000 }
          }
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(errorEvent)
      })

      await waitFor(() => {
        const notifications = store.getState().ui.notifications
        expect(notifications.length).toBeGreaterThanOrEqual(1)
        const errorNotification = notifications.find(n => n.message === 'Agent execution failed due to timeout')
        expect(errorNotification).toBeDefined()
        expect(errorNotification!.type).toBe('error')
      })
    })

    it('should process metric_update events and update analytics', async () => {
      const metricEvent: WebSocketEvent = {
        type: WebSocketEventType.METRIC_UPDATE,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-123',
        data: {
          workflowId: 'workflow-1',
          metrics: [
            {
              name: 'cpu_usage',
              value: 85.5,
              timestamp: new Date().toISOString(),
              unit: 'percent'
            },
            {
              name: 'memory_usage',
              value: 1024,
              timestamp: new Date().toISOString(),
              unit: 'MB'
            }
          ]
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(metricEvent)
      })

      await waitFor(() => {
        const analytics = store.getState().analytics
        expect(analytics.systemMetrics.performance).toHaveProperty('cpuUsage')
        expect(analytics.systemMetrics.performance).toHaveProperty('memoryUsage')
      })
    })

    it('should process log_entry events and update agent logs', async () => {
      const logEvent: WebSocketEvent = {
        type: WebSocketEventType.LOG_ENTRY,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-123',
        data: {
          agentId: 'agent-1',
          logEntry: {
            id: 'log-1',
            agentId: 'agent-1',
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Processing customer data',
            context: { customers: 1000 }
          }
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(logEvent)
      })

      await waitFor(() => {
        const agents = store.getState().agents
        // Verify log was added to agent state
        expect(store.getState().websocket.eventBuffer).toHaveLength(1)
      })
    })
  })

  describe('Subscription Management', () => {
    let hookResult: any

    beforeEach(async () => {
      hookResult = renderWebSocketHook()
      
      mockWebSocket = await setupWebSocketConnection(hookResult)
      
      // Ensure WebSocket is open and ready for subscriptions
      act(() => {
        mockWebSocket.simulateOpen()
      })
    })

    it('should manage subscriptions correctly', async () => {
      await waitFor(() => {
        expect(hookResult.result.current.isConnected).toBe(true)
      })

      // Test subscription
      act(() => {
        hookResult.result.current.subscribe({
          type: WebSocketEventType.WORKFLOW_PROGRESS,
          filters: { workflowId: 'workflow-1' }
        })
      })

      await waitFor(() => {
        expect(store.getState().websocket.subscriptions).toHaveLength(1)
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            action: 'subscribe',
            subscriptions: [{
              type: WebSocketEventType.WORKFLOW_PROGRESS,
              filters: { workflowId: 'workflow-1' }
            }]
          })
        )
      })

      // Test unsubscription
      act(() => {
        hookResult.result.current.unsubscribe({
          type: WebSocketEventType.WORKFLOW_PROGRESS,
          filters: { workflowId: 'workflow-1' }
        })
      })

      await waitFor(() => {
        expect(store.getState().websocket.subscriptions).toHaveLength(0)
      })
    })
  })

  describe('Heartbeat Management', () => {
    it('should send heartbeat messages periodically', async () => {
      jest.useFakeTimers()
      
      const { result } = renderWebSocketHook()
      
      mockWebSocket = await setupWebSocketConnection(result)
      
      // Ensure WebSocket is open and heartbeat is started
      act(() => {
        mockWebSocket.simulateOpen()
      })

      // Fast forward 30 seconds to trigger heartbeat
      act(() => {
        jest.advanceTimersByTime(30000)
      })

      await waitFor(() => {
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({ action: 'heartbeat' })
        )
      })

      jest.useRealTimers()
    })
  })
}) 