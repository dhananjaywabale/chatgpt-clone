/**
 * conversations.controller.js
 * -----------------------------
 * CRUD endpoints for conversations (list, get, create, rename, delete).
 */

const conversationService = require("../services/conversation.service");

function listConversations(req, res) {
  try {
    const conversations = conversationService.getAllConversations();
    // Return lightweight summaries for the sidebar (no need to ship all messages)
    const summaries = conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
    }));
    res.json(summaries);
  } catch (err) {
    console.error("[conversations.controller] listConversations error:", err.message);
    res.status(500).json({ error: "Failed to load conversations." });
  }
}

function getConversation(req, res) {
  try {
    const conversation = conversationService.getConversationById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    res.json(conversation);
  } catch (err) {
    console.error("[conversations.controller] getConversation error:", err.message);
    res.status(500).json({ error: "Failed to load conversation." });
  }
}

function createConversation(req, res) {
  try {
    const { title } = req.body;
    const conversation = conversationService.createConversation({ title });
    res.status(201).json(conversation);
  } catch (err) {
    console.error("[conversations.controller] createConversation error:", err.message);
    res.status(500).json({ error: "Failed to create conversation." });
  }
}

function renameConversation(req, res) {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title cannot be empty." });
    }
    const updated = conversationService.renameConversation(req.params.id, title);
    if (!updated) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    res.json(updated);
  } catch (err) {
    console.error("[conversations.controller] renameConversation error:", err.message);
    res.status(500).json({ error: "Failed to rename conversation." });
  }
}

function deleteConversation(req, res) {
  try {
    const deleted = conversationService.deleteConversation(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    res.status(204).send();
  } catch (err) {
    console.error("[conversations.controller] deleteConversation error:", err.message);
    res.status(500).json({ error: "Failed to delete conversation." });
  }
}

module.exports = {
  listConversations,
  getConversation,
  createConversation,
  renameConversation,
  deleteConversation,
};
