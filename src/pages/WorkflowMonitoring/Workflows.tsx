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
  Tabs,
  Tab,
  Badge,
  Tooltip,
} from '@mui/material'
import {
  Add as AddIcon,
  PersonAdd as PersonAddIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  SmartToy as BotIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material'
import { useAppSelector, useAppDispatch } from '../../store'
import { fetchWorkflows, deleteWorkflow, updateWorkflowStatus, clearRecentlyDeleted } from '../../store/slices/workflowSlice'
import { fetchAgents, removeAgent } from '../../store/slices/agentSlice'
import { workflowApi, agentApi } from '../../services/api'
import { WorkflowStatus } from '../../types/core'
import { formatDistanceToNow } from 'date-fns'
import AgentFlowChart from '../../components/AgentFlowChart'

const Workflows: React.FC = () => {
  const dispatch = useAppDispatch()
  const { workflows, loading, error } = useAppSelector((state) => state.workflows)
  const { agents } = useAppSelector((state) => state.agents)
  
  // Tab state for workflow navigation
  const [activeTab, setActiveTab] = useState(0)
  
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

  // Local state for delete workflow dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [workflowToDelete, setWorkflowToDelete] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchWorkflows())
    dispatch(fetchAgents())
  }, [dispatch])

  // Reset active tab if workflows change and current tab is out of bounds
  // Filter out "cancelled" workflows since backend doesn't actually delete them
  const workflowList = Object.values(workflows).filter(w => w.status !== WorkflowStatus.CANCELLED)
  useEffect(() => {
    if (workflowList.length > 0 && activeTab >= workflowList.length) {
      setActiveTab(0)
    }
  }, [workflowList.length, activeTab])

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  const handleRefresh = () => {
    dispatch(fetchWorkflows())
    dispatch(fetchAgents())
  }

  // Helper function to calculate agent count for a specific workflow
  const getAgentCountForWorkflow = (workflowId: string): number => {
    const standaloneAgents = Object.values(agents)
    // Note: Agent data uses workflow_id (underscore) not workflowId (camelCase)
    return standaloneAgents.filter(agent => (agent as any).workflow_id === workflowId).length
  }

  // Get agents for a specific workflow for the flow chart
  const getAgentsForWorkflow = (workflowId: string) => {
    const standaloneAgents = Object.values(agents)
    const workflowAgents = standaloneAgents.filter(agent => (agent as any).workflow_id === workflowId)
    console.log(`🔍 getAgentsForWorkflow(${workflowId}): Found ${workflowAgents.length} agents`, workflowAgents.map(a => ({id: a.id, name: a.name})))
    return workflowAgents
  }

  // Handle agent connections in the flow chart
  const handleAgentConnect = async (sourceAgentId: string, targetAgentId: string) => {
    console.log(`🔗 Connecting agent ${sourceAgentId} to agent ${targetAgentId}`)
    
    // Prepare connection data (using snake_case to match backend format)
    const connectionData = {
      target_agent_id: targetAgentId,
      connection_type: 'data_flow', // or 'dependency', 'sequence', etc.
      metadata: {
        created_at: new Date().toISOString(),
        created_by: 'user', // Could be actual user ID
        workflow_id: Object.values(workflows).length > 0 ? Object.values(workflows)[activeTab]?.id : null
      }
    }
    
    try {
      // Save connection to backend via API
      await agentApi.connectAgents(sourceAgentId, connectionData)
      
      console.log('✅ Agent connection saved successfully')
      
      // You could also show a success toast notification here
      // dispatch(showNotification({ message: 'Agents connected successfully', type: 'success' }))
      
    } catch (error) {
      // Handle 404 gracefully - backend endpoint not implemented yet
      if ((error as any)?.response?.status === 404) {
        console.warn('⚠️ Agent connect endpoint not implemented yet - connection only exists visually')
        console.log('🔗 Connection data that would be saved:', connectionData)
        return // Don't show error, just log the warning
      }
      
      // Handle 422 validation errors - log backend response
      if ((error as any)?.response?.status === 422) {
        console.error('🔍 422 Validation Error - Backend Response:', (error as any)?.response?.data)
        console.error('🔍 Data we sent:', connectionData)
        console.error('🔍 Request URL:', (error as any)?.config?.url)
        console.error('🔍 Request Method:', (error as any)?.config?.method)
      }
      
      console.error('❌ Failed to connect agents:', error)
      
      // Handle error - could show error toast
      // dispatch(showNotification({ message: 'Failed to connect agents', type: 'error' }))
      
      // Optionally, you could remove the visual connection if the API call fails
      // This would require access to the React Flow state to remove the edge
    }
  }

  // Handle agent disconnections in the flow chart
  const handleAgentDisconnect = async (sourceAgentId: string, targetAgentId: string) => {
    console.log(`🗑️ Disconnecting agent ${sourceAgentId} from agent ${targetAgentId}`)
    
    // Prepare disconnection data (using snake_case to match backend format)
    const disconnectionData = {
      target_agent_id: targetAgentId,
      connection_type: 'data_flow', // Should match the original connection type
      metadata: {
        disconnected_at: new Date().toISOString(),
        disconnected_by: 'user', // Could be actual user ID
        workflow_id: Object.values(workflows).length > 0 ? Object.values(workflows)[activeTab]?.id : null
      }
    }
    
    try {
      // Remove connection from backend via API
      await agentApi.disconnectAgents(sourceAgentId, disconnectionData)
      
      console.log('✅ Agent connection removed successfully')
      
    } catch (error) {
      // Handle 404 gracefully - backend endpoint might not be implemented yet
      if ((error as any)?.response?.status === 404) {
        console.warn('⚠️ Agent disconnect endpoint not implemented yet - connection removed visually only')
        console.log('🔗 Disconnection data that would be sent:', disconnectionData)
        return // Don't show error, just log the warning
      }
      
      // Handle other errors
      console.error('❌ Failed to disconnect agents:', error)
      
      // Show error message to user
      console.error('Connection was removed from UI but may still exist on the server')
    }
  }

  // Handle agent node clicks in the flow chart
  const handleAgentNodeClick = (agent: any) => {
    console.log('Agent node clicked:', agent)
    // TODO: Implement agent details modal or navigation
    // Could show agent details, logs, or configuration options
  }

  // Load existing connections for an agent
  const handleLoadAgentConnections = async (agentId: string): Promise<any[]> => {
    try {
      console.log(`📡 Loading connections for agent: ${agentId}`)
      const connections = await agentApi.getAgentConnections(agentId)
      console.log(`✅ Loaded ${connections.length} connections for agent ${agentId}:`, connections)
      
      // DEBUG: Force explicit logging of connection structure
      if (connections.length > 0) {
        console.warn('🔥 CONNECTION DATA ANALYSIS:')
        console.warn('Raw connections array:', connections)
        console.warn('First connection:', connections[0])
        console.warn('Connection keys:', Object.keys(connections[0] || {}))
        
        // Test if it's the right format for React Flow
        connections.forEach((conn, index) => {
          console.warn(`Connection ${index}:`)
          console.warn(`  - target_agent_id: ${conn.target_agent_id}`)
          console.warn(`  - connection_type: ${conn.connection_type}`)
          console.warn(`  - Full object:`, JSON.stringify(conn, null, 2))
        })
      }
      
      return connections
    } catch (error) {
      // Handle 404 gracefully - backend endpoint not implemented yet
      if ((error as any)?.response?.status === 404) {
        console.warn(`⚠️ Agent connections endpoint not implemented yet for agent ${agentId}`)
        return [] // Return empty array instead of failing
      }
      console.error(`❌ Failed to load connections for agent ${agentId}:`, error)
      return []
    }
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
      // Update UI immediately for instant feedback
      dispatch(updateWorkflowStatus({ 
        workflowId, 
        status: WorkflowStatus.RUNNING 
      }))
      console.log('✅ Local workflow status updated to running')

      // Call backend API
      const result = await workflowApi.executeWorkflow(workflowId)
      console.log('✅ Workflow execution started successfully:', result)

      // Small delay to ensure backend processes the state change
      setTimeout(() => {
        dispatch(fetchWorkflows())
        console.log('🔄 Refreshing workflows after execution')
      }, 300)
      
      // Show success notification
      alert('✅ Workflow started successfully!')
      
    } catch (error) {
      console.error('❌ Error executing workflow:', error)
      console.error('❌ Error details:', {
        status: (error as any)?.response?.status,
        statusText: (error as any)?.response?.statusText,
        data: (error as any)?.response?.data,
        url: (error as any)?.config?.url,
        method: (error as any)?.config?.method
      })
      
      // Revert local status change on error
      console.log('🔄 Reverting local status change due to API error')
      dispatch(fetchWorkflows())
      
      // Show detailed error message based on status code
      let errorMsg = '❌ Failed to start workflow.'
      const status = (error as any)?.response?.status
      
      if (status === 404) {
        errorMsg = '❌ Workflow execute endpoint not found. The backend may not support workflow execution yet.'
      } else if (status === 400) {
        errorMsg = '❌ Invalid workflow request. Please check the workflow configuration.'
      } else if (status === 403) {
        errorMsg = '❌ Not authorized to execute this workflow.'
      } else if (status === 500) {
        errorMsg = '❌ Server error occurred while starting workflow.'
      } else {
        errorMsg = `❌ Failed to start workflow (${status || 'Network Error'}). Please try again or contact support.`
      }
      
      alert(errorMsg)
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
      
      // Close dialog and refresh both workflows and agents
      handleCloseCreateAgent()
      console.log('🔄 Refreshing workflows and agents to update agent count...')
      await Promise.all([
        dispatch(fetchWorkflows()),
        dispatch(fetchAgents())
      ])
      console.log('🔄 Workflows and agents refreshed!')
      
    } catch (error) {
      console.error('❌ Error creating agent:', error)
      setCreateAgentError(error instanceof Error ? error.message : 'Failed to create agent')
    } finally {
      setCreateAgentLoading(false)
    }
  }

  // Handle adding agent directly from canvas
  const handleAddAgentToCanvas = async (workflowId: string, position: { x: number; y: number }, agentData: Partial<Agent>) => {
    console.log('🎯 handleAddAgentToCanvas called')
    console.log('📝 workflowId:', workflowId)
    console.log('📍 position:', position)
    console.log('📝 agentData:', agentData)
    
    if (!agentData.name?.trim()) {
      console.log('❌ Missing agent name')
      return
    }
    
    try {
      // Convert canvas agent data to API format, similar to handleCreateAgent
      const apiAgentData = {
        name: agentData.name.trim(),
        description: agentData.description?.trim() || "",
        agent_type: "main", // Default type
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
        capabilities: Array.isArray(agentData.capabilities) 
          ? agentData.capabilities 
          : (typeof agentData.capabilities === 'string' 
              ? agentData.capabilities.split(',').map(c => c.trim()).filter(c => c.length > 0)
              : []),
        config: {
          tools: [], // Default empty tools
          // Store canvas position for future reference
          canvas_position: position
        }
      }

      console.log('📦 Canvas agentData:', apiAgentData)
      console.log('🌐 Calling agentApi.createAgent from canvas...')

      // Create agent via API service
      const createdAgent = await agentApi.createAgent(workflowId, apiAgentData)
      
      console.log('✅ Canvas agent created successfully:', createdAgent)
      console.log('✅ Canvas agent assigned to workflow:', workflowId)
      
      // Refresh both workflows and agents to show the new agent immediately
      console.log('🔄 Refreshing workflows and agents to show new canvas agent...')
      await Promise.all([
        dispatch(fetchWorkflows()),
        dispatch(fetchAgents())
      ])
      console.log('🔄 Workflows and agents refreshed!')
      
    } catch (error) {
      console.error('❌ Error creating canvas agent:', error)
      // You might want to show a toast notification here
    }
  }

  // Handle deleting agent directly from canvas
  const handleDeleteAgentFromCanvas = async (agentId: string) => {
    console.log('🗑️ handleDeleteAgentFromCanvas called')
    console.log('📝 agentId:', agentId)
    
    if (!agentId) {
      console.log('❌ Missing agentId')
      return
    }
    
    // Immediate optimistic update: Remove agent from Redux state instantly
    console.log('⚡ Immediate removal: Dispatching removeAgent action...')
    dispatch(removeAgent(agentId))
    
    try {
      console.log('🌐 Calling agentApi.deleteAgent...')
      
      // Delete agent via API
      await agentApi.deleteAgent(agentId)
      
      console.log('✅ Canvas agent deleted successfully:', agentId)
      
      // Refresh state to sync with backend (in case there are other changes)
      console.log('🔄 Syncing with backend...')
      await Promise.all([
        dispatch(fetchWorkflows()),
        dispatch(fetchAgents())
      ])
      console.log('✅ State synced with backend!')
      
    } catch (error) {
      console.error('❌ Error deleting canvas agent:', error)
      // If API call failed, refresh state to revert optimistic update
      console.log('🔄 API failed, refreshing state to revert optimistic update...')
      await Promise.all([
        dispatch(fetchWorkflows()),
        dispatch(fetchAgents())
      ])
    }
  }

  const handleOpenDeleteWorkflow = (workflowId: string) => {
    setWorkflowToDelete(workflowId)
    setDeleteError(null)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteWorkflow = () => {
    setDeleteDialogOpen(false)
    setWorkflowToDelete(null)
    setDeleteError(null)
  }

  const handleDeleteWorkflow = async () => {
    if (!workflowToDelete) return
    
    setDeleteLoading(true)
    setDeleteError(null)
    
    try {
      console.log('🗑️ Deleting workflow:', workflowToDelete)
      
      // Find the index of the workflow being deleted
      const workflowList = Object.values(workflows)
      const deletedWorkflowIndex = workflowList.findIndex(w => w.id === workflowToDelete)
      
      await dispatch(deleteWorkflow(workflowToDelete)).unwrap()
      console.log('✅ Workflow deletion request sent')
      
      // Show user feedback about the deletion
      // Note: Using a simple alert for now, but you could use a proper toast/snackbar
      setTimeout(() => {
        alert('✅ Workflow deleted successfully!\n\nNote: If the workflow reappears after page refresh, there may be a backend filtering issue that needs to be investigated.')
      }, 500)
      
      // Handle tab state after deletion
      if (deletedWorkflowIndex !== -1) {
        if (deletedWorkflowIndex === activeTab) {
          // If we deleted the currently active tab, switch to the first available tab
          const newWorkflowCount = workflowList.length - 1
          if (newWorkflowCount > 0) {
            // If there are remaining workflows, go to first tab or previous tab
            setActiveTab(deletedWorkflowIndex > 0 ? deletedWorkflowIndex - 1 : 0)
          }
        } else if (deletedWorkflowIndex < activeTab) {
          // If we deleted a tab before the active tab, shift the active tab index down
          setActiveTab(activeTab - 1)
        }
        // If we deleted a tab after the active tab, no change needed
      }
      
      // Close dialog
      handleCloseDeleteWorkflow()
      
    } catch (error) {
      console.error('❌ Error deleting workflow:', error)
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete workflow')
    } finally {
      setDeleteLoading(false)
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
        <Tabs value={activeTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" sx={{ mb: 3 }}>
          {workflowList.map((workflow) => (
            <Tab
              key={workflow.id}
              label={
                <Badge badgeContent={getAgentCountForWorkflow(workflow.id)} color="primary">
                  <Tooltip title={workflow.name}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{workflow.name}</Typography>
                  </Tooltip>
                </Badge>
              }
              icon={<BotIcon />}
              iconPosition="start"
              sx={{
                textTransform: 'none',
                minWidth: 150,
                '& .MuiTab-iconWrapper': {
                  minWidth: 40,
                },
              }}
            />
          ))}
        </Tabs>
      )}

      {/* Tab Content - Show Selected Workflow Details */}
      {workflowList.length > 0 && workflowList[activeTab] && (
        <Card sx={{ mt: 2 }}>
          <CardContent sx={{ p: 4 }}>
            {(() => {
              const workflow = workflowList[activeTab]
              return (
                <Grid container spacing={4}>
                  {/* Left Column - Main Info */}
                  <Grid item xs={12} lg={9} xl={10}>
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Typography variant="h4" component="h2" sx={{ fontWeight: 700 }}>
                          {workflow.name}
                        </Typography>
                        
                        {/* Top Right Action Icons */}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {/* Run Workflow Icon */}
                          <Tooltip title={
                            workflow.status === WorkflowStatus.COMPLETED ? 'Re-run Workflow' : 
                            workflow.status === WorkflowStatus.CANCELLED ? 'Restart Workflow' : 
                            workflow.status === WorkflowStatus.FAILED ? 'Retry Workflow' :
                            'Run Workflow'
                          }>
                            <IconButton 
                              color="success"
                              onClick={() => handleExecuteWorkflow(workflow.id)}
                              sx={{ 
                                backgroundColor: 'rgba(46, 125, 50, 0.08)',
                                '&:hover': { backgroundColor: 'rgba(46, 125, 50, 0.12)' }
                              }}
                            >
                              <PlayIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="Edit Workflow">
                            <IconButton 
                              color="primary"
                              sx={{ 
                                backgroundColor: 'rgba(25, 118, 210, 0.08)',
                                '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.12)' }
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="Delete Workflow">
                            <IconButton 
                              color="error"
                              onClick={() => handleOpenDeleteWorkflow(workflow.id)}
                              sx={{ 
                                backgroundColor: 'rgba(211, 47, 47, 0.08)',
                                '&:hover': { backgroundColor: 'rgba(211, 47, 47, 0.12)' }
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                      
                      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
                        {workflow.description || 'No description provided'}
                      </Typography>

                      {/* Run Workflow Button */}
                      {(workflow.status === WorkflowStatus.PENDING || 
                        workflow.status === WorkflowStatus.COMPLETED || 
                        workflow.status === WorkflowStatus.CANCELLED ||
                        workflow.status === WorkflowStatus.FAILED) && (
                        <Box sx={{ mb: 4 }}>
                          <Button
                            variant="contained"
                            startIcon={<PlayIcon />}
                            color="success"
                            onClick={() => handleExecuteWorkflow(workflow.id)}
                            sx={{ minWidth: 140 }}
                          >
                            {workflow.status === WorkflowStatus.COMPLETED ? 'Re-run Workflow' : 
                             workflow.status === WorkflowStatus.CANCELLED ? 'Restart Workflow' : 
                             workflow.status === WorkflowStatus.FAILED ? 'Retry Workflow' :
                             'Run Workflow'}
                          </Button>
                        </Box>
                      )}

                      {/* Agent Flow Chart Section */}
                      <Box sx={{ mt: 4 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                          Agent Flow Chart
                        </Typography>
                        <AgentFlowChart
                          agents={getAgentsForWorkflow(workflow.id)}
                          workflowId={workflow.id}
                          onAgentConnect={handleAgentConnect}
                          onAgentDisconnect={handleAgentDisconnect}
                          onNodeClick={handleAgentNodeClick}
                          onLoadConnections={handleLoadAgentConnections}
                          onAddAgent={(position, agentData) => handleAddAgentToCanvas(workflow.id, position, agentData)}
                          onAgentDelete={handleDeleteAgentFromCanvas}
                        />
                      </Box>
                    </Box>
                  </Grid>

                  {/* Right Column - Compact Metrics */}
                  <Grid item xs={12} lg={3} xl={2}>
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'row', lg: 'column' }, 
                      gap: 2,
                      height: 'fit-content',
                      position: 'sticky',
                      top: 20
                    }}>
                      {/* Active Agents Card */}
                      <Card sx={{ p: 2, backgroundColor: 'primary.light', flex: 1 }}>
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'row', lg: 'column' }, alignItems: 'center', gap: 1 }}>
                          <BotIcon sx={{ fontSize: 28, color: 'primary.main' }} />
                          <Box sx={{ textAlign: { xs: 'left', lg: 'center' } }}>
                            <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1 }}>
                              {getAgentCountForWorkflow(workflow.id)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                              Active Agents
                            </Typography>
                          </Box>
                        </Box>
                      </Card>

                      {/* Compact Stats Card */}
                      <Card sx={{ p: 2, flex: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontSize: '0.75rem' }}>
                          Status & Info
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Status</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                              {workflow.status}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Progress</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {workflow.progress || 0}%
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Updated</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                              {workflow.updatedAt ? formatDistanceToNow(new Date(workflow.updatedAt), { addSuffix: true }) : 'Unknown'}
                            </Typography>
                          </Box>
                        </Box>
                      </Card>
                    </Box>
                  </Grid>
                </Grid>
              )
            })()}
          </CardContent>
        </Card>
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

      {/* Delete Workflow Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={handleCloseDeleteWorkflow}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main' }}>
          Delete Workflow
        </DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete this workflow? This will soft delete the workflow (it can potentially be restored later).
          </Typography>
          
          <Typography variant="body2" color="warning.main" sx={{ mb: 2, fontStyle: 'italic' }}>
            ⚠️ Note: If the workflow reappears after page refresh, there may be a backend filtering issue.
          </Typography>
          
          {workflowToDelete && workflowList.find(w => w.id === workflowToDelete) && (
            <Box sx={{ p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Workflow to delete:
              </Typography>
              <Typography variant="body2">
                <strong>{workflowList.find(w => w.id === workflowToDelete)?.name}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {workflowList.find(w => w.id === workflowToDelete)?.description}
              </Typography>
            </Box>
          )}
          
          <Typography variant="body2" color="error.main" sx={{ mt: 2, fontWeight: 500 }}>
            ⚠️ This will soft delete the workflow (can potentially be restored).
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDeleteWorkflow}
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteWorkflow}
            variant="contained"
            color="error"
            disabled={deleteLoading}
            startIcon={<DeleteIcon />}
          >
            {deleteLoading ? 'Deleting...' : 'Delete Workflow'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Workflows 