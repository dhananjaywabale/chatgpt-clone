/**
 * api.js
 * -------
 * Centralized fetch wrapper for talking to the Express backend.
 * Keeping all network calls in one place makes error handling
 * consistent and the rest of the app easier to read.
 */

const Api = (() => {
  // Set API_BASE_URL before loading this script when using a separate frontend server.
  const BASE_URL = window.API_BASE_URL ||
    (window.location.port === "5500" ? "http://127.0.0.1:5000/api" : "/api");

  /**
   * Internal helper: perform a fetch call, throw a friendly Error on failure.
   */
  async function request(path, options = {}) {
    let response;
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
    } catch (networkErr) {
      // fetch() itself threw -> server offline / no network
      throw new Error("Can't reach the server. Is the backend running?");
    }

    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const data = await response.json();
        if (data?.error) message = data.error;
      } catch (_) {
        /* response body wasn't JSON; keep default message */
      }
      throw new Error(message);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  return {
    // ----- Conversations -----
    getConversations: () => request("/conversations"),
    getConversation: (id) => request(`/conversations/${id}`),
    createConversation: (title) =>
      request("/conversations", {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    renameConversation: (id, title) =>
      request(`/conversations/${id}`, {
        method: "PUT",
        body: JSON.stringify({ title }),
      }),
    deleteConversation: (id) =>
      request(`/conversations/${id}`, { method: "DELETE" }),

    // ----- Chat -----
    sendMessage: (message, conversationId) =>
      request("/chat", {
        method: "POST",
        body: JSON.stringify({ message, conversationId }),
      }),

    sendMessageStream: async (message, conversationId, onEvent) => {
      const response = await fetch(`${BASE_URL}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ message, conversationId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const events = buffer.split("\n\n");
        buffer = events.pop();
        events.forEach((chunk) => {
          const eventName = chunk.match(/^event: (.+)$/m)?.[1];
          const dataLine = chunk.match(/^data: (.+)$/m)?.[1];
          if (eventName && dataLine) onEvent(eventName, JSON.parse(dataLine));
        });
        if (done) break;
      }
    },
  };
})();
