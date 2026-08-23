const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const net = require("net");
const env = require("../../config/env");

function isPrivateIp(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const version = net.isIP(normalized);
  if (version === 4) {
    const octets = normalized.split(".").map(Number);
    return octets[0] === 0 || octets[0] === 10 || octets[0] === 127 ||
      (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168);
  }
  if (version !== 6) return false;
  const expanded = normalized.includes("::")
    ? (() => {
        const groups = normalized.split("::");
        const left = groups[0] ? groups[0].split(":") : [];
        const right = groups[1] ? groups[1].split(":") : [];
        return [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
      })()
    : normalized.split(":");
  const numericGroups = expanded.map((group) => parseInt(group || "0", 16));
  const isMapped = numericGroups.slice(0, 6).every((group, index) => group === (index === 5 ? 0xffff : 0));
  if (isMapped) {
    const ipv4 = `${numericGroups[6] >> 8}.${numericGroups[6] & 255}.${numericGroups[7] >> 8}.${numericGroups[7] & 255}`;
    return isPrivateIp(ipv4);
  }
  return normalized === "::1" || (numericGroups[0] & 0xfe00) === 0xfc00 ||
    (numericGroups[0] & 0xffc0) === 0xfe80;
}

function assertSafeUrl(value) {
  let url;
  try { url = new URL(value); } catch (_) { throw new Error("Invalid URL."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS URLs are allowed.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local") || isPrivateIp(hostname)) {
    throw new Error("Local and private network URLs are not allowed.");
  }
  return url;
}

const urlReaderTool = tool(
  async ({ url: rawUrl }) => {
    try {
      const url = assertSafeUrl(rawUrl);
      let response;
      let currentUrl = url;
      for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
        response = await fetch(currentUrl, {
          redirect: "manual", signal: AbortSignal.timeout(env.toolTimeoutMs),
          headers: { "User-Agent": "AI-Assistant-URL-Reader/1.0" },
        });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get("location");
        if (!location || redirectCount === 3) throw new Error("Too many or invalid redirects.");
        currentUrl = assertSafeUrl(new URL(location, currentUrl).toString());
      }
      if (!response.ok) throw new Error(`URL reader returned HTTP ${response.status}`);
      const type = response.headers.get("content-type") || "";
      if (!type.includes("text/") && !type.includes("json") && !type.includes("xml")) throw new Error("The URL does not contain readable text content.");
      const readable = (await response.text())
        .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
        .replace(/\s+/g, " ").trim();
      return readable.slice(0, 30000) || "The page contained no readable text.";
    } catch (error) {
      return `Webpage reading failed: ${error.message}. Explain that the page could not be read.`;
    }
  },
  {
    name: "read_webpage",
    description: "Read and extract text from a specific public webpage. Use this when the user supplies a URL or asks to summarize webpage content.",
    schema: z.object({ url: z.string().url().max(2000) }),
  }
);

module.exports = { urlReaderTool, assertSafeUrl, isPrivateIp };