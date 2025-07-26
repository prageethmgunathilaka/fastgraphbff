import { v4 as uuidv4 } from 'uuid';

// Mock workflow data generator
export const createMockWorkflow = (overrides: any = {}) => ({
  name: 'Test Workflow',
  description: 'A test workflow for unit testing',
  priority: 'medium' as const,
  tags: ['test', 'automation'],
  creator: 'test-user',
  configuration: {
    timeout: 3600,
    retryCount: 3,
    parallelExecution: false,
    parameters: {}
  },
  metadata: {
    environment: 'test',
    version: '1.0.0'
  },
  ...overrides
});

export const createMockWorkflowFromDB = (overrides: any = {}) => ({
  id: uuidv4(),
  name: 'Test Workflow',
  description: 'A test workflow for unit testing',
  status: 'pending' as const,
  priority: 'medium' as const,
  progress: 0,
  estimated_time_remaining: null,
  completed_tasks: 0,
  total_tasks: 1,
  current_phase: 'initialization',
  creator: 'test-user',
  tags: ['test', 'automation'],
  configuration: {
    timeout: 3600,
    retryCount: 3,
    parallelExecution: false,
    parameters: {}
  },
  metadata: {
    environment: 'test',
    version: '1.0.0'
  },
  metrics: {
    executionTime: 0,
    successRate: 0,
    errorRate: 0,
    throughput: 0,
    costMetrics: { totalCost: 0, costPerExecution: 0 },
    resourceUsage: { cpuUsage: 0, memoryUsage: 0, storageUsage: 0 }
  },
  status_change_reason: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  completed_at: null,
  deleted_at: null,
  deleted_by: null,
  delete_reason: null,
  ...overrides
});

// Mock agent data generator
export const createMockAgent = (workflowId: string, overrides: any = {}) => ({
  workflowId,
  name: 'Test Agent',
  description: 'A test agent for unit testing',
  type: 'analysis' as const,
  capabilities: ['data-analysis', 'reporting'],
  tools: ['pandas', 'numpy'],
  executionContext: {
    environment: 'test',
    version: '1.0.0',
    configuration: {},
    dependencies: ['python3', 'pip']
  },
  metadata: {
    testMode: true,
    debugLevel: 'info'
  },
  ...overrides
});

export const createMockAgentFromDB = (workflowId: string, overrides: any = {}) => ({
  id: uuidv4(),
  workflow_id: workflowId,
  name: 'Test Agent',
  description: 'A test agent for unit testing',
  type: 'analysis' as const,
  status: 'idle' as const,
  progress: 0,
  estimated_time_remaining: null,
  current_phase: null,
  capabilities: ['data-analysis', 'reporting'],
  tools: ['pandas', 'numpy'],
  status_change_reason: null,
  metadata: {
    testMode: true,
    debugLevel: 'info'
  },
  execution_context: {
    environment: 'test',
    version: '1.0.0',
    configuration: {},
    dependencies: ['python3', 'pip']
  },
  performance: {
    executionTime: 0,
    responseTime: 0,
    successRate: 0,
    errorCount: 0,
    resourceUsage: { cpu: 0, memory: 0, apiCalls: 0, tokens: 0 },
    qualityScore: 0
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  completed_at: null,
  deleted_at: null,
  deleted_by: null,
  delete_reason: null,
  ...overrides
});

// Mock log entry generator
export const createMockLogEntry = (agentId: string, workflowId: string, overrides: any = {}) => ({
  level: 'info' as const,
  message: 'Test log message',
  context: {
    operation: 'test-operation',
    duration: 100
  },
  error: null,
  ...overrides
});

// Mock agent result generator
export const createMockAgentResult = (agentId: string, workflowId: string, overrides: any = {}) => ({
  type: 'data' as const,
  data: {
    result: 'test-result',
    value: 42,
    status: 'success'
  },
  metadata: {
    source: 'test',
    confidence: 0.95
  },
  quality: {
    accuracy: 0.9,
    completeness: 0.8,
    relevance: 0.95,
    confidence: 0.9
  },
  executionTime: 150,
  memoryUsage: 1024,
  cpuUsage: 15.5,
  ...overrides
});

// Batch data generators
export const createMultipleWorkflows = (count: number, overrides: any = {}) => {
  return Array.from({ length: count }, (_, index) => 
    createMockWorkflow({
      name: `Test Workflow ${index + 1}`,
      ...overrides
    })
  );
};

export const createMultipleAgents = (workflowId: string, count: number, overrides: any = {}) => {
  return Array.from({ length: count }, (_, index) => 
    createMockAgent(workflowId, {
      name: `Test Agent ${index + 1}`,
      ...overrides
    })
  );
};

export const createCompleteWorkflowWithAgents = (agentCount: number = 2) => {
  const workflow = createMockWorkflow();
  const workflowId = uuidv4();
  const agents = createMultipleAgents(workflowId, agentCount);
  
  return {
    workflow,
    workflowId,
    agents
  };
};

// Status transition helpers
export const workflowStatusTransitions = [
  'pending',
  'running', 
  'completed'
] as const;

export const agentStatusTransitions = [
  'idle',
  'running',
  'completed'
] as const;

// Error scenarios
export const createInvalidWorkflow = () => ({
  // Missing required name field
  description: 'Invalid workflow',
  priority: 'invalid-priority', // Invalid enum value
  tags: 'not-an-array', // Should be array
  configuration: 'not-an-object' // Should be object
});

export const createInvalidAgent = (workflowId: string) => ({
  workflowId,
  // Missing required name field
  type: 'invalid-type', // Invalid enum value
  capabilities: 'not-an-array', // Should be array
  tools: 123 // Should be array
});

// Database state helpers
export const createSoftDeletedWorkflow = () => createMockWorkflowFromDB({
  deleted_at: new Date().toISOString(),
  deleted_by: 'test-user',
  delete_reason: 'Test soft delete'
});

export const createSoftDeletedAgent = (workflowId: string) => createMockAgentFromDB(workflowId, {
  deleted_at: new Date().toISOString(),
  deleted_by: 'test-user',
  delete_reason: 'Test soft delete'
}); 