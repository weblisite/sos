# Signoz Setup Guide

This guide explains how to set up Signoz for distributed tracing with the SOS platform.

## Option 1: Signoz Cloud (Recommended)

Signoz Cloud is the easiest way to get started. It's a managed service that handles all the infrastructure.

### Steps:

1. **Sign up for Signoz Cloud**
   - Visit https://signoz.io/cloud
   - Create a free account
   - You'll get a cloud instance URL (e.g., `https://your-org.signoz.io`)

2. **Get your OTLP endpoint**
   - In Signoz Cloud dashboard, go to Settings → Ingestion
   - Copy your OTLP HTTP endpoint (e.g., `https://ingest.signoz.io:443/v1/traces`)

3. **Configure backend environment variables**
   ```env
   OTEL_ENABLED=true
   OTEL_SERVICE_NAME=sos-backend
   OTEL_SERVICE_VERSION=1.0.0
   OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.signoz.io:443
   OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://ingest.signoz.io:443/v1/traces
   OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=https://ingest.signoz.io:443/v1/metrics
   ```

4. **Add authentication headers (if required)**
   ```env
   OTEL_EXPORTER_OTLP_HEADERS={"signoz-access-token":"your-token-here"}
   ```

5. **Restart your backend server**
   ```bash
   cd backend
   npm run dev
   ```

6. **Verify traces are being sent**
   - Go to your Signoz Cloud dashboard
   - Navigate to Traces section
   - Execute a workflow in your platform
   - You should see traces appearing in real-time

---

## Option 2: Local Signoz Installation (Without Docker)

If you prefer to run Signoz locally without Docker, you can use the standalone binary or install components individually.

### Prerequisites:
- Go 1.19+ (for building Signoz)
- ClickHouse (for storage)
- Or use Signoz's all-in-one binary

### Quick Start with Signoz Binary:

1. **Download Signoz binary**
   ```bash
   # For macOS
   curl -L https://github.com/SigNoz/signoz/releases/latest/download/signoz-darwin-amd64 -o signoz
   chmod +x signoz
   
   # For Linux
   curl -L https://github.com/SigNoz/signoz/releases/latest/download/signoz-linux-amd64 -o signoz
   chmod +x signoz
   ```

2. **Run Signoz**
   ```bash
   ./signoz
   ```
   
   This will start Signoz on:
   - UI: http://localhost:3301
   - OTLP HTTP: http://localhost:4318
   - OTLP gRPC: http://localhost:4317

3. **Configure backend environment variables**
   ```env
   OTEL_ENABLED=true
   OTEL_SERVICE_NAME=sos-backend
   OTEL_SERVICE_VERSION=1.0.0
   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
   OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
   OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics
   ```

4. **Restart backend and test**
   ```bash
   cd backend
   npm run dev
   ```

---

## Option 3: Disable OpenTelemetry (Development)

If you don't need tracing right now, you can disable it:

```env
OTEL_ENABLED=false
```

The backend will still function normally, just without distributed tracing.

---

## Verifying Setup

### Check Backend Logs

When OpenTelemetry is properly initialized, you should see:
```
✅ OpenTelemetry initialized
   Service: sos-backend v1.0.0
   Environment: development
   Traces endpoint: http://localhost:4318/v1/traces
   Metrics endpoint: http://localhost:4318/v1/metrics
```

### Test Trace Generation

1. **Execute a workflow** in your platform
2. **Check Signoz dashboard** for traces
3. **Look for spans** with names like:
   - `workflow.execute`
   - `node.execute.llm`
   - `node.execute.agent`
   - `node.execute.connector`
   - `llm.generate`
   - `agent.execute`
   - `connector.execute`
   - `rag.execute`

### Trace Attributes to Look For

Each trace should include:
- **Workflow attributes**: `workflow.id`, `workflow.execution_id`, `workflow.step_mode`
- **Node attributes**: `node.id`, `node.type`, `node.status`, `node.latency_ms`
- **User context**: `user.id`, `organization.id`, `workspace.id`
- **LLM attributes**: `llm.provider`, `llm.model`, `llm.tokens_used`, `llm.cost_usd`
- **Agent attributes**: `agent.framework`, `agent.type`, `agent.iterations`
- **Connector attributes**: `connector.id`, `connector.action`, `connector.provider`

---

## Troubleshooting

### Traces not appearing in Signoz

1. **Check OpenTelemetry is enabled**
   ```bash
   # In backend logs, look for:
   ✅ OpenTelemetry initialized
   ```

2. **Verify endpoint is correct**
   - Test OTLP endpoint with curl:
   ```bash
   curl -X POST http://localhost:4318/v1/traces \
     -H "Content-Type: application/json" \
     -d '{"resourceSpans":[]}'
   ```

3. **Check network connectivity**
   - Ensure backend can reach Signoz endpoint
   - Check firewall rules

4. **Review backend logs**
   - Look for OpenTelemetry errors
   - Check for span export failures

### High memory usage

OpenTelemetry batches spans before sending. If you see high memory:
- Reduce `maxQueueSize` in `backend/src/config/telemetry.ts`
- Reduce `maxExportBatchSize`
- Increase `scheduledDelayMillis` to send batches more frequently

---

## Next Steps

Once Signoz is set up:

1. **Create Dashboards**
   - Workflow execution time
   - Error rates by workflow/node type
   - LLM cost tracking
   - Agent performance metrics

2. **Set Up Alerts**
   - High error rates
   - Slow workflow executions
   - High LLM costs

3. **Explore Traces**
   - Use trace search to find specific executions
   - Filter by user, organization, or workflow
   - Analyze performance bottlenecks

---

## Additional Resources

- [Signoz Documentation](https://signoz.io/docs/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [OTLP Protocol](https://opentelemetry.io/docs/specs/otlp/)

---

**Note**: For production deployments, we recommend using Signoz Cloud for reliability and scalability.

