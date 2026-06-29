(() => {
  const HOST_ID = "explain-this-extension-root";
  const CONTENT_SELECTOR = "h1, h2, h3, h4, p, li, pre, code, blockquote, table";
  const MAIN_SELECTOR = "article, main, [role='main']";
  const JUNK_SELECTOR = "nav, footer, aside, script, style, button, input, textarea, form, menu, [role='navigation'], [role='dialog'], [aria-modal='true']";
  const INSUFFICIENT = "I need more context to explain this accurately.";
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none";
  document.documentElement.append(host);

  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = styles();
  const surface = document.createElement("div");
  surface.className = "surface";
  shadow.append(style, surface);

  let selected = null;
  let requestVersion = 0;

  document.addEventListener("mouseup", (event) => {
    if (event.composedPath().includes(host)) return;
    setTimeout(captureSelection, 0);
  }, true);
  document.addEventListener("pointerdown", (event) => {
    if (event.composedPath().includes(host)) return;
    if (selected) close();
  }, true);
  document.addEventListener("keyup", (event) => {
    if (event.composedPath().includes(host)) return;
    if (event.key === "Escape") return close();
    setTimeout(captureSelection, 0);
  }, true);
  window.addEventListener("scroll", close, true);
  window.addEventListener("resize", close);

  function captureSelection() {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim().slice(0, 4_000) || "";
    if (!selection?.rangeCount || !selectedText) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    selected = {
      ...extractQuickContext(range, selectedText),
      rect: { left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width },
    };
    requestVersion += 1;
    renderPill();
  }

  function extractQuickContext(range, selectedText) {
    const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement;
    const container = startElement?.closest?.(MAIN_SELECTOR) || document.querySelector(MAIN_SELECTOR) || document.body;
    const blocks = contentBlocks(container);
    const selectedIndex = blocks.findIndex((element) => element.contains(range.startContainer));
    const index = selectedIndex >= 0 ? selectedIndex : Math.max(0, blocks.indexOf(startElement?.closest?.(CONTENT_SELECTOR)));
    const beforeText = blockText(blocks.slice(Math.max(0, index - 4), index)).slice(-3_000);
    const afterText = blockText(blocks.slice(index + 1, index + 5)).slice(0, 3_000);
    const sectionHeading = blocks
      .slice(0, Math.max(0, index))
      .filter((element) => /^H[1-4]$/.test(element.tagName))
      .at(-1)?.innerText?.trim().slice(0, 500) || "";

    return {
      selected_text: selectedText,
      before_text: beforeText,
      after_text: afterText,
      nearby_text: `Before:\n${beforeText}\n\nSelected:\n${selectedText}\n\nAfter:\n${afterText}`.slice(0, 8_000),
      section_heading: sectionHeading,
      page_title: document.title.slice(0, 300),
      page_url: window.location.href.slice(0, 1_000),
      container,
    };
  }

  function contentBlocks(container) {
    return Array.from(container.querySelectorAll(CONTENT_SELECTOR)).filter((element) => {
      if (element.closest(JUNK_SELECTOR)) return false;
      if (element.tagName === "CODE" && element.closest("pre")) return false;
      return Boolean(element.innerText?.trim());
    });
  }

  function blockText(blocks) {
    return blocks.map((element) => element.innerText.trim()).filter(Boolean).join("\n\n");
  }

  function extractMainContent() {
    const preferred = selected?.container || document.querySelector(MAIN_SELECTOR) || document.body;
    const content = blockText(contentBlocks(preferred));
    if (content) return content.slice(0, 20_000);
    return (preferred.innerText || "").trim().slice(0, 20_000);
  }

  function renderPill() {
    const left = clamp(selected.rect.left + selected.rect.width / 2, 116, innerWidth - 116);
    const top = Math.max(12, selected.rect.top - 66);
    surface.innerHTML = `<button class="pill" style="left:${left}px;top:${top}px" type="button">
      <span class="orb"><img src="${chrome.runtime.getURL("assets/lightbulb-filament.svg")}" alt=""></span>
      <span>explain this</span>
    </button>`;
    surface.querySelector(".pill").addEventListener("click", () => explain("quick"));
  }

  function explain(mode) {
    if (!selected) return;
    const version = ++requestVersion;
    renderPopover({ loadingMode: mode });
    const payload = {
      selected_text: selected.selected_text,
      before_text: selected.before_text,
      after_text: selected.after_text,
      nearby_text: selected.nearby_text,
      section_heading: selected.section_heading,
      page_title: selected.page_title,
      page_url: selected.page_url,
      context_mode: mode,
    };
    if (mode === "deep") payload.main_content = extractMainContent();

    chrome.runtime.sendMessage({ type: "EXPLAIN_SELECTION", payload }, (response) => {
      if (!selected || version !== requestVersion) return;
      if (chrome.runtime.lastError) return renderPopover({ error: "The local explanation service could not be reached." });
      if (!response?.ok) return renderPopover({ error: response?.error || "Local model inference failed." });

      const insufficient = response.insufficient_context || response.explanation.trim().toLowerCase().startsWith(INSUFFICIENT.toLowerCase());
      if (insufficient && mode === "deep") {
        renderPopover({ explanation: `${INSUFFICIENT} Try selecting a larger section.` });
        return;
      }
      renderPopover({
        explanation: response.explanation,
        action: insufficient
          ? { label: "Try with more page context", mode: "deep" }
          : mode === "quick" ? { label: "Explain deeper", mode: "deep" } : null,
      });
    });
  }

  function renderPopover({ loadingMode = "", explanation = "", error = "", action = null }) {
    const width = Math.min(390, innerWidth - 32);
    const left = clamp(selected.rect.left + selected.rect.width / 2 - width / 2, 16, innerWidth - width - 16);
    const top = selected.rect.top > 300 ? Math.max(16, selected.rect.top - 280) : selected.rect.bottom + 18;
    let body;
    if (loadingMode) {
      const loadingText = loadingMode === "deep" ? "Explaining with more page context..." : "Explaining locally...";
      body = `<p class="status">${loadingText}</p><div class="loading" aria-label="${loadingText}"><span></span><span></span><span></span></div>`;
    } else {
      body = `<p class="${error ? "error" : ""}">${escapeHtml(error || explanation)}</p>`;
      if (action) body += `<button class="secondary" type="button">${escapeHtml(action.label)}</button>`;
    }

    surface.innerHTML = `<section class="popover" style="left:${left}px;top:${top}px;width:${width}px" aria-live="polite">
      <header><span class="orb small"><img src="${chrome.runtime.getURL("assets/lightbulb-filament.svg")}" alt=""></span>
      <strong>Explanation</strong><button class="close" type="button" aria-label="Close explanation"><img src="${chrome.runtime.getURL("assets/x.svg")}" alt=""></button></header>
      ${body}</section>`;
    surface.querySelector(".close").addEventListener("click", close);
    if (action) surface.querySelector(".secondary").addEventListener("click", () => explain(action.mode));
  }

  function close() {
    requestVersion += 1;
    selected = null;
    surface.replaceChildren();
  }

  function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = value;
    return node.innerHTML;
  }

  function styles() {
    return `
      :host,*,*::before,*::after{box-sizing:border-box}.surface{position:fixed;inset:0;pointer-events:none;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button{font:inherit}
      .pill{position:fixed;display:flex;align-items:center;gap:11px;min-width:206px;height:58px;padding:0 22px;transform:translateX(-50%);border:1px solid #555552;border-radius:999px;color:#fff;background:#2c2c2a;box-shadow:0 14px 32px rgba(0,0,0,.28);cursor:pointer;pointer-events:auto;font-size:17px;font-weight:650;letter-spacing:-.025em;animation:pill-in 150ms ease-out}
      .pill::after,.popover::after{content:"";position:absolute;left:50%;bottom:-8px;width:14px;height:14px;transform:translateX(-50%) rotate(45deg);border-right:1px solid #555552;border-bottom:1px solid #555552;background:#2c2c2a}.pill:hover,.pill:focus-visible{border-color:#71716c;background:#343432;outline:none}
      .orb{display:grid;flex:0 0 auto;width:32px;height:32px;place-items:center;border-radius:50%;background:#083568}.orb img{width:19px;height:19px}.orb.small{width:30px;height:30px}.orb.small img{width:17px;height:17px}
      .popover{position:fixed;max-height:70vh;overflow:auto;padding:17px 19px 19px;border:1px solid #555552;border-radius:18px;color:#ecebe7;background:#2c2c2a;box-shadow:0 18px 46px rgba(0,0,0,.34);pointer-events:auto;animation:popover-in 180ms ease-out}.popover header{display:flex;align-items:center;gap:10px;color:#fff;font-size:16px}.popover strong{font-weight:700}
      .close{display:grid;width:30px;height:30px;margin-left:auto;place-items:center;border:0;border-radius:8px;background:transparent;cursor:pointer}.close:hover,.close:focus-visible{background:#3a3a37;outline:none}.close img{width:17px;height:17px}.popover p{margin:14px 2px 0;color:#d3d1cb;font-size:15px;font-weight:400;line-height:1.58;letter-spacing:normal;white-space:pre-wrap}.popover p.error{color:#ffb8b1}.popover p.status{color:#aaa8a3;font-size:13px}
      .secondary{margin-top:14px;padding:7px 10px;border:1px solid #555552;border-radius:9px;color:#9fc7ff;background:#252523;cursor:pointer;font-size:13px;font-weight:650}.secondary:hover,.secondary:focus-visible{border-color:#71716c;background:#343432;outline:none}
      .loading{display:grid;gap:8px;margin-top:12px}.loading span{height:8px;border-radius:999px;background:#42423f;animation:pulse 900ms ease-in-out infinite alternate}.loading span:nth-child(2){width:84%;animation-delay:100ms}.loading span:nth-child(3){width:62%;animation-delay:200ms}
      @keyframes pill-in{from{opacity:0;transform:translate(-50%,5px) scale(.97)}to{opacity:1;transform:translate(-50%,0) scale(1)}}@keyframes popover-in{from{opacity:0;transform:translateY(5px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes pulse{to{background:#555550}}@media(prefers-reduced-motion:reduce){.pill,.popover,.loading span{animation:none}}
    `;
  }
})();
