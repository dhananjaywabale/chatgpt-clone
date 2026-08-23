const express = require("express");
const router = express.Router();
const conversationsController = require("../controllers/conversations.controller");

// GET    /api/conversations       -> list all conversations
// GET    /api/conversations/:id   -> get one conversation (full history)
// POST   /api/conversations       -> create a new (empty) conversation
// PUT    /api/conversations/:id   -> rename a conversation
// DELETE /api/conversations/:id   -> delete a conversation

router.get("/", conversationsController.listConversations);
router.get("/:id", conversationsController.getConversation);
router.post("/", conversationsController.createConversation);
router.put("/:id", conversationsController.renameConversation);
router.delete("/:id", conversationsController.deleteConversation);

module.exports = router;
