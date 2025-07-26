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
const validateWorkflow = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be one of: low, medium, high, critical'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('configuration')
    .optional()
    .isObject()
    .withMessage('Configuration must be an object')
];

const validateWorkflowUpdate = [
  param('id').isUUID().withMessage('Invalid workflow ID'),
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
    .isIn(['pending', 'running', 'paused', 'completed', 'failed', 'cancelled'])
    .withMessage('Invalid status'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be one of: low, medium, high, critical'),
  body('progress')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Progress must be between 0 and 100')
];

// Helper function to transform database row to API format
const transformWorkflow = (row: any) => {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    progress: parseFloat(row.progress) || 0,
    estimatedTimeRemaining: row.estimated_time_remaining,
    priority: row.priority,
    tags: row.tags || [],
    metrics: row.metrics || {
      executionTime: 0,
      successRate: 0,
      errorRate: 0,
      throughput: 0,
      costMetrics: { totalCost: 0, costPerExecution: 0 },
      resourceUsage: { cpuUsage: 0, memoryUsage: 0, storageUsage: 0 }
    },
    creator: row.creator,
    configuration: row.configuration || {},
    completedTasks: row.completed_tasks,
    totalTasks: row.total_tasks,
    currentPhase: row.current_phase,
    statusChangeReason: row.status_change_reason,
    metadata: row.metadata || {},
    agents: [] // Will be populated separately if needed
  };
};

// GET /api/workflows - List all workflows with filtering and pagination
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('Page size must be between 1 and 100'),
  query('status').optional().isIn(['pending', 'running', 'paused', 'completed', 'failed', 'cancelled']),
  query('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  query('creator').optional().trim(),
  query('includeDeleted').optional().isBoolean()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const offset = (page - 1) * pageSize;
  
  const { status, priority, creator, includeDeleted } = req.query;
  
  let whereConditions = [];
  let queryParams = [];
  let paramIndex = 1;

  // Soft delete filter
  if (!includeDeleted || includeDeleted === 'false') {
    whereConditions.push('deleted_at IS NULL');
  }

  // Status filter
  if (status) {
    whereConditions.push(`status = $${paramIndex}`);
    queryParams.push(status);
    paramIndex++;
  }

  // Priority filter
  if (priority) {
    whereConditions.push(`priority = $${paramIndex}`);
    queryParams.push(priority);
    paramIndex++;
  }

  // Creator filter
  if (creator) {
    whereConditions.push(`creator ILIKE $${paramIndex}`);
    queryParams.push(`%${creator}%`);
    paramIndex++;
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  try {
    // Get total count
    const countResult = await dbQuery(
      `SELECT COUNT(*) as total FROM workflows ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get workflows with pagination
    const workflowsResult = await dbQuery(
      `SELECT * FROM workflows 
       ${whereClause}
       ORDER BY created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, pageSize, offset]
    );

    const workflows = workflowsResult.rows.map(transformWorkflow);

    res.json({
      success: true,
      data: {
        workflows,
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

// GET /api/workflows/:id - Get specific workflow
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid workflow ID'),
  query('includeAgents').optional().isBoolean(),
  query('includeDeleted').optional().isBoolean()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const { includeAgents, includeDeleted } = req.query;

  try {
    let whereClause = 'WHERE id = $1';
    if (!includeDeleted || includeDeleted === 'false') {
      whereClause += ' AND deleted_at IS NULL';
    }

    const workflowResult = await dbQuery(
      `SELECT * FROM workflows ${whereClause}`,
      [id]
    );

    if (workflowResult.rows.length === 0) {
      throw createError('Workflow not found', 404, 'WORKFLOW_NOT_FOUND');
    }

    const workflow = transformWorkflow(workflowResult.rows[0]);

    // Include agents if requested
    if (includeAgents === 'true') {
      const agentsResult = await dbQuery(
        `SELECT * FROM agents WHERE workflow_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC`,
        [id]
      );
      
      workflow.agents = agentsResult.rows.map((agent: any) => ({
        id: agent.id,
        workflowId: agent.workflow_id,
        name: agent.name,
        description: agent.description,
        type: agent.type,
        status: agent.status,
        createdAt: agent.created_at,
        updatedAt: agent.updated_at,
        completedAt: agent.completed_at,
        progress: parseFloat(agent.progress) || 0,
        capabilities: agent.capabilities || [],
        tools: agent.tools || [],
        executionContext: agent.execution_context || {},
        performance: agent.performance || {},
        currentPhase: agent.current_phase,
        estimatedTimeRemaining: agent.estimated_time_remaining,
        statusChangeReason: agent.status_change_reason,
        metadata: agent.metadata || {}
      }));
    }

    res.json({
      success: true,
      data: workflow
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// POST /api/workflows - Create new workflow
router.post('/', validateWorkflow, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const {
    name,
    description,
    priority = 'medium',
    tags = [],
    configuration = {},
    creator = 'system',
    metadata = {}
  } = req.body;

  const id = uuidv4();

  try {
    const result = await dbQuery(
      `INSERT INTO workflows (
         id, name, description, priority, tags, configuration, creator, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, name, description, priority, tags, configuration, creator, metadata]
    );

    const workflow = transformWorkflow(result.rows[0]);
    
    res.status(201).json({
      success: true,
      data: workflow
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// PUT /api/workflows/:id - Update workflow
router.put('/:id', validateWorkflowUpdate, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;
  const updates = req.body;

  try {
    await withTransaction(async (client) => {
      // Check if workflow exists and not deleted
      const existingResult = await client.query(
        'SELECT * FROM workflows WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );

      if (existingResult.rows.length === 0) {
        throw createError('Workflow not found', 404, 'WORKFLOW_NOT_FOUND');
      }

      const existing = existingResult.rows[0];

      // If status is changing, record it in history
      if (updates.status && updates.status !== existing.status) {
        await client.query(
          `INSERT INTO workflow_status_history (workflow_id, status, previous_status, reason, metadata)
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
                        key === 'completedTasks' ? 'completed_tasks' :
                        key === 'totalTasks' ? 'total_tasks' :
                        key === 'currentPhase' ? 'current_phase' :
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
        `UPDATE workflows SET ${updateFields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
        updateValues
      );

      const workflow = transformWorkflow(updateResult.rows[0]);
      
      res.json({
        success: true,
        data: workflow
      });
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// DELETE /api/workflows/:id - Soft delete workflow
router.delete('/:id', [
  param('id').isUUID().withMessage('Invalid workflow ID'),
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
      'SELECT soft_delete_workflow($1, $2, $3) as success',
      [id, deletedBy, reason]
    );

    if (!result.rows[0].success) {
      throw createError('Workflow not found or already deleted', 404, 'WORKFLOW_NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Workflow and associated agents soft deleted successfully'
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// POST /api/workflows/:id/restore - Restore soft deleted workflow
router.post('/:id/restore', [
  param('id').isUUID().withMessage('Invalid workflow ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;

  try {
    const result = await dbQuery(
      'SELECT restore_workflow($1) as success',
      [id]
    );

    if (!result.rows[0].success) {
      throw createError('Workflow not found or not deleted', 404, 'WORKFLOW_NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Workflow restored successfully'
    });
  } catch (error) {
    throw handleDatabaseError(error);
  }
}));

// GET /api/workflows/:id/status-history - Get workflow status history
router.get('/:id/status-history', [
  param('id').isUUID().withMessage('Invalid workflow ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array());
  }

  const { id } = req.params;

  try {
    const result = await dbQuery(
      `SELECT * FROM workflow_status_history 
       WHERE workflow_id = $1 
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