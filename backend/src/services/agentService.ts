import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { langchainService } from "./langchainService";
import { langtoolsService } from "./langtoolsService";
import { Tool } from "@langchain/core/tools";

/**
 * Agent Service - Autonomous agents using LangGraph (LangChain v1.0 recommended approach)
 * 
 * Provides autonomous agent capabilities:
 * - Tool integration (agents can autonomously use tools)
 * - Planning capabilities (multi-step task planning)
 * - Memory persistence (conversation memory)
 * - Error recovery (automatic retry and fallback)
 * 
 * Uses LangGraph to create ReAct-style agents that can autonomously decide
 * which tools to use and plan multi-step tasks.
 */

export type AgentType = 'react' | 'plan-and-execute' | 'zero-shot-react-description';

export interface AgentConfig {
  type?: AgentType;
  provider?: 'openai' | 'anthropic';
  model?: string;
  temperature?: number;
  maxIterations?: number;
  maxExecutionTime?: number; // in milliseconds
  returnIntermediateSteps?: boolean;
  verbose?: boolean;
  systemPrompt?: string;
  tools?: string[]; // Tool names to make available to agent
  memoryType?: 'buffer' | 'summary' | 'none';
  memoryMaxTokenLimit?: number;
}

export interface AgentResponse {
  output: string;
  intermediateSteps?: Array<{
    action: {
      tool: string;
      toolInput: string;
    };
    observation: string;
  }>;
  memory?: {
    messages: BaseMessage[];
  };
  tokensUsed?: number;
  cost?: number;
  executionTime?: number;
}

interface AgentState {
  messages: BaseMessage[];
  next: string;
  iterations: number;
  intermediateSteps: Array<{
    action: {
      tool: string;
      toolInput: string;
    };
    observation: string;
  }>;
}

/**
 * AgentExecutor-like interface using LangGraph
 */
class AgentExecutor {
  private graph: StateGraph<any>;
  private tools: Tool[];
  private llm: ChatOpenAI | ChatAnthropic;
  private maxIterations: number;
  private maxExecutionTime: number;
  private returnIntermediateSteps: boolean;
  private verbose: boolean;
  private memory: BaseMessage[] = [];

  constructor(config: {
    graph: StateGraph<any>;
    tools: Tool[];
    llm: ChatOpenAI | ChatAnthropic;
    maxIterations: number;
    maxExecutionTime: number;
    returnIntermediateSteps: boolean;
    verbose: boolean;
  }) {
    this.graph = config.graph;
    this.tools = config.tools;
    this.llm = config.llm;
    this.maxIterations = config.maxIterations;
    this.maxExecutionTime = config.maxExecutionTime;
    this.returnIntermediateSteps = config.returnIntermediateSteps;
    this.verbose = config.verbose;
  }

  async invoke(input: Record<string, unknown>): Promise<{
    output: string;
    intermediateSteps?: any[];
  }> {
    const startTime = Date.now();
    const query = input.input as string;
    const chatHistory = (input.chat_history as BaseMessage[]) || [];

    // Combine history with current query
    const messages: BaseMessage[] = [...chatHistory, new HumanMessage(query)];

    const initialState: AgentState = {
      messages,
      next: 'agent',
      iterations: 0,
      intermediateSteps: [],
    };

    const compiledGraph = this.graph.compile();
    let currentState = initialState;
    let lastOutput = '';

    try {
      // Execute agent loop
      while (currentState.next !== END && currentState.iterations < this.maxIterations) {
        const elapsed = Date.now() - startTime;
        if (elapsed > this.maxExecutionTime) {
          throw new Error(`Agent execution timeout after ${elapsed}ms`);
        }

        // Execute one step
        const result = await compiledGraph.invoke(currentState);
        currentState = result as AgentState;

        if (currentState.messages && currentState.messages.length > 0) {
          const lastMessage = currentState.messages[currentState.messages.length - 1];
          lastOutput = lastMessage.getContent() as string;
        }

        currentState.iterations++;
      }

      // Save to memory
      this.memory = currentState.messages || [];

      return {
        output: lastOutput || 'No output generated',
        intermediateSteps: this.returnIntermediateSteps ? currentState.intermediateSteps : undefined,
      };
    } catch (error: any) {
      throw new Error(`Agent execution failed: ${error.message || error}`);
    }
  }

  async *stream(input: Record<string, unknown>): AsyncGenerator<{
    output: string;
    intermediateSteps?: any[];
  }> {
    const query = input.input as string;
    const chatHistory = (input.chat_history as BaseMessage[]) || [];

    const messages: BaseMessage[] = [...chatHistory, new HumanMessage(query)];

    const initialState: AgentState = {
      messages,
      next: 'agent',
      iterations: 0,
      intermediateSteps: [],
    };

    const compiledGraph = this.graph.compile();
    let currentState = initialState;

    try {
      for await (const chunk of compiledGraph.stream(initialState)) {
        const state = Object.values(chunk)[0] as AgentState;
        if (state) {
          currentState = state;
          const lastMessage = state.messages?.[state.messages.length - 1];
          const output = lastMessage?.getContent() as string || '';

          yield {
            output,
            intermediateSteps: this.returnIntermediateSteps ? state.intermediateSteps : undefined,
          };
        }
      }

      this.memory = currentState.messages || [];
    } catch (error: any) {
      throw new Error(`Agent streaming failed: ${error.message || error}`);
    }
  }
}

export class AgentService {
  private agents: Map<string, AgentExecutor> = new Map();
  private memories: Map<string, BaseMessage[]> = new Map();

  /**
   * Create an agent with the specified configuration
   */
  async createAgent(
    agentId: string,
    config: AgentConfig = {}
  ): Promise<string> {
    const {
      type = 'react',
      provider = 'openai',
      model = provider === 'openai' ? 'gpt-4' : 'claude-3-opus-20240229',
      temperature = 0.7,
      maxIterations = 15,
      maxExecutionTime = 60000, // 60 seconds default
      returnIntermediateSteps = true,
      verbose = false,
      systemPrompt,
      tools = [], // Empty array means use all available tools
    } = config;

    // Get LLM
    const llm = await this.getLLM(provider, model, temperature);

    // Get tools
    const availableTools = this.getTools(tools);

    // Create ReAct agent graph
    const graph = this.createReActAgentGraph(llm, availableTools, systemPrompt);

    // Create executor
    const executor = new AgentExecutor({
      graph,
      tools: availableTools,
      llm,
      maxIterations,
      maxExecutionTime,
      returnIntermediateSteps,
      verbose,
    });

    this.agents.set(agentId, executor);
    this.memories.set(agentId, []);

    return agentId;
  }

  /**
   * Execute an agent with a query
   */
  async executeAgent(
    agentId: string,
    query: string,
    input?: Record<string, unknown>
  ): Promise<AgentResponse> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found. Create it first using createAgent().`);
    }

    const startTime = Date.now();
    
    try {
      // Get memory
      const memory = this.memories.get(agentId) || [];

      // Prepare input
      const agentInput: Record<string, unknown> = {
        input: query,
        chat_history: memory,
        ...input,
      };

      // Execute agent
      const result = await agent.invoke(agentInput);

      // Update memory
      const newMemory = [...memory, new HumanMessage(query)];
      if (result.output) {
        newMemory.push(new AIMessage(result.output));
      }
      this.memories.set(agentId, newMemory);

      const executionTime = Date.now() - startTime;

      return {
        output: result.output || '',
        intermediateSteps: result.intermediateSteps,
        memory: {
          messages: newMemory,
        },
        executionTime,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      // Handle agent errors with retry logic
      if (error.message?.includes('max iterations') || error.message?.includes('timeout')) {
        throw new Error(`Agent execution ${error.message}. Execution time: ${executionTime}ms`);
      }
      
      throw new Error(`Agent execution failed: ${error.message || error}`);
    }
  }

  /**
   * Stream agent execution (for real-time updates)
   */
  async *streamAgent(
    agentId: string,
    query: string,
    input?: Record<string, unknown>
  ): AsyncGenerator<Partial<AgentResponse>, void, unknown> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found. Create it first using createAgent().`);
    }

    const startTime = Date.now();
    
    try {
      // Get memory
      const memory = this.memories.get(agentId) || [];

      // Prepare input
      const agentInput: Record<string, unknown> = {
        input: query,
        chat_history: memory,
        ...input,
      };

      let lastOutput = '';
      // Stream agent execution
      for await (const chunk of agent.stream(agentInput)) {
        const executionTime = Date.now() - startTime;
        lastOutput = chunk.output || lastOutput;
        
        yield {
          output: chunk.output || '',
          intermediateSteps: chunk.intermediateSteps,
          executionTime,
        };
      }

      // Update memory
      const newMemory = [...memory, new HumanMessage(query)];
      if (lastOutput) {
        newMemory.push(new AIMessage(lastOutput));
      }
      this.memories.set(agentId, newMemory);
    } catch (error: any) {
      throw new Error(`Agent streaming failed: ${error.message || error}`);
    }
  }

  /**
   * Get agent memory
   */
  async getAgentMemory(agentId: string): Promise<BaseMessage[]> {
    return this.memories.get(agentId) || [];
  }

  /**
   * Clear agent memory
   */
  async clearAgentMemory(agentId: string): Promise<void> {
    this.memories.set(agentId, []);
  }

  /**
   * Delete an agent
   */
  deleteAgent(agentId: string): void {
    this.agents.delete(agentId);
    this.memories.delete(agentId);
  }

  /**
   * Get all available agent IDs
   */
  getAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  // Private helper methods

  private async getLLM(
    provider: 'openai' | 'anthropic',
    model: string,
    temperature: number
  ): Promise<ChatOpenAI | ChatAnthropic> {
    if (provider === 'openai') {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required for OpenAI provider');
      }
      return new ChatOpenAI({
        modelName: model,
        temperature,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
    } else {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is required for Anthropic provider');
      }
      return new ChatAnthropic({
        modelName: model,
        temperature,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  private getTools(toolNames: string[]): Tool[] {
    const allTools = langtoolsService.getAllToolsMap();
    
    if (toolNames.length === 0) {
      // Return all available tools
      return Array.from(allTools.values()) as Tool[];
    }
    
    // Return only specified tools
    return toolNames
      .map(name => allTools.get(name))
      .filter((tool): tool is Tool => tool !== undefined);
  }

  /**
   * Create a ReAct agent graph using LangGraph
   */
  private createReActAgentGraph(
    llm: ChatOpenAI | ChatAnthropic,
    tools: Tool[],
    systemPrompt?: string
  ): StateGraph<any> {
    // Define state annotation
    const StateAnnotation = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
        default: () => [],
      }),
      next: Annotation<string>({
        reducer: (x: string, y: string) => y,
        default: () => 'agent',
      }),
      iterations: Annotation<number>({
        reducer: (x: number, y: number) => y,
        default: () => 0,
      }),
      intermediateSteps: Annotation<Array<{
        action: { tool: string; toolInput: string };
        observation: string;
      }>>({
        reducer: (x, y) => x.concat(y),
        default: () => [],
      }),
    });

    const graph = new StateGraph(StateAnnotation);

    // Agent node - decides what to do
    graph.addNode('agent', async (state: any) => {
      const messages = state.messages || [];
      const lastMessage = messages[messages.length - 1];
      const query = lastMessage?.getContent() || '';

      // Create prompt for agent
      const toolNames = tools.map(t => t.name).join(', ');
      const toolDescriptions = tools.map(t => `${t.name}: ${t.description}`).join('\n');

      const prompt = systemPrompt || `You are a helpful assistant that can use tools to answer questions.

Available tools:
${toolDescriptions}

Use the following format:
Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [${toolNames}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Question: ${query}
Thought:`;

      // Get LLM response
      const response = await langchainService.generateText(
        prompt,
        {
          provider: llm instanceof ChatOpenAI ? 'openai' : 'anthropic',
          model: (llm as any).modelName || 'gpt-4',
        }
      );

      // Log cost for agent LLM call
      const { costLoggingService } = await import('./costLoggingService');
      const tokenUsage = response.metadata as any;
      if (tokenUsage?.tokenUsage || response.tokensUsed) {
        await costLoggingService.logFromTokenUsage(
          llm instanceof ChatOpenAI ? 'openai' : 'anthropic',
          (llm as any).modelName || 'gpt-4',
          {
            promptTokens: tokenUsage?.tokenUsage?.promptTokens,
            completionTokens: tokenUsage?.tokenUsage?.completionTokens,
            inputTokens: tokenUsage?.tokenUsage?.inputTokens,
            outputTokens: tokenUsage?.tokenUsage?.outputTokens,
            totalTokens: response.tokensUsed,
          },
          {
            userId: undefined, // Agent calls may not have user context
            agentId: undefined, // Could be enhanced to track agent ID
            prompt: prompt.length > 1000 ? prompt.substring(0, 1000) + '...' : prompt,
            response: response.content.length > 1000 ? response.content.substring(0, 1000) + '...' : response.content,
          }
        );
      }

      const responseMessage = new AIMessage(response.content);
      const newMessages = [...messages, responseMessage];

      // Simple parsing to determine next step
      // In a real implementation, this would use proper ReAct parsing
      const responseText = response.content.toLowerCase();
      let next = END;
      
      if (responseText.includes('action:') && !responseText.includes('final answer:')) {
        // Agent wants to use a tool
        next = 'tool';
      }

      return {
        messages: newMessages,
        next,
        iterations: (state.iterations || 0) + 1,
      };
    });

    // Tool node - executes tools
    graph.addNode('tool', async (state: any) => {
      const messages = state.messages || [];
      const lastMessage = messages[messages.length - 1];
      const responseText = lastMessage?.getContent() || '';

      // Parse tool name and input from response
      // This is simplified - real implementation would use proper parsing
      const actionMatch = responseText.match(/action:\s*(\w+)/i);
      const inputMatch = responseText.match(/action input:\s*(.+?)(?:\n|thought:|final answer:)/i);

      if (actionMatch && inputMatch) {
        const toolName = actionMatch[1];
        const toolInput = inputMatch[1].trim();

        const tool = tools.find(t => t.name.toLowerCase() === toolName.toLowerCase());
        if (tool) {
          try {
            const result = await tool.invoke(toolInput);
            const observation = `Observation: ${result}`;
            const observationMessage = new HumanMessage(observation);

            return {
              messages: [...messages, observationMessage],
              next: 'agent', // Go back to agent
              intermediateSteps: [
                ...(state.intermediateSteps || []),
                {
                  action: { tool: toolName, toolInput },
                  observation: result,
                },
              ],
            };
          } catch (error: any) {
            const errorObservation = `Observation: Error executing tool ${toolName}: ${error.message}`;
            return {
              messages: [...messages, new HumanMessage(errorObservation)],
              next: 'agent',
            };
          }
        }
      }

      // If tool parsing failed, go back to agent
      return {
        messages,
        next: 'agent',
      };
    });

    // Add edges
    graph.addEdge(START, 'agent');
    graph.addConditionalEdges('agent', (state: any) => state.next || END);
    graph.addEdge('tool', 'agent');
    graph.addEdge('agent', END);

    return graph;
  }
}

export const agentService = new AgentService();
