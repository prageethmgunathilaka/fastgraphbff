import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { 
  asyncHandler, 
  createError, 
  validationError, 
  handleDatabaseError 
} from '../middleware/errorHandler';
import { query as dbQuery, withTransaction } from '../database/connection';

const router = express.Router();

// Validation middleware
const validateAgent = [
  body('workflowId')
    .isUUID()
    .withMessage('Valid workflow ID is required'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('type')
    .isIn(['analysis', 'processing', 'monitoring', 'optimization', 'communication', 'validation'])
    .withMessage('Type must be one of: analysis, processing, monitoring, optimization, communication, validation'),
  body('capabilities')
    .optional()
    .isArray()
    .withMessage('Capabilities must be an array'),
  body('tools')
    .optional()
    .isArray()
    .withMessage('Tools must be an array'),
  body('executionContext')
    .optional()
    .isObject()
    .withMessage('Execution context must be an object')
];

const validateAgentUpdate = [
  param('id').isUUID().withMessage('Invalid agent ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('status')
    .optional()
    .isIn(['idle', 'running', 'waiting', 'completed', 'failed', 'timeout'])
    .withMessage('Invalid status'),
  body('type')
    .optional()
    .isIn(['analysis', 'processing', 'monitoring', 'optimization', 'communication', 'validation'])
    .withMessage('Invalid type'),
  body('progress')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Progress must be between 0 and 100')
];

// Helper function to transform database row to API format
const transformAgent = (row: any) => {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    name: row.name,
    description: row.description,
    type: row.type,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    progress: parseFloat(row.progress) || 0,
    capabilities: row.capabilities || [],
    tools: row.tools || [],
    executionContext: row.execution_context || {
      environment: 'production',
      version: '1.0.0',
      configuration: {},
      dependencies: []
    },
    performance: row.performance || {
      executionTime: 0,
      responseTime: 0,
      successRate: 0,
      errorCount: 0,
      resourceUsage: { cpu: 0, memory: 0, apiCalls: 0, tokens: 0 },
      qualityScore: 0
    },
    currentPhase: row.current_phase,
    estimatedTimeRemaining: row.estimated_time_remaining,
    statusChangeReason: row.status_change_reason,
    metadata: row.metadata || {},
    logs: [], // Will be populated separately if needed
    results: [] // Will be populated separately if needed
  };
};

// GET /api/agents - List all agents with filtering
router.get('/', [
  query('workflowId').optional().isUUID().withMessage('Invalid workflow ID'),
  query('status').optional().isIn(['idle', 'running', 'waiting', 'completed', 'failed', 'timeout']),
  query('type').optional().isIn(['analysis', 'processing', 'monitoring', 'optimization', 'communication', 'validation']),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('Page size must be between 1 and 100'),
  query('includeDeleted').optional().isBoolean()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const offset = (page - 1) * pageSize;
  
  const { workflowId, status, type, includeDeleted } = req.query;
  
  let whereConditions = [];
  let queryParams = [];
  let paramIndex = 1;

  // Soft delete filter
  if (!includeDeleted || includeDeleted === 'false') {
    whereConditions.push('deleted_at IS NULL');
  }

  // Workflow filter
  if (workflowId) {
    whereConditions.push(`workflow_id = $${paramIndex}`);
    queryParams.push(workflowId);
    paramIndex++;
  }

  // Status filter
  if (status) {
    whereConditions.push(`status = $${paramIndex}`);
    queryParams.push(status);
    paramIndex++;
  }

  // Type filter
  if (type) {
    whereConditions.push(`type = $${paramIndex}`);
    queryParams.push(type);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  try {
    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total FROM agents ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get agents with pagination
    const agentsResult = await dbQuery(
      `SELECT * FROM agents 
       ${whereClause}
       ORDER BY created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, pageSize, offset]
    );

    const agents = agentsResult.rows.map(transformAgent);

    res.json({
      success: true,
      data: {
        agents,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// GET /api/agents/:id - Get specific agent
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid agent ID'),
  query('includeLogs').optional().isBoolean(),
  query('includeResults').optional().isBoolean(),
  query('includeDeleted').optional().isBoolean()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const { includeLogs, includeResults, includeDeleted } = req.query;

  try {
    let whereClause = 'WHERE id = $1';
    if (!includeDeleted || includeDeleted === 'false') {
      whereClause += ' AND deleted_at IS NULL';
    }

    const agentResult = await dbQuery(
      `SELECT * FROM agents ${whereClause}`,
      [id]
    );

    if (agentResult.rows.length === 0) {
      throw createError('Agent not found', 404, 'AGENT_NOT_FOUND');
    }

    const agent = transformAgent(agentResult.rows[0]);

    // Include logs if requested
    if (includeLogs === 'true') {
      const logsResult = await dbQuery(
        `SELECT * FROM log_entries WHERE agent_id = $1 ORDER BY timestamp DESC LIMIT 100`,
        [id]
      );
      
      agent.logs = logsResult.rows.map((log: any) => ({
        id: log.id,
        agentId: log.agent_id,
        workflowId: log.workflow_id,
        timestamp: log.timestamp,
        level: log.level,
        message: log.message,
        context: log.context || {},
        error: log.error_info
      }));
    }

    // Include results if requested
    if (includeResults === 'true') {
      const resultsResult = await dbQuery(
        `SELECT * FROM agent_results WHERE agent_id = $1 ORDER BY timestamp DESC LIMIT 50`,
        [id]
      );
      
      agent.results = resultsResult.rows.map((result: any) => ({
        id: result.id,
        agentId: result.agent_id,
        workflowId: result.workflow_id,
        timestamp: result.timestamp,
        type: result.type,
        data: result.data,
        metadata: result.metadata,
        quality: result.quality_metrics,
        executionTime: result.execution_time,
        memoryUsage: result.memory_usage,
        cpuUsage: parseFloat(result.cpu_usage) || 0
      }));
    }

    res.json({
      success: true,
      data: agent
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// POST /api/agents - Create new agent
router.post('/', validateAgent, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const {
    workflowId,
    name,
    description,
    type,
    capabilities = [],
    tools = [],
    executionContext = {},
    metadata = {}
  } = req.body;

  const id = uuidv4();

  try {
    await withTransaction(async (client) => {
      // Verify workflow exists and is not deleted
      const workflowResult = await client.query(
        'SELECT id FROM workflows WHERE id = $1 AND deleted_at IS NULL',
        [workflowId]
      );

      if (workflowResult.rows.length === 0) {
        throw createError('Workflow not found', 404, 'WORKFLOW_NOT_FOUND');
      }

      // Create agent
      const result = await client.query(
        `INSERT INTO agents (
           id, workflow_id, name, description, type, capabilities, tools, execution_context, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [id, workflowId, name, description, type, capabilities, tools, executionContext, metadata]
      );

      const agent = transformAgent(result.rows[0]);
      
      res.status(201).json({
        success: true,
        data: agent
      });
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// PUT /api/agents/:id - Update agent
router.put('/:id', validateAgentUpdate, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const updates = req.body;

  try {
    await withTransaction(async (client) => {
      // Check if agent exists and not deleted
      const existingResult = await client.query(
        'SELECT * FROM agents WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );

      if (existingResult.rows.length === 0) {
        throw createError('Agent not found', 404, 'AGENT_NOT_FOUND');
      }

      const existing = existingResult.rows[0];

      // If status is changing, record it in history
      if (updates.status && updates.status !== existing.status) {
        await client.query(
          `INSERT INTO agent_status_history (agent_id, status, previous_status, reason, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, updates.status, existing.status, updates.statusChangeReason || null, updates.metadata || {}]
        );
      }

      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          const dbKey = key === 'statusChangeReason' ? 'status_change_reason' : 
                        key === 'estimatedTimeRemaining' ? 'estimated_time_remaining' :
                        key === 'currentPhase' ? 'current_phase' :
                        key === 'executionContext' ? 'execution_context' :
                        key.replace(/([A-Z])/g, '_$1').toLowerCase();
          
          updateFields.push(`${dbKey} = $${paramIndex}`);
          updateValues.push(value);
          paramIndex++;
        }
      }

      if (updateFields.length === 0) {
        throw createError('No valid fields to update', 400, 'NO_UPDATE_FIELDS');
      }

      updateValues.push(id);
      const updateResult = await client.query(
        `UPDATE agents SET ${updateFields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
        updateValues
      );

      const agent = transformAgent(updateResult.rows[0]);
      
      res.json({
        success: true,
        data: agent
      });
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// DELETE /api/agents/:id - Soft delete agent
router.delete('/:id', [
  param('id').isUUID().withMessage('Invalid agent ID'),
  body('reason').optional().trim().withMessage('Reason must be a string'),
  body('deletedBy').optional().trim().withMessage('DeletedBy must be a string')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const { reason, deletedBy = 'system' } = req.body;

  try {
    const result = await dbQuery(
      'SELECT soft_delete_agent($1, $2, $3) as success',
      [id, deletedBy, reason]
    );

    if (!result.rows[0].success) {
      throw createError('Agent not found or already deleted', 404, 'AGENT_NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Agent soft deleted successfully'
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// POST /api/agents/:id/restore - Restore soft deleted agent
router.post('/:id/restore', [
  param('id').isUUID().withMessage('Invalid agent ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;

  try {
    const result = await dbQuery(
      'SELECT restore_agent($1) as success',
      [id]
    );

    if (!result.rows[0].success) {
      throw createError('Agent not found or not deleted', 404, 'AGENT_NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Agent restored successfully'
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// POST /api/agents/:id/logs - Add log entry
router.post('/:id/logs', [
  param('id').isUUID().withMessage('Invalid agent ID'),
  body('level').isIn(['debug', 'info', 'warn', 'error', 'fatal']).withMessage('Invalid log level'),
  body('message').trim().isLength({ min: 1 }).withMessage('Message is required'),
  body('context').optional().isObject().withMessage('Context must be an object'),
  body('error').optional().isObject().withMessage('Error must be an object')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const { level, message, context, error } = req.body;

  try {
    // Verify agent exists
    const agentResult = await dbQuery(
      'SELECT workflow_id FROM agents WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (agentResult.rows.length === 0) {
      throw createError('Agent not found', 404, 'AGENT_NOT_FOUND');
    }

    const workflowId = agentResult.rows[0].workflow_id;
    const logId = uuidv4();

    const result = await dbQuery(
      `INSERT INTO log_entries (id, agent_id, workflow_id, level, message, context, error_info)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [logId, id, workflowId, level, message, context || {}, error]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.rows[0].id,
        agentId: result.rows[0].agent_id,
        workflowId: result.rows[0].workflow_id,
        timestamp: result.rows[0].timestamp,
        level: result.rows[0].level,
        message: result.rows[0].message,
        context: result.rows[0].context,
        error: result.rows[0].error_info
      }
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// POST /api/agents/:id/results - Add result
router.post('/:id/results', [
  param('id').isUUID().withMessage('Invalid agent ID'),
  body('type').isIn(['data', 'metric', 'insight', 'recommendation', 'alert']).withMessage('Invalid result type'),
  body('data').exists().withMessage('Data is required'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object'),
  body('quality').optional().isObject().withMessage('Quality must be an object')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const { type, data, metadata, quality, executionTime, memoryUsage, cpuUsage } = req.body;

  try {
    // Verify agent exists
    const agentResult = await dbQuery(
      'SELECT workflow_id FROM agents WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (agentResult.rows.length === 0) {
      throw createError('Agent not found', 404, 'AGENT_NOT_FOUND');
    }

    const workflowId = agentResult.rows[0].workflow_id;
    const resultId = uuidv4();

    const result = await dbQuery(
      `INSERT INTO agent_results (
         id, agent_id, workflow_id, type, data, metadata, quality_metrics, 
         execution_time, memory_usage, cpu_usage
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [resultId, id, workflowId, type, data, metadata || {}, quality, executionTime, memoryUsage, cpuUsage]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.rows[0].id,
        agentId: result.rows[0].agent_id,
        workflowId: result.rows[0].workflow_id,
        timestamp: result.rows[0].timestamp,
        type: result.rows[0].type,
        data: result.rows[0].data,
        metadata: result.rows[0].metadata,
        quality: result.rows[0].quality_metrics,
        executionTime: result.rows[0].execution_time,
        memoryUsage: result.rows[0].memory_usage,
        cpuUsage: parseFloat(result.rows[0].cpu_usage) || 0
      }
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// GET /api/agents/:id/status-history - Get agent status history
router.get('/:id/status-history', [
  param('id').isUUID().withMessage('Invalid agent ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;

  try {
    const result = await dbQuery(
      `SELECT * FROM agent_status_history 
       WHERE agent_id = $1 
       ORDER BY timestamp DESC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

export default router; 