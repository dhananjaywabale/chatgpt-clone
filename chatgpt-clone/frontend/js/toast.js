/**
 * toast.js
 * ---------
 * Small, dependency-free toast notification system.
 * Usage: Toast.show("Something happened", "error" | "success" | "info")
 */

const Toast = (() => {
  const container = document.getElementById("toastContainer");

  function show(message, type = "info", duration = 3500) {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.setAttribute("role", "status");

    const icon = type === "error" ? "⚠️" : type === "success" ? "✅" : "ℹ️";
    toast.innerHTML = `<span aria-hidden="true">${icon}</span><span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("removing");
      toast.addEventListener("animationend", () => toast.remove(), { once: true });
    }, duration);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  return { show };
})();
