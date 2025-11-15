import { DynamicStructuredTool, DynamicTool } from "@langchain/core/tools";
import { z } from "zod";

// Dynamic imports for tools to handle optional dependencies
let Calculator: any = null;
let SerpAPI: any = null;
let WikipediaQueryRun: any = null;
let DuckDuckGoSearch: any = null;
let BraveSearch: any = null;

try {
  const calc = require("@langchain/community/tools/calculator");
  Calculator = calc.Calculator || calc.default?.Calculator;
} catch (error) {
  // Calculator not available
}

try {
  const serp = require("@langchain/community/tools/serpapi");
  SerpAPI = serp.SerpAPI || serp.default?.SerpAPI;
} catch (error) {
  // SerpAPI not available
}

try {
  const wiki = require("@langchain/community/tools/wikipedia_query_run");
  WikipediaQueryRun = wiki.WikipediaQueryRun || wiki.default?.WikipediaQueryRun;
} catch (error) {
  // Wikipedia not available
}

try {
  const ddg = require("@langchain/community/tools/duckduckgo_search");
  DuckDuckGoSearch = ddg.DuckDuckGoSearch || ddg.default?.DuckDuckGoSearch;
} catch (error) {
  // DuckDuckGo not available
}

try {
  const brave = require("@langchain/community/tools/brave_search");
  BraveSearch = brave.BraveSearch || brave.default?.BraveSearch;
} catch (error) {
  // Brave Search not available
}

/**
 * LangChain Tools Service
 * 
 * Provides access to LangChain's ecosystem of tools:
 * - Calculator
 * - Web Search (SerpAPI, DuckDuckGo, Brave)
 * - Wikipedia
 * - Custom tools
 */

export interface ToolConfig {
  name: string;
  description: string;
  type: 'calculator' | 'web_search' | 'wikipedia' | 'custom';
  provider?: 'serpapi' | 'duckduckgo' | 'brave';
  apiKey?: string;
  schema?: z.ZodObject<any>;
  handler?: (input: any) => Promise<string>;
}

export class LangToolsService {
  private tools: Map<string, DynamicTool | DynamicStructuredTool> = new Map();

  constructor() {
    // Initialize built-in tools
    this.initializeBuiltInTools();
    // Register code execution tool for agents
    this.registerCodeExecutionTool();
  }

  /**
   * Initialize built-in tools
   */
  private initializeBuiltInTools(): void {
    // Calculator tool
    if (Calculator) {
      try {
        const calculator = new Calculator();
        this.tools.set('calculator', calculator);
      } catch (error) {
        console.warn('Calculator tool not available:', error);
      }
    }

    // Wikipedia tool
    if (WikipediaQueryRun) {
      try {
        const wikipedia = new WikipediaQueryRun({
          topKResults: 3,
          maxDocContentLength: 4000,
        });
        this.tools.set('wikipedia', wikipedia);
      } catch (error) {
        console.warn('Wikipedia tool not available:', error);
      }
    }

    // Web search tools (if API keys are available)
    if (SerpAPI && process.env.SERPAPI_API_KEY) {
      try {
        const serpapi = new SerpAPI(process.env.SERPAPI_API_KEY);
        this.tools.set('serpapi_search', serpapi);
      } catch (error) {
        console.warn('SerpAPI tool not available:', error);
      }
    }

    if (DuckDuckGoSearch) {
      try {
        const duckduckgo = new DuckDuckGoSearch();
        this.tools.set('duckduckgo_search', duckduckgo);
      } catch (error) {
        console.warn('DuckDuckGo tool not available:', error);
      }
    }

    if (BraveSearch && process.env.BRAVE_API_KEY) {
      try {
        const brave = new BraveSearch({
          apiKey: process.env.BRAVE_API_KEY,
        });
        this.tools.set('brave_search', brave);
      } catch (error) {
        console.warn('Brave Search tool not available:', error);
      }
    }
  }

  /**
   * Register a custom tool
   */
  registerTool(config: ToolConfig): void {
    if (config.type === 'custom' && config.handler) {
      if (config.schema) {
        // Structured tool with schema
        const tool = new DynamicStructuredTool({
          name: config.name,
          description: config.description,
          schema: config.schema,
          func: async (input: any) => {
            return await config.handler!(input);
          },
        });
        this.tools.set(config.name, tool);
      } else {
        // Simple tool without schema
        const tool = new DynamicTool({
          name: config.name,
          description: config.description,
          func: async (input: string) => {
            return await config.handler!(input);
          },
        });
        this.tools.set(config.name, tool);
      }
    } else {
      // Use built-in tool
      this.initializeTool(config);
    }
  }

  /**
   * Initialize a tool from config
   */
  private initializeTool(config: ToolConfig): void {
    switch (config.type) {
      case 'calculator':
        if (!this.tools.has('calculator') && Calculator) {
          const calculator = new Calculator();
          this.tools.set('calculator', calculator);
        }
        break;

      case 'wikipedia':
        if (!this.tools.has('wikipedia') && WikipediaQueryRun) {
          const wikipedia = new WikipediaQueryRun({
            topKResults: config.schema ? 5 : 3,
            maxDocContentLength: 4000,
          });
          this.tools.set('wikipedia', wikipedia);
        }
        break;

      case 'web_search':
        if (config.provider === 'serpapi' && config.apiKey && SerpAPI) {
          try {
            const serpapi = new SerpAPI(config.apiKey);
            this.tools.set('serpapi_search', serpapi);
          } catch (error) {
            console.warn('Failed to initialize SerpAPI:', error);
          }
        } else if (config.provider === 'duckduckgo' && DuckDuckGoSearch) {
          try {
            const duckduckgo = new DuckDuckGoSearch();
            this.tools.set('duckduckgo_search', duckduckgo);
          } catch (error) {
            console.warn('Failed to initialize DuckDuckGo:', error);
          }
        } else if (config.provider === 'brave' && config.apiKey && BraveSearch) {
          try {
            const brave = new BraveSearch({
              apiKey: config.apiKey,
            });
            this.tools.set('brave_search', brave);
          } catch (error) {
            console.warn('Failed to initialize Brave Search:', error);
          }
        }
        break;
    }
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): DynamicTool | DynamicStructuredTool | null {
    return this.tools.get(name) || null;
  }

  /**
   * Get all available tools
   */
  getAllTools(): Array<DynamicTool | DynamicStructuredTool> {
    return Array.from(this.tools.values());
  }

  /**
   * Get all tools as a Map (for agent service)
   */
  getAllToolsMap(): Map<string, DynamicTool | DynamicStructuredTool> {
    return new Map(this.tools);
  }

  /**
   * Get tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Execute a tool
   */
  async executeTool(name: string, input: any): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    try {
      const result = await tool.invoke(input);
      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (error: any) {
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }

  /**
   * Create a tool node executor for workflows
   */
  createToolExecutor() {
    return async (toolName: string, input: any): Promise<string> => {
      return await this.executeTool(toolName, input);
    };
  }

  /**
   * Register code execution tool for agents
   * This allows agents to write and execute code autonomously
   */
  registerCodeExecutionTool(): void {
    this.registerTool({
      name: 'execute_code',
      description: 'Execute JavaScript, Python, TypeScript, or Bash code. Use this to write and run custom logic, perform calculations, transform data, or execute shell commands. The code runs in a secure sandbox.',
      type: 'custom',
      schema: z.object({
        language: z.enum(['javascript', 'python', 'typescript', 'bash']).describe('Programming language to use'),
        code: z.string().describe('The code to execute'),
        packages: z.array(z.string()).optional().describe('Python packages to install (for Python only)'),
        input: z.any().optional().describe('Input data for the code (accessible as "input" variable)'),
      }),
      handler: async ({ language, code, packages, input }, toolContext?: { tokensUsed?: number; agentId?: string }) => {
        // Import code execution service
        const { executeCode } = await import('./nodeExecutors/code');
        
        // Create execution context
        const context = {
          input: input || {},
          config: {
            code,
            packages: packages || [],
            timeout: 30000,
            runtime: 'vm2', // Default runtime, could be enhanced with routing
            codeAgentId: toolContext?.agentId, // Track which agent called this
          },
          workflowId: 'agent-execution',
          nodeId: 'code-tool',
        };

        // Execute code
        const result = await executeCode(context, language);

        // If tokens were used to generate this code (from agent context), track them
        if (toolContext?.tokensUsed && result.success) {
          // Add token usage to result metadata for tracking
          (result as any).metadata = {
            ...(result as any).metadata,
            tokensUsed: toolContext.tokensUsed,
            aiGenerated: true,
          };
        }

        if (!result.success) {
          return `Error executing code: ${result.error?.message || 'Unknown error'}`;
        }

        return JSON.stringify(result.output?.output || result.output);
      },
    });
  }
}

export const langtoolsService = new LangToolsService();

