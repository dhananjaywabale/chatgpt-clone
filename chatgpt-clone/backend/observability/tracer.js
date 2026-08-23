const env = require("../config/env");
const { log } = require("../utils/logger");

function createTracer(executionId) {
  const events = [];
  function record(stage, data = {}) {
    if (!env.enableTracing) return;
    const event = { executionId, stage, at: new Date().toISOString(), ...data };
    events.push(event);
    log(`trace.${stage}`, event);
  }
  return { record, getEvents: () => [...events] };
}

module.exports = { createTracer };
