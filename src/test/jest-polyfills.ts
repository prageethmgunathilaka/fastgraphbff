/**
 * Jest Polyfills
 * Sets up necessary globals for MSW and other browser APIs
 * This runs BEFORE setupFilesAfterEnv to ensure globals are available during imports
 */

import 'whatwg-fetch'
import { TextEncoder, TextDecoder } from 'util'

// Add Node.js globals to jsdom environment  
Object.assign(global, {
  TextEncoder,
  TextDecoder,
})

// Mock performance API if not available
if (typeof global.performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
  } as any
}

// Mock crypto API for Node.js compatibility
if (typeof global.crypto === 'undefined') {
  global.crypto = {
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    },
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    },
  } as any
} 