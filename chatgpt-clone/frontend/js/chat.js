/**
 * chat.js
 * --------
 * Handles everything inside the main chat panel: rendering messages,
 * the typing indicator, the welcome screen, prompt cards, and the
 * message input bar (auto-resize, Enter/Shift+Enter, send button state).
 *
 * Sending is delegated to App.sendMessage(text), defined in app.js.
 */

const Chat = (() => {
  const welcomeScreen = document.getElementById("welcomeScreen");
  const chatArea = document.getElementById("chatArea");
  const messagesEl = document.getElementById("messages");
  const promptCards = document.getElementById("promptCards");

  const inputForm = document.getElementById("inputForm");
  const messageInput = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");

  const DRAFT_KEY = "draftMessage";
  let typingEl = null;

  function init() {
    bindInputEvents();
    bindPromptCards();
    restoreDraft();
  }

  // ----- Input bar -----
  function bindInputEvents() {
    messageInput.addEventListener("input", () => {
      autoExpand();
      saveDraft();
      updateSendState();
    });

    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        inputForm.requestSubmit();
      }
    });

    inputForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = messageInput.value.trim();
      if (!text) return;
      clearDraft();
      messageInput.value = "";
      autoExpand();
      updateSendState();
      App.sendMessage(text);
    });

    updateSendState();
  }

  function bindPromptCards() {
    promptCards.querySelectorAll(".prompt-card").forEach((card) => {
      card.addEventListener("click", () => {
        const prompt = card.dataset.prompt;
        clearDraft();
        App.sendMessage(prompt);
      });
    });
  }

  function autoExpand() {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + "px";
  }

  function updateSendState() {
    sendBtn.disabled = !messageInput.value.trim();
  }

  function setInputDisabled(disabled) {
    messageInput.disabled = disabled;
    sendBtn.disabled = disabled || !messageInput.value.trim();
    sendBtn.classList.toggle("loading", disabled);
  }

  // ----- Draft persistence -----
  function saveDraft() {
    localStorage.setItem(DRAFT_KEY, messageInput.value);
  }
  function restoreDraft() {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      messageInput.value = draft;
      autoExpand();
      updateSendState();
    }
  }
  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  // ----- Screen state -----
  function showWelcome() {
    welcomeScreen.style.display = "flex";
    chatArea.style.display = "none";
  }

  function showChat() {
    welcomeScreen.style.display = "none";
    chatArea.style.display = "block";
  }

  // ----- Message rendering -----
  function renderMessages(messages) {
    messagesEl.innerHTML = "";
    if (!messages || !messages.length) {
      showWelcome();
      return;
    }
    showChat();
    messages.forEach((m) => appendMessage(m, { animate: false }));
    scrollToBottom();
  }

  function appendMessage(message, { animate = true } = {}) {
    showChat();

    const wrapper = document.createElement("div");
    wrapper.className = `message ${message.role}`;
    if (!animate) wrapper.style.animation = "none";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = message.role === "user" ? "🧑" : "🤖";

    const body = document.createElement("div");
    body.className = "message-body";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    if (message.role === "assistant") {
      bubble.innerHTML = MarkdownRenderer.render(message.content);
    } else {
      bubble.textContent = message.content;
    }

    const time = document.createElement("div");
    time.className = "message-time";
    time.textContent = formatTimestamp(message.timestamp);

    body.appendChild(bubble);
    body.appendChild(time);
    wrapper.appendChild(avatar);
    wrapper.appendChild(body);
    messagesEl.appendChild(wrapper);

    scrollToBottom();
    return wrapper;
  }

  function removeMessage(messageEl) {
    messageEl?.remove();
  }

  function showTyping() {
    hideTyping();
    showChat();
    typingEl = document.createElement("div");
    typingEl.className = "message assistant";
    typingEl.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-body">
        <div class="message-bubble">
          <div class="typing-indicator">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            <span class="typing-label">Analyzing...</span>
          </div>
        </div>
      </div>
    `;
    messagesEl.appendChild(typingEl);
    scrollToBottom();
  }

  function updateTypingStatus(label) {
    const labelEl = typingEl?.querySelector(".typing-label");
    if (labelEl) labelEl.textContent = label;
  }

  function hideTyping() {
    if (typingEl) {
      typingEl.remove();
      typingEl = null;
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatArea.scrollTop = chatArea.scrollHeight;
    });
  }

  function formatTimestamp(isoString) {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return {
    init,
    renderMessages,
    appendMessage,
    removeMessage,
    showTyping,
    hideTyping,
    showWelcome,
    showChat,
    updateTypingStatus,
    setInputDisabled,
  };
})();
