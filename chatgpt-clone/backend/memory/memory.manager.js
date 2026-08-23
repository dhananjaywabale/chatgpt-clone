const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const env = require("../config/env");

const DATA_FILE = path.join(__dirname, "long-term-memory.json");

function readAll() {
  if (!env.longTermMemoryEnabled) return [];
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return Array.isArray(data) ? data.map((memory) => {
      if (memory.key !== "name") return memory;
      const value = String(memory.value || "").split(/\s+and\s+i\b/i)[0].trim();
      return value === memory.value ? memory : { ...memory, value };
    }) : [];
  } catch (err) {
    console.error("[memory.manager] Unable to read memory:", err.message);
    return [];
  }
}

function writeAll(memories) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(memories, null, 2), "utf8");
}

function isSensitive(text) {
  return /(api[_ -]?key|token|password|secret|passphrase|private key|authorization|bearer)/i.test(text);
}

function extractMemory(message) {
  if (!env.longTermMemoryEnabled || typeof message !== "string" || isSensitive(message)) return [];
  const patterns = [
    [/\bmy name is ([^.!?\n]+?)(?:\s+and\b|$)/i, "fact", "name"],
    [/\bi work as (?:a |an )?([^.!?\n]+)/i, "fact", "occupation"],
    [/\bmy company uses ([^.!?\n]+)/i, "fact", "company_stack"],
    [/\bi (?:prefer|always use|usually use|like) ([^.!?\n]+)/i, "preference", "preferred_technology"],
    [/\bmy preferred language is ([^.!?\n]+)/i, "preference", "preferred_language"],
    [/\bmy goal is to ([^.!?\n]+)/i, "goal", "goal"],
  ];
  return patterns.flatMap(([pattern, type, key]) => {
    const match = message.match(pattern);
    if (!match || isSensitive(match[1])) return [];
    return [{ id: crypto.randomUUID(), type, key, value: match[1].trim(), source: "conversation", updatedAt: new Date().toISOString() }];
  });
}

function saveMemory(memories) {
  if (!env.longTermMemoryEnabled || !Array.isArray(memories) || !memories.length) return readAll();
  const current = readAll();
  for (const memory of memories) {
    const existingIndex = current.findIndex((item) => item.key === memory.key);
    if (existingIndex >= 0) current[existingIndex] = { ...current[existingIndex], ...memory, updatedAt: new Date().toISOString() };
    else current.push(memory);
  }
  writeAll(current);
  return current;
}

function retrieveRelevantMemory(query, limit = env.maxMemoryResults) {
  const terms = new Set(String(query || "").toLowerCase().match(/[a-z0-9]{3,}/g) || []);
  return readAll()
    .map((memory) => ({ memory, score: [...new Set(`${memory.key} ${memory.value}`.toLowerCase().match(/[a-z0-9]{3,}/g) || [])].filter((term) => terms.has(term)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ memory }) => memory);
}

function deleteMemory(idOrKey) {
  const current = readAll();
  const next = current.filter((memory) => memory.id !== idOrKey && memory.key !== idOrKey);
  if (next.length !== current.length) writeAll(next);
  return next;
}

module.exports = { extractMemory, saveMemory, retrieveRelevantMemory, deleteMemory };
