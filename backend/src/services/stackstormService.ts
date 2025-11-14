/**
 * StackStorm Service
 * 
 * Service wrapper for StackStorm API integration
 * Provides methods to interact with StackStorm for workflow automation,
 * recovery workflows, and event-driven automation.
 * 
 * StackStorm is an event-driven automation platform that can be used for:
 * - Recovery workflows
 * - Retry logic
 * - Reroute logic
 * - Scheduled workflows with backoffs
 * - Event-driven automation
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { stackstormConfig } from '../config/stackstorm';

/**
 * StackStorm authentication token
 */
interface StackStormToken {
  token: string;
  expireTimestamp: string;
  user: string;
  metadata: Record<string, any>;
}

/**
 * StackStorm execution result
 */
export interface StackStormExecution {
  id: string;
  action: {
    ref: string;
    name: string;
    description?: string;
  };
  status: 'requested' | 'scheduled' | 'running' | 'succeeded' | 'failed' | 'timeout' | 'canceled';
  startTimestamp?: string;
  endTimestamp?: string;
  result?: any;
  parameters?: Record<string, any>;
  context?: Record<string, any>;
  log?: Array<{
    timestamp: string;
    level: string;
    message: string;
  }>;
}

/**
 * StackStorm action definition
 */
export interface StackStormAction {
  ref: string;
  name: string;
  description?: string;
  enabled: boolean;
  entry_point: string;
  runner_type: string;
  parameters?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * StackStorm workflow definition
 */
export interface StackStormWorkflow {
  ref: string;
  name: string;
  description?: string;
  enabled: boolean;
  entry_point: string;
  parameters?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * StackStorm rule definition
 */
export interface StackStormRule {
  ref: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: {
    type: string;
    parameters?: Record<string, any>;
  };
  criteria?: Record<string, any>;
  action: {
    ref: string;
    parameters?: Record<string, any>;
  };
}

/**
 * StackStorm Service
 */
export class StackStormService {
  private client: AxiosInstance;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private config = stackstormConfig;

  constructor() {
    this.client = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      async (config) => {
        if (!this.config.enabled) {
          throw new Error('StackStorm is not enabled');
        }

        // Get or refresh token
        const token = await this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        // If 401, try to refresh token and retry
        if (error.response?.status === 401 && this.config.retryAttempts > 0) {
          this.token = null;
          this.tokenExpiry = null;
          
          try {
            const token = await this.getToken();
            if (token && error.config) {
              error.config.headers.Authorization = `Bearer ${token}`;
              return this.client.request(error.config);
            }
          } catch (refreshError) {
            // Token refresh failed, return original error
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Get authentication token
   */
  private async getToken(): Promise<string | null> {
    // Check if we have a valid token
    if (this.token && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.token;
    }

    // Authenticate using API key if available
    if (this.config.apiKey) {
      this.token = this.config.apiKey;
      // API keys don't expire (or have very long expiry)
      this.tokenExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
      return this.token;
    }

    // Authenticate using username/password
    if (this.config.username && this.config.password) {
      try {
        const response = await axios.post<StackStormToken>(
          `${this.config.authUrl}/tokens`,
          {
            username: this.config.username,
            password: this.config.password,
          },
          {
            timeout: this.config.timeout,
          }
        );

        this.token = response.data.token;
        this.tokenExpiry = new Date(response.data.expireTimestamp);
        return this.token;
      } catch (error: any) {
        console.error('[StackStorm] Authentication failed:', error.message);
        return null;
      }
    }

    console.warn('[StackStorm] No authentication method configured');
    return null;
  }

  /**
   * Check if StackStorm is enabled and available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      await this.getToken();
      // Try to ping StackStorm
      const response = await this.client.get('/actions', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Execute a StackStorm action
   */
  async executeAction(
    actionRef: string,
    parameters?: Record<string, any>,
    context?: Record<string, any>
  ): Promise<StackStormExecution> {
    try {
      const response = await this.client.post<StackStormExecution>(
        '/executions',
        {
          action: actionRef,
          parameters: parameters || {},
          context: context || {},
        }
      );

      return response.data;
    } catch (error: any) {
      console.error(`[StackStorm] Failed to execute action ${actionRef}:`, error.message);
      throw new Error(`StackStorm action execution failed: ${error.message}`);
    }
  }

  /**
   * Get execution status
   */
  async getExecution(executionId: string): Promise<StackStormExecution> {
    try {
      const response = await this.client.get<StackStormExecution>(
        `/executions/${executionId}`
      );

      return response.data;
    } catch (error: any) {
      console.error(`[StackStorm] Failed to get execution ${executionId}:`, error.message);
      throw new Error(`Failed to get StackStorm execution: ${error.message}`);
    }
  }

  /**
   * Wait for execution to complete
   */
  async waitForExecution(
    executionId: string,
    timeout: number = 60000,
    pollInterval: number = 1000
  ): Promise<StackStormExecution> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const execution = await this.getExecution(executionId);

      if (
        execution.status === 'succeeded' ||
        execution.status === 'failed' ||
        execution.status === 'timeout' ||
        execution.status === 'canceled'
      ) {
        return execution;
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Execution ${executionId} timed out after ${timeout}ms`);
  }

  /**
   * Cancel an execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    try {
      await this.client.post(`/executions/${executionId}/cancel`);
    } catch (error: any) {
      console.error(`[StackStorm] Failed to cancel execution ${executionId}:`, error.message);
      throw new Error(`Failed to cancel StackStorm execution: ${error.message}`);
    }
  }

  /**
   * List available actions
   */
  async listActions(pack?: string): Promise<StackStormAction[]> {
    try {
      const params = pack ? { pack } : {};
      const response = await this.client.get<StackStormAction[]>('/actions', { params });
      return response.data;
    } catch (error: any) {
      console.error('[StackStorm] Failed to list actions:', error.message);
      throw new Error(`Failed to list StackStorm actions: ${error.message}`);
    }
  }

  /**
   * Get action definition
   */
  async getAction(actionRef: string): Promise<StackStormAction> {
    try {
      const response = await this.client.get<StackStormAction>(`/actions/${actionRef}`);
      return response.data;
    } catch (error: any) {
      console.error(`[StackStorm] Failed to get action ${actionRef}:`, error.message);
      throw new Error(`Failed to get StackStorm action: ${error.message}`);
    }
  }

  /**
   * List workflows
   */
  async listWorkflows(pack?: string): Promise<StackStormWorkflow[]> {
    try {
      const params = pack ? { pack } : {};
      const response = await this.client.get<StackStormWorkflow[]>('/workflows', { params });
      return response.data;
    } catch (error: any) {
      console.error('[StackStorm] Failed to list workflows:', error.message);
      throw new Error(`Failed to list StackStorm workflows: ${error.message}`);
    }
  }

  /**
   * Get workflow definition
   */
  async getWorkflow(workflowRef: string): Promise<StackStormWorkflow> {
    try {
      const response = await this.client.get<StackStormWorkflow>(`/workflows/${workflowRef}`);
      return response.data;
    } catch (error: any) {
      console.error(`[StackStorm] Failed to get workflow ${workflowRef}:`, error.message);
      throw new Error(`Failed to get StackStorm workflow: ${error.message}`);
    }
  }

  /**
   * List rules
   */
  async listRules(pack?: string): Promise<StackStormRule[]> {
    try {
      const params = pack ? { pack } : {};
      const response = await this.client.get<StackStormRule[]>('/rules', { params });
      return response.data;
    } catch (error: any) {
      console.error('[StackStorm] Failed to list rules:', error.message);
      throw new Error(`Failed to list StackStorm rules: ${error.message}`);
    }
  }

  /**
   * Trigger an event (for event-driven automation)
   */
  async triggerEvent(
    eventName: string,
    payload?: Record<string, any>
  ): Promise<void> {
    try {
      await this.client.post('/webhooks/st2', {
        trigger: eventName,
        payload: payload || {},
      });
    } catch (error: any) {
      console.error(`[StackStorm] Failed to trigger event ${eventName}:`, error.message);
      throw new Error(`Failed to trigger StackStorm event: ${error.message}`);
    }
  }

  /**
   * Send a trigger (alternative method for triggering events)
   */
  async sendTrigger(
    triggerRef: string,
    payload?: Record<string, any>
  ): Promise<void> {
    try {
      await this.client.post('/triggers', {
        trigger: triggerRef,
        payload: payload || {},
      });
    } catch (error: any) {
      console.error(`[StackStorm] Failed to send trigger ${triggerRef}:`, error.message);
      throw new Error(`Failed to send StackStorm trigger: ${error.message}`);
    }
  }
}

// Singleton instance
export const stackstormService = new StackStormService();

