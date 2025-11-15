/**
 * Telegram Connector Executor
 * 
 * Executes Telegram connector actions using the Telegram Bot API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface TelegramCredentials {
  bot_token: string;
}

/**
 * Create Telegram Bot API client
 */
function createTelegramClient(credentials: TelegramCredentials): AxiosInstance {
  return axios.create({
    baseURL: `https://api.telegram.org/bot${credentials.bot_token}`,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Send message via Telegram
 */
export async function executeTelegramSendMessage(
  chatId: string,
  text: string,
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2',
  credentials: TelegramCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createTelegramClient(credentials);
    
    const messageData: Record<string, unknown> = {
      chat_id: chatId,
      text,
    };
    
    if (parseMode) {
      messageData.parse_mode = parseMode;
    }

    const response = await client.post('/sendMessage', messageData);

    return {
      success: true,
      output: {
        messageId: response.data.result.message_id,
        chatId: response.data.result.chat.id,
        text: response.data.result.text,
        date: response.data.result.date,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.description || error.message || 'Telegram message send failed',
        code: 'TELEGRAM_SEND_MESSAGE_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Get updates (messages) from Telegram
 */
export async function executeTelegramGetUpdates(
  offset?: number,
  limit: number = 10,
  credentials: TelegramCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createTelegramClient(credentials);
    
    const params: Record<string, unknown> = {
      limit,
    };
    
    if (offset !== undefined) {
      params.offset = offset;
    }

    const response = await client.get('/getUpdates', { params });

    return {
      success: true,
      output: {
        updates: response.data.result || [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.description || error.message || 'Telegram get updates failed',
        code: 'TELEGRAM_GET_UPDATES_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Telegram connector action
 */
export async function executeTelegram(
  actionId: string,
  input: Record<string, unknown>,
  credentials: TelegramCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'send_message':
      const chatId = input.chatId as string;
      const text = input.text as string;
      const parseMode = input.parseMode as 'HTML' | 'Markdown' | 'MarkdownV2' | undefined;
      
      if (!chatId || !text) {
        return {
          success: false,
          error: {
            message: 'chatId and text are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeTelegramSendMessage(chatId, text, parseMode, credentials);

    case 'get_updates':
      const offset = input.offset as number | undefined;
      const limit = (input.limit as number) || 10;
      return executeTelegramGetUpdates(offset, limit, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Telegram action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

