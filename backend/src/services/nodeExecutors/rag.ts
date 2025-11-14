import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { aiService } from '../aiService';
import { langchainService } from '../langchainService';
import { storeVectors, queryVectors, deleteVectors } from '../vectorStore';
import { db, workflows, workspaces } from '../../config/database';
import { eq } from 'drizzle-orm';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { posthogService } from '../posthogService';
import { featureFlagService } from '../featureFlagService';
import { costLoggingService } from '../costLoggingService';

// Dynamic imports for file parsing libraries
let pdfParse: any = null;
let mammoth: any = null;

try {
  pdfParse = require('pdf-parse');
} catch (error) {
  // pdf-parse not installed
}

try {
  mammoth = require('mammoth');
} catch (error) {
  // mammoth not installed
}

// Import OCR service for scanned document support
import { ocrService, OCRInput, OCRConfig } from '../ocrService';
// Import ETL hook service for pre/post hooks
import { etlHookService } from '../etlHookService';

// Helper function to get organizationId from workflow
async function getOrganizationIdFromWorkflow(workflowId: string): Promise<string | null> {
  try {
    const [workflow] = await db
      .select({ organizationId: workspaces.organizationId })
      .from(workflows)
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .where(eq(workflows.id, workflowId))
      .limit(1);

    return workflow?.organizationId || null;
  } catch (error) {
    console.error('Error getting organizationId from workflow:', error);
    return null;
  }
}

// Helper function to parse file content based on type
async function parseFileContent(file: string, fileType: string): Promise<string> {
  if (file.startsWith('data:')) {
    // Base64 encoded file
    const base64Data = file.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Detect MIME type from data URI
    const mimeType = file.split(',')[0].split(':')[1].split(';')[0];
    
    // Determine file type from MIME type or provided fileType
    let actualFileType = fileType;
    if (fileType === 'auto') {
      if (mimeType === 'application/pdf') {
        actualFileType = 'pdf';
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'application/msword') {
        actualFileType = 'docx';
      } else if (mimeType.startsWith('text/')) {
        actualFileType = 'txt';
      } else {
        // Try to parse as text
        return buffer.toString('utf-8');
      }
    }

    // Parse based on file type
    if (actualFileType === 'pdf') {
      if (!pdfParse) {
        throw new Error('PDF parsing requires pdf-parse package. Please install it: npm install pdf-parse');
      }
      try {
        const pdfData = await pdfParse(buffer);
        // Check if it's a text-based PDF (has substantial text)
        if (pdfData.text.trim().length > 100) {
          return pdfData.text; // Text-based PDF - use extracted text
        }
        // Scanned PDF - use OCR
        const ocrInput: OCRInput = { pdfBase64: file };
        const ocrConfig: OCRConfig = {
          provider: 'tesseract',
          language: 'auto',
          preprocess: true,
        };
        const ocrResult = await ocrService.process(ocrInput, ocrConfig);
        return ocrResult.text;
      } catch (error: any) {
        // If PDF parsing fails, try OCR
        try {
          const ocrInput: OCRInput = { pdfBase64: file };
          const ocrConfig: OCRConfig = {
            provider: 'tesseract',
            language: 'auto',
            preprocess: true,
          };
          const ocrResult = await ocrService.process(ocrInput, ocrConfig);
          return ocrResult.text;
        } catch (ocrError: any) {
          throw new Error(`PDF parsing and OCR both failed: ${error.message}`);
        }
      }
    } else if (actualFileType === 'docx') {
      if (!mammoth) {
        throw new Error('DOCX parsing requires mammoth package. Please install it: npm install mammoth');
      }
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else {
      // Plain text
      return buffer.toString('utf-8');
    }
  } else {
    // File path - not supported yet
    throw new Error('File path reading is not supported. Please use base64 encoded file or text input.');
  }
}

// Vector Store Node
export async function executeVectorStore(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config, workflowId } = context;
  const nodeConfig = config as any;

  const provider = (nodeConfig.provider as string) || 'memory';
  const operation = (nodeConfig.operation as string) || 'store';
  const indexName = (nodeConfig.indexName as string) || 'default';
  const apiKey = (nodeConfig.apiKey as string) || undefined;
  const topK = (nodeConfig.topK as number) || 5;

  // Get organizationId from workflow for multi-tenant isolation
  const organizationId = provider === 'database' ? await getOrganizationIdFromWorkflow(workflowId) : null;

  try {
    if (operation === 'store') {
      const embeddings = (input.embeddings as number[][]) || [];
      const texts = (input.texts as string[]) || [];

      if (texts.length === 0) {
        return {
          success: false,
          error: {
            message: 'Texts are required for store operation',
            code: 'MISSING_DATA',
          },
        };
      }

      // Generate embeddings if not provided (using LangChain)
      let finalEmbeddings = embeddings;
      if (finalEmbeddings.length === 0) {
        try {
          finalEmbeddings = await langchainService.generateEmbeddings(texts);
        } catch (error: any) {
          return {
            success: false,
            error: {
              message: `Failed to generate embeddings: ${error.message}`,
              code: 'EMBEDDING_GENERATION_ERROR',
            },
          };
        }
      }

      if (finalEmbeddings.length !== texts.length) {
        return {
          success: false,
          error: {
            message: 'Embeddings and texts arrays must have the same length',
            code: 'ARRAY_LENGTH_MISMATCH',
          },
        };
      }

      const documents = finalEmbeddings.map((embedding, index) => {
        const metadata = (input.metadata as Record<string, unknown>)?.[index];
        return {
          embedding,
          text: texts[index],
          ...(metadata ? { metadata: metadata as Record<string, unknown> } : {}),
        };
      });

      const ids = await storeVectors(provider, indexName, documents, apiKey, organizationId);

      return {
        success: true,
        output: {
          ids,
          count: ids.length,
        },
      };
    } else if (operation === 'search') {
      const queryEmbedding = (input.embedding as number[]) || (input.queryEmbedding as number[]);
      const queryText = (input.query as string) || '';
      
      // Generate embedding from query text if not provided (using LangChain)
      let finalEmbedding = queryEmbedding;
      if (!finalEmbedding && queryText) {
        try {
          finalEmbedding = await langchainService.generateEmbedding(queryText);
        } catch (error: any) {
          return {
            success: false,
            error: {
              message: `Failed to generate embedding: ${error.message}`,
              code: 'EMBEDDING_GENERATION_ERROR',
            },
          };
        }
      }

      if (!finalEmbedding || !Array.isArray(finalEmbedding)) {
        return {
          success: false,
          error: {
            message: 'Query embedding is required for search operation',
            code: 'MISSING_EMBEDDING',
          },
        };
      }

      const results = await queryVectors(provider, indexName, finalEmbedding, topK, apiKey, organizationId);

      return {
        success: true,
        output: {
          results,
          count: results.length,
        },
      };
    } else if (operation === 'delete') {
      const ids = (input.ids as string[]) || [];
      
      if (ids.length === 0) {
        return {
          success: false,
          error: {
            message: 'IDs are required for delete operation',
            code: 'MISSING_IDS',
          },
        };
      }

      await deleteVectors(provider, indexName, ids, apiKey, organizationId);

      return {
        success: true,
        output: {
          deleted: ids.length,
        },
      };
    } else {
      return {
        success: false,
        error: {
          message: `Unsupported operation: ${operation}`,
          code: 'UNSUPPORTED_OPERATION',
        },
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'Vector store operation failed',
        code: 'VECTOR_STORE_ERROR',
        details: error,
      },
    };
  }
}

// Document Ingestion Node
export async function executeDocumentIngest(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const fileType = (nodeConfig.fileType as string) || 'auto';
  const chunkSize = (nodeConfig.chunkSize as number) || 1000;
  const chunkOverlap = (nodeConfig.chunkOverlap as number) || 200;
  const chunkStrategy = (nodeConfig.chunkStrategy as string) || 'fixed';
  const preIngestHook = nodeConfig.preIngestHook as string | undefined; // Code agent ID

  const file = (input.file as string) || '';
  const text = (input.text as string) || '';

  if (!file && !text) {
    return {
      success: false,
      error: {
        message: 'File or text is required',
        code: 'MISSING_INPUT',
      },
    };
  }

  try {
    let content = text;

    // If file is provided, parse it (keep existing parsing logic)
    if (file) {
      content = await parseFileContent(file, fileType);
    }

    // Execute pre-ingest hook if configured
    if (preIngestHook) {
      const hookResult = await etlHookService.executePreIngestHook(
        preIngestHook,
        {
          document: content,
          fileType,
          metadata: input.metadata as Record<string, any> | undefined,
        },
        context.workflowId
      );

      if (hookResult.success && hookResult.document) {
        content = hookResult.document;
      } else {
        console.warn('Pre-ingest hook failed, using original content:', hookResult.error);
      }
    }

    // Use LangChain for chunking (more robust than custom implementation)
    const { chunks, metadata } = await langchainService.chunkText(
      content,
      chunkSize,
      chunkOverlap,
      chunkStrategy as 'fixed' | 'sentence' | 'paragraph'
    );

    return {
      success: true,
      output: {
        chunks,
        metadata: {
          totalChunks: chunks.length,
          chunkDetails: metadata,
          originalLength: content.length,
        },
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'Document ingestion failed',
        code: 'DOCUMENT_INGESTION_ERROR',
        details: error,
      },
    };
  }
}

// Semantic Search Node
export async function executeSemanticSearch(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config, workflowId } = context;
  const nodeConfig = config as any;

  const provider = (nodeConfig.provider as string) || 'memory';
  const indexName = (nodeConfig.indexName as string) || 'default';
  const topK = (nodeConfig.topK as number) || 5;
  const minScore = (nodeConfig.minScore as number) || 0.7;
  const apiKey = (nodeConfig.apiKey as string) || undefined;

  const query = (input.query as string) || '';
  const queryEmbedding = (input.embedding as number[]) || undefined;

  if (!query && !queryEmbedding) {
    return {
      success: false,
      error: {
        message: 'Query text or embedding is required',
        code: 'MISSING_QUERY',
      },
    };
  }

  // Get organizationId from workflow for multi-tenant isolation
  const organizationId = provider === 'database' ? await getOrganizationIdFromWorkflow(workflowId) : null;

  try {
    // Generate embedding if not provided (using LangChain)
    let embedding = queryEmbedding;
    if (!embedding && query) {
      embedding = await langchainService.generateEmbedding(query);
    }

    if (!embedding) {
      return {
        success: false,
        error: {
          message: 'Failed to generate embedding',
          code: 'EMBEDDING_GENERATION_ERROR',
        },
      };
    }

    // Search vector store (using existing implementation which supports all providers)
    const results = await queryVectors(provider, indexName, embedding, topK, apiKey, organizationId);

    // Filter by minimum score
    const filteredResults = results.filter((r) => r.score >= minScore);

    return {
      success: true,
      output: {
        results: filteredResults,
        count: filteredResults.length,
        query,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'Semantic search failed',
        code: 'SEMANTIC_SEARCH_ERROR',
        details: error,
      },
    };
  }
}

// RAG Pipeline Node
export async function executeRAG(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config, workflowId } = context;
  const nodeConfig = config as any;

  const query = (input.query as string) || '';
  const vectorStoreProvider = (nodeConfig.vectorStoreProvider as string) || 'memory';
  const indexName = (nodeConfig.indexName as string) || 'default';
  const llmProvider = (nodeConfig.llmProvider as string) || 'openai';
  const model = (nodeConfig.model as string) || 'gpt-3.5-turbo';
  const topK = (nodeConfig.topK as number) || 5;
  const promptTemplate = (nodeConfig.promptTemplate as string) || 
    'Use the following context to answer the question:\n\nContext:\n{{context}}\n\nQuestion: {{query}}\n\nAnswer:';
  const apiKey = (nodeConfig.apiKey as string) || undefined;

  if (!query) {
    return {
      success: false,
      error: {
        message: 'Query is required',
        code: 'MISSING_QUERY',
      },
    };
  }

  // Create OpenTelemetry span for RAG execution
  const tracer = trace.getTracer('sos-rag-executor');
  const span = tracer.startSpan('rag.execute', {
    attributes: {
      'rag.vector_store_provider': vectorStoreProvider,
      'rag.index_name': indexName,
      'rag.llm_provider': llmProvider,
      'rag.llm_model': model,
      'rag.top_k': topK,
      'node.id': context.nodeId,
      'workflow.id': workflowId,
      'workflow.execution_id': context.executionId,
    },
  });

  const startTime = Date.now();

  // Get organizationId from workflow for multi-tenant isolation
  const organizationId = vectorStoreProvider === 'database' ? await getOrganizationIdFromWorkflow(workflowId) : null;

  try {
    // Step 1: Generate query embedding (using LangChain)
    const queryEmbedding = await langchainService.generateEmbedding(query);

    // Step 2: Search vector store
    const searchResults = await queryVectors(vectorStoreProvider, indexName, queryEmbedding, topK, apiKey, organizationId);

    if (searchResults.length === 0) {
      return {
        success: false,
        error: {
          message: 'No relevant documents found in vector store',
          code: 'NO_RESULTS',
        },
      };
    }

    // Step 3: Build context from search results
    const context = searchResults.map((r, idx) => `[${idx + 1}] ${r.text}`).join('\n\n');

    // Step 4: Build prompt with context
    const prompt = promptTemplate
      .replace(/\{\{context\}\}/g, context)
      .replace(/\{\{query\}\}/g, query);

    // Step 5: Generate answer using LLM (now uses LangChain)
    const llmResponse = await aiService.generateText({
      prompt,
      config: {
        provider: llmProvider as 'openai' | 'anthropic' | 'google',
        model,
        temperature: 0.7,
        maxTokens: 1000,
      },
    });

    // Log cost for LLM call
    const tokenUsage = llmResponse.metadata as any;
    if (tokenUsage) {
      await costLoggingService.logFromTokenUsage(
        llmProvider as 'openai' | 'anthropic' | 'google',
        model,
        {
          promptTokens: tokenUsage.tokenUsage?.promptTokens,
          completionTokens: tokenUsage.tokenUsage?.completionTokens,
          inputTokens: tokenUsage.tokenUsage?.inputTokens,
          outputTokens: tokenUsage.tokenUsage?.outputTokens,
          totalTokens: llmResponse.tokensUsed,
        },
        {
          userId: context.userId || null,
          workflowExecutionId: context.executionId || null,
          nodeId: context.nodeId || null,
          organizationId: (context as any).organizationId || null,
          workspaceId: (context as any).workspaceId || null,
          prompt: prompt.length > 1000 ? prompt.substring(0, 1000) + '...' : prompt,
          response: llmResponse.content.length > 1000 ? llmResponse.content.substring(0, 1000) + '...' : llmResponse.content,
        }
      );
    }

    let finalAnswer = llmResponse.content;

    // Step 6: Execute post-answer hook if configured
    const postAnswerHook = nodeConfig.postAnswerHook as string | undefined; // Code agent ID
    if (postAnswerHook) {
      const hookResult = await etlHookService.executePostAnswerHook(
        postAnswerHook,
        {
          answer: finalAnswer,
          context,
          sources: searchResults.map((r) => ({
            text: r.text,
            score: r.score,
            metadata: r.metadata,
          })),
          query,
        },
        workflowId
      );

      if (hookResult.success && hookResult.answer) {
        finalAnswer = hookResult.answer;
      } else {
        console.warn('Post-answer hook failed, using original answer:', hookResult.error);
      }
    }

    const latencyMs = Date.now() - startTime;

    // Update span with success
    span.setAttributes({
      'rag.status': 'success',
      'rag.latency_ms': latencyMs,
      'rag.sources_found': searchResults.length,
      'rag.tokens_used': llmResponse.tokensUsed || 0,
    });
    span.setStatus({ code: SpanStatusCode.OK });
    
    // Get trace ID from span context
    const spanContext = span.spanContext();
    const traceId = spanContext.traceId;
    
    // Track RAG query in PostHog (if feature flag enabled)
    const userId = (context as any).userId || '';
    const organizationId = (context as any).organizationId || '';
    const workspaceId = (context as any).workspaceId || '';
    
    if (userId && organizationId) {
      const versionedTracking = await featureFlagService.isEnabled(
        'versioned_rag_tracking',
        userId,
        workspaceId
      );
      
      if (versionedTracking) {
        posthogService.trackRAGQueryTriggered({
          userId,
          organizationId,
          workspaceId: workspaceId || undefined,
          vectorDbUsed: vectorStoreProvider,
          indexName,
          latencyMs,
          sourcesFound: searchResults.length,
          executionId: context.executionId,
          traceId,
        });
      }
    }
    
    span.end();

    return {
      success: true,
      output: {
        answer: finalAnswer,
        sources: searchResults.map((r) => ({
          text: r.text,
          score: r.score,
          metadata: r.metadata,
        })),
        tokens: llmResponse.tokensUsed,
      },
      metadata: {
        tokensUsed: llmResponse.tokensUsed,
      },
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;

    // Update span with error
    span.setAttributes({
      'rag.status': 'error',
      'rag.latency_ms': latencyMs,
      'rag.error': error.message || 'RAG pipeline failed',
      'rag.error_code': 'RAG_ERROR',
    });
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message || 'RAG pipeline failed',
    });
    span.end();

    return {
      success: false,
      error: {
        message: error.message || 'RAG pipeline failed',
        code: 'RAG_ERROR',
        details: error,
      },
    };
  }
}
