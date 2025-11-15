/**
 * Gmail Connector Executor
 * 
 * Executes Gmail connector actions using the Gmail REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface GmailCredentials {
  access_token: string;
}

/**
 * Create Gmail API client
 */
function createGmailClient(credentials: GmailCredentials): AxiosInstance {
  return axios.create({
    baseURL: 'https://gmail.googleapis.com/gmail/v1',
    headers: {
      'Authorization': `Bearer ${credentials.access_token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Send email via Gmail
 */
export async function executeGmailSendEmail(
  to: string,
  from: string,
  subject: string,
  body: string,
  isHtml: boolean = false,
  credentials: GmailCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createGmailClient(credentials);
    
    // Create email message in RFC 2822 format
    const emailContent = [
      `To: ${to}`,
      `From: ${from}`,
      `Subject: ${subject}`,
      `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`,
      '',
      body,
    ].join('\n');
    
    // Encode to base64url
    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await client.post('/users/me/messages/send', {
      raw: encodedMessage,
    });

    return {
      success: true,
      output: {
        id: response.data.id,
        threadId: response.data.threadId,
        labelIds: response.data.labelIds,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Gmail send email failed',
        code: 'GMAIL_SEND_EMAIL_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Get messages from Gmail
 */
export async function executeGmailGetMessages(
  query?: string,
  maxResults: number = 10,
  credentials: GmailCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createGmailClient(credentials);
    
    const params: Record<string, unknown> = {
      maxResults,
    };
    
    if (query) {
      params.q = query;
    }

    const response = await client.get('/users/me/messages', { params });

    return {
      success: true,
      output: {
        messages: response.data.messages || [],
        resultSizeEstimate: response.data.resultSizeEstimate,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Gmail get messages failed',
        code: 'GMAIL_GET_MESSAGES_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Get a specific message by ID
 */
export async function executeGmailGetMessage(
  messageId: string,
  credentials: GmailCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createGmailClient(credentials);
    
    const response = await client.get(`/users/me/messages/${messageId}`);

    return {
      success: true,
      output: {
        id: response.data.id,
        threadId: response.data.threadId,
        labelIds: response.data.labelIds,
        snippet: response.data.snippet,
        payload: response.data.payload,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Gmail get message failed',
        code: 'GMAIL_GET_MESSAGE_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Gmail connector action
 */
export async function executeGmail(
  actionId: string,
  input: Record<string, unknown>,
  credentials: GmailCredentials
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
      return executeGmailSendEmail(to, from, subject, body, isHtml, credentials);

    case 'get_messages':
      const query = input.query as string | undefined;
      const maxResults = (input.maxResults as number) || 10;
      return executeGmailGetMessages(query, maxResults, credentials);

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
      return executeGmailGetMessage(messageId, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Gmail action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

