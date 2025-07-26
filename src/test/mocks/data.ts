import { Workflow, Agent, WorkflowStatus, AgentStatus, AgentType, Priority } from '../../types/core'

export const mockWorkflows: Workflow[] = [
  {
    id: 'workflow-1',
    name: 'E-commerce Flash Sale Optimization',
    description: 'Optimize flash sale performance using multiple agents',
    status: WorkflowStatus.RUNNING,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    progress: 65,
    estimatedTimeRemaining: 1800,
    priority: Priority.HIGH,
    tags: ['ecommerce', 'optimization', 'sales'],
    agents: [], // Will be populated dynamically by mock handlers with agents from mockAgents
    metrics: {
      totalExecutionTime: 1800,
      averageAgentResponseTime: 250,
      successRate: 95.5,
      errorCount: 2,
      resourceUtilization: {
        cpu: 75,
        memory: 60,
        network: 80,
        storage: 45
      },
      businessImpact: {
        costSavings: 45000,
        efficiencyGain: 35.2,
        roi: 245.8,
        timeToCompletion: 1200,
        qualityImprovement: 18.5
      }
    },
    creator: 'admin@company.com',
    configuration: {
      timeout: 3600,
      retryCount: 3,
      parallelExecution: true,
      parameters: {
        targetConversionRate: 12.5,
        maxPriceReduction: 25
      }
    }
  },
  {
    id: 'workflow-2',
    name: 'Healthcare Patient Processing',
    description: 'Process patient data through medical AI pipeline',
    status: WorkflowStatus.COMPLETED,
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T09:45:00Z',
    completedAt: '2024-01-15T09:45:00Z',
    progress: 100,
    priority: Priority.CRITICAL,
    tags: ['healthcare', 'medical', 'compliance'],
    agents: [], // Will be populated dynamically by mock handlers
    metrics: {
      totalExecutionTime: 6300,
      averageAgentResponseTime: 180,
      successRate: 99.7,
      errorCount: 0,
      resourceUtilization: {
        cpu: 85,
        memory: 70,
        network: 65,
        storage: 55
      },
      businessImpact: {
        costSavings: 120000,
        efficiencyGain: 60.0,
        roi: 380.5,
        timeToCompletion: 0,
        qualityImprovement: 45.2
      }
    },
    creator: 'medical@hospital.com',
    configuration: {
      timeout: 7200,
      retryCount: 5,
      parallelExecution: false,
      parameters: {
        complianceLevel: 'HIPAA',
        accuracyThreshold: 99.5
      }
    }
  },
  {
    id: 'workflow-3',
    name: 'Financial Trading Algorithm',
    description: 'Coordinate trading algorithms for market execution',
    status: WorkflowStatus.FAILED,
    createdAt: '2024-01-15T14:00:00Z',
    updatedAt: '2024-01-15T14:15:00Z',
    completedAt: '2024-01-15T14:15:00Z',
    progress: 25,
    priority: Priority.HIGH,
    tags: ['finance', 'trading', 'algorithms'],
    agents: [], // Will be populated dynamically by mock handlers
    metrics: {
      totalExecutionTime: 900,
      averageAgentResponseTime: 450,
      successRate: 25.0,
      errorCount: 15,
      resourceUtilization: {
        cpu: 95,
        memory: 90,
        network: 85,
        storage: 30
      },
      businessImpact: {
        costSavings: -25000,
        efficiencyGain: -15.5,
        roi: -45.2,
        timeToCompletion: 0,
        qualityImprovement: -10.5
      }
    },
    creator: 'trader@financial.com',
    configuration: {
      timeout: 1800,
      retryCount: 2,
      parallelExecution: true,
      parameters: {
        riskTolerance: 'medium',
        maxPositionSize: 100000
      }
    }
  }
]

export const mockAgents: Agent[] = [
  {
    id: 'agent-1',
    workflowId: 'workflow-1',
    name: 'Customer Behavior Analysis Agent',
    type: AgentType.ANALYSIS,
    status: AgentStatus.RUNNING,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    progress: 80,
    capabilities: ['data-analysis', 'pattern-recognition', 'customer-insights'],
    tools: ['pandas', 'scikit-learn', 'tensorflow'],
    executionContext: {
      environment: 'production',
      version: '1.2.3',
      configuration: {
        dataSource: 'customer_events',
        analysisWindow: '24h'
      },
      dependencies: ['numpy==1.21.0', 'pandas==1.3.0']
    },
    performance: {
      executionTime: 1440,
      responseTime: 220,
      successRate: 98.5,
      errorCount: 1,
      resourceUsage: {
        cpu: 65,
        memory: 512,
        apiCalls: 45,
        tokens: 15000
      },
      qualityScore: 9.2
    },
    logs: [
      {
        id: 'log-1',
        agentId: 'agent-1',
        timestamp: '2024-01-15T10:15:00Z',
        level: 'info' as any,
        message: 'Starting customer behavior analysis',
        context: { dataPoints: 50000 }
      },
      {
        id: 'log-2',
        agentId: 'agent-1',
        timestamp: '2024-01-15T10:25:00Z',
        level: 'warn' as any,
        message: 'High anomaly detection in segment B',
        context: { anomalyScore: 0.85 }
      }
    ],
    results: [
      {
        id: 'result-1',
        agentId: 'agent-1',
        timestamp: '2024-01-15T10:20:00Z',
        type: 'insight' as any,
        data: {
          customerSegments: ['high-value', 'price-sensitive', 'loyalty-focused'],
          conversionPredictions: { 'high-value': 85.2, 'price-sensitive': 45.8 }
        },
        metadata: { confidence: 0.92, model: 'customer-behavior-v2' },
        quality: {
          accuracy: 92.5,
          completeness: 88.0,
          relevance: 95.2,
          confidence: 92.0
        }
      }
    ]
  },
  {
    id: 'agent-2',
    workflowId: 'workflow-1',
    name: 'Inventory Management Agent',
    type: AgentType.MONITORING,
    status: AgentStatus.COMPLETED,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:20:00Z',
    completedAt: '2024-01-15T10:20:00Z',
    progress: 100,
    capabilities: ['inventory-tracking', 'demand-forecasting', 'supply-optimization'],
    tools: ['sql', 'redis', 'prometheus'],
    executionContext: {
      environment: 'production',
      version: '2.1.0',
      configuration: {
        inventoryThreshold: 100,
        reorderPoint: 50
      },
      dependencies: ['redis==4.0.0', 'psycopg2==2.9.0']
    },
    performance: {
      executionTime: 1200,
      responseTime: 150,
      successRate: 100.0,
      errorCount: 0,
      resourceUsage: {
        cpu: 45,
        memory: 256,
        apiCalls: 25,
        tokens: 8000
      },
      qualityScore: 9.8
    },
    logs: [],
    results: []
  },
  {
    id: 'agent-3',
    workflowId: '', // Not assigned to any workflow
    name: 'Data Processing Agent',
    description: 'Specialized in processing large datasets and extracting insights',
    type: AgentType.PROCESSING,
    status: AgentStatus.IDLE,
    createdAt: '2024-01-16T09:00:00Z',
    updatedAt: '2024-01-16T09:00:00Z',
    progress: 0,
    capabilities: ['data-transformation', 'etl-processing', 'data-validation'],
    tools: ['apache-spark', 'pandas', 'dask'],
    executionContext: {
      environment: 'production',
      version: '1.0.0',
      configuration: {
        batchSize: 10000,
        parallelWorkers: 4
      },
      dependencies: ['pyspark==3.2.0', 'pandas==1.3.0']
    },
    performance: {
      executionTime: 0,
      responseTime: 0,
      successRate: 0,
      errorCount: 0,
      resourceUsage: {
        cpu: 0,
        memory: 0,
        apiCalls: 0,
        tokens: 0
      },
      qualityScore: 0
    },
    logs: [],
    results: []
  },
  {
    id: 'agent-4',
    workflowId: '', // Not assigned to any workflow
    name: 'Security Monitoring Agent',
    description: 'Monitors system security and detects anomalies',
    type: AgentType.MONITORING,
    status: AgentStatus.IDLE,
    createdAt: '2024-01-16T10:00:00Z',
    updatedAt: '2024-01-16T10:00:00Z',
    progress: 0,
    capabilities: ['threat-detection', 'log-analysis', 'security-scanning'],
    tools: ['elk-stack', 'splunk', 'nmap'],
    executionContext: {
      environment: 'production',
      version: '2.0.1',
      configuration: {
        scanInterval: '5m',
        alertThreshold: 'medium'
      },
      dependencies: ['elasticsearch==7.15.0', 'kibana==7.15.0']
    },
    performance: {
      executionTime: 0,
      responseTime: 0,
      successRate: 0,
      errorCount: 0,
      resourceUsage: {
        cpu: 0,
        memory: 0,
        apiCalls: 0,
        tokens: 0
      },
      qualityScore: 0
    },
    logs: [],
    results: []
  },
  {
    id: 'agent-5',
    workflowId: '', // Not assigned to any workflow
    name: 'Report Generation Agent',
    description: 'Generates automated reports and visualizations',
    type: AgentType.AUTOMATION,
    status: AgentStatus.IDLE,
    createdAt: '2024-01-16T11:00:00Z',
    updatedAt: '2024-01-16T11:00:00Z',
    progress: 0,
    capabilities: ['report-generation', 'data-visualization', 'email-automation'],
    tools: ['matplotlib', 'plotly', 'jinja2'],
    executionContext: {
      environment: 'production',
      version: '1.1.0',
      configuration: {
        reportFormat: 'pdf',
        emailSchedule: 'daily'
      },  
      dependencies: ['matplotlib==3.5.0', 'plotly==5.3.0']
    },
    performance: {
      executionTime: 0,
      responseTime: 0,
      successRate: 0,
      errorCount: 0,
      resourceUsage: {
        cpu: 0,
        memory: 0,
        apiCalls: 0,
        tokens: 0
      },
      qualityScore: 0
    },
    logs: [],
    results: []
  }
]

export const mockDashboardData = {
  activeAgents: 12,
  systemHealth: 95,
  totalWorkflows: mockWorkflows.length,
  runningWorkflows: mockWorkflows.filter(w => w.status === WorkflowStatus.RUNNING).length,
  completedWorkflows: mockWorkflows.filter(w => w.status === WorkflowStatus.COMPLETED).length,
  failedWorkflows: mockWorkflows.filter(w => w.status === WorkflowStatus.FAILED).length
}

export const mockBusinessMetrics = {
  roi: 245.8,
  costSavings: 140000,
  efficiencyGain: 42.5,
  qualityScore: 9.1
}

export const mockAnalyticsData = {
  dashboardData: mockDashboardData,
  businessMetrics: mockBusinessMetrics,
  performanceMetrics: {
    averageExecutionTime: 2400,
    successRate: 89.5,
    errorRate: 10.5,
    throughput: 25.5
  }
} 