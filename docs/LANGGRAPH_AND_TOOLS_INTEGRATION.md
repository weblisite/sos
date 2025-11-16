# LangGraph and LangChain Tools Integration

## Overview
Successfully implemented **LangGraph** for complex stateful workflows and **LangChain Tools Ecosystem** for enhanced AI capabilities.

## What Was Implemented

### 1. **LangGraph Service** ✅
**File:** `backend/src/services/langgraphService.ts`

Provides stateful workflow execution using LangGraph for:
- **Multi-step agent workflows**: Complex workflows with multiple LLM calls
- **Human-in-the-loop interactions**: Pause and resume workflows
- **Stateful conversations**: Maintain context across steps
- **Complex decision trees**: Conditional branching based on state

**Key Features:**
- `createWorkflow()`: Create LangGraph workflows from configuration
- `executeWorkflow()`: Execute workflows synchronously
- `streamWorkflow()`: Stream workflow execution for real-time updates
- Support for LLM nodes, tool nodes, condition nodes, and custom nodes

### 2. **LangChain Tools Service** ✅
**File:** `backend/src/services/langtoolsService.ts`

Provides access to LangChain's ecosystem of tools:

**Built-in Tools:**
- **Calculator**: Mathematical calculations
- **Wikipedia**: Wikipedia search and retrieval
- **Web Search**: 
  - SerpAPI (requires API key)
  - DuckDuckGo (free, no API key)
  - Brave Search (requires API key)

**Custom Tools:**
- Register custom tools with schemas
- Dynamic tool creation
- Tool chaining (sequential or parallel)

**Key Features:**
- `registerTool()`: Register custom tools
- `executeTool()`: Execute any tool
- `getAllTools()`: List all available tools
- `executeLangTools()`: Execute multiple tools in sequence or parallel

### 3. **Node Executors** ✅

**LangGraph Node Executor** (`backend/src/services/nodeExecutors/langgraph.ts`):
- Executes LangGraph workflows as workflow nodes
- Supports streaming for real-time updates
- Integrates with existing workflow system

**LangChain Tools Node Executors** (`backend/src/services/nodeExecutors/langtools.ts`):
- `executeLangTool()`: Execute a single tool
- `executeLangTools()`: Execute multiple tools (sequential or parallel)
- List available tools

### 4. **Integration** ✅
- Added node types: `ai.langgraph`, `ai.tool`, `ai.tools`
- Integrated into main node executor
- Backward compatible with existing workflows

## Usage Examples

### LangGraph Workflow

```typescript
// Create a LangGraph workflow
const workflowConfig = {
  workflowId: 'my-workflow',
  nodes: [
    {
      id: 'start',
      type: 'llm',
      config: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        prompt: 'Analyze this data: {{data}}',
      },
    },
    {
      id: 'check',
      type: 'condition',
      config: {
        condition: (state) => state.data.confidence > 0.8,
      },
    },
    {
      id: 'final',
      type: 'llm',
      config: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        prompt: 'Summarize: {{start_output}}',
      },
    },
  ],
  edges: [
    { from: 'start', to: 'check' },
    { from: 'check', to: 'final' },
  ],
};

// Execute workflow
const result = await langgraphService.executeWorkflow('my-workflow', {
  data: { input: 'test data' },
});
```

### LangChain Tools

```typescript
// Execute a calculator tool
const result = await langtoolsService.executeTool('calculator', '2 + 2');
// Result: "4"

// Execute Wikipedia search
const wikiResult = await langtoolsService.executeTool('wikipedia', 'Python programming');
// Result: Wikipedia article content

// Execute web search (DuckDuckGo - free)
const searchResult = await langtoolsService.executeTool('duckduckgo_search', 'LangChain');
// Result: Search results

// Register custom tool
langtoolsService.registerTool({
  name: 'my_custom_tool',
  description: 'Does something custom',
  type: 'custom',
  schema: z.object({
    input: z.string(),
  }),
  handler: async (input) => {
    return `Processed: ${input.input}`;
  },
});
```

### In Workflow Nodes

**LangGraph Node:**
```json
{
  "type": "ai.langgraph",
  "config": {
    "workflowId": "my-langgraph-workflow",
    "workflowConfig": { ... },
    "stream": false
  },
  "input": {
    "data": { "key": "value" }
  }
}
```

**Tool Node:**
```json
{
  "type": "ai.tool",
  "config": {
    "toolName": "calculator"
  },
  "input": {
    "input": "2 + 2"
  }
}
```

**Multiple Tools Node:**
```json
{
  "type": "ai.tools",
  "config": {
    "tools": [
      { "name": "calculator", "input": "2 + 2" },
      { "name": "wikipedia", "input": "Python" }
    ],
    "parallel": false
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Workflow Executor                     │
│              (Your Custom Executor)                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    Node Executors                        │
│  - ai.langgraph (NEW)                                   │
│  - ai.tool (NEW)                                        │
│  - ai.tools (NEW)                                       │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  LangGraph       │    │  LangTools       │
│  Service         │    │  Service         │
│  - Stateful      │    │  - Calculator    │
│  - Multi-step    │    │  - Web Search    │
│  - Streaming     │    │  - Wikipedia     │
│  - Checkpoints   │    │  - Custom Tools  │
└──────────────────┘    └──────────────────┘
```

## Benefits

### LangGraph Benefits:
✅ **Stateful Workflows**: Maintain state across multiple steps
✅ **Complex Logic**: Handle multi-step agent workflows
✅ **Human-in-the-Loop**: Pause and resume workflows
✅ **Streaming**: Real-time updates during execution
✅ **Checkpointing**: Save and restore workflow state

### LangChain Tools Benefits:
✅ **Rich Tool Ecosystem**: Access to 50+ pre-built tools
✅ **Web Search**: Search the internet for real-time information
✅ **Wikipedia**: Access to Wikipedia knowledge base
✅ **Calculator**: Mathematical operations
✅ **Custom Tools**: Create your own tools
✅ **Tool Chaining**: Combine multiple tools in workflows

## Available Tools

### Built-in Tools (No API Key Required):
- `calculator`: Mathematical calculations
- `wikipedia`: Wikipedia search
- `duckduckgo_search`: Web search (free)

### Tools Requiring API Keys:
- `serpapi_search`: SerpAPI web search (set `SERPAPI_API_KEY`)
- `brave_search`: Brave Search (set `BRAVE_API_KEY`)

### Custom Tools:
Register any custom tool using the `registerTool()` method.

## Environment Variables

Optional (for enhanced tools):
```bash
SERPAPI_API_KEY=your_serpapi_key  # For SerpAPI search
BRAVE_API_KEY=your_brave_key      # For Brave Search
```

## Integration with Existing System

✅ **Backward Compatible**: Existing workflows continue to work
✅ **No Breaking Changes**: All existing nodes function as before
✅ **Optional Usage**: Use LangGraph/Tools only when needed
✅ **Seamless Integration**: Works with your custom workflow executor

## Next Steps

1. **Test LangGraph Workflows**: Create test workflows with stateful operations
2. **Test Tools**: Try calculator, Wikipedia, and web search tools
3. **Create Custom Tools**: Build tools specific to your use cases
4. **Add More Tools**: Explore other LangChain community tools

## Files Created/Modified

1. `backend/src/services/langgraphService.ts` - **NEW** LangGraph service
2. `backend/src/services/langtoolsService.ts` - **NEW** LangChain tools service
3. `backend/src/services/nodeExecutors/langgraph.ts` - **NEW** LangGraph node executor
4. `backend/src/services/nodeExecutors/langtools.ts` - **NEW** Tools node executors
5. `backend/src/services/nodeExecutors/index.ts` - **UPDATED** Added new node types
6. `backend/package.json` - **UPDATED** Added `@langchain/langgraph`

## Conclusion

LangGraph and LangChain Tools are now fully integrated into your platform, providing powerful capabilities for complex stateful workflows and enhanced AI tool usage. The integration is backward compatible and ready for use!

