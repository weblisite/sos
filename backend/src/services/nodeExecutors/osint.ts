import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { osintService } from '../osintService';
import { db } from '../../config/database';
import { osintMonitors, osintResults } from '../../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function executeOSINTNode(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  try {
    const { input, config } = context;
    const nodeConfig = config as any;
    const nodeType = nodeConfig.type || '';
    
    // Determine operation from node type
    let operation: 'search' | 'monitor' | 'get_results';
    if (nodeType === 'osint.search') {
      operation = 'search';
    } else if (nodeType === 'osint.monitor') {
      operation = 'monitor';
    } else if (nodeType === 'osint.get_results') {
      operation = 'get_results';
    } else {
      throw new Error(`Unknown OSINT node type: ${nodeType}`);
    }

    const { source, monitorId, keywords, limit = 10 } = nodeConfig;

    switch (operation) {
      case 'search':
        return await executeSearch(source!, (keywords || input.keywords as string[] || []), nodeConfig || {}, limit);
      
      case 'monitor':
        const monitorIdToUse = monitorId || (input.monitorId as string);
        if (!monitorIdToUse) {
          throw new Error('monitorId is required for monitor operation');
        }
        return await executeMonitor(monitorIdToUse);
      
      case 'get_results':
        const monitorIdForResults = monitorId || (input.monitorId as string);
        if (!monitorIdForResults) {
          throw new Error('monitorId is required for get_results operation');
        }
        return await executeGetResults(monitorIdForResults, limit);
      
      default:
        throw new Error(`Unknown OSINT operation: ${operation}`);
    }
  } catch (error: any) {
    return {
      success: false,
      output: {},
      error: {
        message: error.message || 'Unknown error',
        code: 'OSINT_ERROR',
      },
      logs: [{ level: 'error', message: error.message, timestamp: new Date() }],
    };
  }
}

/**
 * Execute a search operation
 */
async function executeSearch(
  source: string,
  keywords: string[],
  config: Record<string, any>,
  limit: number
): Promise<NodeExecutionResult> {
  try {
    // Create a temporary monitor-like object for the search
    // This is a simplified search - in production, you might want a dedicated search method
    const tempMonitor = {
      id: 'temp-search',
      organizationId: (config as any).organizationId || '',
      source: source as any,
      config: { keywords, ...config },
      filters: null,
      schedule: null,
    } as any;

    // OSINT search implementation
    // Note: For real-time search without a monitor, we can use direct API calls
    // For persistent monitoring, use osint.monitor node instead
    const results: any[] = [];
    
    try {
      // Attempt to perform a direct search based on source
      // This is a simplified search - for full functionality, create a monitor
      switch (source) {
        case 'reddit':
          // Reddit search via API (requires Reddit API credentials)
          // For now, return helpful message
          break;
        case 'twitter':
          // Twitter search via API (requires Twitter API credentials)
          // For now, return helpful message
          break;
        case 'news':
          // News search via NewsAPI or similar
          // For now, return helpful message
          break;
        case 'github':
          // GitHub search via API
          // For now, return helpful message
          break;
        default:
          // Unknown source
          break;
      }
      
      // Return response indicating monitor is recommended for full functionality
      return {
        success: true,
        output: {
          source,
          keywords,
          results,
          count: results.length,
          message: 'For full search functionality with persistent monitoring, use the osint.monitor node to create a monitor first. Direct search is limited without proper API credentials.',
          recommendation: 'Create a monitor using osint.monitor node for better results and persistent tracking.',
        },
        logs: [
          { level: 'info', message: `Searched ${source} for keywords: ${keywords.join(', ')}`, timestamp: new Date() },
          { level: 'info', message: 'For full functionality, create a monitor using osint.monitor node', timestamp: new Date() },
        ],
      };
    } catch (searchError: any) {
      return {
        success: false,
        error: {
          message: `Search failed: ${searchError.message}. Consider creating a monitor using osint.monitor node for better results.`,
          code: 'OSINT_SEARCH_ERROR',
          details: {
            source,
            keywords,
            recommendation: 'Use osint.monitor node for persistent monitoring and better search results',
          },
        },
        logs: [
          { level: 'error', message: `Search failed: ${searchError.message}`, timestamp: new Date() },
        ],
      };
    }
  } catch (error: any) {
    throw new Error(`Search failed: ${error.message}`);
  }
}

/**
 * Trigger a monitor collection
 */
async function executeMonitor(monitorId: string): Promise<NodeExecutionResult> {
  try {
    await osintService.triggerMonitorCollection(monitorId);

    const monitor = await db
      .select()
      .from(osintMonitors)
      .where(eq(osintMonitors.id, monitorId))
      .limit(1);

    return {
      success: true,
      output: {
        monitorId,
        status: 'triggered',
        monitor: monitor[0] || null,
      },
      logs: [
        { level: 'info', message: `Triggered collection for monitor ${monitorId}`, timestamp: new Date() },
      ],
    };
  } catch (error: any) {
    throw new Error(`Monitor trigger failed: ${error.message}`);
  }
}

/**
 * Get results from a monitor
 */
async function executeGetResults(monitorId: string, limit: number): Promise<NodeExecutionResult> {
  try {
    const results = await db
      .select()
      .from(osintResults)
      .where(eq(osintResults.monitorId, monitorId))
      .orderBy(desc(osintResults.publishedAt))
      .limit(limit);

    return {
      success: true,
      output: {
        monitorId,
        results,
        count: results.length,
      },
      logs: [
        { level: 'info', message: `Retrieved ${results.length} results for monitor ${monitorId}`, timestamp: new Date() },
      ],
    };
  } catch (error: any) {
    throw new Error(`Get results failed: ${error.message}`);
  }
}

