import { useCallback, useEffect, useRef, useState } from "react";
import { DotsThree, LightbulbFilament, X } from "@phosphor-icons/react";

const DEFAULT_SELECTION = "photosynthesis converts light energy";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function App() {
  const articleRef = useRef(null);
  const defaultSelectionRef = useRef(null);
  const requestRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [view, setView] = useState("pill");
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState("");

  const captureSelection = useCallback(() => {
    const activeSelection = window.getSelection();
    const selectedText = activeSelection?.toString().trim() ?? "";

    if (!selectedText || !activeSelection?.rangeCount) {
      return;
    }

    const range = activeSelection.getRangeAt(0);
    if (!articleRef.current?.contains(range.commonAncestorContainer)) return;

    const rect = range.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    setSelection({ text: selectedText, rect });
    setView("pill");
    setLoading(false);
    setExplanation("");
    requestRef.current?.abort();
  }, []);

  const selectDefaultText = useCallback(() => {
    const node = defaultSelectionRef.current?.firstChild;
    if (!node) return;

    const range = document.createRange();
    range.selectNodeContents(defaultSelectionRef.current);
    const activeSelection = window.getSelection();
    activeSelection.removeAllRanges();
    activeSelection.addRange(range);
    captureSelection();
  }, [captureSelection]);

  useEffect(() => {
    const timer = window.setTimeout(selectDefaultText, 350);
    document.addEventListener("mouseup", captureSelection);
    document.addEventListener("keyup", captureSelection);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mouseup", captureSelection);
      document.removeEventListener("keyup", captureSelection);
    };
  }, [captureSelection, selectDefaultText]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setSelection(null);
        window.getSelection()?.removeAllRanges();
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const openExplanation = async () => {
    setView("popover");
    setLoading(true);
    setExplanation("");

    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selection: selection.text,
          context: articleRef.current?.innerText || "",
          pageTitle: document.title,
        }),
        signal: controller.signal,
      });

      const result = await response.json();
      if (!response.ok || !result.explanation) {
        const message = typeof result?.error === "string" ? result.error : result?.error?.message;
        throw new Error(message || "Explanation request failed.");
      }

      setExplanation(result.explanation);
    } catch (error) {
      if (error.name === "AbortError") return;
      console.warn("Local explanation failed:", error.message);
      setExplanation(error.message);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  };

  const closeOverlay = () => {
    setSelection(null);
    setView("pill");
    setLoading(false);
    setExplanation("");
    requestRef.current?.abort();
    requestRef.current = null;
    window.getSelection()?.removeAllRanges();
  };

  useEffect(() => {
    const closeOnOutsidePointer = (event) => {
      if (!selection || event.target.closest?.(".explain-pill, .explanation-popover")) return;
      closeOverlay();
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  });

  const pillStyle = selection
    ? {
        left: clamp(selection.rect.left + selection.rect.width / 2, 130, window.innerWidth - 130),
        top: Math.max(12, selection.rect.top - 89),
      }
    : undefined;

  const popoverWidth = Math.min(390, window.innerWidth - 32);
  const popoverStyle = selection
    ? {
        left: clamp(
          selection.rect.left + selection.rect.width / 2 - popoverWidth / 2,
          16,
          window.innerWidth - popoverWidth - 16,
        ),
        top: selection.rect.top > 220 ? selection.rect.top - 194 : selection.rect.bottom + 18,
        width: popoverWidth,
      }
    : undefined;

  return (
    <main className="workspace">
      <header className="concept-header">
        <p>OPTION A — FLOATING PILL</p>
        <button className="menu-button" aria-label="More options">
          <DotsThree size={28} weight="bold" />
        </button>
      </header>

      <article className="reading-surface" ref={articleRef}>
        <p>
          The process of <span ref={defaultSelectionRef}>{DEFAULT_SELECTION}</span> into chemical energy stored in glucose
          molecules, sustaining nearly all life on Earth.
        </p>
      </article>

      <p className="instruction">select → pill appears above → tap to expand into a popover</p>

      {selection && view === "pill" && (
        <button className="explain-pill" style={pillStyle} onClick={openExplanation}>
          <span className="icon-orb" aria-hidden="true">
            <LightbulbFilament size={22} weight="regular" />
          </span>
          <span>explain this</span>
        </button>
      )}

      {selection && view === "popover" && (
        <section className="explanation-popover" style={popoverStyle} aria-live="polite">
          <div className="popover-heading">
            <span className="icon-orb" aria-hidden="true">
              <LightbulbFilament size={20} weight="regular" />
            </span>
            <span>Explanation</span>
            <button className="close-button" onClick={closeOverlay} aria-label="Close explanation">
              <X size={18} weight="bold" />
            </button>
          </div>
          {loading ? (
            <div className="loading-lines" aria-label="Generating explanation">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <p>{explanation}</p>
          )}
        </section>
      )}
    </main>
  );
}
