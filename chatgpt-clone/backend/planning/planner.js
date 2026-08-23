function createExecutionPlan(message, reasoning = {}, taskContext = {}, memory = [], availableTools = []) {
  const text = String(message || "");
  const intent = reasoning.intent || "general assistance";
  const hasUrl = /https?:\/\/\S+/i.test(text);
  const needsResearch = Boolean(reasoning.needsResearch);
  const needsPageReader = Boolean(reasoning.needsWebpage || hasUrl);
  const steps = [];
  if (memory.length) steps.push("Use relevant verified memory and conversation context");
  if (needsResearch) steps.push("Research current evidence");
  if (needsPageReader) steps.push("Read and extract supplied webpage evidence");
  steps.push("Synthesize an answer grounded in available evidence");
  steps.push("Verify major claims and evaluate answer quality");
  const agents = [...new Set([
    ...(needsResearch ? ["research"] : []),
    ...(needsPageReader ? ["pageReader"] : []),
    "coordinator",
    "verifier",
    "critic",
  ])];
  const complexity = steps.length >= 5 || text.length > 600 ? "high" : steps.length >= 3 ? "medium" : "low";
  return {
    goal: taskContext.currentGoal || text,
    intent,
    complexity,
    requiredAgents: agents,
    requiredTools: availableTools.filter((tool) => (agents.includes("research") && tool.name === "google_search") || (agents.includes("pageReader") && tool.name === "read_webpage")).map((tool) => tool.name),
    parallelOpportunities: needsResearch && needsPageReader ? [["research", "pageReader"]] : [],
    steps,
    expectedOutput: "A direct response with uncertainty and sources disclosed where relevant.",
    confidence: memory.length || needsResearch || needsPageReader ? 0.75 : 0.6,
    fallbackStrategy: ["retry", "alternative tool", "cached result", "relevant memory", "state uncertainty"],
    estimatedCost: { toolCalls: Number(needsResearch) + Number(needsPageReader), maxSteps: steps.length, latencyClass: complexity },
  };
}

function createPlan(message, taskContext = {}) {
  if (taskContext.currentPlan?.length) return taskContext.currentPlan;
  if (!/(build|create|implement|design|migrate|fix|help me|set up|setup)/i.test(String(message))) return [];
  return createExecutionPlan(message, {}, taskContext).steps;
}

module.exports = { createPlan, createExecutionPlan };
