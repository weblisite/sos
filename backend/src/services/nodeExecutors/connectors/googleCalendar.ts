/**
 * Google Calendar Connector Executor
 * 
 * Executes Google Calendar connector actions using the Google Calendar API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface GoogleCalendarCredentials {
  access_token: string;
}

/**
 * Create Google Calendar API client
 */
function createGoogleCalendarClient(credentials: GoogleCalendarCredentials): AxiosInstance {
  return axios.create({
    baseURL: 'https://www.googleapis.com/calendar/v3',
    headers: {
      'Authorization': `Bearer ${credentials.access_token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a calendar event
 */
export async function executeGoogleCalendarCreateEvent(
  calendarId: string,
  summary: string,
  start: string, // ISO 8601 format
  end: string, // ISO 8601 format
  description?: string,
  location?: string,
  credentials: GoogleCalendarCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createGoogleCalendarClient(credentials);
    
    const eventData: Record<string, unknown> = {
      summary,
      start: {
        dateTime: start,
        timeZone: 'UTC',
      },
      end: {
        dateTime: end,
        timeZone: 'UTC',
      },
    };
    
    if (description) {
      eventData.description = description;
    }
    if (location) {
      eventData.location = location;
    }

    const response = await client.post(`/calendars/${calendarId}/events`, eventData);

    return {
      success: true,
      output: {
        id: response.data.id,
        htmlLink: response.data.htmlLink,
        summary: response.data.summary,
        start: response.data.start,
        end: response.data.end,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Google Calendar event creation failed',
        code: 'GOOGLE_CALENDAR_CREATE_EVENT_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Get calendar events
 */
export async function executeGoogleCalendarGetEvents(
  calendarId: string,
  timeMin?: string, // ISO 8601 format
  timeMax?: string, // ISO 8601 format
  maxResults: number = 10,
  credentials: GoogleCalendarCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createGoogleCalendarClient(credentials);
    
    const params: Record<string, unknown> = {
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    };
    
    if (timeMin) {
      params.timeMin = timeMin;
    }
    if (timeMax) {
      params.timeMax = timeMax;
    }

    const response = await client.get(`/calendars/${calendarId}/events`, { params });

    return {
      success: true,
      output: {
        events: response.data.items || [],
        summary: response.data.summary,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Google Calendar get events failed',
        code: 'GOOGLE_CALENDAR_GET_EVENTS_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * List calendars
 */
export async function executeGoogleCalendarListCalendars(
  credentials: GoogleCalendarCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createGoogleCalendarClient(credentials);
    
    const response = await client.get('/users/me/calendarList');

    return {
      success: true,
      output: {
        calendars: response.data.items || [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Google Calendar list calendars failed',
        code: 'GOOGLE_CALENDAR_LIST_CALENDARS_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Google Calendar connector action
 */
export async function executeGoogleCalendar(
  actionId: string,
  input: Record<string, unknown>,
  credentials: GoogleCalendarCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'create_event':
      const calendarId = (input.calendarId as string) || 'primary';
      const summary = input.summary as string;
      const start = input.start as string;
      const end = input.end as string;
      const description = input.description as string | undefined;
      const location = input.location as string | undefined;
      
      if (!summary || !start || !end) {
        return {
          success: false,
          error: {
            message: 'summary, start, and end are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeGoogleCalendarCreateEvent(calendarId, summary, start, end, description, location, credentials);

    case 'get_events':
      const getCalendarId = (input.calendarId as string) || 'primary';
      const timeMin = input.timeMin as string | undefined;
      const timeMax = input.timeMax as string | undefined;
      const maxResults = (input.maxResults as number) || 10;
      return executeGoogleCalendarGetEvents(getCalendarId, timeMin, timeMax, maxResults, credentials);

    case 'list_calendars':
      return executeGoogleCalendarListCalendars(credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Google Calendar action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

