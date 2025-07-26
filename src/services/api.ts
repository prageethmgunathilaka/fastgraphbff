import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { Workflow, Agent } from '../types/core'
import { getApiBaseUrl } from '../utils/env'

// API Response Types
interface DashboardMetricsResponse {
  totalWorkflows?: number
  activeAgents?: number
  completionRate?: number
  averageExecutionTime?: number
  errorRate?: number
  systemHealth?: number
  [key: string]: any
}

interface PerformanceMetricsResponse {
  throughput?: number[]
  latency?: number[]
  resourceUtilization?: {
    cpu?: number
    memory?: number
    network?: number
  }
  [key: string]: any
}

interface BusinessMetricsResponse {
  roi?: number
  costSavings?: number
  efficiencyGain?: number
  qualityScore?: number
  [key: string]: any
}

interface HealthResponse {
  status?: string
  timestamp?: string
  metrics?: any
  [key: string]: any
}

// Base API configuration
const API_BASE_URL = getApiBaseUrl()

class ApiClient {
  protected client: AxiosInstance

  constructor(baseURL: string = API_BASE_URL) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor for authentication
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token')
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  protected async get<T>(url: string, params?: any): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, { params })
    return response.data
  }

  protected async post<T>(url: string, data?: any): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data)
    return response.data
  }

  protected async put<T>(url: string, data?: any): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data)
    return response.data
  }

  protected async delete<T>(url: string): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url)
    return response.data
  }
}

// Workflow API
class WorkflowApi extends ApiClient {
  async getWorkflows(params?: { page?: number; pageSize?: number; filters?: any }) {
    return this.get<{ workflows: Workflow[]; total: number }>('/workflows', params);
  }

  async getWorkflowById(id: string): Promise<Workflow> {
    return this.get<Workflow>(`/workflows/${id}`);
  }

  async createWorkflow(workflow: Partial<Workflow>): Promise<Workflow> {
    return this.post<Workflow>('/workflows', workflow);
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
    return this.put<Workflow>(`/workflows/${id}`, updates);
  }

  async deleteWorkflow(id: string): Promise<void> {
    return this.delete<void>(`/workflows/${id}`);
  }

  async executeWorkflow(id: string): Promise<string> {
    const workflow = await this.post<Workflow>(`/workflows/${id}/execute`, {});
    return workflow.id;
  }

  async getWorkflowStatus(id: string): Promise<any> {
    const workflow = await this.get<Workflow>(`/workflows/${id}`);
    return { status: workflow.status, progress: workflow.progress };
  }

  // Legacy method names for backwards compatibility
  async startWorkflow(id: string): Promise<string> {
    return this.executeWorkflow(id)
  }

  async cancelWorkflow(id: string): Promise<void> {
    return this.deleteWorkflow(id)
  }
}

// Agent API
class AgentApi extends ApiClient {
  async getAgents(workflowId?: string): Promise<Agent[]> {
    const params = workflowId ? { workflowId } : {};
    return this.get<Agent[]>('/agents', params);
  }

  async getAgentById(id: string): Promise<Agent> {
    return this.get<Agent>(`/agents/${id}`);
  }

  async createAgent(workflowId: string, agentData: any): Promise<Agent> {
    return this.post<Agent>('/agents', { 
      workflowId, 
      ...agentData 
    });
  }

  async deleteAgent(id: string): Promise<void> {
    return this.delete<void>(`/agents/${id}`);
  }

  async getAgentStatus(id: string): Promise<any> {
    const agent = await this.get<Agent>(`/agents/${id}`);
    return { status: agent.status, progress: agent.progress };
  }

  async updateAgentStatus(id: string, status: any): Promise<any> {
    return this.put<Agent>(`/agents/${id}`, { status });
  }

  async connectAgents(agentId: string, connectionData: any): Promise<any> {
    // This endpoint may need to be implemented in the backend if needed
    return this.post<any>(`/agents/${agentId}/connect`, connectionData)
  }

  async disconnectAgents(agentId: string, disconnectionData: any): Promise<any> {
    // This endpoint may need to be implemented in the backend if needed
    return this.post<any>(`/agents/${agentId}/disconnect`, disconnectionData)
  }

  async getAgentConnections(id: string): Promise<any[]> {
    // This endpoint may need to be implemented in the backend if needed
    return this.get<any[]>(`/agents/${id}/connections`)
  }

  // Legacy methods for backwards compatibility
  async getAgentLogs(id: string, params?: { limit?: number; offset?: number }): Promise<any[]> {
    const agent = await this.get<Agent>(`/agents/${id}`);
    return agent.logs || [];
  }

  async getAgentResults(id: string, params?: { limit?: number; offset?: number }): Promise<any[]> {
    const agent = await this.get<Agent>(`/agents/${id}`);
    return agent.results || [];
  }

  async updateAgentConfiguration(id: string, config: any): Promise<Agent> {
    return this.put<Agent>(`/agents/${id}`, { 
      executionContext: config 
    });
  }
}

// Analytics API
class AnalyticsApi extends ApiClient {
  async getDashboardMetrics(timeRange?: { start: string; end: string }) {
    try {
      const response = await this.get<DashboardMetricsResponse>('/analytics/dashboard', timeRange)
      // Ensure we return properly structured data with null fallbacks
      return {
        totalWorkflows: response?.totalWorkflows ?? null,
        activeAgents: response?.activeAgents ?? null,
        completionRate: response?.completionRate ?? null,
        averageExecutionTime: response?.averageExecutionTime ?? null,
        errorRate: response?.errorRate ?? null,
        systemHealth: response?.systemHealth ?? null,
        ...response
      }
    } catch (error: any) {
      // Log the error but return null structure to indicate unavailable data
      console.warn('Dashboard metrics unavailable:', error.message)
      return {
        totalWorkflows: null,
        activeAgents: null,
        completionRate: null,
        averageExecutionTime: null,
        errorRate: null,
        systemHealth: null
      }
    }
  }

  async getPerformanceMetrics(timeRange?: { start: string; end: string }) {
    try {
      const response = await this.get<PerformanceMetricsResponse>('/analytics/performance', timeRange)
      return {
        throughput: response?.throughput || [],
        latency: response?.latency || [],
        resourceUtilization: {
          cpu: response?.resourceUtilization?.cpu ?? null,
          memory: response?.resourceUtilization?.memory ?? null,
          network: response?.resourceUtilization?.network ?? null,
        },
        ...response
      }
    } catch (error: any) {
      console.warn('Performance metrics unavailable:', error.message)
      return {
        throughput: [],
        latency: [],
        resourceUtilization: {
          cpu: null,
          memory: null,
          network: null,
        }
      }
    }
  }

  async getBusinessMetrics(timeRange?: { start: string; end: string }) {
    try {
      const response = await this.get<BusinessMetricsResponse>('/analytics/business', timeRange)
      return {
        roi: response?.roi ?? null,
        costSavings: response?.costSavings ?? null,
        efficiencyGain: response?.efficiencyGain ?? null,
        qualityScore: response?.qualityScore ?? null,
        ...response
      }
    } catch (error: any) {
      console.warn('Business metrics unavailable:', error.message)
      return {
        roi: null,
        costSavings: null,
        efficiencyGain: null,
        qualityScore: null
      }
    }
  }

  async getWorkflowAnalytics(workflowId: string, timeRange?: { start: string; end: string }) {
    return this.get(`/analytics/workflows/${workflowId}`, timeRange)
  }

  async getAgentAnalytics(agentId: string, timeRange?: { start: string; end: string }) {
    return this.get(`/analytics/agents/${agentId}`, timeRange)
  }

  async exportReport(type: string, format: 'pdf' | 'csv' | 'excel', timeRange?: { start: string; end: string }) {
    return this.get(`/analytics/export/${type}`, { format, ...timeRange })
  }

  // Health check endpoint for testing connectivity
  async getHealthStatus() {
    try {
      const response = await this.get<HealthResponse>('/health')
      return {
        status: response?.status || 'unknown',
        timestamp: response?.timestamp || new Date().toISOString(),
        metrics: response?.metrics || {},
        ...response
      }
    } catch (error: any) {
      throw new Error(`Health check failed: ${error.message}`)
    }
  }
}

// Create API instances
export const workflowApi = new WorkflowApi()
export const agentApi = new AgentApi()
export const analyticsApi = new AnalyticsApi()

// Export for use in components
export { WorkflowApi, AgentApi, AnalyticsApi }
