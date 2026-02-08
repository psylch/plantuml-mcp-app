import { useEffect, useRef, useState, useCallback } from "react";
import { type Theme, themeColors } from "../theme";

const SELECTION_COLOR = "#3b82f6";

export interface DiagramViewProps {
  svgContent: string | null;
  loading: boolean;
  error: string | null;
  theme: Theme;
  selectedElements: string[];
  onSelectionChange: (elements: string[]) => void;
}

/** Extract a usable ID from an SVG element by walking up to find a group with an id. */
function findSelectableId(target: Element, container: Element): string | null {
  let current: Element | null = target;
  while (current && current !== container) {
    if (current instanceof SVGGElement || current instanceof SVGRectElement || current instanceof SVGPathElement || current instanceof SVGEllipseElement) {
      const id = current.id || current.getAttribute("id");
      if (id && !id.startsWith("_")) return id;
    }
    // Also check parent <g> elements
    if (current.parentElement instanceof SVGGElement) {
      const parentId = current.parentElement.id || current.parentElement.getAttribute("id");
      if (parentId && !parentId.startsWith("_")) return parentId;
    }
    current = current.parentElement;
  }
  return null;
}

/** Inject selection CSS into SVG. */
function injectSelectionStyles(svgEl: SVGSVGElement) {
  const existing = svgEl.querySelector("style[data-selection-styles]");
  if (existing) existing.remove();

  const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styleEl.setAttribute("data-selection-styles", "true");
  styleEl.textContent = `
    [data-selected="true"] > rect,
    [data-selected="true"] > circle,
    [data-selected="true"] > ellipse,
    [data-selected="true"] > polygon,
    [data-selected="true"] > path,
    [data-selected="true"] > line {
      stroke: ${SELECTION_COLOR} !important;
      stroke-width: 3px !important;
      filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.5));
    }
    [data-selected="true"] {
      filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.4));
    }
    g[id]:not([id^="_"]) {
      cursor: pointer;
    }
  `;
  svgEl.insertBefore(styleEl, svgEl.firstChild);
}

/** Apply selection highlights to SVG elements. */
function applyHighlights(container: HTMLDivElement, selected: string[]) {
  const svgEl = container.querySelector("svg");
  if (!svgEl) return;

  svgEl.querySelectorAll("[data-selected]").forEach((el) => {
    el.removeAttribute("data-selected");
  });

  for (const id of selected) {
    const el = svgEl.querySelector(`#${CSS.escape(id)}`);
    if (el) el.setAttribute("data-selected", "true");
  }
}

/** Check if an element's bounding box intersects a screen-space rectangle. */
function elementIntersectsRect(
  el: Element,
  rect: { x: number; y: number; w: number; h: number },
  wrapper: HTMLDivElement,
): boolean {
  const elRect = el.getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();

  const local = {
    left: elRect.left - wrapperRect.left,
    top: elRect.top - wrapperRect.top,
    right: elRect.right - wrapperRect.left,
    bottom: elRect.bottom - wrapperRect.top,
  };

  return !(
    local.right < rect.x ||
    local.left > rect.x + rect.w ||
    local.bottom < rect.y ||
    local.top > rect.y + rect.h
  );
}

export default function DiagramView({
  svgContent,
  loading,
  error,
  theme,
  selectedElements,
  onSelectionChange,
}: DiagramViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragMoved = useRef(false);
  const marqueeJustFinished = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const colors = themeColors(theme);

  const [selectionMode, setSelectionMode] = useState(false);
  const selectionModeRef = useRef(selectionMode);
  selectionModeRef.current = selectionMode;

  const selectedRef = useRef(selectedElements);
  selectedRef.current = selectedElements;

  const [marquee, setMarquee] = useState<{
    active: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const marqueeRef = useRef(marquee);
  marqueeRef.current = marquee;

  // Inject SVG and post-process
  useEffect(() => {
    if (!containerRef.current || !svgContent) return;
    containerRef.current.innerHTML = svgContent;

    const svgEl = containerRef.current.querySelector("svg") as SVGSVGElement | null;
    if (svgEl) {
      injectSelectionStyles(svgEl);
      applyHighlights(containerRef.current, selectedRef.current);
    }
  }, [svgContent]);

  // Re-apply highlights when selection changes
  useEffect(() => {
    if (containerRef.current) {
      applyHighlights(containerRef.current, selectedElements);
    }
  }, [selectedElements]);

  // Toggle selection mode
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) onSelectionChange([]);
      return !prev;
    });
  }, [onSelectionChange]);

  // Wheel zoom (native event for passive: false)
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((prev) => Math.max(0.1, Math.min(5, prev * delta)));
    };

    wrapper.addEventListener("wheel", handleWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", handleWheel);
  }, []);

  // Click handler
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragMoved.current) return;
      if (marqueeJustFinished.current) {
        marqueeJustFinished.current = false;
        return;
      }
      if (!selectionModeRef.current) return;

      const target = e.target as Element;
      const clickedId = findSelectableId(target, containerRef.current!);

      if (clickedId) {
        const already = selectedRef.current.includes(clickedId);
        if (already) {
          onSelectionChange(selectedRef.current.filter((id) => id !== clickedId));
        } else {
          onSelectionChange([...selectedRef.current, clickedId]);
        }
      } else {
        if (selectedRef.current.length > 0) {
          onSelectionChange([]);
        }
      }
    },
    [onSelectionChange],
  );

  // Mouse handlers for pan and marquee
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      if (selectionModeRef.current) {
        const target = e.target as Element;
        const onElement = findSelectableId(target, containerRef.current!) !== null;

        if (!onElement && wrapperRef.current) {
          const rect = wrapperRef.current.getBoundingClientRect();
          const startX = e.clientX - rect.left;
          const startY = e.clientY - rect.top;
          setMarquee({ active: true, startX, startY, currentX: startX, currentY: startY });
          e.preventDefault();
          return;
        }
      }

      dragging.current = true;
      dragMoved.current = false;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    },
    [],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (marqueeRef.current?.active && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setMarquee((prev) =>
        prev ? { ...prev, currentX: e.clientX - rect.left, currentY: e.clientY - rect.top } : null,
      );
      return;
    }

    if (!dragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (marqueeRef.current?.active && wrapperRef.current && containerRef.current) {
        const m = marqueeRef.current;
        const rect = {
          x: Math.min(m.startX, m.currentX),
          y: Math.min(m.startY, m.currentY),
          w: Math.abs(m.currentX - m.startX),
          h: Math.abs(m.currentY - m.startY),
        };

        if (rect.w > 5 && rect.h > 5) {
          const svgEl = containerRef.current.querySelector("svg");
          if (svgEl) {
            const selected: string[] = [];
            svgEl.querySelectorAll("g[id]:not([id^='_'])").forEach((el) => {
              if (elementIntersectsRect(el, rect, wrapperRef.current!)) {
                selected.push(el.id);
              }
            });

            if (e.shiftKey && selectedRef.current.length > 0) {
              const merged = new Set([...selectedRef.current, ...selected]);
              onSelectionChange(Array.from(merged));
            } else {
              onSelectionChange(selected);
            }
          }
        }

        setMarquee(null);
        marqueeJustFinished.current = true;
        return;
      }

      dragging.current = false;
    },
    [onSelectionChange],
  );

  const handleMouseLeave = useCallback(() => {
    dragging.current = false;
    if (marqueeRef.current?.active) setMarquee(null);
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const marqueeRect = marquee?.active
    ? {
        left: Math.min(marquee.startX, marquee.currentX),
        top: Math.min(marquee.startY, marquee.currentY),
        width: Math.abs(marquee.currentX - marquee.startX),
        height: Math.abs(marquee.currentY - marquee.startY),
      }
    : null;

  return (
    <div
      ref={wrapperRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        cursor: marquee?.active ? "crosshair" : selectionMode ? "default" : "grab",
        backgroundColor: colors.canvasBg,
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* SVG container */}
      <div
        ref={containerRef}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "center center",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100%",
          padding: 24,
        }}
      />

      {/* Loading spinner */}
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.05)",
            zIndex: 30,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              border: "3px solid rgba(0,0,0,0.1)",
              borderTopColor: SELECTION_COLOR,
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error display */}
      {error && !loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            zIndex: 25,
          }}
        >
          <div
            style={{
              maxWidth: 400,
              padding: "16px 20px",
              backgroundColor: theme === "dark" ? "#2d1b1b" : "#fef2f2",
              border: `1px solid ${theme === "dark" ? "#7f1d1d" : "#fca5a5"}`,
              borderRadius: 8,
              fontSize: 13,
              color: theme === "dark" ? "#fca5a5" : "#991b1b",
              lineHeight: 1.5,
              wordBreak: "break-word",
            }}
          >
            {error}
          </div>
        </div>
      )}

      {/* Marquee overlay */}
      {marqueeRect && (
        <div
          style={{
            position: "absolute",
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.width,
            height: marqueeRect.height,
            border: `2px dashed ${SELECTION_COLOR}`,
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      )}

      {/* Selection count */}
      {selectedElements.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: SELECTION_COLOR,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 12,
            zIndex: 10,
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }}
        >
          {selectedElements.length} selected
        </div>
      )}

      {/* Zoom controls + selection toggle */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          display: "flex",
          gap: 4,
          background: colors.zoomBg,
          border: `1px solid ${colors.zoomBorder}`,
          borderRadius: 6,
          padding: 2,
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          zIndex: 10,
        }}
      >
        <button onClick={() => setScale((s) => Math.max(0.1, s * 0.85))} style={{ ...zoomBtnStyle, color: colors.zoomText }} title="Zoom out">-</button>
        <button onClick={resetView} style={{ ...zoomBtnStyle, minWidth: 48, fontSize: 11, color: colors.zoomText }} title="Reset view">
          {Math.round(scale * 100)}%
        </button>
        <button onClick={() => setScale((s) => Math.min(5, s * 1.15))} style={{ ...zoomBtnStyle, color: colors.zoomText }} title="Zoom in">+</button>

        <div style={{ width: 1, backgroundColor: colors.zoomBorder, margin: "2px 2px" }} />
        <button
          onClick={toggleSelectionMode}
          style={{
            ...zoomBtnStyle,
            color: selectionMode ? "#fff" : colors.zoomText,
            backgroundColor: selectionMode ? SELECTION_COLOR : "transparent",
            borderRadius: 4,
            transition: "background-color 0.15s, color 0.15s",
          }}
          title={selectionMode ? "Exit selection mode" : "Enter selection mode"}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="10" height="10" strokeDasharray="3 2" />
            <path d="M6 6L9 12L10.5 9L13.5 7.5L6 6Z" fill="currentColor" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>

      {/* Mode hint */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          fontSize: 11,
          color: selectionMode ? SELECTION_COLOR : colors.toolbarLabel,
          opacity: selectionMode ? 0.9 : 0.7,
          zIndex: 10,
          fontWeight: selectionMode ? 500 : 400,
        }}
      >
        {selectionMode ? "Click to select \u00B7 Drag to box select" : "Scroll to zoom \u00B7 Drag to pan"}
      </div>
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 16,
  padding: "4px 8px",
  lineHeight: 1,
  borderRadius: 4,
};
