import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import { configureStore, Store } from '@reduxjs/toolkit'
import { vi } from 'vitest'

import theme from '../theme'
import workflowSlice from '../store/slices/workflowSlice'
import agentSlice from '../store/slices/agentSlice'
import analyticsSlice from '../store/slices/analyticsSlice'
import websocketSlice from '../store/slices/websocketSlice'
import uiSlice from '../store/slices/uiSlice'
import { RootState } from '../store'

// Mock store creator for testing
export const createMockStore = (initialState?: Partial<RootState>): Store => {
  return configureStore({
    reducer: {
      workflows: workflowSlice,
      agents: agentSlice,
      analytics: analyticsSlice,
      websocket: websocketSlice,
      ui: uiSlice,
    },
    preloadedState: initialState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        },
      }),
  })
}

// Test wrapper with all providers
interface AllTheProvidersProps {
  children: React.ReactNode
  store?: Store
  initialEntries?: string[]
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({ 
  children, 
  store, 
  initialEntries = ['/dashboard']
}) => {
  const testStore = store || createMockStore()
  
  return (
    <Provider store={testStore}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  )
}

// Custom render function with providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    store?: Store
    initialEntries?: string[]
  }
) => {
  const { store, initialEntries, ...renderOptions } = options || {}
  
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders store={store} initialEntries={initialEntries}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  })
}

// Mock WebSocket for testing
export class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(public url: string) {
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) {
        this.onopen(new Event('open'))
      }
    }, 10)
  }

  send = vi.fn()
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: 1000, reason: 'Test close' }))
    }
  })

  // Helper methods for testing
  simulateMessage(data: any) {
    if (this.onmessage && this.readyState === MockWebSocket.OPEN) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }))
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
  }

  simulateClose(code = 1000, reason = 'Test close') {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }))
    }
  }
}

// Helper to create initial state for tests
export const createInitialState = (overrides?: Partial<RootState>): Partial<RootState> => ({
  workflows: {
    workflows: {},
    loading: false,
    error: null,
    selectedWorkflowId: null,
    filters: {
      status: [],
      priority: [],
      searchQuery: '',
      tags: [],
    },
    pagination: {
      page: 1,
      pageSize: 20,
      total: 0,
    },
  },
  agents: {
    agents: {},
    loading: false,
    error: null,
    selectedAgentId: null,
  },
  analytics: {
    dashboardData: {
      activeAgents: 0,
      systemHealth: 100,
    },
    businessMetrics: {
      roi: 0,
      costSavings: 0,
      efficiencyGain: 0,
      qualityScore: 0,
    },
    performanceMetrics: {},
    loading: false,
    error: null,
  },
  websocket: {
    isConnected: false,
    connectionStatus: 'disconnected' as any,
    subscriptions: [],
    events: [],
    errors: [],
    reconnectAttempts: 0,
    lastHeartbeat: null,
  },
  ui: {
    sidebarOpen: true,
    sidebarWidth: 280,
    theme: 'light',
    notifications: [],
  },
  ...overrides,
})

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }
export { MockWebSocket } 