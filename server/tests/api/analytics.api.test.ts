import request from 'supertest';
import { Express } from 'express';
import { v4 as uuidv4 } from 'uuid';
import app from '../../index';
import { testPool, cleanDatabase, setupTestSchema } from '../testUtils';
import { 
  createMockWorkflow,
  createMockAgent
} from '../mocks/testData';

describe('Analytics API', () => {
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
    await setupTestData();
  });

  // Helper function to set up test data
  const setupTestData = async () => {
    // Create test workflows with various statuses
    const workflows = [
      { id: uuidv4(), name: 'Workflow 1', status: 'completed', priority: 'high', created_at: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // 1 day ago
      { id: uuidv4(), name: 'Workflow 2', status: 'running', priority: 'medium', created_at: new Date(Date.now() - 12 * 60 * 60 * 1000) }, // 12 hours ago
      { id: uuidv4(), name: 'Workflow 3', status: 'failed', priority: 'low', created_at: new Date(Date.now() - 6 * 60 * 60 * 1000) }, // 6 hours ago
      { id: uuidv4(), name: 'Workflow 4', status: 'completed', priority: 'high', created_at: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // 2 hours ago
      { id: uuidv4(), name: 'Workflow 5', status: 'pending', priority: 'medium', created_at: new Date() } // now
    ];

    for (const workflow of workflows) {
      const mockWorkflow = createMockWorkflow();
      await testPool.query(
        `INSERT INTO workflows (id, name, description, status, priority, tags, creator, configuration, metadata, created_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          workflow.id,
          workflow.name,
          mockWorkflow.description,
          workflow.status,
          workflow.priority,
          mockWorkflow.tags,
          mockWorkflow.creator,
          mockWorkflow.configuration,
          mockWorkflow.metadata,
          workflow.created_at,
          workflow.status === 'completed' ? new Date(workflow.created_at.getTime() + 60 * 60 * 1000) : null // completed 1 hour after creation
        ]
      );

      // Create agents for each workflow
      const agentStatuses = ['running', 'idle', 'completed'];
      for (let i = 0; i < 3; i++) {
        const agent = createMockAgent(workflow.id);
        await testPool.query(
          `INSERT INTO agents (id, workflow_id, name, description, type, status, capabilities, tools, execution_context, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            uuidv4(),
            workflow.id,
            `${agent.name} ${i + 1}`,
            agent.description,
            agent.type,
            agentStatuses[i],
            agent.capabilities,
            agent.tools,
            agent.executionContext,
            agent.metadata
          ]
        );
      }
    }
  };

  describe('GET /api/analytics/dashboard', () => {
    it('should return dashboard metrics', async () => {
      const response = await request(server)
        .get('/api/analytics/dashboard')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          totalWorkflows: expect.any(Number),
          activeAgents: expect.any(Number),
          completionRate: expect.any(Number),
          averageExecutionTime: expect.any(Number),
          errorRate: expect.any(Number),
          systemHealth: expect.any(Number)
        }
      });

      // Verify specific values based on test data
      expect(response.body.data.totalWorkflows).toBe(5);
      expect(response.body.data.activeAgents).toBe(5); // 5 workflows * 1 running agent each
      expect(response.body.data.completionRate).toBeGreaterThan(0);
      expect(response.body.data.errorRate).toBeGreaterThanOrEqual(0);
      expect(response.body.data.systemHealth).toBeGreaterThanOrEqual(0);
      expect(response.body.data.systemHealth).toBeLessThanOrEqual(100);
    });

    it('should handle empty database', async () => {
      await cleanDatabase(); // Remove test data

      const response = await request(server)
        .get('/api/analytics/dashboard')
        .expect(200);

      expect(response.body.data).toMatchObject({
        totalWorkflows: 0,
        activeAgents: 0,
        completionRate: 0,
        averageExecutionTime: 0,
        errorRate: 0,
        systemHealth: 100 // No activities means healthy
      });
    });

    it('should support time range filtering', async () => {
      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
        end: new Date().toISOString()
      };

      const response = await request(server)
        .get('/api/analytics/dashboard')
        .query({
          'timeRange.start': timeRange.start,
          'timeRange.end': timeRange.end
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalWorkflows');
      expect(response.body.data).toHaveProperty('activeAgents');
    });
  });

  describe('GET /api/analytics/performance', () => {
    beforeEach(async () => {
      // Add some completed workflows with specific completion times for throughput data
      const completedWorkflows = [
        { time: new Date(Date.now() - 2 * 60 * 60 * 1000), count: 3 }, // 2 hours ago, 3 workflows
        { time: new Date(Date.now() - 1 * 60 * 60 * 1000), count: 2 }, // 1 hour ago, 2 workflows
      ];

      for (const { time, count } of completedWorkflows) {
        for (let i = 0; i < count; i++) {
          const workflow = createMockWorkflow();
          await testPool.query(
            `INSERT INTO workflows (id, name, description, status, priority, tags, creator, configuration, metadata, created_at, completed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              uuidv4(),
              `Perf Workflow ${time.getHours()}-${i}`,
              workflow.description,
              'completed',
              workflow.priority,
              workflow.tags,
              workflow.creator,
              workflow.configuration,
              workflow.metadata,
              new Date(time.getTime() - 60 * 60 * 1000), // Created 1 hour before completion
              time
            ]
          );
        }
      }

      // Add agents with performance data
      const workflowsWithPerf = await testPool.query('SELECT id FROM workflows LIMIT 3');
      for (const workflow of workflowsWithPerf.rows) {
        await testPool.query(
          `INSERT INTO agents (id, workflow_id, name, type, capabilities, tools, execution_context, metadata, performance, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            uuidv4(),
            workflow.id,
            'Performance Agent',
            'analysis',
            ['test'],
            ['tool1'],
            {},
            {},
            {
              executionTime: 1500,
              responseTime: 200,
              successRate: 95,
              errorCount: 1,
              resourceUsage: { cpu: 25.5, memory: 512, apiCalls: 10, tokens: 1000 },
              qualityScore: 0.92
            },
            new Date()
          ]
        );
      }
    });

    it('should return performance metrics', async () => {
      const response = await request(server)
        .get('/api/analytics/performance')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          throughput: expect.any(Array),
          latency: expect.any(Array),
          resourceUtilization: {
            cpu: expect.any(Number),
            memory: expect.any(Number),
            network: expect.any(Number)
          }
        }
      });

      // Resource utilization should be calculated from agent performance data
      expect(response.body.data.resourceUtilization.cpu).toBeGreaterThan(0);
      expect(response.body.data.resourceUtilization.memory).toBeGreaterThan(0);
      expect(response.body.data.resourceUtilization.network).toBe(0); // Placeholder
    });

    it('should handle empty performance data', async () => {
      await cleanDatabase();

      const response = await request(server)
        .get('/api/analytics/performance')
        .expect(200);

      expect(response.body.data).toMatchObject({
        throughput: [],
        latency: [],
        resourceUtilization: {
          cpu: 0,
          memory: 0,
          network: 0
        }
      });
    });
  });

  describe('GET /api/analytics/business', () => {
    it('should return business metrics', async () => {
      const response = await request(server)
        .get('/api/analytics/business')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          roi: expect.any(Number),
          costSavings: expect.any(Number),
          efficiencyGain: expect.any(Number),
          qualityScore: expect.any(Number)
        }
      });

      // ROI should be calculated based on completed vs failed workflows
      expect(response.body.data.roi).toBeGreaterThanOrEqual(-100);
      expect(response.body.data.costSavings).toBeGreaterThanOrEqual(0);
      expect(response.body.data.qualityScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.qualityScore).toBeLessThanOrEqual(100);
    });

    it('should calculate ROI correctly', async () => {
      // Clear existing data and create specific test scenario
      await cleanDatabase();

      // Create 8 completed workflows and 2 failed workflows
      for (let i = 0; i < 8; i++) {
        const workflow = createMockWorkflow();
        await testPool.query(
          `INSERT INTO workflows (id, name, description, status, priority, tags, creator, configuration, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            uuidv4(),
            `Completed Workflow ${i}`,
            workflow.description,
            'completed',
            workflow.priority,
            workflow.tags,
            workflow.creator,
            workflow.configuration,
            workflow.metadata,
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
          ]
        );
      }

      for (let i = 0; i < 2; i++) {
        const workflow = createMockWorkflow();
        await testPool.query(
          `INSERT INTO workflows (id, name, description, status, priority, tags, creator, configuration, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            uuidv4(),
            `Failed Workflow ${i}`,
            workflow.description,
            'failed',
            workflow.priority,
            workflow.tags,
            workflow.creator,
            workflow.configuration,
            workflow.metadata,
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
          ]
        );
      }

      const response = await request(server)
        .get('/api/analytics/business')
        .expect(200);

      // ROI should be ((8 - 2) / 10) * 100 = 60%
      expect(response.body.data.roi).toBe(60);
      expect(response.body.data.costSavings).toBe(800); // 8 completed * 100
      expect(response.body.data.qualityScore).toBe(80); // 8/10 * 100
    });
  });

  describe('GET /api/analytics/workflows/:id', () => {
    let workflowId: string;
    let agentIds: string[];

    beforeEach(async () => {
      await cleanDatabase();
      
      // Create a specific workflow for detailed analytics
      workflowId = uuidv4();
      const workflow = createMockWorkflow();
      
      await testPool.query(
        `INSERT INTO workflows (id, name, description, status, priority, tags, creator, configuration, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          workflowId,
          workflow.name,
          workflow.description,
          'running',
          'high',
          workflow.tags,
          workflow.creator,
          workflow.configuration,
          workflow.metadata
        ]
      );

      // Create agents with different statuses
      agentIds = [];
      const agentStatuses = ['completed', 'running', 'idle'];
      for (let i = 0; i < 3; i++) {
        const agentId = uuidv4();
        agentIds.push(agentId);
        const agent = createMockAgent(workflowId);
        
        await testPool.query(
          `INSERT INTO agents (id, workflow_id, name, description, type, status, progress, capabilities, tools, execution_context, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            agentId,
            workflowId,
            `${agent.name} ${i + 1}`,
            agent.description,
            agent.type,
            agentStatuses[i],
            (i + 1) * 25, // 25%, 50%, 75% progress
            agent.capabilities,
            agent.tools,
            agent.executionContext,
            agent.metadata
          ]
        );
      }

      // Create status history
      await testPool.query(
        `INSERT INTO workflow_status_history (workflow_id, status, previous_status, reason)
         VALUES ($1, 'running', 'pending', 'Started by user'),
                ($1, 'paused', 'running', 'Paused for maintenance')`,
        [workflowId]
      );
    });

    it('should return workflow-specific analytics', async () => {
      const response = await request(server)
        .get(`/api/analytics/workflows/${workflowId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          workflow: {
            id: workflowId,
            name: 'Test Workflow',
            status: 'running',
            progress: 0
          },
          agents: {
            total: 3,
            completed: 1,
            averageProgress: expect.any(Number)
          },
          statusHistory: expect.arrayContaining([
            expect.objectContaining({
              workflow_id: workflowId,
              status: 'running',
              previous_status: 'pending'
            })
          ])
        }
      });

      expect(response.body.data.agents.averageProgress).toBeCloseTo(50, 1); // (25+50+75)/3 = 50
      expect(response.body.data.statusHistory).toHaveLength(2);
    });

    it('should return 404 for non-existent workflow', async () => {
      const nonExistentId = uuidv4();

      const response = await request(server)
        .get(`/api/analytics/workflows/${nonExistentId}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Workflow not found',
          code: 'WORKFLOW_NOT_FOUND'
        }
      });
    });
  });

  describe('GET /api/analytics/agents/:id', () => {
    let workflowId: string;
    let agentId: string;

    beforeEach(async () => {
      await cleanDatabase();
      
      // Create workflow and agent for detailed analytics
      workflowId = uuidv4();
      agentId = uuidv4();
      
      const workflow = createMockWorkflow();
      await testPool.query(
        `INSERT INTO workflows (id, name, description, status, priority, tags, creator, configuration, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          workflowId,
          workflow.name,
          workflow.description,
          'running',
          'high',
          workflow.tags,
          workflow.creator,
          workflow.configuration,
          workflow.metadata
        ]
      );

      const agent = createMockAgent(workflowId);
      await testPool.query(
        `INSERT INTO agents (id, workflow_id, name, description, type, status, progress, capabilities, tools, execution_context, metadata, performance)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          agentId,
          workflowId,
          agent.name,
          agent.description,
          agent.type,
          'running',
          75,
          agent.capabilities,
          agent.tools,
          agent.executionContext,
          agent.metadata,
          {
            executionTime: 2500,
            responseTime: 150,
            successRate: 92,
            errorCount: 3,
            resourceUsage: { cpu: 35.2, memory: 768, apiCalls: 25, tokens: 2500 },
            qualityScore: 0.88
          }
        ]
      );

      // Create log entries
      const logLevels = ['info', 'warn', 'error'];
      for (let i = 0; i < logLevels.length; i++) {
        await testPool.query(
          `INSERT INTO log_entries (id, agent_id, workflow_id, level, message, context)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            uuidv4(),
            agentId,
            workflowId,
            logLevels[i],
            `Test ${logLevels[i]} message`,
            { operation: `test-${i}` }
          ]
        );
      }

      // Create results
      const resultTypes = ['data', 'metric'];
      for (let i = 0; i < resultTypes.length; i++) {
        await testPool.query(
          `INSERT INTO agent_results (id, agent_id, workflow_id, type, data, metadata, quality_metrics, execution_time)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            uuidv4(),
            agentId,
            workflowId,
            resultTypes[i],
            { result: `test-${resultTypes[i]}` },
            { source: 'test' },
            { accuracy: 0.9, completeness: 0.85, relevance: 0.92, confidence: 0.88 },
            1500 + (i * 500) // 1500ms, 2000ms
          ]
        );
      }

      // Create status history
      await testPool.query(
        `INSERT INTO agent_status_history (agent_id, status, previous_status, reason)
         VALUES ($1, 'running', 'idle', 'Task assigned'),
                ($1, 'waiting', 'running', 'Waiting for dependency')`,
        [agentId]
      );
    });

    it('should return agent-specific analytics', async () => {
      const response = await request(server)
        .get(`/api/analytics/agents/${agentId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          agent: {
            id: agentId,
            name: 'Test Agent',
            type: 'analysis',
            status: 'running',
            progress: 75,
            performance: expect.objectContaining({
              executionTime: 2500,
              responseTime: 150,
              successRate: 92
            })
          },
          logs: {
            info: 1,
            warn: 1,
            error: 1
          },
          results: expect.arrayContaining([
            expect.objectContaining({
              type: 'data',
              count: 1,
              averageExecutionTime: 1500
            }),
            expect.objectContaining({
              type: 'metric',
              count: 1,
              averageExecutionTime: 2000
            })
          ]),
          statusHistory: expect.arrayContaining([
            expect.objectContaining({
              agent_id: agentId,
              status: 'running',
              previous_status: 'idle'
            })
          ])
        }
      });

      expect(response.body.data.results).toHaveLength(2);
      expect(response.body.data.statusHistory).toHaveLength(2);
    });

    it('should return 404 for non-existent agent', async () => {
      const nonExistentId = uuidv4();

      const response = await request(server)
        .get(`/api/analytics/agents/${nonExistentId}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Agent not found',
          code: 'AGENT_NOT_FOUND'
        }
      });
    });
  });

  describe('Error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Close the test pool to simulate connection error
      await testPool.end();

      const response = await request(server)
        .get('/api/analytics/dashboard')
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'DATABASE_ERROR'
        }
      });
    });
  });
}); 