import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { costCalculationService } from "./costCalculationService";

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  tokensUsed?: number;
  cost?: number;
  metadata?: Record<string, unknown>;
}

/**
 * LangChain Service - Wrapper around LangChain for AI operations
 * This service provides LangChain functionality while maintaining compatibility
 * with your existing workflow system
 */
export class LangChainService {
  private openaiLLM?: ChatOpenAI;
  private anthropicLLM?: ChatAnthropic;
  private embeddings?: OpenAIEmbeddings;

  constructor() {
    // Initialize OpenAI LLM
    if (process.env.OPENAI_API_KEY) {
      this.openaiLLM = new ChatOpenAI({
        modelName: "gpt-4",
        temperature: 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });

      // Initialize embeddings
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: "text-embedding-ada-002",
      });
    }

    // Initialize Anthropic LLM
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropicLLM = new ChatAnthropic({
        modelName: "claude-3-opus-20240229",
        temperature: 0.7,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  /**
   * Generate text using LangChain
   */
  async generateText(
    prompt: string,
    config: LLMConfig,
    variables?: Record<string, unknown>
  ): Promise<LLMResponse> {
    // Replace variables in prompt
    let processedPrompt = prompt;
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        processedPrompt = processedPrompt.replace(
          new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
          String(value)
        );
      });
    }

    let llm: ChatOpenAI | ChatAnthropic;
    
    switch (config.provider) {
      case 'openai':
        if (!this.openaiLLM) {
          throw new Error('OpenAI API key not configured');
        }
        // Create new instance with custom config
        llm = new ChatOpenAI({
          modelName: config.model,
          temperature: config.temperature ?? 0.7,
          maxTokens: config.maxTokens,
          openAIApiKey: process.env.OPENAI_API_KEY,
        });
        break;
      case 'anthropic':
        if (!this.anthropicLLM) {
          throw new Error('Anthropic API key not configured');
        }
        // Create new instance with custom config
        llm = new ChatAnthropic({
          modelName: config.model,
          temperature: config.temperature ?? 0.7,
          maxTokens: config.maxTokens,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        });
        break;
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }

    // Add system prompt if provided
    let messages: any[] = [];
    if (config.systemPrompt) {
      messages.push({
        role: 'system',
        content: config.systemPrompt,
      });
    }
    messages.push({
      role: 'user',
      content: processedPrompt,
    });

    const response = await llm.invoke(processedPrompt);
    
    // Extract token usage if available
    const tokenUsage = (response.response_metadata as any)?.tokenUsage;
    const tokensUsed = tokenUsage 
      ? (tokenUsage.promptTokens || 0) + (tokenUsage.completionTokens || 0)
      : undefined;

    // Calculate cost using cost calculation service
    let cost = 0;
    let costDetails = null;
    if (tokenUsage) {
      costDetails = costCalculationService.calculateFromTokenUsage(
        config.provider,
        config.model,
        {
          promptTokens: tokenUsage.promptTokens,
          completionTokens: tokenUsage.completionTokens,
          inputTokens: tokenUsage.inputTokens,
          outputTokens: tokenUsage.outputTokens,
          totalTokens: tokensUsed,
        }
      );
      cost = costDetails.totalCost;
    }

    return {
      content: response.content as string,
      tokensUsed,
      cost,
      metadata: {
        model: config.model,
        provider: config.provider,
        costDetails,
        ...response.response_metadata,
      },
    };
  }

  /**
   * Generate embeddings using LangChain
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embeddings) {
      throw new Error('OpenAI API key not configured for embeddings');
    }

    const embedding = await this.embeddings.embedQuery(text);
    return embedding;
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.embeddings) {
      throw new Error('OpenAI API key not configured for embeddings');
    }

    const embeddings = await this.embeddings.embedDocuments(texts);
    return embeddings;
  }

  /**
   * Chunk text using LangChain's text splitter
   */
  async chunkText(
    text: string,
    chunkSize: number = 1000,
    chunkOverlap: number = 200,
    strategy: 'fixed' | 'sentence' | 'paragraph' = 'fixed'
  ): Promise<{ chunks: string[]; metadata: Array<Record<string, unknown>> }> {
    let splitter: RecursiveCharacterTextSplitter;

    switch (strategy) {
      case 'sentence':
        splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
          chunkSize,
          chunkOverlap,
        });
        break;
      case 'paragraph':
        splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
          chunkSize: chunkSize * 10, // Larger chunks for paragraphs
          chunkOverlap,
          separators: ["\n\n", "\n", " "],
        });
        break;
      default: // 'fixed'
        splitter = new RecursiveCharacterTextSplitter({
          chunkSize,
          chunkOverlap,
        });
    }

    const documents = await splitter.createDocuments([text]);
    
    const chunks = documents.map(doc => doc.pageContent);
    const metadata = documents.map((doc, index) => ({
      chunkIndex: index,
      length: doc.pageContent.length,
      metadata: doc.metadata,
    }));

    return { chunks, metadata };
  }

}

export const langchainService = new LangChainService();

