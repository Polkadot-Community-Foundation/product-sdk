/**
 * Logger module for @parity/product-sdk
 *
 * Provides structured logging with configurable levels and namespaces.
 *
 * Credit: Based on polkadot-apps/packages/logger
 */

import type { LogLevel } from './types.js';

/** Log entry passed to custom handlers */
export interface LogEntry {
  level: LogLevel;
  namespace: string;
  message: string;
  data?: unknown;
  timestamp: number;
}

/** Custom log handler function */
export type LogHandler = (entry: LogEntry) => void;

/** Logger configuration options */
export interface LoggerConfig {
  /** Minimum log level. Default: "warn" */
  level?: LogLevel;
  /** If set, only these namespaces use the configured level; others stay at "warn". */
  namespaces?: string[];
  /** Custom output handler. Replaces default console output. */
  handler?: LogHandler;
}

/** Logger interface with level-specific methods */
export interface Logger {
  error(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  debug(message: string, data?: unknown): void;
}

// Level values for comparison (lower = more severe)
const LEVEL_VALUES: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const DEFAULT_LEVEL: LogLevel = 'warn';

// Console methods for each level
const CONSOLE_METHODS: Record<LogLevel, (...args: unknown[]) => void> = {
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Read from environment (Node.js) or localStorage (browser)
function readEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env?.[key]) return process.env[key];
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function getInitialLevel(): LogLevel {
  const raw = readEnv('PRODUCT_SDK_LOG');
  return raw && raw in LEVEL_VALUES ? (raw as LogLevel) : DEFAULT_LEVEL;
}

function getInitialNamespaces(): Set<string> | undefined {
  const raw = readEnv('PRODUCT_SDK_LOG_NS');
  if (!raw) return undefined;
  const ns = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ns.length > 0 ? new Set(ns) : undefined;
}

/** Mutable global state — modified by configure(), read by every logger instance. */
const state = {
  level: getInitialLevel(),
  namespaces: getInitialNamespaces(),
  handler: undefined as LogHandler | undefined,
};

function getEffectiveLevel(namespace: string): number {
  if (state.namespaces && !state.namespaces.has(namespace)) {
    return LEVEL_VALUES[DEFAULT_LEVEL];
  }
  return LEVEL_VALUES[state.level];
}

/**
 * Configure the global logger settings
 *
 * @param config - Logger configuration
 *
 * @example
 * ```ts
 * import { configure } from '@parity/product-sdk';
 *
 * // Set log level
 * configure({ level: 'debug' });
 *
 * // Filter to specific namespaces
 * configure({ level: 'debug', namespaces: ['wallet', 'chain'] });
 *
 * // Custom handler
 * configure({ handler: (entry) => myLogger.log(entry) });
 * ```
 */
export function configure(config: LoggerConfig): void {
  if (config.level !== undefined) {
    state.level = config.level;
  }
  if (config.namespaces !== undefined) {
    state.namespaces = config.namespaces.length > 0 ? new Set(config.namespaces) : undefined;
  }
  if (config.handler !== undefined) {
    state.handler = config.handler;
  }
}

function emit(level: LogLevel, namespace: string, message: string, data?: unknown): void {
  if (LEVEL_VALUES[level] > getEffectiveLevel(namespace)) {
    return;
  }

  const entry: LogEntry = {
    level,
    namespace,
    message,
    data,
    timestamp: Date.now(),
  };

  if (state.handler) {
    state.handler(entry);
    return;
  }

  const prefix = `[${namespace}]`;
  if (data !== undefined) {
    CONSOLE_METHODS[level](prefix, message, data);
  } else {
    CONSOLE_METHODS[level](prefix, message);
  }
}

/**
 * Create a namespaced logger instance
 *
 * @param namespace - Logger namespace (e.g., 'wallet', 'chain', 'storage')
 * @returns Logger instance with error, warn, info, debug methods
 *
 * @example
 * ```ts
 * import { createLogger } from '@parity/product-sdk';
 *
 * const log = createLogger('wallet');
 * log.info('Connected to wallet');
 * log.debug('Account details', { address: '5Grw...' });
 * ```
 */
export function createLogger(namespace: string): Logger {
  return {
    error: (message: string, data?: unknown) => emit('error', namespace, message, data),
    warn: (message: string, data?: unknown) => emit('warn', namespace, message, data),
    info: (message: string, data?: unknown) => emit('info', namespace, message, data),
    debug: (message: string, data?: unknown) => emit('debug', namespace, message, data),
  };
}
