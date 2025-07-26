import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// Custom plugin to handle SPA routing fallback
const spaFallbackPlugin = () => {
  return {
    name: 'spa-fallback',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const { url } = req
        
        // Skip API routes, assets, and files with extensions
        if (
          url.startsWith('/api') ||
          url.includes('.') ||
          url.startsWith('/@') ||
          url.startsWith('/node_modules')
        ) {
          return next()
        }
        
        // For all other routes, serve index.html
        req.url = '/index.html'
        next()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), spaFallbackPlugin()],
  server: {
    port: 3002,
    host: 'localhost',
    open: false,
    strictPort: true,
    hmr: false, // Disable Hot Module Replacement
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  // Configure SPA fallback for client-side routing
  preview: {
    port: 3002,
    host: 'localhost',
    strictPort: true,
  },
})
