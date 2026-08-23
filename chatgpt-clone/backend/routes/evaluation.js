const express = require("express");
const conversationService = require("../services/conversation.service");
const { runFailureDemo } = require("../evaluation/demo");

const router = express.Router();

function evaluationRecords() {
  return conversationService.getAllConversations().flatMap((conversation) => conversation.messages
    .filter((message) => message.metadata?.evaluation)
    .map((message) => ({
      conversationId: conversation.id,
      executionId: message.metadata.executionId,
      createdAt: message.timestamp,
      evaluation: message.metadata.evaluation,
      verification: message.metadata.verification,
      critique: message.metadata.critique,
    })));
}

router.get("/", (req, res) => res.json({ records: evaluationRecords() }));
router.get("/demo", async (req, res) => res.json(await runFailureDemo()));

router.post("/reviews", (req, res) => {
  const { conversationId, executionId, scores, notes } = req.body || {};
  if (typeof conversationId !== "string" || !scores || typeof scores !== "object") {
    return res.status(400).json({ error: "conversationId and scores are required." });
  }
  const conversation = conversationService.getConversationById(conversationId);
  if (!conversation) return res.status(404).json({ error: "Conversation not found." });
  const reviews = conversation.metadata?.humanReviews || [];
  reviews.push({ executionId: executionId || null, scores, notes: String(notes || ""), createdAt: new Date().toISOString() });
  conversationService.updateMetadata(conversationId, { humanReviews: reviews });
  return res.status(201).json({ review: reviews[reviews.length - 1] });
});

module.exports = router;
