import pino from 'pino';
import { setting } from './runtime-config.js';

const isProduction = () => setting('NODE_ENV') === 'production';
const isWorker = () => setting('CLOUDFLARE_WORKER') === 'true';

function prettyConfig() {
  if (isProduction()) return false;
  if (isWorker()) return false;
  return {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
    messageFormat: '{msg} {req.id} {req.method} {req.url} {res.statusCode}',
  };
}

const logger = pino({
  level: setting('LOG_LEVEL') || (isProduction() ? 'info' : 'debug'),
  transport: prettyConfig(),
  base: {
    service: 'vantage-ars',
    version: '2.0.0',
    environment: setting('NODE_ENV') || 'development',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createRequestLogger(reqId, meta = {}) {
  return logger.child({ reqId, ...meta });
}

export function logRequest(logger, method, url, statusCode, durationMs, meta = {}) {
  logger.info({ method, url, statusCode, durationMs, ...meta }, 'HTTP request completed');
}

export function logError(logger, error, context = {}) {
  logger.error({ err: error, ...context }, error.message || 'Error occurred');
}

export function logAudit(logger, type, payload) {
  logger.info({ audit: { type, payload } }, 'Audit event recorded');
}

export function logDecision(logger, decisionId, status, evaluation) {
  logger.info({ decision: { id: decisionId, status, evaluation } }, 'Decision recorded');
}

export function logAuth(logger, event, meta = {}) {
  logger.info({ auth: { event, ...meta } }, `Auth: ${event}`);
}

export function logStaffRun(logger, trigger, result) {
  logger.info({ staff: { trigger, ...result } }, 'Staff run completed');
}

export function logBackup(logger, event, meta = {}) {
  logger.info({ backup: { event, ...meta } }, `Backup: ${event}`);
}

export { logger as default };