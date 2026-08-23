const { Annotation, END, MessagesAnnotation, START, StateGraph } = require("@langchain/langgraph");
const { ToolNode } = require("@langchain/langgraph/prebuilt");
const { ChatAnthropic } = require("@langchain/anthropic");
const { AIMessage, HumanMessage, SystemMessage } = require("@langchain/core/messages");
const env = require("../../config/env");
const { log } = require("../../utils/logger");
const { ToolRegistry } = require("../registry/tool.registry");
const { googleSearchTool } = require("../tools/google-search.tool");
const { urlReaderTool } = require("../tools/url-reader.tool");
const { analyzeRequest } = require("../../reasoning/request.reasoner");
const { createExecutionPlan } = require("../../planning/planner");
const { createExecutionState } = require("../../execution/execution.state");
const { saveCheckpoint } = require("../../checkpoint/checkpoint.manager");
const { createTracer } = require("../../observability/tracer");
const { verifyReports } = require("../../agents/verifier.agent");
const { critiqueAnswer } = require("../../agents/critic.agent");
const { withRecovery } = require("../../agents/recovery.agent");
const { evaluateRun } = require("../../evaluation/evaluator");

const registry = new ToolRegistry()
  .registerTool(googleSearchTool)
  .registerTool(urlReaderTool);
const tools = registry.getAvailableTools();

function createModel(agentTools = []) {
  if (!env.anthropicApiKey) return null;
  const model = new ChatAnthropic({
    apiKey: env.anthropicApiKey,
    temperature: 0.8,
    maxOutputTokens: 2048,
  });
  return agentTools.length ? model.bindTools(agentTools) : model;
}

const agentModels = {
  coordinator: createModel(),
  research: createModel([googleSearchTool]),
  pageReader: createModel([urlReaderTool]),
  general: createModel(),
};

const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  response: Annotation({ reducer: (_, next) => next, default: () => "" }),
  steps: Annotation({ reducer: (_, next) => next, default: () => 0 }),
  toolsUsed: Annotation({ reducer: (current, next) => [...current, ...next], default: () => [] }),
  context: Annotation({ reducer: (_, next) => next, default: () => [] }),
  memory: Annotation({ reducer: (_, next) => next, default: () => [] }),
  taskContext: Annotation({ reducer: (_, next) => next, default: () => ({}) }),
  requestReasoning: Annotation({ reducer: (_, next) => next, default: () => ({}) }),
  plan: Annotation({ reducer: (_, next) => next, default: () => [] }),
});

function asMessage(message) {
  if (message.role === "assistant") return new AIMessage(message.content);
  return new HumanMessage(message.content);
}

function sourceUrls(messages) {
  return [...new Set(messages
    .filter((message) => message.constructor?.name === "ToolMessage")
    .flatMap((message) => String(message.content).match(/https?:\/\/[^\s]+/g) || [])
    .map((url) => url.replace(/[),.;]+$/, "")))];
}

function createAgentGraph(agentId, agentModel, agentTools) {
  function loadContextNode(state) {
    return { context: state.context || [], memory: state.memory || [], taskContext: state.taskContext || {}, requestReasoning: state.requestReasoning || {}, plan: state.plan || [] };
  }

  async function reasoningNode(state) {
    if (!agentModel) throw new Error("Claude API key is missing. Set ANTHROPIC_API_KEY in backend/.env");
    const started = Date.now();
    log("agent.reasoning.started", { agentId, step: state.steps + 1 });
    const roleInstructions = {
      research: `You are the research specialist. The current date is ${new Date().toISOString().slice(0, 10)}. Find current, factual information with Google Search when needed. For latest or news questions, rely only on returned search results, preserve their publication dates, and include the exact source URLs returned by the tool. Never invent a headline, date, source name, or detail that is not present in the tool output. Never present an undated or older result as current; say when live evidence is unavailable. Do not read webpages directly.`,
      pageReader: "You are the webpage specialist. Read and summarize public URLs with the webpage reader when needed. Do not perform web searches.",
      general: "You are a careful general assistant. Answer directly without tools.",
    };
    const context = state.context.map((item) => `${item.role}: ${item.content}`).join("\n");
    const memory = state.memory.map((item) => `${item.type} (${item.key}): ${item.value}`).join("\n");
    const task = JSON.stringify({ goal: state.taskContext.currentGoal, plan: state.plan, completed: state.taskContext.completedSteps, pending: state.taskContext.pendingSteps, decisions: state.taskContext.currentDecisions });
    const result = await agentModel.invoke([
      new SystemMessage(`${roleInstructions[agentId]} After using tools, answer with concise, useful context and never invent tool results. Verified relevant memory is authoritative: use it when answering personal-memory questions, and never claim you do not know a fact that appears below.\nRequest reasoning: ${JSON.stringify(state.requestReasoning)}\nVerified relevant memory:\n${memory || "None"}\nTask context:\n${task}\nRecent conversation:\n${context || "None"}`),
      ...state.messages,
    ]);
    const toolNames = (result.tool_calls || []).map((call) => call.name);
    log("agent.reasoning.completed", { agentId, durationMs: Date.now() - started, selectedTools: toolNames });
    return { messages: [result], steps: state.steps + 1, toolsUsed: toolNames };
  }

  function nextNode(state) {
    const last = state.messages[state.messages.length - 1];
    if (last instanceof AIMessage && last.tool_calls?.length && state.steps < env.agentMaxSteps) {
      return "toolExecution";
    }
    return "finalResponse";
  }

  async function responseNode(state) {
    const last = state.messages[state.messages.length - 1];
    const storedName = state.memory.find((item) => item.key === "name")?.value;
    const asksForName = /\b(what is my name|what's my name|who am i)\b/i.test(state.requestReasoning.intent || "");
    let content = storedName && asksForName
      ? `Your name is ${storedName}.`
      : typeof last.content === "string" ? last.content : JSON.stringify(last.content);
    if (!content) throw new Error("Claude returned an empty response.");
    if (agentId === "research") {
      const urls = sourceUrls(state.messages);
      if (urls.length && !content.includes("Sources:")) content += `\n\nSources:\n${urls.map((url) => `- ${url}`).join("\n")}`;
    }
    return { response: content };
  }

  return new StateGraph(AgentState)
    .addNode("loadContext", loadContextNode)
    .addNode("reasoning", reasoningNode)
    .addNode("toolExecution", new ToolNode(agentTools))
    .addNode("finalResponse", responseNode)
    .addEdge(START, "loadContext")
    .addEdge("loadContext", "reasoning")
    .addConditionalEdges("reasoning", nextNode, ["toolExecution", "finalResponse"])
    .addEdge("toolExecution", "reasoning")
    .addEdge("finalResponse", END)
    .compile();
}

const graphs = {
  research: createAgentGraph("research", agentModels.research, [googleSearchTool]),
  pageReader: createAgentGraph("pageReader", agentModels.pageReader, [urlReaderTool]),
  general: createAgentGraph("general", agentModels.general, []),
};

function selectAgents(message, reasoning = analyzeRequest(message)) {
  const hasUrl = /https?:\/\/\S+/i.test(message);
  if (reasoning.needsResearch && (hasUrl || reasoning.needsWebpage)) return ["research", "pageReader"];
  if (reasoning.needsWebpage || hasUrl) return ["pageReader"];
  if (reasoning.needsResearch) return ["research"];
  return ["general"];
}

async function runSpecialist(agentId, message, history, onEvent, options = {}) {
  const graph = graphs[agentId];
  const input = { messages: [...history.map(asMessage), new HumanMessage(message)], ...options };
  const result = { messages: [], toolsUsed: [], steps: 0, response: "" };
  if (onEvent) {
    for await (const update of await graph.stream(input, { streamMode: "updates" })) {
      for (const nodeUpdate of Object.values(update)) {
        if (nodeUpdate.messages) result.messages.push(...nodeUpdate.messages);
        if (nodeUpdate.toolsUsed) result.toolsUsed.push(...nodeUpdate.toolsUsed);
        if (nodeUpdate.steps !== undefined) result.steps = nodeUpdate.steps;
        if (nodeUpdate.response) result.response = nodeUpdate.response;
      }
      await onEvent(update);
    }
  } else {
    Object.assign(result, await graph.invoke(input));
  }
  return {
    response: result.response,
    toolsUsed: [...new Set(result.toolsUsed)],
    toolOutputs: result.messages
      .filter((item) => item.constructor?.name === "ToolMessage")
      .map((item) => ({ name: item.name || "tool", content: String(item.content).slice(0, 4000) })),
  };
}

async function synthesize(message, specialistResults, options = {}) {
  if (!agentModels.coordinator) throw new Error("Claude API key is missing. Set ANTHROPIC_API_KEY in backend/.env");
  const sources = specialistResults.map(({ agentId, response }) => `${agentId}:\n${response}`).join("\n\n");
  const result = await agentModels.coordinator.invoke([
    new SystemMessage("You are the coordinator. Synthesize specialist reports into one accurate, direct answer. Do not claim work the reports did not perform."),
    new HumanMessage(`User request:\n${message}\n\nReasoning:\n${JSON.stringify(options.reasoning || {})}\n\nRelevant memory:\n${JSON.stringify(options.memory || [])}\n\nConversation context:\n${(options.context || []).map((item) => `${item.role}: ${item.content}`).join("\n")}\n\nTask context:\n${JSON.stringify(options.taskContext || {})}\n\nSpecialist reports:\n${sources}`),
  ]);
  return typeof result.content === "string" ? result.content : JSON.stringify(result.content);
}

const graph = graphs.general;

async function runAgent(message, history = [], onEvent, options = {}) {
  const started = Date.now();
  log("agent.request.started", { messageLength: message.length });
  const reasoning = options.reasoning || analyzeRequest(message, options.context || history, options.taskContext || {});
  const plan = options.executionPlan || createExecutionPlan(message, reasoning, options.taskContext || {}, options.memory || [], registry.getAvailableTools());
  const executionState = createExecutionState({ message, context: options.context || [], memory: options.memory || [], taskContext: options.taskContext || {}, plan });
  const tracer = createTracer(executionState.executionId);
  tracer.record("planning", { reasoning, plan });
  saveCheckpoint(executionState.executionId, "planning", executionState);
  if (onEvent) {
    await onEvent({ lifecycle: { stage: "planning", status: "completed", plan, executionId: executionState.executionId } });
    await onEvent({ lifecycle: { stage: "reasoning", status: "completed", reasoning } });
  }
  const agentIds = selectAgents(message, reasoning).filter((agentId) => plan.requiredAgents.includes(agentId));
  const selectedAgents = agentIds.length ? agentIds : ["general"];
  const toolsUsed = [];
  const toolOutputs = [];
  tracer.record("agents_started", { agents: selectedAgents });
  const specialistResults = (await Promise.all(selectedAgents.slice(0, env.maxParallelAgents).map(async (agentId) => {
    if (onEvent) await onEvent({ agentProgress: { agentId, status: "started", message: `${agentId} agent started.` } });
    if (onEvent) await onEvent({ lifecycle: { stage: "agent_selected", status: "started", agentId } });
    const recovered = await withRecovery(
      () => runSpecialist(agentId, message, history, onEvent, { context: options.context || [], memory: options.memory || [], taskContext: options.taskContext || {}, requestReasoning: reasoning, plan: plan.steps }),
      () => ({ response: `${agentId} agent was unavailable; continue with the remaining evidence.`, toolsUsed: [], toolOutputs: [] }),
      executionState,
      agentId,
    );
    const result = recovered.value;
    toolsUsed.push(...result.toolsUsed);
    toolOutputs.push(...result.toolOutputs);
    if (onEvent) await onEvent({ agentProgress: { agentId, status: "completed", recovered: recovered.recovered, message: `${agentId} agent completed.` } });
    return { agentId, response: result.response };
  }))).filter((result) => result.response);
  executionState.completedSteps.push("Specialist execution");
  saveCheckpoint(executionState.executionId, "toolExecution", executionState);
  if (specialistResults.length > 1 && onEvent) await onEvent({ lifecycle: { stage: "coordinator_running", status: "started" } });
  const response = specialistResults.length > 1
    ? await synthesize(message, specialistResults, { ...options, plan })
    : specialistResults[0].response;
  tracer.record("coordinator", { agentCount: specialistResults.length });
  saveCheckpoint(executionState.executionId, "coordinator", executionState);
  const verification = verifyReports(specialistResults, message);
  executionState.confidence = verification.confidence;
  tracer.record("verification", verification);
  saveCheckpoint(executionState.executionId, "verification", executionState);
  const critique = critiqueAnswer(response, verification, env.confidenceThreshold);
  const finalResponse = critique.passed ? response : `${response}\n\nConfidence note: Some evidence could not be fully verified; please treat uncertain claims cautiously.`;
  const evaluation = evaluateRun({ response: finalResponse, verification, critique, state: executionState, tools: toolsUsed, latencyMs: Date.now() - started });
  tracer.record("critic", critique);
  log("agent.request.completed", { durationMs: Date.now() - started, agents: selectedAgents, retries: executionState.metadata.retries, confidence: executionState.confidence });
  return { response: finalResponse, toolsUsed: [...new Set(toolsUsed)], toolOutputs, plan, verification, critique, evaluation, executionId: executionState.executionId, failures: executionState.failures, trace: tracer.getEvents() };
}

module.exports = { runAgent, registry, graph, selectAgents };