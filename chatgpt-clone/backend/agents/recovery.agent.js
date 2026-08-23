const env = require("../config/env");

async function withRecovery(operation, fallback, state, label) {
  let lastError;
  for (let attempt = 0; attempt <= env.maxRetries; attempt += 1) {
    try {
      const value = await operation(attempt);
      if (typeof value === "string" && /failed|unavailable|could not be read/i.test(value)) throw new Error(value);
      return { value, attempts: attempt + 1, recovered: attempt > 0 };
    } catch (error) {
      lastError = error;
      state.failures.push({ component: label, attempt: attempt + 1, type: error.name, message: error.message, at: new Date().toISOString() });
      state.metadata.retries += 1;
    }
  }
  if (fallback) {
    try { return { value: await fallback(lastError), attempts: env.maxRetries + 1, recovered: true, fallback: true }; } catch (error) { lastError = error; }
  }
  throw lastError;
}

module.exports = { withRecovery };
