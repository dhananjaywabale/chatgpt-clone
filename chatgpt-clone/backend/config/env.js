const required = (name) => {
  const value = process.env[name];
  return value && !value.startsWith("your_") ? value : null;
};

module.exports = {
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  claudeModel: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
  googleSearchApiKey: required("GOOGLE_SEARCH_API_KEY"),
  googleSearchEngineId: required("GOOGLE_SEARCH_ENGINE_ID"),
  agentMaxSteps: Number(process.env.AGENT_MAX_STEPS || 4),
  toolTimeoutMs: Number(process.env.TOOL_TIMEOUT_MS || 8000),
  maxMessageLength: Number(process.env.MAX_MESSAGE_LENGTH || 12000),
  shortTermHistory: Number(process.env.SHORT_TERM_HISTORY || 15),
  longTermMemoryEnabled: process.env.LONG_TERM_MEMORY_ENABLED !== "false",
  maxMemoryResults: Number(process.env.MAX_MEMORY_RESULTS || 5),
  maxAgentDepth: Number(process.env.MAX_AGENT_DEPTH || 8),
  maxRetries: Number(process.env.MAX_RETRIES || 2),
  maxParallelAgents: Number(process.env.MAX_PARALLEL_AGENTS || 3),
  enableTracing: process.env.ENABLE_TRACING !== "false",
  enableCheckpoints: process.env.ENABLE_CHECKPOINTS !== "false",
  enableEvaluation: process.env.ENABLE_EVALUATION !== "false",
  confidenceThreshold: Number(process.env.CONFIDENCE_THRESHOLD || 0.65),
  tokenLimit: Number(process.env.TOKEN_LIMIT || 12000),
  latencyLimit: Number(process.env.LATENCY_LIMIT || 30000),
};