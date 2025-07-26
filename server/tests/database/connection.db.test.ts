import { testPool, cleanDatabase, setupTestSchema } from '../testUtils';
import { query, withTransaction, checkHealth } from '../../database/connection';

describe('Database Connection', () => {
  beforeAll(async () => {
    await setupTestSchema();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('Basic Connection', () => {
    it('should connect to test database', async () => {
      const result = await testPool.query('SELECT NOW() as current_time');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].current_time).toBeInstanceOf(Date);
    });

    it('should execute queries with parameters', async () => {
      const testValue = 'test-value';
      const result = await testPool.query('SELECT $1 as test_column', [testValue]);
      expect(result.rows[0].test_column).toBe(testValue);
    });
  });

  describe('Query Helper Function', () => {
    it('should execute queries successfully', async () => {
      const result = await query('SELECT 1 + 1 as sum');
      expect(result.rows[0].sum).toBe(2);
    });

    it('should handle parameterized queries', async () => {
      const result = await query('SELECT $1 as value', ['test']);
      expect(result.rows[0].value).toBe('test');
    });

    it('should throw error for invalid queries', async () => {
      await expect(query('INVALID SQL QUERY')).rejects.toThrow();
    });
  });

  describe('Transaction Helper', () => {
    it('should commit successful transactions', async () => {
      const testId = 'test-workflow-id';
      
      await withTransaction(async (client) => {
        await client.query(
          "INSERT INTO workflows (id, name, description, priority, tags, creator, configuration, metadata) VALUES ($1, 'Test', 'Test desc', 'medium', '{}', 'test', '{}', '{}')",
          [testId]
        );
      });

      // Verify the record was committed
      const result = await testPool.query('SELECT * FROM workflows WHERE id = $1', [testId]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(testId);
    });

    it('should rollback failed transactions', async () => {
      const testId = 'test-workflow-rollback';
      
      await expect(
        withTransaction(async (client) => {
          await client.query(
            "INSERT INTO workflows (id, name, description, priority, tags, creator, configuration, metadata) VALUES ($1, 'Test', 'Test desc', 'medium', '{}', 'test', '{}', '{}')",
            [testId]
          );
          // Force an error to trigger rollback
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      // Verify the record was not committed
      const result = await testPool.query('SELECT * FROM workflows WHERE id = $1', [testId]);
      expect(result.rows).toHaveLength(0);
    });

    it('should handle database errors in transactions', async () => {
      await expect(
        withTransaction(async (client) => {
          // Try to insert with invalid data type
          await client.query(
            "INSERT INTO workflows (id, name, description, priority, tags, creator, configuration, metadata) VALUES ($1, 'Test', 'Test desc', 'invalid-priority', '{}', 'test', '{}', '{}')",
            ['test-id']
          );
        })
      ).rejects.toThrow();

      // Verify no record was inserted
      const result = await testPool.query('SELECT * FROM workflows');
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when database is available', async () => {
      const health = await checkHealth();
      
      expect(health).toMatchObject({
        status: 'healthy',
        details: {
          database: expect.objectContaining({
            current_time: expect.any(Date),
            version: expect.any(String)
          }),
          pool: expect.objectContaining({
            totalCount: expect.any(Number),
            idleCount: expect.any(Number),
            waitingCount: expect.any(Number)
          }),
          timestamp: expect.any(String)
        }
      });
    });

    it('should return pool statistics', async () => {
      const health = await checkHealth();
      
      expect(health.details.pool.totalCount).toBeGreaterThanOrEqual(0);
      expect(health.details.pool.idleCount).toBeGreaterThanOrEqual(0);
      expect(health.details.pool.waitingCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Connection Pool', () => {
    it('should handle multiple concurrent queries', async () => {
      const queries = Array.from({ length: 10 }, (_, i) =>
        testPool.query('SELECT $1 as query_id', [i])
      );

      const results = await Promise.all(queries);
      
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.rows[0].query_id).toBe(index);
      });
    });

    it('should reuse connections efficiently', async () => {
      const health1 = await checkHealth();
      const initialConnections = health1.details.pool.totalCount;

      // Execute multiple queries
      for (let i = 0; i < 5; i++) {
        await testPool.query('SELECT $1', [i]);
      }

      const health2 = await checkHealth();
      const finalConnections = health2.details.pool.totalCount;

      // Connection count should not increase dramatically
      expect(finalConnections).toBeLessThanOrEqual(initialConnections + 2);
    });
  });

  describe('Database Schema', () => {
    it('should have all required tables', async () => {
      const tables = await testPool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const tableNames = tables.rows.map(row => row.table_name);
      
      expect(tableNames).toContain('workflows');
      expect(tableNames).toContain('agents');
      expect(tableNames).toContain('log_entries');
      expect(tableNames).toContain('agent_results');
      expect(tableNames).toContain('workflow_status_history');
      expect(tableNames).toContain('agent_status_history');
    });

    it('should have required enums', async () => {
      const enums = await testPool.query(`
        SELECT typname 
        FROM pg_type 
        WHERE typtype = 'e'
        ORDER BY typname
      `);

      const enumNames = enums.rows.map(row => row.typname);
      
      expect(enumNames).toContain('workflow_status');
      expect(enumNames).toContain('agent_status');
      expect(enumNames).toContain('agent_type');
      expect(enumNames).toContain('priority');
      expect(enumNames).toContain('log_level');
      expect(enumNames).toContain('result_type');
    });

    it('should have UUID extension enabled', async () => {
      const extensions = await testPool.query(`
        SELECT extname 
        FROM pg_extension 
        WHERE extname = 'uuid-ossp'
      `);

      expect(extensions.rows).toHaveLength(1);
      expect(extensions.rows[0].extname).toBe('uuid-ossp');
    });

    it('should generate UUIDs correctly', async () => {
      const result = await testPool.query('SELECT uuid_generate_v4() as uuid');
      const uuid = result.rows[0].uuid;
      
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('Constraints and Relationships', () => {
    it('should enforce foreign key constraints', async () => {
      const nonExistentWorkflowId = 'non-existent-workflow-id';
      
      await expect(
        testPool.query(
          `INSERT INTO agents (id, workflow_id, name, type, capabilities, tools, execution_context, metadata)
           VALUES ('test-agent-id', $1, 'Test Agent', 'analysis', '{}', '{}', '{}', '{}')`,
          [nonExistentWorkflowId]
        )
      ).rejects.toThrow();
    });

    it('should enforce enum constraints', async () => {
      await expect(
        testPool.query(
          `INSERT INTO workflows (id, name, description, priority, tags, creator, configuration, metadata)
           VALUES ('test-id', 'Test', 'Test desc', 'invalid-priority', '{}', 'test', '{}', '{}')`,
        )
      ).rejects.toThrow();
    });

    it('should enforce check constraints', async () => {
      // Try to insert progress > 100
      await expect(
        testPool.query(
          `INSERT INTO workflows (id, name, description, priority, progress, tags, creator, configuration, metadata)
           VALUES ('test-id', 'Test', 'Test desc', 'medium', 150, '{}', 'test', '{}', '{}')`,
        )
      ).rejects.toThrow();
    });
  });

  describe('Indexes', () => {
    it('should have performance indexes', async () => {
      const indexes = await testPool.query(`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
        ORDER BY indexname
      `);

      const indexNames = indexes.rows.map(row => row.indexname);
      
      expect(indexNames).toContain('idx_workflows_status');
      expect(indexNames).toContain('idx_agents_workflow_id');
      expect(indexNames).toContain('idx_logs_agent_id');
      expect(indexNames).toContain('idx_results_agent_id');
    });
  });

  describe('Triggers', () => {
    it('should update updated_at timestamp on workflow update', async () => {
      // Insert workflow
      const workflowId = 'test-workflow-trigger';
      await testPool.query(
        `INSERT INTO workflows (id, name, description, priority, tags, creator, configuration, metadata)
         VALUES ($1, 'Test', 'Test desc', 'medium', '{}', 'test', '{}', '{}')`,
        [workflowId]
      );

      // Get initial timestamp
      const initial = await testPool.query('SELECT updated_at FROM workflows WHERE id = $1', [workflowId]);
      const initialTime = initial.rows[0].updated_at;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update workflow
      await testPool.query('UPDATE workflows SET name = $1 WHERE id = $2', ['Updated Name', workflowId]);

      // Get updated timestamp
      const updated = await testPool.query('SELECT updated_at FROM workflows WHERE id = $1', [workflowId]);
      const updatedTime = updated.rows[0].updated_at;

      expect(new Date(updatedTime)).toBeInstanceOf(Date);
      expect(new Date(updatedTime).getTime()).toBeGreaterThan(new Date(initialTime).getTime());
    });

    it('should update updated_at timestamp on agent update', async () => {
      // Insert workflow first
      const workflowId = 'test-workflow-for-agent';
      await testPool.query(
        `INSERT INTO workflows (id, name, description, priority, tags, creator, configuration, metadata)
         VALUES ($1, 'Test', 'Test desc', 'medium', '{}', 'test', '{}', '{}')`,
        [workflowId]
      );

      // Insert agent
      const agentId = 'test-agent-trigger';
      await testPool.query(
        `INSERT INTO agents (id, workflow_id, name, type, capabilities, tools, execution_context, metadata)
         VALUES ($1, $2, 'Test Agent', 'analysis', '{}', '{}', '{}', '{}')`,
        [agentId, workflowId]
      );

      // Get initial timestamp
      const initial = await testPool.query('SELECT updated_at FROM agents WHERE id = $1', [agentId]);
      const initialTime = initial.rows[0].updated_at;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update agent
      await testPool.query('UPDATE agents SET name = $1 WHERE id = $2', ['Updated Agent', agentId]);

      // Get updated timestamp
      const updated = await testPool.query('SELECT updated_at FROM agents WHERE id = $1', [agentId]);
      const updatedTime = updated.rows[0].updated_at;

      expect(new Date(updatedTime).getTime()).toBeGreaterThan(new Date(initialTime).getTime());
    });
  });
}); 