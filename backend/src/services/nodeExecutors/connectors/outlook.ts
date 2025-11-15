/**
 * Outlook / Microsoft 365 Mail Connector Executor
 * 
 * Executes Outlook connector actions using the Microsoft Graph API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface OutlookCredentials {
  access_token: string;
}

/**
 * Create Microsoft Graph API client
 */
function createOutlookClient(credentials: OutlookCredentials): AxiosInstance {
  return axios.create({
    baseURL: 'https://graph.microsoft.com/v1.0',
    headers: {
      'Authorization': `Bearer ${credentials.access_token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Send email via Outlook
 */
export async function executeOutlookSendEmail(
  to: string,
  from: string,
  subject: string,
  body: string,
  isHtml: boolean = false,
  credentials: OutlookCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createOutlookClient(credentials);
    
    const messageData = {
      message: {
        subject,
        body: {
          contentType: isHtml ? 'html' : 'text',
          content: body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
      },
    };

    const response = await client.post('/me/sendMail', messageData);

    return {
      success: true,
      output: {
        success: true,
        statusCode: response.status,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Outlook send email failed',
        code: 'OUTLOOK_SEND_EMAIL_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Get messages from Outlook
 */
export async function executeOutlookGetMessages(
  filter?: string,
  top: number = 10,
  credentials: OutlookCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createOutlookClient(credentials);
    
    const params: Record<string, unknown> = {
      $top: top,
    };
    
    if (filter) {
      params.$filter = filter;
    }

    const response = await client.get('/me/messages', { params });

    return {
      success: true,
      output: {
        messages: response.data.value || [],
        count: response.data['@odata.count'],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Outlook get messages failed',
        code: 'OUTLOOK_GET_MESSAGES_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Get a specific message by ID
 */
export async function executeOutlookGetMessage(
  messageId: string,
  credentials: OutlookCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createOutlookClient(credentials);
    
    const response = await client.get(`/me/messages/${messageId}`);

    return {
      success: true,
      output: {
        id: response.data.id,
        subject: response.data.subject,
        body: response.data.body,
        from: response.data.from,
        toRecipients: response.data.toRecipients,
        receivedDateTime: response.data.receivedDateTime,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Outlook get message failed',
        code: 'OUTLOOK_GET_MESSAGE_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Outlook connector action
 */
export async function executeOutlook(
  actionId: string,
  input: Record<string, unknown>,
  credentials: OutlookCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'send_email':
      const to = input.to as string;
      const from = input.from as string;
      const subject = input.subject as string;
      const body = input.body as string;
      const isHtml = (input.isHtml as boolean) || false;
      
      if (!to || !from || !subject || !body) {
        return {
          success: false,
          error: {
            message: 'to, from, subject, and body are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeOutlookSendEmail(to, from, subject, body, isHtml, credentials);

    case 'get_messages':
      const filter = input.filter as string | undefined;
      const top = (input.top as number) || 10;
      return executeOutlookGetMessages(filter, top, credentials);

    case 'get_message':
      const messageId = input.messageId as string;
      
      if (!messageId) {
        return {
          success: false,
          error: {
            message: 'messageId is required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeOutlookGetMessage(messageId, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Outlook action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

