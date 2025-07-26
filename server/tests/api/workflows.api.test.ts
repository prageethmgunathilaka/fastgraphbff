import request from 'supertest';
import { Express } from 'express';
import { v4 as uuidv4 } from 'uuid';
import app from '../../index';
import { testPool, cleanDatabase, setupTestSchema } from '../testUtils';
import { 
  createMockWorkflow, 
  createMockWorkflowFromDB,
  createMultipleWorkflows,
  createInvalidWorkflow,
  createSoftDeletedWorkflow,
  workflowStatusTransitions
} from '../mocks/testData';

describe('Workflows API', () => {
  let server: Express;

  beforeAll(async () => {
    server = app;
    await setupTestSchema();
    
    // Create tables from schema
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await testPool.query(schema);
    }
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('POST /api/workflows', () => {
    it('should create a new workflow', async () => {
      const workflowData = createMockWorkflow();

      const response = await request(server)
        .post('/api/workflows')
        .send(workflowData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          name: workflowData.name,
          description: workflowData.description,
          status: 'pending',
          priority: workflowData.priority,
          progress: 0,
          tags: workflowData.tags,
          creator: workflowData.creator,
          createdAt: expect.any(String),
          updatedAt: expect.any(String)
        }
      });

      // Verify in database
      const dbResult = await testPool.query(
        'SELECT * FROM workflows WHERE id = $1',
        [response.body.data.id]
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].name).toBe(workflowData.name);
    });

    it('should reject invalid workflow data', async () => {
      const invalidData = createInvalidWorkflow();

      const response = await request(server)
        .post('/api/workflows')
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR'
        }
      });
    });

    it('should create workflow with minimal data', async () => {
      const minimalData = {
        name: 'Minimal Test Workflow'
      };

      const response = await request(server)
        .post('/api/workflows')
        .send(minimalData)
        .expect(201);

      expect(response.body.data).toMatchObject({
        name: minimalData.name,
        status: 'pending',
        priority: 'medium',
        progress: 0,
        tags: [],
        creator: 'system'
      });
    });
  });

  describe('GET /api/workflows', () => {
    beforeEach(async () => {
      // Create test workflows
      const workflows = createMultipleWorkflows(5);
      for (const workflow of workflows) {
        await testPool.query(
          `INSERT INTO workflows (id, name, description, priority, tags, creator, configuration, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            uuidv4(),
            workflow.name,
            workflow.description,
            workflow.priority,
            workflow.tags,
            workflow.creator,
            workflow.configuration,
            workflow.metadata
          ]
        );
      }
    });

    it('should list all workflows', async () => {
      const response = await request(server)
        .get('/api/workflows')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          workflows: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              name: expect.any(String),
              status: expect.any(String)
            })
          ]),
          pagination: {
            page: 1,
            pageSize: 20,
            total: 5,
            totalPages: 1
          }
        }
      });

      expect(response.body.data.workflows).toHaveLength(5);
    });

    it('should support pagination', async () => {
      const response = await request(server)
        .get('/api/workflows?page=1&pageSize=2')
        .expect(200);

      expect(response.body.data.workflows).toHaveLength(2);
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        pageSize: 2,
        total: 5,
        totalPages: 3
      });
    });

    it('should filter by status', async () => {
      // Update one workflow to running status
      await testPool.query(
        "UPDATE workflows SET status = 'running' WHERE name = 'Test Workflow 1'"
      );

      const response = await request(server)
        .get('/api/workflows?status=running')
        .expect(200);

      expect(response.body.data.workflows).toHaveLength(1);
      expect(response.body.data.workflows[0].status).toBe('running');
    });

    it('should filter by priority', async () => {
      // Update some workflows to high priority
      await testPool.query(
        "UPDATE workflows SET priority = 'high' WHERE name LIKE 'Test Workflow %' AND name IN ('Test Workflow 1', 'Test Workflow 2')"
      );

      const response = await request(server)
        .get('/api/workflows?priority=high')
        .expect(200);

      expect(response.body.data.workflows).toHaveLength(2);
      response.body.data.workflows.forEach((workflow: any) => {
        expect(workflow.priority).toBe('high');
      });
    });

    it('should exclude soft-deleted workflows by default', async () => {
      // Soft delete one workflow
      await testPool.query(
        "UPDATE workflows SET deleted_at = NOW(), deleted_by = 'test' WHERE name = 'Test Workflow 1'"
      );

      const response = await request(server)
        .get('/api/workflows')
        .expect(200);

      expect(response.body.data.workflows).toHaveLength(4);
      expect(response.body.data.pagination.total).toBe(4);
    });

    it('should include soft-deleted workflows when requested', async () => {
      // Soft delete one workflow
      await testPool.query(
        "UPDATE workflows SET deleted_at = NOW(), deleted_by = 'test' WHERE name = 'Test Workflow 1'"
      );

      const response = await request(server)
        .get('/api/workflows?includeDeleted=true')
        .expect(200);

      expect(response.body.data.workflows).toHaveLength(5);
      expect(response.body.data.pagination.total).toBe(5);
    });
  });

  describe('GET /api/workflows/:id', () => {
    let workflowId: string;

    beforeEach(async () => {
      const workflow = createMockWorkflow();
      workflowId = uuidv4();
      
      await testPool.query(
        `INSERT INTO workflows (id, name, description, priority, tags, creator, configuration, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          workflowId,
          workflow.name,
          workflow.description,
          workflow.priority,
          workflow.tags,
          workflow.creator,
          workflow.configuration,
          workflow.metadata
        ]
      );
    });

    it('should get workflow by id', async () => {
      const response = await request(server)
        .get(`/api/workflows/${workflowId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: workflowId,
          name: 'Test Workflow',
          status: 'pending'
        }
      });
    });

    it('should include agents when requested', async () => {
      // Create an agent for this workflow
      const agentId = uuidv4();
      await testPool.query(
        `INSERT INTO agents (id, workflow_id, name, type, capabilities, tools, execution_context, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          agentId,
          workflowId,
          'Test Agent',
          'analysis',
          ['test'],
          ['tool1'],
          {},
          {}
        ]
      );

      const response = await request(server)
        .get(`/api/workflows/${workflowId}?includeAgents=true`)
        .expect(200);

      expect(response.body.data.agents).toHaveLength(1);
      expect(response.body.data.agents[0]).toMatchObject({
        id: agentId,
        name: 'Test Agent',
        type: 'analysis'
      });
    });

    it('should return 404 for non-existent workflow', async () => {
      const nonExistentId = uuidv4();

      const response = await request(server)
        .get(`/api/workflows/${nonExistentId}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND'
        }
      });
    });

    it('should return 404 for soft-deleted workflow by default', async () => {
      // Soft delete the workflow
      await testPool.query(
        'UPDATE workflows SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2',
        ['test', workflowId]
      );

      const response = await request(server)
        .get(`/api/workflows/${workflowId}`)
        .expect(404);

      expect(response.body.error.code).toBe('WORKFLOW_NOT_FOUND');
    });

    it('should return soft-deleted workflow when requested', async () => {
      // Soft delete the workflow
      await testPool.query(
        'UPDATE workflows SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2',
        ['test', workflowId]
      );

      const response = await request(server)
        .get(`/api/workflows/${workflowId}?includeDeleted=true`)
        .expect(200);

      expect(response.body.data.id).toBe(workflowId);
    });
  });

  describe('PUT /api/workflows/:id', () => {
    let workflowId: string;

    beforeEach(async () => {
      const workflow = createMockWorkflow();
      workflowId = uuidv4();
      
      await testPool.query(
        `INSERT INTO workflows (id, name, description, priority, tags, creator, configuration, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          workflowId,
          workflow.name,
          workflow.description,
          workflow.priority,
          workflow.tags,
          workflow.creator,
          workflow.configuration,
          workflow.metadata
        ]
      );
    });

    it('should update workflow fields', async () => {
      const updates = {
        name: 'Updated Workflow Name',
        description: 'Updated description',
        priority: 'high',
        progress: 50
      };

      const response = await request(server)
        .put(`/api/workflows/${workflowId}`)
        .send(updates)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: workflowId,
          name: updates.name,
          description: updates.description,
          priority: updates.priority,
          progress: updates.progress
        }
      });

      // Verify in database
      const dbResult = await testPool.query(
        'SELECT * FROM workflows WHERE id = $1',
        [workflowId]
      );
      expect(dbResult.rows[0].name).toBe(updates.name);
      expect(dbResult.rows[0].priority).toBe(updates.priority);
    });

    it('should track status changes in history', async () => {
      const statusUpdate = {
        status: 'running',
        statusChangeReason: 'Started by user'
      };

      await request(server)
        .put(`/api/workflows/${workflowId}`)
        .send(statusUpdate)
        .expect(200);

      // Check status history
      const historyResult = await testPool.query(
        'SELECT * FROM workflow_status_history WHERE workflow_id = $1',
        [workflowId]
      );

      expect(historyResult.rows).toHaveLength(1);
      expect(historyResult.rows[0]).toMatchObject({
        workflow_id: workflowId,
        status: 'running',
        previous_status: 'pending',
        reason: 'Started by user'
      });
    });

    it('should return 404 for non-existent workflow', async () => {
      const nonExistentId = uuidv4();

      const response = await request(server)
        .put(`/api/workflows/${nonExistentId}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.error.code).toBe('WORKFLOW_NOT_FOUND');
    });

    it('should validate update data', async () => {
      const invalidUpdates = {
        name: '', // Empty name should fail
        priority: 'invalid-priority',
        progress: 150 // Over 100 should fail
      };

      const response = await request(server)
        .put(`/api/workflows/${workflowId}`)
        .send(invalidUpdates)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/workflows/:id', () => {
    let workflowId: string;
    let agentId: string;

    beforeEach(async () => {
      const workflow = createMockWorkflow();
      workflowId = uuidv4();
      agentId = uuidv4();
      
      // Create workflow
      await testPool.query(
        `INSERT INTO workflows (id, name, description, priority, tags, creator, configuration, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          workflowId,
          workflow.name,
          workflow.description,
          workflow.priority,
          workflow.tags,
          workflow.creator,
          workflow.configuration,
          workflow.metadata
        ]
      );

      // Create associated agent
      await testPool.query(
        `INSERT INTO agents (id, workflow_id, name, type, capabilities, tools, execution_context, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          agentId,
          workflowId,
          'Test Agent',
          'analysis',
          ['test'],
          ['tool1'],
          {},
          {}
        ]
      );
    });

    it('should soft delete workflow and associated agents', async () => {
      const deleteData = {
        reason: 'Test deletion',
        deletedBy: 'test-user'
      };

      const response = await request(server)
        .delete(`/api/workflows/${workflowId}`)
        .send(deleteData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Workflow and associated agents soft deleted successfully'
      });

      // Verify workflow is soft deleted
      const workflowResult = await testPool.query(
        'SELECT deleted_at, deleted_by, delete_reason FROM workflows WHERE id = $1',
        [workflowId]
      );
      expect(workflowResult.rows[0].deleted_at).toBeTruthy();
      expect(workflowResult.rows[0].deleted_by).toBe('test-user');
      expect(workflowResult.rows[0].delete_reason).toBe('Test deletion');

      // Verify associated agent is soft deleted
      const agentResult = await testPool.query(
        'SELECT deleted_at, deleted_by FROM agents WHERE id = $1',
        [agentId]
      );
      expect(agentResult.rows[0].deleted_at).toBeTruthy();
      expect(agentResult.rows[0].deleted_by).toBe('test-user');
    });

    it('should return 404 for non-existent workflow', async () => {
      const nonExistentId = uuidv4();

      const response = await request(server)
        .delete(`/api/workflows/${nonExistentId}`)
        .send({ reason: 'Test' })
        .expect(404);

      expect(response.body.error.code).toBe('WORKFLOW_NOT_FOUND');
    });

    it('should return 404 for already deleted workflow', async () => {
      // First delete
      await request(server)
        .delete(`/api/workflows/${workflowId}`)
        .send({ reason: 'First delete' })
        .expect(200);

      // Try to delete again
      const response = await request(server)
        .delete(`/api/workflows/${workflowId}`)
        .send({ reason: 'Second delete' })
        .expect(404);

      expect(response.body.error.code).toBe('WORKFLOW_NOT_FOUND');
    });
  });

  describe('POST /api/workflows/:id/restore', () => {
    let workflowId: string;

    beforeEach(async () => {
      const workflow = createMockWorkflow();
      workflowId = uuidv4();
      
      // Create and soft delete workflow
      await testPool.query(
        `INSERT INTO workflows (id, name, description, priority, tags, creator, configuration, metadata, deleted_at, deleted_by, delete_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)`,
        [
          workflowId,
          workflow.name,
          workflow.description,
          workflow.priority,
          workflow.tags,
          workflow.creator,
          workflow.configuration,
          workflow.metadata,
          'test-user',
          'Test deletion'
        ]
      );
    });

    it('should restore soft deleted workflow', async () => {
      const response = await request(server)
        .post(`/api/workflows/${workflowId}/restore`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Workflow restored successfully'
      });

      // Verify workflow is restored
      const workflowResult = await testPool.query(
        'SELECT deleted_at, deleted_by, delete_reason FROM workflows WHERE id = $1',
        [workflowId]
      );
      expect(workflowResult.rows[0].deleted_at).toBeNull();
      expect(workflowResult.rows[0].deleted_by).toBeNull();
      expect(workflowResult.rows[0].delete_reason).toBeNull();
    });

    it('should return 404 for non-deleted workflow', async () => {
      // Create active workflow
      const activeWorkflowId = uuidv4();
      await testPool.query(
        `INSERT INTO workflows (id, name, description, priority, tags, creator, configuration, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          activeWorkflowId,
          'Active Workflow',
          'Not deleted',
          'medium',
          [],
          'test',
          {},
          {}
        ]
      );

      const response = await request(server)
        .post(`/api/workflows/${activeWorkflowId}/restore`)
        .expect(404);

      expect(response.body.error.code).toBe('WORKFLOW_NOT_FOUND');
    });
  });

  describe('GET /api/workflows/:id/status-history', () => {
    let workflowId: string;

    beforeEach(async () => {
      const workflow = createMockWorkflow();
      workflowId = uuidv4();
      
      await testPool.query(
        `INSERT INTO workflows (id, name, description, priority, tags, creator, configuration, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          workflowId,
          workflow.name,
          workflow.description,
          workflow.priority,
          workflow.tags,
          workflow.creator,
          workflow.configuration,
          workflow.metadata
        ]
      );

      // Create status history
      await testPool.query(
        `INSERT INTO workflow_status_history (workflow_id, status, previous_status, reason)
         VALUES ($1, 'running', 'pending', 'Started by user'),
                ($1, 'completed', 'running', 'Finished successfully')`,
        [workflowId]
      );
    });

    it('should get workflow status history', async () => {
      const response = await request(server)
        .get(`/api/workflows/${workflowId}/status-history`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            workflow_id: workflowId,
            status: 'completed',
            previous_status: 'running',
            reason: 'Finished successfully'
          }),
          expect.objectContaining({
            workflow_id: workflowId,
            status: 'running',
            previous_status: 'pending',
            reason: 'Started by user'
          })
        ])
      });

      expect(response.body.data).toHaveLength(2);
    });

    it('should return empty array for workflow with no history', async () => {
      const newWorkflowId = uuidv4();
      await testPool.query(
        `INSERT INTO workflows (id, name, description, priority, tags, creator, configuration, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          newWorkflowId,
          'New Workflow',
          'No history',
          'medium',
          [],
          'test',
          {},
          {}
        ]
      );

      const response = await request(server)
        .get(`/api/workflows/${newWorkflowId}/status-history`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });
  });
}); 