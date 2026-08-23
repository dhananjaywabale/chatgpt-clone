const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");

// POST /api/chat  -> send a prompt to the Claude agent and get a reply
router.post("/", chatController.sendMessage);
router.post("/stream", chatController.streamMessage);

module.exports = router;
