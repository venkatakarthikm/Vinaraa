'use strict';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const current = LEVELS[process.env.LOG_LEVEL] !== undefined ? LEVELS[process.env.LOG_LEVEL] : LEVELS.info;

function emit(level, message, meta) {
  if (LEVELS[level] > current) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(meta && typeof meta === 'object' ? { meta } : {}),
  };
  const text = JSON.stringify(line, (k, v) => (v instanceof Error ? { message: v.message, stack: v.stack } : v));
  if (level === 'error') console.error(text);
  else if (level === 'warn') console.warn(text);
  else console.log(text);
}

module.exports = {
  error: (m, meta) => emit('error', m, meta),
  warn: (m, meta) => emit('warn', m, meta),
  info: (m, meta) => emit('info', m, meta),
  debug: (m, meta) => emit('debug', m, meta),
  child: () => module.exports,
};
