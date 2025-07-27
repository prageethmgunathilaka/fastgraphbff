import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  LinearProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material'
import {
  Add as AddIcon,
  PersonAdd as PersonAddIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  SmartToy as BotIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CompleteIcon,
  Error as ErrorIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material'
import { useAppSelector, useAppDispatch } from '../../store'
import { fetchWorkflows } from '../../store/slices/workflowSlice'
import { fetchAgents } from '../../store/slices/agentSlice'
import { workflowApi, agentApi } from '../../services/api'
import { formatDistanceToNow } from 'date-fns'

const Workflows: React.FC = () => {
  const dispatch = useAppDispatch()
  const { workflows, loading, error } = useAppSelector((state) => state.workflows)
  const { agents } = useAppSelector((state) => state.agents)
  
  // Local state for create workflow dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    type: 'analysis' as 'analysis' | 'processing' | 'automation',
  })
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Local state for create agent dialog
  const [createAgentDialogOpen, setCreateAgentDialogOpen] = useState(false)
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)
  const [newAgent, setNewAgent] = useState({
    name: '',
    description: '',
    type: 'main' as 'main' | 'child' | 'worker',
    capabilities: '',
    tools: ''
  })
  const [createAgentLoading, setCreateAgentLoading] = useState(false)
  const [createAgentError, setCreateAgentError] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchWorkflows())
    dispatch(fetchAgents())
  }, [dispatch])

  const handleRefresh = () => {
    dispatch(fetchWorkflows())
    dispatch(fetchAgents())
  }

  // Helper function to calculate agent count for a specific workflow
  const getAgentCountForWorkflow = (workflowId: string): number => {
    const standaloneAgents = Object.values(agents)
    return standaloneAgents.filter(agent => agent.workflow_id === workflowId).length
  }

  const handleCreateWorkflow = async () => {
    setCreateLoading(true)
    setCreateError(null)
    
    try {
      // Create new workflow via API
      const response = await fetch('https://jux81vgip4.execute-api.us-east-1.amazonaws.com/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newWorkflow.name,
          description: newWorkflow.description,
          priority: newWorkflow.priority,
          type: newWorkflow.type,
          status: 'pending',
          progress: 0,
          agents: [], // Start with no agents
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to create workflow: ${response.statusText}`)
      }

      await response.json()
      
      // Close dialog and reset form
      setCreateDialogOpen(false)
      setNewWorkflow({
        name: '',
        description: '',
        priority: 'medium',
        type: 'analysis',
      })
      
      // Refresh workflows list
      dispatch(fetchWorkflows())
      
    } catch (error) {
      console.error('Error creating workflow:', error)
      setCreateError(error instanceof Error ? error.message : 'Failed to create workflow')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleOpenCreateAgent = (workflowId: string) => {
    setSelectedWorkflowId(workflowId)
    setNewAgent({
      name: '',
      description: '',
      type: 'main',
      capabilities: '',
      tools: ''
    })
    setCreateAgentError(null)
    setCreateAgentDialogOpen(true)
  }

  const handleCloseCreateAgent = () => {
    setCreateAgentDialogOpen(false)
    setSelectedWorkflowId(null)
    setNewAgent({
      name: '',
      description: '',
      type: 'main',
      capabilities: '',
      tools: ''
    })
    setCreateAgentError(null)
  }

  const handleExecuteWorkflow = async (workflowId: string) => {
    console.log('🚀 Execute workflow called for ID:', workflowId)
    try {
      const result = await workflowApi.executeWorkflow(workflowId)
      console.log('✅ Execute API response:', result)

      // Refresh workflows to show updated status
      dispatch(fetchWorkflows())
      console.log('🔄 Refreshing workflows after execution')
      
    } catch (error) {
      console.error('❌ Error executing workflow:', error)
      // You could add a toast notification here
    }
  }

  const handleCancelWorkflow = async (workflowId: string) => {
    console.log('🛑 Cancel workflow called for ID:', workflowId)
    try {
      await workflowApi.cancelWorkflow(workflowId)
      console.log('✅ Workflow cancelled successfully')

      // Refresh workflows to show updated status
      dispatch(fetchWorkflows())
      console.log('🔄 Refreshing workflows after cancellation')
      
    } catch (error) {
      console.error('❌ Error canceling workflow:', error)
      // You could add a toast notification here
    }
  }

  const handleCreateAgent = async () => {
    console.log('🚀 handleCreateAgent called')
    console.log('📝 selectedWorkflowId:', selectedWorkflowId)
    console.log('📝 newAgent.name:', newAgent.name)
    
    if (!selectedWorkflowId || !newAgent.name.trim()) {
      console.log('❌ Missing selectedWorkflowId or agent name')
      return
    }
    
    setCreateAgentLoading(true)
    setCreateAgentError(null)
    
    try {
      // Create agent data following real API spec
      const agentData = {
        name: newAgent.name.trim(),
        description: newAgent.description.trim() || "",
        agent_type: newAgent.type,
        llm_config: {
          provider: "openai",
          model: "gpt-4",
          api_key: "sk-placeholder-key",
          temperature: 0.7,
          max_tokens: 1000,
          additional_config: {}
        },
        mcp_connections: [],
        max_child_agents: 5,
        capabilities: newAgent.capabilities.split(',').map(c => c.trim()).filter(c => c.length > 0),
        config: {
          tools: newAgent.tools.split(',').map(t => t.trim()).filter(t => t.length > 0)
        }
      }

      console.log('📦 agentData:', agentData)
      console.log('🌐 Calling agentApi.createAgent...')

      // Create agent via API service
      const createdAgent = await agentApi.createAgent(selectedWorkflowId, agentData)
      
      console.log('✅ Agent created successfully:', createdAgent)
      console.log('✅ Agent assigned to workflow:', selectedWorkflowId)
      
      // Close dialog and refresh
      handleCloseCreateAgent()
      console.log('🔄 Refreshing workflows to update agent count...')
      await dispatch(fetchWorkflows())
      console.log('🔄 Workflows refreshed!')
      
    } catch (error) {
      console.error('❌ Error creating agent:', error)
      setCreateAgentError(error instanceof Error ? error.message : 'Failed to create agent')
    } finally {
      setCreateAgentLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running': return 'primary'
      case 'completed': return 'success'
      case 'failed': return 'error'
      case 'paused': return 'warning'
      case 'pending': return 'inherit'
      default: return 'inherit'
    }
  }

  const getChipStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running': return 'primary'
      case 'completed': return 'success'
      case 'failed': return 'error'
      case 'paused': return 'warning'
      case 'pending': return 'default'
      default: return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running': return <PlayIcon />
      case 'completed': return <CompleteIcon />
      case 'failed': return <ErrorIcon />
      case 'paused': return <PauseIcon />
      case 'pending': return <ScheduleIcon />
      default: return <ScheduleIcon />
    }
  }

  const workflowList = Object.values(workflows)

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Workflows
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Workflow
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <LinearProgress sx={{ mb: 3 }} />
      )}

      {/* Workflows Grid */}
      {workflowList.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 6 }}>
          <CardContent>
            <BotIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No workflows found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create your first workflow to get started with automated agent tasks
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Your First Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {workflowList.map((workflow) => (
            <Grid item xs={12} key={workflow.id}>
              <Card 
                sx={{ 
                  height: 255,
                  display: 'flex', 
                  flexDirection: 'row',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 3,
                  transition: 'all 0.2s ease-in-out',
                  overflow: 'hidden',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: 4,
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                {/* Left Section - Main Info */}
                <Box sx={{ flex: '2', p: 3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  {/* Header */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <Typography 
                        variant="h5" 
                        component="h2" 
                        sx={{ 
                          fontWeight: 700,
                          fontSize: '1.25rem',
                          lineHeight: 1.2,
                          flex: 1,
                          pr: 2
                        }}
                      >
                        {workflow.name}
                      </Typography>
                      <IconButton size="small">
                        <MoreIcon />
                      </IconButton>
                    </Box>
                    
                    {/* Description */}
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        lineHeight: 1.4,
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {workflow.description || 'No description provided'}
                    </Typography>

                    {/* Status and Priority - Horizontal */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Chip
                        icon={getStatusIcon(workflow.status)}
                        label={workflow.status}
                        color={getChipStatusColor(workflow.status)}
                        size="small"
                        sx={{ fontWeight: 500 }}
                      />
                      <Chip
                        label={workflow.priority || 'medium'}
                        size="small"
                        variant="outlined"
                        color={workflow.priority === 'high' ? 'error' : workflow.priority === 'low' ? 'default' : 'warning'}
                      />
                    </Box>
                  </Box>
                </Box>

                {/* Center Section - Progress */}
                <Box sx={{ 
                  flex: '1', 
                  p: 3, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center',
                  borderLeft: '1px solid',
                  borderRight: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'grey.25'
                }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary' }}>
                      Progress
                    </Typography>
                    <Typography 
                      variant="h3" 
                      sx={{ 
                        fontWeight: 800, 
                        color: 'primary.main',
                        fontSize: '2.5rem',
                        lineHeight: 1,
                        mb: 1
                      }}
                    >
                      {workflow.progress || 0}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={workflow.progress || 0}
                      color={getStatusColor(workflow.status)}
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: 'grey.300'
                      }}
                    />
                  </Box>
                </Box>

                {/* Right Section - Metrics & Actions */}
                <Box sx={{ flex: '1', p: 2.5, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 1.5 }}>
                  {/* Agents */}
                  <Box sx={{ display: 'flex', alignItems: 'center', p: 1.5, backgroundColor: 'primary.light', borderRadius: 2 }}>
                    <BotIcon sx={{ fontSize: 24, mr: 1.5, color: 'primary.main' }} />
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1, color: 'primary.main' }}>
                        {getAgentCountForWorkflow(workflow.id)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                        agents
                      </Typography>
                    </Box>
                  </Box>

                  {/* Add Agents Button */}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PersonAddIcon />}
                    sx={{ 
                      borderColor: 'primary.main',
                      color: 'primary.main',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      py: 0.5,
                      '&:hover': { 
                        backgroundColor: 'primary.light',
                        borderColor: 'primary.dark'
                      }
                    }}
                    onClick={() => handleOpenCreateAgent(workflow.id)}
                  >
                    Add Agent
                  </Button>

                  {/* Last Updated */}
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      Last Updated
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                      {workflow.updatedAt ? formatDistanceToNow(new Date(workflow.updatedAt), { addSuffix: true }) : 'Unknown'}
                    </Typography>
                  </Box>

                  {/* Action Buttons */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                    {/* Icon Actions Row */}
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                      <IconButton 
                        size="small" 
                        sx={{ 
                          backgroundColor: 'primary.main',
                          color: 'white',
                          '&:hover': { backgroundColor: 'primary.dark' }
                        }}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small"
                        sx={{ 
                          backgroundColor: 'grey.300',
                          '&:hover': { backgroundColor: 'grey.400' }
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      {(workflow.status === 'paused' || workflow.status === 'pending' || workflow.status === 'failed') && (
                        <IconButton 
                          size="small" 
                          sx={{ 
                            backgroundColor: 'success.main',
                            color: 'white',
                            '&:hover': { backgroundColor: 'success.dark' }
                          }}
                          onClick={() => handleExecuteWorkflow(workflow.id)}
                          title="Run Workflow"
                        >
                          <PlayIcon fontSize="small" />
                        </IconButton>
                      )}
                      {workflow.status === 'running' && (
                        <IconButton 
                          size="small" 
                          sx={{ 
                            backgroundColor: 'error.main',
                            color: 'white',
                            '&:hover': { backgroundColor: 'error.dark' }
                          }}
                          onClick={() => handleCancelWorkflow(workflow.id)}
                          title="Cancel Workflow"
                        >
                          <StopIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton 
                        size="small" 
                        sx={{ 
                          backgroundColor: 'grey.300',
                          color: 'error.main',
                          '&:hover': { backgroundColor: 'error.light', color: 'white' }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Workflow Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Workflow</DialogTitle>
        <DialogContent>
          {createError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {createError}
            </Alert>
          )}
          
          <TextField
            autoFocus
            margin="dense"
            label="Workflow Name"
            fullWidth
            variant="outlined"
            value={newWorkflow.name}
            onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={newWorkflow.description}
            onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={newWorkflow.priority}
              label="Priority"
              onChange={(e) => setNewWorkflow({ ...newWorkflow, priority: e.target.value as 'low' | 'medium' | 'high' })}
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={newWorkflow.type}
              label="Type"
              onChange={(e) => setNewWorkflow({ ...newWorkflow, type: e.target.value as 'analysis' | 'processing' | 'automation' })}
            >
              <MenuItem value="analysis">Analysis</MenuItem>
              <MenuItem value="processing">Data Processing</MenuItem>
              <MenuItem value="automation">Automation</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setCreateDialogOpen(false)}
            disabled={createLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateWorkflow}
            variant="contained"
            disabled={createLoading || !newWorkflow.name.trim()}
          >
            {createLoading ? 'Creating...' : 'Create Workflow'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Agent Dialog */}
      <Dialog 
        open={createAgentDialogOpen} 
        onClose={handleCloseCreateAgent}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Create New Agent
          {selectedWorkflowId && workflows[selectedWorkflowId] && (
            <Typography variant="subtitle2" color="text.secondary">
              for {workflows[selectedWorkflowId].name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {createAgentError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {createAgentError}
            </Alert>
          )}
          
          <TextField
            autoFocus
            margin="dense"
            label="Agent Name"
            fullWidth
            variant="outlined"
            value={newAgent.name}
            onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
            sx={{ mb: 2 }}
            required
          />
          
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={2}
            variant="outlined"
            value={newAgent.description}
            onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
            sx={{ mb: 2 }}
            helperText="Describe what this agent does"
          />
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Agent Type</InputLabel>
            <Select
              value={newAgent.type}
              label="Agent Type"
              onChange={(e) => setNewAgent({ ...newAgent, type: e.target.value as any })}
            >
              <MenuItem value="main">Main Agent</MenuItem>
              <MenuItem value="child">Child Agent</MenuItem>
              <MenuItem value="worker">Worker Agent</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            margin="dense"
            label="Capabilities"
            fullWidth
            variant="outlined"
            value={newAgent.capabilities}
            onChange={(e) => setNewAgent({ ...newAgent, capabilities: e.target.value })}
            sx={{ mb: 2 }}
            helperText="Comma-separated list (e.g., data-analysis, pattern-recognition)"
          />
          
          <TextField
            margin="dense"
            label="Tools"
            fullWidth
            variant="outlined"
            value={newAgent.tools}
            onChange={(e) => setNewAgent({ ...newAgent, tools: e.target.value })}
            helperText="Comma-separated list (e.g., pandas, scikit-learn, tensorflow)"
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseCreateAgent}
            disabled={createAgentLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('🔥 BUTTON CLICKED!')
              console.log('🔥 createAgentLoading:', createAgentLoading)
              console.log('🔥 newAgent.name.trim():', newAgent.name.trim())
              console.log('🔥 disabled?', createAgentLoading || !newAgent.name.trim())
              handleCreateAgent()
            }}
            type="button"
            variant="contained"
            disabled={createAgentLoading || !newAgent.name.trim()}
            startIcon={<PersonAddIcon />}
          >
            {createAgentLoading ? 'Creating...' : 'Create Agent'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Workflows 