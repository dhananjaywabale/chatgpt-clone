/**
 * conversation.service.js
 * ------------------------
 * Handles all persistence logic for conversations.
 * Conversations are stored as a single JSON array in
 * backend/conversations/conversations.json
 *
 * This is the ONLY place in the app that touches the file system
 * for conversation data, which keeps the rest of the codebase clean.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_FILE = path.join(__dirname, "..", "conversations", "conversations.json");

/**
 * Ensure the storage file exists and contains valid JSON.
 * If the file is missing or corrupted, it is (re)initialized as an empty array
 * so the app never crashes on startup because of a bad/missing file.
 */
function ensureStorageFile() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, "[]", "utf-8");
      return;
    }
    const raw = fs.readFileSync(DATA_FILE, "utf-8").trim();
    if (!raw) {
      fs.writeFileSync(DATA_FILE, "[]", "utf-8");
      return;
    }
    JSON.parse(raw); // throws if corrupted
  } catch (err) {
    console.error("[conversation.service] Corrupted conversations.json, resetting file:", err.message);
    fs.writeFileSync(DATA_FILE, "[]", "utf-8");
  }
}

/** Read all conversations from disk. */
function readAll() {
  ensureStorageFile();
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("[conversation.service] Failed to parse conversations.json:", err.message);
    return [];
  }
}

/** Persist the full conversations array back to disk. */
function writeAll(conversations) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(conversations, null, 2), "utf-8");
}

/** Return all conversations, newest first (by updatedAt). */
function getAllConversations() {
  const conversations = readAll();
  return [...conversations].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );
}

/** Return a single conversation by id, or null if not found. */
function getConversationById(id) {
  const conversations = readAll();
  return conversations.find((c) => c.id === id) || null;
}

/** Derive a short, human-friendly title from the first user message. */
function deriveTitle(firstMessage) {
  if (!firstMessage) return "New Conversation";
  const cleaned = firstMessage.trim().replace(/\s+/g, " ");
  return cleaned.length > 50 ? cleaned.slice(0, 50) + "..." : cleaned;
}

/**
 * Create a new conversation.
 * If `firstMessage` is provided, the title is auto-derived from it.
 */
function createConversation({ title, firstMessage } = {}) {
  const conversations = readAll();
  const now = new Date().toISOString();

  const conversation = {
    id: crypto.randomUUID(),
    title: title || deriveTitle(firstMessage),
    createdAt: now,
    updatedAt: now,
    messages: [],
  };

  conversations.push(conversation);
  writeAll(conversations);
  return conversation;
}

/** Append a message to a conversation and bump updatedAt. Auto-titles on first message. */
function addMessage(conversationId, role, content, metadata = {}) {
  const conversations = readAll();
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation) return null;

  conversation.messages.push({
    role,
    content,
    ...(Object.keys(metadata).length ? { metadata } : {}),
    timestamp: new Date().toISOString(),
  });

  // Auto-derive the title from the first user message
  if (conversation.messages.filter((m) => m.role === "user").length === 1 && role === "user") {
    conversation.title = deriveTitle(content);
  }

  conversation.updatedAt = new Date().toISOString();
  writeAll(conversations);
  return conversation;
}

/** Update non-message conversation metadata used by context-aware agents. */
function updateMetadata(conversationId, metadata = {}) {
  const conversations = readAll();
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation) return null;
  conversation.metadata = { ...(conversation.metadata || {}), ...metadata };
  conversation.updatedAt = new Date().toISOString();
  writeAll(conversations);
  return conversation;
}

/** Rename a conversation. Returns the updated conversation or null. */
function renameConversation(id, newTitle) {
  const conversations = readAll();
  const conversation = conversations.find((c) => c.id === id);
  if (!conversation) return null;

  conversation.title = newTitle.trim().slice(0, 100) || conversation.title;
  conversation.updatedAt = new Date().toISOString();
  writeAll(conversations);
  return conversation;
}

/** Delete a conversation by id. Returns true if something was deleted. */
function deleteConversation(id) {
  const conversations = readAll();
  const next = conversations.filter((c) => c.id !== id);
  const deleted = next.length !== conversations.length;
  if (deleted) writeAll(next);
  return deleted;
}

module.exports = {
  getAllConversations,
  getConversationById,
  createConversation,
  addMessage,
  updateMetadata,
  renameConversation,
  deleteConversation,
};
