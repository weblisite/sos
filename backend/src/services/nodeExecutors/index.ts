import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { executeHttpRequest } from './httpRequest';
import { executeCode } from './code';
import { executeLLM } from './llm';
import { executeTransform } from './transform';
import { executeEmbedding } from './embedding';
import { executeIf, executeSwitch, executeWait, executeMerge, executeErrorCatch } from './logic';
import { executeDatabase } from './database';
import { executeFile } from './file';
import { executeCSV } from './csv';
import { executeJSONTransform } from './jsonTransform';
import { executeEmail } from './email';
import { executeSlack } from './slack';
import { executeDiscord } from './discord';
import { executeSMS } from './sms';
import {
  executeGoogleSheets,
  executeAirtable,
  executeNotion,
  executeZapier,
} from './integrations';
import { executeConnector } from './connector';
import {
  executeVectorStore,
  executeDocumentIngest,
  executeSemanticSearch,
  executeRAG,
} from './rag';
import { executeLangGraphWorkflow } from './langgraph';
import { executeLangTool, executeLangTools } from './langtools';
import { executeAgent } from './agent';
import {
  executeImageGenerate,
  executeImageAnalyze,
  executeAudioTranscribe,
  executeTextToSpeech,
} from './multimodal';
import { executeOSINTNode } from './osint';
import { executeOCR } from './ocr';
import { executeHumanPrompt } from './humanPrompt';
import { executeWebScrape } from './webScrape';
import { executeBrowserAutomation } from './browserAutomation';

export async function executeNode(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { nodeId, config } = context;
  const nodeType = (config as any).type || '';

  const startTime = Date.now();

  try {
    let result: NodeExecutionResult;

    // Route to appropriate executor based on node type
    if (nodeType.startsWith('trigger.')) {
      // Triggers don't execute - they just pass through data
      result = {
        success: true,
        output: context.input,
      };
    } else if (nodeType === 'action.http') {
      result = await executeHttpRequest(context);
    } else if (nodeType === 'action.code') {
      result = await executeCode(context, 'javascript');
    } else if (nodeType === 'action.code.python') {
      result = await executeCode(context, 'python');
    } else if (nodeType === 'action.code.typescript') {
      result = await executeCode(context, 'typescript');
    } else if (nodeType === 'action.code.bash') {
      result = await executeCode(context, 'bash');
    } else if (nodeType === 'action.transform') {
      result = await executeTransform(context);
    } else if (nodeType === 'action.web_scrape') {
      result = await executeWebScrape(context);
    } else if (nodeType === 'action.browser_automation') {
      result = await executeBrowserAutomation(context);
    } else if (nodeType === 'ai.llm') {
      result = await executeLLM(context);
    } else if (nodeType === 'ai.embedding') {
      result = await executeEmbedding(context);
    } else if (nodeType === 'ai.vector_store') {
      result = await executeVectorStore(context);
    } else if (nodeType === 'ai.document_ingest') {
      result = await executeDocumentIngest(context);
    } else if (nodeType === 'ai.semantic_search') {
      result = await executeSemanticSearch(context);
    } else if (nodeType === 'ai.rag') {
      result = await executeRAG(context);
    } else if (nodeType === 'ai.langgraph') {
      result = await executeLangGraphWorkflow(context);
    } else if (nodeType === 'ai.tool') {
      result = await executeLangTool(context);
    } else if (nodeType === 'ai.tools') {
      result = await executeLangTools(context);
    } else if (nodeType === 'ai.agent') {
      result = await executeAgent(context);
    } else if (nodeType === 'ai.image_generate') {
      result = await executeImageGenerate(context);
    } else if (nodeType === 'ai.image_analyze') {
      result = await executeImageAnalyze(context);
    } else if (nodeType === 'ai.audio_transcribe') {
      result = await executeAudioTranscribe(context);
    } else if (nodeType === 'ai.text_to_speech') {
      result = await executeTextToSpeech(context);
    } else if (nodeType === 'ai.ocr') {
      result = await executeOCR(context);
    } else if (nodeType === 'logic.if') {
      result = await executeIf(context);
    } else if (nodeType === 'logic.switch') {
      result = await executeSwitch(context);
    } else if (nodeType === 'logic.wait') {
      result = await executeWait(context);
    } else if (nodeType === 'logic.merge') {
      result = await executeMerge(context);
    } else if (nodeType === 'logic.error_catch') {
      result = await executeErrorCatch(context);
    } else if (nodeType === 'data.database') {
      result = await executeDatabase(context);
    } else if (nodeType === 'data.file') {
      result = await executeFile(context);
    } else if (nodeType === 'data.csv') {
      result = await executeCSV(context);
    } else if (nodeType === 'data.json') {
      result = await executeJSONTransform(context);
    } else if (nodeType === 'communication.email') {
      result = await executeEmail(context);
    } else if (nodeType === 'communication.slack') {
      result = await executeSlack(context);
    } else if (nodeType === 'communication.discord') {
      result = await executeDiscord(context);
    } else if (nodeType === 'communication.sms') {
      result = await executeSMS(context);
    } else if (nodeType.startsWith('integration.')) {
      // Use connector router for all integration nodes
      result = await executeConnector(context);
    } else if (nodeType === 'integration.google_sheets') {
      // Legacy: Keep for backward compatibility, but prefer integration.* routing
      result = await executeGoogleSheets(context);
    } else if (nodeType === 'integration.airtable') {
      // Legacy: Keep for backward compatibility
      result = await executeAirtable(context);
    } else if (nodeType === 'integration.notion') {
      // Legacy: Keep for backward compatibility
      result = await executeNotion(context);
    } else if (nodeType === 'integration.zapier') {
      // Legacy: Keep for backward compatibility
      result = await executeZapier(context);
    } else if (nodeType === 'osint.search' || nodeType === 'osint.monitor' || nodeType === 'osint.get_results') {
      result = await executeOSINTNode(context);
    } else if (nodeType === 'logic.human_prompt') {
      result = await executeHumanPrompt(context);
    } else {
      result = {
        success: false,
        error: {
          message: `Unknown node type: ${nodeType}`,
          code: 'UNKNOWN_NODE_TYPE',
        },
      };
    }

    const executionTime = Date.now() - startTime;
    return {
      ...result,
      metadata: {
        ...result.metadata,
        executionTime,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'Unknown error',
        code: error.code || 'EXECUTION_ERROR',
        details: error,
      },
      metadata: {
        executionTime: Date.now() - startTime,
      },
    };
  }
}


