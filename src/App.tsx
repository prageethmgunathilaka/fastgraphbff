import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Box } from '@mui/material'
import { Helmet } from 'react-helmet-async'

import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard/Dashboard'
import { Analytics, AgentManagement, Reports, Settings, WorkflowMonitoring } from './pages'

// WebSocket connection management
import { useWebSocket } from './hooks/useWebSocket'

const App: React.FC = () => {
  // Initialize WebSocket connections
  useWebSocket()

  return (
    <>
      <Helmet>
        <title>Advanced Analytics Dashboard - LangGraph Agent Management</title>
        <meta name="description" content="Real-time monitoring and analytics for LangGraph agent workflows" />
      </Helmet>
      
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Layout>
          <Routes>
            {/* Default redirect to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Main application routes */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/workflows" element={<WorkflowMonitoring />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/agents" element={<AgentManagement />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            
            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
      </Box>
    </>
  )
}

export default App
