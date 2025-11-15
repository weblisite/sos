/**
 * Zendesk Connector Executor
 * 
 * Executes Zendesk connector actions using the Zendesk REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface ZendeskCredentials {
  access_token: string;
  subdomain: string;
  email?: string; // For API token authentication
}

/**
 * Create Zendesk API client
 */
function createZendeskClient(credentials: ZendeskCredentials): AxiosInstance {
  const subdomain = credentials.subdomain || process.env.ZENDESK_SUBDOMAIN || '';
  
  // Zendesk uses email + API token or OAuth token
  const auth = credentials.email 
    ? Buffer.from(`${credentials.email}/token:${credentials.access_token}`).toString('base64')
    : credentials.access_token;
  
  return axios.create({
    baseURL: `https://${subdomain}.zendesk.com/api/v2`,
    headers: {
      'Authorization': credentials.email ? `Basic ${auth}` : `Bearer ${credentials.access_token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a ticket in Zendesk
 */
export async function executeZendeskCreateTicket(
  subject: string,
  comment: string,
  priority?: 'low' | 'normal' | 'high' | 'urgent',
  type?: 'question' | 'incident' | 'problem' | 'task',
  credentials: ZendeskCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createZendeskClient(credentials);
    
    const ticketData: Record<string, unknown> = {
      ticket: {
        subject,
        comment: {
          body: comment,
        },
      },
    };
    
    if (priority) {
      ticketData.ticket.priority = priority;
    }
    if (type) {
      ticketData.ticket.type = type;
    }

    const response = await client.post('/tickets.json', ticketData);

    return {
      success: true,
      output: {
        id: response.data.ticket.id,
        url: response.data.ticket.url,
        status: response.data.ticket.status,
        subject: response.data.ticket.subject,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error || error.message || 'Zendesk ticket creation failed',
        code: 'ZENDESK_CREATE_TICKET_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Get tickets from Zendesk
 */
export async function executeZendeskGetTickets(
  status?: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed',
  limit: number = 25,
  credentials: ZendeskCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createZendeskClient(credentials);
    
    const params: Record<string, unknown> = {
      per_page: limit,
    };
    
    if (status) {
      params.status = status;
    }

    const response = await client.get('/tickets.json', { params });

    return {
      success: true,
      output: {
        tickets: response.data.tickets || [],
        count: response.data.count,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error || error.message || 'Zendesk get tickets failed',
        code: 'ZENDESK_GET_TICKETS_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Zendesk connector action
 */
export async function executeZendesk(
  actionId: string,
  input: Record<string, unknown>,
  credentials: ZendeskCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'create_ticket':
      const subject = input.subject as string;
      const comment = input.comment as string;
      const priority = input.priority as 'low' | 'normal' | 'high' | 'urgent' | undefined;
      const type = input.type as 'question' | 'incident' | 'problem' | 'task' | undefined;
      
      if (!subject || !comment) {
        return {
          success: false,
          error: {
            message: 'subject and comment are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeZendeskCreateTicket(subject, comment, priority, type, credentials);

    case 'get_tickets':
      const status = input.status as 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed' | undefined;
      const limit = (input.limit as number) || 25;
      return executeZendeskGetTickets(status, limit, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Zendesk action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

