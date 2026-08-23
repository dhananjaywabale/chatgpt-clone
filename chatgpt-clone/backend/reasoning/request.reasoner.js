function analyzeRequest(message, context = {}, taskContext = {}) {
  const text = String(message || "").trim();
  const hasUrl = /https?:\/\/\S+/i.test(text);
  const asksForCurrentInfo = /\b(latest|current|today|news|recent|price|release|update|202[0-9])\b/i.test(text);
  const asksForResearch = asksForCurrentInfo || /\b(compare|research|look up|find out|sources|documentation)\b/i.test(text);
  const asksForWebpage = hasUrl;
  const isContinuation = /^(continue|next|go on|proceed|what's next|resume)\b/i.test(text);
  const asksAboutMemory = /\b(what do you know about me|what is my name|who am i|what do you remember|remember me)\b/i.test(text);
  const taskType = isContinuation || taskContext.currentGoal ? "multi_step_task" : asksForResearch ? "research" : /\b(build|create|implement|design|fix|debug|write)\b/i.test(text) ? "implementation" : "question";
  const hasTaskContext = Boolean(taskContext.currentGoal || taskContext.currentPlan?.length || taskContext.completedSteps?.length || taskContext.pendingSteps?.length);
  const needsMemory = asksAboutMemory || isContinuation || hasTaskContext || /\b(my|prefer|always|usually|remember|we use|company)\b/i.test(text);
  const needsCoordinator = hasUrl && asksForResearch;
  return {
    intent: isContinuation ? "continue_existing_task" : text,
    taskType,
    needsTool: asksForResearch || asksForWebpage,
    needsMemory,
    needsResearch: asksForResearch,
    needsWebpage: asksForWebpage,
    needsCoordinator,
    confidence: text ? 0.86 : 0,
    contextMessages: context.length,
  };
}

module.exports = { analyzeRequest };
