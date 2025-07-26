import winston from 'winston';
import { query as dbQuery } from '../database/connection';

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

export interface CleanupStats {
  workflowsRemoved: number;
  agentsRemoved: number;
  logsRemoved: number;
  resultsRemoved: number;
  totalRecordsRemoved: number;
  duration: number;
}

// Clean up soft deleted records older than specified days
export const cleanupSoftDeleted = async (olderThanDays: number = 30): Promise<CleanupStats> => {
  const startTime = Date.now();
  let totalRecordsRemoved = 0;
  
  logger.info(`Starting cleanup of soft deleted records older than ${olderThanDays} days`);

  try {
    // Clean up workflows (and associated data)
    const workflowsResult = await dbQuery(`
      DELETE FROM workflows 
      WHERE deleted_at IS NOT NULL 
        AND deleted_at < NOW() - INTERVAL '${olderThanDays} days'
    `);
    const workflowsRemoved = workflowsResult.rowCount || 0;
    totalRecordsRemoved += workflowsRemoved;

    // Clean up agents
    const agentsResult = await dbQuery(`
      DELETE FROM agents 
      WHERE deleted_at IS NOT NULL 
        AND deleted_at < NOW() - INTERVAL '${olderThanDays} days'
    `);
    const agentsRemoved = agentsResult.rowCount || 0;
    totalRecordsRemoved += agentsRemoved;

    // Clean up old log entries (regardless of soft delete status, keep only recent ones)
    const oldLogsResult = await dbQuery(`
      DELETE FROM log_entries 
      WHERE timestamp < NOW() - INTERVAL '90 days'
    `);
    const logsRemoved = oldLogsResult.rowCount || 0;
    totalRecordsRemoved += logsRemoved;

    // Clean up old agent results (keep only recent ones)
    const oldResultsResult = await dbQuery(`
      DELETE FROM agent_results 
      WHERE timestamp < NOW() - INTERVAL '90 days'
    `);
    const resultsRemoved = oldResultsResult.rowCount || 0;
    totalRecordsRemoved += resultsRemoved;

    const duration = Date.now() - startTime;
    const stats: CleanupStats = {
      workflowsRemoved,
      agentsRemoved,
      logsRemoved,
      resultsRemoved,
      totalRecordsRemoved,
      duration
    };

    logger.info('Cleanup completed successfully', stats);
    return stats;

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Cleanup failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      duration 
    });
    throw error;
  }
};

// Clean up workflow status history older than specified days
export const cleanupStatusHistory = async (olderThanDays: number = 180): Promise<number> => {
  logger.info(`Cleaning up status history older than ${olderThanDays} days`);

  try {
    // Clean up workflow status history
    const workflowHistoryResult = await dbQuery(`
      DELETE FROM workflow_status_history 
      WHERE timestamp < NOW() - INTERVAL '${olderThanDays} days'
    `);

    // Clean up agent status history
    const agentHistoryResult = await dbQuery(`
      DELETE FROM agent_status_history 
      WHERE timestamp < NOW() - INTERVAL '${olderThanDays} days'
    `);

    const totalRemoved = (workflowHistoryResult.rowCount || 0) + (agentHistoryResult.rowCount || 0);
    
    logger.info(`Removed ${totalRemoved} status history records`);
    return totalRemoved;

  } catch (error) {
    logger.error('Status history cleanup failed', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
};

// Vacuum and analyze database for performance
export const optimizeDatabase = async (): Promise<void> => {
  logger.info('Starting database optimization');

  try {
    // Run VACUUM ANALYZE on main tables to reclaim space and update statistics
    const tables = ['workflows', 'agents', 'log_entries', 'agent_results', 'workflow_status_history', 'agent_status_history'];
    
    for (const table of tables) {
      await dbQuery(`VACUUM ANALYZE ${table}`);
      logger.debug(`Vacuumed and analyzed table: ${table}`);
    }

    logger.info('Database optimization completed');

  } catch (error) {
    logger.error('Database optimization failed', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
};

// Get database size and table statistics
export const getDatabaseStats = async () => {
  try {
    // Get database size
    const dbSizeResult = await dbQuery(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as database_size
    `);

    // Get table sizes
    const tableSizesResult = await dbQuery(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);

    // Get record counts
    const recordCountsResult = await dbQuery(`
      SELECT 
        'workflows' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_records,
        COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted_records
      FROM workflows
      
      UNION ALL
      
      SELECT 
        'agents' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_records,
        COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted_records
      FROM agents
      
      UNION ALL
      
      SELECT 
        'log_entries' as table_name,
        COUNT(*) as total_records,
        COUNT(*) as active_records,
        0 as deleted_records
      FROM log_entries
      
      UNION ALL
      
      SELECT 
        'agent_results' as table_name,
        COUNT(*) as total_records,
        COUNT(*) as active_records,
        0 as deleted_records
      FROM agent_results
    `);

    return {
      databaseSize: dbSizeResult.rows[0].database_size,
      tableSizes: tableSizesResult.rows,
      recordCounts: recordCountsResult.rows,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Failed to get database stats', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
};

// Comprehensive maintenance task
export const performMaintenance = async (): Promise<{
  cleanup: CleanupStats;
  historyCleanup: number;
  stats: any;
}> => {
  logger.info('Starting comprehensive database maintenance');

  try {
    // Run cleanup tasks
    const cleanup = await cleanupSoftDeleted();
    const historyCleanup = await cleanupStatusHistory();
    
    // Optimize database
    await optimizeDatabase();
    
    // Get updated stats
    const stats = await getDatabaseStats();

    logger.info('Comprehensive maintenance completed successfully');

    return {
      cleanup,
      historyCleanup,
      stats
    };

  } catch (error) {
    logger.error('Comprehensive maintenance failed', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}; 