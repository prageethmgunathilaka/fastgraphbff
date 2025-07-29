import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import { agentApi } from '../../services/api'
import { Agent } from '../../types/core'

// Extended interface for API response format
interface ApiAgent extends Agent {
  agent_type: string
  workflow_id: string
  status_description: string
  created_at: string
  last_activity: string
  llm_config?: {
    provider?: string
    model?: string
    temperature?: number
  }
  tasks?: any[]
  child_agents?: any[]
}

const AgentManagement: React.FC = () => {
  const [agents, setAgents] = useState<ApiAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  
  // Delete agent state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [agentToDelete, setAgentToDelete] = useState<ApiAgent | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fetchAgents = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    if (!showRefreshing) setLoading(true)
    setError(null)

    try {
      const response = await agentApi.getAgents()
      setAgents((response.agents || []) as ApiAgent[])
    } catch (err: any) {
      console.error('Failed to fetch agents:', err)
      setError(err?.message || 'Failed to load agents')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [])

  const handleRefresh = () => {
    fetchAgents(true)
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return 'success'
      case 'idle':
        return 'default'
      case 'failed':
      case 'timeout':
        return 'error'
      case 'waiting':
        return 'warning'
      case 'completed':
        return 'success'
      default:
        return 'default'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const handleOpenDeleteAgent = (agent: ApiAgent) => {
    setAgentToDelete(agent)
    setDeleteError(null)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteAgent = () => {
    setDeleteDialogOpen(false)
    setAgentToDelete(null)
    setDeleteError(null)
  }

  const handleDeleteAgent = async () => {
    if (!agentToDelete) return
    
    setDeleteLoading(true)
    setDeleteError(null)
    
    try {
      console.log('🗑️ Deleting agent:', agentToDelete.id)
      await agentApi.deleteAgent(agentToDelete.id)
      console.log('✅ Agent deleted successfully')
      
      // Close dialog
      handleCloseDeleteAgent()
      
      // Refresh agents list
      fetchAgents(true)
      
    } catch (error) {
      console.error('❌ Error deleting agent:', error)
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete agent')
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading agents...
        </Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => fetchAgents()} startIcon={<RefreshIcon />}>
          Retry
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          Agent Management
        </Typography>
        <Button
          variant="outlined"
          startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary">
                {agents.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Agents
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                {agents.filter(a => a.status.toLowerCase() === 'active').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                {agents.filter(a => a.status.toLowerCase() === 'idle').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Idle
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="error.main">
                {agents.filter(a => ['error', 'failed'].includes(a.status.toLowerCase())).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Error/Failed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Agents Table */}
      {agents.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" textAlign="center">
              No agents found. Create some agents in your workflows to see them here.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Agent</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Workflow</TableCell>
                <TableCell>LLM Model</TableCell>
                <TableCell>Capabilities</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <PersonIcon color="primary" sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {agent.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {agent.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {agent.id.substring(0, 8)}...
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={agent.status}
                      color={getStatusColor(agent.status) as any}
                      size="small"
                    />
                    <Typography variant="caption" display="block" color="text.secondary">
                      {agent.status_description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {agent.workflow_id ? agent.workflow_id.substring(0, 8) + '...' : 'None'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {agent.llm_config ? (
                      <Box>
                        <Typography variant="body2">
                          {agent.llm_config.provider || 'Unknown'} / {agent.llm_config.model || 'Unknown'}
                        </Typography>
                        {agent.llm_config.temperature && (
                          <Typography variant="caption" color="text.secondary">
                            Temp: {agent.llm_config.temperature}
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Not configured
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box>
                      {agent.capabilities && agent.capabilities.length > 0 ? (
                        agent.capabilities.slice(0, 2).map((cap, index) => (
                          <Chip
                            key={index}
                            label={cap}
                            size="small"
                            variant="outlined"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          None
                        </Typography>
                      )}
                      {agent.capabilities && agent.capabilities.length > 2 && (
                        <Typography variant="caption" color="text.secondary">
                          +{agent.capabilities.length - 2} more
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(agent.created_at)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Last: {formatDate(agent.last_activity)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex">
                      <IconButton
                        size="small"
                        color={agent.status === 'running' ? 'error' : 'success'}
                        title={agent.status === 'running' ? 'Stop Agent' : 'Start Agent'}
                      >
                        {agent.status === 'running' ? <StopIcon /> : <PlayIcon />}
                      </IconButton>
                      <IconButton size="small" color="primary" title="Settings">
                        <SettingsIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error" 
                        title="Delete Agent"
                        onClick={() => handleOpenDeleteAgent(agent)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* Delete Agent Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={handleCloseDeleteAgent}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main' }}>
          Delete Agent
        </DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete this agent? This action cannot be undone.
          </Typography>
          
          {agentToDelete && (
            <Box sx={{ p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Agent to delete:
              </Typography>
              <Typography variant="body2">
                <strong>{agentToDelete.name}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {agentToDelete.description}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ID: {agentToDelete.id}
              </Typography>
            </Box>
          )}
          
          <Typography variant="body2" color="error.main" sx={{ mt: 2, fontWeight: 500 }}>
            ⚠️ This will permanently delete the agent and all its associated data.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDeleteAgent}
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteAgent}
            variant="contained"
            color="error"
            disabled={deleteLoading}
            startIcon={<DeleteIcon />}
          >
            {deleteLoading ? 'Deleting...' : 'Delete Agent'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default AgentManagement 