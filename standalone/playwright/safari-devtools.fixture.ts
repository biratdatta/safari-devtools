/**
 * Playwright fixture for Safari DevTools.
 *
 *   import { test, expect } from './safari-devtools.fixture';
 *   test('no errors', async ({ page, devtools }) => {
 *     await page.goto('/');
 *     expect(await devtools.errors()).toEqual([]);
 *   });
 *
 * The tool is injected with page.addInitScript, so it runs before the page's own
 * scripts on every navigation and captures everything from the first line.
 * Works in every Playwright browser; use the WebKit projects to test Safari's engine.
 * On failure, a debug report and a HAR file are attached to the test result.
 */
import { test as base, expect, type Page } from '@playwright/test';
import path from 'node:path';

const TOOL = process.env.SAFARI_DEVTOOLS_JS || path.resolve(__dirname, '..', 'safari-devtools.js');

export type Severity = 'error' | 'warning' | 'info';
export interface LogEntry { id: number; time: number; level: 'error' | 'warn' | 'info' | 'verbose'; kind: string; count: number; text: string; site: string | null }
export interface NetEntry {
  id: number; kind: string; method: string; url: string; status: number | null; statusText: string; error: string | null;
  ms: number | null; size: number | null; mime: string; mocked: boolean; blocked: boolean; done: boolean;
  requestHeaders?: Record<string, string>; responseHeaders?: Record<string, string>; requestBody?: string | null; responseBody?: string | null;
}
export interface AuditIssue { severity: Severity; group: string; title: string; why: string; count: number; elements: string[] }
export interface MockOptions { status?: number; body?: unknown; type?: string; delay?: number; method?: string }
export type Throttle = 'none' | 'fast4g' | 'fast3g' | 'slow3g' | 'offline';

export class DevTools {
  constructor(private readonly page: Page) {}

  /** Call any SafariDevTools.automation method in the page. */
  call<T = unknown>(action: string, ...args: unknown[]): Promise<T> {
    return this.page.evaluate(async ([a, rest]) => {
      const sdt = (window as any).SafariDevTools;
      if (!sdt || !sdt.automation) throw new Error('Safari DevTools is not loaded on this page');
      return await sdt.automation[a as string](...(rest as unknown[]));
    }, [action, args] as const) as Promise<T>;
  }

  // console
  logs(filter?: { level?: LogEntry['level']; text?: string; limit?: number }) { return this.call<LogEntry[]>('logs', filter); }
  errors() { return this.call<LogEntry[]>('errors'); }
  warnings() { return this.call<LogEntry[]>('warnings'); }
  waitForLog(text: string, timeoutMs = 5000, level?: LogEntry['level']) { return this.call<LogEntry>('waitForLog', text, timeoutMs, level); }
  clearLogs() { return this.call('clearLogs'); }

  // network
  network(filter?: { url?: string; method?: string; status?: number; kind?: string; failed?: boolean; bodies?: boolean }) { return this.call<NetEntry[]>('network', filter); }
  waitForRequest(url: string, timeoutMs = 5000) { return this.call<NetEntry>('waitForRequest', url, timeoutMs); }
  har() { return this.call<object>('har'); }
  mock(match: string, opts: MockOptions = {}) { return this.call<string>('mock', match, opts); }
  block(match: string, method?: string) { return this.call<string>('block', match, method); }
  delay(match: string, ms: number, method?: string) { return this.call<string>('delay', match, ms, method); }
  clearRules() { return this.call('clearRules'); }
  throttle(preset: Throttle) { return this.call<Throttle>('throttle', preset); }

  /** Rules that apply from the very first request of the next navigation(s). */
  async mockBeforeLoad(match: string, opts: MockOptions = {}) {
    const body = opts.body == null ? '' : typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    const rule = { on: true, match, method: opts.method || 'ANY', action: 'mock', status: opts.status || 200, type: opts.type || (typeof opts.body === 'string' ? 'text/plain' : 'application/json'), body, delay: opts.delay || 0 };
    await this.page.addInitScript((r) => { (window as any).__SDT_RULES__ = ((window as any).__SDT_RULES__ || []).concat([r]); }, rule);
  }
  async blockBeforeLoad(match: string) {
    await this.page.addInitScript((m) => { (window as any).__SDT_RULES__ = ((window as any).__SDT_RULES__ || []).concat([{ on: true, match: m, method: 'ANY', action: 'block' }]); }, match);
  }
  async throttleBeforeLoad(preset: Throttle) { await this.page.addInitScript((p) => { (window as any).__SDT_THROTTLE__ = p; }, preset); }

  // page inspection
  audit(opts?: { severity?: Severity; maxElements?: number }) { return this.call<AuditIssue[]>('audit', opts); }
  query(selector: string, limit = 50) { return this.call<any[]>('query', selector, limit); }
  element(selector: string) { return this.call<any>('element', selector); }
  styles(selector: string) { return this.call<any[]>('styles', selector); }
  computed(selector: string, props?: string[]) { return this.call<Record<string, string>>('computed', selector, props); }
  listeners(selector: string) { return this.call<any[]>('listeners', selector); }
  component(selector: string) { return this.call<any>('component', selector); }
  tokens() { return this.call<any[]>('tokens'); }
  setToken(name: string, value: string) { return this.call<string>('setToken', name, value); }
  perf() { return this.call<Record<string, unknown>>('perf'); }
  storage() { return this.call<Record<string, unknown>>('storage'); }
  viewport() { return this.call<Record<string, unknown>>('viewport'); }
  report() { return this.call<Record<string, unknown>>('report'); }
  /** Show the panel (useful with --headed or in trace screenshots). */
  open(tab?: string) { return this.call('open', tab); }
}

export const test = base.extend<{ devtools: DevTools; devtoolsOptions: { open?: boolean } }>({
  devtoolsOptions: [{ open: false }, { option: true }],
  devtools: async ({ page, devtoolsOptions }, use, testInfo) => {
    if (devtoolsOptions.open) await page.addInitScript(() => { try { sessionStorage.setItem('__sdt_ui', JSON.stringify({ open: true, tab: 'console' })); } catch (e) {} });
    await page.addInitScript({ path: TOOL });
    const dt = new DevTools(page);
    await use(dt);
    if (testInfo.status !== testInfo.expectedStatus) {
      try {
        await testInfo.attach('safari-devtools-report.json', { body: JSON.stringify(await dt.report(), null, 2), contentType: 'application/json' });
        await testInfo.attach('network.har', { body: JSON.stringify(await dt.har(), null, 2), contentType: 'application/json' });
      } catch { /* page may be closed */ }
    }
  },
});

export { expect };
