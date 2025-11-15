# Deployment Checklist for Custom Code PRD Features

This checklist provides step-by-step instructions for deploying all Phase 1-4 features to production.

## Pre-Deployment

### 1. Database Migrations
- [ ] Review all migrations in `backend/drizzle/migrations/`
- [ ] Run migrations in staging: `npm run db:migrate`
- [ ] Verify tables created:
  - `model_cost_logs`
  - `prompt_similarity_logs`
  - `event_logs`
  - `feature_flags`
- [ ] Test rollback procedures

### 2. Environment Variables

#### Required
- [ ] `DATABASE_URL`: PostgreSQL connection string
- [ ] `REDIS_URL`: Redis connection string (optional but recommended)

#### Optional (for full functionality)
- [ ] `LANGFUSE_PUBLIC_KEY`: Langfuse public key
- [ ] `LANGFUSE_SECRET_KEY`: Langfuse secret key
- [ ] `LANGFUSE_HOST`: Langfuse host URL
- [ ] `RUDDERSTACK_WRITE_KEY`: RudderStack write key
- [ ] `RUDDERSTACK_DATA_PLANE_URL`: RudderStack data plane URL
- [ ] `STACKSTORM_API_URL`: StackStorm API URL
- [ ] `STACKSTORM_API_KEY`: StackStorm API key
- [ ] `ENABLE_STACKSTORM`: Enable StackStorm (true/false)

#### RudderStack Configuration (Optional)
- [ ] `RUDDERSTACK_MAX_RETRIES`: Max retries (default: 3)
- [ ] `RUDDERSTACK_RETRY_DELAY`: Retry delay in ms (default: 1000)
- [ ] `RUDDERSTACK_BATCH_SIZE`: Batch size (default: 20)
- [ ] `RUDDERSTACK_FLUSH_INTERVAL`: Flush interval in ms (default: 10000)

### 3. External Services Setup

#### Langfuse (Optional)
- [ ] Create Langfuse account
- [ ] Create project and get API keys
- [ ] Configure environment variables
- [ ] Test connection

#### RudderStack (Optional)
- [ ] Create RudderStack account
- [ ] Create source and get write key
- [ ] Configure destinations (data warehouse)
- [ ] Test event forwarding

#### StackStorm (Optional)
- [ ] Deploy StackStorm infrastructure
- [ ] Install `synthralos` pack
- [ ] Configure API credentials
- [ ] Test workflow execution
- [ ] See `backend/docs/STACKSTORM_SETUP.md` for details

### 4. Redis Setup (Recommended)
- [ ] Deploy Redis instance
- [ ] Configure connection string
- [ ] Test connection
- [ ] Verify rate limiting works
- [ ] Verify cron backoff storage

## Feature Flag Configuration

### Phase 1: Foundation
- [ ] `track_model_costs`: Enable cost tracking (default: false)
- [ ] `enable_similarity_logging`: Enable similarity logging (default: false)

### Phase 2: Observability
- [ ] `enable_langfuse_export`: Enable Langfuse export (default: false)
- [ ] `enable_async_trace_export`: Enable async processing (default: true)

### Phase 3: Advanced Routing
- [ ] `enable_archgw_routing`: Enable ArchGW routing (default: false)
- [ ] `enable_policy_engine`: Enable policy engine (default: false)
- [ ] `enable_rate_limiting`: Enable rate limiting (default: false)
- [ ] `enable_guardrails_ai`: Enable GuardrailsAI (default: false)

### Phase 4: Self-Healing
- [ ] `enable_stackstorm`: Enable StackStorm (default: false)
- [ ] `enable_stackstorm_retry`: Use StackStorm for retries (default: false)
- [ ] `enable_stackstorm_reroute`: Use StackStorm for rerouting (default: false)
- [ ] `enable_stackstorm_repair_execution`: Use StackStorm for repairs (default: false)
- [ ] `enable_cron_backoff`: Enable cron backoffs (default: false)

**Recommendation**: Enable features gradually, starting with Phase 1, then Phase 2, then Phase 3, and finally Phase 4.

## Deployment Steps

### Step 1: Deploy Code
- [ ] Pull latest code from main branch
- [ ] Install dependencies: `npm install`
- [ ] Build frontend: `npm run build` (if applicable)
- [ ] Run database migrations: `npm run db:migrate`
- [ ] Deploy to staging environment

### Step 2: Verify Core Functionality
- [ ] Test basic agent execution
- [ ] Verify database connections
- [ ] Check service health endpoints
- [ ] Verify logging is working

### Step 3: Enable Phase 1 Features
- [ ] Enable `track_model_costs` for test workspace
- [ ] Execute LLM call and verify cost log created
- [ ] Enable `enable_similarity_logging` for test workspace
- [ ] Execute prompt and verify similarity log created
- [ ] Check database for logs

### Step 4: Enable Phase 2 Features
- [ ] Configure Langfuse (if using)
- [ ] Enable `enable_langfuse_export` for test workspace
- [ ] Execute agent and verify trace in Langfuse
- [ ] Test trace viewer in frontend
- [ ] Test JSON export functionality

### Step 5: Enable Phase 3 Features
- [ ] Enable `enable_archgw_routing` for test workspace
- [ ] Test routing decisions
- [ ] Enable `enable_policy_engine` for test workspace
- [ ] Create test policy and verify evaluation
- [ ] Enable `enable_rate_limiting` for test workspace
- [ ] Test rate limiting behavior

### Step 6: Enable Phase 4 Features
- [ ] Configure RudderStack (if using)
- [ ] Verify events are being forwarded
- [ ] Configure StackStorm (if using)
- [ ] Deploy StackStorm pack
- [ ] Enable StackStorm features gradually
- [ ] Test self-healing workflows

### Step 7: Monitor and Validate
- [ ] Monitor error logs
- [ ] Check queue statistics: `rudderstackService.getQueueStats()`
- [ ] Verify observability metrics
- [ ] Check cost logs are accurate
- [ ] Verify similarity logs are working
- [ ] Monitor performance metrics

## Post-Deployment

### Monitoring
- [ ] Set up alerts for error rates
- [ ] Monitor queue sizes
- [ ] Track cost trends
- [ ] Monitor similarity detection rates
- [ ] Check StackStorm execution success rates

### Performance Monitoring
- [ ] Measure observability overhead
- [ ] Track p95 latency
- [ ] Monitor queue processing times
- [ ] Check database query performance
- [ ] Monitor Redis usage

### Rollback Plan
- [ ] Document rollback procedures
- [ ] Test feature flag disabling
- [ ] Verify graceful degradation
- [ ] Test database migration rollback

## Testing Checklist

### Unit Tests
- [ ] Cost calculation accuracy
- [ ] Similarity score calculations
- [ ] Policy evaluation logic
- [ ] Rate limiting logic
- [ ] Retry logic

### Integration Tests
- [ ] End-to-end agent execution
- [ ] Cost logging flow
- [ ] Similarity detection flow
- [ ] Policy evaluation flow
- [ ] RudderStack event forwarding
- [ ] StackStorm workflow execution

### Load Tests (Recommended)
- [ ] Test with expected production load
- [ ] Measure observability overhead
- [ ] Test queue processing under load
- [ ] Verify no memory leaks
- [ ] Test rate limiting under load

## Troubleshooting

### Common Issues

#### Cost Logs Not Appearing
- Check `track_model_costs` feature flag
- Verify database connection
- Check error logs for failures

#### Similarity Logs Not Appearing
- Check `enable_similarity_logging` feature flag
- Verify embedding generation is working
- Check database connection

#### RudderStack Events Not Sending
- Verify `RUDDERSTACK_WRITE_KEY` is set
- Check queue statistics
- Review error logs
- Verify network connectivity

#### StackStorm Not Working
- Verify `ENABLE_STACKSTORM` is true
- Check API credentials
- Verify StackStorm service is running
- Check pack is installed

#### High Overhead
- Reduce batch sizes
- Increase flush intervals
- Disable non-critical features
- Check for blocking operations

## Support Resources

- **Documentation**: See `backend/docs/` for detailed docs
- **Implementation Status**: See `IMPLEMENTATION_STATUS.md`
- **Phase 4 Details**: See `backend/docs/PHASE4_IMPLEMENTATION.md`
- **StackStorm Setup**: See `backend/docs/STACKSTORM_SETUP.md`

## Success Criteria

- [ ] All features working in staging
- [ ] Performance within acceptable limits
- [ ] No critical errors in logs
- [ ] Cost tracking accurate
- [ ] Similarity detection working
- [ ] Observability data flowing
- [ ] RudderStack events forwarding (if enabled)
- [ ] StackStorm workflows executing (if enabled)
- [ ] Team trained on new features
- [ ] Documentation complete

## Next Steps After Deployment

1. **Monitor for 24-48 hours** in staging
2. **Gradually enable features** in production
3. **Collect performance metrics**
4. **Optimize based on real-world usage**
5. **Plan load testing** (Phase 4.13)
6. **Optimize performance** (Phase 4.14)

