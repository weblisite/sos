import { Browser, Page, BrowserContext } from 'playwright';
import { Browser as PuppeteerBrowser, Page as PuppeteerPage } from 'puppeteer';
import { BrowserPoolService, BrowserSession, browserPoolService } from './browserPoolService';
import { BrowserSwitchService, BrowserTaskConfig, browserSwitchService } from './browserSwitchService';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { proxyService, ProxyConfig } from './proxyService';

/**
 * Browser Automation Service
 * 
 * Provides browser automation capabilities: navigate, click, fill forms,
 * extract data, take screenshots, and more.
 */

export interface BrowserActionConfig {
  action: 'navigate' | 'click' | 'fill' | 'extract' | 'screenshot' | 'wait' | 'evaluate';
  url?: string;
  selector?: string;
  text?: string;
  value?: string;
  waitForSelector?: string;
  waitTimeout?: number;
  screenshot?: boolean;
  extractSelectors?: Record<string, string>; // field_name: css_selector
  evaluateScript?: string;
  context?: {
    organizationId?: string;
    workspaceId?: string;
    userId?: string;
  };
  // Routing hints
  explicitEngine?: 'playwright' | 'puppeteer';
  htmlType?: 'static' | 'dynamic';
  requiresInteraction?: boolean;
  useProxy?: boolean;
}

export interface BrowserActionResult {
  success: boolean;
  action: string;
  data?: any;
  screenshot?: string; // Base64
  html?: string;
  error?: string;
  metadata: {
    engine: 'playwright' | 'puppeteer';
    latency: number;
    url?: string;
  };
}

export class BrowserAutomationService {
  constructor(
    private browserPool: BrowserPoolService,
    private browserSwitch: BrowserSwitchService
  ) {}

  /**
   * Execute a browser action
   */
  async executeAction(config: BrowserActionConfig): Promise<BrowserActionResult> {
    const tracer = trace.getTracer('sos-browser-automation');
    const span = tracer.startSpan('browser_automation.execute', {
      attributes: {
        'browser.action': config.action,
        'browser.url': config.url || '',
      },
    });

    const startTime = Date.now();
    let session: BrowserSession | null = null;
    let page: Page | PuppeteerPage | null = null;

    try {
      // Route to optimal engine
      const routingDecision = await this.browserSwitch.route({
        url: config.url,
        action: config.action,
        htmlType: config.htmlType,
        requiresInteraction: config.requiresInteraction,
        explicitEngine: config.explicitEngine,
      });

      span.setAttributes({
        'browser.engine': routingDecision.engine,
        'browser.routing.reason': routingDecision.reason,
        'browser.routing.confidence': routingDecision.confidence,
      });

      // Get proxy if needed
      if (config.useProxy && config.context) {
        const proxyConfig = await proxyService.getProxy({
          organizationId: config.context.organizationId,
        });

        if (proxyConfig) {
          routingDecision.config.proxy = {
            server: `${proxyConfig.protocol || 'http'}://${proxyConfig.host}:${proxyConfig.port}`,
            username: proxyConfig.username,
            password: proxyConfig.password,
          };
        }
      }

      // Get browser from pool
      session = await this.browserPool.getBrowser(routingDecision.config);

      // Create page
      if (session.engine === 'playwright') {
        const browser = session.browser as Browser;
        const context = session.context || (await browser.newContext());
        page = await context.newPage();
      } else {
        const browser = session.browser as PuppeteerBrowser;
        page = await browser.newPage();
      }

      // Execute action based on type
      let result: BrowserActionResult;

      switch (config.action) {
        case 'navigate':
          result = await this.navigate(page, config, session.engine);
          break;
        case 'click':
          result = await this.click(page, config, session.engine);
          break;
        case 'fill':
          result = await this.fill(page, config, session.engine);
          break;
        case 'extract':
          result = await this.extract(page, config, session.engine);
          break;
        case 'screenshot':
          result = await this.takeScreenshot(page, config, session.engine);
          break;
        case 'wait':
          result = await this.wait(page, config, session.engine);
          break;
        case 'evaluate':
          result = await this.evaluate(page, config, session.engine);
          break;
        default:
          throw new Error(`Unknown action: ${config.action}`);
      }

      const latency = Date.now() - startTime;

      span.setAttributes({
        'browser.success': result.success,
        'browser.latency_ms': latency,
      });

      if (result.success) {
        span.setStatus({ code: SpanStatusCode.OK });
      } else {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: result.error || 'Action failed',
        });
      }

      span.end();

      return {
        ...result,
        metadata: {
          ...result.metadata,
          latency,
        },
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;

      span.recordException(error);
      span.setAttributes({
        'browser.success': false,
        'browser.latency_ms': latency,
        'browser.error': error.message,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();

      return {
        success: false,
        action: config.action,
        error: error.message || 'Unknown error',
        metadata: {
          engine: session?.engine || 'playwright',
          latency,
        },
      };
    } finally {
      // Close page but keep browser in pool
      if (page) {
        try {
          if (session?.engine === 'playwright') {
            await (page as Page).close();
          } else {
            await (page as PuppeteerPage).close();
          }
        } catch (error) {
          console.error('Error closing page:', error);
        }
      }
    }
  }

  /**
   * Navigate to URL
   */
  private async navigate(
    page: Page | PuppeteerPage,
    config: BrowserActionConfig,
    engine: 'playwright' | 'puppeteer'
  ): Promise<BrowserActionResult> {
    if (!config.url) {
      throw new Error('URL is required for navigate action');
    }

    if (engine === 'playwright') {
      const pwPage = page as Page;
      await pwPage.goto(config.url, {
        waitUntil: 'networkidle',
        timeout: config.waitTimeout || 30000,
      });

      if (config.waitForSelector) {
        await pwPage.waitForSelector(config.waitForSelector, {
          timeout: config.waitTimeout || 30000,
        });
      }

      const html = await pwPage.content();
      let screenshot: string | undefined;

      if (config.screenshot) {
        screenshot = (await pwPage.screenshot({ encoding: 'base64', fullPage: true })) as string;
      }

      return {
        success: true,
        action: 'navigate',
        html,
        screenshot: screenshot ? `data:image/png;base64,${screenshot}` : undefined,
        metadata: {
          engine,
          latency: 0,
          url: config.url,
        },
      };
    } else {
      const ppPage = page as PuppeteerPage;
      await ppPage.goto(config.url, {
        waitUntil: 'networkidle2',
        timeout: config.waitTimeout || 30000,
      });

      if (config.waitForSelector) {
        await ppPage.waitForSelector(config.waitForSelector, {
          timeout: config.waitTimeout || 30000,
        });
      }

      const html = await ppPage.content();
      let screenshot: string | undefined;

      if (config.screenshot) {
        screenshot = (await ppPage.screenshot({ encoding: 'base64', fullPage: true })) as string;
      }

      return {
        success: true,
        action: 'navigate',
        html,
        screenshot: screenshot ? `data:image/png;base64,${screenshot}` : undefined,
        metadata: {
          engine,
          latency: 0,
          url: config.url,
        },
      };
    }
  }

  /**
   * Click an element
   */
  private async click(
    page: Page | PuppeteerPage,
    config: BrowserActionConfig,
    engine: 'playwright' | 'puppeteer'
  ): Promise<BrowserActionResult> {
    if (!config.selector) {
      throw new Error('Selector is required for click action');
    }

    if (engine === 'playwright') {
      const pwPage = page as Page;
      await pwPage.click(config.selector, { timeout: config.waitTimeout || 30000 });

      // Wait a bit for any navigation or updates
      await pwPage.waitForTimeout(1000);

      return {
        success: true,
        action: 'click',
        metadata: {
          engine,
          latency: 0,
        },
      };
    } else {
      const ppPage = page as PuppeteerPage;
      await ppPage.click(config.selector, { timeout: config.waitTimeout || 30000 });

      // Wait a bit for any navigation or updates
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return {
        success: true,
        action: 'click',
        metadata: {
          engine,
          latency: 0,
        },
      };
    }
  }

  /**
   * Fill a form field
   */
  private async fill(
    page: Page | PuppeteerPage,
    config: BrowserActionConfig,
    engine: 'playwright' | 'puppeteer'
  ): Promise<BrowserActionResult> {
    if (!config.selector || config.value === undefined) {
      throw new Error('Selector and value are required for fill action');
    }

    if (engine === 'playwright') {
      const pwPage = page as Page;
      await pwPage.fill(config.selector, config.value, { timeout: config.waitTimeout || 30000 });

      return {
        success: true,
        action: 'fill',
        metadata: {
          engine,
          latency: 0,
        },
      };
    } else {
      const ppPage = page as PuppeteerPage;
      await ppPage.type(config.selector, config.value, { timeout: config.waitTimeout || 30000 });

      return {
        success: true,
        action: 'fill',
        metadata: {
          engine,
          latency: 0,
        },
      };
    }
  }

  /**
   * Extract data using selectors
   */
  private async extract(
    page: Page | PuppeteerPage,
    config: BrowserActionConfig,
    engine: 'playwright' | 'puppeteer'
  ): Promise<BrowserActionResult> {
    if (!config.extractSelectors || Object.keys(config.extractSelectors).length === 0) {
      throw new Error('extractSelectors is required for extract action');
    }

    const data: Record<string, any> = {};

    if (engine === 'playwright') {
      const pwPage = page as Page;

      for (const [fieldName, selector] of Object.entries(config.extractSelectors)) {
        try {
          const elements = await pwPage.$$(selector);
          if (elements.length === 0) {
            data[fieldName] = null;
          } else if (elements.length === 1) {
            data[fieldName] = await elements[0].textContent();
          } else {
            data[fieldName] = await Promise.all(
              elements.map((el) => el.textContent())
            );
          }
        } catch (error) {
          data[fieldName] = null;
        }
      }
    } else {
      const ppPage = page as PuppeteerPage;

      for (const [fieldName, selector] of Object.entries(config.extractSelectors)) {
        try {
          const elements = await ppPage.$$(selector);
          if (elements.length === 0) {
            data[fieldName] = null;
          } else if (elements.length === 1) {
            data[fieldName] = await ppPage.evaluate((el) => el.textContent, elements[0]);
          } else {
            data[fieldName] = await ppPage.evaluate((els) => {
              return els.map((el) => el.textContent);
            }, elements);
          }
        } catch (error) {
          data[fieldName] = null;
        }
      }
    }

    return {
      success: true,
      action: 'extract',
      data,
      metadata: {
        engine,
        latency: 0,
      },
    };
  }

  /**
   * Take screenshot
   */
  private async takeScreenshot(
    page: Page | PuppeteerPage,
    config: BrowserActionConfig,
    engine: 'playwright' | 'puppeteer'
  ): Promise<BrowserActionResult> {
    if (engine === 'playwright') {
      const pwPage = page as Page;
      const screenshot = (await pwPage.screenshot({
        encoding: 'base64',
        fullPage: true,
      })) as string;

      return {
        success: true,
        action: 'screenshot',
        screenshot: `data:image/png;base64,${screenshot}`,
        metadata: {
          engine,
          latency: 0,
        },
      };
    } else {
      const ppPage = page as PuppeteerPage;
      const screenshot = (await ppPage.screenshot({
        encoding: 'base64',
        fullPage: true,
      })) as string;

      return {
        success: true,
        action: 'screenshot',
        screenshot: `data:image/png;base64,${screenshot}`,
        metadata: {
          engine,
          latency: 0,
        },
      };
    }
  }

  /**
   * Wait for selector or timeout
   */
  private async wait(
    page: Page | PuppeteerPage,
    config: BrowserActionConfig,
    engine: 'playwright' | 'puppeteer'
  ): Promise<BrowserActionResult> {
    if (config.waitForSelector) {
      if (engine === 'playwright') {
        const pwPage = page as Page;
        await pwPage.waitForSelector(config.waitForSelector, {
          timeout: config.waitTimeout || 30000,
        });
      } else {
        const ppPage = page as PuppeteerPage;
        await ppPage.waitForSelector(config.waitForSelector, {
          timeout: config.waitTimeout || 30000,
        });
      }
    } else if (config.waitTimeout) {
      await new Promise((resolve) => setTimeout(resolve, config.waitTimeout));
    }

    return {
      success: true,
      action: 'wait',
      metadata: {
        engine,
        latency: 0,
      },
    };
  }

  /**
   * Evaluate JavaScript
   */
  private async evaluate(
    page: Page | PuppeteerPage,
    config: BrowserActionConfig,
    engine: 'playwright' | 'puppeteer'
  ): Promise<BrowserActionResult> {
    if (!config.evaluateScript) {
      throw new Error('evaluateScript is required for evaluate action');
    }

    let result: any;

    if (engine === 'playwright') {
      const pwPage = page as Page;
      result = await pwPage.evaluate(config.evaluateScript);
    } else {
      const ppPage = page as PuppeteerPage;
      result = await ppPage.evaluate(config.evaluateScript);
    }

    return {
      success: true,
      action: 'evaluate',
      data: result,
      metadata: {
        engine,
        latency: 0,
      },
    };
  }
}

export const browserAutomationService = new BrowserAutomationService(
  browserPoolService,
  browserSwitchService
);

