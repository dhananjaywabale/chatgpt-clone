const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const env = require("../../config/env");

function cleanXml(value = "") {
  return value.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
}

async function searchNewsFallback(query) {
  const endpoint = new URL("https://news.google.com/rss/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("hl", "en-IN");
  endpoint.searchParams.set("gl", "IN");
  endpoint.searchParams.set("ceid", "IN:en");
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(env.toolTimeoutMs) });
  if (!response.ok) throw new Error(`Google News returned HTTP ${response.status}`);
  const xml = await response.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 8);
  if (!items.length) return `No current news headlines found for: ${query}`;
  return items.map(([_, item], index) => {
    const title = cleanXml(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
    const link = cleanXml(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1]);
    const date = cleanXml(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]);
    return `${index + 1}. ${title}\nPublished: ${date}\nURL: ${link}`;
  }).join("\n\n");
}

function isNewsQuery(query) {
  return /\b(news|headlines|happened|today|latest events|current events)\b/i.test(query);
}

function isFreshQuery(query) {
  return /\b(latest|recent|today|current|news|headlines|this week|this month)\b/i.test(query);
}

const googleSearchTool = tool(
  async ({ query }) => {
    try {
      if (!env.googleSearchApiKey || !env.googleSearchEngineId) {
        if (isNewsQuery(query)) return await searchNewsFallback(`${query} when:30d`);
        return "Google Search is not configured. Answer using existing knowledge and say that live search was unavailable if freshness matters.";
      }
      const endpoint = new URL("https://www.googleapis.com/customsearch/v1");
      endpoint.searchParams.set("key", env.googleSearchApiKey);
      endpoint.searchParams.set("cx", env.googleSearchEngineId);
      endpoint.searchParams.set("q", query);
      endpoint.searchParams.set("num", "5");
      if (isFreshQuery(query)) endpoint.searchParams.set("dateRestrict", "d30");
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(env.toolTimeoutMs) });
      if (!response.ok) throw new Error(`Google Search returned HTTP ${response.status}`);
      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) return `No search results found for: ${query}`;
      return items.map((item, index) => `${index + 1}. ${item.title}\n${item.snippet || ""}\nURL: ${item.link}`).join("\n\n");
    } catch (error) {
      if (isNewsQuery(query)) {
        try {
          return await searchNewsFallback(query);
        } catch (fallbackError) {
          return `Live news search failed: ${fallbackError.message}. Answer with available knowledge and disclose that live news was unavailable.`;
        }
      }
      return `Google Search failed: ${error.message}. Answer with available knowledge and disclose that live search was unavailable.`;
    }
  },
  {
    name: "google_search",
    description: "Search the public web for current events, recent releases, version information, documentation, and other facts that may have changed. Use this when fresh information is needed.",
    schema: z.object({ query: z.string().min(2).max(500) }),
  }
);

module.exports = { googleSearchTool };