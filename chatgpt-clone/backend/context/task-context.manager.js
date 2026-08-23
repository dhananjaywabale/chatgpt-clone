const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "task-context.json");

function readAll() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch (err) {
    console.error("[task-context] Unable to read task context:", err.message);
    return {};
  }
}

function writeAll(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8"); }

function emptyContext() {
  return { currentGoal: "", completedSteps: [], pendingSteps: [], currentPlan: [], currentFiles: [], currentDecisions: [] };
}

function loadTaskContext(conversationId) { return { ...emptyContext(), ...(readAll()[conversationId] || {}) }; }

function updateTaskContext(conversationId, changes = {}) {
  const all = readAll();
  const current = loadTaskContext(conversationId);
  const next = {
    ...current,
    ...changes,
    completedSteps: [...new Set([...(current.completedSteps || []), ...(changes.completedSteps || [])])],
    pendingSteps: changes.pendingSteps || current.pendingSteps || [],
    currentFiles: [...new Set([...(current.currentFiles || []), ...(changes.currentFiles || [])])],
    currentDecisions: [...new Set([...(current.currentDecisions || []), ...(changes.currentDecisions || [])])],
    updatedAt: new Date().toISOString(),
  };
  all[conversationId] = next;
  writeAll(all);
  return next;
}

function updateFromTurn(conversationId, userMessage, assistantResponse, plan = []) {
  const current = loadTaskContext(conversationId);
  const isContinuation = /^(continue|next|go on|proceed)/i.test(String(userMessage).trim());
  const completed = assistantResponse.match(/(?:^|\n)\s*(?:完成|done|completed|implemented|step\s*\d+)[^\n]*/gi) || [];
  const files = `${userMessage}\n${assistantResponse}`.match(/[\w./-]+\.(?:js|ts|tsx|jsx|json|css|html|md)\b/g) || [];
  const goal = current.currentGoal || (!isContinuation && plan.length ? userMessage : "");
  const completedSteps = completed.map((step) => step.trim());
  const pendingSteps = (plan.length ? plan : current.currentPlan).filter((step) => !completedSteps.some((done) => done.toLowerCase().includes(step.toLowerCase())));
  return updateTaskContext(conversationId, {
    currentGoal: goal,
    currentPlan: plan.length ? plan : current.currentPlan,
    completedSteps,
    pendingSteps,
    currentFiles: files,
  });
}

module.exports = { loadTaskContext, updateTaskContext, updateFromTurn };
