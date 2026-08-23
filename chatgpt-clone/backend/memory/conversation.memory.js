const env = require("../config/env");

function normalizeMessage(message) {
  if (!message || !message.role) return null;
  return {
    role: message.role,
    content: typeof message.content === "string" ? message.content : JSON.stringify(message.content),
    ...(message.timestamp ? { timestamp: message.timestamp } : {}),
    ...(message.metadata ? { metadata: message.metadata } : {}),
  };
}

function loadConversation(conversation) {
  return Array.isArray(conversation?.messages) ? conversation.messages.map(normalizeMessage).filter(Boolean) : [];
}

function appendMessage(messages, role, content, metadata = {}) {
  const next = Array.isArray(messages) ? [...messages] : [];
  next.push({ role, content: String(content ?? ""), timestamp: new Date().toISOString(), metadata });
  return next;
}

function trimConversation(messages, limit = env.shortTermHistory) {
  const normalized = (Array.isArray(messages) ? messages : []).map(normalizeMessage).filter(Boolean);
  if (!limit || normalized.length === 0) return normalized;
  const userIndexes = normalized.reduce((indexes, message, index) => {
    if (message.role === "user") indexes.push(index);
    return indexes;
  }, []);
  if (userIndexes.length <= limit) return normalized;
  return normalized.slice(userIndexes[userIndexes.length - limit]);
}

function getContext(conversationOrMessages, limit = env.shortTermHistory) {
  const messages = Array.isArray(conversationOrMessages)
    ? conversationOrMessages
    : loadConversation(conversationOrMessages);
  const trimmed = trimConversation(messages, limit);
  return trimmed.filter((message, index) => index === 0 || message.role !== trimmed[index - 1].role || message.content !== trimmed[index - 1].content);
}

module.exports = { loadConversation, appendMessage, trimConversation, getContext };
