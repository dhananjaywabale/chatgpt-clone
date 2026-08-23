/**
 * server.js
 * ----------
 * Entry point for the Express backend.
 * Serves the JSON API under /api and (optionally) the static frontend.
 */

require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");

const chatRoutes = require("./routes/chat");
const conversationsRoutes = require("./routes/conversations");
const evaluationRoutes = require("./routes/evaluation");
const { rateLimit } = require("./middleware/rate-limit");

const app = express();
const PORT = process.env.PORT || 5000;

// ----- Middleware -----
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/api/chat", rateLimit);

// ----- API routes -----
app.use("/api/chat", chatRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/evaluation", evaluationRoutes);

// Simple health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ----- Serve the static frontend -----
// This lets you run just the backend and open http://localhost:5000
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND_DIR));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// ----- Fallback error handler -----
app.use((err, req, res, next) => {
  console.error("[server] Unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("⚠️  ANTHROPIC_API_KEY is not set — chat requests will fail until you add it to backend/.env");
  }
});
