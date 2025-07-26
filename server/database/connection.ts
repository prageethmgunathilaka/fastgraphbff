import { Pool, PoolConfig } from 'pg';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Database configuration
const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fastgraph',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: parseInt(process.env.DB_POOL_MAX || '20'), // Maximum number of connections
  min: parseInt(process.env.DB_POOL_MIN || '5'),  // Minimum number of connections
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '60000'), // 60 seconds
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // 30 seconds
  allowExitOnIdle: false,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Create connection pool
let pool: Pool;

export const connectDB = async (): Promise<void> => {
  try {
    pool = new Pool(poolConfig);
    
    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    logger.info('✅ PostgreSQL connected successfully');
    
    // Handle pool errors
    pool.on('error', (err) => {
      logger.error('❌ Unexpected error on idle client:', err);
    });

    pool.on('connect', () => {
      logger.debug('🔌 New client connected to PostgreSQL');
    });

    pool.on('remove', () => {
      logger.debug('🔌 Client removed from PostgreSQL pool');
    });
    
  } catch (error) {
    logger.error('❌ Failed to connect to PostgreSQL:', error);
    throw error;
  }
};

export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call connectDB() first.');
  }
  return pool;
};

export const closeDB = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    logger.info('🔌 PostgreSQL connection pool closed');
  }
};

// Helper function for running queries with error handling
export const query = async (text: string, params?: any[]): Promise<any> => {
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Executed query', { 
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      rows: result.rowCount 
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Query failed', { 
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
};

// Helper function for transactions
export const withTransaction = async <T>(
  callback: (client: any) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Health check function
export const checkHealth = async (): Promise<{ 
  status: 'healthy' | 'unhealthy';
  details: any;
}> => {
  try {
    const result = await query('SELECT NOW() as current_time, version() as version');
    const poolStatus = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
    
    return {
      status: 'healthy',
      details: {
        database: result.rows[0],
        pool: poolStatus,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy', 
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    };
  }
};

// Export the pool through getPool() function instead of default export 