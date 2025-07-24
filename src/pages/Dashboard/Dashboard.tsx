import React, { useEffect } from 'react'
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
  Speed,
  Error,
} from '@mui/icons-material'
import { useAppSelector, useAppDispatch } from '../../store'
import { fetchWorkflows } from '../../store/slices/workflowSlice'
import { useWebSocket } from '../../hooks/useWebSocket'
import { formatDistanceToNow } from 'date-fns'

const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch()
  const { isConnected } = useWebSocket()
  
  const { workflows, loading } = useAppSelector((state) => state.workflows)
  const { dashboardData, businessMetrics } = useAppSelector((state) => state.analytics)
  
  useEffect(() => {
    dispatch(fetchWorkflows())
  }, [dispatch])

  const workflowList = Object.values(workflows)
  const runningWorkflows = workflowList.filter(w => w.status === 'running')
  const completedWorkflows = workflowList.filter(w => w.status === 'completed')
  const failedWorkflows = workflowList.filter(w => w.status === 'failed')

  const MetricCard: React.FC<{
    title: string
    value: string | number
    subtitle?: string
    trend?: 'up' | 'down' | 'stable'
    color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning'
    icon?: React.ReactNode
  }> = ({ title, value, subtitle, trend, color = 'primary', icon }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="text.secondary" gutterBottom variant="h6">
              {title}
            </Typography>
            <Typography variant="h4" component="div" color={`${color}.main`}>
              {value}
            </Typography>
            {subtitle && (
              <Typography color="text.secondary" variant="body2">
                {subtitle}
              </Typography>
            )}
          </Box>
          {icon && (
            <Box sx={{ color: `${color}.main` }}>
              {icon}
            </Box>
          )}
        </Box>
        {trend && (
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
                {workflow.agents.length} agents
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Created {formatDistanceToNow(new Date(workflow.createdAt))} ago
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={workflow.progress}
              sx={{ mb: 1 }}
            />
            <Typography variant="body2" color="text.secondary">
              {workflow.progress}% complete
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

  if (loading) {
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
            onClick={() => dispatch(fetchWorkflows())}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Metrics Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Workflows"
            value={workflowList.length}
            subtitle={`${runningWorkflows.length} running`}
            trend="up"
            color="primary"
            icon={<Assessment fontSize="large" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Agents"
            value={dashboardData.activeAgents || 0}
            subtitle="Across all workflows"
            trend="stable"
            color="secondary"
            icon={<SmartToy fontSize="large" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Completion Rate"
            value={`${((completedWorkflows.length / workflowList.length) * 100 || 0).toFixed(1)}%`}
            subtitle={`${completedWorkflows.length} completed`}
            trend="up"
            color="success"
            icon={<TrendingUp fontSize="large" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Error Rate"
            value={`${((failedWorkflows.length / workflowList.length) * 100 || 0).toFixed(1)}%`}
            subtitle={`${failedWorkflows.length} failed`}
            trend={failedWorkflows.length > 0 ? 'down' : 'stable'}
            color="error"
            icon={<Error fontSize="large" />}
          />
        </Grid>
      </Grid>

      {/* Business Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="ROI"
            value={`${businessMetrics.roi.toFixed(1)}%`}
            subtitle="Return on Investment"
            trend="up"
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Cost Savings"
            value={`$${businessMetrics.costSavings.toLocaleString()}`}
            subtitle="This month"
            trend="up"
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Efficiency Gain"
            value={`${businessMetrics.efficiencyGain.toFixed(1)}%`}
            subtitle="Performance improvement"
            trend="up"
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Quality Score"
            value={businessMetrics.qualityScore.toFixed(1)}
            subtitle="Out of 10"
            trend="stable"
            color="primary"
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
            {workflowList.slice(0, 5).map((workflow) => (
              <WorkflowCard key={workflow.id} workflow={workflow} />
            ))}
            {workflowList.length === 0 && (
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
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CircularProgress
                  variant="determinate"
                  value={dashboardData.systemHealth}
                  size={60}
                  thickness={4}
                />
                <Typography variant="h4" sx={{ ml: 2 }}>
                  {dashboardData.systemHealth}%
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                All systems operational
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default Dashboard
