function critiqueAnswer(response = "", verification = {}, threshold = 0.65) {
  const issues = [];
  if (!response.trim()) issues.push("empty response");
  if (verification.conflicting && !/uncertain|conflict|disagree/i.test(response)) issues.push("conflicting evidence was not disclosed");
  if (verification.sources.length && !/source|http/i.test(response)) issues.push("evidence is not surfaced");
  const score = Math.max(0, Math.min(1, 0.9 - issues.length * 0.2 - (verification.confidence < threshold ? 0.15 : 0)));
  return { score, passed: score >= threshold, issues, confidence: verification.confidence };
}

module.exports = { critiqueAnswer };
