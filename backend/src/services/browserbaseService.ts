import axios, { AxiosInstance } from 'axios';
import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Browserbase Service
 * 
 * Integration with Browserbase cloud browser automation service.
 * Browserbase provides managed browser instances in the cloud for scalable automation.
 * 
 * API Documentation: https://docs.browserbase.com
 */

export interface BrowserbaseConfig {
  apiKey: string;
  projectId?: string;
  baseUrl?: string; // Default: https://www.browserbase.com/v1
}

export interface BrowserbaseSession {
  id: string;
  status: 'running' | 'completed' | 'failed';
  url?: string; // WebSocket URL for connection
  createdAt: string;
  expiresAt?: string;
}

export interface BrowserbaseAction {
  type: 'navigate' | 'click' | 'fill' | 'extract' | 'screenshot' | 'evaluate';
  url?: string;
  selector?: string;
  value?: string;
  script?: string;
  extractSelectors?: Record<string, string>;
}

export interface BrowserbaseActionResult {
  success: boolean;
  data?: any;
  screenshot?: string; // Base64
  html?: string;
  error?: string;
}

export class BrowserbaseService {
  private client: AxiosInstance;
  private apiKey: string;
  private projectId?: string;

  constructor(config: BrowserbaseConfig) {
    this.apiKey = config.apiKey;
    this.projectId = config.projectId;
    
    const baseURL = config.baseUrl || 'https://www.browserbase.com/v1';
    
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });
  }

  /**
   * Create a new browser session
   */
  async createSession(options?: {
    projectId?: string;
    headless?: boolean;
    proxy?: string;
    userAgent?: string;
  }): Promise<BrowserbaseSession> {
    const tracer = trace.getTracer('sos-browserbase');
    const span = tracer.startSpan('browserbase.create_session', {
      attributes: {
        'browserbase.project_id': options?.projectId || this.projectId || '',
        'browserbase.headless': options?.headless !== false,
      },
    });

    try {
      const response = await this.client.post('/sessions', {
        projectId: options?.projectId || this.projectId,
        headless: options?.headless !== false,
        proxy: options?.proxy,
        userAgent: options?.userAgent,
      });

      const session: BrowserbaseSession = response.data;

      span.setAttributes({
        'browserbase.session_id': session.id,
        'browserbase.status': session.status,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return session;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();
      throw error;
    }
  }

  /**
   * Execute action in a session
   */
  async executeAction(
    sessionId: string,
    action: BrowserbaseAction
  ): Promise<BrowserbaseActionResult> {
    const tracer = trace.getTracer('sos-browserbase');
    const span = tracer.startSpan('browserbase.execute_action', {
      attributes: {
        'browserbase.session_id': sessionId,
        'browserbase.action_type': action.type,
      },
    });

    try {
      const response = await this.client.post(`/sessions/${sessionId}/actions`, {
        type: action.type,
        url: action.url,
        selector: action.selector,
        value: action.value,
        script: action.script,
        extractSelectors: action.extractSelectors,
      });

      const result: BrowserbaseActionResult = response.data;

      span.setAttributes({
        'browserbase.success': result.success,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return result;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();

      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Unknown error',
      };
    }
  }

  /**
   * Get session status
   */
  async getSession(sessionId: string): Promise<BrowserbaseSession> {
    const tracer = trace.getTracer('sos-browserbase');
    const span = tracer.startSpan('browserbase.get_session', {
      attributes: {
        'browserbase.session_id': sessionId,
      },
    });

    try {
      const response = await this.client.get(`/sessions/${sessionId}`);
      const session: BrowserbaseSession = response.data;

      span.setAttributes({
        'browserbase.status': session.status,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return session;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();
      throw error;
    }
  }

  /**
   * Close a session
   */
  async closeSession(sessionId: string): Promise<void> {
    const tracer = trace.getTracer('sos-browserbase');
    const span = tracer.startSpan('browserbase.close_session', {
      attributes: {
        'browserbase.session_id': sessionId,
      },
    });

    try {
      await this.client.delete(`/sessions/${sessionId}`);
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();
      throw error;
    }
  }

  /**
   * List sessions
   */
  async listSessions(options?: {
    projectId?: string;
    limit?: number;
    status?: string;
  }): Promise<BrowserbaseSession[]> {
    const tracer = trace.getTracer('sos-browserbase');
    const span = tracer.startSpan('browserbase.list_sessions', {});

    try {
      const response = await this.client.get('/sessions', {
        params: {
          projectId: options?.projectId || this.projectId,
          limit: options?.limit || 50,
          status: options?.status,
        },
      });

      const sessions: BrowserbaseSession[] = response.data;

      span.setAttributes({
        'browserbase.sessions_count': sessions.length,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return sessions;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();
      throw error;
    }
  }
}

/**
 * Create Browserbase service instance from environment variables
 */
export function createBrowserbaseService(): BrowserbaseService | null {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new BrowserbaseService({
    apiKey,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    baseUrl: process.env.BROWSERBASE_BASE_URL,
  });
}

export const browserbaseService = createBrowserbaseService();

