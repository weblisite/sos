import { chromium, Browser, BrowserContext, Page, LaunchOptions } from 'playwright';
import puppeteer, { Browser as PuppeteerBrowser } from 'puppeteer';
import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Browser Pool Service
 * 
 * Manages multi-engine browser pools (Playwright, Puppeteer) for browser automation.
 * Reuses browser instances for performance and resource efficiency.
 */

export type BrowserEngine = 'playwright' | 'puppeteer' | 'cloudscraper' | 'undetected-chromedriver' | 'browserbase' | 'stagehand';

export interface BrowserPoolConfig {
  engine: BrowserEngine;
  headless?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
  userAgent?: string;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  timeout?: number;
  maxConcurrentPages?: number;
}

export interface BrowserSession {
  id: string;
  engine: BrowserEngine;
  browser: Browser | PuppeteerBrowser;
  context?: BrowserContext; // Playwright only
  createdAt: Date;
  lastUsedAt: Date;
  pageCount: number;
}

export class BrowserPoolService {
  private playwrightBrowsers: Map<string, BrowserSession> = new Map();
  private puppeteerBrowsers: Map<string, PuppeteerBrowser> = new Map();
  private readonly maxPoolSize = 5; // Max browsers per engine
  private readonly maxIdleTime = 300000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Get or create a browser instance
   */
  async getBrowser(config: BrowserPoolConfig): Promise<BrowserSession> {
    const tracer = trace.getTracer('sos-browser-pool');
    const span = tracer.startSpan('browser_pool.get', {
      attributes: {
        'browser.engine': config.engine,
        'browser.headless': config.headless !== false,
      },
    });

    try {
      if (config.engine === 'playwright') {
        return await this.getPlaywrightBrowser(config, span);
      } else {
        return await this.getPuppeteerBrowser(config, span);
      }
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();
      throw error;
    }
  }

  /**
   * Get or create a Playwright browser
   */
  private async getPlaywrightBrowser(
    config: BrowserPoolConfig,
    span: any
  ): Promise<BrowserSession> {
    // Check for existing browser in pool
    for (const [id, session] of this.playwrightBrowsers.entries()) {
      if (this.isSessionReusable(session, config)) {
        session.lastUsedAt = new Date();
        session.pageCount++;
        span.setAttributes({
          'browser.reused': true,
          'browser.session_id': id,
        });
        span.end();
        return session;
      }
    }

    // Create new browser if pool not full
    if (this.playwrightBrowsers.size >= this.maxPoolSize) {
      // Reuse oldest browser
      const oldestId = Array.from(this.playwrightBrowsers.keys())[0];
      const oldest = this.playwrightBrowsers.get(oldestId)!;
      await this.closeBrowser(oldest);
      this.playwrightBrowsers.delete(oldestId);
    }

    const launchOptions: LaunchOptions = {
      headless: config.headless !== false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    };

    if (config.proxy) {
      launchOptions.proxy = {
        server: config.proxy.server,
        username: config.proxy.username,
        password: config.proxy.password,
      };
    }

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      viewport: config.viewport || { width: 1920, height: 1080 },
      userAgent: config.userAgent,
    });

    const sessionId = `playwright_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session: BrowserSession = {
      id: sessionId,
      engine: 'playwright',
      browser: browser as any,
      context,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      pageCount: 0,
    };

    this.playwrightBrowsers.set(sessionId, session);

    span.setAttributes({
      'browser.reused': false,
      'browser.session_id': sessionId,
      'browser.pool_size': this.playwrightBrowsers.size,
    });
    span.end();

    return session;
  }

  /**
   * Get or create a Puppeteer browser
   */
  private async getPuppeteerBrowser(
    config: BrowserPoolConfig,
    span: any
  ): Promise<BrowserSession> {
    // Check for existing browser in pool
    if (this.puppeteerBrowsers.size > 0) {
      const existingId = Array.from(this.puppeteerBrowsers.keys())[0];
      const browser = this.puppeteerBrowsers.get(existingId)!;
      
      if (browser.isConnected()) {
        const sessionId = `puppeteer_${existingId}`;
        span.setAttributes({
          'browser.reused': true,
          'browser.session_id': sessionId,
        });
        span.end();
        
        return {
          id: sessionId,
          engine: 'puppeteer',
          browser,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          pageCount: 0,
        };
      } else {
        this.puppeteerBrowsers.delete(existingId);
      }
    }

    // Create new browser if pool not full
    if (this.puppeteerBrowsers.size >= this.maxPoolSize) {
      const oldestId = Array.from(this.puppeteerBrowsers.keys())[0];
      const oldest = this.puppeteerBrowsers.get(oldestId)!;
      await oldest.close();
      this.puppeteerBrowsers.delete(oldestId);
    }

    const launchOptions: any = {
      headless: config.headless !== false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    };

    if (config.proxy) {
      launchOptions.args.push(`--proxy-server=${config.proxy.server}`);
    }

    const browser = await puppeteer.launch(launchOptions);
    const sessionId = `puppeteer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.puppeteerBrowsers.set(sessionId, browser);

    span.setAttributes({
      'browser.reused': false,
      'browser.session_id': sessionId,
      'browser.pool_size': this.puppeteerBrowsers.size,
    });
    span.end();

    return {
      id: sessionId,
      engine: 'puppeteer',
      browser,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      pageCount: 0,
    };
  }

  /**
   * Check if a session can be reused for the given config
   */
  private isSessionReusable(session: BrowserSession, config: BrowserPoolConfig): boolean {
    if (session.engine !== config.engine) return false;
    
    // Check if browser is still connected
    if (session.engine === 'playwright') {
      const browser = session.browser as Browser;
      if (!browser.isConnected()) return false;
    } else {
      const browser = session.browser as PuppeteerBrowser;
      if (!browser.isConnected()) return false;
    }

    // Check idle time
    const idleTime = Date.now() - session.lastUsedAt.getTime();
    if (idleTime > this.maxIdleTime) return false;

    // Check max concurrent pages
    if (config.maxConcurrentPages && session.pageCount >= config.maxConcurrentPages) {
      return false;
    }

    return true;
  }

  /**
   * Close a browser session
   */
  async closeBrowser(session: BrowserSession): Promise<void> {
    try {
      if (session.engine === 'playwright') {
        const browser = session.browser as Browser;
        if (session.context) {
          await session.context.close();
        }
        await browser.close();
        this.playwrightBrowsers.delete(session.id);
      } else {
        const browser = session.browser as PuppeteerBrowser;
        await browser.close();
        this.puppeteerBrowsers.delete(session.id);
      }
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }

  /**
   * Start cleanup interval for idle browsers
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleBrowsers();
    }, 60000); // Check every minute
  }

  /**
   * Cleanup idle browsers
   */
  private async cleanupIdleBrowsers(): Promise<void> {
    const now = Date.now();
    
    // Cleanup Playwright browsers
    for (const [id, session] of this.playwrightBrowsers.entries()) {
      const idleTime = now - session.lastUsedAt.getTime();
      if (idleTime > this.maxIdleTime) {
        await this.closeBrowser(session);
      }
    }

    // Cleanup Puppeteer browsers
    for (const [id, browser] of this.puppeteerBrowsers.entries()) {
      if (!browser.isConnected()) {
        this.puppeteerBrowsers.delete(id);
      }
    }
  }

  /**
   * Cleanup all browsers
   */
  async cleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all Playwright browsers
    for (const session of this.playwrightBrowsers.values()) {
      await this.closeBrowser(session);
    }

    // Close all Puppeteer browsers
    for (const browser of this.puppeteerBrowsers.values()) {
      await browser.close();
    }

    this.playwrightBrowsers.clear();
    this.puppeteerBrowsers.clear();
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    playwright: { count: number; sessions: string[] };
    puppeteer: { count: number; sessions: string[] };
  } {
    return {
      playwright: {
        count: this.playwrightBrowsers.size,
        sessions: Array.from(this.playwrightBrowsers.keys()),
      },
      puppeteer: {
        count: this.puppeteerBrowsers.size,
        sessions: Array.from(this.puppeteerBrowsers.keys()),
      },
    };
  }
}

export const browserPoolService = new BrowserPoolService();

