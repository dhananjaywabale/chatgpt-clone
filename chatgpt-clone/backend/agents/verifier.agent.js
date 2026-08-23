function verifyReports(reports = [], request = "") {
  const usable = reports.filter((report) => report && report.response);
  const allText = usable.map((report) => report.response).join("\n");
  const urls = [...new Set(allText.match(/https?:\/\/[^\s)]+/g) || [])];
  const conflicting = usable.length > 1 && /\b(conflict|however|disagree|uncertain|unable to verify)\b/i.test(allText);
  const confidence = usable.length === 0 ? 0 : Math.max(0.35, Math.min(0.98, 0.55 + usable.length * 0.12 - (conflicting ? 0.2 : 0)));
  return { request, claimsChecked: allText.split(/[.!?]\s+/).filter(Boolean).length, sources: urls, conflicting, confidence, grounded: Boolean(urls.length || usable.length) };
}

module.exports = { verifyReports };
