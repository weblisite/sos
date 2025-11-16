# Telemetry & Governance Implementation Plan

**Version:** 1.0  
**Date:** 2024-12-19  
**Status:** Ready for Implementation  
**Exclusions:** Panora (not required)

---

## Executive Summary

This plan implements the Telemetry & Governance PRD requirements **excluding Panora**. All features will be implemented using existing services and new integrations where needed.

**Timeline:** 8 weeks  
**Risk Level:** 🟢 LOW (additive implementation)  
**Breaking Changes:** None

---

## Implementation Phases

### Phase 1: Foundation & Fixes (Week 1-2)
**Goal:** Fix existing issues and establish foundation

### Phase 2: Core Telemetry Enhancements (Week 3-4)
**Goal:** Enhance OpenTelemetry, add Langfuse, improve observability

### Phase 3: Guardrails & Routing (Week 5-6)
**Goal:** Implement ArchGW routing layer, enhance guardrails

### Phase 4: Recovery & Integration (Week 7-8)
**Goal:** Add StackStorm, complete event pipeline, optimize performance

---

## Phase 1: Foundation & Fixes (Week 1-2)

### 1.1 Fix OpenTelemetry Initialization
**Priority:** 🔴 CRITICAL  
**Effort:** 2-4 hours  
**Dependencies:** None

**Tasks:**
- Fix Resource initialization error
- Verify Signoz connectivity
- Test OTLP export
- Add error handling

**Acceptance Criteria:**
- OpenTelemetry initializes without errors
- Spans are exported to Signoz
- No performance degradation

---

### 1.2 Enhance Cost Tracking
**Priority:** 🟡 HIGH  
**Effort:** 1 day  
**Dependencies:** 1.1

**Tasks:**
- Create `model_cost_logs` table migration
- Add cost calculation service
- Track token usage per LLM call
- Calculate USD cost per model
- Add cost aggregation queries

**Acceptance Criteria:**
- All LLM calls logged with cost
- Cost per agent/workflow tracked
- Cost dashboard available

---

### 1.3 Add Cosine Similarity Calculation
**Priority:** 🟡 HIGH  
**Effort:** 1 day  
**Dependencies:** None

**Tasks:**
- Create `prompt_sim_logs` table migration
- Implement cosine similarity calculation
- Add embedding generation for prompts
- Create similarity detection service
- Add abuse detection based on similarity

**Acceptance Criteria:**
- Prompts compared for similarity
- Similar prompts detected and logged
- Abuse patterns identified

---

### 1.4 Enhance Guardrails Service
**Priority:** 🟡 HIGH  
**Effort:** 2 days  
**Dependencies:** 1.3

**Tasks:**
- Add prompt length checks
- Add region-based routing logic
- Add cost tiering logic (free plan → GPT-3.5)
- Add compliance routing (EU data → EU clusters)
- Integrate cosine similarity checks

**Acceptance Criteria:**
- Prompts routed based on length/region/cost
- Abuse patterns blocked
- Compliance routing working

---

## Phase 2: Core Telemetry Enhancements (Week 3-4)

### 2.1 Langfuse Integration
**Priority:** 🟡 HIGH  
**Effort:** 3 days  
**Dependencies:** 1.1

**Tasks:**
- Install Langfuse SDK
- Create Langfuse service wrapper
- Add trace export to Langfuse
- Create customer-facing trace UI
- Add agent "thoughts" export
- Add JSON export functionality

**Acceptance Criteria:**
- Traces exported to Langfuse
- Customer can view traces in UI
- Agent thoughts visible
- JSON export working

---

### 2.2 Enhance Observability Service
**Priority:** 🟡 MEDIUM  
**Effort:** 2 days  
**Dependencies:** 1.2, 2.1

**Tasks:**
- Add Langfuse trace linking
- Enhance span attributes
- Add cost tracking to spans
- Add similarity scores to spans
- Improve error tracking

**Acceptance Criteria:**
- Spans include cost and similarity data
- Errors properly tracked
- Traces linked to Langfuse

---

### 2.3 Performance Optimization
**Priority:** 🟡 MEDIUM  
**Effort:** 2 days  
**Dependencies:** 1.1, 2.1

**Tasks:**
- Measure current overhead
- Optimize span creation
- Add async processing for exports
- Implement batching for Langfuse
- Add performance monitoring

**Acceptance Criteria:**
- Overhead < 150ms p95
- Async processing working
- Performance metrics tracked

---

### 2.4 Customer Trace Surface
**Priority:** 🟡 MEDIUM  
**Effort:** 2 days  
**Dependencies:** 2.1

**Tasks:**
- Create trace viewer component
- Add trace filtering
- Add trace search
- Add trace export (JSON)
- Add trace sharing

**Acceptance Criteria:**
- Customers can view their traces
- Traces searchable and filterable
- JSON export working
- Sharing functionality available

---

## Phase 3: Guardrails & Routing (Week 5-6)

### 3.1 ArchGW Routing Layer
**Priority:** 🟡 HIGH  
**Effort:** 1 week  
**Dependencies:** 1.4

**Tasks:**
- Create ArchGW service
- Implement prompt routing logic
- Add model selection based on criteria
- Add region-based routing
- Add cost-based routing
- Add compliance routing
- Integrate with existing guardrails

**Acceptance Criteria:**
- Prompts routed correctly
- Model selection working
- Region compliance enforced
- Cost optimization working

---

### 3.2 GuardrailsAI Integration
**Priority:** 🟡 MEDIUM  
**Effort:** 2 days  
**Dependencies:** 1.4

**Tasks:**
- Install GuardrailsAI library
- Create GuardrailsAI service wrapper
- Add JSON schema validation
- Add policy validation
- Integrate with prompt gateway
- Add validation results to spans

**Acceptance Criteria:**
- GuardrailsAI validating prompts
- JSON schemas enforced
- Policies applied
- Validation results logged

---

### 3.3 Enhanced Abuse Detection
**Priority:** 🟡 MEDIUM  
**Effort:** 2 days  
**Dependencies:** 1.3, 3.1

**Tasks:**
- Enhance pattern matching
- Add ML-based abuse detection
- Add rate limiting per user
- Add IP-based blocking
- Add alerting for abuse

**Acceptance Criteria:**
- Abuse detected accurately (≥98%)
- Rate limiting working
- Alerts sent on abuse
- Blocked prompts logged

---

### 3.4 Prompt Gateway Policies
**Priority:** 🟡 MEDIUM  
**Effort:** 2 days  
**Dependencies:** 3.1

**Tasks:**
- Create policy engine
- Add policy configuration UI
- Add policy testing
- Add policy versioning
- Add policy audit logs

**Acceptance Criteria:**
- Policies configurable
- Policies testable
- Policy changes audited
- Policy versioning working

---

## Phase 4: Recovery & Integration (Week 7-8)

### 4.1 StackStorm Integration
**Priority:** 🟡 MEDIUM  
**Effort:** 1 week  
**Dependencies:** None (can run alongside self-healing)

**Tasks:**
- Install StackStorm
- Create StackStorm service wrapper
- Create recovery workflows
- Add retry logic
- Add reroute logic
- Add cron backoffs
- Integrate with BullMQ

**Acceptance Criteria:**
- StackStorm installed and running
- Recovery workflows working
- Retries and reroutes working
- Cron backoffs implemented

---

### 4.2 Enhanced Recovery Orchestrator
**Priority:** 🟡 MEDIUM  
**Effort:** 2 days  
**Dependencies:** 4.1

**Tasks:**
- Enhance self-healing service
- Add StackStorm integration
- Add escalation logic
- Add alerting for failures
- Add recovery metrics

**Acceptance Criteria:**
- Recovery success ≥95% (first retry)
- Escalation working
- Alerts sent on failures
- Metrics tracked

---

### 4.3 Event Pipeline Integration
**Priority:** 🟡 MEDIUM  
**Effort:** 2 days  
**Dependencies:** 1.2, 2.1

**Tasks:**
- Wire up Observability → RudderStack
- Wire up Cost Logs → Warehouse
- Wire up Similarity Logs → Warehouse
- Add event batching
- Add event retry logic

**Acceptance Criteria:**
- All events forwarded to RudderStack
- Cost logs in warehouse
- Similarity logs in warehouse
- Event pipeline reliable

---

### 4.4 Performance Testing & Optimization
**Priority:** 🟡 HIGH  
**Effort:** 2 days  
**Dependencies:** All previous phases

**Tasks:**
- Load testing
- Performance profiling
- Overhead measurement
- Optimization
- Documentation

**Acceptance Criteria:**
- Overhead < 150ms p95
- System stable under load
- Performance documented

---

## Database Schema Changes

### New Tables

1. **`model_cost_logs`**
   - `id`, `agent_id`, `workflow_execution_id`, `node_id`
   - `model`, `provider`, `tokens_input`, `tokens_output`
   - `usd_cost`, `created_at`

2. **`prompt_sim_logs`**
   - `id`, `prompt_hash`, `similarity_score`
   - `matched_prompt_hash`, `blocked`, `user_id`
   - `organization_id`, `created_at`

3. **`governance_events`**
   - `id`, `event_type`, `policy`, `action`
   - `user_id`, `organization_id`, `details`
   - `created_at`

### Enhanced Tables

1. **`event_logs`** - Add cost, similarity fields
2. **`code_exec_logs`** - Add cost, similarity fields
3. **`audit_logs`** - Add governance event fields

---

## API Endpoints

### New Endpoints

1. **`GET /api/v1/traces`** - List customer traces
2. **`GET /api/v1/traces/:id`** - Get trace details
3. **`GET /api/v1/traces/:id/export`** - Export trace as JSON
4. **`GET /api/v1/cost-logs`** - Query cost logs
5. **`GET /api/v1/similarity-logs`** - Query similarity logs
6. **`POST /api/v1/governance/policies`** - Create policy
7. **`GET /api/v1/governance/policies`** - List policies
8. **`POST /api/v1/recovery/retry`** - Trigger recovery

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Trace overhead | < 150ms p95 | Signoz span latency |
| Prompt rejection accuracy | ≥ 98% | Abuse test suite |
| Cost log completeness | 100% | model_cost_logs table |
| Recovery success (first retry) | ≥ 95% | StackStorm run status |
| Customer trace availability | 99.9% | Langfuse uptime |

---

## Risk Mitigation

### Technical Risks

1. **Performance Overhead**
   - Mitigation: Async processing, batching, optimization
   - Monitoring: Performance metrics tracked

2. **Integration Complexity**
   - Mitigation: Feature flags, gradual rollout
   - Testing: Comprehensive integration tests

3. **Data Volume**
   - Mitigation: Retention policies, aggregation
   - Monitoring: Storage usage tracked

### Operational Risks

1. **Service Dependencies**
   - Mitigation: Graceful degradation, fallbacks
   - Monitoring: Health checks

2. **Cost Overruns**
   - Mitigation: Cost tracking, alerts, limits
   - Monitoring: Cost dashboards

---

## Testing Strategy

### Unit Tests
- All new services
- All new utilities
- All new validators

### Integration Tests
- OpenTelemetry → Signoz
- Observability → Langfuse
- Guardrails → ArchGW
- Recovery → StackStorm

### Performance Tests
- Overhead measurement
- Load testing
- Stress testing

### End-to-End Tests
- Full workflow execution
- Trace visibility
- Cost tracking
- Recovery flows

---

## Documentation

### Technical Documentation
- Architecture diagrams
- API documentation
- Service documentation
- Configuration guides

### User Documentation
- Trace viewing guide
- Cost tracking guide
- Policy configuration guide
- Recovery guide

---

## Rollout Plan

### Week 1-2: Foundation
- Fix OpenTelemetry
- Add cost tracking
- Add similarity calculation

### Week 3-4: Core Features
- Langfuse integration
- Enhanced observability
- Performance optimization

### Week 5-6: Guardrails
- ArchGW routing
- GuardrailsAI
- Enhanced abuse detection

### Week 7-8: Recovery & Integration
- StackStorm integration
- Event pipeline
- Performance testing

### Week 9: GA
- Full rollout
- Documentation
- Training

---

**Last Updated:** 2024-12-19  
**Status:** Ready for Implementation

