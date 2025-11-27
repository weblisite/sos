# Complete API Keys List - SynthralOS Platform

**Generated:** 2024-12-27  
**Method:** Systematic codebase analysis

This document lists **ALL** API keys found in the codebase through systematic analysis.

---

## 🔴 **REQUIRED** (Platform won't work without these)

### Core Infrastructure
1. **`DATABASE_URL`** - PostgreSQL connection string
   - **File:** `backend/src/config/database.ts`
   - **Required:** YES (throws error if missing)
   - **Format:** `postgresql://user:password@host:5432/database`

2. **`REDIS_URL`** - Redis connection string
   - **File:** `backend/src/config/redis.ts`
   - **Required:** YES (defaults to `redis://localhost:6379` but needed for production)
   - **Format:** `redis://user:password@host:6379`

3. **`CLERK_SECRET_KEY`** - Clerk secret key
   - **File:** `backend/src/config/clerk.ts`
   - **Required:** YES (throws error if missing)
   - **Get from:** https://dashboard.clerk.com

4. **`CLERK_PUBLISHABLE_KEY`** - Clerk publishable key
   - **File:** `backend/src/config/clerk.ts`
   - **Required:** YES (for frontend)
   - **Get from:** https://dashboard.clerk.com
   - **Frontend:** Also needs `VITE_CLERK_PUBLISHABLE_KEY` (same value)

---

## 🟠 **HIGHLY RECOMMENDED** (Core features need these)

### OAuth & Integrations
5. **`NANGO_SECRET_KEY`** - Nango secret key for OAuth
   - **File:** `backend/src/config/nango.ts`
   - **Required:** YES for 57+ OAuth connectors (Slack, GitHub, Salesforce, etc.)
   - **Get from:** https://nango.dev
   - **Note:** Without this, OAuth connectors will NOT work

6. **`NANGO_HOST`** - Nango API host
   - **File:** `backend/src/config/nango.ts`
   - **Default:** `https://api.nango.dev`
   - **Required:** Only if using custom Nango instance

### AI Providers (At least one required for AI features)
7. **`OPENAI_API_KEY`** - OpenAI API key
   - **Files:** 
     - `backend/src/services/agentService.ts`
     - `backend/src/services/langchainService.ts`
     - `backend/src/services/nodeExecutors/rag.ts`
   - **Required:** YES for OpenAI-based AI features
   - **Get from:** https://platform.openai.com/api-keys
   - **Used for:** AI agents, LLM nodes, RAG pipeline, code generation

8. **`ANTHROPIC_API_KEY`** - Anthropic API key
   - **Files:**
     - `backend/src/services/agentService.ts`
     - `backend/src/services/langchainService.ts`
     - `backend/src/services/nodeExecutors/rag.ts`
   - **Required:** YES for Anthropic-based AI features
   - **Get from:** https://console.anthropic.com/settings/keys
   - **Used for:** AI agents, LLM nodes, RAG pipeline

### Email Service
9. **`RESEND_API_KEY`** - Resend API key
   - **File:** `backend/src/services/nodeExecutors/email.ts`
   - **Required:** YES for email sending
   - **Get from:** https://resend.com/api-keys

10. **`RESEND_FROM_EMAIL`** - Resend from email address
    - **File:** `backend/src/services/nodeExecutors/email.ts`
    - **Required:** For email sending

### Supabase (For code blob storage)
11. **`SUPABASE_URL`** - Supabase project URL
    - **Files:**
      - `backend/src/services/storageService.ts`
      - `backend/src/services/nodeExecutors/connectors/supabase.ts`
    - **Required:** YES for code blob storage
    - **Get from:** Your Supabase project settings

12. **`SUPABASE_ANON_KEY`** - Supabase anonymous key
    - **Files:**
      - `backend/src/services/storageService.ts`
      - `backend/src/services/nodeExecutors/connectors/supabase.ts`
    - **Required:** YES for code blob storage
    - **Get from:** Your Supabase project settings

13. **`SUPABASE_SERVICE_ROLE_KEY`** - Supabase service role key
    - **Files:**
      - `backend/src/services/storageService.ts`
      - `backend/src/services/nodeExecutors/connectors/supabase.ts`
    - **Required:** YES for code blob storage
    - **Get from:** Your Supabase project settings

---

## 🟡 **OPTIONAL** (Feature-specific keys)

### Vector Store Providers (For RAG pipeline)
14. **`PINECONE_API_KEY`** - Pinecone API key
    - **File:** `backend/src/services/nodeExecutors/rag.ts`
    - **Required:** Only if using Pinecone for vector storage
    - **Get from:** https://app.pinecone.io

### Web Search Tools (For AI agents)
15. **`SERPAPI_API_KEY`** - SerpAPI key
    - **File:** `backend/src/services/langtoolsService.ts`
    - **Required:** Only if using SerpAPI for web search in agents
    - **Get from:** https://serpapi.com/dashboard
    - **Alternative:** DuckDuckGo (free, no key needed)

16. **`BRAVE_API_KEY`** - Brave Search API key
    - **File:** `backend/src/services/langtoolsService.ts`
    - **Required:** Only if using Brave Search for web search in agents
    - **Get from:** https://brave.com/search/api

### OSINT / Social Media Monitoring
17. **`TWITTER_BEARER_TOKEN`** - Twitter API bearer token
    - **File:** `backend/src/services/osintService.ts`
    - **Required:** Only for Twitter monitoring
    - **Get from:** https://developer.twitter.com

18. **`NEWS_API_KEY`** - NewsAPI key
    - **File:** `backend/src/services/osintService.ts`
    - **Required:** Only for news monitoring
    - **Get from:** https://newsapi.org/register

19. **`GITHUB_TOKEN`** - GitHub personal access token
    - **File:** `backend/src/services/osintService.ts`
    - **Required:** Only for GitHub monitoring
    - **Get from:** https://github.com/settings/tokens

### Code Execution
20. **`E2B_API_KEY`** - E2B API key
    - **Files:**
      - `backend/src/services/runtimes/e2bRuntime.ts`
      - `backend/src/services/nodeExecutors/__tests__/code.integration.test.ts`
    - **Required:** Only for ultra-fast code execution (<50ms latency)
    - **Get from:** https://e2b.dev
    - **Alternative:** Uses local execution if not provided

21. **`PYTHON_SERVICE_URL`** - Python service URL
    - **File:** `backend/src/services/nodeExecutors/code.ts`
    - **Required:** Only if using external Python service
    - **Note:** Platform can execute Python locally if not provided

22. **`PYTHON_ALLOWED_PACKAGES`** - Comma-separated list of allowed Python packages
    - **File:** `backend/src/services/nodeExecutors/code.ts`
    - **Required:** Only for Python package restrictions

### Browser Automation
23. **`BROWSERBASE_API_KEY`** - Browserbase API key
    - **File:** `backend/src/services/browserbaseService.ts`
    - **Required:** Only if using Browserbase for cloud browser automation
    - **Get from:** https://browserbase.com

24. **`BROWSERBASE_PROJECT_ID`** - Browserbase project ID
    - **File:** `backend/src/services/browserbaseService.ts`
    - **Required:** Only if using Browserbase

25. **`BROWSERBASE_BASE_URL`** - Browserbase base URL
    - **File:** `backend/src/services/browserbaseService.ts`
    - **Required:** Only if using Browserbase

### Email OAuth (For email triggers)
26. **`GMAIL_CLIENT_ID`** - Gmail OAuth client ID
    - **Files:**
      - `backend/src/routes/emailOAuth.ts`
      - `backend/src/services/emailTriggerService.ts`
    - **Required:** Only for Gmail email triggers
    - **Get from:** https://console.cloud.google.com

27. **`GMAIL_CLIENT_SECRET`** - Gmail OAuth client secret
    - **Files:**
      - `backend/src/routes/emailOAuth.ts`
      - `backend/src/services/emailTriggerService.ts`
    - **Required:** Only for Gmail email triggers
    - **Get from:** https://console.cloud.google.com

28. **`OUTLOOK_CLIENT_ID`** - Outlook OAuth client ID
    - **Files:**
      - `backend/src/routes/emailOAuth.ts`
      - `backend/src/services/emailTriggerService.ts`
    - **Required:** Only for Outlook email triggers
    - **Get from:** https://portal.azure.com

29. **`OUTLOOK_CLIENT_SECRET`** - Outlook OAuth client secret
    - **Files:**
      - `backend/src/routes/emailOAuth.ts`
      - `backend/src/services/emailTriggerService.ts`
    - **Required:** Only for Outlook email triggers
    - **Get from:** https://portal.azure.com

### Analytics & Monitoring
30. **`POSTHOG_API_KEY`** - PostHog API key
    - **Files:**
      - `backend/src/services/posthogService.ts`
      - `backend/src/services/featureFlagService.ts`
    - **Required:** Only if using PostHog analytics
    - **Get from:** https://app.posthog.com

31. **`POSTHOG_HOST`** - PostHog host
    - **Files:**
      - `backend/src/services/posthogService.ts`
      - `backend/src/services/featureFlagService.ts`
    - **Default:** `https://app.posthog.com`
    - **Required:** Only if using PostHog

32. **`RUDDERSTACK_WRITE_KEY`** - RudderStack write key
    - **File:** `backend/src/services/rudderstackService.ts`
    - **Required:** Only if using RudderStack
    - **Get from:** https://app.rudderstack.com

33. **`RUDDERSTACK_DATA_PLANE_URL`** - RudderStack data plane URL
    - **File:** `backend/src/services/rudderstackService.ts`
    - **Default:** `https://hosted.rudderlabs.com`
    - **Required:** Only if using RudderStack

34. **`RUDDERSTACK_BATCH_SIZE`** - RudderStack batch size
    - **File:** `backend/src/services/rudderstackService.ts`
    - **Optional:** Configuration

35. **`RUDDERSTACK_FLUSH_INTERVAL`** - RudderStack flush interval
    - **File:** `backend/src/services/rudderstackService.ts`
    - **Optional:** Configuration

36. **`RUDDERSTACK_MAX_RETRIES`** - RudderStack max retries
    - **File:** `backend/src/services/rudderstackService.ts`
    - **Optional:** Configuration

37. **`RUDDERSTACK_RETRY_DELAY`** - RudderStack retry delay
    - **File:** `backend/src/services/rudderstackService.ts`
    - **Optional:** Configuration

### Langfuse (LLM Observability)
38. **`LANGFUSE_SECRET_KEY`** - Langfuse secret key
    - **File:** `backend/src/services/langfuseService.ts`
    - **Required:** Only if using Langfuse
    - **Get from:** https://langfuse.com

39. **`LANGFUSE_PUBLIC_KEY`** - Langfuse public key
    - **File:** `backend/src/services/langfuseService.ts`
    - **Required:** Only if using Langfuse

40. **`LANGFUSE_HOST`** - Langfuse host
    - **File:** `backend/src/services/langfuseService.ts`
    - **Required:** Only if using Langfuse

41. **`LANGFUSE_BATCH_SIZE`** - Langfuse batch size
    - **File:** `backend/src/services/langfuseService.ts`
    - **Optional:** Configuration

42. **`LANGFUSE_BATCH_INTERVAL_MS`** - Langfuse batch interval
    - **File:** `backend/src/services/langfuseService.ts`
    - **Optional:** Configuration

### OpenTelemetry (Distributed Tracing)
43. **`OTEL_ENABLED`** - Enable OpenTelemetry
    - **File:** `backend/src/config/telemetry.ts`
    - **Default:** `true`
    - **Required:** Only if using OpenTelemetry

44. **`OTEL_SERVICE_NAME`** - OpenTelemetry service name
    - **File:** `backend/src/config/telemetry.ts`
    - **Default:** `sos-backend`
    - **Optional:** Configuration

45. **`OTEL_SERVICE_VERSION`** - OpenTelemetry service version
    - **File:** `backend/src/config/telemetry.ts`
    - **Default:** `1.0.0`
    - **Optional:** Configuration

46. **`OTEL_EXPORTER_OTLP_ENDPOINT`** - OpenTelemetry OTLP endpoint
    - **File:** `backend/src/config/telemetry.ts`
    - **Default:** `http://localhost:4318`
    - **Required:** Only if using OpenTelemetry

47. **`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`** - OpenTelemetry traces endpoint
    - **File:** `backend/src/config/telemetry.ts`
    - **Default:** `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
    - **Optional:** Configuration

48. **`OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`** - OpenTelemetry metrics endpoint
    - **File:** `backend/src/config/telemetry.ts`
    - **Default:** `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`
    - **Optional:** Configuration

49. **`OTEL_EXPORTER_OTLP_HEADERS`** - OpenTelemetry headers (JSON)
    - **File:** `backend/src/config/telemetry.ts`
    - **Optional:** Configuration

50. **`OTEL_DEBUG`** - OpenTelemetry debug mode
    - **File:** `backend/src/config/telemetry.ts`
    - **Default:** `false`
    - **Optional:** Configuration

### StackStorm (Self-healing)
51. **`STACKSTORM_ENABLED`** - Enable StackStorm
    - **File:** `backend/src/config/stackstorm.ts`
    - **Default:** `false`
    - **Required:** Only if using StackStorm

52. **`STACKSTORM_API_URL`** - StackStorm API URL
    - **File:** `backend/src/config/stackstorm.ts`
    - **Default:** `http://localhost:9101/v1`
    - **Required:** Only if using StackStorm

53. **`STACKSTORM_API_KEY`** - StackStorm API key
    - **File:** `backend/src/config/stackstorm.ts`
    - **Required:** Only if using StackStorm

54. **`STACKSTORM_AUTH_URL`** - StackStorm auth URL
    - **File:** `backend/src/config/stackstorm.ts`
    - **Default:** `http://localhost:9101/auth/v1`
    - **Optional:** Configuration

55. **`STACKSTORM_USERNAME`** - StackStorm username
    - **File:** `backend/src/config/stackstorm.ts`
    - **Default:** `st2admin`
    - **Optional:** Configuration

56. **`STACKSTORM_PASSWORD`** - StackStorm password
    - **File:** `backend/src/config/stackstorm.ts`
    - **Required:** Only if using StackStorm

57. **`STACKSTORM_TIMEOUT`** - StackStorm timeout
    - **File:** `backend/src/config/stackstorm.ts`
    - **Default:** `30000`
    - **Optional:** Configuration

58. **`STACKSTORM_RETRY_ATTEMPTS`** - StackStorm retry attempts
    - **File:** `backend/src/config/stackstorm.ts`
    - **Default:** `3`
    - **Optional:** Configuration

59. **`STACKSTORM_RETRY_DELAY`** - StackStorm retry delay
    - **File:** `backend/src/config/stackstorm.ts`
    - **Default:** `1000`
    - **Optional:** Configuration

### Runtime Services
60. **`BACALHAU_API_KEY`** - Bacalhau API key
    - **File:** `backend/src/services/runtimes/bacalhauRuntime.ts`
    - **Required:** Only if using Bacalhau for distributed compute

61. **`BACALHAU_API_URL`** - Bacalhau API URL
    - **File:** `backend/src/services/runtimes/bacalhauRuntime.ts`
    - **Default:** `http://localhost:1234`
    - **Required:** Only if using Bacalhau

62. **`BACALHAU_ENABLED`** - Enable Bacalhau
    - **File:** `backend/src/services/runtimes/bacalhauRuntime.ts`
    - **Default:** `true`
    - **Optional:** Configuration

63. **`BACALHAU_GPU_ENABLED`** - Enable GPU in Bacalhau
    - **File:** `backend/src/services/runtimes/bacalhauRuntime.ts`
    - **Default:** `false`
    - **Optional:** Configuration

64. **`BACALHAU_GPU_COUNT`** - Bacalhau GPU count
    - **File:** `backend/src/services/runtimes/bacalhauRuntime.ts`
    - **Default:** `1`
    - **Optional:** Configuration

65. **`BACALHAU_PATH`** - Bacalhau binary path
    - **File:** `backend/src/services/runtimes/bacalhauRuntime.ts`
    - **Default:** `bacalhau`
    - **Optional:** Configuration

66. **`WASMEDGE_ENABLED`** - Enable WasmEdge
    - **File:** `backend/src/services/runtimes/wasmEdgeRuntime.ts`
    - **Default:** `true`
    - **Optional:** Configuration

67. **`WASMEDGE_PATH`** - WasmEdge binary path
    - **File:** `backend/src/services/runtimes/wasmEdgeRuntime.ts`
    - **Default:** `wasmedge`
    - **Optional:** Configuration

68. **`WASMEDGE_SERVICE_URL`** - WasmEdge service URL
    - **File:** `backend/src/services/runtimes/wasmEdgeRuntime.ts`
    - **Optional:** Configuration

69. **`WASM_CACHE_DIR`** - WASM cache directory
    - **File:** `backend/src/services/wasmCompiler.ts`
    - **Default:** `.wasm-cache`
    - **Optional:** Configuration

70. **`WASM_CACHE_ENABLED`** - Enable WASM cache
    - **File:** `backend/src/services/wasmCompiler.ts`
    - **Default:** `true`
    - **Optional:** Configuration

71. **`WASM_CACHE_TTL`** - WASM cache TTL
    - **File:** `backend/src/services/wasmCompiler.ts`
    - **Default:** `3600`
    - **Optional:** Configuration

### OCR & Vision
72. **`GOOGLE_VISION_API_KEY`** - Google Vision API key
    - **File:** `backend/src/services/ocrService.ts`
    - **Required:** Only if using Google Vision for OCR/image analysis
    - **Get from:** https://console.cloud.google.com

73. **`AWS_ACCESS_KEY_ID`** - AWS access key ID
    - **File:** `backend/src/services/ocrService.ts`
    - **Required:** Only if using AWS services for OCR

74. **`AWS_SECRET_ACCESS_KEY`** - AWS secret access key
    - **File:** `backend/src/services/ocrService.ts`
    - **Required:** Only if using AWS services for OCR

75. **`AWS_REGION`** - AWS region
    - **File:** `backend/src/services/ocrService.ts`
    - **Required:** Only if using AWS services

76. **`GOOGLE_APPLICATION_CREDENTIALS`** - Google application credentials JSON path
    - **File:** `backend/src/services/ocrService.ts`
    - **Required:** Only if using Google Cloud services

### Connector-Specific Keys (Used as fallbacks in connectors)
77. **`TRELLO_API_KEY`** - Trello API key
    - **File:** `backend/src/services/nodeExecutors/connectors/trello.ts`
    - **Required:** Only if using Trello connector (can also be set in connector credentials)

78. **`AIRTABLE_API_KEY`** - Airtable API key
    - **File:** `backend/src/services/nodeExecutors/connectors/integrations.ts`
    - **Required:** Only if using Airtable connector (can also be set in connector credentials)

79. **`NOTION_API_KEY`** - Notion API key
    - **File:** `backend/src/services/nodeExecutors/connectors/integrations.ts`
    - **Required:** Only if using Notion connector (can also be set in connector credentials)

80. **`SHOPIFY_SHOP`** - Shopify shop domain
    - **File:** `backend/src/services/nodeExecutors/connectors/shopify.ts`
    - **Required:** Only if using Shopify connector (can also be set in connector credentials)

81. **`FRESHDESK_DOMAIN`** - Freshdesk domain
    - **File:** `backend/src/services/nodeExecutors/connectors/freshdesk.ts`
    - **Required:** Only if using Freshdesk connector (can also be set in connector credentials)

82. **`ZENDESK_SUBDOMAIN`** - Zendesk subdomain
    - **File:** `backend/src/services/nodeExecutors/connectors/zendesk.ts`
    - **Required:** Only if using Zendesk connector (can also be set in connector credentials)

83. **`MAILGUN_DOMAIN`** - Mailgun domain
    - **File:** `backend/src/services/nodeExecutors/connectors/mailgun.ts`
    - **Required:** Only if using Mailgun connector (can also be set in connector credentials)

### SMS & Communication
84. **`TWILIO_ACCOUNT_SID`** - Twilio account SID
    - **File:** `backend/src/services/nodeExecutors/sms.ts`
    - **Required:** Only if using Twilio for SMS

85. **`TWILIO_AUTH_TOKEN`** - Twilio auth token
    - **File:** `backend/src/services/nodeExecutors/sms.ts`
    - **Required:** Only if using Twilio for SMS

### Webhooks
86. **`SLACK_WEBHOOK_URL`** - Slack webhook URL
    - **File:** `backend/src/services/nodeExecutors/slack.ts`
    - **Required:** Only if using Slack webhooks (not OAuth)

87. **`DISCORD_WEBHOOK_URL`** - Discord webhook URL
    - **File:** `backend/src/services/nodeExecutors/discord.ts`
    - **Required:** Only if using Discord webhooks

### Code Review & Suggestions
88. **`ENABLE_CODE_REVIEW`** - Enable code review
    - **File:** `backend/src/services/codeReviewService.ts`
    - **Optional:** Feature flag

89. **`CODE_REVIEW_PROVIDER`** - Code review provider
    - **File:** `backend/src/services/codeReviewService.ts`
    - **Optional:** Configuration

90. **`CODE_REVIEW_MODEL`** - Code review model
    - **File:** `backend/src/services/codeReviewService.ts`
    - **Optional:** Configuration

91. **`ENABLE_CODE_SUGGESTIONS`** - Enable code suggestions
    - **File:** `backend/src/services/codeSuggestionService.ts`
    - **Optional:** Feature flag

92. **`CODE_SUGGESTION_PROVIDER`** - Code suggestion provider
    - **File:** `backend/src/services/codeSuggestionService.ts`
    - **Optional:** Configuration

93. **`CODE_SUGGESTION_MODEL`** - Code suggestion model
    - **File:** `backend/src/services/codeSuggestionService.ts`
    - **Optional:** Configuration

### Sandbox Security
94. **`ENABLE_SANDBOX_ESCAPE_DETECTION`** - Enable sandbox escape detection
    - **File:** `backend/src/services/sandboxEscapeDetectionService.ts`
    - **Optional:** Feature flag

### MCP Servers
95. **`MCP_SERVER_PATH`** - MCP server path
    - **File:** `backend/src/services/mcpServerService.ts`
    - **Default:** `./mcp-servers`
    - **Optional:** Configuration

96. **`MCP_PROTOCOL`** - MCP protocol
    - **File:** `backend/src/services/mcpServerService.ts`
    - **Default:** `stdio`
    - **Optional:** Configuration

### SMTP (Alternative to Resend)
97. **`SMTP_HOST`** - SMTP host
    - **File:** `backend/src/services/nodeExecutors/email.ts`
    - **Required:** Only if using SMTP instead of Resend

98. **`SMTP_PORT`** - SMTP port
    - **File:** `backend/src/services/nodeExecutors/email.ts`
    - **Required:** Only if using SMTP

99. **`SMTP_USER`** - SMTP username
    - **File:** `backend/src/services/nodeExecutors/email.ts`
    - **Required:** Only if using SMTP

100. **`SMTP_PASS`** - SMTP password
    - **File:** `backend/src/services/nodeExecutors/email.ts`
    - **Required:** Only if using SMTP

101. **`SMTP_SECURE`** - SMTP secure (TLS)
    - **File:** `backend/src/services/nodeExecutors/email.ts`
    - **Required:** Only if using SMTP

102. **`SMTP_FROM`** - SMTP from email
    - **File:** `backend/src/services/nodeExecutors/email.ts`
    - **Required:** Only if using SMTP

### Frontend Environment Variables
103. **`VITE_CLERK_PUBLISHABLE_KEY`** - Clerk publishable key (frontend)
    - **File:** Frontend environment
    - **Required:** YES (same as `CLERK_PUBLISHABLE_KEY`)

104. **`VITE_API_URL`** - API URL (frontend)
    - **File:** Frontend environment
    - **Default:** `http://localhost:4000`
    - **Required:** For frontend to connect to backend

### Other Configuration
105. **`PORT`** - Server port
    - **File:** `backend/src/index.ts`
    - **Default:** `4000`
    - **Optional:** Configuration

106. **`NODE_ENV`** - Node environment
    - **File:** Multiple files
    - **Default:** `development`
    - **Optional:** Configuration

107. **`CORS_ORIGIN`** - CORS origin
    - **File:** `backend/src/index.ts`
    - **Default:** `http://localhost:3000`
    - **Optional:** Configuration

108. **`HOST`** - Server host
    - **File:** `backend/src/index.ts`
    - **Default:** `0.0.0.0`
    - **Optional:** Configuration

109. **`HOSTNAME`** - Server hostname
    - **File:** `backend/src/config/telemetry.ts`
    - **Optional:** Configuration

110. **`WEBHOOK_BASE_URL`** - Webhook base URL
    - **File:** Multiple files
    - **Optional:** Configuration

111. **`FRONTEND_URL`** - Frontend URL
    - **File:** Multiple files
    - **Optional:** Configuration

112. **`DEBUG`** - Debug mode
    - **File:** Multiple files
    - **Optional:** Configuration

---

## 📊 Summary by Priority

### **MUST HAVE (13 keys):**
1. `DATABASE_URL`
2. `REDIS_URL`
3. `CLERK_SECRET_KEY`
4. `CLERK_PUBLISHABLE_KEY`
5. `VITE_CLERK_PUBLISHABLE_KEY` (frontend)
6. `NANGO_SECRET_KEY` (for OAuth connectors)
7. `OPENAI_API_KEY` OR `ANTHROPIC_API_KEY` (at least one)
8. `RESEND_API_KEY`
9. `SUPABASE_URL`
10. `SUPABASE_ANON_KEY`
11. `SUPABASE_SERVICE_ROLE_KEY`
12. `VITE_API_URL` (frontend)
13. `NANGO_HOST` (default provided, but may need custom)

### **RECOMMENDED (Based on features you use):**
- Vector stores: `PINECONE_API_KEY` (if using Pinecone)
- Web search: `SERPAPI_API_KEY` or `BRAVE_API_KEY` (if using in agents)
- OSINT: `TWITTER_BEARER_TOKEN`, `NEWS_API_KEY`, `GITHUB_TOKEN`
- Fast code: `E2B_API_KEY`
- Email triggers: `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET`, `OUTLOOK_CLIENT_ID`/`OUTLOOK_CLIENT_SECRET`
- Analytics: `POSTHOG_API_KEY`, `RUDDERSTACK_WRITE_KEY`
- OCR: `GOOGLE_VISION_API_KEY`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`

### **OPTIONAL (Feature-specific):**
- All other keys listed above are optional and only needed for specific features

---

## 🔍 How This List Was Generated

1. Searched all `.ts` files in `backend/src` for `process.env.` references
2. Extracted all unique environment variable names
3. Categorized by usage and requirement level
4. Verified against actual code files
5. Cross-referenced with configuration files

**Total API Keys Found:** 112 unique environment variables

