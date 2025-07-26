import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export const createError = (
  message: string, 
  statusCode: number = 500, 
  code?: string, 
  details?: any
): ApiError => {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
};

export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  const code = error.code || 'INTERNAL_ERROR';

  // Log error details
  logger.error('API Error:', {
    message,
    statusCode,
    code,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    details: error.details
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: error.stack,
        details: error.details
      })
    },
    timestamp: new Date().toISOString()
  });
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const error = createError(
    `Resource not found: ${req.method} ${req.path}`,
    404,
    'NOT_FOUND'
  );
  next(error);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation error handler
export const validationError = (errors: any[]) => {
  return createError(
    'Validation failed',
    400,
    'VALIDATION_ERROR',
    errors
  );
};

// Database error handler
export const handleDatabaseError = (error: any): ApiError => {
  // PostgreSQL error codes
  switch (error.code) {
    case '23505': // Unique violation
      return createError(
        'Resource already exists',
        409,
        'DUPLICATE_RESOURCE',
        { constraint: error.constraint }
      );
    case '23503': // Foreign key violation
      return createError(
        'Referenced resource does not exist',
        404,
        'REFERENCE_NOT_FOUND',
        { constraint: error.constraint }
      );
    case '23502': // Not null violation
      return createError(
        'Required field is missing',
        400,
        'MISSING_REQUIRED_FIELD',
        { column: error.column }
      );
    case '23514': // Check violation
      return createError(
        'Invalid data provided',
        400,
        'INVALID_DATA',
        { constraint: error.constraint }
      );
    case '42P01': // Undefined table
      return createError(
        'Database table not found',
        500,
        'DATABASE_SCHEMA_ERROR'
      );
    default:
      return createError(
        'Database operation failed',
        500,
        'DATABASE_ERROR',
        { originalError: error.message }
      );
  }
}; 