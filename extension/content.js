(() => {
  const HOST_ID = "explain-this-extension-root";
  const BLOCK_SELECTOR = "p, li, dd, dt, blockquote, pre";
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

  document.addEventListener("mouseup", () => setTimeout(captureSelection, 0), true);
  document.addEventListener("keyup", (event) => {
    if (event.key === "Escape") return close();
    setTimeout(captureSelection, 0);
  }, true);
  window.addEventListener("scroll", close, true);
  window.addEventListener("resize", close);

  function captureSelection() {
    const selection = window.getSelection();
    const text = selection?.toString().trim().replace(/\s+/g, " ") || "";
    if (!selection?.rangeCount || text.length < 5 || text.length > 2000) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    selected = {
      text,
      context: nearbyContext(range),
      rect: { left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width },
    };
    requestVersion += 1;
    renderPill();
  }

  function nearbyContext(range) {
    const node = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    const current = node?.closest?.(BLOCK_SELECTOR);
    if (!current) return (node?.innerText || node?.textContent || "").trim().slice(0, 4000);

    const siblings = current.parentElement
      ? Array.from(current.parentElement.children).filter((element) => element.matches?.(BLOCK_SELECTOR))
      : [current];
    const index = siblings.indexOf(current);
    const blocks = index < 0 ? [current] : siblings.slice(Math.max(0, index - 1), index + 2);
    return blocks.map((element) => element.innerText?.trim()).filter(Boolean).join("\n\n").slice(0, 4000);
  }

  function renderPill() {
    const left = clamp(selected.rect.left + selected.rect.width / 2, 116, innerWidth - 116);
    const top = Math.max(12, selected.rect.top - 66);
    surface.innerHTML = `<button class="pill" style="left:${left}px;top:${top}px" type="button">
      <span class="orb"><img src="${chrome.runtime.getURL("assets/lightbulb-filament.svg")}" alt=""></span>
      <span>explain this</span>
    </button>`;
    surface.querySelector(".pill").addEventListener("click", explain);
  }

  function explain() {
    const version = ++requestVersion;
    renderPopover({ loading: true });
    chrome.runtime.sendMessage({
      type: "EXPLAIN_SELECTION",
      payload: { selection: selected.text, context: selected.context, pageTitle: document.title },
    }, (response) => {
      if (!selected || version !== requestVersion) return;
      if (chrome.runtime.lastError) return renderPopover({ error: "The explanation service could not be reached." });
      if (!response?.ok) return renderPopover({ error: response?.error || "The explanation service is unavailable." });
      renderPopover({ explanation: response.explanation });
    });
  }

  function renderPopover({ loading = false, explanation = "", error = "" }) {
    const width = Math.min(390, innerWidth - 32);
    const left = clamp(selected.rect.left + selected.rect.width / 2 - width / 2, 16, innerWidth - width - 16);
    const top = selected.rect.top > 230 ? selected.rect.top - 204 : selected.rect.bottom + 18;
    const body = loading
      ? '<div class="loading" aria-label="Generating explanation"><span></span><span></span><span></span></div>'
      : `<p class="${error ? "error" : ""}">${escapeHtml(error || explanation)}</p>`;
    surface.innerHTML = `<section class="popover" style="left:${left}px;top:${top}px;width:${width}px" aria-live="polite">
      <header><span class="orb small"><img src="${chrome.runtime.getURL("assets/lightbulb-filament.svg")}" alt=""></span>
      <strong>Explanation</strong><button class="close" type="button" aria-label="Close explanation"><img src="${chrome.runtime.getURL("assets/x.svg")}" alt=""></button></header>
      ${body}</section>`;
    surface.querySelector(".close").addEventListener("click", close);
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
      .pill{position:fixed;display:flex;align-items:center;gap:11px;min-width:206px;height:58px;padding:0 22px;transform:translateX(-50%);border:1px solid #555552;border-radius:999px;color:#fff;background:#2c2c2a;box-shadow:0 14px 32px rgba(0,0,0,.28);cursor:pointer;pointer-events:auto;font-size:20px;font-weight:650;letter-spacing:-.025em;animation:pill-in 150ms ease-out}
      .pill::after,.popover::after{content:"";position:absolute;left:50%;bottom:-8px;width:14px;height:14px;transform:translateX(-50%) rotate(45deg);border-right:1px solid #555552;border-bottom:1px solid #555552;background:#2c2c2a}.pill:hover,.pill:focus-visible{border-color:#71716c;background:#343432;outline:none}
      .orb{display:grid;flex:0 0 auto;width:32px;height:32px;place-items:center;border-radius:50%;background:#083568}.orb img{width:19px;height:19px}.orb.small{width:30px;height:30px}.orb.small img{width:17px;height:17px}
      .popover{position:fixed;padding:17px 19px 19px;border:1px solid #555552;border-radius:18px;color:#ecebe7;background:#2c2c2a;box-shadow:0 18px 46px rgba(0,0,0,.34);pointer-events:auto;animation:popover-in 180ms ease-out}.popover header{display:flex;align-items:center;gap:10px;color:#fff;font-size:16px}.popover strong{font-weight:700}
      .close{display:grid;width:30px;height:30px;margin-left:auto;place-items:center;border:0;border-radius:8px;background:transparent;cursor:pointer}.close:hover,.close:focus-visible{background:#3a3a37;outline:none}.close img{width:17px;height:17px}.popover p{margin:14px 2px 0;color:#d3d1cb;font-size:15px;font-weight:400;line-height:1.58;letter-spacing:normal}.popover p.error{color:#ffb8b1}
      .loading{display:grid;gap:8px;margin-top:17px}.loading span{height:8px;border-radius:999px;background:#42423f;animation:pulse 900ms ease-in-out infinite alternate}.loading span:nth-child(2){width:84%;animation-delay:100ms}.loading span:nth-child(3){width:62%;animation-delay:200ms}
      @keyframes pill-in{from{opacity:0;transform:translate(-50%,5px) scale(.97)}to{opacity:1;transform:translate(-50%,0) scale(1)}}@keyframes popover-in{from{opacity:0;transform:translateY(5px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes pulse{to{background:#555550}}@media(prefers-reduced-motion:reduce){.pill,.popover,.loading span{animation:none}}
    `;
  }
})();
