import React, { useEffect, useState } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  LinearProgress,
  Chip,
  IconButton,
  Button,
  Alert,
  Skeleton,
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  PlayArrow,
  Pause,
  Stop,
  Refresh,
  SmartToy,
  Assessment,
  Error,
  BugReport,
  Warning,
} from '@mui/icons-material'
import { useAppSelector, useAppDispatch } from '../../store'
import { fetchWorkflows, selectActiveAgentsCount, selectAgentsByStatus, selectSystemHealth } from '../../store/slices/workflowSlice'
import { fetchAgents } from '../../store/slices/agentSlice'
import { 
  fetchDashboardMetrics, 
  fetchPerformanceMetrics, 
  fetchBusinessMetrics,
  clearErrors 
} from '../../store/slices/analyticsSlice'
import { useWebSocket } from '../../hooks/useWebSocket'
import { formatDistanceToNow } from 'date-fns'
import { MetricValue, formatters } from '../../components/Layout/Layout'

const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch()
  const { isConnected } = useWebSocket()
  const [apiTestResult, setApiTestResult] = useState<string | null>(null)
  
  const { workflows, loading: workflowsLoading, error: workflowsError } = useAppSelector((state) => state.workflows)
  const { 
    dashboardData, 
    businessMetrics, 
    loading: analyticsLoading,
    error: analyticsError 
  } = useAppSelector((state) => state.analytics)
  
  // Get calculated agent counts from workflow data
  const activeAgentsCount = useAppSelector(selectActiveAgentsCount)
  const agentsByStatus = useAppSelector(selectAgentsByStatus)
  const systemHealth = useAppSelector(selectSystemHealth)
  
  // Get standalone agents data
  const { agents: standaloneAgents, loading: agentsLoading } = useAppSelector((state) => state.agents)
  
  // Debug: Log data to console (can be removed in production)
  // React.useEffect(() => {
  //   console.log('🔍 Debug System Health Data:')
  //   console.log('- Workflows:', Object.values(workflows))
  //   console.log('- Active Agents Count:', activeAgentsCount)
  //   console.log('- Agents By Status:', agentsByStatus)
  //   console.log('- System Health:', systemHealth)
  // }, [workflows, activeAgentsCount, agentsByStatus, systemHealth])

  // Helper function for rendering metric values in cards
  const renderMetricValue = (value: number | null, formatter?: (_: number) => string) => (
    <MetricValue value={value} formatter={formatter} />
  )

  useEffect(() => {
    // Fetch all data on component mount
    dispatch(fetchWorkflows())
    dispatch(fetchAgents()) // Fetch standalone agents
    dispatch(fetchDashboardMetrics())
    dispatch(fetchPerformanceMetrics())
    dispatch(fetchBusinessMetrics())
  }, [dispatch])

  // Test API connectivity
  const testApiConnection = async () => {
    try {
      setApiTestResult('Testing...')
      const response = await fetch('https://jux81vgip4.execute-api.us-east-1.amazonaws.com/health')
      const data = await response.json()
      setApiTestResult(`✅ Backend Connected! Status: ${data.status}, Service: ${data.service} v${data.version}, CPU: ${data.system.cpu_percent}%, Memory: ${data.system.memory_percent}%`)
    } catch (error) {
      setApiTestResult(`❌ Connection Failed: ${error}`)
    }
  }

  const testWorkflowsApi = async () => {
    try {
      setApiTestResult('Testing workflows...')
      const response = await fetch('https://jux81vgip4.execute-api.us-east-1.amazonaws.com/workflows')
      const data = await response.json()
      setApiTestResult(`✅ Workflows API: ${data.total} workflows, ${JSON.stringify(data)}`)
    } catch (error) {
      setApiTestResult(`❌ Workflows API Failed: ${error}`)
    }
  }

  // Refresh all data
  const refreshAllData = () => {
    dispatch(clearErrors())
    dispatch(fetchWorkflows())
    dispatch(fetchAgents()) // Refresh standalone agents
    dispatch(fetchDashboardMetrics())
    dispatch(fetchPerformanceMetrics())
    dispatch(fetchBusinessMetrics())
  }

  const workflowList = Object.values(workflows)
  const runningWorkflows = workflowList.filter(w => w.status === 'running')
  const completedWorkflows = workflowList.filter(w => w.status === 'completed')
  const failedWorkflows = workflowList.filter(w => w.status === 'failed')
  
  // Calculate total agent count (workflow-embedded + standalone)
  const standaloneAgentList = Object.values(standaloneAgents)
  const totalAgentCount = activeAgentsCount + standaloneAgentList.length
  
  // Calculate standalone agent breakdown by status
  const standaloneAgentsByStatus = standaloneAgentList.reduce((acc, agent) => {
    const status = agent.status.toLowerCase()
    if (status === 'idle') acc.idle += 1
    else if (status === 'running' || status === 'active') acc.running += 1  
    else if (status === 'waiting') acc.waiting += 1
    else if (status === 'completed') acc.completed += 1
    else if (status === 'failed') acc.failed += 1
    return acc
  }, { idle: 0, running: 0, waiting: 0, completed: 0, failed: 0, timeout: 0 })
  
  // Combined agent status counts
  const combinedAgentsByStatus = {
    idle: agentsByStatus.idle + standaloneAgentsByStatus.idle,
    running: agentsByStatus.running + standaloneAgentsByStatus.running,
    waiting: agentsByStatus.waiting + standaloneAgentsByStatus.waiting,
    completed: agentsByStatus.completed + standaloneAgentsByStatus.completed,
    failed: agentsByStatus.failed + standaloneAgentsByStatus.failed,
    timeout: agentsByStatus.timeout + standaloneAgentsByStatus.timeout
  }
  
  // Fallback system health calculation for debugging
  const calculateFallbackSystemHealth = () => {
    if (workflowList.length === 0) {
      return { score: null, status: 'No workflow data available' }
    }
    
    // Simple calculation based on workflow success rate
    const total = workflowList.length
    const failed = failedWorkflows.length
    const running = runningWorkflows.length
    
    let score = 100
    
    // Deduct points for failures
    if (total > 0) {
      const failureRate = (failed / total) * 100
      score -= failureRate * 0.5 // Each % failure reduces score by 0.5
    }
    
    // Add bonus for active workflows
    if (running > 0) {
      score += Math.min(10, running * 2) // Up to 10 bonus points for active workflows
    }
    
    score = Math.max(0, Math.min(100, Math.round(score)))
    
    let status = 'System operational'
    if (score < 50) status = 'System degraded'
    else if (score < 70) status = 'System has issues'
    else if (score < 90) status = 'System mostly operational'
    
    return { score, status }
  }
  
  const fallbackHealth = calculateFallbackSystemHealth()

  const MetricCard: React.FC<{
    title: string
    value: string | number | React.ReactNode
    subtitle?: string
    trend?: 'up' | 'down' | 'stable'
    color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning'
    icon?: React.ReactNode
    loading?: boolean
    error?: string | null
  }> = ({ title, value, subtitle, trend, color = 'primary', icon, loading = false, error = null }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        {loading ? (
          <Box>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" height={48} />
            <Skeleton variant="text" width="80%" height={20} />
          </Box>
        ) : error ? (
          <Box>
            <Typography color="text.secondary" gutterBottom variant="h6">
              {title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', color: 'error.main' }}>
              <Warning fontSize="small" sx={{ mr: 1 }} />
              <Typography variant="body2" color="error.main">
                Error loading data
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography color="text.secondary" gutterBottom variant="h6">
                {title}
              </Typography>
              <Typography 
                variant="h4" 
                component="div" 
                color={value === 'nil' ? 'text.disabled' : color + '.main'}
                sx={{ fontStyle: value === 'nil' ? 'italic' : 'normal' }}
              >
                {value}
              </Typography>
              {subtitle && (
                <Typography color="text.secondary" variant="body2">
                  {subtitle}
                </Typography>
              )}
            </Box>
            {icon && (
              <Box sx={{ color: color + '.main' }}>
                {icon}
              </Box>
            )}
          </Box>
        )}
                 {!loading && !error && trend && value !== 'nil' && typeof value !== 'object' && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            {trend === 'up' ? (
              <TrendingUp color="success" fontSize="small" />
            ) : trend === 'down' ? (
              <TrendingDown color="error" fontSize="small" />
            ) : null}
            <Typography
              variant="body2"
              color={trend === 'up' ? 'success.main' : trend === 'down' ? 'error.main' : 'text.secondary'}
              sx={{ ml: 0.5 }}
            >
              {trend === 'up' ? 'Trending up' : trend === 'down' ? 'Trending down' : 'Stable'}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )

  const WorkflowCard: React.FC<{ workflow: any }> = ({ workflow }) => (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom>
              {workflow.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip
                label={workflow.status}
                color={
                  workflow.status === 'running' ? 'primary' :
                  workflow.status === 'completed' ? 'success' :
                  workflow.status === 'failed' ? 'error' : 'default'
                }
                size="small"
              />
              <Typography variant="body2" color="text.secondary">
                {workflow.agents?.length || 0} agents
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Created {formatDistanceToNow(new Date(workflow.createdAt))} ago
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={workflow.progress || 0}
              sx={{ mb: 1 }}
            />
            <Typography variant="body2" color="text.secondary">
              {workflow.progress || 0}% complete
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', ml: 2 }}>
            <IconButton
              color={workflow.status === 'running' ? 'primary' : 'default'}
              disabled={workflow.status === 'completed' || workflow.status === 'failed'}
            >
              {workflow.status === 'running' ? <Pause /> : <PlayArrow />}
            </IconButton>
            <IconButton
              color="error"
              disabled={workflow.status === 'completed' || workflow.status === 'failed'}
            >
              <Stop />
            </IconButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )

  if (workflowsLoading && analyticsLoading.dashboard) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard Overview
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={isConnected ? 'Real-time Connected' : 'Disconnected'}
            color={isConnected ? 'success' : 'error'}
            variant="outlined"
          />
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={refreshAllData}
            disabled={analyticsLoading.dashboard || analyticsLoading.business || analyticsLoading.performance}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Error Alerts */}
      {(analyticsError.dashboard || analyticsError.business || analyticsError.performance || workflowsError) && (
        <Box sx={{ mb: 3 }}>
          {analyticsError.dashboard && (
            <Alert severity="error" sx={{ mb: 1 }}>
              Dashboard metrics error: {analyticsError.dashboard}
            </Alert>
          )}
          {analyticsError.business && (
            <Alert severity="error" sx={{ mb: 1 }}>
              Business metrics error: {analyticsError.business}
            </Alert>
          )}
          {analyticsError.performance && (
            <Alert severity="error" sx={{ mb: 1 }}>
              Performance metrics error: {analyticsError.performance}
            </Alert>
          )}
          {workflowsError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              Workflows error: {workflowsError}
            </Alert>
          )}
        </Box>
      )}

      {/* API Connection Test */}
      <Card sx={{ mb: 3, border: '2px dashed', borderColor: 'primary.main' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <BugReport sx={{ mr: 1, verticalAlign: 'middle' }} />
            Backend Connection Test & Agent Data
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Button 
              variant="outlined" 
              onClick={testApiConnection}
              startIcon={<Assessment />}
            >
              Test Health API
            </Button>
            <Button 
              variant="outlined" 
              onClick={testWorkflowsApi}
              startIcon={<PlayArrow />}
            >
              Test Workflows API
            </Button>
          </Box>
          
          {/* Agent Data Debug Section */}
          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Backend Data Calculations:
            </Typography>
            <Typography variant="body2" component="div">
              <strong>Agents (Workflow + Standalone):</strong>
              <br />
              • Workflow-Embedded Agents: <strong>{activeAgentsCount}</strong>
              <br />
              • Standalone Agents: <strong>{standaloneAgentList.length}</strong>
              <br />
              • <strong>Total Agent Count: {totalAgentCount}</strong>
              <br />
              • Combined Status - Running: {combinedAgentsByStatus.running}, Waiting: {combinedAgentsByStatus.waiting}, Idle: {combinedAgentsByStatus.idle}
              <br />
              • Completed: {combinedAgentsByStatus.completed}, Failed: {combinedAgentsByStatus.failed}, Timeout: {combinedAgentsByStatus.timeout}
              <br />
              <br />
              <strong>System Health (calculated from workflow/agent data):</strong>
              <br />
              • Selector Score: <strong>{systemHealth.score !== null ? `${systemHealth.score}%` : 'nil'}</strong>
              <br />
              • Fallback Score: <strong>{fallbackHealth.score !== null ? `${fallbackHealth.score}%` : 'nil'}</strong>
              <br />
              • Current Status: {systemHealth.status || fallbackHealth.status}
              <br />
              • Total Workflows: {workflowList.length}
              <br />
              • Running: {runningWorkflows.length}, Completed: {completedWorkflows.length}, Failed: {failedWorkflows.length}
              <br />
              {systemHealth.factors && (
                <>
                  • Workflow Success Rate: {systemHealth.factors.workflowSuccess !== null ? `${systemHealth.factors.workflowSuccess}%` : 'N/A'}
                  <br />
                  • Agent Performance: {systemHealth.factors.agentPerformance !== null ? `${systemHealth.factors.agentPerformance}%` : 'N/A'}
                  <br />
                  • Error Rate: {systemHealth.factors.errorRate !== null ? `${systemHealth.factors.errorRate}%` : 'N/A'}
                  <br />
                  • Active Workflow Health: {systemHealth.factors.activeWorkflows !== null ? `${systemHealth.factors.activeWorkflows}%` : 'N/A'}
                  <br />
                </>
              )}
              <br />
              <br />
              <em>Note: All calculations are from real backend workflow and agent data</em>
            </Typography>
          </Box>

          {apiTestResult && (
            <Alert 
              severity={apiTestResult.includes('✅') ? 'success' : apiTestResult.includes('Testing') ? 'info' : 'error'}
              sx={{ mt: 2 }}
            >
              {apiTestResult}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
                      <MetricCard
              title="Total Workflows"
              value={renderMetricValue(dashboardData.totalWorkflows || workflowList.length)}
              subtitle={`${runningWorkflows.length} running`}
              trend="up"
              color="primary"
              icon={<Assessment fontSize="large" />}
              loading={analyticsLoading.dashboard}
              error={analyticsError.dashboard}
            />
        </Grid>
                  <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Active Agents"
              value={renderMetricValue(totalAgentCount)}
              subtitle={`Running: ${combinedAgentsByStatus.running}, Waiting: ${combinedAgentsByStatus.waiting}, Idle: ${combinedAgentsByStatus.idle}`}
              trend="stable"
              color="secondary"
              icon={<SmartToy fontSize="large" />}
              loading={workflowsLoading || agentsLoading}
              error={workflowsError}
            />
          </Grid>
        <Grid item xs={12} sm={6} md={3}>
                      <MetricCard
              title="Completion Rate"
              value={renderMetricValue(dashboardData.completionRate, formatters.percentage)}
              subtitle={`${completedWorkflows.length} completed`}
              trend="up"
              color="success"
              icon={<TrendingUp fontSize="large" />}
              loading={analyticsLoading.dashboard}
              error={analyticsError.dashboard}
            />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
                      <MetricCard
              title="Error Rate"
              value={renderMetricValue(dashboardData.errorRate, formatters.percentage)}
              subtitle={`${failedWorkflows.length} failed`}
              trend={failedWorkflows.length > 0 ? 'down' : 'stable'}
              color="error"
              icon={<Error fontSize="large" />}
              loading={analyticsLoading.dashboard}
              error={analyticsError.dashboard}
            />
        </Grid>
      </Grid>

      {/* Business Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
                      <MetricCard
              title="ROI"
              value={renderMetricValue(businessMetrics.roi, formatters.percentage)}
              subtitle="Return on Investment"
              trend="up"
              color="success"
              loading={analyticsLoading.business}
              error={analyticsError.business}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Cost Savings"
              value={renderMetricValue(businessMetrics.costSavings, formatters.currency)}
              subtitle="This month"
              trend="up"
              color="success"
              loading={analyticsLoading.business}
              error={analyticsError.business}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Efficiency Gain"
              value={renderMetricValue(businessMetrics.efficiencyGain, formatters.percentage)}
              subtitle="Performance improvement"
              trend="up"
              color="primary"
              loading={analyticsLoading.business}
              error={analyticsError.business}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Quality Score"
              value={renderMetricValue(businessMetrics.qualityScore, formatters.decimal(1))}
              subtitle="Out of 10"
              trend="stable"
              color="primary"
              loading={analyticsLoading.business}
              error={analyticsError.business}
            />
        </Grid>
      </Grid>

      {/* Recent Workflows */}
      <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 2 }}>
        Recent Workflows
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Box>
            {workflowsLoading ? (
              <Box>
                {[1, 2, 3].map((i) => (
                  <Card key={i} sx={{ mb: 2 }}>
                    <CardContent>
                      <Skeleton variant="text" width="60%" height={32} />
                      <Skeleton variant="text" width="40%" height={24} />
                      <Skeleton variant="rectangular" width="100%" height={8} sx={{ my: 1 }} />
                      <Skeleton variant="text" width="30%" height={20} />
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : workflowList.length > 0 ? (
              workflowList.slice(0, 5).map((workflow) => (
                <WorkflowCard key={workflow.id} workflow={workflow} />
              ))
            ) : (
              <Card>
                <CardContent>
                  <Typography variant="h6" color="text.secondary" align="center">
                    No workflows found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" align="center">
                    Create your first workflow to get started
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Box>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Health
              </Typography>
              {workflowsLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Skeleton variant="circular" width={60} height={60} />
                  <Skeleton variant="text" width="30%" height={48} sx={{ ml: 2 }} />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CircularProgress
                    variant="determinate"
                    value={systemHealth.score || fallbackHealth.score || 0}
                    size={60}
                    thickness={4}
                    color={(() => {
                      const score = systemHealth.score || fallbackHealth.score
                      if (score && score >= 90) return 'success'
                      if (score && score >= 70) return 'warning'
                      return 'error'
                    })()}
                  />
                  <Typography variant="h4" sx={{ ml: 2 }}>
                    <MetricValue 
                      value={systemHealth.score || fallbackHealth.score} 
                      formatter={formatters.percentage}
                    />
                  </Typography>
                </Box>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {systemHealth.status || fallbackHealth.status}
              </Typography>
              
              {/* System Health Breakdown */}
              {systemHealth.score !== null && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="caption" gutterBottom display="block">
                    Health Factors:
                  </Typography>
                  <Typography variant="caption" component="div" sx={{ fontSize: '0.75rem' }}>
                    • Workflow Success: {formatters.percentage(systemHealth.factors.workflowSuccess || 0)}
                    <br />
                    • Agent Performance: {formatters.percentage(systemHealth.factors.agentPerformance || 0)}
                    <br />
                    • Error Rate: {formatters.percentage(systemHealth.factors.errorRate || 0)}
                    <br />
                    • Active Workflows: {formatters.percentage(systemHealth.factors.activeWorkflows || 0)}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default Dashboard
