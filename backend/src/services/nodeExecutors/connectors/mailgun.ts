/**
 * Mailgun Connector Executor
 * 
 * Executes Mailgun connector actions using the Mailgun REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface MailgunCredentials {
  api_key: string;
  domain?: string;
}

/**
 * Create Mailgun API client
 */
function createMailgunClient(credentials: MailgunCredentials): AxiosInstance {
  const domain = credentials.domain || process.env.MAILGUN_DOMAIN || '';
  
  return axios.create({
    baseURL: `https://api.mailgun.net/v3/${domain}`,
    auth: {
      username: 'api',
      password: credentials.api_key,
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
}

/**
 * Send email via Mailgun
 */
export async function executeMailgunSendEmail(
  to: string,
  from: string,
  subject: string,
  text?: string,
  html?: string,
  cc?: string[],
  bcc?: string[],
  credentials: MailgunCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createMailgunClient(credentials);
    
    const params = new URLSearchParams({
      to,
      from,
      subject,
    });
    
    if (text) params.append('text', text);
    if (html) params.append('html', html);
    if (cc && cc.length > 0) params.append('cc', cc.join(','));
    if (bcc && bcc.length > 0) params.append('bcc', bcc.join(','));

    const response = await client.post('/messages', params);

    return {
      success: true,
      output: {
        id: response.data.id,
        message: response.data.message,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'Mailgun email send failed',
        code: 'MAILGUN_SEND_EMAIL_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Mailgun connector action
 */
export async function executeMailgun(
  actionId: string,
  input: Record<string, unknown>,
  credentials: MailgunCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'send_email':
      const to = input.to as string;
      const from = input.from as string;
      const subject = input.subject as string;
      const text = input.text as string | undefined;
      const html = input.html as string | undefined;
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
      
      if (!text && !html) {
        return {
          success: false,
          error: {
            message: 'Either text or html content is required',
            code: 'MISSING_CONTENT',
          },
        };
      }
      
      return executeMailgunSendEmail(to, from, subject, text, html, cc, bcc, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Mailgun action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

