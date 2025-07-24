import React from 'react'
import { render, screen, waitFor, act } from '../utils-jest'
import { useWebSocket, useWorkflowEvents, useAgentEvents, useSystemEvents } from '../../hooks/useWebSocket'
import { useAppSelector } from '../../store'
import { 
  selectProcessingStats, 
  selectConnectionHealth, 
  selectRecentErrors,
  selectActiveEventProcessing 
} from '../../store/slices/websocketSlice'
import { selectWorkflowStats, selectRealTimeUpdates } from '../../store/slices/workflowSlice'
import { selectAgentStats } from '../../store/slices/agentSlice'
import { selectSystemHealth, selectSystemMetrics } from '../../store/slices/analyticsSlice'
import { 
  WebSocketEventType, 
  ConnectionStatus, 
  ErrorSeverity 
} from '../../types/websocket'
import { WorkflowStatus, AgentStatus } from '../../types/core'
import { MockWebSocket } from '../utils-jest'

// Test component for WebSocket functionality
const WebSocketTestComponent: React.FC<{ testId: string }> = ({ testId }) => {
  const { isConnected, connectionStatus, getProcessingStats } = useWebSocket()
  const processingStats = useAppSelector(selectProcessingStats)
  const connectionHealth = useAppSelector(selectConnectionHealth)
  const activeProcessing = useAppSelector(selectActiveEventProcessing)
  const recentErrors = useAppSelector(selectRecentErrors)
  
  const workflowStats = useAppSelector(selectWorkflowStats)
  const agentStats = useAppSelector(selectAgentStats)
  const systemHealth = useAppSelector(selectSystemHealth)
  const systemMetrics = useAppSelector(selectSystemMetrics)
  
  return (
    <div data-testid={testId}>
      <div data-testid="connection-status">{connectionStatus}</div>
      <div data-testid="is-connected">{isConnected.toString()}</div>
      <div data-testid="active-processing">{activeProcessing.toString()}</div>
      <div data-testid="total-processed">{processingStats.totalProcessed}</div>
      <div data-testid="total-errors">{processingStats.totalErrors}</div>
      <div data-testid="avg-processing-time">{processingStats.averageProcessingTime}</div>
      <div data-testid="connection-healthy">{connectionHealth.isHealthy.toString()}</div>
      <div data-testid="error-rate">{connectionHealth.errorRate}</div>
      <div data-testid="recent-errors-count">{recentErrors.length}</div>
      <div data-testid="workflow-stats">{JSON.stringify(workflowStats)}</div>
      <div data-testid="agent-stats">{JSON.stringify(agentStats)}</div>
      <div data-testid="system-health">{JSON.stringify(systemHealth)}</div>
      <div data-testid="system-metrics">{JSON.stringify(systemMetrics)}</div>
    </div>
  )
}

// Test component for workflow-specific events
const WorkflowEventsTestComponent: React.FC<{ workflowId: string }> = ({ workflowId }) => {
  useWorkflowEvents(workflowId)
  const realTimeUpdates = useAppSelector(selectRealTimeUpdates)
  
  return (
    <div data-testid="workflow-events-test">
      <div data-testid="last-progress-update">{realTimeUpdates.lastProgressUpdate}</div>
      <div data-testid="last-status-change">{realTimeUpdates.lastStatusChange}</div>
      <div data-testid="updates-received">{realTimeUpdates.updatesReceived}</div>
      <div data-testid="active-updates">{realTimeUpdates.activeUpdates.length}</div>
    </div>
  )
}

// Test component for agent-specific events
const AgentEventsTestComponent: React.FC<{ agentId: string }> = ({ agentId }) => {
  useAgentEvents(agentId)
  return <div data-testid="agent-events-test">Agent Events Active</div>
}

// Test component for system-wide events
const SystemEventsTestComponent: React.FC = () => {
  useSystemEvents()
  return <div data-testid="system-events-test">System Events Active</div>
}

describe('Enhanced WebSocket Integration Tests', () => {
  let mockWebSocket: MockWebSocket
  
  beforeEach(() => {
    mockWebSocket = new MockWebSocket()
    global.WebSocket = jest.fn(() => mockWebSocket) as any
  })

  afterEach(() => {
    mockWebSocket.close()
    jest.clearAllMocks()
  })

  describe('Connection Management', () => {
    it('should establish connection and track connection quality', async () => {
      render(<WebSocketTestComponent testId="connection-test" />)
      
      // Simulate successful connection
      act(() => {
        mockWebSocket.simulateOpen()
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('connected')
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true')
        expect(screen.getByTestId('connection-healthy')).toHaveTextContent('true')
      })
    })

    it('should handle connection loss and reconnection', async () => {
      render(<WebSocketTestComponent testId="reconnection-test" />)
      
      // Connect first
      act(() => {
        mockWebSocket.simulateOpen()
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true')
      })
      
      // Simulate connection loss
      act(() => {
        mockWebSocket.simulateClose(1006, 'Connection lost')
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected')
        expect(screen.getByTestId('is-connected')).toHaveTextContent('false')
      })
    })

    it('should track connection quality metrics', async () => {
      render(<WebSocketTestComponent testId="quality-test" />)
      
      act(() => {
        mockWebSocket.simulateOpen()
      })
      
      // Simulate heartbeat with round-trip time
      act(() => {
        mockWebSocket.simulateMessage({
          type: 'heartbeat_response',
          timestamp: new Date().toISOString(),
          sessionId: 'test-session',
          data: { roundTripTime: 150 }
        })
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-healthy')).toHaveTextContent('true')
      })
    })
  })

  describe('Event Processing - All 6 Event Types', () => {
    beforeEach(async () => {
      render(<WebSocketTestComponent testId="event-processing-test" />)
      
      act(() => {
        mockWebSocket.simulateOpen()
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true')
      })
    })

    it('should process WORKFLOW_PROGRESS events with validation', async () => {
      const progressEvent = {
        type: WebSocketEventType.WORKFLOW_PROGRESS,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          workflowId: 'workflow-1',
          progress: 45,
          estimatedTimeRemaining: 300,
          completedTasks: 9,
          totalTasks: 20,
          currentPhase: 'data-processing'
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(progressEvent)
      })

      await waitFor(() => {
        expect(screen.getByTestId('total-processed')).toHaveTextContent('1')
        expect(screen.getByTestId('total-errors')).toHaveTextContent('0')
      })

      // Test with invalid data
      const invalidProgressEvent = {
        type: WebSocketEventType.WORKFLOW_PROGRESS,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          // Missing workflowId
          progress: 'invalid', // Invalid progress type
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(invalidProgressEvent)
      })

      await waitFor(() => {
        expect(screen.getByTestId('total-errors')).toHaveTextContent('1')
        expect(screen.getByTestId('recent-errors-count')).toHaveTextContent('1')
      })
    })

    it('should process STATUS_CHANGE events for workflows and agents', async () => {
      // Workflow status change
      const workflowStatusEvent = {
        type: WebSocketEventType.STATUS_CHANGE,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          entityId: 'workflow-1',
          entityType: 'workflow',
          previousStatus: 'running',
          newStatus: WorkflowStatus.COMPLETED,
          reason: 'All tasks completed successfully',
          metadata: { completionTime: 1200 }
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(workflowStatusEvent)
      })

      // Agent status change
      const agentStatusEvent = {
        type: WebSocketEventType.STATUS_CHANGE,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          entityId: 'agent-1',
          entityType: 'agent',
          previousStatus: 'running',
          newStatus: AgentStatus.COMPLETED,
          reason: 'Processing finished',
          metadata: { processedItems: 150 }
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(agentStatusEvent)
      })

      await waitFor(() => {
        expect(screen.getByTestId('total-processed')).toHaveTextContent('2')
        expect(screen.getByTestId('total-errors')).toHaveTextContent('0')
      })
    })

    it('should process RESULT_UPDATED events', async () => {
      const resultEvent = {
        type: WebSocketEventType.RESULT_UPDATED,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          workflowId: 'workflow-1',
          agentId: 'agent-1',
          result: {
            id: 'result-1',
            data: { processedCount: 100 },
            timestamp: new Date().toISOString(),
            success: true
          },
          isComplete: true
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(resultEvent)
      })

      await waitFor(() => {
        expect(screen.getByTestId('total-processed')).toHaveTextContent('1')
      })
    })

    it('should process ERROR_OCCURRED events with severity handling', async () => {
      // Critical error
      const criticalErrorEvent = {
        type: WebSocketEventType.ERROR_OCCURRED,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          workflowId: 'workflow-1',
          agentId: 'agent-1',
          error: {
            code: 'CRITICAL_FAILURE',
            message: 'System critical failure detected',
            severity: ErrorSeverity.CRITICAL,
            stack: 'Error stack trace...'
          },
          isRecoverable: false,
          retryCount: 0
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(criticalErrorEvent)
      })

      // Medium severity error
      const mediumErrorEvent = {
        type: WebSocketEventType.ERROR_OCCURRED,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          workflowId: 'workflow-1',
          error: {
            code: 'DATA_VALIDATION_ERROR',
            message: 'Data validation failed',
            severity: ErrorSeverity.MEDIUM
          },
          isRecoverable: true,
          retryCount: 1
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(mediumErrorEvent)
      })

      await waitFor(() => {
        expect(screen.getByTestId('total-processed')).toHaveTextContent('2')
        expect(screen.getByTestId('recent-errors-count')).toHaveTextContent('0') // These are system errors, not processing errors
      })
    })

    it('should process METRIC_UPDATE events with batch processing', async () => {
      const metricsEvent = {
        type: WebSocketEventType.METRIC_UPDATE,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          workflowId: 'workflow-1',
          agentId: 'agent-1',
          metrics: [
            {
              name: 'cpu_usage',
              value: 75.5,
              unit: 'percent',
              trend: 'up',
              timestamp: new Date().toISOString()
            },
            {
              name: 'memory_usage',
              value: 512,
              unit: 'MB',
              trend: 'stable',
              timestamp: new Date().toISOString()
            },
            {
              name: 'processing_rate',
              value: 150,
              unit: 'items/sec',
              trend: 'up',
              timestamp: new Date().toISOString()
            }
          ]
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(metricsEvent)
      })

      await waitFor(() => {
        expect(screen.getByTestId('total-processed')).toHaveTextContent('1')
        expect(screen.getByTestId('system-metrics')).toContain('eventProcessing')
      })

      // Test with invalid metrics
      const invalidMetricsEvent = {
        type: WebSocketEventType.METRIC_UPDATE,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          metrics: [] // Empty metrics array
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(invalidMetricsEvent)
      })

      await waitFor(() => {
        expect(screen.getByTestId('total-errors')).toHaveTextContent('1')
      })
    })

    it('should process LOG_ENTRY events', async () => {
      const logEvent = {
        type: WebSocketEventType.LOG_ENTRY,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          workflowId: 'workflow-1',
          agentId: 'agent-1',
          logEntry: {
            id: 'log-1',
            level: 'info',
            message: 'Processing data chunk 1/10',
            timestamp: new Date().toISOString(),
            metadata: { chunkSize: 1000 }
          }
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(logEvent)
      })

      await waitFor(() => {
        expect(screen.getByTestId('total-processed')).toHaveTextContent('1')
        expect(screen.getByTestId('total-errors')).toHaveTextContent('0')
      })
    })
  })

  describe('Event Validation and Error Handling', () => {
    beforeEach(async () => {
      render(<WebSocketTestComponent testId="validation-test" />)
      
      act(() => {
        mockWebSocket.simulateOpen()
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true')
      })
    })

    it('should reject malformed events', async () => {
      // Missing required fields
      const malformedEvent = {
        type: 'invalid_type',
        // Missing timestamp and sessionId
        data: {}
      }

      act(() => {
        mockWebSocket.simulateMessage(malformedEvent)
      })

      await waitFor(() => {
        expect(screen.getByTestId('total-processed')).toHaveTextContent('0')
        expect(screen.getByTestId('total-errors')).toHaveTextContent('0') // Rejected before processing
      })
    })

    it('should handle JSON parsing errors gracefully', async () => {
      act(() => {
        mockWebSocket.simulateInvalidMessage('invalid json {')
      })

      await waitFor(() => {
        expect(screen.getByTestId('total-processed')).toHaveTextContent('0')
      })
    })

    it('should track processing performance', async () => {
      const events = Array.from({ length: 5 }, (_, i) => ({
        type: WebSocketEventType.WORKFLOW_PROGRESS,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          workflowId: `workflow-${i}`,
          progress: i * 20
        }
      }))

      // Send events in quick succession
      events.forEach(event => {
        act(() => {
          mockWebSocket.simulateMessage(event)
        })
      })

      await waitFor(() => {
        expect(screen.getByTestId('total-processed')).toHaveTextContent('5')
        expect(screen.getByTestId('avg-processing-time')).not.toHaveTextContent('0')
      })
    })
  })

  describe('Batch Processing and Performance', () => {
    beforeEach(async () => {
      render(<WebSocketTestComponent testId="batch-test" />)
      
      act(() => {
        mockWebSocket.simulateOpen()
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true')
      })
    })

    it('should batch process multiple events efficiently', async () => {
      const batchSize = 15 // Exceeds default batch size of 10
      const events = Array.from({ length: batchSize }, (_, i) => ({
        type: WebSocketEventType.METRIC_UPDATE,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          workflowId: 'workflow-1',
          metrics: [{
            name: `metric-${i}`,
            value: i * 10,
            unit: 'count',
            trend: 'up',
            timestamp: new Date().toISOString()
          }]
        }
      }))

      // Send all events at once
      events.forEach(event => {
        act(() => {
          mockWebSocket.simulateMessage(event)
        })
      })

      await waitFor(() => {
        expect(screen.getByTestId('total-processed')).toHaveTextContent(batchSize.toString())
        expect(screen.getByTestId('total-errors')).toHaveTextContent('0')
      }, { timeout: 2000 })
    })

    it('should handle high-frequency events without blocking UI', async () => {
      const highFrequencyEvents = Array.from({ length: 50 }, (_, i) => ({
        type: WebSocketEventType.LOG_ENTRY,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          workflowId: 'workflow-1',
          agentId: 'agent-1',
          logEntry: {
            id: `log-${i}`,
            level: 'debug',
            message: `High frequency log entry ${i}`,
            timestamp: new Date().toISOString()
          }
        }
      }))

      // Simulate rapid event stream
      highFrequencyEvents.forEach((event, index) => {
        setTimeout(() => {
          act(() => {
            mockWebSocket.simulateMessage(event)
          })
        }, index * 10) // 10ms intervals
      })

      await waitFor(() => {
        expect(screen.getByTestId('total-processed')).toHaveTextContent('50')
      }, { timeout: 3000 })
    })
  })

  describe('Subscription Management', () => {
    it('should handle workflow-specific subscriptions', async () => {
      const workflowId = 'test-workflow-123'
      render(<WorkflowEventsTestComponent workflowId={workflowId} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('workflow-events-test')).toBeInTheDocument()
      })

      // Simulate workflow progress event
      act(() => {
        mockWebSocket.simulateOpen()
      })

      const progressEvent = {
        type: WebSocketEventType.WORKFLOW_PROGRESS,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          workflowId,
          progress: 75
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(progressEvent)
      })

      await waitFor(() => {
        expect(screen.getByTestId('updates-received')).not.toHaveTextContent('0')
      })
    })

    it('should handle agent-specific subscriptions', async () => {
      const agentId = 'test-agent-456'
      render(<AgentEventsTestComponent agentId={agentId} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('agent-events-test')).toBeInTheDocument()
      })
    })

    it('should handle system-wide subscriptions', async () => {
      render(<SystemEventsTestComponent />)
      
      await waitFor(() => {
        expect(screen.getByTestId('system-events-test')).toBeInTheDocument()
      })
    })
  })

  describe('Error Recovery and Resilience', () => {
    beforeEach(async () => {
      render(<WebSocketTestComponent testId="resilience-test" />)
      
      act(() => {
        mockWebSocket.simulateOpen()
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true')
      })
    })

    it('should recover from event processing errors', async () => {
      // Send a valid event first
      const validEvent = {
        type: WebSocketEventType.WORKFLOW_PROGRESS,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          workflowId: 'workflow-1',
          progress: 50
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(validEvent)
      })

      // Send an invalid event
      const invalidEvent = {
        type: WebSocketEventType.WORKFLOW_PROGRESS,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          // Missing workflowId
          progress: 'invalid'
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(invalidEvent)
      })

      // Send another valid event
      const anotherValidEvent = {
        type: WebSocketEventType.WORKFLOW_PROGRESS,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          workflowId: 'workflow-2',
          progress: 75
        }
      }

      act(() => {
        mockWebSocket.simulateMessage(anotherValidEvent)
      })

      await waitFor(() => {
        expect(screen.getByTestId('total-processed')).toHaveTextContent('2') // Two valid events
        expect(screen.getByTestId('total-errors')).toHaveTextContent('1') // One invalid event
      })
    })

    it('should maintain performance under error conditions', async () => {
      // Mix of valid and invalid events
      const mixedEvents = [
        {
          type: WebSocketEventType.WORKFLOW_PROGRESS,
          timestamp: new Date().toISOString(),
          sessionId: 'test-session',
          data: { workflowId: 'wf-1', progress: 25 }
        },
        {
          type: WebSocketEventType.WORKFLOW_PROGRESS,
          timestamp: new Date().toISOString(),
          sessionId: 'test-session',
          data: { /* missing workflowId */ progress: 'invalid' }
        },
        {
          type: WebSocketEventType.STATUS_CHANGE,
          timestamp: new Date().toISOString(),
          sessionId: 'test-session',
          data: { entityId: 'wf-1', entityType: 'workflow', newStatus: 'completed' }
        },
        {
          type: WebSocketEventType.METRIC_UPDATE,
          timestamp: new Date().toISOString(),
          sessionId: 'test-session',
          data: { metrics: [] } // Invalid empty metrics
        }
      ]

      mixedEvents.forEach(event => {
        act(() => {
          mockWebSocket.simulateMessage(event)
        })
      })

      await waitFor(() => {
        expect(screen.getByTestId('total-processed')).toHaveTextContent('2') // Two valid events
        expect(screen.getByTestId('total-errors')).toHaveTextContent('2') // Two invalid events
        expect(screen.getByTestId('connection-healthy')).toHaveTextContent('true') // Still healthy
      })
    })
  })

  describe('System Health Monitoring', () => {
    beforeEach(async () => {
      render(<WebSocketTestComponent testId="health-test" />)
      
      act(() => {
        mockWebSocket.simulateOpen()
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true')
      })
    })

    it('should track system health metrics', async () => {
      // Send multiple successful events
      const successfulEvents = Array.from({ length: 10 }, (_, i) => ({
        type: WebSocketEventType.WORKFLOW_PROGRESS,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: {
          workflowId: `workflow-${i}`,
          progress: i * 10
        }
      }))

      successfulEvents.forEach(event => {
        act(() => {
          mockWebSocket.simulateMessage(event)
        })
      })

      await waitFor(() => {
        expect(screen.getByTestId('total-processed')).toHaveTextContent('10')
        expect(screen.getByTestId('error-rate')).toHaveTextContent('0') // No errors
        expect(screen.getByTestId('connection-healthy')).toHaveTextContent('true')
      })

      // Now introduce some errors
      const errorEvents = Array.from({ length: 2 }, () => ({
        type: WebSocketEventType.WORKFLOW_PROGRESS,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        data: { /* missing required fields */ }
      }))

      errorEvents.forEach(event => {
        act(() => {
          mockWebSocket.simulateMessage(event)
        })
      })

      await waitFor(() => {
        const errorRate = parseFloat(screen.getByTestId('error-rate').textContent || '0')
        expect(errorRate).toBeGreaterThan(0)
        expect(errorRate).toBeLessThan(0.5) // Should still be reasonable
      })
    })
  })
}) 