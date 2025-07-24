import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  timestamp: string
  read: boolean
  duration?: number // Optional duration in milliseconds for auto-dismiss
  actions?: { label: string; action: string }[]
}

interface UIState {
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  sidebarWidth: number
  notifications: Notification[]
  modals: {
    workflowDetails: { open: boolean; workflowId?: string }
    agentDetails: { open: boolean; agentId?: string }
    settings: { open: boolean }
    createWorkflow: { open: boolean }
  }
  loading: {
    global: boolean
    workflows: boolean
    agents: boolean
    analytics: boolean
  }
  layout: {
    dashboardLayout: 'grid' | 'list'
    chartType: 'line' | 'bar' | 'area'
    refreshInterval: number
  }
}

const initialState: UIState = {
  theme: 'light',
  sidebarOpen: true,
  sidebarWidth: 280,
  notifications: [],
  modals: {
    workflowDetails: { open: false },
    agentDetails: { open: false },
    settings: { open: false },
    createWorkflow: { open: false },
  },
  loading: {
    global: false,
    workflows: false,
    agents: false,
    analytics: false,
  },
  layout: {
    dashboardLayout: 'grid',
    chartType: 'line',
    refreshInterval: 5000,
  },
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light'
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
    setSidebarWidth: (state, action: PayloadAction<number>) => {
      state.sidebarWidth = action.payload
    },
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp' | 'read'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        read: false,
      }
      state.notifications.unshift(notification)
      // Keep only last 100 notifications
      if (state.notifications.length > 100) {
        state.notifications = state.notifications.slice(0, 100)
      }
    },
    markNotificationRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload)
      if (notification) {
        notification.read = true
      }
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload)
    },
    clearNotifications: (state) => {
      state.notifications = []
    },
    openModal: (state, action: PayloadAction<{ modal: keyof UIState['modals']; data?: any }>) => {
      const { modal, data } = action.payload
      state.modals[modal] = { open: true, ...data }
    },
    closeModal: (state, action: PayloadAction<keyof UIState['modals']>) => {
      state.modals[action.payload] = { open: false }
    },
    setLoading: (state, action: PayloadAction<{ key: keyof UIState['loading']; loading: boolean }>) => {
      state.loading[action.payload.key] = action.payload.loading
    },
    updateLayout: (state, action: PayloadAction<Partial<UIState['layout']>>) => {
      state.layout = { ...state.layout, ...action.payload }
    },
  },
})

export const {
  toggleTheme,
  toggleSidebar,
  setSidebarWidth,
  addNotification,
  markNotificationRead,
  removeNotification,
  clearNotifications,
  openModal,
  closeModal,
  setLoading,
  updateLayout,
} = uiSlice.actions

export default uiSlice.reducer
