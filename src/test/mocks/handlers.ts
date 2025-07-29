import { http, HttpResponse } from 'msw'
import { mockWorkflows, mockAgents, mockAnalyticsData } from './data'
import { Agent } from '../../types/core'

const API_BASE_URL = 'https://jux81vgip4.execute-api.us-east-1.amazonaws.com'

export const handlers = [
  // Workflow endpoints
  http.get(`${API_BASE_URL}/workflows`, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page')) || 1
    const pageSize = Number(url.searchParams.get('pageSize')) || 20
    
    // Enhance workflows with agent data
    const enhancedWorkflows = mockWorkflows.map(workflow => {
      const workflowAgents = mockAgents.filter(agent => agent.workflowId === workflow.id)
      return {
        ...workflow,
        agents: workflowAgents
      }
    })
    
    return HttpResponse.json({
      workflows: enhancedWorkflows,
      total: enhancedWorkflows.length,
      page,
      pageSize
    })
  }),

  http.get(`${API_BASE_URL}/workflows/:id`, ({ params }) => {
    const workflow = mockWorkflows.find(w => w.id === params.id)
    if (!workflow) {
      return new HttpResponse(null, { status: 404 })
    }
    
    // Enhance workflow with agent data
    const workflowAgents = mockAgents.filter(agent => agent.workflowId === workflow.id)
    const enhancedWorkflow = {
      ...workflow,
      agents: workflowAgents
    }
    
    return HttpResponse.json(enhancedWorkflow)
  }),

  http.post(`${API_BASE_URL}/workflows`, async ({ request }) => {
    const newWorkflow = await request.json() as any
    const workflow = {
      id: `workflow-${Date.now()}`,
      ...newWorkflow,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: 0,
      agents: [],
      metrics: {
        totalExecutionTime: 0,
        averageAgentResponseTime: 0,
        successRate: 0,
        errorCount: 0,
        resourceUtilization: { cpu: 0, memory: 0, network: 0, storage: 0 },
        businessImpact: {
          costSavings: 0,
          efficiencyGain: 0,
          roi: 0,
          timeToCompletion: 0,
          qualityImprovement: 0
        }
      }
    }
    
    // Add the new workflow to mockWorkflows so it's available for future requests
    mockWorkflows.push(workflow)
    console.log('🔧 Workflow created and added to mockWorkflows:', workflow.id)
    console.log('🔧 Total workflows now:', mockWorkflows.length)
    
    return HttpResponse.json(workflow, { status: 201 })
  }),

  http.put(`${API_BASE_URL}/workflows/:id`, async ({ params, request }) => {
    const updates = await request.json() as any
    const workflow = mockWorkflows.find(w => w.id === params.id)
    if (!workflow) {
      return new HttpResponse(null, { status: 404 })
    }
    const updatedWorkflow = { ...workflow, ...updates, updatedAt: new Date().toISOString() }
    return HttpResponse.json(updatedWorkflow)
  }),



  // Workflow control endpoints

  http.delete(`${API_BASE_URL}/workflows/:id`, ({ params }) => {
    const workflowId = params.id as string
    const workflowIndex = mockWorkflows.findIndex(w => w.id === workflowId)
    
    if (workflowIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    
    // Remove the workflow (cancel it)
    mockWorkflows.splice(workflowIndex, 1)
    
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${API_BASE_URL}/workflows/:id/execute`, ({ params }) => {
    const workflowId = params.id as string
    const workflowIndex = mockWorkflows.findIndex(w => w.id === workflowId)
    
    if (workflowIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    
    // Update the workflow status to running
    mockWorkflows[workflowIndex] = {
      ...mockWorkflows[workflowIndex],
      status: 'running',
      updatedAt: new Date().toISOString()
    }
    
    // Return simple string response as per real API spec
    return HttpResponse.json(`Workflow ${workflowId} execution started`)
  }),

  // Agent endpoints
  http.get(`${API_BASE_URL}/agents`, ({ request }) => {
    const url = new URL(request.url)
    const workflowId = url.searchParams.get('workflowId')
    
    let agents = mockAgents
    if (workflowId) {
      agents = mockAgents.filter(a => a.workflowId === workflowId)
    }
    
    return HttpResponse.json(agents)
  }),

  http.get(`${API_BASE_URL}/agents/:id`, ({ params }) => {
    const agent = mockAgents.find(a => a.id === params.id)
    if (!agent) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json(agent)
  }),

  http.post(`${API_BASE_URL}/workflows/:workflowId/agents`, async ({ request, params }) => {
    const newAgentData = await request.json() as any
    const workflowId = params.workflowId as string
    
    // Create agent response following real API spec exactly
    const agent = {
      id: `agent-${Date.now()}`,
      workflow_id: workflowId,
      name: newAgentData.name,
      description: newAgentData.description || "",
      agent_type: newAgentData.agent_type || "main",
      llm_config: newAgentData.llm_config || {
        provider: "openai",
        model: "gpt-4",
        api_key: "sk-mock-key",
        temperature: 0.7,
        max_tokens: 1000,
        additional_config: {}
      },
      mcp_connections: newAgentData.mcp_connections || [],
      max_child_agents: newAgentData.max_child_agents || 5,
      parent_agent_id: null,
      status: "idle",
      status_description: "Agent is idle",
      status_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      connected_agents: [],
      child_agents: [],
      tasks: [],
      capabilities: newAgentData.capabilities || [],
      config: newAgentData.config || {}
    }
    
    // Add the new agent to the mock data (convert to old format for compatibility)
    const legacyAgent = {
      id: agent.id,
      workflowId: agent.workflow_id,
      name: agent.name,
      description: agent.description,
      type: agent.agent_type,
      status: agent.status,
      createdAt: agent.created_at,
      updatedAt: agent.status_updated_at,
      progress: 0,
      capabilities: agent.capabilities,
      tools: [], // Will be mapped from capabilities
      executionContext: {
        environment: 'production',
        version: '1.0.0',
        configuration: agent.config,
        dependencies: []
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
    
    mockAgents.push(legacyAgent)
    
    console.log('🔧 Agent created and added to mockAgents:', legacyAgent.id)
    console.log('🔧 Total agents now:', mockAgents.length)
    console.log('🔧 Agents for workflow', workflowId, ':', mockAgents.filter(a => a.workflowId === workflowId).length)
    
    return HttpResponse.json(agent, { status: 201 })
  }),

  http.delete(`${API_BASE_URL}/agents/:id`, ({ params }) => {
    const agentId = params.id as string
    const agentIndex = mockAgents.findIndex(a => a.id === agentId)
    
    if (agentIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    
    // Remove the agent from mock data
    mockAgents.splice(agentIndex, 1)
    console.log('🗑️ Agent deleted from mockAgents:', agentId)
    console.log('🔧 Total agents now:', mockAgents.length)
    
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${API_BASE_URL}/agents/:id/logs`, ({ params, request }) => {
    const agent = mockAgents.find(a => a.id === params.id)
    if (!agent) {
      return new HttpResponse(null, { status: 404 })
    }
    
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit')) || 50
    const offset = Number(url.searchParams.get('offset')) || 0
    
    const logs = agent.logs.slice(offset, offset + limit)
    return HttpResponse.json(logs)
  }),

  http.get(`${API_BASE_URL}/agents/:id/results`, ({ params, request }) => {
    const agent = mockAgents.find(a => a.id === params.id)
    if (!agent) {
      return new HttpResponse(null, { status: 404 })
    }
    
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit')) || 50
    const offset = Number(url.searchParams.get('offset')) || 0
    
    const results = agent.results.slice(offset, offset + limit)
    return HttpResponse.json(results)
  }),

  // Analytics endpoints
  http.get(`${API_BASE_URL}/analytics/dashboard`, ({ request }) => {
    const url = new URL(request.url)
    const start = url.searchParams.get('start')
    const end = url.searchParams.get('end')
    
    // In a real scenario, you'd filter by date range
    return HttpResponse.json(mockAnalyticsData.dashboardData)
  }),

  http.get(`${API_BASE_URL}/analytics/performance`, () => {
    return HttpResponse.json(mockAnalyticsData.performanceMetrics)
  }),

  http.get(`${API_BASE_URL}/analytics/business`, () => {
    return HttpResponse.json(mockAnalyticsData.businessMetrics)
  }),

  http.get(`${API_BASE_URL}/analytics/workflows/:id`, ({ params }) => {
    const workflow = mockWorkflows.find(w => w.id === params.id)
    if (!workflow) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json({
      workflow: workflow.metrics,
      timeline: [
        { timestamp: '2024-01-15T10:00:00Z', progress: 0 },
        { timestamp: '2024-01-15T10:15:00Z', progress: 25 },
        { timestamp: '2024-01-15T10:30:00Z', progress: 65 }
      ]
    })
  }),

  // Error scenarios for testing
  http.get(`${API_BASE_URL}/workflows/error-test`, () => {
    return new HttpResponse(null, { status: 500 })
  }),

  http.get(`${API_BASE_URL}/workflows/timeout-test`, () => {
    return new Promise(() => {}) // Never resolves to simulate timeout
  })
] 