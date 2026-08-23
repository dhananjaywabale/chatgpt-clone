/**
 * markdown.js
 * ------------
 * Renders AI message content as formatted HTML using marked.js,
 * applies syntax highlighting with highlight.js, and wraps code
 * blocks with a header (language label + copy button).
 */

const MarkdownRenderer = (() => {
  let configured = false;

  function configure() {
    if (configured || typeof marked === "undefined") return;
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
    configured = true;
  }

  /**
   * Convert raw markdown text into safe-ish HTML with enhanced code blocks.
   */
  function render(markdownText) {
    configure();

    if (typeof marked === "undefined") {
      // Fallback: plain text with line breaks if the CDN script hasn't loaded yet
      return escapeHtml(markdownText).replace(/\n/g, "<br>");
    }

    const rawHtml = marked.parse(markdownText || "");

    // Post-process to wrap <pre><code> blocks with a header + copy button
    const container = document.createElement("div");
    container.innerHTML = rawHtml;

    container.querySelectorAll("pre code").forEach((codeEl) => {
      const pre = codeEl.parentElement;
      const langMatch = [...codeEl.classList].find((c) => c.startsWith("language-"));
      const lang = langMatch ? langMatch.replace("language-", "") : "text";

      const wrapper = document.createElement("div");
      wrapper.className = "code-block";

      const header = document.createElement("div");
      header.className = "code-block-header";
      header.innerHTML = `<span>${escapeHtml(lang)}</span><button class="copy-btn" type="button">Copy</button>`;

      pre.replaceWith(wrapper);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);

      const copyBtn = header.querySelector(".copy-btn");
      copyBtn.addEventListener("click", () => {
        navigator.clipboard
          .writeText(codeEl.textContent)
          .then(() => {
            copyBtn.textContent = "Copied!";
            setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
          })
          .catch(() => Toast.show("Couldn't copy to clipboard.", "error"));
      });
    });

    // Syntax highlighting
    if (typeof hljs !== "undefined") {
      container.querySelectorAll("pre code").forEach((el) => hljs.highlightElement(el));
    }

    return container.innerHTML;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  return { render };
})();
