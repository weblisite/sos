import { NodeDefinition } from '@sos/shared';

export const nodeRegistry: Record<string, NodeDefinition> = {
  // Triggers
  'trigger.manual': {
    type: 'trigger.manual',
    name: 'Manual Trigger',
    description: 'Start workflow manually',
    category: 'trigger',
    icon: 'play',
    inputs: [],
    outputs: [
      { name: 'trigger', type: 'object', description: 'Trigger data' },
    ],
  },
  'trigger.webhook': {
    type: 'trigger.webhook',
    name: 'Webhook',
    description: 'Trigger workflow via HTTP webhook',
    category: 'trigger',
    icon: 'webhook',
    inputs: [],
    outputs: [
      { name: 'body', type: 'object', description: 'Request body' },
      { name: 'headers', type: 'object', description: 'Request headers' },
      { name: 'query', type: 'object', description: 'Query parameters' },
    ],
    config: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Webhook path',
          default: '/webhook',
        },
        method: {
          type: 'string',
          description: 'HTTP method',
          enum: ['GET', 'POST', 'PUT', 'DELETE'],
          default: 'POST',
        },
      },
      required: ['path'],
    },
  },
  'trigger.schedule': {
    type: 'trigger.schedule',
    name: 'Schedule',
    description: 'Trigger workflow on a schedule',
    category: 'trigger',
    icon: 'clock',
    inputs: [],
    outputs: [
      { name: 'trigger', type: 'object', description: 'Schedule trigger data' },
    ],
    config: {
      type: 'object',
      properties: {
        cron: {
          type: 'string',
          description: 'CRON expression',
          default: '0 * * * *',
        },
        timezone: {
          type: 'string',
          description: 'Timezone',
          default: 'UTC',
        },
      },
      required: ['cron'],
    },
  },
  'trigger.email.gmail': {
    type: 'trigger.email.gmail',
    name: 'Gmail Trigger',
    description: 'Trigger workflow when new email arrives in Gmail',
    category: 'trigger',
    icon: 'mail',
    inputs: [],
    outputs: [
      { name: 'email', type: 'object', description: 'Email data (id, from, to, subject, body, html, date, attachments)' },
      { name: 'trigger', type: 'object', description: 'Trigger metadata' },
    ],
    config: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Gmail address to monitor',
          default: '',
        },
        credentials: {
          type: 'object',
          description: 'OAuth credentials (set via Connect button)',
          default: {},
        },
        pollInterval: {
          type: 'number',
          description: 'Poll interval in seconds',
          default: 60,
          minimum: 30,
          maximum: 3600,
        },
        filters: {
          type: 'object',
          description: 'Email filters',
          properties: {
            from: {
              type: 'string',
              description: 'Filter by sender email',
            },
            subject: {
              type: 'string',
              description: 'Filter by subject contains',
            },
            hasAttachment: {
              type: 'boolean',
              description: 'Only emails with attachments',
            },
          },
        },
      },
      required: ['email'],
    },
  },
  'trigger.email.outlook': {
    type: 'trigger.email.outlook',
    name: 'Outlook Trigger',
    description: 'Trigger workflow when new email arrives in Outlook',
    category: 'trigger',
    icon: 'mail',
    inputs: [],
    outputs: [
      { name: 'email', type: 'object', description: 'Email data (id, from, to, subject, body, html, date, attachments)' },
      { name: 'trigger', type: 'object', description: 'Trigger metadata' },
    ],
    config: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Outlook email address to monitor',
          default: '',
        },
        credentials: {
          type: 'object',
          description: 'OAuth credentials (set via Connect button)',
          default: {},
        },
        pollInterval: {
          type: 'number',
          description: 'Poll interval in seconds',
          default: 60,
          minimum: 30,
          maximum: 3600,
        },
        filters: {
          type: 'object',
          description: 'Email filters',
          properties: {
            from: {
              type: 'string',
              description: 'Filter by sender email',
            },
            subject: {
              type: 'string',
              description: 'Filter by subject contains',
            },
            hasAttachment: {
              type: 'boolean',
              description: 'Only emails with attachments',
            },
          },
        },
      },
      required: ['email'],
    },
  },
  'trigger.email.imap': {
    type: 'trigger.email.imap',
    name: 'IMAP Trigger',
    description: 'Trigger workflow when new email arrives via IMAP',
    category: 'trigger',
    icon: 'mail',
    inputs: [],
    outputs: [
      { name: 'email', type: 'object', description: 'Email data (id, from, to, subject, body, html, date, attachments)' },
      { name: 'trigger', type: 'object', description: 'Trigger metadata' },
    ],
    config: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email address to monitor',
          default: '',
        },
        credentials: {
          type: 'object',
          description: 'IMAP credentials',
          properties: {
            host: {
              type: 'string',
              description: 'IMAP server host',
            },
            port: {
              type: 'number',
              description: 'IMAP server port',
              default: 993,
            },
            user: {
              type: 'string',
              description: 'IMAP username',
            },
            password: {
              type: 'string',
              description: 'IMAP password',
              format: 'password',
            },
            secure: {
              type: 'boolean',
              description: 'Use SSL/TLS',
              default: true,
            },
          },
          required: ['host', 'port', 'user', 'password'],
        },
        folder: {
          type: 'string',
          description: 'Email folder to monitor',
          default: 'INBOX',
        },
        pollInterval: {
          type: 'number',
          description: 'Poll interval in seconds',
          default: 60,
          minimum: 30,
          maximum: 3600,
        },
        filters: {
          type: 'object',
          description: 'Email filters',
          properties: {
            from: {
              type: 'string',
              description: 'Filter by sender email',
            },
            subject: {
              type: 'string',
              description: 'Filter by subject contains',
            },
            hasAttachment: {
              type: 'boolean',
              description: 'Only emails with attachments',
            },
          },
        },
      },
      required: ['email', 'credentials'],
    },
  },

  // Actions
  'action.http': {
    type: 'action.http',
    name: 'HTTP Request',
    description: 'Make an HTTP request',
    category: 'action',
    icon: 'globe',
    inputs: [
      { name: 'url', type: 'string', required: true, description: 'Request URL' },
      { name: 'method', type: 'string', description: 'HTTP method' },
      { name: 'headers', type: 'object', description: 'Request headers' },
      { name: 'body', type: 'any', description: 'Request body' },
    ],
    outputs: [
      { name: 'status', type: 'number', description: 'Response status code' },
      { name: 'headers', type: 'object', description: 'Response headers' },
      { name: 'data', type: 'any', description: 'Response data' },
      { name: 'error', type: 'object', description: 'Error output (if request fails)' },
    ],
    config: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          default: 'GET',
        },
        timeout: {
          type: 'number',
          description: 'Request timeout in milliseconds',
          default: 30000,
        },
        followRedirects: {
          type: 'boolean',
          default: true,
        },
      },
    },
  },
  'action.web_scrape': {
    type: 'action.web_scrape',
    name: 'Web Scrape',
    description: 'Extract data from web pages using CSS selectors',
    category: 'action',
    icon: 'globe',
    inputs: [
      { name: 'url', type: 'string', required: true, description: 'URL to scrape' },
      { name: 'selectors', type: 'object', description: 'CSS selectors for data extraction (key: field name, value: CSS selector)' },
      { name: 'extractText', type: 'boolean', description: 'Extract text content (default: true)' },
      { name: 'extractHtml', type: 'boolean', description: 'Extract raw HTML (default: false)' },
      { name: 'extractAttributes', type: 'array', description: 'Extract specific attributes (e.g., ["href", "src"])' },
      { name: 'timeout', type: 'number', description: 'Request timeout in milliseconds' },
      { name: 'headers', type: 'object', description: 'Custom HTTP headers' },
      { name: 'userAgent', type: 'string', description: 'Custom user agent' },
      { name: 'renderJavaScript', type: 'boolean', description: 'Use Puppeteer for JavaScript rendering' },
      { name: 'waitForSelector', type: 'string', description: 'CSS selector to wait for (Puppeteer only)' },
      { name: 'executeJavaScript', type: 'string', description: 'Custom JavaScript to execute (Puppeteer only)' },
      { name: 'scrollToBottom', type: 'boolean', description: 'Scroll to bottom to load content (Puppeteer only)' },
      { name: 'screenshot', type: 'boolean', description: 'Take screenshot (Puppeteer only)' },
    ],
    outputs: [
      { name: 'data', type: 'object', description: 'Extracted data based on selectors' },
      { name: 'html', type: 'string', description: 'Raw HTML (if extractHtml is true)' },
      { name: 'screenshot', type: 'string', description: 'Base64 screenshot (if screenshot is true, Puppeteer only)' },
      { name: 'url', type: 'string', description: 'Scraped URL' },
      { name: 'metadata', type: 'object', description: 'Scraping metadata (latency, content length, engine, etc.)' },
    ],
    config: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to scrape',
          default: '',
        },
        selectors: {
          type: 'object',
          description: 'CSS selectors for data extraction',
          additionalProperties: {
            type: 'string',
          },
          default: {},
        },
        extractText: {
          type: 'boolean',
          description: 'Extract text content',
          default: true,
        },
        extractHtml: {
          type: 'boolean',
          description: 'Extract raw HTML',
          default: false,
        },
        extractAttributes: {
          type: 'array',
          description: 'Extract specific attributes',
          items: {
            type: 'string',
          },
          default: [],
        },
        timeout: {
          type: 'number',
          description: 'Request timeout in milliseconds',
          default: 30000,
        },
        headers: {
          type: 'object',
          description: 'Custom HTTP headers',
          additionalProperties: {
            type: 'string',
          },
          default: {},
        },
        userAgent: {
          type: 'string',
          description: 'Custom user agent',
          default: 'SynthralOS/1.0 (Web Scraper)',
        },
        retries: {
          type: 'number',
          description: 'Number of retries on failure',
          default: 2,
        },
        retryDelay: {
          type: 'number',
          description: 'Delay between retries in milliseconds',
          default: 1000,
        },
        renderJavaScript: {
          type: 'boolean',
          description: 'Use Puppeteer for JavaScript rendering (auto-detected if not set)',
          default: undefined,
        },
        waitForSelector: {
          type: 'string',
          description: 'CSS selector to wait for before scraping (Puppeteer only)',
          default: '',
        },
        waitForTimeout: {
          type: 'number',
          description: 'Timeout for waitForSelector in milliseconds',
          default: 30000,
        },
        executeJavaScript: {
          type: 'string',
          description: 'Custom JavaScript to execute in page context (Puppeteer only)',
          default: '',
        },
        scrollToBottom: {
          type: 'boolean',
          description: 'Scroll to bottom to load dynamic content (Puppeteer only)',
          default: false,
        },
        viewport: {
          type: 'object',
          description: 'Viewport dimensions (Puppeteer only)',
          properties: {
            width: { type: 'number', default: 1920 },
            height: { type: 'number', default: 1080 },
          },
          default: undefined,
        },
        screenshot: {
          type: 'boolean',
          description: 'Take screenshot of the page (Puppeteer only)',
          default: false,
        },
      },
      required: ['url'],
    },
  },
  'action.code': {
    type: 'action.code',
    name: 'Code (JavaScript)',
    description: 'Execute JavaScript code',
    category: 'code',
    icon: 'code',
    inputs: [
      { name: 'input', type: 'any', description: 'Input data' },
    ],
    outputs: [
      { name: 'output', type: 'any', description: 'Code output' },
      { name: 'error', type: 'object', description: 'Error output (if code execution fails)' },
    ],
    config: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'JavaScript code to execute',
          default: '// Your code here\nreturn input;',
          format: 'code',
        },
        inputSchema: {
          type: 'object',
          description: 'Input schema for validation (Zod schema as JSON)',
          format: 'schema',
        },
        outputSchema: {
          type: 'object',
          description: 'Output schema for validation (Zod schema as JSON)',
          format: 'schema',
        },
        validationType: {
          type: 'string',
          description: 'Validation type',
          enum: ['zod', 'pydantic'],
          default: 'zod',
        },
        security: {
          type: 'object',
          description: 'Security settings',
          properties: {
            readOnlyFilesystem: {
              type: 'boolean',
              description: 'Enable read-only filesystem (blocks file writes)',
              default: false,
            },
            allowNetwork: {
              type: 'boolean',
              description: 'Allow outbound network access',
              default: false,
            },
            allowedHosts: {
              type: 'array',
              description: 'Whitelist of allowed hosts (if network is enabled)',
              items: { type: 'string' },
              default: [],
            },
          },
        },
      },
      required: ['code'],
    },
  },
  'action.code.python': {
    type: 'action.code.python',
    name: 'Code (Python)',
    description: 'Execute Python code',
    category: 'code',
    icon: 'code',
    inputs: [
      { name: 'input', type: 'any', description: 'Input data' },
    ],
    outputs: [
      { name: 'output', type: 'any', description: 'Code output' },
      { name: 'error', type: 'object', description: 'Error output (if code execution fails)' },
    ],
    config: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Python code to execute. Set a "result" variable or return a value.',
          default: '# Your code here\nresult = input_data',
          format: 'code',
          language: 'python',
        },
        packages: {
          type: 'array',
          description: 'Python packages to install (e.g., ["pandas", "numpy"]). One package per line.',
          default: [],
          format: 'packages',
        },
        inputSchema: {
          type: 'object',
          description: 'Input schema for validation (Pydantic schema as JSON)',
          format: 'schema',
        },
        outputSchema: {
          type: 'object',
          description: 'Output schema for validation (Pydantic schema as JSON)',
          format: 'schema',
        },
        validationType: {
          type: 'string',
          description: 'Validation type',
          enum: ['zod', 'pydantic'],
          default: 'pydantic',
        },
        timeout: {
          type: 'number',
          description: 'Execution timeout in milliseconds',
          default: 30000,
          minimum: 1000,
          maximum: 300000,
        },
        runtime: {
          type: 'string',
          enum: ['auto', 'vm2', 'e2b', 'wasmedge', 'bacalhau', 'subprocess'],
          default: 'auto',
          description: 'Runtime to use for execution (auto = intelligent routing)',
        },
        requiresSandbox: {
          type: 'boolean',
          default: false,
          description: 'Require secure sandbox isolation',
        },
        longJob: {
          type: 'boolean',
          default: false,
          description: 'Long-running job (will route to distributed runtime)',
        },
        expectedDuration: {
          type: 'number',
          default: 0,
          description: 'Expected execution duration in milliseconds (for routing optimization)',
        },
        inputSchema: {
          type: 'object',
          description: 'Input schema for validation (Zod/Pydantic)',
        },
        outputSchema: {
          type: 'object',
          description: 'Output schema for validation (Zod/Pydantic)',
        },
        validationType: {
          type: 'string',
          enum: ['zod', 'pydantic'],
          default: 'pydantic',
          description: 'Validation type (zod for JS/TS, pydantic for Python)',
        },
      },
      required: ['code'],
    },
  },
  'action.code.typescript': {
    type: 'action.code.typescript',
    name: 'Code (TypeScript)',
    description: 'Execute TypeScript code (compiled to JavaScript)',
    category: 'code',
    icon: 'code',
    inputs: [
      { name: 'input', type: 'any', description: 'Input data' },
    ],
    outputs: [
      { name: 'output', type: 'any', description: 'Code output' },
      { name: 'error', type: 'object', description: 'Error output (if code execution fails)' },
    ],
    config: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'TypeScript code to execute',
          default: '// Your code here\nreturn input;',
          format: 'code',
          language: 'typescript',
        },
        inputSchema: {
          type: 'object',
          description: 'Input schema for validation (Zod)',
        },
        outputSchema: {
          type: 'object',
          description: 'Output schema for validation (Zod)',
        },
        validationType: {
          type: 'string',
          enum: ['zod'],
          default: 'zod',
          description: 'Validation type',
        },
      },
      required: ['code'],
    },
  },
  'action.code.bash': {
    type: 'action.code.bash',
    name: 'Code (Bash)',
    description: 'Execute Bash shell script',
    category: 'code',
    icon: 'code',
    inputs: [
      { name: 'input', type: 'any', description: 'Input data' },
    ],
    outputs: [
      { name: 'output', type: 'any', description: 'Code output' },
      { name: 'error', type: 'object', description: 'Error output (if code execution fails)' },
    ],
    config: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Bash script to execute',
          default: '#!/bin/bash\n# Your code here\necho "Hello from Bash"',
          format: 'code',
          language: 'bash',
        },
        inputSchema: {
          type: 'object',
          description: 'Input schema for validation (Zod schema as JSON)',
          format: 'schema',
        },
        outputSchema: {
          type: 'object',
          description: 'Output schema for validation (Zod schema as JSON)',
          format: 'schema',
        },
        validationType: {
          type: 'string',
          description: 'Validation type',
          enum: ['zod', 'pydantic'],
          default: 'zod',
        },
        timeout: {
          type: 'number',
          description: 'Execution timeout in milliseconds',
          default: 30000,
          minimum: 1000,
          maximum: 300000,
        },
      },
      required: ['code'],
    },
  },
  'action.transform': {
    type: 'action.transform',
    name: 'Transform Data',
    description: 'Transform data using built-in functions',
    category: 'data',
    icon: 'arrow-right',
    inputs: [
      { name: 'input', type: 'any', description: 'Input data' },
    ],
    outputs: [
      { name: 'output', type: 'any', description: 'Transformed data' },
    ],
    config: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['map', 'filter', 'reduce', 'sort', 'group', 'merge'],
          default: 'map',
        },
        expression: {
          type: 'string',
          description: 'Transformation expression',
        },
      },
    },
  },

  // AI Nodes
  'ai.llm': {
    type: 'ai.llm',
    name: 'LLM',
    description: 'Generate text using Large Language Model',
    category: 'ai',
    icon: 'sparkles',
    inputs: [
      { name: 'prompt', type: 'string', required: true, description: 'Prompt text' },
      { name: 'context', type: 'any', description: 'Additional context' },
    ],
    outputs: [
      { name: 'text', type: 'string', description: 'Generated text' },
      { name: 'tokens', type: 'number', description: 'Tokens used' },
    ],
    config: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['openai', 'anthropic', 'google'],
          default: 'openai',
        },
        model: {
          type: 'string',
          description: 'Model name',
          default: 'gpt-3.5-turbo',
        },
        temperature: {
          type: 'number',
          description: 'Temperature (0-2)',
          default: 0.7,
        },
        maxTokens: {
          type: 'number',
          description: 'Maximum tokens',
          default: 1000,
        },
        systemPrompt: {
          type: 'string',
          description: 'System prompt',
          format: 'code',
        },
      },
      required: ['provider', 'model'],
    },
  },
  'ai.embedding': {
    type: 'ai.embedding',
    name: 'Generate Embedding',
    description: 'Generate text embeddings',
    category: 'ai',
    icon: 'database',
    inputs: [
      { name: 'text', type: 'string', required: true, description: 'Text to embed' },
    ],
    outputs: [
      { name: 'embedding', type: 'array', description: 'Embedding vector' },
    ],
    config: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          default: 'text-embedding-ada-002',
        },
      },
    },
  },

  // RAG (Retrieval-Augmented Generation) Nodes
  'ai.vector_store': {
    type: 'ai.vector_store',
    name: 'Vector Store',
    description: 'Store and query embeddings in vector database',
    category: 'ai',
    icon: 'database',
    inputs: [
      { name: 'embeddings', type: 'array', description: 'Embeddings to store' },
      { name: 'texts', type: 'array', description: 'Texts associated with embeddings' },
      { name: 'query', type: 'string', description: 'Query text for search' },
    ],
    outputs: [
      { name: 'results', type: 'array', description: 'Search results' },
      { name: 'ids', type: 'array', description: 'Stored document IDs' },
    ],
    config: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['pinecone', 'weaviate', 'chroma', 'memory', 'database'],
          default: 'memory',
          description: 'Vector database provider (database = PostgreSQL with persistence)',
        },
        operation: {
          type: 'string',
          enum: ['store', 'search', 'delete'],
          default: 'store',
          description: 'Operation type',
        },
        indexName: {
          type: 'string',
          description: 'Index/collection name',
        },
        apiKey: {
          type: 'string',
          description: 'API key (for Pinecone/Weaviate)',
          format: 'password',
        },
        topK: {
          type: 'number',
          default: 5,
          description: 'Number of results to return',
        },
      },
      required: ['provider', 'operation'],
    },
  },
  'ai.document_ingest': {
    type: 'ai.document_ingest',
    name: 'Document Ingestion',
    description: 'Process and chunk documents (PDF, DOCX, TXT)',
    category: 'ai',
    icon: 'file',
    inputs: [
      { name: 'file', type: 'string', description: 'File path or base64 content' },
      { name: 'text', type: 'string', description: 'Raw text content' },
    ],
    outputs: [
      { name: 'chunks', type: 'array', description: 'Text chunks' },
      { name: 'metadata', type: 'object', description: 'Document metadata' },
    ],
    config: {
      type: 'object',
      properties: {
        fileType: {
          type: 'string',
          enum: ['pdf', 'docx', 'txt', 'auto'],
          default: 'auto',
          description: 'File type',
        },
        chunkSize: {
          type: 'number',
          default: 1000,
          description: 'Chunk size in characters',
        },
        chunkOverlap: {
          type: 'number',
          default: 200,
          description: 'Overlap between chunks',
        },
        chunkStrategy: {
          type: 'string',
          enum: ['fixed', 'sentence', 'paragraph'],
          default: 'fixed',
          description: 'Chunking strategy',
        },
        preIngestHook: {
          type: 'string',
          description: 'Code agent ID for pre-ingest transformation (runs before document chunking)',
        },
      },
      required: ['chunkSize'],
    },
  },
  'ai.semantic_search': {
    type: 'ai.semantic_search',
    name: 'Semantic Search',
    description: 'Search vector database using semantic similarity',
    category: 'ai',
    icon: 'database',
    inputs: [
      { name: 'query', type: 'string', required: true, description: 'Search query' },
      { name: 'embedding', type: 'array', description: 'Query embedding (optional, will generate if not provided)' },
    ],
    outputs: [
      { name: 'results', type: 'array', description: 'Search results with similarity scores' },
      { name: 'count', type: 'number', description: 'Number of results' },
    ],
    config: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['pinecone', 'weaviate', 'chroma', 'memory', 'database'],
          default: 'memory',
          description: 'Vector database provider (database = PostgreSQL with persistence)',
        },
        indexName: {
          type: 'string',
          description: 'Index/collection name',
        },
        topK: {
          type: 'number',
          default: 5,
          description: 'Number of results',
        },
        minScore: {
          type: 'number',
          default: 0.7,
          description: 'Minimum similarity score',
        },
      },
      required: ['provider'],
    },
  },
  'ai.rag': {
    type: 'ai.rag',
    name: 'RAG Pipeline',
    description: 'Complete RAG workflow: search + generate',
    category: 'ai',
    icon: 'sparkles',
    inputs: [
      { name: 'query', type: 'string', required: true, description: 'User query' },
      { name: 'context', type: 'any', description: 'Additional context' },
    ],
    outputs: [
      { name: 'answer', type: 'string', description: 'Generated answer' },
      { name: 'sources', type: 'array', description: 'Source documents used' },
      { name: 'tokens', type: 'number', description: 'Tokens used' },
    ],
    config: {
      type: 'object',
      properties: {
        vectorStoreProvider: {
          type: 'string',
          enum: ['pinecone', 'weaviate', 'chroma', 'memory', 'database'],
          default: 'memory',
          description: 'Vector database provider (database = PostgreSQL with persistence)',
        },
        indexName: {
          type: 'string',
          description: 'Index/collection name',
        },
        llmProvider: {
          type: 'string',
          enum: ['openai', 'anthropic', 'google'],
          default: 'openai',
          description: 'LLM provider',
        },
        model: {
          type: 'string',
          default: 'gpt-3.5-turbo',
          description: 'LLM model',
        },
        topK: {
          type: 'number',
          default: 5,
          description: 'Number of documents to retrieve',
        },
        promptTemplate: {
          type: 'string',
          description: 'RAG prompt template',
          format: 'code',
          default: 'Use the following context to answer the question:\n\nContext:\n{{context}}\n\nQuestion: {{query}}\n\nAnswer:',
        },
        postAnswerHook: {
          type: 'string',
          description: 'Code agent ID for post-answer enhancement (runs after LLM generates answer)',
        },
      },
      required: ['vectorStoreProvider', 'llmProvider'],
    },
  },

  // Multimodal AI Nodes
  'ai.image_generate': {
    type: 'ai.image_generate',
    name: 'Generate Image',
    description: 'Generate images using DALL·E or Stable Diffusion',
    category: 'ai',
    icon: 'sparkles',
    inputs: [
      { name: 'prompt', type: 'string', required: true, description: 'Image generation prompt' },
    ],
    outputs: [
      { name: 'imageUrl', type: 'string', description: 'Generated image URL' },
      { name: 'imageBase64', type: 'string', description: 'Generated image as base64' },
    ],
    config: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['dalle', 'stable-diffusion'],
          default: 'dalle',
          description: 'Image generation provider',
        },
        model: {
          type: 'string',
          default: 'dall-e-3',
          description: 'Model name',
        },
        size: {
          type: 'string',
          enum: ['256x256', '512x512', '1024x1024', '1024x1792', '1792x1024'],
          default: '1024x1024',
          description: 'Image size',
        },
        quality: {
          type: 'string',
          enum: ['standard', 'hd'],
          default: 'standard',
          description: 'Image quality (DALL·E 3)',
        },
      },
      required: ['provider'],
    },
  },
  'ai.image_analyze': {
    type: 'ai.image_analyze',
    name: 'Analyze Image',
    description: 'Analyze images using Vision API or OCR',
    category: 'ai',
    icon: 'sparkles',
    inputs: [
      { name: 'imageUrl', type: 'string', description: 'Image URL' },
      { name: 'imageBase64', type: 'string', description: 'Image as base64' },
    ],
    outputs: [
      { name: 'description', type: 'string', description: 'Image description' },
      { name: 'text', type: 'string', description: 'Extracted text (OCR)' },
      { name: 'labels', type: 'array', description: 'Detected labels' },
    ],
    config: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['vision', 'ocr', 'both'],
          default: 'vision',
          description: 'Analysis type',
        },
        provider: {
          type: 'string',
          enum: ['google'],
          default: 'google',
          description: 'Vision API provider (Google Vision)',
        },
        prompt: {
          type: 'string',
          description: 'Analysis prompt (for vision)',
          default: 'Describe this image in detail.',
        },
      },
      required: ['operation', 'provider'],
    },
  },
  'ai.ocr': {
    type: 'ai.ocr',
    name: 'Extract Text (OCR)',
    description: 'Extract text from images, PDFs, or scanned documents',
    category: 'ai',
    icon: 'scan',
    inputs: [
      { name: 'imageUrl', type: 'string', description: 'Image URL to process', required: false },
      { name: 'imageBase64', type: 'string', description: 'Image as base64 data URI', required: false },
      { name: 'pdfUrl', type: 'string', description: 'PDF URL to process', required: false },
      { name: 'pdfBase64', type: 'string', description: 'PDF as base64 data URI', required: false },
      { name: 'file', type: 'string', description: 'File path or base64 content (auto-detect type)', required: false },
    ],
    outputs: [
      { name: 'text', type: 'string', description: 'Extracted plain text' },
      { name: 'structuredData', type: 'object', description: 'Structured data (tables, forms)' },
      { name: 'confidence', type: 'number', description: 'Overall confidence score (0-1)' },
      { name: 'metadata', type: 'object', description: 'OCR metadata (language, pages, processing time)' },
      { name: 'pages', type: 'array', description: 'Array of page results (for multi-page documents)' },
    ],
    config: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['paddle', 'easyocr', 'tesseract', 'google', 'docktr', 'nlweb', 'omniparser'],
          default: 'tesseract',
          description: 'OCR provider to use',
        },
        language: {
          type: 'string',
          description: 'Language code (e.g., eng, spa, fra, deu) or "auto" for auto-detection',
          default: 'eng',
        },
        extractTables: {
          type: 'boolean',
          description: 'Extract tables as structured data',
          default: false,
        },
        extractForms: {
          type: 'boolean',
          description: 'Extract form fields as key-value pairs',
          default: false,
        },
        preprocess: {
          type: 'boolean',
          description: 'Apply image preprocessing (deskew, denoise)',
          default: true,
        },
        apiKey: {
          type: 'string',
          description: 'API key for cloud providers (optional, can use env var)',
          default: '',
        },
      },
      required: ['provider'],
    },
  },
  'ai.audio_transcribe': {
    type: 'ai.audio_transcribe',
    name: 'Transcribe Audio',
    description: 'Convert speech to text using Whisper',
    category: 'ai',
    icon: 'sparkles',
    inputs: [
      { name: 'audioUrl', type: 'string', description: 'Audio file URL' },
      { name: 'audioBase64', type: 'string', description: 'Audio as base64' },
    ],
    outputs: [
      { name: 'text', type: 'string', description: 'Transcribed text' },
      { name: 'language', type: 'string', description: 'Detected language' },
      { name: 'segments', type: 'array', description: 'Transcription segments' },
    ],
    config: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['openai', 'local'],
          default: 'openai',
          description: 'Transcription provider',
        },
        model: {
          type: 'string',
          default: 'whisper-1',
          description: 'Whisper model',
        },
        language: {
          type: 'string',
          description: 'Language code (optional, auto-detect if not provided)',
        },
        responseFormat: {
          type: 'string',
          enum: ['json', 'text', 'srt', 'verbose_json'],
          default: 'text',
          description: 'Response format',
        },
      },
      required: ['provider'],
    },
  },
  'ai.agent': {
    type: 'ai.agent',
    name: 'AI Agent',
    description: 'Autonomous AI agent with reasoning, planning, and tool use capabilities',
    category: 'ai',
    icon: 'sparkles',
    inputs: [
      { name: 'query', type: 'string', required: true, description: 'Task or query for the agent' },
      { name: 'input', type: 'any', description: 'Additional input data' },
      { name: 'context', type: 'any', description: 'Execution context' },
    ],
    outputs: [
      { name: 'output', type: 'string', description: 'Agent response' },
      { name: 'intermediateSteps', type: 'array', description: 'Intermediate reasoning steps' },
      { name: 'tokensUsed', type: 'number', description: 'Tokens consumed' },
      { name: 'cost', type: 'number', description: 'Execution cost' },
    ],
    config: {
      type: 'object',
      properties: {
        agentType: {
          type: 'string',
          enum: ['auto', 'one-shot', 'recursive', 'multi-role', 'collaborative'],
          default: 'auto',
          description: 'Agent framework (auto = intelligent routing)',
        },
        provider: {
          type: 'string',
          enum: ['openai', 'anthropic'],
          default: 'openai',
          description: 'LLM provider',
        },
        model: {
          type: 'string',
          enum: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3-5-sonnet'],
          default: 'gpt-4',
          description: 'Model name',
        },
        temperature: {
          type: 'number',
          default: 0.7,
          description: 'Temperature (0-2), controls randomness',
        },
        maxIterations: {
          type: 'number',
          default: 15,
          description: 'Maximum agent iterations',
        },
        tools: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['calculator', 'wikipedia', 'serpapi', 'duckduckgo', 'brave', 'execute_code'],
          },
          description: 'Tools available to the agent',
        },
        memoryType: {
          type: 'string',
          enum: ['buffer', 'summary', 'none'],
          default: 'buffer',
          description: 'Memory type for conversation context',
        },
        useRouting: {
          type: 'boolean',
          default: true,
          description: 'Use intelligent framework routing (when agentType is auto)',
        },
        systemPrompt: {
          type: 'string',
          description: 'System prompt for the agent',
          default: '',
        },
        selectedAgent: {
          type: 'string',
          description: 'Select a pre-configured agent (optional - if not set, agent will be created with above settings)',
          default: '',
        },
      },
      required: ['provider', 'model'],
    },
  },
  'ai.text_to_speech': {
    type: 'ai.text_to_speech',
    name: 'Text to Speech',
    description: 'Convert text to speech',
    category: 'ai',
    icon: 'sparkles',
    inputs: [
      { name: 'text', type: 'string', required: true, description: 'Text to convert' },
    ],
    outputs: [
      { name: 'audioUrl', type: 'string', description: 'Generated audio URL' },
      { name: 'audioBase64', type: 'string', description: 'Audio as base64' },
    ],
    config: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['openai', 'elevenlabs', 'coqui'],
          default: 'openai',
          description: 'TTS provider',
        },
        voice: {
          type: 'string',
          default: 'alloy',
          description: 'Voice ID',
        },
        model: {
          type: 'string',
          default: 'tts-1',
          description: 'TTS model',
        },
        speed: {
          type: 'number',
          default: 1.0,
          description: 'Speech speed (0.25-4.0)',
        },
      },
      required: ['provider'],
    },
  },

  // Data & Storage Nodes
  'data.database': {
    type: 'data.database',
    name: 'Database Query',
    description: 'Execute SQL query on PostgreSQL, MySQL, or MongoDB',
    category: 'data',
    icon: 'database',
    inputs: [
      { name: 'query', type: 'string', description: 'SQL query (optional, can use config)' },
      { name: 'params', type: 'object', description: 'Query parameters' },
    ],
    outputs: [
      { name: 'results', type: 'array', description: 'Query results' },
      { name: 'rowCount', type: 'number', description: 'Number of rows returned' },
    ],
    config: {
      type: 'object',
      properties: {
        databaseType: {
          type: 'string',
          enum: ['postgresql', 'mysql', 'mongodb'],
          default: 'postgresql',
          description: 'Database type',
        },
        connectionString: {
          type: 'string',
          description: 'Database connection string (or use environment variable)',
          format: 'password',
        },
        query: {
          type: 'string',
          description: 'SQL query to execute',
          format: 'code',
          default: 'SELECT * FROM table LIMIT 10',
        },
        operation: {
          type: 'string',
          enum: ['query', 'insert', 'update', 'delete'],
          default: 'query',
          description: 'Operation type',
        },
      },
      required: ['databaseType', 'query'],
    },
  },
  'data.file': {
    type: 'data.file',
    name: 'File Operations',
    description: 'Read, write, or list files',
    category: 'data',
    icon: 'file',
    inputs: [
      { name: 'path', type: 'string', description: 'File path (optional, can use config)' },
      { name: 'content', type: 'string', description: 'File content (for write operations)' },
    ],
    outputs: [
      { name: 'content', type: 'string', description: 'File content (for read operations)' },
      { name: 'files', type: 'array', description: 'List of files (for list operations)' },
      { name: 'success', type: 'boolean', description: 'Operation success' },
      { name: 'ocrText', type: 'string', description: 'Extracted text from OCR (if OCR enabled)' },
      { name: 'ocrConfidence', type: 'number', description: 'OCR confidence score (if OCR enabled)' },
      { name: 'ocrMetadata', type: 'object', description: 'OCR metadata (if OCR enabled)' },
      { name: 'ocrStructuredData', type: 'object', description: 'OCR structured data (tables/forms, if OCR enabled)' },
    ],
    config: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['read', 'write', 'list', 'delete'],
          default: 'read',
          description: 'File operation type',
        },
        path: {
          type: 'string',
          description: 'File or directory path',
          default: '/path/to/file',
        },
        encoding: {
          type: 'string',
          enum: ['utf8', 'base64', 'binary'],
          default: 'utf8',
          description: 'File encoding',
        },
        ocr: {
          type: 'boolean',
          default: false,
          description: 'Enable OCR for images and PDFs (read operation only)',
        },
        ocrProvider: {
          type: 'string',
          enum: ['tesseract', 'google', 'aws', 'azure', 'openai'],
          default: 'tesseract',
          description: 'OCR provider to use (if OCR enabled)',
        },
        ocrLanguage: {
          type: 'string',
          default: 'auto',
          description: 'Language code or "auto" for auto-detection (if OCR enabled)',
        },
        ocrPreprocess: {
          type: 'boolean',
          default: true,
          description: 'Apply image preprocessing (if OCR enabled)',
        },
        ocrExtractTables: {
          type: 'boolean',
          default: false,
          description: 'Extract tables as structured data (AWS Textract only)',
        },
        ocrExtractForms: {
          type: 'boolean',
          default: false,
          description: 'Extract form fields (AWS Textract only)',
        },
      },
      required: ['operation', 'path'],
    },
  },
  'data.csv': {
    type: 'data.csv',
    name: 'CSV/Excel',
    description: 'Process CSV or Excel files',
    category: 'data',
    icon: 'file',
    inputs: [
      { name: 'data', type: 'string', description: 'CSV/Excel data or file path' },
    ],
    outputs: [
      { name: 'rows', type: 'array', description: 'Parsed rows as objects' },
      { name: 'headers', type: 'array', description: 'Column headers' },
      { name: 'csv', type: 'string', description: 'CSV output (for conversion)' },
    ],
    config: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['parse', 'stringify', 'convert'],
          default: 'parse',
          description: 'Operation type',
        },
        delimiter: {
          type: 'string',
          default: ',',
          description: 'CSV delimiter',
        },
        hasHeaders: {
          type: 'boolean',
          default: true,
          description: 'First row contains headers',
        },
      },
      required: ['operation'],
    },
  },
  'data.json': {
    type: 'data.json',
    name: 'JSON Transform',
    description: 'Advanced JSON manipulation and transformation',
    category: 'data',
    icon: 'code',
    inputs: [
      { name: 'data', type: 'any', description: 'Input JSON data' },
    ],
    outputs: [
      { name: 'output', type: 'any', description: 'Transformed JSON data' },
    ],
    config: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['transform', 'merge', 'filter', 'map', 'flatten', 'unflatten'],
          default: 'transform',
          description: 'Transformation operation',
        },
        transformCode: {
          type: 'string',
          description: 'JavaScript transformation code',
          format: 'code',
          default: 'return input;',
        },
        path: {
          type: 'string',
          description: 'JSONPath expression (for filter/map)',
          default: '$',
        },
      },
      required: ['operation'],
    },
  },

  // Communication Nodes
  'communication.email': {
    type: 'communication.email',
    name: 'Send Email (Resend)',
    description: 'Send email via Resend API',
    category: 'communication',
    icon: 'mail',
    inputs: [
      { name: 'to', type: 'string', description: 'Recipient email (optional, can use config)' },
      { name: 'subject', type: 'string', description: 'Email subject' },
      { name: 'body', type: 'string', description: 'Email body (HTML or plain text)' },
      { name: 'html', type: 'string', description: 'HTML email body' },
      { name: 'text', type: 'string', description: 'Plain text email body' },
    ],
    outputs: [
      { name: 'messageId', type: 'string', description: 'Email message ID' },
      { name: 'success', type: 'boolean', description: 'Send success' },
      { name: 'to', type: 'array', description: 'Recipient email addresses' },
      { name: 'from', type: 'string', description: 'Sender email address' },
      { name: 'subject', type: 'string', description: 'Email subject' },
    ],
    config: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['resend', 'smtp', 'sendgrid', 'ses'],
          default: 'resend',
          description: 'Email provider (Resend recommended)',
        },
        to: {
          type: 'string',
          description: 'Recipient email address (comma-separated for multiple)',
        },
        subject: {
          type: 'string',
          description: 'Email subject',
        },
        body: {
          type: 'string',
          description: 'Email body (HTML or plain text)',
          format: 'code',
        },
        html: {
          type: 'string',
          description: 'HTML email body (alternative to body)',
          format: 'code',
        },
        text: {
          type: 'string',
          description: 'Plain text email body (alternative to body)',
        },
        from: {
          type: 'string',
          description: 'Sender email address (defaults to RESEND_FROM_EMAIL env var)',
        },
        cc: {
          type: 'string',
          description: 'CC email addresses (comma-separated)',
        },
        bcc: {
          type: 'string',
          description: 'BCC email addresses (comma-separated)',
        },
        replyTo: {
          type: 'string',
          description: 'Reply-to email address',
        },
      },
      required: ['to', 'subject'],
    },
  },
  'communication.slack': {
    type: 'communication.slack',
    name: 'Slack',
    description: 'Send messages to Slack channels',
    category: 'communication',
    icon: 'webhook',
    inputs: [
      { name: 'message', type: 'string', description: 'Message text' },
      { name: 'channel', type: 'string', description: 'Channel ID or name' },
    ],
    outputs: [
      { name: 'ts', type: 'string', description: 'Message timestamp' },
      { name: 'success', type: 'boolean', description: 'Send success' },
    ],
    config: {
      type: 'object',
      properties: {
        webhookUrl: {
          type: 'string',
          description: 'Slack webhook URL',
          format: 'password',
        },
        channel: {
          type: 'string',
          description: 'Channel ID or name',
        },
        username: {
          type: 'string',
          description: 'Bot username',
        },
        iconEmoji: {
          type: 'string',
          description: 'Bot icon emoji',
        },
      },
      required: ['webhookUrl'],
    },
  },
  'communication.discord': {
    type: 'communication.discord',
    name: 'Discord',
    description: 'Send messages to Discord channels',
    category: 'communication',
    icon: 'webhook',
    inputs: [
      { name: 'message', type: 'string', description: 'Message text' },
    ],
    outputs: [
      { name: 'id', type: 'string', description: 'Message ID' },
      { name: 'success', type: 'boolean', description: 'Send success' },
    ],
    config: {
      type: 'object',
      properties: {
        webhookUrl: {
          type: 'string',
          description: 'Discord webhook URL',
          format: 'password',
        },
        username: {
          type: 'string',
          description: 'Webhook username',
        },
        avatarUrl: {
          type: 'string',
          description: 'Webhook avatar URL',
        },
      },
      required: ['webhookUrl'],
    },
  },
  'communication.sms': {
    type: 'communication.sms',
    name: 'SMS',
    description: 'Send SMS via Twilio or other providers',
    category: 'communication',
    icon: 'webhook',
    inputs: [
      { name: 'to', type: 'string', description: 'Recipient phone number' },
      { name: 'message', type: 'string', description: 'SMS message' },
    ],
    outputs: [
      { name: 'sid', type: 'string', description: 'Message SID' },
      { name: 'success', type: 'boolean', description: 'Send success' },
    ],
    config: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['twilio', 'vonage', 'aws-sns'],
          default: 'twilio',
          description: 'SMS provider',
        },
        accountSid: {
          type: 'string',
          description: 'Account SID (Twilio)',
          format: 'password',
        },
        authToken: {
          type: 'string',
          description: 'Auth token',
          format: 'password',
        },
        from: {
          type: 'string',
          description: 'Sender phone number',
        },
        to: {
          type: 'string',
          description: 'Recipient phone number',
        },
      },
      required: ['provider'],
    },
  },

  // Integration Nodes
  'integration.google_sheets': {
    type: 'integration.google_sheets',
    name: 'Google Sheets',
    description: 'Read or write Google Sheets data',
    category: 'integration',
    icon: 'file',
    inputs: [
      { name: 'range', type: 'string', description: 'Sheet range (e.g., A1:B10)' },
      { name: 'values', type: 'array', description: 'Values to write (for write operations)' },
    ],
    outputs: [
      { name: 'values', type: 'array', description: 'Sheet values (for read operations)' },
      { name: 'success', type: 'boolean', description: 'Operation success' },
    ],
    config: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['read', 'write', 'append'],
          default: 'read',
          description: 'Operation type',
        },
        spreadsheetId: {
          type: 'string',
          description: 'Google Sheets spreadsheet ID',
        },
        sheetName: {
          type: 'string',
          description: 'Sheet name or ID',
        },
        range: {
          type: 'string',
          description: 'Cell range (e.g., A1:B10)',
        },
        credentials: {
          type: 'string',
          description: 'Google service account JSON (or use environment variable)',
          format: 'code',
        },
      },
      required: ['spreadsheetId', 'operation'],
    },
  },
  'integration.airtable': {
    type: 'integration.airtable',
    name: 'Airtable',
    description: 'Read or write Airtable records',
    category: 'integration',
    icon: 'database',
    inputs: [
      { name: 'records', type: 'array', description: 'Records to create/update' },
    ],
    outputs: [
      { name: 'records', type: 'array', description: 'Retrieved records' },
      { name: 'success', type: 'boolean', description: 'Operation success' },
    ],
    config: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['list', 'get', 'create', 'update', 'delete'],
          default: 'list',
          description: 'Operation type',
        },
        baseId: {
          type: 'string',
          description: 'Airtable base ID',
        },
        tableName: {
          type: 'string',
          description: 'Table name',
        },
        apiKey: {
          type: 'string',
          description: 'Airtable API key',
          format: 'password',
        },
        recordId: {
          type: 'string',
          description: 'Record ID (for get/update/delete)',
        },
      },
      required: ['baseId', 'tableName', 'apiKey'],
    },
  },
  'integration.notion': {
    type: 'integration.notion',
    name: 'Notion',
    description: 'Read or write Notion pages and databases',
    category: 'integration',
    icon: 'file',
    inputs: [
      { name: 'content', type: 'object', description: 'Page content (for write operations)' },
    ],
    outputs: [
      { name: 'page', type: 'object', description: 'Notion page data' },
      { name: 'success', type: 'boolean', description: 'Operation success' },
    ],
    config: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['read', 'create', 'update'],
          default: 'read',
          description: 'Operation type',
        },
        pageId: {
          type: 'string',
          description: 'Notion page ID',
        },
        databaseId: {
          type: 'string',
          description: 'Notion database ID',
        },
        apiKey: {
          type: 'string',
          description: 'Notion API key',
          format: 'password',
        },
      },
      required: ['apiKey'],
    },
  },
  'integration.zapier': {
    type: 'integration.zapier',
    name: 'Zapier Webhook',
    description: 'Trigger Zapier webhooks',
    category: 'integration',
    icon: 'webhook',
    inputs: [
      { name: 'data', type: 'object', description: 'Data to send to Zapier' },
    ],
    outputs: [
      { name: 'response', type: 'object', description: 'Zapier webhook response' },
      { name: 'success', type: 'boolean', description: 'Trigger success' },
    ],
    config: {
      type: 'object',
      properties: {
        webhookUrl: {
          type: 'string',
          description: 'Zapier webhook URL',
          format: 'password',
        },
        method: {
          type: 'string',
          enum: ['POST', 'GET', 'PUT'],
          default: 'POST',
          description: 'HTTP method',
        },
      },
      required: ['webhookUrl'],
    },
  },

  // OSINT (Open Source Intelligence) Nodes
  'osint.search': {
    type: 'osint.search',
    name: 'Social Media Search',
    description: 'Search social media, news, forums, and web sources',
    category: 'osint',
    icon: 'search',
    inputs: [
      { name: 'keywords', type: 'array', description: 'Search keywords' },
      { name: 'source', type: 'string', description: 'Source type (twitter, reddit, news, etc.)' },
    ],
    outputs: [
      { name: 'results', type: 'array', description: 'Search results' },
      { name: 'count', type: 'number', description: 'Number of results' },
    ],
    config: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          enum: ['twitter', 'reddit', 'news', 'forums', 'github', 'linkedin', 'youtube', 'web'],
          default: 'web',
          description: 'Source to search',
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Keywords to search for',
          default: [],
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 10,
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['source', 'keywords'],
    },
  },
  'osint.monitor': {
    type: 'osint.monitor',
    name: 'Social Media Monitor',
    description: 'Trigger data collection for an OSINT monitor',
    category: 'osint',
    icon: 'eye',
    inputs: [
      { name: 'monitorId', type: 'string', description: 'Monitor ID' },
    ],
    outputs: [
      { name: 'status', type: 'string', description: 'Collection status' },
      { name: 'monitor', type: 'object', description: 'Monitor details' },
    ],
    config: {
      type: 'object',
      properties: {
        monitorId: {
          type: 'string',
          description: 'OSINT monitor ID',
          required: true,
        },
      },
      required: ['monitorId'],
    },
  },
  'osint.get_results': {
    type: 'osint.get_results',
    name: 'Get Social Media Results',
    description: 'Retrieve collected results from an OSINT monitor',
    category: 'osint',
    icon: 'database',
    inputs: [
      { name: 'monitorId', type: 'string', description: 'Monitor ID' },
    ],
    outputs: [
      { name: 'results', type: 'array', description: 'Collected results' },
      { name: 'count', type: 'number', description: 'Number of results' },
    ],
    config: {
      type: 'object',
      properties: {
        monitorId: {
          type: 'string',
          description: 'OSINT monitor ID',
          required: true,
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to retrieve',
          default: 10,
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['monitorId'],
    },
  },

  // Logic Nodes
  'logic.if': {
    type: 'logic.if',
    name: 'IF/ELSE',
    description: 'Conditional branching based on a condition',
    category: 'logic',
    icon: 'git-branch',
    inputs: [
      { name: 'input', type: 'any', description: 'Input data to evaluate' },
    ],
    outputs: [
      { name: 'true', type: 'any', description: 'Output when condition is true' },
      { name: 'false', type: 'any', description: 'Output when condition is false' },
    ],
    config: {
      type: 'object',
      properties: {
        condition: {
          type: 'string',
          description: 'JavaScript condition expression (e.g., input.value > 10)',
          default: 'input',
          format: 'code',
        },
      },
      required: ['condition'],
    },
  },
  'logic.switch': {
    type: 'logic.switch',
    name: 'Switch',
    description: 'Multi-way branching based on a value',
    category: 'logic',
    icon: 'git-branch',
    inputs: [
      { name: 'input', type: 'any', description: 'Input value to match' },
    ],
    outputs: [
      { name: 'default', type: 'any', description: 'Default output' },
    ],
    config: {
      type: 'object',
      properties: {
        cases: {
          type: 'array',
          description: 'Array of case objects with value and output',
          default: [],
        },
        defaultCase: {
          type: 'string',
          description: 'Default case output name',
          default: 'default',
        },
      },
    },
  },
  'logic.loop.for': {
    type: 'logic.loop.for',
    name: 'FOR Loop',
    description: 'Loop a fixed number of times',
    category: 'logic',
    icon: 'repeat',
    inputs: [
      { name: 'input', type: 'any', description: 'Input data' },
    ],
    outputs: [
      { name: 'output', type: 'array', description: 'Array of loop outputs' },
      { name: 'item', type: 'any', description: 'Current iteration item' },
      { name: 'index', type: 'number', description: 'Current iteration index' },
    ],
    config: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: 'Number of iterations',
          default: 10,
        },
        startIndex: {
          type: 'number',
          description: 'Starting index',
          default: 0,
        },
      },
      required: ['count'],
    },
  },
  'logic.loop.while': {
    type: 'logic.loop.while',
    name: 'WHILE Loop',
    description: 'Loop while condition is true',
    category: 'logic',
    icon: 'repeat',
    inputs: [
      { name: 'input', type: 'any', description: 'Input data' },
    ],
    outputs: [
      { name: 'output', type: 'array', description: 'Array of loop outputs' },
      { name: 'item', type: 'any', description: 'Current iteration item' },
    ],
    config: {
      type: 'object',
      properties: {
        condition: {
          type: 'string',
          description: 'JavaScript condition expression that returns a boolean. Use "input" to access the current input data. Example: "input.count < 10" or "input.status === \'active\'"',
          default: 'true',
          format: 'code',
        },
        maxIterations: {
          type: 'number',
          description: 'Maximum iterations to prevent infinite loops',
          default: 1000,
        },
      },
      required: ['condition'],
    },
  },
  'logic.loop.foreach': {
    type: 'logic.loop.foreach',
    name: 'FOREACH Loop',
    description: 'Loop over an array',
    category: 'logic',
    icon: 'repeat',
    inputs: [
      { name: 'input', type: 'array', required: true, description: 'Array to iterate over' },
    ],
    outputs: [
      { name: 'output', type: 'array', description: 'Array of loop outputs' },
      { name: 'item', type: 'any', description: 'Current array item' },
      { name: 'index', type: 'number', description: 'Current array index' },
    ],
    config: {
      type: 'object',
      properties: {
        arrayPath: {
          type: 'string',
          description: 'Path to array in input (e.g., "input.items")',
          default: 'input',
        },
      },
    },
  },
  'logic.merge': {
    type: 'logic.merge',
    name: 'Merge',
    description: 'Merge multiple execution paths into one',
    category: 'logic',
    icon: 'git-merge',
    inputs: [
      { name: 'input1', type: 'any', description: 'First input' },
      { name: 'input2', type: 'any', description: 'Second input' },
    ],
    outputs: [
      { name: 'output', type: 'object', description: 'Merged output' },
    ],
    config: {
      type: 'object',
      properties: {
        mergeStrategy: {
          type: 'string',
          enum: ['all', 'first', 'last', 'array'],
          description: 'How to merge inputs',
          default: 'all',
        },
      },
    },
  },
  'logic.human_prompt': {
    type: 'logic.human_prompt',
    name: 'Human Prompt',
    description: 'Pause execution and wait for human input',
    category: 'logic',
    icon: 'user',
    inputs: [
      { name: 'input', type: 'object', description: 'Input data' },
    ],
    outputs: [
      { name: 'response', type: 'object', description: 'Human response' },
    ],
    config: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Prompt message to display to user',
          required: true,
        },
        inputSchema: {
          type: 'object',
          description: 'JSON Schema for input fields',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 3600000 = 1 hour)',
          default: 3600000,
        },
      },
      required: ['prompt'],
    },
  },
  'logic.wait': {
    type: 'logic.wait',
    name: 'Wait',
    description: 'Wait for a specified duration',
    category: 'logic',
    icon: 'clock',
    inputs: [
      { name: 'input', type: 'any', description: 'Input data' },
    ],
    outputs: [
      { name: 'output', type: 'any', description: 'Input data (passed through after wait)' },
    ],
    config: {
      type: 'object',
      properties: {
        duration: {
          type: 'number',
          description: 'Wait duration in milliseconds',
          default: 1000,
        },
      },
      required: ['duration'],
    },
  },
  'logic.error_catch': {
    type: 'logic.error_catch',
    name: 'Error Catch',
    description: 'Catch and handle errors from previous nodes',
    category: 'logic',
    icon: 'git-branch',
    inputs: [
      { name: 'error', type: 'object', required: true, description: 'Error information from failed node' },
    ],
    outputs: [
      { name: 'output', type: 'object', description: 'Error handling output' },
    ],
    config: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['pass', 'transform', 'suppress'],
          description: 'How to handle the error',
          default: 'pass',
        },
        transform: {
          type: 'object',
          description: 'Transform configuration (when action is "transform")',
          properties: {
            output: {
              type: 'object',
              description: 'Output to return when transforming error',
            },
          },
        },
      },
    },
  },
};

// Dynamic connector nodes cache (populated by NodePalette)
let dynamicConnectorNodes: Record<string, NodeDefinition> = {};

export const registerConnectorNode = (nodeDef: NodeDefinition): void => {
  dynamicConnectorNodes[nodeDef.type] = nodeDef;
};

export const getNodeDefinition = (type: string): NodeDefinition | undefined => {
  // Check dynamic connector nodes first, then static registry
  return dynamicConnectorNodes[type] || nodeRegistry[type];
};

export const getNodesByCategory = (category: string): NodeDefinition[] => {
  return Object.values(nodeRegistry).filter((node) => node.category === category);
};

export const getAllNodes = (): NodeDefinition[] => {
  return Object.values(nodeRegistry);
};

