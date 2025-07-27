import React from 'react'
import { Box, Typography, Card, CardContent, Grid } from '@mui/material'
import Workflows from './WorkflowMonitoring/Workflows'
import AgentManagement from './AgentManagement/AgentManagement'

const Analytics: React.FC = () => (
  <Box>
    <Typography variant="h4" gutterBottom>Analytics Engine</Typography>
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card><CardContent>
          <Typography variant="h6">Performance Analytics</Typography>
          <Typography variant="body2" color="text.secondary">
            Execution times, success rates, and resource utilization metrics
          </Typography>
        </CardContent></Card>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card><CardContent>
          <Typography variant="h6">Business Impact</Typography>
          <Typography variant="body2" color="text.secondary">
            ROI calculations, cost savings, and efficiency improvements
          </Typography>
        </CardContent></Card>
      </Grid>
    </Grid>
  </Box>
)

const Reports: React.FC = () => (
  <Box>
    <Typography variant="h4" gutterBottom>Business Intelligence & Reports</Typography>
    <Card><CardContent>
      <Typography variant="h6">Executive Dashboard</Typography>
      <Typography variant="body2" color="text.secondary">
        High-level KPIs, automated reporting, and comparative analysis
      </Typography>
    </CardContent></Card>
  </Box>
)

const WorkflowMonitoring: React.FC = () => <Workflows />

const Settings: React.FC = () => (
  <Box>
    <Typography variant="h4" gutterBottom>Settings</Typography>
    <Card><CardContent>
      <Typography variant="h6">System Configuration</Typography>
      <Typography variant="body2" color="text.secondary">
        User preferences, notification settings, and system parameters
      </Typography>
    </CardContent></Card>
  </Box>
)

export { Analytics, AgentManagement, Reports, Settings, WorkflowMonitoring }
