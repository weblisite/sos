/**
 * Postmark Connector Executor
 * 
 * Executes Postmark connector actions using the Postmark REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface PostmarkCredentials {
  api_key: string;
  server_token?: string; // Server API token (alternative to api_key)
}

/**
 * Create Postmark API client
 */
function createPostmarkClient(credentials: PostmarkCredentials): AxiosInstance {
  const token = credentials.server_token || credentials.api_key;
  
  return axios.create({
    baseURL: 'https://api.postmarkapp.com',
    headers: {
      'X-Postmark-Server-Token': token,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });
}

/**
 * Send email via Postmark
 */
export async function executePostmarkSendEmail(
  to: string,
  from: string,
  subject: string,
  textBody?: string,
  htmlBody?: string,
  cc?: string[],
  bcc?: string[],
  credentials: PostmarkCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createPostmarkClient(credentials);
    
    const emailData: Record<string, unknown> = {
      To: to,
      From: from,
      Subject: subject,
    };
    
    if (textBody) emailData.TextBody = textBody;
    if (htmlBody) emailData.HtmlBody = htmlBody;
    if (cc && cc.length > 0) emailData.Cc = cc.join(',');
    if (bcc && bcc.length > 0) emailData.Bcc = bcc.join(',');

    const response = await client.post('/email', emailData);

    return {
      success: true,
      output: {
        messageId: response.data.MessageID,
        submittedAt: response.data.SubmittedAt,
        to: response.data.To,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.Message || error.message || 'Postmark email send failed',
        code: 'POSTMARK_SEND_EMAIL_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Postmark connector action
 */
export async function executePostmark(
  actionId: string,
  input: Record<string, unknown>,
  credentials: PostmarkCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'send_email':
      const to = input.to as string;
      const from = input.from as string;
      const subject = input.subject as string;
      const textBody = input.textBody as string | undefined;
      const htmlBody = input.htmlBody as string | undefined;
      const cc = input.cc as string[] | undefined;
      const bcc = input.bcc as string[] | undefined;
      
      if (!to || !from || !subject) {
        return {
          success: false,
          error: {
            message: 'to, from, and subject are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      
      if (!textBody && !htmlBody) {
        return {
          success: false,
          error: {
            message: 'Either textBody or htmlBody is required',
            code: 'MISSING_CONTENT',
          },
        };
      }
      
      return executePostmarkSendEmail(to, from, subject, textBody, htmlBody, cc, bcc, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Postmark action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

