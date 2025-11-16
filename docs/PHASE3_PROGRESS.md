# Phase 3 Progress - OpenTelemetry & Signoz Integration

**Date:** 2024-12-19  
**Status:** 🚧 In Progress

---

## Completed Tasks

### ✅ Phase 3.1: Install OpenTelemetry Packages
- Installed `@opentelemetry/api`
- Installed `@opentelemetry/sdk-node`
- Installed `@opentelemetry/instrumentation-http`
- Installed `@opentelemetry/instrumentation-express`
- Installed `@opentelemetry/exporter-trace-otlp-http`
- Installed `@opentelemetry/exporter-metrics-otlp-http`
- Installed `@opentelemetry/auto-instrumentations-node`
- Installed `@opentelemetry/semantic-conventions`

### ✅ Phase 3.2: Create OpenTelemetry Configuration
- Created `backend/src/config/telemetry.ts`
- Configured OTLP exporter for Signoz
- Set up resource attributes (service name, version, environment)
- Configured span processors (BatchSpanProcessor)
- Added environment variable support
- Integrated into `backend/src/index.ts` (initialized before other imports)
- Added graceful shutdown handlers

### ✅ Phase 3.3: Instrument Workflow Executor
- Added OpenTelemetry spans to `executeWorkflow()`
- Added spans to `executeNode()` for each node execution
- Custom attributes:
  - `workflow.id`, `workflow.execution_id`, `workflow.step_mode`
  - `node.id`, `node.type`, `node.status`, `node.latency_ms`
  - `user.id`, `organization.id`, `workspace.id`
  - Error tracking with `node.error`, `node.error_code`
- Trace ID propagation to database logs

### ✅ Phase 3.4: Instrument Tool Runtimes (Partial)
- ✅ LLM Executor: Full instrumentation with spans
  - Attributes: `llm.provider`, `llm.model`, `llm.input_tokens`, `llm.output_tokens`, `llm.cost_usd`, `llm.latency_ms`
- ✅ Agent Executor: Full instrumentation with spans
  - Attributes: `agent.id`, `agent.framework`, `agent.type`, `agent.provider`, `agent.model`, `agent.tokens_used`, `agent.cost`, `agent.iterations`
- ✅ Connector Executor: Full instrumentation with spans
  - Attributes: `connector.id`, `connector.action`, `connector.provider`, `connector.routing_provider`
- ⏭️ RAG Executor: Pending (need to find and instrument)

### ✅ Phase 3.5: Instrument Express Handlers
- Automatic HTTP instrumentation via `@opentelemetry/auto-instrumentations-node`
- Express middleware instrumentation enabled
- Trace context propagation to downstream services
- Health check endpoints excluded from tracing

---

## Trace ID Integration

### ✅ Database Logs
- `event_logs.trace_id` - Linked to OpenTelemetry traces
- `agent_trace_history.trace_id` - Linked to OpenTelemetry traces
- `model_cost_logs.trace_id` - Linked to OpenTelemetry traces
- Automatic trace ID extraction from OpenTelemetry context when not provided

---

## Environment Variables Added

```env
# OpenTelemetry (optional - for distributed tracing with Signoz)
OTEL_ENABLED=true
OTEL_SERVICE_NAME=sos-backend
OTEL_SERVICE_VERSION=1.0.0
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics
OTEL_EXPORTER_OTLP_HEADERS={}  # Optional: JSON object with headers
```

---

## Remaining Tasks

### ⏭️ Phase 3.4: Complete Tool Runtimes Instrumentation
- [ ] Instrument RAG executor (if exists)
- [ ] Instrument other tool executors (HTTP, Database, File, etc.)

### ⏭️ Phase 3.6: Integrate Trace IDs with Supabase Logs
- [x] Ensure `trace_id` is propagated to all database logs
- [x] Link `event_logs.trace_id` to OpenTelemetry traces
- [x] Link `agent_trace_history.trace_id` to OpenTelemetry traces
- [x] Link `model_cost_logs.trace_id` to OpenTelemetry traces

### ⏭️ Phase 3.7: Set Up Signoz
- [ ] Deploy Signoz (Docker or cloud)
- [ ] Configure OTLP receiver
- [ ] Set up dashboards for traces
- [ ] Configure alerting rules
- [ ] Test trace visualization

---

## Files Created/Modified

**Created:**
- `backend/src/config/telemetry.ts` - OpenTelemetry configuration

**Modified:**
- `backend/src/index.ts` - Telemetry initialization and shutdown
- `backend/src/services/workflowExecutor.ts` - Workflow and node spans
- `backend/src/services/nodeExecutors/agent.ts` - Agent execution spans
- `backend/src/services/nodeExecutors/llm.ts` - LLM execution spans
- `backend/src/services/nodeExecutors/connector.ts` - Connector execution spans
- `backend/src/services/observabilityService.ts` - Trace ID integration
- `backend/package.json` - OpenTelemetry dependencies
- `README.md` - Environment variables documentation

---

## Next Steps

1. **Test OpenTelemetry** - Verify traces are being generated
2. **Instrument remaining executors** - RAG, HTTP, Database, File nodes
3. **Set up Signoz** - Deploy and configure for trace visualization
4. **Test trace correlation** - Verify trace IDs link database logs to traces

---

**Status:** 🚧 **IN PROGRESS** (Core instrumentation complete, remaining executors pending)

