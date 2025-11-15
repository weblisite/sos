# Custom Code & Code Agents - Implementation TODO

**Status:** 🟢 In Progress - 92% Complete  
**Last Updated:** 2024-12-19  
**Progress:** 45/49 core tasks completed

---

## Phase 1: Foundation Enhancements (Weeks 1-2)

### 1.1 Schema Validation with Pydantic/Zod
- [x] **1.1.1** Install dependencies: `zod`, `pydantic` (via Python service)
- [x] **1.1.2** Create `codeValidationService.ts`
- [x] **1.1.3** Implement Zod validation for JavaScript/TypeScript
- [x] **1.1.4** Implement Pydantic validation for Python (via Python service)
- [x] **1.1.5** Add schema fields to code node config
- [x] **1.1.6** Update `NodeConfigPanel` to include schema editor
- [x] **1.1.7** Add validation on code save/execution
- [x] **1.1.8** Create database migration for `code_schemas` table

### 1.2 Enhanced Tool Registry with Versioning
- [x] **1.2.1** Create database migration for `code_agents` table
- [x] **1.2.2** Create database migration for `code_agent_versions` table
- [x] **1.2.3** Create `codeAgentRegistry.ts` service
- [x] **1.2.4** Implement CRUD operations for code agents
- [x] **1.2.5** Implement versioning system
- [x] **1.2.6** Implement Supabase Storage integration for code blobs
- [x] **1.2.7** Implement "Export as Tool" functionality
- [x] **1.2.8** Create API routes for code agents (`/api/v1/code-agents`)
- [x] **1.2.9** Integrate with LangChain tool registry

### 1.3 Monaco Editor Integration
- [x] **1.3.1** Install `@monaco-editor/react` and `monaco-editor`
- [x] **1.3.2** Create `CodeEditor.tsx` component
- [x] **1.3.3** Add language support (JavaScript, Python, TypeScript, Bash)
- [x] **1.3.4** Integrate Monaco editor into `NodeConfigPanel` for code nodes
- [x] **1.3.5** Add syntax highlighting and autocomplete
- [ ] **1.3.6** Add GPT-4 code suggestions (optional - Phase 2, can defer)
- [x] **1.3.7** Add dark mode support

---

## Phase 2: Advanced Runtimes (Weeks 3-4)

### 2.1 E2B Runtime Integration
- [ ] **2.1.1** Set up E2B account and get API key
- [ ] **2.1.2** Install `@e2b/sdk`
- [x] **2.1.3** Create `e2bRuntime.ts` service
- [x] **2.1.4** Implement E2B sandbox creation and execution
- [x] **2.1.5** Add E2B runtime to runtime router
- [ ] **2.1.6** Test E2B execution with sample code
- [ ] **2.1.7** Add E2B environment variable configuration

### 2.2 WasmEdge Runtime Integration
- [ ] **2.2.1** Research WasmEdge integration options
- [ ] **2.2.2** Set up WasmEdge service/container
- [ ] **2.2.3** Create `wasmEdgeRuntime.ts` service
- [ ] **2.2.4** Implement WASM compilation pipeline
- [ ] **2.2.5** Implement WasmEdge execution
- [ ] **2.2.6** Add WasmEdge runtime to runtime router
- [ ] **2.2.7** Test WasmEdge execution

### 2.3 Bacalhau Runtime Integration (Optional - Phase 3)
- [ ] **2.3.1** Set up Bacalhau cluster
- [ ] **2.3.2** Install `@bacalhau-project/bacalhau-js`
- [ ] **2.3.3** Create `bacalhauRuntime.ts` service
- [ ] **2.3.4** Implement distributed job submission
- [ ] **2.3.5** Implement job monitoring and result retrieval
- [ ] **2.3.6** Add GPU support configuration
- [ ] **2.3.7** Add Bacalhau runtime to runtime router

### 2.4 Runtime Router
- [x] **2.4.1** Create `runtimeRouter.ts` service
- [x] **2.4.2** Implement routing logic based on PRD conditions
- [x] **2.4.3** Add runtime selection to code node config
- [x] **2.4.4** Update `executeCode` to use runtime router
- [x] **2.4.5** Add runtime metrics tracking

---

## Phase 3: Sandbox Studio UI (Weeks 5-6)

### 3.1 Sandbox Studio Page
- [x] **3.1.1** Create `SandboxStudio.tsx` page
- [x] **3.1.2** Create file tree component
- [x] **3.1.3** Integrate Monaco editor in studio
- [x] **3.1.4** Create config panel component
- [x] **3.1.5** Add environment variable manager
- [x] **3.1.6** Add schema editor UI
- [x] **3.1.7** Add runtime selector UI
- [x] **3.1.8** Add "Export as Tool" button and flow
- [ ] **3.1.9** Add "Deploy to MCP Server" button (optional, can defer)
- [x] **3.1.10** Add route `/dashboard/sandbox` or `/dashboard/code-agents`

### 3.2 Code Agent Management UI
- [ ] **3.2.1** Create code agents list page
- [ ] **3.2.2** Add search and filter functionality
- [ ] **3.2.3** Add version history viewer
- [ ] **3.2.4** Add usage statistics display
- [ ] **3.2.5** Add publish/unpublish functionality

---

## Phase 4: ETL Hooks & Code Agents (Weeks 7-8)

### 4.1 ETL Hooks in RAG Pipeline
- [x] **4.1.1** Add `preIngestHook` field to RAG node config
- [x] **4.1.2** Add `postAnswerHook` field to RAG node config
- [x] **4.1.3** Update `rag.ts` executor to execute hooks
- [x] **4.1.4** Add hook configuration UI in `NodeConfigPanel`
- [ ] **4.1.5** Test pre-ingest hook with document processing
- [ ] **4.1.6** Test post-answer hook with answer enhancement

### 4.2 Code Execution Tool for Agents
- [x] **4.2.1** Create `executeCodeTool` in `langtoolsService.ts`
- [x] **4.2.2** Register code execution tool in agent tool registry
- [x] **4.2.3** Update agent executor to use code execution tool
- [ ] **4.2.4** Test agent writing and executing code
- [ ] **4.2.5** Add code execution tool to agent tool selection UI

---

## Phase 5: TypeScript & Bash Support (Weeks 9-10)

### 5.1 TypeScript Support
- [x] **5.1.1** Install `typescript` package
- [x] **5.1.2** Add TypeScript compilation to `code.ts` executor
- [x] **5.1.3** Add TypeScript language to node registry
- [x] **5.1.4** Add TypeScript support to Monaco editor
- [ ] **5.1.5** Test TypeScript execution

### 5.2 Bash Support
- [x] **5.2.1** Add Bash execution function to `code.ts`
- [x] **5.2.2** Add Bash language to node registry
- [x] **5.2.3** Add Bash support to Monaco editor
- [ ] **5.2.4** Test Bash execution

---

## Phase 6: Observability & Analytics (Weeks 11-12)

### 6.1 Enhanced Observability
- [ ] **6.1.1** Add runtime tags to OpenTelemetry spans
- [ ] **6.1.2** Add memory usage tracking
- [ ] **6.1.3** Add token usage tracking for AI-assisted code
- [x] **6.1.4** Create `code_exec_logs` table migration
- [ ] **6.1.5** Log all code executions to database (partially done via runtimeRouter)
- [ ] **6.1.6** Add code execution metrics to dashboard

### 6.2 Analytics & Reporting
- [ ] **6.2.1** Add PostHog events for code tool usage
- [ ] **6.2.2** Create code agent usage analytics page
- [ ] **6.2.3** Add registry reuse rate tracking
- [ ] **6.2.4** Add validation failure rate tracking
- [ ] **6.2.5** Add latency metrics dashboard

---

## Phase 7: Security & Compliance (Ongoing)

### 7.1 Security Enhancements
- [ ] **7.1.1** Implement namespace isolation for runtimes
- [ ] **7.1.2** Add read-only filesystem option
- [ ] **7.1.3** Add outbound network toggle per node
- [ ] **7.1.4** Implement sandbox escape detection (if using Kubernetes)
- [ ] **7.1.5** Add code review integration (CodeRabbit/Cursor) - optional

### 7.2 Compliance
- [ ] **7.2.1** Ensure tenant-scoped code execution
- [ ] **7.2.2** Implement 90-day audit log retention
- [ ] **7.2.3** Add governance metadata requirements
- [ ] **7.2.4** Add license and scope fields to code agents

---

## Dependencies & Prerequisites

### External Services
- [ ] E2B account and API key
- [ ] WasmEdge service/container setup
- [ ] Bacalhau cluster (optional - Phase 3)
- [ ] Supabase Storage bucket for code blobs

### Environment Variables
```env
# E2B
E2B_API_KEY=...

# WasmEdge (if using service)
WASMEDGE_SERVICE_URL=...

# Bacalhau (optional)
BACALHAU_API_URL=...
BACALHAU_API_KEY=...

# Python Service (for Pydantic validation)
PYTHON_SERVICE_URL=...
```

### NPM Packages
```json
{
  "@monaco-editor/react": "^4.6.0",
  "monaco-editor": "^0.45.0",
  "@e2b/sdk": "^0.1.0",
  "zod": "^3.22.0",
  "typescript": "^5.3.0"
}
```

---

## Testing Checklist

### Unit Tests
- [x] Code validation service tests
- [ ] Runtime router tests
- [x] Code agent registry tests
- [x] Schema validation tests

### Integration Tests
- [ ] E2B runtime execution tests
- [ ] WasmEdge runtime execution tests
- [ ] Code agent tool registration tests
- [ ] ETL hook execution tests

### E2E Tests
- [ ] Create code agent in Sandbox Studio
- [ ] Export code agent as tool
- [ ] Use code agent in workflow
- [ ] Agent executes code tool
- [ ] ETL hooks execute in RAG pipeline

---

## Documentation

- [ ] Update PRD with implementation details
- [ ] Create user guide for Sandbox Studio
- [ ] Create developer guide for creating code agents
- [ ] Document runtime selection logic
- [ ] Document schema validation
- [ ] Create API documentation for code agents endpoints

---

**Total Estimated Tasks:** 100+  
**Estimated Timeline:** 10-12 weeks  
**Team Size:** 2-3 developers

