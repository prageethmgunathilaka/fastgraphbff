// Environment utilities for handling Vite environment variables
// This abstraction makes it easier to mock in tests

export const getApiBaseUrl = (): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (globalThis as any).import?.meta?.env !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envUrl = (globalThis as any).import.meta.env.VITE_API_BASE_URL
    const fallbackUrl = 'https://jux81vgip4.execute-api.us-east-1.amazonaws.com' // Updated fallback to correct URL
    const resultUrl = envUrl || fallbackUrl
    console.log('🔧 Environment check:', { envUrl, fallbackUrl, resultUrl }) // Debug log
    return resultUrl
  }
  // Fallback for test environments (also updated to correct URL)
  console.log('🔧 Using test environment fallback URL') // Debug log
  return 'https://jux81vgip4.execute-api.us-east-1.amazonaws.com'
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