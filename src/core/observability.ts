import { EventEmitter } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import { eventStore, DomainEvent } from './event-store.js';
import { setting } from '../runtime-config.js';

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export type MetricLabels = Record<string, string>;

export type Metric = {
  name: string;
  type: MetricType;
  value: number;
  labels: MetricLabels;
  timestamp: number;
};

export type TraceSpan = {
  spanId: string;
  traceId: string;
  parentSpanId: string | null;
  operationName: string;
  startTime: number;
  endTime: number | null;
  durationMs: number | null;
  tags: Record<string, string | number | boolean>;
  logs: Array<{ timestamp: number; fields: Record<string, unknown> }>;
  status: 'ok' | 'error' | 'timeout';
};

export type LogEntry = {
  timestamp: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  fields: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
};

export type HealthCheck = {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  details: Record<string, unknown>;
  timestamp: string;
};

class MetricsCollector extends EventEmitter {
  private metrics: Map<string, Metric[]> = new Map();
  private maxMetricsPerName = 10000;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startFlushInterval();
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => this.flush(), 60000);
  }

  counter(name: string, value: number = 1, labels: MetricLabels = {}): void {
    this.record({ name, type: 'counter', value, labels, timestamp: Date.now() });
  }

  gauge(name: string, value: number, labels: MetricLabels = {}): void {
    this.record({ name, type: 'gauge', value, labels, timestamp: Date.now() });
  }

  histogram(name: string, value: number, labels: MetricLabels = {}): void {
    this.record({ name, type: 'histogram', value, labels, timestamp: Date.now() });
  }

  summary(name: string, value: number, labels: MetricLabels = {}): void {
    this.record({ name, type: 'summary', value, labels, timestamp: Date.now() });
  }

  private record(metric: Metric): void {
    const key = this.metricKey(metric.name, metric.labels);
    const existing = this.metrics.get(key) || [];
    existing.push(metric);
    if (existing.length > this.maxMetricsPerName) {
      existing.shift();
    }
    this.metrics.set(key, existing);
    this.emit('metric', metric);
  }

  private metricKey(name: string, labels: MetricLabels): string {
    const labelStr = Object.entries(labels).sort().map(([k, v]) => `${k}="${v}"`).join(',');
    return `${name}{${labelStr}}`;
  }

  getMetrics(name?: string, labels?: MetricLabels): Metric[] {
    if (name) {
      const key = this.metricKey(name, labels || {});
      return this.metrics.get(key) || [];
    }
    return Array.from(this.metrics.values()).flat();
  }

  getMetricSummary(name: string, labels: MetricLabels = {}): { count: number; sum: number; min: number; max: number; avg: number } | null {
    const metrics = this.getMetrics(name, labels);
    if (metrics.length === 0) return null;
    const values = metrics.map(m => m.value);
    return {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    };
  }

  flush(): void {
    const allMetrics = this.getMetrics();
    console.debug(`[Metrics] Flushing ${allMetrics.length} metrics`);
    this.emit('flush', allMetrics);
  }

  reset(): void {
    this.metrics.clear();
  }

  shutdown(): void {
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.flush();
  }
}

class Tracer extends EventEmitter {
  private spans: Map<string, TraceSpan> = new Map();
  private activeSpans: Map<string, TraceSpan> = new Map();
  private maxSpans = 10000;

  startSpan(operationName: string, parentSpanId?: string, tags: Record<string, string | number | boolean> = {}): TraceSpan {
    const traceId = parentSpanId ? this.spans.get(parentSpanId)?.traceId || randomBytes(16).toString('hex') : randomBytes(16).toString('hex');
    const spanId = randomBytes(16).toString('hex');

    const span: TraceSpan = {
      spanId,
      traceId,
      parentSpanId: parentSpanId || null,
      operationName,
      startTime: Date.now(),
      endTime: null,
      durationMs: null,
      tags: { ...tags, 'span.kind': 'internal' },
      logs: [],
      status: 'ok',
    };

    this.spans.set(spanId, span);
    this.activeSpans.set(spanId, span);
    this.emit('span:started', span);

    if (this.spans.size > this.maxSpans) {
      const oldest = this.spans.keys().next().value;
      if (oldest) this.spans.delete(oldest);
    }

    return span;
  }

  finishSpan(spanId: string, status: 'ok' | 'error' | 'timeout' = 'ok', error?: Error): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    span.status = status;
    if (error) {
      span.tags.error = true;
      span.tags['error.message'] = error.message;
      span.tags['error.stack'] = error.stack || '';
    }
    this.activeSpans.delete(spanId);
    this.emit('span:finished', span);
  }

  addLog(spanId: string, fields: Record<string, unknown>): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.logs.push({ timestamp: Date.now(), fields });
    }
  }

  setTag(spanId: string, key: string, value: string | number | boolean): void {
    const span = this.spans.get(spanId);
    if (span) span.tags[key] = value;
  }

  getSpan(spanId: string): TraceSpan | undefined {
    return this.spans.get(spanId);
  }

  getTrace(traceId: string): TraceSpan[] {
    return Array.from(this.spans.values()).filter(s => s.traceId === traceId);
  }

  getActiveSpans(): TraceSpan[] {
    return Array.from(this.activeSpans.values());
  }
}

class StructuredLogger extends EventEmitter {
  private logs: LogEntry[] = [];
  private maxLogs = 50000;
  private level: LogEntry['level'] = 'info';
  private transports: LogTransport[] = [];

  constructor() {
    super();
    this.addTransport(new ConsoleTransport());
  }

  setLevel(level: LogEntry['level']): void {
    this.level = level;
  }

  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  trace(message: string, fields: Record<string, unknown> = {}): void {
    this.log('trace', message, fields);
  }

  debug(message: string, fields: Record<string, unknown> = {}): void {
    this.log('debug', message, fields);
  }

  info(message: string, fields: Record<string, unknown> = {}): void {
    this.log('info', message, fields);
  }

  warn(message: string, fields: Record<string, unknown> = {}): void {
    this.log('warn', message, fields);
  }

  error(message: string, fields: Record<string, unknown> = {}): void {
    this.log('error', message, fields);
  }

  fatal(message: string, fields: Record<string, unknown> = {}): void {
    this.log('fatal', message, fields);
  }

  private log(level: LogEntry['level'], message: string, fields: Record<string, unknown>): void {
    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    if (levels.indexOf(level) < levels.indexOf(this.level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      fields,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) this.logs.shift();

    for (const transport of this.transports) {
      transport.write(entry);
    }
    this.emit('log', entry);
  }

  getLogs(filter?: { level?: LogEntry['level']; since?: number; limit?: number }): LogEntry[] {
    let result = this.logs;
    if (filter?.level) result = result.filter(l => l.level === filter.level);
    if (filter?.since) result = result.filter(l => new Date(l.timestamp).getTime() > filter.since!);
    if (filter?.limit) result = result.slice(-filter.limit);
    return result;
  }
}

interface LogTransport {
  write(entry: LogEntry): void;
}

class ConsoleTransport implements LogTransport {
  write(entry: LogEntry): void {
    const colors = { trace: 90, debug: 36, info: 32, warn: 33, error: 31, fatal: 35 };
    const color = colors[entry.level];
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padStart(5);
    const fieldsStr = Object.keys(entry.fields).length ? ` ${JSON.stringify(entry.fields)}` : '';
    console.log(`\x1b[${color}m${timestamp} ${level}\x1b[0m ${entry.message}${fieldsStr}`);
  }
}

class HealthChecker extends EventEmitter {
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();
  private interval: NodeJS.Timeout | null = null;
  private results: Map<string, HealthCheck> = new Map();

  registerCheck(name: string, check: () => Promise<HealthCheck>): void {
    this.checks.set(name, check);
  }

  async runChecks(): Promise<HealthCheck[]> {
    const results: HealthCheck[] = [];
    for (const [name, check] of this.checks) {
      try {
        const result = await check();
        this.results.set(name, result);
        results.push(result);
      } catch (error) {
        const result: HealthCheck = {
          name,
          status: 'unhealthy',
          latencyMs: 0,
          details: { error: error instanceof Error ? error.message : String(error) },
          timestamp: new Date().toISOString(),
        };
        this.results.set(name, result);
        results.push(result);
      }
    }
    return results;
  }

  getResults(): HealthCheck[] {
    return Array.from(this.results.values());
  }

  getOverallStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    const results = this.getResults();
    if (results.length === 0) return 'healthy';
    if (results.some(r => r.status === 'unhealthy')) return 'unhealthy';
    if (results.some(r => r.status === 'degraded')) return 'degraded';
    return 'healthy';
  }

  startPeriodicChecks(intervalMs: number = 30000): void {
    this.interval = setInterval(() => this.runChecks(), intervalMs);
  }

  stopPeriodicChecks(): void {
    if (this.interval) clearInterval(this.interval);
  }
}

export const metrics = new MetricsCollector();
export const tracer = new Tracer();
export const logger = new StructuredLogger();
export const healthChecker = new HealthChecker();

export function createChildLogger(fields: Record<string, unknown>): StructuredLogger {
  const child = new StructuredLogger();
  child.setLevel(logger.level);
  const originalLog = child.log.bind(child);
  child.log = (level, message, msgFields) => originalLog(level, message, { ...fields, ...msgFields });
  return child;
}

export function traceAsync<T>(operationName: string, fn: () => Promise<T>, tags: Record<string, string | number | boolean> = {}): Promise<T> {
  const span = tracer.startSpan(operationName, undefined, tags);
  return fn()
    .then(result => {
      tracer.finishSpan(span.spanId, 'ok');
      return result;
    })
    .catch(error => {
      tracer.finishSpan(span.spanId, 'error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    });
}

export function traceSync<T>(operationName: string, fn: () => T, tags: Record<string, string | number | boolean> = {}): T {
  const span = tracer.startSpan(operationName, undefined, tags);
  try {
    const result = fn();
    tracer.finishSpan(span.spanId, 'ok');
    return result;
  } catch (error) {
    tracer.finishSpan(span.spanId, 'error', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export async function initializeObservability(): Promise<void> {
  healthChecker.registerCheck('event-store', async () => {
    const start = Date.now();
    try {
      await eventStore.getEvents('health-check');
      return { name: 'event-store', status: 'healthy', latencyMs: Date.now() - start, details: {}, timestamp: new Date().toISOString() };
    } catch {
      return { name: 'event-store', status: 'unhealthy', latencyMs: Date.now() - start, details: {}, timestamp: new Date().toISOString() };
    }
  });

  healthChecker.registerCheck('memory', async () => {
    const mem = process.memoryUsage();
    const heapUsedPercent = (mem.heapUsed / mem.heapTotal) * 100;
    return {
      name: 'memory',
      status: heapUsedPercent > 90 ? 'unhealthy' : heapUsedPercent > 75 ? 'degraded' : 'healthy',
      latencyMs: 0,
      details: { heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, heapUsedPercent },
      timestamp: new Date().toISOString(),
    };
  });

  healthChecker.registerCheck('event-loop', async () => {
    const start = Date.now();
    await new Promise(resolve => setImmediate(resolve));
    const latency = Date.now() - start;
    return {
      name: 'event-loop',
      status: latency > 100 ? 'unhealthy' : latency > 50 ? 'degraded' : 'healthy',
      latencyMs: latency,
      details: { lagMs: latency },
      timestamp: new Date().toISOString(),
    };
  });

  healthChecker.startPeriodicChecks(30000);

  metrics.counter('app.startup', 1, { version: '3.0.0' });
  logger.info('Observability initialized', { version: '3.0.0' });
}