import express from 'express';
import { query, validationResult } from 'express-validator';
import { 
  asyncHandler, 
  validationError, 
  handleDatabaseError 
} from '../middleware/errorHandler';
import { query as dbQuery } from '../database/connection';

const router = express.Router();

// GET /api/analytics/dashboard - Dashboard metrics
router.get('/dashboard', [
  query('timeRange.start').optional().isISO8601().withMessage('Start time must be ISO 8601 format'),
  query('timeRange.end').optional().isISO8601().withMessage('End time must be ISO 8601 format')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  try {
    // Get basic counts
    const [workflowsResult, agentsResult, completionResult, errorResult] = await Promise.all([
      // Total workflows (active)
      dbQuery('SELECT COUNT(*) as count FROM workflows WHERE deleted_at IS NULL'),
      
      // Active agents
      dbQuery('SELECT COUNT(*) as count FROM agents WHERE deleted_at IS NULL AND status = $1', ['running']),
      
      // Completion rate (last 30 days)
      dbQuery(`
        SELECT 
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::FLOAT / COUNT(*)::FLOAT * 100 as completion_rate
        FROM workflows 
        WHERE deleted_at IS NULL 
          AND created_at >= NOW() - INTERVAL '30 days'
      `),
      
      // Error rate (last 30 days)
      dbQuery(`
        SELECT 
          COUNT(CASE WHEN status = 'failed' THEN 1 END)::FLOAT / COUNT(*)::FLOAT * 100 as error_rate
        FROM workflows 
        WHERE deleted_at IS NULL 
          AND created_at >= NOW() - INTERVAL '30 days'
      `)
    ]);

    // Calculate average execution time for completed workflows
    const executionTimeResult = await dbQuery(`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_execution_time
      FROM workflows 
      WHERE deleted_at IS NULL 
        AND status = 'completed' 
        AND completed_at IS NOT NULL
        AND created_at >= NOW() - INTERVAL '30 days'
    `);

    // System health (simplified metric based on recent activity)
    const healthResult = await dbQuery(`
      SELECT 
        COUNT(*) as total_activities,
        COUNT(CASE WHEN status IN ('running', 'completed') THEN 1 END) as healthy_activities
      FROM workflows 
      WHERE deleted_at IS NULL 
        AND created_at >= NOW() - INTERVAL '24 hours'
    `);

    const totalActivities = parseInt(healthResult.rows[0].total_activities) || 0;
    const healthyActivities = parseInt(healthResult.rows[0].healthy_activities) || 0;
    const systemHealth = totalActivities > 0 ? (healthyActivities / totalActivities) * 100 : 100;

    res.json({
      success: true,
      data: {
        totalWorkflows: parseInt(workflowsResult.rows[0].count) || 0,
        activeAgents: parseInt(agentsResult.rows[0].count) || 0,
        completionRate: parseFloat(completionResult.rows[0].completion_rate) || 0,
        averageExecutionTime: parseFloat(executionTimeResult.rows[0].avg_execution_time) || 0,
        errorRate: parseFloat(errorResult.rows[0].error_rate) || 0,
        systemHealth: Math.round(systemHealth * 100) / 100
      }
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// GET /api/analytics/performance - Performance metrics
router.get('/performance', [
  query('timeRange.start').optional().isISO8601().withMessage('Start time must be ISO 8601 format'),
  query('timeRange.end').optional().isISO8601().withMessage('End time must be ISO 8601 format')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  try {
    // Throughput data (workflows completed per hour over last 24 hours)
    const throughputResult = await dbQuery(`
      SELECT 
        DATE_TRUNC('hour', completed_at) as hour,
        COUNT(*) as completed_count
      FROM workflows 
      WHERE deleted_at IS NULL 
        AND status = 'completed'
        AND completed_at >= NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', completed_at)
      ORDER BY hour ASC
    `);

    // Latency data (average response times over last 24 hours)
    const latencyResult = await dbQuery(`
      SELECT 
        DATE_TRUNC('hour', completed_at) as hour,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_latency
      FROM workflows 
      WHERE deleted_at IS NULL 
        AND status = 'completed'
        AND completed_at >= NOW() - INTERVAL '24 hours'
        AND completed_at IS NOT NULL
      GROUP BY DATE_TRUNC('hour', completed_at)
      ORDER BY hour ASC
    `);

    // Resource utilization (aggregated from agent performance data)
    const resourceResult = await dbQuery(`
      SELECT 
        AVG((performance->>'resourceUsage'->>'cpu')::FLOAT) as avg_cpu,
        AVG((performance->>'resourceUsage'->>'memory')::FLOAT) as avg_memory
      FROM agents 
      WHERE deleted_at IS NULL 
        AND performance IS NOT NULL
        AND updated_at >= NOW() - INTERVAL '1 hour'
    `);

    res.json({
      success: true,
      data: {
        throughput: throughputResult.rows.map(row => parseInt(row.completed_count)),
        latency: latencyResult.rows.map(row => Math.round(parseFloat(row.avg_latency) * 1000)), // Convert to ms
        resourceUtilization: {
          cpu: Math.round((parseFloat(resourceResult.rows[0]?.avg_cpu) || 0) * 100) / 100,
          memory: Math.round((parseFloat(resourceResult.rows[0]?.avg_memory) || 0) * 100) / 100,
          network: 0 // Placeholder - would need network monitoring
        }
      }
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// GET /api/analytics/business - Business metrics
router.get('/business', [
  query('timeRange.start').optional().isISO8601().withMessage('Start time must be ISO 8601 format'),
  query('timeRange.end').optional().isISO8601().withMessage('End time must be ISO 8601 format')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  try {
    // Business metrics would typically be calculated based on business logic
    // For now, providing placeholder calculations based on workflow data

    // ROI calculation (simplified - based on completed vs failed workflows)
    const roiResult = await dbQuery(`
      SELECT 
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(*) as total
      FROM workflows 
      WHERE deleted_at IS NULL 
        AND created_at >= NOW() - INTERVAL '30 days'
    `);

    const completed = parseInt(roiResult.rows[0].completed) || 0;
    const failed = parseInt(roiResult.rows[0].failed) || 0;
    const total = parseInt(roiResult.rows[0].total) || 1;

    // Efficiency gain (based on average execution time trends)
    const efficiencyResult = await dbQuery(`
      SELECT 
        AVG(CASE 
          WHEN created_at >= NOW() - INTERVAL '7 days' 
          THEN EXTRACT(EPOCH FROM (completed_at - created_at)) 
        END) as recent_avg,
        AVG(CASE 
          WHEN created_at >= NOW() - INTERVAL '30 days' 
          AND created_at < NOW() - INTERVAL '7 days'
          THEN EXTRACT(EPOCH FROM (completed_at - created_at)) 
        END) as previous_avg
      FROM workflows 
      WHERE deleted_at IS NULL 
        AND status = 'completed'
        AND completed_at IS NOT NULL
    `);

    const recentAvg = parseFloat(efficiencyResult.rows[0]?.recent_avg) || 0;
    const previousAvg = parseFloat(efficiencyResult.rows[0]?.previous_avg) || 0;
    const efficiencyGain = previousAvg > 0 ? ((previousAvg - recentAvg) / previousAvg) * 100 : 0;

    // Quality score (based on success rate and performance)
    const qualityScore = completed > 0 ? (completed / total) * 100 : 0;

    res.json({
      success: true,
      data: {
        roi: Math.round(((completed - failed) / total) * 100 * 100) / 100, // ROI as percentage
        costSavings: Math.round(completed * 100), // Placeholder: $100 per completed workflow
        efficiencyGain: Math.round(efficiencyGain * 100) / 100,
        qualityScore: Math.round(qualityScore * 100) / 100
      }
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// GET /api/analytics/workflows/:id - Workflow-specific analytics
router.get('/workflows/:id', [
  query('timeRange.start').optional().isISO8601().withMessage('Start time must be ISO 8601 format'),
  query('timeRange.end').optional().isISO8601().withMessage('End time must be ISO 8601 format')
], asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Get workflow details with metrics
    const workflowResult = await dbQuery(
      'SELECT * FROM workflows WHERE id = $1 AND deleted_at IS NULL',
      [id]  
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Workflow not found', code: 'WORKFLOW_NOT_FOUND' }
      });
    }

    // Get associated agents metrics
    const agentsResult = await dbQuery(
      `SELECT 
         COUNT(*) as total_agents,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_agents,
         AVG(progress) as avg_progress
       FROM agents 
       WHERE workflow_id = $1 AND deleted_at IS NULL`,
      [id]
    );

    // Get status history
    const historyResult = await dbQuery(
      `SELECT * FROM workflow_status_history 
       WHERE workflow_id = $1 
       ORDER BY timestamp ASC`,
      [id]
    );

    const workflow = workflowResult.rows[0];
    const agentStats = agentsResult.rows[0];

    res.json({
      success: true,
      data: {
        workflow: {
          id: workflow.id,
          name: workflow.name,
          status: workflow.status,
          progress: parseFloat(workflow.progress) || 0,
          metrics: workflow.metrics || {}
        },
        agents: {
          total: parseInt(agentStats.total_agents) || 0,
          completed: parseInt(agentStats.completed_agents) || 0,
          averageProgress: parseFloat(agentStats.avg_progress) || 0
        },
        statusHistory: historyResult.rows
      }
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// GET /api/analytics/agents/:id - Agent-specific analytics
router.get('/agents/:id', [
  query('timeRange.start').optional().isISO8601().withMessage('Start time must be ISO 8601 format'),
  query('timeRange.end').optional().isISO8601().withMessage('End time must be ISO 8601 format')
], asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Get agent details with performance metrics
    const agentResult = await dbQuery(
      'SELECT * FROM agents WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (agentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Agent not found', code: 'AGENT_NOT_FOUND' }
      });
    }

    // Get log entries count by level
    const logsResult = await dbQuery(
      `SELECT 
         level,
         COUNT(*) as count
       FROM log_entries 
       WHERE agent_id = $1 
       GROUP BY level`,
      [id]
    );

    // Get results count by type
    const resultsResult = await dbQuery(
      `SELECT 
         type,
         COUNT(*) as count,
         AVG(execution_time) as avg_execution_time
       FROM agent_results 
       WHERE agent_id = $1 
       GROUP BY type`,
      [id]
    );

    // Get status history
    const historyResult = await dbQuery(
      `SELECT * FROM agent_status_history 
       WHERE agent_id = $1 
       ORDER BY timestamp ASC`,
      [id]
    );

    const agent = agentResult.rows[0];

    res.json({
      success: true,
      data: {
        agent: {
          id: agent.id,
          name: agent.name,
          type: agent.type,
          status: agent.status,
          progress: parseFloat(agent.progress) || 0,
          performance: agent.performance || {}
        },
        logs: logsResult.rows.reduce((acc, row) => {
          acc[row.level] = parseInt(row.count);
          return acc;
        }, {}),
        results: resultsResult.rows.map(row => ({
          type: row.type,
          count: parseInt(row.count),
          averageExecutionTime: parseFloat(row.avg_execution_time) || 0
        })),
        statusHistory: historyResult.rows
      }
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

export default router; 