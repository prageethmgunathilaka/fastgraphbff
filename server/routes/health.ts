import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { checkHealth } from '../database/connection';

const router = express.Router();

// GET /health - Basic health check
router.get('/', asyncHandler(async (req, res) => {
  const dbHealth = await checkHealth();
  
  const healthStatus = {
    status: dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    service: 'fastgraph-bff',
    version: process.env.APP_VERSION || '1.0.0',
    uptime: process.uptime(),
    database: dbHealth,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    },
    environment: process.env.NODE_ENV || 'development'
  };

  const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
  
  res.status(statusCode).json({
    success: healthStatus.status === 'healthy',
    data: healthStatus
  });
}));

// GET /health/ready - Readiness probe
router.get('/ready', asyncHandler(async (req, res) => {
  const dbHealth = await checkHealth();
  
  if (dbHealth.status === 'healthy') {
    res.json({
      success: true,
      message: 'Service is ready',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      success: false,
      message: 'Service is not ready',
      error: dbHealth.details,
      timestamp: new Date().toISOString()
    });
  }
}));

// GET /health/live - Liveness probe
router.get('/live', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Service is alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
}));

export default router; 