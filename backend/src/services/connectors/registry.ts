import { ConnectorManifest, ConnectorExecuteOptions, ConnectorExecuteResult } from './types';
import { executeSlack } from '../nodeExecutors/slack';
import { executeAirtable } from '../nodeExecutors/integrations';
import { executeGoogleSheets } from '../nodeExecutors/integrations';
import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';

/**
 * Connector Registry
 * 
 * Manages all available connectors and routes execution to appropriate handlers
 * Supports both built-in connectors and dynamically loaded connectors from database
 */
export class ConnectorRegistry {
  private connectors: Map<string, ConnectorManifest> = new Map();
  private customConnectors: Map<string, ConnectorManifest> = new Map();
  private loadedFromDatabase: boolean = false;

  constructor() {
    this.registerBuiltInConnectors();
  }

  /**
   * Load connectors from database (optional)
   * This allows for custom connectors to be added dynamically
   */
  async loadFromDatabase(): Promise<void> {
    if (this.loadedFromDatabase) {
      return; // Already loaded
    }

    try {
      // Note: We would need a connectors table in the database for this
      // For now, this is a placeholder for future implementation
      // const { db } = await import('../../config/database');
      // const customConnectors = await db.select().from(connectors);
      // customConnectors.forEach(conn => {
      //   this.registerCustom(conn.manifest);
      // });
      this.loadedFromDatabase = true;
    } catch (error) {
      console.warn('[ConnectorRegistry] Failed to load connectors from database:', error);
      // Don't throw - built-in connectors should still work
    }
  }

  /**
   * Register a connector manifest (built-in)
   */
  register(manifest: ConnectorManifest): void {
    this.connectors.set(manifest.id, manifest);
  }

  /**
   * Register a custom connector (from database or user-defined)
   */
  registerCustom(manifest: ConnectorManifest, version?: string): void {
    // Add version to manifest if provided
    const manifestWithVersion = version ? { ...manifest, version } : manifest;
    this.customConnectors.set(manifest.id, manifestWithVersion);
    // Also add to main registry
    this.connectors.set(manifest.id, manifestWithVersion);
  }

  /**
   * Update a connector (versioning support)
   */
  updateConnector(connectorId: string, manifest: ConnectorManifest): boolean {
    if (!this.connectors.has(connectorId)) {
      return false;
    }

    const existing = this.connectors.get(connectorId);
    if (existing && existing.version === manifest.version) {
      console.warn(`[ConnectorRegistry] Connector ${connectorId} already at version ${manifest.version}`);
      return false;
    }

    this.connectors.set(connectorId, manifest);
    if (this.customConnectors.has(connectorId)) {
      this.customConnectors.set(connectorId, manifest);
    }

    return true;
  }

  /**
   * Remove a custom connector
   */
  unregisterCustom(connectorId: string): boolean {
    if (this.customConnectors.has(connectorId)) {
      this.customConnectors.delete(connectorId);
      this.connectors.delete(connectorId);
      return true;
    }
    return false;
  }

  /**
   * Get connector version
   */
  getVersion(connectorId: string): string | undefined {
    const connector = this.connectors.get(connectorId);
    return connector?.version;
  }

  /**
   * Check if connector is custom (not built-in)
   */
  isCustom(connectorId: string): boolean {
    return this.customConnectors.has(connectorId);
  }

  /**
   * Get a connector by ID
   */
  get(id: string): ConnectorManifest | undefined {
    return this.connectors.get(id);
  }

  /**
   * List all connectors, optionally filtered by category
   * Includes both built-in and custom connectors
   */
  list(category?: string): ConnectorManifest[] {
    // Ensure database connectors are loaded
    if (!this.loadedFromDatabase) {
      // Load asynchronously (don't await to avoid blocking)
      this.loadFromDatabase().catch(() => {
        // Ignore errors - built-in connectors still work
      });
    }

    const all = Array.from(this.connectors.values());
    if (category) {
      return all.filter((c) => c.category === category);
    }
    return all;
  }

  /**
   * Execute a connector action
   */
  async execute(
    connectorId: string,
    options: ConnectorExecuteOptions
  ): Promise<ConnectorExecuteResult> {
    const connector = this.get(connectorId);
    if (!connector) {
      return {
        success: false,
        error: {
          message: `Connector ${connectorId} not found`,
          code: 'CONNECTOR_NOT_FOUND',
        },
      };
    }

    const action = connector.actions.find((a) => a.id === options.actionId);
    if (!action) {
      return {
        success: false,
        error: {
          message: `Action ${options.actionId} not found in connector ${connectorId}`,
          code: 'ACTION_NOT_FOUND',
        },
      };
    }

    // Route to appropriate executor based on connector ID
    try {
      const context: NodeExecutionContext = {
        nodeId: `connector-${connectorId}-${options.actionId}`,
        workflowId: 'connector-execution',
        executionId: 'connector-execution',
        input: options.input,
        previousOutputs: {},
        config: {
          type: `integration.${connectorId}`,
          action: options.actionId,
          ...options.input,
        },
      };

      let result: NodeExecutionResult;

      // Route to specific connector executor
      switch (connectorId) {
        case 'slack':
          result = await executeSlack(context);
          break;
        case 'airtable':
          result = await executeAirtable(context);
          break;
        case 'google_sheets':
          result = await executeGoogleSheets(context);
          break;
        default:
          return {
            success: false,
            error: {
              message: `No executor found for connector ${connectorId}`,
              code: 'NO_EXECUTOR',
            },
          };
      }

      return {
        success: result.success,
        output: result.output,
        error: result.error,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          message: error.message || 'Unknown error',
          code: 'EXECUTION_ERROR',
        },
      };
    }
  }

  /**
   * Register built-in connectors
   */
  private registerBuiltInConnectors(): void {
    // Slack connector (Nango)
    this.register({
      id: 'slack',
      name: 'Slack',
      version: '1.0.0',
      description: 'Send messages and interact with Slack',
      category: 'communication',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['chat:write', 'channels:read'],
      },
      actions: [
        {
          id: 'send_message',
          name: 'Send Message',
          description: 'Send a message to a Slack channel',
          inputSchema: {
            type: 'object',
            properties: {
              channel: { type: 'string', description: 'Channel ID or name' },
              text: { type: 'string', description: 'Message text' },
            },
            required: ['channel', 'text'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              ts: { type: 'string', description: 'Message timestamp' },
            },
          },
        },
      ],
    });

    // Airtable connector
    this.register({
      id: 'airtable',
      name: 'Airtable',
      version: '1.0.0',
      description: 'Read and write data to Airtable bases',
      category: 'data',
      auth: {
        type: 'api_key',
      },
      actions: [
        {
          id: 'list_records',
          name: 'List Records',
          description: 'List records from an Airtable table',
          inputSchema: {
            type: 'object',
            properties: {
              baseId: { type: 'string' },
              tableName: { type: 'string' },
            },
            required: ['baseId', 'tableName'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              records: { type: 'array' },
            },
          },
        },
        {
          id: 'create_record',
          name: 'Create Record',
          description: 'Create a new record in Airtable',
          inputSchema: {
            type: 'object',
            properties: {
              baseId: { type: 'string' },
              tableName: { type: 'string' },
              fields: { type: 'object' },
            },
            required: ['baseId', 'tableName', 'fields'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
        },
      ],
    });

    // Google Sheets connector (Nango)
    this.register({
      id: 'google_sheets',
      name: 'Google Sheets',
      version: '1.0.0',
      description: 'Read and write data to Google Sheets',
      category: 'data',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      },
      actions: [
        {
          id: 'read_range',
          name: 'Read Range',
          description: 'Read data from a range in a Google Sheet',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              range: { type: 'string' },
            },
            required: ['spreadsheetId', 'range'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              values: { type: 'array' },
            },
          },
        },
        {
          id: 'write_range',
          name: 'Write Range',
          description: 'Write data to a range in a Google Sheet',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              range: { type: 'string' },
              values: { type: 'array' },
            },
            required: ['spreadsheetId', 'range', 'values'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              updatedCells: { type: 'number' },
            },
          },
        },
      ],
    });

    // Add Nango-supported connectors
    this.registerNangoConnectors();
  }

  /**
   * Register Nango-supported connectors
   */
  private registerNangoConnectors(): void {
    // Salesforce (CRM)
    this.register({
      id: 'salesforce',
      name: 'Salesforce',
      version: '1.0.0',
      description: 'Connect to Salesforce CRM',
      category: 'crm',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['api', 'refresh_token'],
      },
      actions: [
        {
          id: 'query',
          name: 'Query Records',
          description: 'Execute SOQL query',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
            },
            required: ['query'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              records: { type: 'array' },
            },
          },
        },
        {
          id: 'create_record',
          name: 'Create Record',
          description: 'Create a new record in Salesforce',
          inputSchema: {
            type: 'object',
            properties: {
              objectType: { type: 'string' },
              fields: { type: 'object' },
            },
            required: ['objectType', 'fields'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
        },
      ],
    });

    // HubSpot (CRM)
    this.register({
      id: 'hubspot',
      name: 'HubSpot',
      version: '1.0.0',
      description: 'Connect to HubSpot CRM',
      category: 'crm',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['contacts', 'content'],
      },
      actions: [
        {
          id: 'create_contact',
          name: 'Create Contact',
          description: 'Create a new contact in HubSpot',
          inputSchema: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
            },
            required: ['email'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
        },
        {
          id: 'get_contact',
          name: 'Get Contact',
          description: 'Get a contact by ID or email',
          inputSchema: {
            type: 'object',
            properties: {
              contactId: { type: 'string' },
              email: { type: 'string' },
            },
            required: [],
          },
          outputSchema: {
            type: 'object',
            properties: {
              contact: { type: 'object' },
            },
          },
        },
      ],
    });

    // Pipedrive (CRM)
    this.register({
      id: 'pipedrive',
      name: 'Pipedrive',
      version: '1.0.0',
      description: 'Connect to Pipedrive CRM',
      category: 'crm',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['api'],
      },
      actions: [
        {
          id: 'create_deal',
          name: 'Create Deal',
          description: 'Create a new deal in Pipedrive',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              value: { type: 'number' },
              currency: { type: 'string' },
              personId: { type: 'number' },
              orgId: { type: 'number' },
            },
            required: ['title'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'number' },
            },
          },
        },
        {
          id: 'get_deals',
          name: 'Get Deals',
          description: 'Get deals from Pipedrive',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number' },
              start: { type: 'number' },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              deals: { type: 'array' },
            },
          },
        },
      ],
    });

    // Zoho CRM
    this.register({
      id: 'zoho_crm',
      name: 'Zoho CRM',
      version: '1.0.0',
      description: 'Connect to Zoho CRM',
      category: 'crm',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['ZohoCRM.modules.ALL', 'ZohoCRM.settings.ALL'],
      },
      actions: [
        {
          id: 'create_lead',
          name: 'Create Lead',
          description: 'Create a new lead in Zoho CRM',
          inputSchema: {
            type: 'object',
            properties: {
              Last_Name: { type: 'string' },
              First_Name: { type: 'string' },
              Email: { type: 'string' },
              Company: { type: 'string' },
              Phone: { type: 'string' },
            },
            required: ['Last_Name'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
        },
        {
          id: 'get_leads',
          name: 'Get Leads',
          description: 'Get leads from Zoho CRM',
          inputSchema: {
            type: 'object',
            properties: {
              page: { type: 'number' },
              per_page: { type: 'number' },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              leads: { type: 'array' },
            },
          },
        },
      ],
    });

    // Microsoft Teams (Communication)
    this.register({
      id: 'microsoft_teams',
      name: 'Microsoft Teams',
      version: '1.0.0',
      description: 'Send messages and interact with Microsoft Teams',
      category: 'communication',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['https://graph.microsoft.com/ChannelMessage.Send'],
      },
      actions: [
        {
          id: 'send_message',
          name: 'Send Message',
          description: 'Send a message to a Teams channel',
          inputSchema: {
            type: 'object',
            properties: {
              teamId: { type: 'string' },
              channelId: { type: 'string' },
              message: { type: 'string' },
            },
            required: ['teamId', 'channelId', 'message'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
        },
      ],
    });

    // Discord (Communication)
    this.register({
      id: 'discord',
      name: 'Discord',
      version: '1.0.0',
      description: 'Send messages and interact with Discord',
      category: 'communication',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['bot', 'messages.read', 'messages.write'],
      },
      actions: [
        {
          id: 'send_message',
          name: 'Send Message',
          description: 'Send a message to a Discord channel',
          inputSchema: {
            type: 'object',
            properties: {
              channelId: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['channelId', 'content'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
        },
      ],
    });

    // Twilio (Communication)
    this.register({
      id: 'twilio',
      name: 'Twilio',
      version: '1.0.0',
      description: 'Send SMS and make phone calls via Twilio',
      category: 'communication',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['api'],
      },
      actions: [
        {
          id: 'send_sms',
          name: 'Send SMS',
          description: 'Send an SMS message via Twilio',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Phone number to send to (E.164 format)' },
              from: { type: 'string', description: 'Twilio phone number to send from' },
              body: { type: 'string', description: 'Message body' },
            },
            required: ['to', 'from', 'body'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              sid: { type: 'string', description: 'Message SID' },
              status: { type: 'string' },
            },
          },
        },
        {
          id: 'make_call',
          name: 'Make Call',
          description: 'Make a phone call via Twilio',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Phone number to call (E.164 format)' },
              from: { type: 'string', description: 'Twilio phone number to call from' },
              url: { type: 'string', description: 'TwiML URL for call instructions' },
            },
            required: ['to', 'from', 'url'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              sid: { type: 'string', description: 'Call SID' },
              status: { type: 'string' },
            },
          },
        },
      ],
    });

    // SendGrid (Communication)
    this.register({
      id: 'sendgrid',
      name: 'SendGrid',
      version: '1.0.0',
      description: 'Send emails via SendGrid',
      category: 'communication',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['mail.send'],
      },
      actions: [
        {
          id: 'send_email',
          name: 'Send Email',
          description: 'Send an email via SendGrid',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Recipient email address' },
              from: { type: 'string', description: 'Sender email address' },
              subject: { type: 'string', description: 'Email subject' },
              text: { type: 'string', description: 'Plain text email body' },
              html: { type: 'string', description: 'HTML email body' },
              cc: { type: 'array', items: { type: 'string' }, description: 'CC recipients' },
              bcc: { type: 'array', items: { type: 'string' }, description: 'BCC recipients' },
            },
            required: ['to', 'from', 'subject'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              messageId: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
        },
        {
          id: 'send_template_email',
          name: 'Send Template Email',
          description: 'Send an email using a SendGrid template',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'string' },
              from: { type: 'string' },
              templateId: { type: 'string' },
              dynamicTemplateData: { type: 'object', description: 'Template variables' },
            },
            required: ['to', 'from', 'templateId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              messageId: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
        },
      ],
    });

    // Trello (Productivity)
    this.register({
      id: 'trello',
      name: 'Trello',
      version: '1.0.0',
      description: 'Manage Trello boards and cards',
      category: 'productivity',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['read', 'write'],
      },
      actions: [
        {
          id: 'create_card',
          name: 'Create Card',
          description: 'Create a new card on a Trello board',
          inputSchema: {
            type: 'object',
            properties: {
              boardId: { type: 'string' },
              listId: { type: 'string' },
              name: { type: 'string' },
              desc: { type: 'string' },
            },
            required: ['boardId', 'listId', 'name'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
        },
        {
          id: 'get_cards',
          name: 'Get Cards',
          description: 'Get cards from a Trello board',
          inputSchema: {
            type: 'object',
            properties: {
              boardId: { type: 'string' },
              listId: { type: 'string' },
            },
            required: ['boardId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              cards: { type: 'array' },
            },
          },
        },
      ],
    });

    // Asana (Productivity)
    this.register({
      id: 'asana',
      name: 'Asana',
      version: '1.0.0',
      description: 'Manage Asana projects and tasks',
      category: 'productivity',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['default'],
      },
      actions: [
        {
          id: 'create_task',
          name: 'Create Task',
          description: 'Create a new task in Asana',
          inputSchema: {
            type: 'object',
            properties: {
              workspace: { type: 'string' },
              name: { type: 'string' },
              notes: { type: 'string' },
            },
            required: ['workspace', 'name'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
        },
        {
          id: 'get_tasks',
          name: 'Get Tasks',
          description: 'Get tasks from an Asana project',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: { type: 'string' },
              limit: { type: 'number' },
            },
            required: ['projectId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              tasks: { type: 'array' },
            },
          },
        },
      ],
    });

    // Monday.com (Productivity)
    this.register({
      id: 'monday',
      name: 'Monday.com',
      version: '1.0.0',
      description: 'Manage Monday.com boards and items',
      category: 'productivity',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['api'],
      },
      actions: [
        {
          id: 'create_item',
          name: 'Create Item',
          description: 'Create a new item on a Monday.com board',
          inputSchema: {
            type: 'object',
            properties: {
              boardId: { type: 'string' },
              itemName: { type: 'string' },
              columnValues: { type: 'object' },
            },
            required: ['boardId', 'itemName'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
        },
        {
          id: 'get_items',
          name: 'Get Items',
          description: 'Get items from a Monday.com board',
          inputSchema: {
            type: 'object',
            properties: {
              boardId: { type: 'string' },
              limit: { type: 'number' },
            },
            required: ['boardId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              items: { type: 'array' },
            },
          },
        },
      ],
    });

    // Jira (Productivity)
    this.register({
      id: 'jira',
      name: 'Jira',
      version: '1.0.0',
      description: 'Manage Jira issues and projects',
      category: 'productivity',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['read:jira-work', 'write:jira-work'],
      },
      actions: [
        {
          id: 'create_issue',
          name: 'Create Issue',
          description: 'Create a new Jira issue',
          inputSchema: {
            type: 'object',
            properties: {
              projectKey: { type: 'string' },
              summary: { type: 'string' },
              description: { type: 'string' },
              issueType: { type: 'string' },
            },
            required: ['projectKey', 'summary', 'issueType'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              key: { type: 'string' },
            },
          },
        },
        {
          id: 'get_issues',
          name: 'Get Issues',
          description: 'Get issues from a Jira project',
          inputSchema: {
            type: 'object',
            properties: {
              projectKey: { type: 'string' },
              jql: { type: 'string', description: 'JQL query string' },
              limit: { type: 'number' },
            },
            required: ['projectKey'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              issues: { type: 'array' },
            },
          },
        },
      ],
    });

    // Shopify (E-commerce)
    this.register({
      id: 'shopify',
      name: 'Shopify',
      version: '1.0.0',
      description: 'Connect to Shopify stores',
      category: 'e-commerce',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['read_products', 'write_products'],
      },
      actions: [
        {
          id: 'get_products',
          name: 'Get Products',
          description: 'Retrieve products from Shopify store',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number' },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              products: { type: 'array' },
            },
          },
        },
        {
          id: 'create_product',
          name: 'Create Product',
          description: 'Create a new product in Shopify',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              body_html: { type: 'string' },
              vendor: { type: 'string' },
              product_type: { type: 'string' },
            },
            required: ['title'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'number' },
            },
          },
        },
      ],
    });

    // Stripe (E-commerce)
    this.register({
      id: 'stripe',
      name: 'Stripe',
      version: '1.0.0',
      description: 'Process payments with Stripe',
      category: 'e-commerce',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['read_write'],
      },
      actions: [
        {
          id: 'create_payment',
          name: 'Create Payment Intent',
          description: 'Create a payment intent',
          inputSchema: {
            type: 'object',
            properties: {
              amount: { type: 'number' },
              currency: { type: 'string' },
              customer: { type: 'string' },
            },
            required: ['amount', 'currency'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              client_secret: { type: 'string' },
            },
          },
        },
        {
          id: 'create_customer',
          name: 'Create Customer',
          description: 'Create a new Stripe customer',
          inputSchema: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              name: { type: 'string' },
            },
            required: ['email'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
        },
      ],
    });

    // WooCommerce (E-commerce) - Direct API
    this.register({
      id: 'woocommerce',
      name: 'WooCommerce',
      version: '1.0.0',
      description: 'Connect to WooCommerce stores',
      category: 'e-commerce',
      auth: {
        type: 'api_key',
        description: 'WooCommerce REST API credentials',
      },
      actions: [
        {
          id: 'get_products',
          name: 'Get Products',
          description: 'Retrieve products from WooCommerce store',
          inputSchema: {
            type: 'object',
            properties: {
              per_page: { type: 'number' },
              page: { type: 'number' },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              products: { type: 'array' },
            },
          },
        },
        {
          id: 'create_order',
          name: 'Create Order',
          description: 'Create a new order in WooCommerce',
          inputSchema: {
            type: 'object',
            properties: {
              payment_method: { type: 'string' },
              payment_method_title: { type: 'string' },
              line_items: { type: 'array' },
            },
            required: ['line_items'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'number' },
            },
          },
        },
      ],
    });

    // PayPal (E-commerce)
    this.register({
      id: 'paypal',
      name: 'PayPal',
      version: '1.0.0',
      description: 'Process payments with PayPal',
      category: 'e-commerce',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['https://api.paypal.com/v1/payments/.*'],
      },
      actions: [
        {
          id: 'create_payment',
          name: 'Create Payment',
          description: 'Create a PayPal payment',
          inputSchema: {
            type: 'object',
            properties: {
              amount: { type: 'number' },
              currency: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['amount', 'currency'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              approval_url: { type: 'string' },
            },
          },
        },
      ],
    });

    // Database Connectors
    this.registerDatabaseConnectors();

    // Email Services
    this.registerEmailConnectors();
  }

  /**
   * Register email service connectors
   */
  private registerEmailConnectors(): void {
    // Gmail (Communication)
    this.register({
      id: 'gmail',
      name: 'Gmail',
      version: '1.0.0',
      description: 'Send and receive emails via Gmail',
      category: 'communication',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],
      },
      actions: [
        {
          id: 'send_email',
          name: 'Send Email',
          description: 'Send an email via Gmail',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Recipient email address' },
              from: { type: 'string', description: 'Sender email address' },
              subject: { type: 'string', description: 'Email subject' },
              body: { type: 'string', description: 'Email body' },
              isHtml: { type: 'boolean', description: 'Whether body is HTML' },
            },
            required: ['to', 'from', 'subject', 'body'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              threadId: { type: 'string' },
            },
          },
        },
        {
          id: 'get_messages',
          name: 'Get Messages',
          description: 'Get messages from Gmail inbox',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Gmail search query' },
              maxResults: { type: 'number', description: 'Maximum number of results' },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              messages: { type: 'array' },
            },
          },
        },
        {
          id: 'get_message',
          name: 'Get Message',
          description: 'Get a specific message by ID',
          inputSchema: {
            type: 'object',
            properties: {
              messageId: { type: 'string' },
            },
            required: ['messageId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              snippet: { type: 'string' },
            },
          },
        },
      ],
    });

    // Outlook / Microsoft 365 Mail (Communication)
    this.register({
      id: 'outlook',
      name: 'Outlook',
      version: '1.0.0',
      description: 'Send and receive emails via Outlook/Microsoft 365',
      category: 'communication',
      oauthProvider: 'nango',
      auth: {
        type: 'oauth2',
        scopes: ['https://graph.microsoft.com/Mail.Send', 'https://graph.microsoft.com/Mail.Read'],
      },
      actions: [
        {
          id: 'send_email',
          name: 'Send Email',
          description: 'Send an email via Outlook',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Recipient email address' },
              from: { type: 'string', description: 'Sender email address' },
              subject: { type: 'string', description: 'Email subject' },
              body: { type: 'string', description: 'Email body' },
              isHtml: { type: 'boolean', description: 'Whether body is HTML' },
            },
            required: ['to', 'from', 'subject', 'body'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
        },
        {
          id: 'get_messages',
          name: 'Get Messages',
          description: 'Get messages from Outlook inbox',
          inputSchema: {
            type: 'object',
            properties: {
              filter: { type: 'string', description: 'OData filter query' },
              top: { type: 'number', description: 'Maximum number of results' },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              messages: { type: 'array' },
            },
          },
        },
        {
          id: 'get_message',
          name: 'Get Message',
          description: 'Get a specific message by ID',
          inputSchema: {
            type: 'object',
            properties: {
              messageId: { type: 'string' },
            },
            required: ['messageId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              subject: { type: 'string' },
            },
          },
        },
      ],
    });
  }

  /**
   * Register database connectors
   */
  private registerDatabaseConnectors(): void {
    // PostgreSQL (Database)
    this.register({
      id: 'postgresql',
      name: 'PostgreSQL',
      version: '1.0.0',
      description: 'Connect to PostgreSQL databases',
      category: 'database',
      auth: {
        type: 'connection_string',
        description: 'PostgreSQL connection string',
      },
      actions: [
        {
          id: 'execute_query',
          name: 'Execute Query',
          description: 'Execute a SQL query on PostgreSQL',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'SQL query to execute' },
              params: { type: 'array', description: 'Query parameters' },
            },
            required: ['query'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              rows: { type: 'array' },
              rowCount: { type: 'number' },
            },
          },
        },
        {
          id: 'list_tables',
          name: 'List Tables',
          description: 'List all tables in the database',
          inputSchema: {
            type: 'object',
            properties: {
              schema: { type: 'string', description: 'Schema name (default: public)' },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              tables: { type: 'array' },
            },
          },
        },
      ],
    });

    // MySQL (Database)
    this.register({
      id: 'mysql',
      name: 'MySQL',
      version: '1.0.0',
      description: 'Connect to MySQL databases',
      category: 'database',
      auth: {
        type: 'connection_string',
        description: 'MySQL connection string',
      },
      actions: [
        {
          id: 'execute_query',
          name: 'Execute Query',
          description: 'Execute a SQL query on MySQL',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'SQL query to execute' },
              params: { type: 'array', description: 'Query parameters' },
            },
            required: ['query'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              rows: { type: 'array' },
              affectedRows: { type: 'number' },
            },
          },
        },
        {
          id: 'list_tables',
          name: 'List Tables',
          description: 'List all tables in the database',
          inputSchema: {
            type: 'object',
            properties: {
              database: { type: 'string', description: 'Database name' },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              tables: { type: 'array' },
            },
          },
        },
      ],
    });

    // MongoDB (Database)
    this.register({
      id: 'mongodb',
      name: 'MongoDB',
      version: '1.0.0',
      description: 'Connect to MongoDB databases',
      category: 'database',
      auth: {
        type: 'connection_string',
        description: 'MongoDB connection string',
      },
      actions: [
        {
          id: 'find',
          name: 'Find Documents',
          description: 'Find documents in a MongoDB collection',
          inputSchema: {
            type: 'object',
            properties: {
              database: { type: 'string' },
              collection: { type: 'string' },
              filter: { type: 'object', description: 'MongoDB filter query' },
              limit: { type: 'number' },
            },
            required: ['database', 'collection'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              documents: { type: 'array' },
            },
          },
        },
        {
          id: 'insert',
          name: 'Insert Document',
          description: 'Insert a document into a MongoDB collection',
          inputSchema: {
            type: 'object',
            properties: {
              database: { type: 'string' },
              collection: { type: 'string' },
              document: { type: 'object' },
            },
            required: ['database', 'collection', 'document'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              insertedId: { type: 'string' },
            },
          },
        },
      ],
    });

    // Redis (Database)
    this.register({
      id: 'redis',
      name: 'Redis',
      version: '1.0.0',
      description: 'Connect to Redis databases',
      category: 'database',
      auth: {
        type: 'connection_string',
        description: 'Redis connection string',
      },
      actions: [
        {
          id: 'get',
          name: 'Get Value',
          description: 'Get a value from Redis by key',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string' },
            },
            required: ['key'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              value: { type: 'string' },
            },
          },
        },
        {
          id: 'set',
          name: 'Set Value',
          description: 'Set a value in Redis',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              value: { type: 'string' },
              ttl: { type: 'number', description: 'Time to live in seconds' },
            },
            required: ['key', 'value'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
        },
      ],
    });

    // Supabase (Database)
    this.register({
      id: 'supabase',
      name: 'Supabase',
      version: '1.0.0',
      description: 'Connect to Supabase databases via API',
      category: 'database',
      auth: {
        type: 'api_key',
        description: 'Supabase API key and URL',
      },
      actions: [
        {
          id: 'query',
          name: 'Query Table',
          description: 'Query a Supabase table',
          inputSchema: {
            type: 'object',
            properties: {
              table: { type: 'string' },
              select: { type: 'string', description: 'Columns to select' },
              filter: { type: 'object', description: 'Filter conditions' },
              limit: { type: 'number' },
            },
            required: ['table'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              data: { type: 'array' },
            },
          },
        },
        {
          id: 'insert',
          name: 'Insert Row',
          description: 'Insert a row into a Supabase table',
          inputSchema: {
            type: 'object',
            properties: {
              table: { type: 'string' },
              data: { type: 'object' },
            },
            required: ['table', 'data'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              data: { type: 'array' },
            },
          },
        },
      ],
    });
  }
}

export const connectorRegistry = new ConnectorRegistry();

