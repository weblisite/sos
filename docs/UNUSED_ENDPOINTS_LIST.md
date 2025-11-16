# Unused Backend Endpoints

**Date:** 2024-12-19  
**Total Backend Endpoints:** 123  
**Total Used by Frontend:** 111  
**Unused Endpoints:** 12

---

## List of 12 Unused Backend Endpoints

### 1. **Agent Routes (2 endpoints)**

#### ⚠️ `GET /api/v1/agents/frameworks/:name`
- **Purpose:** Get detailed information about a specific agent framework by name
- **Status:** Available but not called by frontend
- **Potential Use:** Could be used in `AgentCatalogue.tsx` for framework detail view
- **Location:** `backend/src/routes/agents.ts:136`

#### ⚠️ `GET /api/v1/agents/frameworks/search?q=query`
- **Purpose:** Search agent frameworks by query string
- **Status:** Available but not called by frontend
- **Potential Use:** Could be used in `AgentCatalogue.tsx` for search functionality
- **Location:** `backend/src/routes/agents.ts:162`

---

### 2. **Connector Routes (3 endpoints)**

#### ⚠️ `GET /api/v1/connectors/:id`
- **Purpose:** Get detailed information about a specific connector by ID
- **Status:** Available but not directly called by frontend
- **Note:** `ConnectorManager.tsx` calls `GET /api/v1/connectors` (list all), but doesn't fetch individual connector details
- **Potential Use:** Could be used for connector detail view or configuration
- **Location:** `backend/src/routes/connectors.ts:29`

#### ⚠️ `POST /api/v1/connectors/:id/actions/:actionId/execute`
- **Purpose:** Execute a specific action from a connector
- **Status:** Available but not called by frontend
- **Potential Use:** Could be used in workflow builder to test connector actions
- **Location:** `backend/src/routes/connectors.ts:44`

#### ⚠️ `POST /api/v1/connectors/credentials`
- **Purpose:** Store connector credentials (for OAuth callback or manual setup)
- **Status:** Available but not directly called by frontend
- **Note:** OAuth flows typically handle credential storage internally via callbacks
- **Potential Use:** Could be used for manual credential entry in connector setup
- **Location:** `backend/src/routes/connectors.ts:162`

---

### 3. **OAuth Callback Routes (2 endpoints)**

#### ⚠️ `GET /api/v1/email-oauth/gmail/callback`
- **Purpose:** OAuth callback handler for Gmail OAuth flow
- **Status:** Called by OAuth provider (Google), not directly by frontend
- **Note:** This is a redirect endpoint, not a frontend API call
- **Location:** `backend/src/routes/emailOAuth.ts:56`

#### ⚠️ `GET /api/v1/email-oauth/outlook/callback`
- **Purpose:** OAuth callback handler for Outlook OAuth flow
- **Status:** Called by OAuth provider (Microsoft), not directly by frontend
- **Note:** This is a redirect endpoint, not a frontend API call
- **Location:** `backend/src/routes/emailOAuth.ts:198`

---

### 4. **Detail View Endpoints (1 endpoint)**

#### ⚠️ `GET /api/v1/executions/:id/steps/:stepId`
- **Purpose:** Get detailed information about a specific execution step
- **Status:** Available but not directly called by frontend
- **Note:** `ExecutionReplay.tsx` calls `GET /api/v1/executions/:id/steps` (list all steps), but doesn't fetch individual step details
- **Potential Use:** Could be used for step detail view or debugging
- **Location:** `backend/src/routes/executions.ts:549`

**Note:** The following detail endpoints ARE actually used by the frontend:
- ✅ `GET /api/v1/templates/:id` - Used by `WorkflowTemplates.tsx:150`
- ✅ `GET /api/v1/roles/:id` - Used by `Roles.tsx:254`
- ✅ `GET /api/v1/alerts/:id` - Used by `Alerts.tsx:195`

---

### 5. **OSINT Detail Endpoint (1 endpoint)**

#### ⚠️ `GET /api/v1/osint/monitors/:id`
- **Purpose:** Get detailed information about a specific OSINT monitor
- **Status:** Available but not directly called by frontend
- **Note:** `OSINTMonitoring.tsx` calls `GET /api/v1/osint/monitors` (list all), but doesn't fetch individual monitor details
- **Potential Use:** Could be used for monitor detail view or configuration
- **Location:** `backend/src/routes/osint.ts:41`

---

### 6. **System/Health Endpoints (2 endpoints)**

#### ⚠️ `GET /health`
- **Purpose:** Health check endpoint for monitoring and load balancers
- **Status:** Called by infrastructure/monitoring tools, not by frontend
- **Note:** This is a system endpoint, not a frontend API call
- **Location:** `backend/src/index.ts:73`

#### ⚠️ `GET /api/v1`
- **Purpose:** API information endpoint
- **Status:** Available but not called by frontend
- **Potential Use:** Could be used for API version checking or documentation
- **Location:** `backend/src/index.ts:106`

---

## Summary by Category

| Category | Count | Endpoints |
|----------|-------|-----------|
| **Agent Routes** | 2 | `/agents/frameworks/:name`, `/agents/frameworks/search` |
| **Connector Routes** | 3 | `/connectors/:id`, `/connectors/:id/actions/:actionId/execute`, `/connectors/credentials` (POST) |
| **OAuth Callbacks** | 2 | `/email-oauth/gmail/callback`, `/email-oauth/outlook/callback` |
| **Detail Views** | 2 | `/executions/:id/steps/:stepId`, `/osint/monitors/:id` |
| **System Endpoints** | 2 | `/health`, `/api/v1` |
| **Total** | **12** | |

---

## Notes

### OAuth Callbacks (2 endpoints)
These are **intentionally not called by frontend** - they are redirect endpoints called by OAuth providers (Google, Microsoft) during the OAuth flow. They are functional and necessary, just not frontend-initiated.

### System Endpoints (2 endpoints)
- `/health` - Called by infrastructure/monitoring, not frontend
- `/api/v1` - API info endpoint, could be used for version checking

### Detail View Endpoints (2 endpoints)
These endpoints exist and are functional, but the frontend currently:
- Fetches full lists and filters client-side
- Doesn't have detail view modals/pages for these resources
- Could be enhanced to use these endpoints for better performance

**Note:** The following detail endpoints ARE used:
- ✅ `/templates/:id` - Used by WorkflowTemplates.tsx
- ✅ `/roles/:id` - Used by Roles.tsx
- ✅ `/alerts/:id` - Used by Alerts.tsx

### Agent & Connector Endpoints (5 endpoints)
These are available for future enhancements:
- Framework search and detail views
- Connector action testing
- Manual credential entry

---

## Recommendations

### High Priority (Nice to Have)
1. **Add framework search** - Use `/agents/frameworks/search` in `AgentCatalogue.tsx`
2. **Add framework detail view** - Use `/agents/frameworks/:name` for framework details

### Medium Priority (Future Enhancement)
4. **Add connector action testing** - Use `/connectors/:id/actions/:actionId/execute` in workflow builder
5. **Add step detail view** - Use `/executions/:id/steps/:stepId` for debugging
6. **Add monitor detail view** - Use `/osint/monitors/:id` for monitor configuration
7. **Add connector detail view** - Use `/connectors/:id` for connector configuration

### Low Priority (System Endpoints)
7. **OAuth callbacks** - Already functional, no changes needed
8. **Health/API endpoints** - System endpoints, no frontend integration needed

---

**Conclusion:** The 12 unused endpoints are either:
- **System/infrastructure endpoints** (OAuth callbacks, health checks) - 4 endpoints
- **Available for future enhancements** (detail views, search, testing) - 8 endpoints

All endpoints are functional and ready to use when needed.

