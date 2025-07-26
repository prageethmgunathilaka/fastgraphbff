import { configureStore } from '@reduxjs/toolkit'
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
import { isProduction } from '../utils/env'

import workflowSlice from './slices/workflowSlice'
import agentSlice from './slices/agentSlice'
import websocketSlice from './slices/websocketSlice'
import analyticsSlice from './slices/analyticsSlice'
import uiSlice from './slices/uiSlice'

export const store = configureStore({
  reducer: {
    workflows: workflowSlice,
    agents: agentSlice,
    websocket: websocketSlice,
    analytics: analyticsSlice,
    ui: uiSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['websocket/eventReceived'],
        ignoredPaths: ['websocket.eventBuffer'],
      },
    }),
  devTools: !isProduction(),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Typed hooks for use throughout the app
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

export default store
