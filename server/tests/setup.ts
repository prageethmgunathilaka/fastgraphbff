import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Test database configuration
const testDbConfig = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  database: process.env.TEST_DB_NAME || 'fastgraph_test',
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'password',
  max: 5,
  min: 1,
  idle: 1000,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 3000,
  allowExitOnIdle: true
};

let testPool: Pool;

// Global test setup
beforeAll(async () => {
  // Create test database connection
  testPool = new Pool(testDbConfig);
  
  try {
    // Test connection
    const client = await testPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Test database connected successfully');
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error);
    throw error;
  }
});

// Global test teardown
afterAll(async () => {
  if (testPool) {
    await testPool.end();
    console.log('🔌 Test database connection closed');
  }
});

// Export test utilities
export { testPool, testDbConfig };

// Helper function to clean database between tests
export const cleanDatabase = async () => {
  if (!testPool) return;
  
  try {
    // Clean tables in correct order (respecting foreign keys)
    await testPool.query('TRUNCATE TABLE agent_results CASCADE');
    await testPool.query('TRUNCATE TABLE log_entries CASCADE');
    await testPool.query('TRUNCATE TABLE agent_status_history CASCADE');
    await testPool.query('TRUNCATE TABLE workflow_status_history CASCADE');
    await testPool.query('TRUNCATE TABLE agents CASCADE');
    await testPool.query('TRUNCATE TABLE workflows CASCADE');
    
    // Reset sequences
    await testPool.query('ALTER SEQUENCE IF EXISTS workflows_id_seq RESTART WITH 1');
    await testPool.query('ALTER SEQUENCE IF EXISTS agents_id_seq RESTART WITH 1');
  } catch (error) {
    console.error('Failed to clean database:', error);
    throw error;
  }
};

// Helper function to setup test schema
export const setupTestSchema = async () => {
  if (!testPool) return;
  
  try {
    // Enable UUID extension
    await testPool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    
    // Create enums if they don't exist
    await testPool.query(`
      DO $$ BEGIN
        CREATE TYPE workflow_status AS ENUM ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await testPool.query(`
      DO $$ BEGIN
        CREATE TYPE agent_status AS ENUM ('idle', 'running', 'waiting', 'completed', 'failed', 'timeout');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await testPool.query(`
      DO $$ BEGIN
        CREATE TYPE agent_type AS ENUM ('analysis', 'processing', 'monitoring', 'optimization', 'communication', 'validation');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await testPool.query(`
      DO $$ BEGIN
        CREATE TYPE priority AS ENUM ('low', 'medium', 'high', 'critical');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await testPool.query(`
      DO $$ BEGIN
        CREATE TYPE log_level AS ENUM ('debug', 'info', 'warn', 'error', 'fatal');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await testPool.query(`
      DO $$ BEGIN
        CREATE TYPE result_type AS ENUM ('data', 'metric', 'insight', 'recommendation', 'alert');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    console.log('✅ Test schema setup completed');
  } catch (error) {
    console.error('Failed to setup test schema:', error);
    throw error;
  }
}; 