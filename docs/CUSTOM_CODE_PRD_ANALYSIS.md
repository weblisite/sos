# Custom Code & Code Agents PRD - Capability Analysis & Implementation Plan

**Date:** 2024-12-19  
**Status:** ✅ **PLATFORM IS CAPABLE - IMPLEMENTATION ROADMAP PROVIDED**

---

## Executive Summary

**Yes, your platform is capable of supporting the Custom Code & Code Agents PRD.** You have a solid foundation with:
- ✅ Basic code execution (JavaScript/Python)
- ✅ Workflow orchestration (LangGraph)
- ✅ Tool registry (LangChain tools)
- ✅ OpenTelemetry observability
- ✅ Supabase database
- ✅ PostHog analytics

**Gaps to fill:**
- ⚠️ Advanced runtimes (E2B, WasmEdge, Bacalhau)
- ⚠️ Monaco editor UI
- ⚠️ Sandbox Studio
- ⚠️ Schema validation (Pydantic/Zod)
- ⚠️ Tool registry with versioning
- ⚠️ ETL hooks
- ⚠️ Code agents (agents that execute code)

---

## 1. Current Capabilities Assessment

### ✅ What You Already Have

| PRD Requirement | Current Status | Implementation |
|----------------|----------------|----------------|
| **Inline Code Node** | ✅ **Implemented** | `action.code` (JS) and `action.code.python` nodes |
| **JavaScript Execution** | ✅ **Implemented** | VM2 sandbox with 5s timeout |
| **Python Execution** | ✅ **Implemented** | Subprocess with security validation |
| **Security Validation** | ✅ **Implemented** | Package blocking, dangerous pattern detection |
| **Workflow Integration** | ✅ **Implemented** | Code nodes work in workflows |
| **OpenTelemetry** | ✅ **Implemented** | Tracing spans for all executions |
| **Tool Registry (Basic)** | ✅ **Implemented** | LangChain tools service with `registerTool()` |
| **AI Agents** | ✅ **Implemented** | LangGraph agents with tool usage |
| **Database** | ✅ **Implemented** | Supabase PostgreSQL |
| **Analytics** | ✅ **Implemented** | PostHog integration |

### ⚠️ What Needs Enhancement

| PRD Requirement | Current Status | Gap |
|----------------|----------------|-----|
| **Monaco Editor** | ❌ **Not Implemented** | Using basic textarea |
| **Multiple Runtimes** | ⚠️ **Partial** | Only VM2 + subprocess, need E2B/WasmEdge/Bacalhau |
| **Schema Validation** | ⚠️ **Partial** | No Pydantic/Zod schema enforcement |
| **Tool Registry** | ⚠️ **Partial** | No versioning, no Supabase storage |
| **Sandbox Studio** | ❌ **Not Implemented** | No UI for creating reusable code agents |
| **ETL Hooks** | ❌ **Not Implemented** | No pre/post hooks in RAG pipeline |
| **Code Agents** | ⚠️ **Partial** | Agents exist but can't execute code as tool |
| **TypeScript Support** | ❌ **Not Implemented** | Only JS and Python |
| **Bash Support** | ❌ **Not Implemented** | Not in current implementation |

---

## 2. Implementation Roadmap

### Phase 1: Foundation Enhancements (Weeks 1-2)

#### 1.1 Schema Validation with Pydantic/Zod
**Priority:** High  
**Effort:** 3-5 days

**Implementation:**
```typescript
// backend/src/services/codeValidationService.ts
import { z } from 'zod';
import { validate as pydanticValidate } from 'pydantic'; // via Python service

export class CodeValidationService {
  async validateWithZod(
    code: string,
    inputSchema: z.ZodSchema,
    outputSchema: z.ZodSchema,
    input: any
  ): Promise<{ valid: boolean; errors?: string[] }> {
    // Validate input
    const inputResult = inputSchema.safeParse(input);
    if (!inputResult.success) {
      return { valid: false, errors: inputResult.error.errors.map(e => e.message) };
    }
    
    // Execute code (mock execution for validation)
    // In real implementation, would run code and validate output
    return { valid: true };
  }
  
  async validateWithPydantic(
    code: string,
    inputSchema: string, // JSON schema string
    outputSchema: string,
    input: any
  ): Promise<{ valid: boolean; errors?: string[] }> {
    // Call Python service to validate with Pydantic
    const response = await axios.post(`${PYTHON_SERVICE_URL}/validate`, {
      code,
      input_schema: inputSchema,
      output_schema: outputSchema,
      input,
    });
    return response.data;
  }
}
```

**Database Schema:**
```sql
-- Add to drizzle/schema.ts
export const codeSchemas = pgTable('code_schemas', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  codeId: text('code_id').notNull(), // References code_agents or workflow node
  inputSchema: jsonb('input_schema'), // Zod/Pydantic schema
  outputSchema: jsonb('output_schema'),
  validationType: text('validation_type').notNull(), // 'zod' | 'pydantic'
  createdAt: timestamp('created_at').defaultNow(),
});
```

#### 1.2 Enhanced Tool Registry with Versioning
**Priority:** High  
**Effort:** 5-7 days

**Database Schema:**
```sql
-- backend/drizzle/schema.ts
export const codeAgents = pgTable('code_agents', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description'),
  version: text('version').notNull().default('1.0.0'),
  language: text('language').notNull(), // 'javascript' | 'python' | 'typescript' | 'bash'
  code: text('code').notNull(),
  inputSchema: jsonb('input_schema'),
  outputSchema: jsonb('output_schema'),
  runtime: text('runtime').notNull().default('vm2'), // 'vm2' | 'e2b' | 'wasmedge' | 'bacalhau'
  packages: jsonb('packages').$type<string[]>(),
  environment: jsonb('environment').$type<Record<string, string>>(),
  organizationId: text('organization_id'),
  workspaceId: text('workspace_id'),
  userId: text('user_id'),
  isPublic: boolean('is_public').default(false),
  usageCount: integer('usage_count').default(0),
  deprecated: boolean('deprecated').default(false),
  changelog: jsonb('changelog').$type<Array<{ version: string; changes: string; date: string }>>(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const codeAgentVersions = pgTable('code_agent_versions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  codeAgentId: text('code_agent_id').notNull().references(() => codeAgents.id),
  version: text('version').notNull(),
  code: text('code').notNull(),
  inputSchema: jsonb('input_schema'),
  outputSchema: jsonb('output_schema'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

**Service:**
```typescript
// backend/src/services/codeAgentRegistry.ts
export class CodeAgentRegistry {
  async createAgent(data: CreateCodeAgentInput): Promise<CodeAgent> {
    // Create agent with versioning
    // Store code in Supabase Storage
    // Register as LangChain tool
  }
  
  async exportAsTool(agentId: string): Promise<LangChainToolManifest> {
    // Generate LangChain tool JSON manifest
  }
  
  async getAgent(agentId: string, version?: string): Promise<CodeAgent> {
    // Get specific version or latest
  }
}
```

#### 1.3 Monaco Editor Integration
**Priority:** High  
**Effort:** 3-4 days

**Frontend:**
```bash
npm install @monaco-editor/react monaco-editor
```

```typescript
// frontend/src/components/CodeEditor.tsx
import Editor from '@monaco-editor/react';
import { useTheme } from '../contexts/ThemeContext';

export function CodeEditor({
  language,
  value,
  onChange,
  schema,
}: {
  language: 'javascript' | 'python' | 'typescript' | 'bash';
  value: string;
  onChange: (value: string) => void;
  schema?: z.ZodSchema; // For autocomplete
}) {
  const { resolvedTheme } = useTheme();
  
  return (
    <Editor
      height="400px"
      language={language}
      theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light'}
      value={value}
      onChange={(val) => onChange(val || '')}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: 'on',
        automaticLayout: true,
        // Add GPT-4 code suggestions via language server
      }}
    />
  );
}
```

---

### Phase 2: Advanced Runtimes (Weeks 3-4)

#### 2.1 E2B Runtime Integration
**Priority:** Medium  
**Effort:** 5-7 days

**Implementation:**
```typescript
// backend/src/services/runtimes/e2bRuntime.ts
import { E2B } from '@e2b/sdk';

export class E2BRuntime {
  private client: E2B;
  
  constructor() {
    this.client = new E2B(process.env.E2B_API_KEY!);
  }
  
  async execute(
    code: string,
    language: 'python' | 'javascript',
    input: any,
    timeout: number = 5000
  ): Promise<NodeExecutionResult> {
    const sandbox = await this.client.sandbox.create({
      template: language === 'python' ? 'python3' : 'node',
    });
    
    try {
      // Write code to file
      await sandbox.filesystem.write('/code/main.py', code);
      
      // Execute with timeout
      const exec = await sandbox.process.start({
        cmd: language === 'python' ? ['python3', '/code/main.py'] : ['node', '/code/main.js'],
        envVars: { INPUT: JSON.stringify(input) },
      });
      
      const result = await exec.wait({ timeout });
      
      return {
        success: result.exitCode === 0,
        output: { output: JSON.parse(result.stdout) },
        error: result.exitCode !== 0 ? { message: result.stderr } : undefined,
      };
    } finally {
      await sandbox.close();
    }
  }
}
```

#### 2.2 WasmEdge Runtime Integration
**Priority:** Medium  
**Effort:** 7-10 days

**Implementation:**
```typescript
// backend/src/services/runtimes/wasmEdgeRuntime.ts
import { WasmEdge } from '@wasmedge/wasmedge';

export class WasmEdgeRuntime {
  async execute(
    wasmCode: Uint8Array,
    input: any
  ): Promise<NodeExecutionResult> {
    // Compile code to WASM first (via external service or build step)
    // Then execute in WasmEdge
    const vm = new WasmEdge.VM();
    // ... execution logic
  }
}
```

#### 2.3 Bacalhau Runtime Integration
**Priority:** Low (for MVP)  
**Effort:** 10-14 days

**Implementation:**
```typescript
// backend/src/services/runtimes/bacalhauRuntime.ts
import { BacalhauClient } from '@bacalhau-project/bacalhau-js';

export class BacalhauRuntime {
  async executeDistributed(
    code: string,
    language: 'python' | 'javascript',
    input: any,
    gpu: boolean = false
  ): Promise<NodeExecutionResult> {
    // Submit job to Bacalhau cluster
    // Monitor execution
    // Return results
  }
}
```

#### 2.4 Runtime Router
**Priority:** High  
**Effort:** 3-5 days

```typescript
// backend/src/services/runtimeRouter.ts
export class RuntimeRouter {
  async route(
    code: string,
    language: string,
    config: CodeExecutionConfig
  ): Promise<Runtime> {
    // Route based on PRD logic:
    // - exec_time < 50ms → E2B
    // - requires_sandbox → WasmEdge
    // - long_job → Bacalhau
    // - default → VM2/subprocess
  }
}
```

---

### Phase 3: Sandbox Studio UI (Weeks 5-6)

#### 3.1 Sandbox Studio Page
**Priority:** High  
**Effort:** 10-14 days

**Frontend:**
```typescript
// frontend/src/pages/SandboxStudio.tsx
export default function SandboxStudio() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Left: File Tree */}
      <FileTree />
      
      {/* Center: Monaco Editor */}
      <CodeEditor />
      
      {/* Right: Config Panel */}
      <ConfigPanel>
        <EnvironmentVariables />
        <SchemaEditor />
        <RuntimeSelector />
        <ExportAsToolButton />
      </ConfigPanel>
    </div>
  );
}
```

#### 3.2 Export as Tool Feature
**Priority:** High  
**Effort:** 3-5 days

```typescript
// backend/src/routes/codeAgents.ts
router.post('/:id/export-tool', async (req, res) => {
  const agent = await codeAgentRegistry.getAgent(req.params.id);
  
  const toolManifest = {
    name: agent.name,
    description: agent.description,
    inputSchema: agent.inputSchema,
    outputSchema: agent.outputSchema,
    handler: {
      type: 'code_agent',
      agentId: agent.id,
      version: agent.version,
    },
  };
  
  res.json(toolManifest);
});
```

---

### Phase 4: ETL Hooks & Code Agents (Weeks 7-8)

#### 4.1 ETL Hooks in RAG Pipeline
**Priority:** Medium  
**Effort:** 5-7 days

```typescript
// backend/src/services/nodeExecutors/rag.ts
async function executeRAG(context: NodeExecutionContext) {
  const config = context.config as RAGConfig;
  
  // Pre-ingest hook
  if (config.preIngestHook) {
    const hookResult = await executeCodeAgent(config.preIngestHook, {
      document: context.input.document,
    });
    context.input.document = hookResult.output.processedDocument;
  }
  
  // ... existing RAG logic ...
  
  // Post-answer hook
  if (config.postAnswerHook) {
    const hookResult = await executeCodeAgent(config.postAnswerHook, {
      answer: ragResult.answer,
      context: ragResult.context,
    });
    ragResult.answer = hookResult.output.enhancedAnswer;
  }
}
```

#### 4.2 Code Execution Tool for Agents
**Priority:** High  
**Effort:** 3-5 days

```typescript
// backend/src/services/langtoolsService.ts
export class LangToolsService {
  async registerCodeExecutionTool() {
    this.registerTool({
      name: 'execute_code',
      description: 'Execute JavaScript or Python code. Use this to write and run custom logic.',
      type: 'custom',
      schema: z.object({
        language: z.enum(['javascript', 'python', 'typescript']),
        code: z.string().describe('The code to execute'),
        packages: z.array(z.string()).optional().describe('Python packages to install'),
        input: z.any().optional().describe('Input data for the code'),
      }),
      handler: async ({ language, code, packages, input }) => {
        // Route to appropriate runtime
        const runtime = await runtimeRouter.route(code, language, {
          packages,
          timeout: 5000,
        });
        
        const result = await runtime.execute(code, language, input || {});
        
        if (!result.success) {
          return `Error: ${result.error?.message}`;
        }
        
        return JSON.stringify(result.output);
      },
    });
  }
}
```

---

### Phase 5: TypeScript & Bash Support (Weeks 9-10)

#### 5.1 TypeScript Support
**Priority:** Medium  
**Effort:** 5-7 days

```typescript
// Compile TypeScript to JavaScript before execution
import { transpile } from 'typescript';

async function executeTypeScript(code: string, input: any) {
  const jsCode = transpile(code, {
    target: ScriptTarget.ES2020,
    module: ModuleKind.CommonJS,
  });
  
  return executeJavaScript(jsCode, input);
}
```

#### 5.2 Bash Support
**Priority:** Low  
**Effort:** 3-5 days

```typescript
async function executeBash(code: string, input: any) {
  // Execute in subprocess with timeout
  // Similar to Python execution
}
```

---

## 3. Database Schema Additions

```typescript
// backend/drizzle/schema.ts

// Code Agents Registry
export const codeAgents = pgTable('code_agents', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description'),
  version: text('version').notNull().default('1.0.0'),
  language: text('language').notNull(),
  code: text('code').notNull(),
  codeStoragePath: text('code_storage_path'), // Supabase Storage path
  inputSchema: jsonb('input_schema'),
  outputSchema: jsonb('output_schema'),
  runtime: text('runtime').notNull().default('vm2'),
  packages: jsonb('packages').$type<string[]>(),
  environment: jsonb('environment').$type<Record<string, string>>(),
  organizationId: text('organization_id'),
  workspaceId: text('workspace_id'),
  userId: text('user_id'),
  isPublic: boolean('is_public').default(false),
  usageCount: integer('usage_count').default(0),
  deprecated: boolean('deprecated').default(false),
  changelog: jsonb('changelog'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Code Execution Logs
export const codeExecLogs = pgTable('code_exec_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  codeAgentId: text('code_agent_id'),
  workflowExecutionId: text('workflow_execution_id'),
  runtime: text('runtime').notNull(),
  language: text('language').notNull(),
  durationMs: integer('duration_ms'),
  memoryMb: integer('memory_mb'),
  exitCode: integer('exit_code'),
  success: boolean('success').notNull(),
  errorMessage: text('error_message'),
  tokensUsed: integer('tokens_used'), // For AI-assisted code
  organizationId: text('organization_id'),
  workspaceId: text('workspace_id'),
  userId: text('user_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Code Agent Versions
export const codeAgentVersions = pgTable('code_agent_versions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  codeAgentId: text('code_agent_id').notNull().references(() => codeAgents.id),
  version: text('version').notNull(),
  code: text('code').notNull(),
  codeStoragePath: text('code_storage_path'),
  inputSchema: jsonb('input_schema'),
  outputSchema: jsonb('output_schema'),
  changelog: jsonb('changelog'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

## 4. API Endpoints to Add

```typescript
// backend/src/routes/codeAgents.ts

// CRUD Operations
router.post('/code-agents', authenticate, createCodeAgent);
router.get('/code-agents', authenticate, listCodeAgents);
router.get('/code-agents/:id', authenticate, getCodeAgent);
router.put('/code-agents/:id', authenticate, updateCodeAgent);
router.delete('/code-agents/:id', authenticate, deleteCodeAgent);

// Versioning
router.post('/code-agents/:id/versions', authenticate, createVersion);
router.get('/code-agents/:id/versions', authenticate, listVersions);
router.get('/code-agents/:id/versions/:version', authenticate, getVersion);

// Tool Export
router.post('/code-agents/:id/export-tool', authenticate, exportAsTool);

// Execution
router.post('/code-agents/:id/execute', authenticate, executeCodeAgent);

// Registry
router.get('/code-agents/registry', authenticate, getPublicRegistry);
router.post('/code-agents/:id/publish', authenticate, publishToRegistry);
```

---

## 5. Observability Enhancements

```typescript
// Add to existing OpenTelemetry spans
span.setAttributes({
  'code.runtime': runtime, // 'vm2' | 'e2b' | 'wasmedge' | 'bacalhau'
  'code.language': language,
  'code.sandbox': true,
  'code.memory_mb': memoryUsage,
  'code.tokens_used': tokensUsed,
  'code.validation_passed': validationPassed,
});
```

---

## 6. Success Metrics Implementation

| KPI | Implementation |
|-----|----------------|
| **Inline exec median latency** | OpenTelemetry span `latency_ms` with tag `runtime=e2b` |
| **Sandbox escape incidents** | Falco/kube-audit events (if using Kubernetes) |
| **Validation failure rate** | Query `code_exec_logs` table for validation errors |
| **Registry reuse rate** | PostHog event `code_tool_used` with `agent_id` |
| **ETL load throughput** | Vector DB ingest logs + Bacalhau metrics |

---

## 7. Implementation Priority

### MVP (Weeks 1-4)
1. ✅ Schema validation (Pydantic/Zod)
2. ✅ Enhanced tool registry with versioning
3. ✅ Monaco editor integration
4. ✅ E2B runtime (for <50ms latency)
5. ✅ Code execution tool for agents

### Phase 2 (Weeks 5-8)
6. ✅ Sandbox Studio UI
7. ✅ WasmEdge runtime
8. ✅ ETL hooks
9. ✅ TypeScript support

### Phase 3 (Weeks 9-12)
10. ✅ Bacalhau runtime
11. ✅ Bash support
12. ✅ Advanced observability
13. ✅ AI code review integration

---

## 8. Open Questions - Recommendations

1. **Preferred language list for MVP?**
   - **Recommendation:** Start with Python and JavaScript. Add TypeScript in Phase 2, Bash in Phase 3.

2. **Auto-grant outbound network or default-deny?**
   - **Recommendation:** Default-deny with per-node toggle. Security-first approach.

3. **Version pinning vs rolling-latest?**
   - **Recommendation:** Support both. Default to version pinning, allow "latest" as option.

4. **Billing model for long Bacalhau GPU jobs?**
   - **Recommendation:** Usage-based billing with budget alerts. Track GPU minutes separately.

---

## 9. Conclusion

**Your platform is well-positioned to support the Custom Code & Code Agents PRD.** The existing infrastructure (workflow engine, code execution, tool registry, observability) provides a solid foundation. The main work involves:

1. **Adding advanced runtimes** (E2B, WasmEdge, Bacalhau)
2. **Building the Sandbox Studio UI** (Monaco editor, file tree, config panel)
3. **Enhancing the tool registry** (versioning, Supabase storage)
4. **Adding schema validation** (Pydantic/Zod)
5. **Enabling code agents** (register code execution as tool)

**Estimated Timeline:** 10-12 weeks for full implementation  
**Team Size:** 2-3 developers  
**Complexity:** Medium-High

---

**Status:** ✅ **READY TO IMPLEMENT**

**Next Steps:**
1. Review and approve this implementation plan
2. Set up E2B, WasmEdge, and Bacalhau accounts/services
3. Create database migrations for new tables
4. Start with Phase 1 (Foundation Enhancements)

