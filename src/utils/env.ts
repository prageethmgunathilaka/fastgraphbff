// Environment utilities for handling Vite environment variables
// This abstraction makes it easier to mock in tests

export const getApiBaseUrl = (): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (globalThis as any).import?.meta?.env !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).import.meta.env.VITE_API_BASE_URL || 'https://api.fastgraph.example.com/v1'
  }
  // Fallback for test environments
  return 'https://api.fastgraph.example.com/v1'
}

export const getWebSocketUrl = (): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (globalThis as any).import?.meta?.env !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).import.meta.env.VITE_WS_URL || 'wss://jux81vgip4.execute-api.us-east-1.amazonaws.com/ws'
  }
  // Fallback for test environments
  return 'wss://jux81vgip4.execute-api.us-east-1.amazonaws.com/ws'
}

export const isProduction = (): boolean => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (globalThis as any).import?.meta?.env !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).import.meta.env.PROD || false
  }
  // Fallback for test environments
  return false
} 