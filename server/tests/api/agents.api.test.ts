import request from 'supertest';
import { Express } from 'express';
import { v4 as uuidv4 } from 'uuid';
import app from '../../index';
import { testPool, cleanDatabase, setupTestSchema } from '../testUtils';
import { 
  createMockWorkflow,
  createMockAgent, 
  createMockAgentFromDB,
  createMultipleAgents,
  createInvalidAgent,
  createSoftDeletedAgent,
  createMockLogEntry,
  createMockAgentResult,
  agentStatusTransitions
} from '../mocks/testData';

describe('Agents API', () => {
  let server: Express;
  let workflowId: string;

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
    
    // Create a test workflow for agents
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

  describe('POST /api/agents', () => {
    it('should create a new agent', async () => {
      const agentData = createMockAgent(workflowId);

      const response = await request(server)
        .post('/api/agents')
        .send(agentData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          workflowId: workflowId,
          name: agentData.name,
          description: agentData.description,
          type: agentData.type,
          status: 'idle',
          progress: 0,
          capabilities: agentData.capabilities,
          tools: agentData.tools,
          createdAt: expect.any(String),
          updatedAt: expect.any(String)
        }
      });

      // Verify in database
      const dbResult = await testPool.query(
        'SELECT * FROM agents WHERE id = $1',
        [response.body.data.id]
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].name).toBe(agentData.name);
      expect(dbResult.rows[0].workflow_id).toBe(workflowId);
    });

    it('should reject agent with non-existent workflow', async () => {
      const nonExistentWorkflowId = uuidv4();
      const agentData = createMockAgent(nonExistentWorkflowId);

      const response = await request(server)
        .post('/api/agents')
        .send(agentData)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND'
        }
      });
    });

    it('should reject invalid agent data', async () => {
      const invalidData = createInvalidAgent(workflowId);

      const response = await request(server)
        .post('/api/agents')
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR'
        }
      });
    });

    it('should create agent with minimal data', async () => {
      const minimalData = {
        workflowId: workflowId,
        name: 'Minimal Test Agent',
        type: 'analysis'
      };

      const response = await request(server)
        .post('/api/agents')
        .send(minimalData)
        .expect(201);

      expect(response.body.data).toMatchObject({
        workflowId: workflowId,
        name: minimalData.name,
        type: minimalData.type,
        status: 'idle',
        progress: 0,
        capabilities: [],
        tools: []
      });
    });
  });

  describe('GET /api/agents', () => {
    let agent1Id: string;
    let agent2Id: string;
    let agent3Id: string;

    beforeEach(async () => {
      // Create test agents
      const agents = createMultipleAgents(workflowId, 3);
      const agentIds = [uuidv4(), uuidv4(), uuidv4()];
      [agent1Id, agent2Id, agent3Id] = agentIds;

      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        await testPool.query(
          `INSERT INTO agents (id, workflow_id, name, description, type, capabilities, tools, execution_context, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            agentIds[i],
            workflowId,
            agent.name,
            agent.description,
            agent.type,
            agent.capabilities,
            agent.tools,
            agent.executionContext,
            agent.metadata
          ]
        );
      }
    });

    it('should list all agents', async () => {
      const response = await request(server)
        .get('/api/agents')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          agents: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              name: expect.any(String),
              type: expect.any(String),
              status: expect.any(String)
            })
          ]),
          pagination: {
            page: 1,
            pageSize: 20,
            total: 3,
            totalPages: 1
          }
        }
      });

      expect(response.body.data.agents).toHaveLength(3);
    });

    it('should filter agents by workflow', async () => {
      // Create another workflow with agents
      const anotherWorkflowId = uuidv4();
      await testPool.query(
        `INSERT INTO workflows (id, name, description, priority, tags, creator, configuration, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [anotherWorkflowId, 'Another Workflow', '', 'medium', [], 'test', {}, {}]
      );

      const anotherAgent = createMockAgent(anotherWorkflowId);
      await testPool.query(
        `INSERT INTO agents (id, workflow_id, name, description, type, capabilities, tools, execution_context, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          uuidv4(),
          anotherWorkflowId,
          anotherAgent.name,
          anotherAgent.description,
          anotherAgent.type,
          anotherAgent.capabilities,
          anotherAgent.tools,
          anotherAgent.executionContext,
          anotherAgent.metadata
        ]
      );

      const response = await request(server)
        .get(`/api/agents?workflowId=${workflowId}`)
        .expect(200);

      expect(response.body.data.agents).toHaveLength(3);
      response.body.data.agents.forEach((agent: any) => {
        expect(agent.workflowId).toBe(workflowId);
      });
    });

    it('should filter by agent status', async () => {
      // Update one agent to running status
      await testPool.query(
        "UPDATE agents SET status = 'running' WHERE id = $1",
        [agent1Id]
      );

      const response = await request(server)
        .get('/api/agents?status=running')
        .expect(200);

      expect(response.body.data.agents).toHaveLength(1);
      expect(response.body.data.agents[0].status).toBe('running');
      expect(response.body.data.agents[0].id).toBe(agent1Id);
    });

    it('should filter by agent type', async () => {
      // Update some agents to different types
      await testPool.query(
        "UPDATE agents SET type = 'processing' WHERE id IN ($1, $2)",
        [agent1Id, agent2Id]
      );

      const response = await request(server)
        .get('/api/agents?type=processing')
        .expect(200);

      expect(response.body.data.agents).toHaveLength(2);
      response.body.data.agents.forEach((agent: any) => {
        expect(agent.type).toBe('processing');
      });
    });

    it('should support pagination', async () => {
      const response = await request(server)
        .get('/api/agents?page=1&pageSize=2')
        .expect(200);

      expect(response.body.data.agents).toHaveLength(2);
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2
      });
    });

    it('should exclude soft-deleted agents by default', async () => {
      // Soft delete one agent
      await testPool.query(
        "UPDATE agents SET deleted_at = NOW(), deleted_by = 'test' WHERE id = $1",
        [agent1Id]
      );

      const response = await request(server)
        .get('/api/agents')
        .expect(200);

      expect(response.body.data.agents).toHaveLength(2);
      const returnedIds = response.body.data.agents.map((a: any) => a.id);
      expect(returnedIds).not.toContain(agent1Id);
    });
  });

  describe('GET /api/agents/:id', () => {
    let agentId: string;

    beforeEach(async () => {
      const agent = createMockAgent(workflowId);
      agentId = uuidv4();
      
      await testPool.query(
        `INSERT INTO agents (id, workflow_id, name, description, type, capabilities, tools, execution_context, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          agentId,
          workflowId,
          agent.name,
          agent.description,
          agent.type,
          agent.capabilities,
          agent.tools,
          agent.executionContext,
          agent.metadata
        ]
      );
    });

    it('should get agent by id', async () => {
      const response = await request(server)
        .get(`/api/agents/${agentId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: agentId,
          workflowId: workflowId,
          name: 'Test Agent',
          type: 'analysis',
          status: 'idle'
        }
      });
    });

    it('should include logs when requested', async () => {
      // Create log entries for this agent
      const logEntry = createMockLogEntry(agentId, workflowId);
      await testPool.query(
        `INSERT INTO log_entries (id, agent_id, workflow_id, level, message, context)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), agentId, workflowId, logEntry.level, logEntry.message, logEntry.context]
      );

      const response = await request(server)
        .get(`/api/agents/${agentId}?includeLogs=true`)
        .expect(200);

      expect(response.body.data.logs).toHaveLength(1);
      expect(response.body.data.logs[0]).toMatchObject({
        agentId: agentId,
        workflowId: workflowId,
        level: logEntry.level,
        message: logEntry.message
      });
    });

    it('should include results when requested', async () => {
      // Create result entries for this agent
      const result = createMockAgentResult(agentId, workflowId);
      await testPool.query(
        `INSERT INTO agent_results (id, agent_id, workflow_id, type, data, metadata, quality_metrics)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), agentId, workflowId, result.type, result.data, result.metadata, result.quality]
      );

      const response = await request(server)
        .get(`/api/agents/${agentId}?includeResults=true`)
        .expect(200);

      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.results[0]).toMatchObject({
        agentId: agentId,
        workflowId: workflowId,
        type: result.type,
        data: result.data
      });
    });

    it('should return 404 for non-existent agent', async () => {
      const nonExistentId = uuidv4();

      const response = await request(server)
        .get(`/api/agents/${nonExistentId}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'AGENT_NOT_FOUND'
        }
      });
    });
  });

  describe('PUT /api/agents/:id', () => {
    let agentId: string;

    beforeEach(async () => {
      const agent = createMockAgent(workflowId);
      agentId = uuidv4();
      
      await testPool.query(
        `INSERT INTO agents (id, workflow_id, name, description, type, capabilities, tools, execution_context, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          agentId,
          workflowId,
          agent.name,
          agent.description,
          agent.type,
          agent.capabilities,
          agent.tools,
          agent.executionContext,
          agent.metadata
        ]
      );
    });

    it('should update agent fields', async () => {
      const updates = {
        name: 'Updated Agent Name',
        description: 'Updated description',
        status: 'running',
        progress: 75
      };

      const response = await request(server)
        .put(`/api/agents/${agentId}`)
        .send(updates)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: agentId,
          name: updates.name,
          description: updates.description,
          status: updates.status,
          progress: updates.progress
        }
      });

      // Verify in database
      const dbResult = await testPool.query(
        'SELECT * FROM agents WHERE id = $1',
        [agentId]
      );
      expect(dbResult.rows[0].name).toBe(updates.name);
      expect(dbResult.rows[0].status).toBe(updates.status);
    });

    it('should track status changes in history', async () => {
      const statusUpdate = {
        status: 'running',
        statusChangeReason: 'Started processing'
      };

      await request(server)
        .put(`/api/agents/${agentId}`)
        .send(statusUpdate)
        .expect(200);

      // Check status history
      const historyResult = await testPool.query(
        'SELECT * FROM agent_status_history WHERE agent_id = $1',
        [agentId]
      );

      expect(historyResult.rows).toHaveLength(1);
      expect(historyResult.rows[0]).toMatchObject({
        agent_id: agentId,
        status: 'running',
        previous_status: 'idle',
        reason: 'Started processing'
      });
    });

    it('should return 404 for non-existent agent', async () => {
      const nonExistentId = uuidv4();

      const response = await request(server)
        .put(`/api/agents/${nonExistentId}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.error.code).toBe('AGENT_NOT_FOUND');
    });

    it('should validate update data', async () => {
      const invalidUpdates = {
        name: '', // Empty name should fail
        status: 'invalid-status',
        progress: -10 // Negative progress should fail
      };

      const response = await request(server)
        .put(`/api/agents/${agentId}`)
        .send(invalidUpdates)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/agents/:id', () => {
    let agentId: string;

    beforeEach(async () => {
      const agent = createMockAgent(workflowId);
      agentId = uuidv4();
      
      await testPool.query(
        `INSERT INTO agents (id, workflow_id, name, description, type, capabilities, tools, execution_context, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          agentId,
          workflowId,
          agent.name,
          agent.description,
          agent.type,
          agent.capabilities,
          agent.tools,
          agent.executionContext,
          agent.metadata
        ]
      );
    });

    it('should soft delete agent', async () => {
      const deleteData = {
        reason: 'Test agent deletion',
        deletedBy: 'test-user'
      };

      const response = await request(server)
        .delete(`/api/agents/${agentId}`)
        .send(deleteData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Agent soft deleted successfully'
      });

      // Verify agent is soft deleted
      const agentResult = await testPool.query(
        'SELECT deleted_at, deleted_by, delete_reason FROM agents WHERE id = $1',
        [agentId]
      );
      expect(agentResult.rows[0].deleted_at).toBeTruthy();
      expect(agentResult.rows[0].deleted_by).toBe('test-user');
      expect(agentResult.rows[0].delete_reason).toBe('Test agent deletion');
    });

    it('should return 404 for non-existent agent', async () => {
      const nonExistentId = uuidv4();

      const response = await request(server)
        .delete(`/api/agents/${nonExistentId}`)
        .send({ reason: 'Test' })
        .expect(404);

      expect(response.body.error.code).toBe('AGENT_NOT_FOUND');
    });
  });

  describe('POST /api/agents/:id/restore', () => {
    let agentId: string;

    beforeEach(async () => {
      const agent = createMockAgent(workflowId);
      agentId = uuidv4();
      
      // Create and soft delete agent
      await testPool.query(
        `INSERT INTO agents (id, workflow_id, name, description, type, capabilities, tools, execution_context, metadata, deleted_at, deleted_by, delete_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11)`,
        [
          agentId,
          workflowId,
          agent.name,
          agent.description,
          agent.type,
          agent.capabilities,
          agent.tools,
          agent.executionContext,
          agent.metadata,
          'test-user',
          'Test deletion'
        ]
      );
    });

    it('should restore soft deleted agent', async () => {
      const response = await request(server)
        .post(`/api/agents/${agentId}/restore`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Agent restored successfully'
      });

      // Verify agent is restored
      const agentResult = await testPool.query(
        'SELECT deleted_at, deleted_by, delete_reason FROM agents WHERE id = $1',
        [agentId]
      );
      expect(agentResult.rows[0].deleted_at).toBeNull();
      expect(agentResult.rows[0].deleted_by).toBeNull();
      expect(agentResult.rows[0].delete_reason).toBeNull();
    });

    it('should return 404 for non-deleted agent', async () => {
      // Create active agent
      const activeAgentId = uuidv4();
      const agent = createMockAgent(workflowId);
      await testPool.query(
        `INSERT INTO agents (id, workflow_id, name, description, type, capabilities, tools, execution_context, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          activeAgentId,
          workflowId,
          agent.name,
          agent.description,
          agent.type,
          agent.capabilities,
          agent.tools,
          agent.executionContext,
          agent.metadata
        ]
      );

      const response = await request(server)
        .post(`/api/agents/${activeAgentId}/restore`)
        .expect(404);

      expect(response.body.error.code).toBe('AGENT_NOT_FOUND');
    });
  });

  describe('POST /api/agents/:id/logs', () => {
    let agentId: string;

    beforeEach(async () => {
      const agent = createMockAgent(workflowId);
      agentId = uuidv4();
      
      await testPool.query(
        `INSERT INTO agents (id, workflow_id, name, description, type, capabilities, tools, execution_context, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          agentId,
          workflowId,
          agent.name,
          agent.description,
          agent.type,
          agent.capabilities,
          agent.tools,
          agent.executionContext,
          agent.metadata
        ]
      );
    });

    it('should add log entry to agent', async () => {
      const logData = {
        level: 'info',
        message: 'Agent started processing task',
        context: {
          taskId: 'task-123',
          duration: 150
        }
      };

      const response = await request(server)
        .post(`/api/agents/${agentId}/logs`)
        .send(logData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          agentId: agentId,
          workflowId: workflowId,
          level: logData.level,
          message: logData.message,
          context: logData.context,
          timestamp: expect.any(String)
        }
      });

      // Verify in database
      const dbResult = await testPool.query(
        'SELECT * FROM log_entries WHERE agent_id = $1',
        [agentId]
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].message).toBe(logData.message);
    });

    it('should add error log with error info', async () => {
      const errorLogData = {
        level: 'error',
        message: 'Task processing failed',
        context: {
          taskId: 'task-456'
        },
        error: {
          code: 'PROCESSING_ERROR',
          message: 'Failed to parse input data',
          stack: 'Error: Failed to parse...'
        }
      };

      const response = await request(server)
        .post(`/api/agents/${agentId}/logs`)
        .send(errorLogData)
        .expect(201);

      expect(response.body.data).toMatchObject({
        level: 'error',
        message: errorLogData.message,
        error: errorLogData.error
      });
    });

    it('should return 404 for non-existent agent', async () => {
      const nonExistentId = uuidv4();

      const response = await request(server)
        .post(`/api/agents/${nonExistentId}/logs`)
        .send({
          level: 'info',
          message: 'Test log'
        })
        .expect(404);

      expect(response.body.error.code).toBe('AGENT_NOT_FOUND');
    });

    it('should validate log data', async () => {
      const invalidLogData = {
        level: 'invalid-level', // Invalid log level
        // Missing required message field
        context: 'not-an-object' // Should be object
      };

      const response = await request(server)
        .post(`/api/agents/${agentId}/logs`)
        .send(invalidLogData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/agents/:id/results', () => {
    let agentId: string;

    beforeEach(async () => {
      const agent = createMockAgent(workflowId);
      agentId = uuidv4();
      
      await testPool.query(
        `INSERT INTO agents (id, workflow_id, name, description, type, capabilities, tools, execution_context, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          agentId,
          workflowId,
          agent.name,
          agent.description,
          agent.type,
          agent.capabilities,
          agent.tools,
          agent.executionContext,
          agent.metadata
        ]
      );
    });

    it('should add result to agent', async () => {
      const resultData = {
        type: 'data',
        data: {
          processedRecords: 150,
          outputPath: '/results/output.json',
          summary: 'Processing completed successfully'
        },
        metadata: {
          processingTime: 1200,
          memoryUsed: '64MB'
        },
        quality: {
          accuracy: 0.95,
          completeness: 0.98,
          relevance: 0.92,
          confidence: 0.88
        },
        executionTime: 1200,
        memoryUsage: 67108864, // 64MB in bytes
        cpuUsage: 15.5
      };

      const response = await request(server)
        .post(`/api/agents/${agentId}/results`)
        .send(resultData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          agentId: agentId,
          workflowId: workflowId,
          type: resultData.type,
          data: resultData.data,
          metadata: resultData.metadata,
          quality: resultData.quality,
          executionTime: resultData.executionTime,
          memoryUsage: resultData.memoryUsage,
          cpuUsage: resultData.cpuUsage,
          timestamp: expect.any(String)
        }
      });

      // Verify in database
      const dbResult = await testPool.query(
        'SELECT * FROM agent_results WHERE agent_id = $1',
        [agentId]
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].type).toBe(resultData.type);
    });

    it('should add different types of results', async () => {
      const resultTypes = ['data', 'metric', 'insight', 'recommendation', 'alert'];
      
      for (const type of resultTypes) {
        const resultData = {
          type: type,
          data: {
            type: type,
            value: `test-${type}`
          }
        };

        await request(server)
          .post(`/api/agents/${agentId}/results`)
          .send(resultData)
          .expect(201);
      }

      // Verify all results are stored
      const dbResult = await testPool.query(
        'SELECT type FROM agent_results WHERE agent_id = $1 ORDER BY type',
        [agentId]
      );
      expect(dbResult.rows).toHaveLength(5);
      expect(dbResult.rows.map(r => r.type)).toEqual(resultTypes.sort());
    });

    it('should return 404 for non-existent agent', async () => {
      const nonExistentId = uuidv4();

      const response = await request(server)
        .post(`/api/agents/${nonExistentId}/results`)
        .send({
          type: 'data',
          data: { result: 'test' }
        })
        .expect(404);

      expect(response.body.error.code).toBe('AGENT_NOT_FOUND');
    });

    it('should validate result data', async () => {
      const invalidResultData = {
        type: 'invalid-type', // Invalid result type
        // Missing required data field
        metadata: 'not-an-object' // Should be object
      };

      const response = await request(server)
        .post(`/api/agents/${agentId}/results`)
        .send(invalidResultData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/agents/:id/status-history', () => {
    let agentId: string;

    beforeEach(async () => {
      const agent = createMockAgent(workflowId);
      agentId = uuidv4();
      
      await testPool.query(
        `INSERT INTO agents (id, workflow_id, name, description, type, capabilities, tools, execution_context, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          agentId,
          workflowId,
          agent.name,
          agent.description,
          agent.type,
          agent.capabilities,
          agent.tools,
          agent.executionContext,
          agent.metadata
        ]
      );

      // Create status history
      await testPool.query(
        `INSERT INTO agent_status_history (agent_id, status, previous_status, reason)
         VALUES ($1, 'running', 'idle', 'Task assigned'),
                ($1, 'completed', 'running', 'Task finished successfully')`,
        [agentId]
      );
    });

    it('should get agent status history', async () => {
      const response = await request(server)
        .get(`/api/agents/${agentId}/status-history`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            agent_id: agentId,
            status: 'completed',
            previous_status: 'running',
            reason: 'Task finished successfully'
          }),
          expect.objectContaining({
            agent_id: agentId,
            status: 'running',
            previous_status: 'idle',
            reason: 'Task assigned'
          })
        ])
      });

      expect(response.body.data).toHaveLength(2);
    });

    it('should return empty array for agent with no history', async () => {
      const newAgentId = uuidv4();
      const agent = createMockAgent(workflowId);
      await testPool.query(
        `INSERT INTO agents (id, workflow_id, name, description, type, capabilities, tools, execution_context, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          newAgentId,
          workflowId,
          agent.name,
          agent.description,
          agent.type,
          agent.capabilities,
          agent.tools,
          agent.executionContext,
          agent.metadata
        ]
      );

      const response = await request(server)
        .get(`/api/agents/${newAgentId}/status-history`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });
  });
}); 