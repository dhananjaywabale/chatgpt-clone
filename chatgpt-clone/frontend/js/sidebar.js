/**
 * sidebar.js
 * -----------
 * Renders the conversation list and handles sidebar-only interactions
 * (collapse, search filter, dark mode toggle). Actions that affect
 * app-wide state (select/rename/delete a conversation) are delegated
 * back to App, which is defined in app.js and loaded after this file.
 */

const Sidebar = (() => {
  const appEl = document.getElementById("app");
  const listEl = document.getElementById("conversationList");
  const searchInput = document.getElementById("searchConversations");
  const collapseBtn = document.getElementById("collapseBtn");
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const overlay = document.getElementById("sidebarOverlay");
  const darkModeToggle = document.getElementById("darkModeToggle");

  let allConversations = [];

  function init() {
    restoreCollapsedState();
    restoreThemeState();
    bindEvents();
  }

  function bindEvents() {
    collapseBtn.addEventListener("click", toggleCollapsed);
    hamburgerBtn.addEventListener("click", toggleCollapsed);
    overlay.addEventListener("click", () => setCollapsed(true));

    searchInput.addEventListener("input", () => {
      renderList(filterConversations(searchInput.value));
    });

    darkModeToggle.addEventListener("click", toggleTheme);
  }

  // ----- Collapse / mobile overlay -----
  function toggleCollapsed() {
    setCollapsed(!appEl.classList.contains("sidebar-collapsed"));
  }

  function setCollapsed(collapsed) {
    appEl.classList.toggle("sidebar-collapsed", collapsed);
    localStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0");
  }

  function restoreCollapsedState() {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const stored = localStorage.getItem("sidebarCollapsed");
    // On mobile, always start collapsed regardless of stored desktop preference
    const collapsed = isMobile ? true : stored === "1";
    appEl.classList.toggle("sidebar-collapsed", collapsed);
  }

  // ----- Theme -----
  function toggleTheme() {
    const isLight = document.body.classList.toggle("light-theme");
    localStorage.setItem("darkMode", isLight ? "off" : "on");
  }

  function restoreThemeState() {
    const mode = localStorage.getItem("darkMode");
    if (mode === "off") document.body.classList.add("light-theme");
  }

  // ----- Rendering -----
  function setConversations(conversations) {
    allConversations = conversations;
    renderList(conversations);
  }

  function filterConversations(query) {
    const q = query.trim().toLowerCase();
    if (!q) return allConversations;
    return allConversations.filter((c) => c.title.toLowerCase().includes(q));
  }

  function renderList(conversations, activeId) {
    const currentActive = activeId ?? App.getActiveConversationId();
    listEl.innerHTML = "";

    if (!conversations.length) {
      listEl.innerHTML = `<div class="conversation-list-empty">No conversations yet.<br>Start a new chat!</div>`;
      return;
    }

    conversations.forEach((c, i) => {
      const item = document.createElement("div");
      item.className = "conversation-item" + (c.id === currentActive ? " active" : "");
      item.style.animationDelay = `${Math.min(i, 10) * 0.03}s`;
      item.dataset.id = c.id;

      item.innerHTML = `
        <span class="conversation-item-icon" aria-hidden="true">💬</span>
        <div class="conversation-item-body">
          <div class="conversation-item-title"></div>
          <div class="conversation-item-time">${formatTime(c.updatedAt)}</div>
        </div>
        <div class="conversation-item-actions">
          <button class="rename-icon" title="Rename" aria-label="Rename conversation">✏️</button>
          <button class="delete-icon" title="Delete" aria-label="Delete conversation">🗑️</button>
        </div>
      `;
      item.querySelector(".conversation-item-title").textContent = c.title;

      item.addEventListener("click", (e) => {
        if (e.target.closest(".conversation-item-actions")) return;
        App.selectConversation(c.id);
        if (window.matchMedia("(max-width: 768px)").matches) setCollapsed(true);
      });

      item.querySelector(".rename-icon").addEventListener("click", (e) => {
        e.stopPropagation();
        App.renameConversationPrompt(c.id, c.title);
      });

      item.querySelector(".delete-icon").addEventListener("click", (e) => {
        e.stopPropagation();
        App.deleteConversationConfirm(c.id);
      });

      listEl.appendChild(item);
    });
  }

  function formatTime(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    const isThisYear = date.getFullYear() === now.getFullYear();
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: isThisYear ? undefined : "numeric",
    });
  }

  return { init, setConversations, renderList, setCollapsed };
})();
