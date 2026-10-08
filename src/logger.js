import { setting } from './runtime-config.js';

const levels = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = levels[setting('LOG_LEVEL')?.toLowerCase() ?? 'info'] ?? 1;

function format(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const base = { timestamp, level, message, ...meta };
  return JSON.stringify(base);
}

export const logger = {
  debug: (message, meta) => {
    if (currentLevel <= levels.debug) console.debug(format('debug', message, meta));
  },
  info: (message, meta) => {
    if (currentLevel <= levels.info) console.info(format('info', message, meta));
  },
  warn: (message, meta) => {
    if (currentLevel <= levels.warn) console.warn(format('warn', message, meta));
  },
  error: (message, meta) => {
    if (currentLevel <= levels.error) console.error(format('error', message, meta));
  }
};

export function createChildLogger(bindings) {
  return {
    debug: (message, meta) => logger.debug(message, { ...bindings, ...meta }),
    info: (message, meta) => logger.info(message, { ...bindings, ...meta }),
    warn: (message, meta) => logger.warn(message, { ...bindings, ...meta }),
    error: (message, meta) => logger.error(message, { ...bindings, ...meta })
  };
}