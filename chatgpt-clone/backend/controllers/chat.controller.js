/**
 * chat.controller.js
 * --------------------
 * Handles the /chat endpoint: takes a user prompt, sends it (with
 * conversation history) to the Claude agent, persists both messages, and
 * returns the assistant's reply.
 */

const { runAgent } = require("../agent/graph/agent.graph");
const conversationService = require("../services/conversation.service");
const { maxMessageLength } = require("../config/env");
const { getContext } = require("../memory/conversation.memory");
const memoryManager = require("../memory/memory.manager");
const taskContextManager = require("../context/task-context.manager");
const { analyzeRequest } = require("../reasoning/request.reasoner");
const { createPlan, createExecutionPlan } = require("../planning/planner");

function validateRequest(body) {
  const { message, conversationId } = body;
  if (typeof message !== "string" || !message.trim()) return "Message cannot be empty.";
  if (message.length > maxMessageLength) return `Message cannot exceed ${maxMessageLength} characters.`;
  if (conversationId !== undefined && conversationId !== null && typeof conversationId !== "string") return "conversationId must be a string.";
  return null;
}

function getConversation(message, conversationId) {
  let conversation = conversationId ? conversationService.getConversationById(conversationId) : null;
  if (!conversation) conversation = conversationService.createConversation({ firstMessage: message });
  return conversation;
}

function sendEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function prepareTurn(conversation, message) {
  const context = getContext(conversation.messages);
  const taskContext = taskContextManager.loadTaskContext(conversation.id);
  const reasoning = analyzeRequest(message, context, taskContext);
  // Check memory on every turn; retrieval remains relevance-filtered.
  const memory = memoryManager.retrieveRelevantMemory(`${message} ${taskContext.currentGoal || ""}`);
  const executionPlan = createExecutionPlan(message, reasoning, taskContext, memory);
  const plan = taskContext.currentPlan?.length ? taskContext.currentPlan : createPlan(message, taskContext);
  return { context, taskContext, reasoning, plan, executionPlan, memory };
}

function updateTurn(conversationId, message, response, turn, toolsUsed, toolOutputs = []) {
  const extracted = memoryManager.extractMemory(message);
  memoryManager.saveMemory(extracted);
  const taskContext = taskContextManager.updateFromTurn(conversationId, message, response, turn.plan);
  conversationService.updateMetadata(conversationId, {
    reasoning: turn.reasoning,
    taskContext,
    lastMemoryIds: extracted.map((memory) => memory.id),
    retrievedMemoryIds: turn.memory.map((memory) => memory.id),
    lastToolsUsed: toolsUsed,
    lastToolOutputs: toolOutputs,
  });
  return { taskContext, memoriesSaved: extracted.length };
}

function applyVerifiedMemory(message, response, memories) {
  const storedName = memories.find((memory) => memory.key === "name")?.value;
  if (storedName && /\b(what is my name|what's my name|who am i)\b/i.test(message)) {
    return `Your name is ${storedName}.`;
  }
  return response;
}

async function sendMessage(req, res) {
  try {
    const { message, conversationId } = req.body;

    const validationError = validateRequest(req.body);
    if (validationError) return res.status(validationError.includes("exceed") ? 413 : 400).json({ error: validationError });

    // Resolve or create the conversation
    const conversation = getConversation(message, conversationId);

    // History before adding the new user message keeps the current turn separate.
    const history = conversation.messages;
    const turn = prepareTurn(conversation, message);

    // Save the user's message
    conversationService.addMessage(conversation.id, "user", message);

    // Claude decides whether to call any registered tools.
    const agentResult = await runAgent(message, turn.context, undefined, { ...turn, executionPlan: turn.executionPlan });
    const replyText = applyVerifiedMemory(message, agentResult.response, turn.memory);

    // Save the assistant's reply
    const updated = conversationService.addMessage(conversation.id, "assistant", replyText, { reasoning: turn.reasoning, plan: agentResult.plan, verification: agentResult.verification, critique: agentResult.critique, evaluation: agentResult.evaluation, executionId: agentResult.executionId, failures: agentResult.failures, toolsUsed: agentResult.toolsUsed, toolOutputs: agentResult.toolOutputs });
    updateTurn(conversation.id, message, replyText, turn, agentResult.toolsUsed, agentResult.toolOutputs);

    return res.json({
      conversationId: conversation.id,
      title: updated.title,
      reply: {
        role: "assistant",
        content: replyText,
        timestamp: new Date().toISOString(),
      },
      toolsUsed: agentResult.toolsUsed,
      executionId: agentResult.executionId,
      plan: agentResult.plan,
      verification: agentResult.verification,
      evaluation: agentResult.evaluation,
    });
  } catch (err) {
    console.error("[chat.controller] sendMessage error:", err.message);
    return res.status(500).json({ error: err.message || "Something went wrong." });
  }
}

async function streamMessage(req, res) {
  const { message, conversationId } = req.body;
  const validationError = validateRequest(req.body);
  if (validationError) return res.status(validationError.includes("exceed") ? 413 : 400).json({ error: validationError });

  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();

  try {
    const conversation = getConversation(message, conversationId);
    const history = conversation.messages;
    const turn = prepareTurn(conversation, message);
    conversationService.addMessage(conversation.id, "user", message);
    sendEvent(res, "thinking", { message: "Analyzing your request..." });
    sendEvent(res, "stage", { stage: "loading_context", message: "Loading conversation context..." });
    sendEvent(res, "stage", { stage: "reasoning", message: "Reasoning about your request...", reasoning: turn.reasoning });
    sendEvent(res, "stage", { stage: "planning", message: "Creating an adaptive execution plan...", plan: turn.executionPlan });
    if (turn.memory.length) sendEvent(res, "stage", { stage: "retrieving_memory", message: "Retrieving relevant memory..." });

    const agentResult = await runAgent(message, turn.context, async (update) => {
      if (update.lifecycle) sendEvent(res, "stage", update.lifecycle);
      if (update.toolExecution) sendEvent(res, "stage", { stage: "tool_finished", status: "completed" });
      if (update.agentProgress) sendEvent(res, "agent_progress", update.agentProgress);
      const toolsSelected = update.reasoning?.toolsUsed || [];
      for (const name of toolsSelected) sendEvent(res, "tool_selected", { name });
    }, { ...turn, executionPlan: turn.executionPlan });
    const replyText = applyVerifiedMemory(message, agentResult.response, turn.memory);
    const updated = conversationService.addMessage(conversation.id, "assistant", replyText, { reasoning: turn.reasoning, plan: agentResult.plan, verification: agentResult.verification, critique: agentResult.critique, evaluation: agentResult.evaluation, executionId: agentResult.executionId, failures: agentResult.failures, toolsUsed: agentResult.toolsUsed, toolOutputs: agentResult.toolOutputs });
    sendEvent(res, "stage", { stage: "updating_memory", message: "Updating memory..." });
    const update = updateTurn(conversation.id, message, replyText, turn, agentResult.toolsUsed, agentResult.toolOutputs);
    sendEvent(res, "stage", { stage: "completed", memoriesSaved: update.memoriesSaved });
    sendEvent(res, "evaluation", agentResult.evaluation);
    sendEvent(res, "complete", {
      conversationId: conversation.id,
      title: updated.title,
      toolsUsed: agentResult.toolsUsed,
      executionId: agentResult.executionId,
      plan: agentResult.plan,
      verification: agentResult.verification,
      evaluation: agentResult.evaluation,
      reply: { role: "assistant", content: replyText, timestamp: new Date().toISOString() },
    });
  } catch (err) {
    console.error("[chat.controller] streamMessage error:", err.message);
    sendEvent(res, "error", { error: err.message || "Something went wrong." });
  } finally {
    res.end();
  }
}

module.exports = { sendMessage, streamMessage };
