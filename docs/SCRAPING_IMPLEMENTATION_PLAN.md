# Web Scraping Implementation Plan

**Version:** 1.0  
**Date:** 2024-12-19  
**Status:** Planning  
**Related PRD:** Web Scraper Stack PRD v0.1

---

## Executive Summary

This document outlines the step-by-step implementation plan for adding comprehensive web scraping capabilities to SynthralOS. The implementation is designed to be **non-breaking** and **incremental**, following existing platform patterns.

---

## Implementation Phases

### Phase 1: Foundation & Core Scraper (MVP)
**Goal:** Basic web scraping with static HTML parsing  
**Duration:** ~1-2 weeks  
**Risk:** Low

### Phase 2: JavaScript Rendering & Advanced Parsing
**Goal:** Support for SPAs and dynamic content  
**Duration:** ~1 week  
**Risk:** Medium

### Phase 3: Scraper Routing & Intelligence
**Goal:** Automatic engine selection based on heuristics  
**Duration:** ~1-2 weeks  
**Risk:** Medium

### Phase 4: Proxy Infrastructure
**Goal:** Rotating proxy pool with scoring  
**Duration:** ~2 weeks  
**Risk:** High (external dependencies)

### Phase 5: Self-Healing & Change Detection
**Goal:** Automatic selector repair and DOM change monitoring  
**Duration:** ~2 weeks  
**Risk:** High (complexity)

### Phase 6: UI Integration & Polish
**Goal:** Workflow builder integration and user experience  
**Duration:** ~1 week  
**Risk:** Low

---

## Phase 1: Foundation & Core Scraper (MVP)

### 1.1 Install Dependencies

**Tasks:**
- [ ] Install Cheerio for HTML parsing
- [ ] Install axios (already installed, verify version)
- [ ] Add TypeScript types for Cheerio

**Files to Modify:**
- `backend/package.json`

**Dependencies:**
```json
{
  "cheerio": "^1.0.0-rc.12",
  "@types/cheerio": "^0.22.35"
}
```

### 1.2 Create Core Scraper Service

**Tasks:**
- [ ] Create `backend/src/services/scraperService.ts`
- [ ] Implement basic HTML fetching
- [ ] Implement Cheerio-based HTML parsing
- [ ] Support CSS selectors
- [ ] Support XPath (via cheerio-xpath or similar)
- [ ] Extract text, HTML, attributes
- [ ] Handle errors gracefully

**Key Features:**
- Fetch HTML from URL
- Parse with Cheerio
- Extract data using CSS selectors
- Return structured JSON output
- Error handling and retries

**Interface:**
```typescript
interface ScrapeConfig {
  url: string;
  selectors?: {
    title?: string;
    content?: string;
    [key: string]: string | undefined;
  };
  extractText?: boolean;
  extractHtml?: boolean;
  extractAttributes?: string[];
  timeout?: number;
  headers?: Record<string, string>;
}

interface ScrapeResult {
  success: boolean;
  url: string;
  data: Record<string, any>;
  html?: string;
  error?: string;
  metadata: {
    latency: number;
    contentLength: number;
    contentType: string;
  };
}
```

### 1.3 Create Web Scrape Node Executor

**Tasks:**
- [ ] Create `backend/src/services/nodeExecutors/webScrape.ts`
- [ ] Implement `executeWebScrape` function
- [ ] Parse node configuration
- [ ] Call scraper service
- [ ] Return standardized result format
- [ ] Add OpenTelemetry tracing

**Integration:**
- Add to `backend/src/services/nodeExecutors/index.ts`
- Route `action.web_scrape` node type

### 1.4 Add Node Type to Frontend Registry

**Tasks:**
- [ ] Add `action.web_scrape` to `frontend/src/lib/nodes/nodeRegistry.ts`
- [ ] Define node metadata (name, description, icon, category)
- [ ] Define input/output schema
- [ ] Define configuration schema

**Node Definition:**
```typescript
'action.web_scrape': {
  type: 'action.web_scrape',
  name: 'Web Scrape',
  description: 'Extract data from web pages using CSS selectors',
  category: 'action',
  icon: 'globe',
  inputs: [
    { name: 'url', type: 'string', description: 'URL to scrape' },
  ],
  outputs: [
    { name: 'data', type: 'object', description: 'Extracted data' },
    { name: 'html', type: 'string', description: 'Raw HTML (optional)' },
  ],
  config: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      selectors: { type: 'object' },
      extractText: { type: 'boolean', default: true },
      timeout: { type: 'number', default: 30000 },
    },
  },
}
```

### 1.5 Create Frontend Config Panel

**Tasks:**
- [ ] Add web scrape config panel to `frontend/src/components/NodeConfigPanel.tsx`
- [ ] Create URL input field
- [ ] Create selector configuration UI
- [ ] Add preview/test button
- [ ] Show extracted data preview

### 1.6 Database Schema (Basic)

**Tasks:**
- [ ] Create migration for `scraper_events` table
- [ ] Track scraping events (URL, success, latency, engine)
- [ ] Store for analytics and debugging

**Schema:**
```sql
CREATE TABLE scraper_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  workspace_id TEXT,
  user_id TEXT NOT NULL,
  url TEXT NOT NULL,
  engine TEXT NOT NULL, -- 'cheerio', 'puppeteer', etc.
  success BOOLEAN NOT NULL,
  latency_ms INTEGER,
  content_length INTEGER,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 1.7 Testing & Documentation

**Tasks:**
- [ ] Write unit tests for scraper service
- [ ] Write integration tests for node executor
- [ ] Test with various HTML structures
- [ ] Document API and usage
- [ ] Create example workflows

---

## Phase 2: JavaScript Rendering & Advanced Parsing

### 2.1 Install Puppeteer/Playwright

**Tasks:**
- [ ] Install Puppeteer (lighter) or Playwright (more features)
- [ ] Install browser dependencies
- [ ] Configure headless browser settings

**Dependencies:**
```json
{
  "puppeteer": "^21.5.0"
}
```

### 2.2 Extend Scraper Service

**Tasks:**
- [ ] Add Puppeteer-based scraping method
- [ ] Support JavaScript rendering
- [ ] Support waiting for elements
- [ ] Support clicking/interacting with page
- [ ] Support screenshots
- [ ] Handle navigation and redirects

**Features:**
- Wait for selectors to appear
- Execute custom JavaScript
- Handle infinite scroll
- Take screenshots
- Extract rendered HTML

### 2.3 Update Scraper Router (Basic)

**Tasks:**
- [ ] Create `backend/src/services/scraperRouter.ts`
- [ ] Implement basic routing logic
- [ ] Route to Cheerio for static HTML
- [ ] Route to Puppeteer for JS-heavy sites
- [ ] Add heuristics detection

**Heuristics:**
- Check if URL requires JS (simple check)
- Check HTML complexity
- Check for common JS frameworks

### 2.4 Update Node Executor

**Tasks:**
- [ ] Add `renderJavaScript` option
- [ ] Add `waitForSelector` option
- [ ] Add `executeScript` option
- [ ] Route through scraper router

### 2.5 Resource Management

**Tasks:**
- [ ] Implement browser pool
- [ ] Limit concurrent browser instances
- [ ] Add timeout handling
- [ ] Clean up browser resources

---

## Phase 3: Scraper Routing & Intelligence

### 3.1 Advanced Heuristics Detection

**Tasks:**
- [ ] Analyze HTML complexity
- [ ] Detect JavaScript frameworks
- [ ] Detect SPA patterns
- [ ] Detect pagination patterns
- [ ] Cache heuristics results

### 3.2 LangGraph Integration

**Tasks:**
- [ ] Create LangGraph scraper switch node
- [ ] Implement routing decision logic
- [ ] Add fallback mechanisms
- [ ] Integrate with existing LangGraph workflows

### 3.3 Multi-Engine Support

**Tasks:**
- [ ] Integrate Scrapy (if needed)
- [ ] Integrate Crawl4AI (if needed)
- [ ] Create engine abstraction layer
- [ ] Implement engine-specific configs

### 3.4 Performance Optimization

**Tasks:**
- [ ] Add caching layer
- [ ] Implement request deduplication
- [ ] Optimize browser reuse
- [ ] Add connection pooling

---

## Phase 4: Proxy Infrastructure

### 4.1 Database Schema for Proxies

**Tasks:**
- [ ] Create `proxy_pools` table
- [ ] Create `proxy_logs` table
- [ ] Create `proxy_scores` table
- [ ] Add indexes for performance

**Schema:**
```sql
CREATE TABLE proxy_pools (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'brightdata', 'oxylabs', 'custom'
  type TEXT NOT NULL, -- 'residential', 'datacenter', 'mobile'
  endpoint TEXT NOT NULL,
  credentials JSONB,
  geolocation TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE proxy_logs (
  id TEXT PRIMARY KEY,
  proxy_id TEXT REFERENCES proxy_pools(id),
  url TEXT NOT NULL,
  status TEXT NOT NULL, -- 'success', 'banned', 'timeout', 'error'
  latency_ms INTEGER,
  ban_reason TEXT,
  response_code INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE proxy_scores (
  proxy_id TEXT PRIMARY KEY REFERENCES proxy_pools(id),
  success_rate DECIMAL(5,2),
  avg_latency_ms INTEGER,
  ban_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  score DECIMAL(5,2), -- Calculated score
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 4.2 Proxy Service

**Tasks:**
- [ ] Create `backend/src/services/proxyService.ts`
- [ ] Implement proxy rotation logic
- [ ] Implement proxy scoring
- [ ] Implement proxy validation
- [ ] Add geolocation filtering
- [ ] Add rate limiting per proxy

**Features:**
- Rotate proxies based on score
- Validate proxy health
- Track proxy performance
- Handle proxy bans
- Support multiple providers

### 4.3 Proxy Integration with Scraper

**Tasks:**
- [ ] Integrate proxy service with scraper
- [ ] Add proxy configuration to scrape config
- [ ] Handle proxy failures
- [ ] Implement automatic proxy switching
- [ ] Add proxy to request headers

### 4.4 Proxy Provider Integration

**Tasks:**
- [ ] Integrate BrightData API (if available)
- [ ] Integrate Oxylabs API (if available)
- [ ] Support custom proxy lists
- [ ] Add proxy authentication

### 4.5 Monitoring & Analytics

**Tasks:**
- [ ] Track proxy usage in PostHog
- [ ] Add proxy metrics to Signoz
- [ ] Create proxy dashboard
- [ ] Alert on high ban rates

---

## Phase 5: Self-Healing & Change Detection

### 5.1 Selector Storage

**Tasks:**
- [ ] Create `scraper_selectors` table
- [ ] Store selector patterns per domain
- [ ] Track selector success rates
- [ ] Version selector configurations

**Schema:**
```sql
CREATE TABLE scraper_selectors (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  selector_type TEXT NOT NULL, -- 'css', 'xpath'
  selector_pattern TEXT NOT NULL,
  field_name TEXT NOT NULL,
  success_rate DECIMAL(5,2),
  last_success_at TIMESTAMP,
  last_failure_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.2 Self-Healing Service

**Tasks:**
- [ ] Create `backend/src/services/selectorHealingService.ts`
- [ ] Detect selector failures
- [ ] Use LLM/agent to suggest new selectors
- [ ] Test new selectors
- [ ] Update selector patterns
- [ ] Integrate with Open Interpreter (if available)

**Healing Process:**
1. Detect selector failure
2. Analyze HTML structure
3. Use LLM to suggest alternatives
4. Test new selectors
5. Update if successful

### 5.3 Change Detection Service

**Tasks:**
- [ ] Create `backend/src/services/changeDetectionService.ts`
- [ ] Store HTML snapshots
- [ ] Compare DOM changes
- [ ] Detect significant changes
- [ ] Trigger alerts/workflows
- [ ] Integrate with ChangeDetection.io (if available)

**Schema:**
```sql
CREATE TABLE content_snapshots (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  html_hash TEXT NOT NULL,
  html_content TEXT,
  detected_changes JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE change_detection_monitors (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  url TEXT NOT NULL,
  selector TEXT,
  threshold DECIMAL(5,2), -- Change percentage threshold
  workflow_id TEXT, -- Trigger workflow on change
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.4 Deduplication Service

**Tasks:**
- [ ] Create `content_checksums` table
- [ ] Generate content hashes
- [ ] Check for duplicates before RAG ingest
- [ ] Implement similarity scoring

**Schema:**
```sql
CREATE TABLE content_checksums (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  similarity_score DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Phase 6: UI Integration & Polish

### 6.1 Workflow Builder Integration

**Tasks:**
- [ ] Add web scrape node to node palette
- [ ] Improve config panel UX
- [ ] Add selector builder UI
- [ ] Add preview/test functionality
- [ ] Add error handling UI

### 6.2 Dashboard Integration

**Tasks:**
- [ ] Add scraping stats to dashboard
- [ ] Show recent scraping events
- [ ] Display proxy health
- [ ] Show selector success rates

### 6.3 Quick Start Panel

**Tasks:**
- [ ] Add "Scrape URL" quick action
- [ ] Create scraping templates
- [ ] Add common scraping patterns

### 6.4 Documentation & Examples

**Tasks:**
- [ ] Create user documentation
- [ ] Add example workflows
- [ ] Create video tutorials
- [ ] Document best practices

---

## Technical Architecture

### Service Layer Structure

```
backend/src/services/
├── scraperService.ts          # Core scraping logic
├── scraperRouter.ts           # Routing heuristics
├── proxyService.ts            # Proxy pool management
├── selectorHealingService.ts  # Self-healing selectors
└── changeDetectionService.ts  # DOM change detection

backend/src/services/nodeExecutors/
└── webScrape.ts               # Node executor
```

### Data Flow

```
Workflow Node → Node Executor → Scraper Router → Scraper Service → Proxy Service → Target URL
                                                      ↓
                                              Scrape Result → Node Output
```

### Queue Architecture

```
BullMQ Queue: 'scraper-jobs'
  ├── Worker Pool: Cheerio workers (lightweight)
  ├── Worker Pool: Puppeteer workers (resource-intensive)
  └── Worker Pool: Proxy validation workers
```

---

## Success Metrics

### Phase 1 (MVP)
- ✅ Basic HTML scraping works
- ✅ CSS selector extraction works
- ✅ Node appears in workflow builder
- ✅ Can execute scraping workflows

### Phase 2 (JS Rendering)
- ✅ SPA scraping works
- ✅ JavaScript execution works
- ✅ Browser pool manages resources

### Phase 3 (Routing)
- ✅ Automatic engine selection works
- ✅ Heuristics detection accurate
- ✅ Fallback mechanisms work

### Phase 4 (Proxies)
- ✅ Proxy rotation works
- ✅ Proxy scoring accurate
- ✅ Ban rate < 5%

### Phase 5 (Self-Healing)
- ✅ Selector healing works
- ✅ Change detection works
- ✅ Deduplication works

### Phase 6 (UI)
- ✅ User-friendly interface
- ✅ Good documentation
- ✅ Example workflows

---

## Risk Mitigation

### Resource Management
- **Risk:** Headless browsers consume lots of memory
- **Mitigation:** Implement browser pool with limits, use BullMQ for queuing

### Proxy Costs
- **Risk:** Proxy services can be expensive
- **Mitigation:** Start with free/custom proxies, add paid providers later

### Legal/Compliance
- **Risk:** Scraping may violate ToS
- **Mitigation:** Respect robots.txt, add rate limiting, provide compliance warnings

### Selector Reliability
- **Risk:** Selectors break when sites change
- **Mitigation:** Self-healing service, multiple selector strategies

---

## Dependencies

### External Services
- Proxy providers (BrightData, Oxylabs) - Optional
- ChangeDetection.io - Optional
- WaterCrawl.dev - Optional (Phase 3+)

### Internal Dependencies
- BullMQ (already installed)
- Redis (already installed)
- OpenTelemetry (already installed)
- PostHog (already installed)
- LangGraph (already installed)

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1 | 1-2 weeks | None |
| Phase 2 | 1 week | Phase 1 |
| Phase 3 | 1-2 weeks | Phase 1, 2 |
| Phase 4 | 2 weeks | Phase 1, 2 |
| Phase 5 | 2 weeks | Phase 1, 2, 3 |
| Phase 6 | 1 week | All phases |

**Total Estimated Duration:** 8-10 weeks

---

## Next Steps

1. Review and approve this plan
2. Create detailed TODO list
3. Start Phase 1 implementation
4. Set up tracking and metrics
5. Begin incremental rollout

---

**Last Updated:** 2024-12-19

