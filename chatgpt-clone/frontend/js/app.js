/**
 * app.js
 * -------
 * Application entry point and central controller.
 * Holds the current app state (active conversation, conversation list)
 * and wires together Api, Sidebar, and Chat.
 */

const App = (() => {
  const CURRENT_CONV_KEY = "currentConversationId";
  const PENDING_MESSAGE_KEY = "pendingMessage";

  const conversationTitleEl = document.getElementById("conversationTitle");
  const newChatBtn = document.getElementById("newChatBtn");
  const renameBtn = document.getElementById("renameBtn");
  const deleteBtn = document.getElementById("deleteBtn");

  let activeConversationId = null;
  let isSending = false;

  async function init() {
    Sidebar.init();
    Chat.init();
    bindTopbarEvents();
    bindResizeHandler();

    await loadConversations();

    const pendingMessage = readPendingMessage();
    if (pendingMessage) {
      const recovered = await recoverPendingConversation(pendingMessage);
      if (recovered) return;
      localStorage.removeItem(PENDING_MESSAGE_KEY);
    }

    const storedId = localStorage.getItem(CURRENT_CONV_KEY);
    if (storedId) {
      const exists = await tryLoadConversation(storedId);
      if (!exists) startNewChatView();
    } else {
      startNewChatView();
    }
  }

  function bindTopbarEvents() {
    newChatBtn.addEventListener("click", startNewChatView);

    renameBtn.addEventListener("click", () => {
      if (!activeConversationId) return;
      const current = conversationTitleEl.textContent;
      renameConversationPrompt(activeConversationId, current);
    });

    deleteBtn.addEventListener("click", () => {
      if (!activeConversationId) return;
      deleteConversationConfirm(activeConversationId);
    });
  }

  // Debounce window resize so we don't thrash layout calculations
  function bindResizeHandler() {
    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const isDesktop = window.matchMedia("(min-width: 769px)").matches;
        if (isDesktop) {
          const stored = localStorage.getItem("sidebarCollapsed");
          Sidebar.setCollapsed(stored === "1");
        }
      }, 150);
    });
  }

  // ----- Conversation loading -----
  async function loadConversations() {
    try {
      const conversations = await Api.getConversations();
      Sidebar.setConversations(conversations);
      return conversations;
    } catch (err) {
      Toast.show(err.message, "error");
      return [];
    }
  }

  async function tryLoadConversation(id) {
    try {
      const conversation = await Api.getConversation(id);
      setActiveConversation(conversation);
      return true;
    } catch (err) {
      return false;
    }
  }

  function setActiveConversation(conversation) {
    activeConversationId = conversation.id;
    localStorage.setItem(CURRENT_CONV_KEY, conversation.id);
    conversationTitleEl.textContent = conversation.title || "New Conversation";
    Chat.renderMessages(conversation.messages);
    Sidebar.renderList(currentSidebarList(), conversation.id);
  }

  function startNewChatView() {
    activeConversationId = null;
    localStorage.removeItem(CURRENT_CONV_KEY);
    conversationTitleEl.textContent = "AI Assistant";
    Chat.renderMessages([]);
    Sidebar.renderList(currentSidebarList(), null);
  }

  let lastKnownConversations = [];
  function currentSidebarList() {
    return lastKnownConversations;
  }

  // ----- Public actions used by Sidebar -----
  async function selectConversation(id) {
    if (id === activeConversationId) return;
    try {
      const conversation = await Api.getConversation(id);
      setActiveConversation(conversation);
    } catch (err) {
      Toast.show("Couldn't load that conversation.", "error");
    }
  }

  function getActiveConversationId() {
    return activeConversationId;
  }

  function readPendingMessage() {
    try {
      return JSON.parse(localStorage.getItem(PENDING_MESSAGE_KEY));
    } catch (_) {
      return null;
    }
  }

  async function recoverPendingConversation(pendingMessage) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const conversations = await loadConversations();
      const latest = conversations[0];
      if (latest && latest.title === deriveTitle(pendingMessage.text)) {
        try {
          const conversation = await Api.getConversation(latest.id);
          const hasReply = conversation.messages.some(
            (message) => message.role === "assistant"
          );
          if (hasReply) {
            localStorage.removeItem(PENDING_MESSAGE_KEY);
            setActiveConversation(conversation);
            return true;
          }
        } catch (_) {
          // The conversation may still be finishing on the backend.
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  }

  function deriveTitle(text) {
    const cleaned = text.trim().replace(/\s+/g, " ");
    return cleaned.length > 50 ? cleaned.slice(0, 50) + "..." : cleaned;
  }

  async function renameConversationPrompt(id, currentTitle) {
    const newTitle = window.prompt("Rename conversation:", currentTitle);
    if (!newTitle || !newTitle.trim() || newTitle.trim() === currentTitle) return;

    try {
      const updated = await Api.renameConversation(id, newTitle.trim());
      if (id === activeConversationId) {
        conversationTitleEl.textContent = updated.title;
      }
      const conversations = await loadConversations();
      lastKnownConversations = conversations;
      Sidebar.renderList(conversations, activeConversationId);
      Toast.show("Conversation renamed.", "success");
    } catch (err) {
      Toast.show(err.message, "error");
    }
  }

  async function deleteConversationConfirm(id) {
    const confirmed = window.confirm("Delete this conversation? This can't be undone.");
    if (!confirmed) return;

    try {
      await Api.deleteConversation(id);
      Toast.show("Conversation deleted.", "success");

      const conversations = await loadConversations();
      lastKnownConversations = conversations;

      if (id === activeConversationId) {
        startNewChatView();
      } else {
        Sidebar.renderList(conversations, activeConversationId);
      }
    } catch (err) {
      Toast.show(err.message, "error");
    }
  }

  // ----- Sending messages -----
  async function sendMessage(text) {
    if (isSending) return;
    isSending = true;
    localStorage.setItem(
      PENDING_MESSAGE_KEY,
      JSON.stringify({ text, startedAt: Date.now() })
    );
    Chat.setInputDisabled(true);

    // Optimistically render the user's message
    const optimisticMessage = Chat.appendMessage({
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    });
    Chat.showTyping();

    try {
      let data;
      await Api.sendMessageStream(text, activeConversationId, (eventName, eventData) => {
        if (eventName === "thinking") Chat.updateTypingStatus(eventData.message);
        if (eventName === "stage") Chat.updateTypingStatus(eventData.message || `${eventData.stage}...`);
        if (eventName === "tool_selected") {
          const labels = { google_search: "Google Search", read_webpage: "Webpage Reader" };
          Chat.updateTypingStatus(`Using ${labels[eventData.name] || eventData.name}...`);
        }
        if (eventName === "agent_progress") Chat.updateTypingStatus(eventData.message);
        if (eventName === "complete") data = eventData;
        if (eventName === "error") throw new Error(eventData.error);
      });
      if (!data) throw new Error("The server closed the chat stream without a response.");

      Chat.hideTyping();
      Chat.appendMessage(data.reply);
      localStorage.removeItem(PENDING_MESSAGE_KEY);

      const isNewConversation = activeConversationId !== data.conversationId;
      activeConversationId = data.conversationId;
      localStorage.setItem(CURRENT_CONV_KEY, activeConversationId);
      conversationTitleEl.textContent = data.title;

      const conversations = await loadConversations();
      lastKnownConversations = conversations;
      Sidebar.renderList(conversations, activeConversationId);

      if (isNewConversation) {
        // no-op placeholder: title/list already refreshed above
      }
    } catch (err) {
      Chat.hideTyping();
      Chat.removeMessage(optimisticMessage);
      localStorage.removeItem(PENDING_MESSAGE_KEY);
      Toast.show(err.message || "Failed to send message.", "error");
    } finally {
      isSending = false;
      Chat.setInputDisabled(false);
    }
  }

  // Keep lastKnownConversations in sync whenever Sidebar gets a fresh list
  const originalSetConversations = Sidebar.setConversations;
  Sidebar.setConversations = function (conversations) {
    lastKnownConversations = conversations;
    originalSetConversations(conversations);
  };

  return {
    init,
    selectConversation,
    getActiveConversationId,
    renameConversationPrompt,
    deleteConversationConfirm,
    sendMessage,
  };
})();

document.addEventListener("DOMContentLoaded", App.init);
