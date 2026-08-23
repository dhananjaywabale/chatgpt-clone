const crypto = require("crypto");

function createExecutionState(input = {}) {
  return {
    executionId: input.executionId || crypto.randomUUID(),
    request: input.message || "",
    context: input.context || [],
    memory: input.memory || [],
    taskContext: input.taskContext || {},
    plan: input.plan || null,
    completedSteps: [],
    pendingSteps: input.plan?.steps ? [...input.plan.steps] : [],
    toolResults: [],
    failures: [],
    confidence: input.plan?.confidence || 0,
    metadata: { startedAt: new Date().toISOString(), retries: 0, ...input.metadata },
    trace: [],
  };
}

function updateExecutionState(state, changes = {}) {
  const next = { ...state, ...changes };
  next.completedSteps = [...new Set([...(state.completedSteps || []), ...(changes.completedSteps || [])])];
  next.pendingSteps = changes.pendingSteps || state.pendingSteps || [];
  next.failures = [...(state.failures || []), ...(changes.failures || [])];
  next.metadata = { ...state.metadata, ...(changes.metadata || {}) };
  return next;
}

module.exports = { createExecutionState, updateExecutionState };
