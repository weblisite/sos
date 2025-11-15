import { BrowserEngine, BrowserPoolConfig } from './browserPoolService';
import redis from '../config/redis';
import axios from 'axios';
import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Browser Switch Service
 * 
 * Intelligently routes browser automation requests to the optimal engine
 * based on task parameters, anti-bot signals, and heuristics.
 * Implements the routing matrix from the Browser Use PRD.
 */

export interface BrowserTaskConfig {
  url?: string;
  action?: 'navigate' | 'click' | 'fill' | 'extract' | 'screenshot' | 'scrape';
  htmlType?: 'static' | 'dynamic';
  headlessScrapingNeeded?: boolean;
  massiveBrowserScale?: boolean;
  browserLightweightTask?: boolean;
  autonomousWebExploration?: boolean;
  dynamicContentMonitoring?: boolean;
  requiresInteraction?: boolean;
  has403429?: boolean;
  cloudflareBlock?: boolean;
  explicitEngine?: BrowserEngine | 'playwright' | 'puppeteer';
}

export interface BrowserRoutingDecision {
  engine: BrowserEngine;
  reason: string;
  confidence: number; // 0-1
  config: BrowserPoolConfig;
}

export class BrowserSwitchService {
  /**
   * Route browser automation request to optimal engine
   */
  async route(taskConfig: BrowserTaskConfig): Promise<BrowserRoutingDecision> {
    const tracer = trace.getTracer('sos-browser-switch');
    const span = tracer.startSpan('browser_switch.route', {
      attributes: {
        'browser.task.action': taskConfig.action || 'unknown',
        'browser.task.html_type': taskConfig.htmlType || 'unknown',
      },
    });

    try {
      // If explicitly requested, use that engine
      if (taskConfig.explicitEngine) {
        const decision = this.createDecision(
          taskConfig.explicitEngine as BrowserEngine,
          'Explicit engine requested',
          1.0,
          taskConfig
        );
        span.setAttributes({
          'browser.routing.engine': decision.engine,
          'browser.routing.confidence': decision.confidence,
          'browser.routing.reason': decision.reason,
        });
        span.end();
        return decision;
      }

      // Apply routing matrix from PRD
      let decision: BrowserRoutingDecision | null = null;

      // 1. Cloudflare block → Cloudscraper (fallback to Playwright for now)
      if (taskConfig.cloudflareBlock) {
        decision = this.createDecision(
          'playwright',
          'Cloudflare block detected, using Playwright with stealth',
          0.9,
          taskConfig
        );
      }

      // 2. 403/429 detected → Undetected-Chromedriver (fallback to Playwright for now)
      if (!decision && taskConfig.has403429) {
        decision = this.createDecision(
          'playwright',
          '403/429 detected, using Playwright with anti-bot features',
          0.85,
          taskConfig
        );
      }

      // 3. Dynamic content monitoring → ChangeDetection.io (uses Playwright)
      if (!decision && taskConfig.dynamicContentMonitoring) {
        decision = this.createDecision(
          'playwright',
          'Dynamic content monitoring requires Playwright',
          0.9,
          taskConfig
        );
      }

      // 4. Autonomous web exploration → AI Browser Agent (uses Playwright)
      if (!decision && taskConfig.autonomousWebExploration) {
        decision = this.createDecision(
          'playwright',
          'Autonomous exploration requires Playwright for full control',
          0.9,
          taskConfig
        );
      }

      // 5. Massive browser scale → Browserbase + Stagehand (fallback to Playwright for now)
      if (!decision && taskConfig.massiveBrowserScale) {
        decision = this.createDecision(
          'playwright',
          'Massive scale requirement, using Playwright (Browserbase integration pending)',
          0.7,
          taskConfig
        );
      }

      // 6. Browser lightweight task → browser-use.com (fallback to Puppeteer for now)
      if (!decision && taskConfig.browserLightweightTask) {
        decision = this.createDecision(
          'puppeteer',
          'Lightweight task, using Puppeteer (browser-use integration pending)',
          0.8,
          taskConfig
        );
      }

      // 7. Headless scraping needed → Puppeteer
      if (!decision && taskConfig.headlessScrapingNeeded) {
        decision = this.createDecision(
          'puppeteer',
          'Headless scraping requested',
          0.9,
          taskConfig
        );
      }

      // 8. Dynamic HTML type → Playwright
      if (!decision && taskConfig.htmlType === 'dynamic') {
        decision = this.createDecision(
          'playwright',
          'Dynamic HTML requires full JS rendering',
          0.85,
          taskConfig
        );
      }

      // 9. Requires interaction → Playwright
      if (!decision && taskConfig.requiresInteraction) {
        decision = this.createDecision(
          'playwright',
          'Interactive actions require Playwright',
          0.9,
          taskConfig
        );
      }

      // 10. Analyze URL if provided
      if (!decision && taskConfig.url) {
        const urlDecision = await this.analyzeUrl(taskConfig.url, taskConfig);
        if (urlDecision) {
          decision = urlDecision;
        }
      }

      // 11. Default based on action type
      if (!decision) {
        if (taskConfig.action === 'click' || taskConfig.action === 'fill') {
          decision = this.createDecision(
            'playwright',
            'Interactive actions default to Playwright',
            0.7,
            taskConfig
          );
        } else if (taskConfig.action === 'scrape' || taskConfig.action === 'extract') {
          decision = this.createDecision(
            'puppeteer',
            'Scraping/extraction default to Puppeteer',
            0.7,
            taskConfig
          );
        } else {
          // Default to Playwright for flexibility
          decision = this.createDecision(
            'playwright',
            'Default to Playwright for maximum compatibility',
            0.6,
            taskConfig
          );
        }
      }

      span.setAttributes({
        'browser.routing.engine': decision.engine,
        'browser.routing.confidence': decision.confidence,
        'browser.routing.reason': decision.reason,
      });
      span.end();

      return decision;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();

      // Fallback decision
      return this.createDecision(
        'playwright',
        'Routing error, defaulting to Playwright',
        0.5,
        taskConfig
      );
    }
  }

  /**
   * Analyze URL to determine optimal engine
   */
  private async analyzeUrl(
    url: string,
    taskConfig: BrowserTaskConfig
  ): Promise<BrowserRoutingDecision | null> {
    // Check cache
    const cacheKey = `browser:routing:${url}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const cachedDecision = JSON.parse(cached) as BrowserRoutingDecision;
        return {
          ...cachedDecision,
          reason: `${cachedDecision.reason} (cached)`,
        };
      }
    } catch (error) {
      // Cache miss or error - continue with analysis
    }

    try {
      // Quick fetch to analyze page
      const response = await axios.get(url, {
        timeout: 5000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'SynthralOS/1.0 (Browser Automation)',
        },
        validateStatus: (status) => status < 500, // Accept 4xx for analysis
      });

      const html = response.data as string;
      const lowerHtml = html.toLowerCase();

      // Check for Cloudflare
      if (html.includes('cf-browser-verification') || html.includes('challenge-platform')) {
        const decision = this.createDecision(
          'playwright',
          'Cloudflare challenge detected',
          0.95,
          taskConfig
        );
        await redis.setex(cacheKey, 3600, JSON.stringify(decision));
        return decision;
      }

      // Check for 403/429
      if (response.status === 403 || response.status === 429) {
        const decision = this.createDecision(
          'playwright',
          `HTTP ${response.status} detected, requires stealth`,
          0.9,
          taskConfig
        );
        await redis.setex(cacheKey, 3600, JSON.stringify(decision));
        return decision;
      }

      // Check for JS frameworks
      const hasReactAngularVue =
        /react|angular|vue|next\.js|nuxt/i.test(html) ||
        /__REACT_DEVTOOLS|ng-app|v-if|v-for/i.test(html);

      // Check for interaction requirements
      const requiresInteraction =
        /onclick|onchange|addEventListener|button.*click|form.*submit/i.test(lowerHtml);

      if (hasReactAngularVue || requiresInteraction) {
        const decision = this.createDecision(
          'playwright',
          'JS framework or interaction detected',
          0.85,
          taskConfig
        );
        await redis.setex(cacheKey, 3600, JSON.stringify(decision));
        return decision;
      }

      // Default to Puppeteer for simple pages
      const decision = this.createDecision(
        'puppeteer',
        'Simple static page detected',
        0.7,
        taskConfig
      );
      await redis.setex(cacheKey, 3600, JSON.stringify(decision));
      return decision;
    } catch (error) {
      // Analysis failed - return null to use default routing
      return null;
    }
  }

  /**
   * Create a routing decision
   */
  private createDecision(
    engine: BrowserEngine,
    reason: string,
    confidence: number,
    taskConfig: BrowserTaskConfig
  ): BrowserRoutingDecision {
    return {
      engine,
      reason,
      confidence,
      config: {
        engine,
        headless: true, // Default to headless, can be overridden
        viewport: {
          width: 1920,
          height: 1080,
        },
        timeout: 30000,
      },
    };
  }
}

export const browserSwitchService = new BrowserSwitchService();

