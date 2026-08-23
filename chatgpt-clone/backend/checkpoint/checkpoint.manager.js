const fs = require("fs");
const path = require("path");
const env = require("../config/env");

const DATA_FILE = path.join(__dirname, "checkpoints.json");

function readAll() {
  try { return fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) : {}; } catch (_) { return {}; }
}

function saveCheckpoint(executionId, stage, state) {
  if (!env.enableCheckpoints) return null;
  const all = readAll();
  all[executionId] = { ...(all[executionId] || {}), [stage]: { ...state, checkpointedAt: new Date().toISOString() } };
  fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), "utf8");
  return all[executionId][stage];
}

function latestCheckpoint(executionId) {
  const checkpoints = readAll()[executionId] || {};
  const stages = Object.keys(checkpoints);
  return stages.length ? checkpoints[stages[stages.length - 1]] : null;
}

module.exports = { saveCheckpoint, latestCheckpoint };
