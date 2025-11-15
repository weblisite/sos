/**
 * Zoom Connector Executor
 * 
 * Executes Zoom connector actions using the Zoom REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface ZoomCredentials {
  access_token: string;
  account_id?: string; // For Server-to-Server OAuth
}

/**
 * Create Zoom API client
 */
function createZoomClient(credentials: ZoomCredentials): AxiosInstance {
  return axios.create({
    baseURL: 'https://api.zoom.us/v2',
    headers: {
      'Authorization': `Bearer ${credentials.access_token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a Zoom meeting
 */
export async function executeZoomCreateMeeting(
  topic: string,
  startTime?: string, // ISO 8601 format
  duration?: number, // in minutes
  timezone?: string,
  type: number = 2, // 1=Instant, 2=Scheduled, 3=Recurring, 8=Recurring with fixed time
  credentials: ZoomCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createZoomClient(credentials);
    
    const meetingData: Record<string, unknown> = {
      topic,
      type,
    };
    
    if (startTime) {
      meetingData.start_time = startTime;
    }
    if (duration) {
      meetingData.duration = duration;
    }
    if (timezone) {
      meetingData.timezone = timezone;
    }

    const response = await client.post('/users/me/meetings', meetingData);

    return {
      success: true,
      output: {
        id: response.data.id,
        join_url: response.data.join_url,
        start_url: response.data.start_url,
        topic: response.data.topic,
        start_time: response.data.start_time,
        duration: response.data.duration,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'Zoom meeting creation failed',
        code: 'ZOOM_CREATE_MEETING_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Get Zoom meetings
 */
export async function executeZoomGetMeetings(
  userId: string = 'me',
  pageSize: number = 30,
  credentials: ZoomCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createZoomClient(credentials);
    
    const params = {
      page_size: pageSize,
    };

    const response = await client.get(`/users/${userId}/meetings`, { params });

    return {
      success: true,
      output: {
        meetings: response.data.meetings || [],
        page_count: response.data.page_count,
        page_size: response.data.page_size,
        total_records: response.data.total_records,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'Zoom get meetings failed',
        code: 'ZOOM_GET_MEETINGS_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Zoom connector action
 */
export async function executeZoom(
  actionId: string,
  input: Record<string, unknown>,
  credentials: ZoomCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'create_meeting':
      const topic = input.topic as string;
      const startTime = input.startTime as string | undefined;
      const duration = input.duration as number | undefined;
      const timezone = input.timezone as string | undefined;
      const type = (input.type as number) || 2;
      
      if (!topic) {
        return {
          success: false,
          error: {
            message: 'topic is required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeZoomCreateMeeting(topic, startTime, duration, timezone, type, credentials);

    case 'get_meetings':
      const userId = (input.userId as string) || 'me';
      const pageSize = (input.pageSize as number) || 30;
      return executeZoomGetMeetings(userId, pageSize, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Zoom action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

