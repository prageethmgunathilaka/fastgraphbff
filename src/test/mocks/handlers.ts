import { http, HttpResponse } from 'msw'
import { mockWorkflows, mockAgents, mockAnalyticsData } from './data'

const API_BASE_URL = 'https://jux81vgip4.execute-api.us-east-1.amazonaws.com'

export const handlers = [
  // Workflow endpoints
  http.get(`${API_BASE_URL}/workflows`, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page')) || 1
    const pageSize = Number(url.searchParams.get('pageSize')) || 20
    
    return HttpResponse.json({
      workflows: mockWorkflows,
      total: mockWorkflows.length,
      page,
      pageSize
    })
  }),

  http.get(`${API_BASE_URL}/workflows/:id`, ({ params }) => {
    const workflow = mockWorkflows.find(w => w.id === params.id)
    if (!workflow) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json(workflow)
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

  http.delete(`${API_BASE_URL}/workflows/:id`, ({ params }) => {
    const workflowExists = mockWorkflows.some(w => w.id === params.id)
    if (!workflowExists) {
      return new HttpResponse(null, { status: 404 })
    }
    return new HttpResponse(null, { status: 204 })
  }),

  // Workflow control endpoints
  http.post(`${API_BASE_URL}/workflows/:id/start`, ({ params }) => {
    const workflow = mockWorkflows.find(w => w.id === params.id)
    if (!workflow) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json({ ...workflow, status: 'running' })
  }),

  http.post(`${API_BASE_URL}/workflows/:id/pause`, ({ params }) => {
    const workflow = mockWorkflows.find(w => w.id === params.id)
    if (!workflow) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json({ ...workflow, status: 'paused' })
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