import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { Workflow, Agent } from '../types/core'

// Base API configuration
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://jux81vgip4.execute-api.us-east-1.amazonaws.com'

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
    return this.get<{ workflows: Workflow[]; total: number }>('/workflows', params)
  }

  async getWorkflowById(id: string): Promise<Workflow> {
    return this.get<Workflow>(`/workflows/${id}`)
  }

  async createWorkflow(workflow: Partial<Workflow>): Promise<Workflow> {
    return this.post<Workflow>('/workflows', workflow)
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
    return this.put<Workflow>(`/workflows/${id}`, updates)
  }

  async deleteWorkflow(id: string): Promise<void> {
    return this.delete<void>(`/workflows/${id}`)
  }

  async startWorkflow(id: string): Promise<Workflow> {
    return this.post<Workflow>(`/workflows/${id}/start`)
  }

  async pauseWorkflow(id: string): Promise<Workflow> {
    return this.post<Workflow>(`/workflows/${id}/pause`)
  }

  async resumeWorkflow(id: string): Promise<Workflow> {
    return this.post<Workflow>(`/workflows/${id}/resume`)
  }

  async cancelWorkflow(id: string): Promise<Workflow> {
    return this.post<Workflow>(`/workflows/${id}/cancel`)
  }
}

// Agent API
class AgentApi extends ApiClient {
  async getAgents(workflowId?: string): Promise<Agent[]> {
    const params = workflowId ? { workflowId } : undefined
    return this.get<Agent[]>('/agents', params)
  }

  async getAgentById(id: string): Promise<Agent> {
    return this.get<Agent>(`/agents/${id}`)
  }

  async getAgentLogs(id: string, params?: { limit?: number; offset?: number }): Promise<any[]> {
    return this.get<any[]>(`/agents/${id}/logs`, params)
  }

  async getAgentResults(id: string, params?: { limit?: number; offset?: number }): Promise<any[]> {
    return this.get<any[]>(`/agents/${id}/results`, params)
  }

  async updateAgentConfiguration(id: string, config: any): Promise<Agent> {
    return this.put<Agent>(`/agents/${id}/config`, config)
  }
}

// Analytics API
class AnalyticsApi extends ApiClient {
  async getDashboardMetrics(timeRange?: { start: string; end: string }) {
    return this.get('/analytics/dashboard', timeRange)
  }

  async getPerformanceMetrics(timeRange?: { start: string; end: string }) {
    return this.get('/analytics/performance', timeRange)
  }

  async getBusinessMetrics(timeRange?: { start: string; end: string }) {
    return this.get('/analytics/business', timeRange)
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
}

// Create API instances
export const workflowApi = new WorkflowApi()
export const agentApi = new AgentApi()
export const analyticsApi = new AnalyticsApi()

// Export for use in components
export { WorkflowApi, AgentApi, AnalyticsApi }
