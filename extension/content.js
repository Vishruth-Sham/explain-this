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
  let lastExplanation = "";
  let requestVersion = 0;
  let activePort = null;
  let streamEl = null;
  let popoverPos = null;

  document.addEventListener("mouseup", () => {
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
  window.addEventListener("resize", close);

  function captureSelection() {
    const selection = window.getSelection();
    // A drag can end (mouseup) with the cursor resting on our own popover — that's about where the
    // mouse happened to be released, not about what got selected. Key off the selection's real
    // location instead: if it's inside our UI (e.g. copying the explanation text), leave it alone.
    if (selection?.anchorNode && host.contains(selection.anchorNode)) return;

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
    lastExplanation = "";
    popoverPos = null;
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
    const left = clamp(selected.rect.left + selected.rect.width / 2, 96, innerWidth - 96);
    const top = Math.max(12, selected.rect.top - 56);
    streamEl = null;
    surface.innerHTML = `<button class="pill" style="left:${left}px;top:${top}px" type="button">
      <span class="orb"></span><span>explain this</span>
    </button>`;
    surface.querySelector(".pill").addEventListener("click", () => explain("quick"));
  }

  function explain(contextMode) {
    if (!selected) return;
    const version = ++requestVersion;
    activePort?.disconnect();
    activePort = null;
    renderPopover({ loadingMode: contextMode });
    const selectedText = selected.selected_text || window.getSelection()?.toString().trim().slice(0, 4_000) || "";
    if (!selectedText) {
      renderPopover({ error: "Select text again, then click explain this." });
      return;
    }
    const payload = {
      selected_text: selectedText,
      before_text: selected.before_text,
      after_text: selected.after_text,
      nearby_text: selected.nearby_text,
      section_heading: selected.section_heading,
      page_title: selected.page_title,
      page_url: selected.page_url,
      context_mode: contextMode,
    };
    if (contextMode === "deep") payload.main_content = extractMainContent();

    const port = chrome.runtime.connect({ name: "explain" });
    activePort = port;

    port.onMessage.addListener((message) => {
      if (!selected || version !== requestVersion) return;

      if (message.type === "CHUNK") {
        if (streamEl) streamEl.textContent = message.text;
        else renderPopover({ explanation: message.text, streaming: true });
        return;
      }

      if (message.type === "ERROR") {
        renderPopover({
          explanation: lastExplanation,
          error: message.error,
          actions: followupActions(contextMode, false),
        });
        return;
      }

      const insufficient = message.insufficient_context
        || message.explanation.trim().toLowerCase().startsWith(INSUFFICIENT.toLowerCase());
      if (insufficient && contextMode === "deep") {
        renderPopover({ explanation: `${INSUFFICIENT} Try selecting a larger section.` });
        return;
      }
      lastExplanation = message.explanation;
      renderPopover({
        explanation: message.explanation,
        actions: followupActions(contextMode, insufficient),
      });
    });

    port.onDisconnect.addListener(() => {
      if (activePort === port) activePort = null;
    });
    port.postMessage({ type: "EXPLAIN_SELECTION", payload });
  }

  function followupActions(contextMode, insufficient) {
    if (insufficient) return [{ label: "Try with more page context", contextMode: "deep" }];

    const actions = [];
    if (contextMode === "quick") {
      actions.push({ label: "Explain deeper", contextMode: "deep" });
    }
    return actions;
  }

  function renderPopover({
    loadingMode = "",
    explanation = "",
    error = "",
    streaming = false,
    actions = [],
  }) {
    const width = Math.min(384, innerWidth - 32);
    const reused = Boolean(surface.querySelector(".popover"));
    let body;

    if (loadingMode) {
      const loadingText = loadingMode === "deep" ? "Reading the page" : "Thinking";
      body = `<p class="status">${loadingText}<span class="ellipsis"><i>.</i><i>.</i><i>.</i></span></p>
        <div class="skeleton" aria-label="${loadingText}"><span></span><span></span><span></span></div>`;
    } else {
      body = explanation
        ? `<p class="body${streaming ? " is-streaming" : ""}">${escapeHtml(explanation)}</p>`
        : "";
      if (error) body += `<p class="error">${escapeHtml(error)}</p>`;
      if (actions.length) {
        body += `<div class="actions">${actions.map((action, index) =>
          `<button class="secondary" data-action-index="${index}" type="button">${escapeHtml(action.label)}</button>`
        ).join("")}</div>`;
      }
    }

    surface.innerHTML = `<section class="popover" style="width:${width}px" aria-live="polite">
      <header><span class="orb small"></span>
      <strong>Explanation</strong><button class="close" type="button" aria-label="Close explanation"><img src="${chrome.runtime.getURL("assets/x.svg")}" alt=""></button></header>
      ${body}</section>`;

    const popover = surface.querySelector(".popover");
    if (reused) popover.style.animation = "none";
    placePopover(popover);
    enableDrag(popover);

    streamEl = streaming ? surface.querySelector(".body") : null;
    surface.querySelector(".close").addEventListener("click", close);
    actions.forEach((action, index) => {
      surface.querySelector(`[data-action-index="${index}"]`).addEventListener("click", () => {
        explain(action.contextMode);
      });
    });
  }

  // Positions against the measured height so the popover is never pushed below
  // the fold — it is position:fixed, so anything off-screen is unreachable.
  function placePopover(popover) {
    const { offsetWidth: width, offsetHeight: height } = popover;
    const gap = 12;
    const margin = 12;

    if (popoverPos) {
      popover.style.left = `${clamp(popoverPos.left, margin, Math.max(margin, innerWidth - width - margin))}px`;
      popover.style.top = `${clamp(popoverPos.top, margin, Math.max(margin, innerHeight - height - margin))}px`;
      return;
    }

    const below = selected.rect.bottom + gap;
    const above = selected.rect.top - height - gap;
    let top;
    if (below + height <= innerHeight - margin) top = below;
    else if (above >= margin) top = above;
    else top = Math.max(margin, innerHeight - height - margin);

    popover.style.left = `${clamp(selected.rect.left + selected.rect.width / 2 - width / 2, margin, Math.max(margin, innerWidth - width - margin))}px`;
    popover.style.top = `${top}px`;
  }

  function enableDrag(popover) {
    const header = popover.querySelector("header");
    header.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".close") || event.button !== 0) return;
      event.preventDefault();

      const rect = popover.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      popover.style.animation = "none";
      popover.classList.add("is-dragging");
      header.setPointerCapture(event.pointerId);

      const onMove = (move) => {
        const left = clamp(move.clientX - offsetX, 8, Math.max(8, innerWidth - popover.offsetWidth - 8));
        const top = clamp(move.clientY - offsetY, 8, Math.max(8, innerHeight - popover.offsetHeight - 8));
        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
        popoverPos = { left, top };
      };
      const onUp = () => {
        header.removeEventListener("pointermove", onMove);
        header.removeEventListener("pointerup", onUp);
        header.removeEventListener("pointercancel", onUp);
        popover.classList.remove("is-dragging");
      };

      header.addEventListener("pointermove", onMove);
      header.addEventListener("pointerup", onUp);
      header.addEventListener("pointercancel", onUp);
    });
  }

  function close() {
    requestVersion += 1;
    activePort?.disconnect();
    activePort = null;
    streamEl = null;
    popoverPos = null;
    selected = null;
    lastExplanation = "";
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
      :host,*,*::before,*::after{box-sizing:border-box}
      .surface{position:fixed;inset:0;pointer-events:none;
        --glass:linear-gradient(rgba(38,38,46,.90),rgba(20,20,26,.92));
        --edge:rgba(255,255,255,.12);--edge-lit:rgba(255,255,255,.22);
        --fg:#f5f5f7;--fg-dim:#d8d8df;--fg-mute:#8e8e99;--accent-a:#7db1ff;--accent-b:#b18cff;--danger:#ff9f97;
        --shade:0 20px 56px -16px rgba(0,0,0,.72),0 6px 16px -8px rgba(0,0,0,.5);
        --ease:cubic-bezier(.16,1,.3,1);
        font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;
        -webkit-font-smoothing:antialiased}
      button{font:inherit;margin:0}

      .pill{position:fixed;display:inline-flex;align-items:center;gap:9px;height:40px;padding:0 15px 0 9px;
        transform:translateX(-50%);border:1px solid var(--edge);border-radius:999px;color:var(--fg);
        background:var(--glass);-webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%);
        box-shadow:var(--shade),inset 0 1px 0 rgba(255,255,255,.09);cursor:pointer;pointer-events:auto;white-space:nowrap;
        font-size:13.5px;font-weight:560;letter-spacing:-.01em;
        animation:rise-centered 260ms var(--ease) both;
        transition:transform 200ms var(--ease),border-color 200ms var(--ease),box-shadow 200ms var(--ease)}
      .pill:hover{transform:translateX(-50%) translateY(-2px);border-color:var(--edge-lit);
        box-shadow:0 26px 64px -16px rgba(0,0,0,.78),0 8px 20px -8px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.14)}
      .pill:active{transform:translateX(-50%) translateY(0)}
      .pill:focus-visible{outline:2px solid var(--accent-a);outline-offset:3px}

      .orb{flex:0 0 auto;width:20px;height:20px;border-radius:6px;
        background:linear-gradient(135deg,var(--accent-a),var(--accent-b));
        box-shadow:0 0 14px -4px rgba(125,177,255,.75),inset 0 1px 0 rgba(255,255,255,.3)}
      .orb.small{width:15px;height:15px;border-radius:5px}

      .popover{position:fixed;max-height:min(420px,calc(100vh - 32px));overflow:auto;overscroll-behavior:contain;
        scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent;
        padding:15px 17px 17px;border:1px solid var(--edge);border-radius:16px;color:var(--fg);
        background:var(--glass);-webkit-backdrop-filter:blur(28px) saturate(180%);backdrop-filter:blur(28px) saturate(180%);
        box-shadow:var(--shade),inset 0 1px 0 rgba(255,255,255,.09);pointer-events:auto;animation:rise 280ms var(--ease) both}
      .popover::-webkit-scrollbar{width:8px}
      .popover::-webkit-scrollbar-track{background:transparent}
      .popover::-webkit-scrollbar-thumb{border:2px solid transparent;border-radius:999px;background:rgba(255,255,255,.16);background-clip:padding-box}
      .popover::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.28);background-clip:padding-box}
      .popover header{display:flex;align-items:center;gap:9px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;
        cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
      .popover.is-dragging{box-shadow:0 32px 72px -16px rgba(0,0,0,.82),inset 0 1px 0 rgba(255,255,255,.16)}
      .popover.is-dragging header{cursor:grabbing}
      .popover strong{font-weight:600;color:var(--fg-mute)}

      .close{display:grid;width:26px;height:26px;margin-left:auto;place-items:center;border:0;border-radius:7px;
        background:transparent;cursor:pointer;opacity:.55;
        transition:opacity 160ms var(--ease),background 160ms var(--ease)}
      .close:hover{opacity:1;background:rgba(255,255,255,.08)}
      .close:focus-visible{outline:2px solid var(--accent-a);outline-offset:1px;opacity:1}
      .close img{width:15px;height:15px}

      .popover p{margin:13px 1px 0;font-size:14.5px;line-height:1.62;white-space:pre-wrap;
        color:var(--fg-dim);animation:fade 240ms var(--ease) both}
      .popover p.error{color:var(--danger);font-size:13.5px}
      .popover p.status{display:flex;align-items:center;color:var(--fg-mute);font-size:12.5px;letter-spacing:.01em}
      .body.is-streaming::after{content:"";display:inline-block;width:2px;height:1.05em;margin-left:3px;
        vertical-align:-3px;border-radius:1px;background:var(--accent-a);animation:blink 1.1s steps(2,end) infinite}

      .ellipsis i{font-style:normal;opacity:.25;animation:dot 1.3s var(--ease) infinite}
      .ellipsis i:nth-child(2){animation-delay:.16s}.ellipsis i:nth-child(3){animation-delay:.32s}

      .skeleton{display:grid;gap:9px;margin-top:13px}
      .skeleton span{height:9px;border-radius:999px;
        background:linear-gradient(90deg,rgba(255,255,255,.05) 0%,rgba(255,255,255,.14) 50%,rgba(255,255,255,.05) 100%);
        background-size:220% 100%;animation:shimmer 1.5s linear infinite}
      .skeleton span:nth-child(2){width:86%;animation-delay:.1s}
      .skeleton span:nth-child(3){width:58%;animation-delay:.2s}

      .actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:15px}
      .secondary{padding:7px 12px;border:1px solid var(--edge);border-radius:8px;color:var(--fg);
        background:rgba(255,255,255,.04);cursor:pointer;font-size:12.5px;font-weight:560;letter-spacing:-.005em;
        transition:background 160ms var(--ease),border-color 160ms var(--ease),transform 160ms var(--ease)}
      .secondary:hover{background:rgba(255,255,255,.10);border-color:var(--edge-lit);transform:translateY(-1px)}
      .secondary:active{transform:translateY(0)}
      .secondary:focus-visible{outline:2px solid var(--accent-a);outline-offset:2px}

      @keyframes rise{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes rise-centered{from{opacity:0;transform:translateX(-50%) translateY(6px) scale(.97)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
      @keyframes fade{from{opacity:0}to{opacity:1}}
      @keyframes shimmer{to{background-position:-220% 0}}
      @keyframes blink{50%{opacity:0}}
      @keyframes dot{0%,60%,100%{opacity:.25}30%{opacity:.9}}
      @media(prefers-reduced-motion:reduce){
        .pill,.popover,.popover p{animation:none}
        .skeleton span,.ellipsis i,.body.is-streaming::after{animation:none}
        .pill:hover,.secondary:hover{transform:translateX(-50%)}
        .secondary:hover{transform:none}
      }
    `;
  }
})();
